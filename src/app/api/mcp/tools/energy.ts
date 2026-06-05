/**
 * `tamrack_energy` tool registration.
 *
 * Wraps AESO + CER energy substrate and AER well-licence data behind one
 * typed surface.
 *
 *   - `src/lib/data-sources-aeso.ts` — AESO public API (requires
 *     AESO_API_KEY env var, free key from api.aeso.ca). Pool price, the
 *     current supply/demand snapshot, system marginal price, the
 *     load-forecast/actual report, and a daily-average pool-price
 *     series.
 *
 *   - `src/lib/data-sources-cer.ts` — Canada Energy Regulator open CSV
 *     data (no auth). Pipeline throughput per pipeline (NGTL,
 *     Trans-Mountain, Keystone, Enbridge Mainline, Alliance, Foothills),
 *     pipeline incidents, apportionment, monthly crude oil production
 *     by province (Alberta default).
 *
 *   - `src/lib/data-sources-infrastructure.ts` — AER well licences
 *     accumulated in Postgres from the AER daily fixed-width list. Three
 *     datasets: individual licence records, daily filing totals with
 *     substance/classification/licensee breakdowns, and the operator
 *     roster derived from the substrate entity directory.
 *
 * Datasets (12):
 *   - pool_price_current    → AESO pool price for the current/recent window
 *                             (hourly rows, last 30d default)
 *   - pool_price_series     → AESO daily-average pool price time series
 *                             (uses time_range to size the window)
 *   - supply_demand         → AESO current supply/demand snapshot (single
 *                             object, no time series)
 *   - system_marginal_price → AESO system marginal price (hourly rows)
 *   - forecast              → AESO actual-vs-forecast load (hourly rows)
 *   - pipeline_throughput   → CER throughput CSV; requires a pipeline (one
 *                             of NGTL/Trans-Mountain/Keystone/Enbridge
 *                             Mainline/Alliance/Foothills). Default: NGTL.
 *   - pipeline_incidents    → CER pipeline incident report (Alberta + ROC)
 *   - apportionment         → CER pipeline apportionment (congestion) data
 *   - oil_production        → CER monthly crude oil production by province,
 *                             filtered to Alberta by default
 *   - well_licences         → AER well licences from Postgres (individual
 *                             records; filterable by filing date range)
 *   - well_licences_daily   → Daily filing totals with substance,
 *                             classification, and licensee breakdowns
 *   - well_operators        → Current well-operator roster with per-operator
 *                             licence counts (substrate entity directory)
 *
 * Time range:
 *   AESO pool_price_current accepts `startDate`/`endDate` in YYYY-MM-DD,
 *   so we translate explicit `{from, to}` ranges into them. Named ranges
 *   are translated to a sliding window (last_30d → 30 days, etc.). The
 *   AESO supply/demand snapshot has no time dimension; if a time_range is
 *   passed it's surfaced as a note. CER fetchers return full historical
 *   series and we filter the date column post-fetch. Well-licence datasets
 *   translate time_range to a filing_date window or days limit.
 *
 * Fallback policy:
 *   No `data-fallback.ts` entries for energy. Substrate fetchers swallow
 *   errors and return [] / null; we degrade to `served_from: "empty"`.
 *
 * `limit`:
 *   Applied as a tail-N to every series-shaped dataset for predictability.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  fetchActualForecast,
  fetchCurrentSupplyDemand,
  fetchPoolPrice,
  fetchPoolPriceTimeSeries,
  fetchSystemMarginalPrice,
  type ActualForecastPoint,
  type PoolPricePoint,
  type SupplyDemandReport,
  type SystemMarginalPricePoint,
  type TimeSeriesPoint as AesoTimeSeriesPoint,
} from "@/lib/data-sources-aeso";
import {
  CER_ENDPOINTS,
  fetchApportionment,
  fetchCrudeOilProduction,
  fetchPipelineIncidents,
  fetchPipelineThroughput,
  type ApportionmentPoint,
  type CEREndpointKey,
  type PipelineIncident,
  type PipelineThroughputPoint,
  type ProductionPoint,
} from "@/lib/data-sources-cer";
import {
  fetchWellLicenceRecords,
  fetchWellLicenceDaily,
  fetchWellOperators,
  type WellLicenceRecord,
  type WellLicenceDailyPoint,
  type WellOperator,
} from "@/lib/data-sources-infrastructure";

import {
  LimitSchema,
  SCHEMA_VERSION,
  TimeRangeSchema,
  type TimeRange,
} from "../schemas";
import { updateToolEntry } from "../registry";
import { requireScopes } from "../lib/auth-context";

const REQUIRED_SCOPES = ["tamrack:energy:read"] as const;

// ---------------------------------------------------------------------------
// Dataset enum + supporting input
// ---------------------------------------------------------------------------

const ENERGY_DATASETS = [
  "pool_price_current",
  "pool_price_series",
  "supply_demand",
  "system_marginal_price",
  "forecast",
  "pipeline_throughput",
  "pipeline_incidents",
  "apportionment",
  "oil_production",
  "well_licences",
  "well_licences_daily",
  "well_operators",
] as const;

type EnergyDataset = (typeof ENERGY_DATASETS)[number];

const EnergyDatasetSchema = z
  .enum(ENERGY_DATASETS)
  .describe(
    "Energy dataset. AESO: pool_price_current (hourly), pool_price_series (daily avg), supply_demand (snapshot), system_marginal_price, forecast. CER: pipeline_throughput (per pipeline), pipeline_incidents, apportionment, oil_production. AER (Postgres): well_licences (individual records), well_licences_daily (daily filing totals with breakdowns), well_operators (operator roster with licence counts).",
  );

const PIPELINE_NAMES = [
  "NGTL",
  "Trans-Mountain",
  "Keystone",
  "Enbridge Mainline",
  "Alliance",
  "Foothills",
] as const;

const PipelineSchema = z
  .enum(PIPELINE_NAMES)
  .describe(
    "CER pipeline name for `pipeline_throughput`. Defaults to NGTL when omitted.",
  );

// Map the friendly pipeline name to the substrate's CER endpoint key.
const PIPELINE_KEY: Record<(typeof PIPELINE_NAMES)[number], CEREndpointKey> = {
  NGTL: "NGTL_THROUGHPUT",
  "Trans-Mountain": "TRANS_MOUNTAIN_THROUGHPUT",
  Keystone: "KEYSTONE_THROUGHPUT",
  "Enbridge Mainline": "ENBRIDGE_MAINLINE_THROUGHPUT",
  Alliance: "ALLIANCE_THROUGHPUT",
  Foothills: "FOOTHILLS_THROUGHPUT",
};

const EnergyInputShape = {
  dataset: EnergyDatasetSchema,
  pipeline: PipelineSchema.optional(),
  province: z
    .string()
    .min(1)
    .max(64)
    .optional()
    .describe(
      "Optional province filter for `oil_production` (substrate default: Alberta). Case-insensitive substring match.",
    ),
  time_range: TimeRangeSchema.optional(),
  limit: LimitSchema.optional(),
};

// ---------------------------------------------------------------------------
// Time range helpers
// ---------------------------------------------------------------------------

function namedRangeToDays(name: string): number {
  switch (name) {
    case "last_30d":
      return 30;
    case "last_year":
      return 365;
    case "last_5y":
      return 1825;
    case "ytd": {
      const now = new Date();
      const startOfYear = Date.UTC(now.getUTCFullYear(), 0, 1);
      return Math.max(
        Math.floor((now.getTime() - startOfYear) / 86_400_000) + 1,
        1,
      );
    }
    default:
      return 30;
  }
}

function withinRange(date: string, range: TimeRange | undefined): boolean {
  if (!range || typeof range === "string") return true;
  if (!date) return true;
  if (range.from && date < range.from) return false;
  if (range.to && date > range.to) return false;
  return true;
}

interface AesoDateBounds {
  startDate?: string;
  endDate?: string;
}

function aesoBoundsForRange(range: TimeRange | undefined): AesoDateBounds {
  if (!range) {
    // Substrate's default of last 30 days is fine.
    const days = 30;
    const end = new Date();
    const start = new Date(end.getTime() - days * 86_400_000);
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    };
  }
  if (typeof range === "string") {
    const days = namedRangeToDays(range);
    const end = new Date();
    const start = new Date(end.getTime() - days * 86_400_000);
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    };
  }
  return { startDate: range.from, endDate: range.to };
}

function poolSeriesDaysForRange(range: TimeRange | undefined): number {
  if (!range) return 30;
  if (typeof range === "string") return namedRangeToDays(range);
  // Explicit range: compute span in days, capped sensibly.
  if (range.from && range.to) {
    const fromMs = Date.parse(range.from);
    const toMs = Date.parse(range.to);
    if (Number.isFinite(fromMs) && Number.isFinite(toMs) && toMs > fromMs) {
      return Math.min(
        Math.max(Math.ceil((toMs - fromMs) / 86_400_000), 1),
        3650,
      );
    }
  }
  return 30;
}

// ---------------------------------------------------------------------------
// Row schemas (pass-through from the substrate)
// ---------------------------------------------------------------------------

const PoolPricePointSchema = z.object({
  date: z.string(),
  hour: z.number(),
  price: z.number(),
  rollingAvg30: z.number(),
});

const TimeSeriesPointSchema = z.object({
  date: z.string(),
  value: z.number(),
  label: z.string().optional(),
});

const SupplyDemandReportSchema = z.object({
  totalGeneration: z.number(),
  totalLoad: z.number(),
  netExports: z.number(),
  generationByFuel: z.array(
    z.object({
      fuel: z.string(),
      generation: z.number(),
      capacity: z.number(),
    }),
  ),
});

const SystemMarginalPricePointSchema = z.object({
  date: z.string(),
  hour: z.number(),
  price: z.number(),
});

const ActualForecastPointSchema = z.object({
  date: z.string(),
  hour: z.number(),
  forecast: z.number(),
  actual: z.number(),
});

const PipelineThroughputPointSchema = z.object({
  date: z.string(),
  pipeline: z.string(),
  keyPoint: z.string(),
  product: z.string(),
  throughput: z.number(),
  capacity: z.number(),
  utilization: z.number(),
  unit: z.string(),
});

const PipelineIncidentSchema = z.object({
  incidentNumber: z.string(),
  date: z.string(),
  pipeline: z.string(),
  company: z.string(),
  province: z.string(),
  nearestPopulatedCentre: z.string(),
  substance: z.string(),
  significantIncident: z.boolean(),
  releaseType: z.string(),
  status: z.string(),
  whatHappened: z.string(),
  whyItHappened: z.string(),
  volumeReleased: z.number(),
  volumeRecovered: z.number(),
  unit: z.string(),
});

const ApportionmentPointSchema = z.object({
  date: z.string(),
  pipeline: z.string(),
  originalNominations: z.number(),
  acceptedNominations: z.number(),
  apportionmentPercent: z.number(),
});

const ProductionPointSchema = z.object({
  date: z.string(),
  province: z.string(),
  product: z.string(),
  volume: z.number(),
  unit: z.string(),
});

// ── Payload union per dataset ────────────────────────────────────────────

const PoolPriceCurrentPayloadSchema = z.object({
  dataset: z.literal("pool_price_current"),
  rows: z.array(PoolPricePointSchema),
});

const PoolPriceSeriesPayloadSchema = z.object({
  dataset: z.literal("pool_price_series"),
  rows: z.array(TimeSeriesPointSchema),
});

const SupplyDemandPayloadSchema = z.object({
  dataset: z.literal("supply_demand"),
  snapshot: SupplyDemandReportSchema.nullable(),
});

const SystemMarginalPricePayloadSchema = z.object({
  dataset: z.literal("system_marginal_price"),
  rows: z.array(SystemMarginalPricePointSchema),
});

const ForecastPayloadSchema = z.object({
  dataset: z.literal("forecast"),
  rows: z.array(ActualForecastPointSchema),
});

const PipelineThroughputPayloadSchema = z.object({
  dataset: z.literal("pipeline_throughput"),
  pipeline: PipelineSchema,
  rows: z.array(PipelineThroughputPointSchema),
});

const PipelineIncidentsPayloadSchema = z.object({
  dataset: z.literal("pipeline_incidents"),
  rows: z.array(PipelineIncidentSchema),
});

const ApportionmentPayloadSchema = z.object({
  dataset: z.literal("apportionment"),
  rows: z.array(ApportionmentPointSchema),
});

const OilProductionPayloadSchema = z.object({
  dataset: z.literal("oil_production"),
  province: z.string(),
  rows: z.array(ProductionPointSchema),
});

const WellLicenceRecordSchema = z.object({
  licenceNumber: z.string(),
  wellName: z.string(),
  licensee: z.string(),
  substance: z.string(),
  classification: z.string(),
  surfaceLocation: z.string(),
  filingDate: z.string(),
});

const WellLicenceDailyPointSchema = z.object({
  date: z.string(),
  totalCount: z.number(),
  bySubstance: z.record(z.string(), z.number()),
  byClassification: z.record(z.string(), z.number()),
  byLicensee: z.record(z.string(), z.number()),
});

const WellOperatorSchema = z.object({
  name: z.string(),
  slug: z.string(),
  firstSeen: z.string().nullable(),
  lastSeen: z.string().nullable(),
  licenceCount: z.number(),
});

const WellLicencesPayloadSchema = z.object({
  dataset: z.literal("well_licences"),
  rows: z.array(WellLicenceRecordSchema),
});

const WellLicencesDailyPayloadSchema = z.object({
  dataset: z.literal("well_licences_daily"),
  rows: z.array(WellLicenceDailyPointSchema),
});

const WellOperatorsPayloadSchema = z.object({
  dataset: z.literal("well_operators"),
  rows: z.array(WellOperatorSchema),
});

const EnergyPayloadSchema = z.union([
  PoolPriceCurrentPayloadSchema,
  PoolPriceSeriesPayloadSchema,
  SupplyDemandPayloadSchema,
  SystemMarginalPricePayloadSchema,
  ForecastPayloadSchema,
  PipelineThroughputPayloadSchema,
  PipelineIncidentsPayloadSchema,
  ApportionmentPayloadSchema,
  OilProductionPayloadSchema,
  WellLicencesPayloadSchema,
  WellLicencesDailyPayloadSchema,
  WellOperatorsPayloadSchema,
]);

const EnergyDataSchema = z.object({
  dataset: EnergyDatasetSchema,
  source: z.string(),
  unit: z.string(),
  served_from: z.enum(["upstream", "fallback", "empty"]),
  notes: z.string().optional(),
  payload: EnergyPayloadSchema,
});

const EnergyEnvelopeSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  tool: z.literal("tamrack_energy"),
  source: z.string(),
  data: EnergyDataSchema,
});
type EnergyEnvelope = z.infer<typeof EnergyEnvelopeSchema>;

// ---------------------------------------------------------------------------
// Per-dataset metadata
// ---------------------------------------------------------------------------

interface DatasetMeta {
  source: string;
  envelopeSource: string;
  unit: string;
  respectsTimeRange: boolean;
}

const DATASET_META: Record<EnergyDataset, DatasetMeta> = {
  pool_price_current: {
    source: "AESO Pool Price Report (api.aeso.ca)",
    envelopeSource: "AESO",
    unit: "CAD per MWh",
    respectsTimeRange: true,
  },
  pool_price_series: {
    source: "AESO Pool Price Report — daily average",
    envelopeSource: "AESO",
    unit: "CAD per MWh",
    respectsTimeRange: true,
  },
  supply_demand: {
    source: "AESO Current Supply/Demand Summary",
    envelopeSource: "AESO",
    unit: "MW / mixed",
    respectsTimeRange: false,
  },
  system_marginal_price: {
    source: "AESO System Marginal Price Report",
    envelopeSource: "AESO",
    unit: "CAD per MWh",
    respectsTimeRange: true,
  },
  forecast: {
    source: "AESO Actual Forecast Report",
    envelopeSource: "AESO",
    unit: "CAD per MWh / MW",
    respectsTimeRange: true,
  },
  pipeline_throughput: {
    source: "CER Open Data — throughput-and-capacity CSV",
    envelopeSource: "CER Open Data",
    unit: "1000 b/d or Mm³/d (see row.unit)",
    respectsTimeRange: true,
  },
  pipeline_incidents: {
    source: "CER Open Data — pipeline-incidents-data.csv",
    envelopeSource: "CER Open Data",
    unit: "incidents (volume m³ where reported)",
    respectsTimeRange: true,
  },
  apportionment: {
    source: "CER Open Data — apportionment.csv",
    envelopeSource: "CER Open Data",
    unit: "percent / nominations count",
    respectsTimeRange: true,
  },
  oil_production: {
    source: "CER Open Data — estimated monthly production of crude oil by province",
    envelopeSource: "CER Open Data",
    unit: "thousand barrels per day",
    respectsTimeRange: true,
  },
  well_licences: {
    source: "AER Well Licences (static.aer.ca daily list, accumulated)",
    envelopeSource: "AER",
    unit: "licences",
    respectsTimeRange: true,
  },
  well_licences_daily: {
    source: "AER Well Licences — daily filing totals (accumulated)",
    envelopeSource: "AER",
    unit: "new licences per day",
    respectsTimeRange: true,
  },
  well_operators: {
    source: "AER Well Licences — operator roster (substrate entity directory)",
    envelopeSource: "AER",
    unit: "operators",
    respectsTimeRange: false,
  },
};

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

const TOOL_NAME = "tamrack_energy";

const TOOL_DESCRIPTION =
  "Alberta + Canada energy data. AESO (Alberta Electric System Operator): " +
  "hourly pool price (current and daily-avg series), supply/demand snapshot, " +
  "system marginal price, load forecast vs actual. Requires AESO_API_KEY " +
  "server-side. CER (Canada Energy Regulator) open CSV: per-pipeline " +
  "throughput + capacity + utilization for NGTL, Trans-Mountain, Keystone, " +
  "Enbridge Mainline, Alliance, Foothills; pipeline incidents; pipeline " +
  "apportionment; monthly crude oil production by province (Alberta default). " +
  "AER (Alberta Energy Regulator) well licences from Postgres: individual " +
  "licence records (well_licences), daily filing totals with substance/ " +
  "classification/licensee breakdowns (well_licences_daily), and the current " +
  "well-operator roster with per-operator licence counts (well_operators). " +
  "Each dataset returns its native row shape; agents branch on the echoed " +
  "`dataset` field. Time ranges are honoured on every series dataset and " +
  "noted-as-ignored on `supply_demand` and `well_operators` (non-series).";

updateToolEntry(TOOL_NAME, {
  status: "live",
  parameters_summary:
    "dataset (enum: pool_price_current, pool_price_series, supply_demand, system_marginal_price, forecast, pipeline_throughput, pipeline_incidents, apportionment, oil_production, well_licences, well_licences_daily, well_operators); optional pipeline (NGTL|Trans-Mountain|Keystone|Enbridge Mainline|Alliance|Foothills, used by pipeline_throughput, defaults NGTL); optional province (oil_production, default Alberta); optional time_range; optional limit.",
  response_summary:
    "Envelope with schema_version, tool, source (AESO, CER Open Data, or AER); data.{dataset, source, unit, served_from, payload}. Payload is a discriminated union keyed by `dataset`; each variant carries the native substrate row shape (rows[] or `snapshot` for supply_demand).",
  indicators: [...ENERGY_DATASETS],
  example_invocations: [
    {
      description:
        "AESO pool price over the last 30 days (hourly rows).",
      arguments: { dataset: "pool_price_current", time_range: "last_30d" },
    },
    {
      description:
        "NGTL pipeline throughput and utilization (CER monthly CSV).",
      arguments: { dataset: "pipeline_throughput", pipeline: "NGTL" },
    },
    {
      description: "Alberta crude oil production (CER monthly).",
      arguments: { dataset: "oil_production" },
    },
    {
      description: "AER well licence daily filing totals over the last year.",
      arguments: { dataset: "well_licences_daily", time_range: "last_year" },
    },
    {
      description: "Top 20 well operators by total licences issued.",
      arguments: { dataset: "well_operators", limit: 20 },
    },
  ],
});

export function registerEnergyTool(server: McpServer): void {
  server.registerTool(
    TOOL_NAME,
    {
      title: "Tamrack — Energy (AESO + CER)",
      description: TOOL_DESCRIPTION,
      inputSchema: EnergyInputShape,
      annotations: {
        title: "Tamrack — Energy (AESO + CER)",
        readOnlyHint: true,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    async (args) => {
      requireScopes(REQUIRED_SCOPES);
      const dataset = args.dataset;
      const meta = DATASET_META[dataset];
      const timeRange = args.time_range;
      const limit = args.limit;

      let payload: z.infer<typeof EnergyPayloadSchema>;
      let servedFrom: "upstream" | "fallback" | "empty" = "empty";
      const notesParts: string[] = [];

      try {
        switch (dataset) {
          case "pool_price_current": {
            const bounds = aesoBoundsForRange(timeRange);
            const rows: PoolPricePoint[] = await fetchPoolPrice(
              bounds.startDate,
              bounds.endDate,
            );
            const capped = limit != null ? rows.slice(-limit) : rows;
            servedFrom = capped.length > 0 ? "upstream" : "empty";
            payload = { dataset: "pool_price_current", rows: capped };
            break;
          }
          case "pool_price_series": {
            const days = poolSeriesDaysForRange(timeRange);
            const rows: AesoTimeSeriesPoint[] =
              await fetchPoolPriceTimeSeries(days);
            const filtered = rows.filter((r) =>
              withinRange(r.date, timeRange),
            );
            const capped = limit != null ? filtered.slice(-limit) : filtered;
            servedFrom = capped.length > 0 ? "upstream" : "empty";
            payload = { dataset: "pool_price_series", rows: capped };
            break;
          }
          case "supply_demand": {
            const snap: SupplyDemandReport | null =
              await fetchCurrentSupplyDemand();
            servedFrom = snap != null ? "upstream" : "empty";
            payload = { dataset: "supply_demand", snapshot: snap };
            break;
          }
          case "system_marginal_price": {
            const bounds = aesoBoundsForRange(timeRange);
            const rows: SystemMarginalPricePoint[] =
              await fetchSystemMarginalPrice(bounds.startDate, bounds.endDate);
            const capped = limit != null ? rows.slice(-limit) : rows;
            servedFrom = capped.length > 0 ? "upstream" : "empty";
            payload = { dataset: "system_marginal_price", rows: capped };
            break;
          }
          case "forecast": {
            const bounds = aesoBoundsForRange(timeRange);
            const rows: ActualForecastPoint[] = await fetchActualForecast(
              bounds.startDate,
            );
            const capped = limit != null ? rows.slice(-limit) : rows;
            servedFrom = capped.length > 0 ? "upstream" : "empty";
            payload = { dataset: "forecast", rows: capped };
            break;
          }
          case "pipeline_throughput": {
            const pipelineName = args.pipeline ?? "NGTL";
            const key = PIPELINE_KEY[pipelineName];
            // Defensive: PIPELINE_KEY covers every PIPELINE_NAMES entry, but
            // we still guard so an enum drift is surfaced as a clean note.
            if (!key || !CER_ENDPOINTS[key]) {
              notesParts.push(`unknown pipeline "${pipelineName}"`);
              payload = {
                dataset: "pipeline_throughput",
                pipeline: pipelineName,
                rows: [],
              };
              servedFrom = "empty";
              break;
            }
            const rows: PipelineThroughputPoint[] =
              await fetchPipelineThroughput(key);
            const filtered = rows.filter((r) =>
              withinRange(r.date, timeRange),
            );
            const capped = limit != null ? filtered.slice(-limit) : filtered;
            servedFrom = capped.length > 0 ? "upstream" : "empty";
            payload = {
              dataset: "pipeline_throughput",
              pipeline: pipelineName,
              rows: capped,
            };
            break;
          }
          case "pipeline_incidents": {
            const rows: PipelineIncident[] = await fetchPipelineIncidents();
            const filtered = rows.filter((r) =>
              withinRange(r.date, timeRange),
            );
            const capped = limit != null ? filtered.slice(-limit) : filtered;
            servedFrom = capped.length > 0 ? "upstream" : "empty";
            payload = { dataset: "pipeline_incidents", rows: capped };
            break;
          }
          case "apportionment": {
            const rows: ApportionmentPoint[] = await fetchApportionment();
            const filtered = rows.filter((r) =>
              withinRange(r.date, timeRange),
            );
            const capped = limit != null ? filtered.slice(-limit) : filtered;
            servedFrom = capped.length > 0 ? "upstream" : "empty";
            payload = { dataset: "apportionment", rows: capped };
            break;
          }
          case "oil_production": {
            const provinceArg = args.province ?? "Alberta";
            const rows: ProductionPoint[] =
              await fetchCrudeOilProduction(provinceArg);
            const filtered = rows.filter((r) =>
              withinRange(r.date, timeRange),
            );
            const capped = limit != null ? filtered.slice(-limit) : filtered;
            servedFrom = capped.length > 0 ? "upstream" : "empty";
            payload = {
              dataset: "oil_production",
              province: provinceArg,
              rows: capped,
            };
            break;
          }
          case "well_licences": {
            // Translate time_range to a filing_date window when provided.
            let range: { from?: string; to?: string } | undefined;
            if (timeRange != null) {
              if (typeof timeRange === "string") {
                const days = namedRangeToDays(timeRange);
                const from = new Date(Date.now() - days * 86_400_000)
                  .toISOString()
                  .slice(0, 10);
                range = { from };
              } else {
                range = { from: timeRange.from, to: timeRange.to };
              }
            }
            const rows: WellLicenceRecord[] = await fetchWellLicenceRecords(
              limit ?? 100,
              range,
            );
            servedFrom = rows.length > 0 ? "upstream" : "empty";
            payload = { dataset: "well_licences", rows };
            break;
          }
          case "well_licences_daily": {
            // Translate time_range to a days window.
            const days = poolSeriesDaysForRange(timeRange);
            const rows: WellLicenceDailyPoint[] = await fetchWellLicenceDaily(days);
            const capped = limit != null ? rows.slice(-limit) : rows;
            servedFrom = capped.length > 0 ? "upstream" : "empty";
            payload = { dataset: "well_licences_daily", rows: capped };
            break;
          }
          case "well_operators": {
            const rows: WellOperator[] = await fetchWellOperators(limit ?? 100);
            servedFrom = rows.length > 0 ? "upstream" : "empty";
            payload = { dataset: "well_operators", rows };
            break;
          }
        }
      } catch (err) {
        console.warn(
          `[mcp:${TOOL_NAME}] unexpected throw for ${dataset}:`,
          err,
        );
        servedFrom = "empty";
        notesParts.push(
          `substrate fetcher threw for ${dataset}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        payload = emptyPayloadFor(dataset, args.pipeline ?? "NGTL");
      }

      if (timeRange != null && !meta.respectsTimeRange) {
        notesParts.push(
          `time_range is silently ignored for dataset "${dataset}" (substrate returns a real-time snapshot, not a time series)`,
        );
      }

      const envelope: EnergyEnvelope = {
        schema_version: SCHEMA_VERSION,
        tool: TOOL_NAME,
        source: meta.envelopeSource,
        data: {
          dataset,
          source: meta.source,
          unit: meta.unit,
          served_from: servedFrom,
          notes: notesParts.length > 0 ? notesParts.join("; ") : undefined,
          payload,
        },
      };

      const parsed = EnergyEnvelopeSchema.parse(envelope);

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(parsed, null, 2) },
        ],
        structuredContent: parsed as unknown as Record<string, unknown>,
      };
    },
  );
}

function emptyPayloadFor(
  dataset: EnergyDataset,
  pipeline: (typeof PIPELINE_NAMES)[number],
): z.infer<typeof EnergyPayloadSchema> {
  switch (dataset) {
    case "pool_price_current":
      return { dataset: "pool_price_current", rows: [] };
    case "pool_price_series":
      return { dataset: "pool_price_series", rows: [] };
    case "supply_demand":
      return { dataset: "supply_demand", snapshot: null };
    case "system_marginal_price":
      return { dataset: "system_marginal_price", rows: [] };
    case "forecast":
      return { dataset: "forecast", rows: [] };
    case "pipeline_throughput":
      return { dataset: "pipeline_throughput", pipeline, rows: [] };
    case "pipeline_incidents":
      return { dataset: "pipeline_incidents", rows: [] };
    case "apportionment":
      return { dataset: "apportionment", rows: [] };
    case "oil_production":
      return { dataset: "oil_production", province: "Alberta", rows: [] };
    case "well_licences":
      return { dataset: "well_licences", rows: [] };
    case "well_licences_daily":
      return { dataset: "well_licences_daily", rows: [] };
    case "well_operators":
      return { dataset: "well_operators", rows: [] };
  }
}
