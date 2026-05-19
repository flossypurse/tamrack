/**
 * `tamrack_housing` tool registration.
 *
 * Wraps the CMHC / StatsCan housing fetchers in
 * `src/lib/data-sources-cmhc.ts` behind a single typed MCP surface. All of
 * the substrate functions back into StatCan WDS tables (CMHC sources its
 * Housing Market Information via these StatCan series), with the
 * conventional 5-year mortgage rate coming from table 34-10-0145. The
 * tool keeps each dataset's native row shape intact rather than coercing
 * to a lossy common form — datasets that already merge Edmonton + Calgary
 * CMAs stay merged, multi-bedroom rent rows stay wide, the absorptions
 * dataset returns absorbed + unabsorbed series side by side.
 *
 * Datasets (8):
 *   - starts             → CMHC housing starts (Edmonton + Calgary CMA merged)
 *   - completions        → CMHC completions (Edmonton + Calgary CMA merged)
 *   - under_construction → CMHC under-construction (Edmonton + Calgary CMA merged)
 *   - snapshot           → starts + completions + under-construction for ONE CMA
 *   - vacancy            → CMHC rental vacancy (Edmonton + Calgary CMA merged)
 *   - rents              → CMHC average rents wide by unit type (Edmonton + Calgary)
 *   - absorptions        → Alberta absorbed + unabsorbed inventory
 *   - mortgage_rate      → Conventional 5y posted mortgage rate (national)
 *
 * Municipality parameter:
 *   The substrate only knows about Edmonton and Calgary CMAs at this
 *   surface. For `dataset=snapshot` we REQUIRE a municipality, mapping
 *   "edmonton" → "Edmonton" CMA and "calgary" → "Calgary" CMA. For every
 *   other dataset the municipality slug is silently ignored — the
 *   substrate's CMA-merged shape already carries both cities. This
 *   matches the substrate's surface; expanding to per-municipality
 *   filtering would require extending `src/lib/data-sources-cmhc.ts`,
 *   which is out of scope.
 *
 * Time range:
 *   Substrate fetchers accept a `latestN` periods count. We translate the
 *   `time_range` to a periods request and filter explicit `{from, to}`
 *   windows post-fetch, same convention as `tamrack_macro` (D12).
 *
 * Fallback policy:
 *   The substrate fetchers all swallow upstream errors and return [];
 *   there is no `data-fallback.ts` entry for housing. So we degrade to
 *   `served_from: "empty"` when the substrate hands back zero rows and
 *   tag it as `served_from: "upstream"` when it returns anything.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  fetchAbsorptions,
  fetchHousingCompletions,
  fetchHousingSnapshot,
  fetchHousingStarts,
  fetchMortgageRate,
  fetchRentComparison,
  fetchUnderConstruction,
  fetchVacancyRates,
  type CMASeriesPoint,
  type HousingSnapshot,
  type RentComparisonPoint,
} from "@/lib/data-sources-cmhc";
import type { TimeSeriesPoint } from "@/lib/data-sources";

import {
  LimitSchema,
  MunicipalitySlugSchema,
  SCHEMA_VERSION,
  TimeRangeSchema,
  type TimeRange,
} from "../schemas";
import { updateToolEntry } from "../registry";
import { requireScopes } from "../lib/auth-context";

const REQUIRED_SCOPES = ["tamrack:real-estate:read"] as const;

// ---------------------------------------------------------------------------
// Dataset enum + helpers
// ---------------------------------------------------------------------------

const HOUSING_DATASETS = [
  "starts",
  "completions",
  "under_construction",
  "snapshot",
  "vacancy",
  "rents",
  "absorptions",
  "mortgage_rate",
] as const;

type HousingDataset = (typeof HOUSING_DATASETS)[number];

const HousingDatasetSchema = z
  .enum(HOUSING_DATASETS)
  .describe(
    "CMHC / StatsCan housing dataset. 'starts'/'completions'/'under_construction'/'vacancy'/'rents' return Edmonton+Calgary CMAs merged. 'snapshot' returns a single CMA (requires municipality=edmonton|calgary). 'absorptions' is Alberta-level. 'mortgage_rate' is the national conventional 5y posted rate.",
  );

const HousingInputShape = {
  dataset: HousingDatasetSchema,
  municipality: MunicipalitySlugSchema.optional(),
  time_range: TimeRangeSchema.optional(),
  limit: LimitSchema.optional(),
};

// Per-dataset default periods. CMHC series are mostly monthly so 60
// covers ~5y; mortgage_rate is weekly-ish so we ask for more rows.
const DATASET_DEFAULT_PERIODS: Record<HousingDataset, number> = {
  starts: 60,
  completions: 60,
  under_construction: 60,
  snapshot: 60,
  vacancy: 20, // annual
  rents: 20, // annual
  absorptions: 40, // monthly
  mortgage_rate: 60,
};

function periodsForRange(
  range: TimeRange | undefined,
  defaultPeriods: number,
): number {
  if (!range) return defaultPeriods;
  if (typeof range === "string") {
    switch (range) {
      case "last_30d":
        return Math.max(30, defaultPeriods);
      case "last_year":
        return Math.max(12, defaultPeriods);
      case "last_5y":
        return Math.max(60, defaultPeriods);
      case "ytd": {
        const now = new Date();
        const startOfYear = Date.UTC(now.getUTCFullYear(), 0, 1);
        const months = Math.floor(
          (now.getTime() - startOfYear) / (30 * 86_400_000),
        ) + 1;
        return Math.max(months, defaultPeriods);
      }
    }
  }
  // Explicit { from, to }: ask for a wide enough window and filter
  // post-fetch (same convention as tamrack_macro D12).
  return Math.max(60, defaultPeriods);
}

function withinRange(date: string, range: TimeRange | undefined): boolean {
  if (!range || typeof range === "string") return true;
  if (!date) return true;
  if (range.from && date < range.from) return false;
  if (range.to && date > range.to) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Row schemas (pass-through from the substrate)
// ---------------------------------------------------------------------------

const TimeSeriesPointSchema = z.object({
  date: z.string(),
  value: z.number(),
  label: z.string().optional(),
});

const CMASeriesPointSchema = z.object({
  date: z.string(),
  edmonton: z.number(),
  calgary: z.number(),
});

const RentComparisonPointSchema = z.object({
  date: z.string(),
  edmontonBachelor: z.number(),
  edmontonOneBed: z.number(),
  edmontonTwoBed: z.number(),
  edmontonThreeBed: z.number(),
  calgaryBachelor: z.number(),
  calgaryOneBed: z.number(),
  calgaryTwoBed: z.number(),
  calgaryThreeBed: z.number(),
});

const HousingSnapshotSchema = z.object({
  cma: z.enum(["Edmonton", "Calgary"]),
  starts: z.array(TimeSeriesPointSchema),
  completions: z.array(TimeSeriesPointSchema),
  underConstruction: z.array(TimeSeriesPointSchema),
});

const AbsorptionsSchema = z.object({
  absorbed: z.array(TimeSeriesPointSchema),
  unabsorbed: z.array(TimeSeriesPointSchema),
});

// ── Payload union per dataset ────────────────────────────────────────────

const CMASeriesPayloadSchema = z.object({
  dataset: z.enum(["starts", "completions", "under_construction", "vacancy"]),
  rows: z.array(CMASeriesPointSchema),
});

const RentsPayloadSchema = z.object({
  dataset: z.literal("rents"),
  rows: z.array(RentComparisonPointSchema),
});

const SnapshotPayloadSchema = z.object({
  dataset: z.literal("snapshot"),
  snapshot: HousingSnapshotSchema,
});

const AbsorptionsPayloadSchema = z.object({
  dataset: z.literal("absorptions"),
  absorptions: AbsorptionsSchema,
});

const TimeSeriesPayloadSchema = z.object({
  dataset: z.literal("mortgage_rate"),
  rows: z.array(TimeSeriesPointSchema),
});

const HousingPayloadSchema = z.union([
  CMASeriesPayloadSchema,
  RentsPayloadSchema,
  SnapshotPayloadSchema,
  AbsorptionsPayloadSchema,
  TimeSeriesPayloadSchema,
]);

const HousingDataSchema = z.object({
  dataset: HousingDatasetSchema,
  source: z.string(),
  unit: z.string(),
  served_from: z.enum(["upstream", "fallback", "empty"]),
  notes: z.string().optional(),
  payload: HousingPayloadSchema,
});

const HousingEnvelopeSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  tool: z.literal("tamrack_housing"),
  source: z.literal("CMHC via StatsCan"),
  data: HousingDataSchema,
});
type HousingEnvelope = z.infer<typeof HousingEnvelopeSchema>;

// ---------------------------------------------------------------------------
// Per-dataset metadata
// ---------------------------------------------------------------------------

interface DatasetMeta {
  source: string;
  unit: string;
}

const DATASET_META: Record<HousingDataset, DatasetMeta> = {
  starts: {
    source: "CMHC via StatsCan WDS (Table 34-10-0154)",
    unit: "dwelling units",
  },
  completions: {
    source: "CMHC via StatsCan WDS (Table 34-10-0155)",
    unit: "dwelling units",
  },
  under_construction: {
    source: "CMHC via StatsCan WDS (Table 34-10-0156)",
    unit: "dwelling units",
  },
  snapshot: {
    source: "CMHC via StatsCan WDS (starts/completions/under-construction)",
    unit: "dwelling units",
  },
  vacancy: {
    source: "CMHC via StatsCan WDS (Table 34-10-0127)",
    unit: "percent",
  },
  rents: {
    source: "CMHC via StatsCan WDS (Table 34-10-0133)",
    unit: "CAD per month",
  },
  absorptions: {
    source: "CMHC via StatsCan WDS (Table 34-10-0153)",
    unit: "dwelling units",
  },
  mortgage_rate: {
    source: "CMHC via StatsCan WDS (Table 34-10-0145)",
    unit: "percent",
  },
};

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

const TOOL_NAME = "tamrack_housing";

const TOOL_DESCRIPTION =
  "CMHC Housing Market Information for Alberta — starts, completions, " +
  "under-construction, vacancy rates, average rents by unit type, " +
  "absorptions, and the national conventional 5-year posted mortgage rate. " +
  "Sourced from CMHC via Statistics Canada WDS. Time-series rows by month " +
  "(starts/completions/UC/absorptions/mortgage) or year (vacancy/rents). " +
  "Edmonton and Calgary CMAs are returned together except for 'snapshot', " +
  "which requires municipality=edmonton|calgary and returns one CMA's " +
  "starts+completions+UC together. The municipality parameter is silently " +
  "ignored for every dataset except 'snapshot'.";

updateToolEntry(TOOL_NAME, {
  status: "live",
  parameters_summary:
    "dataset (enum: starts, completions, under_construction, snapshot, vacancy, rents, absorptions, mortgage_rate); optional municipality (only used by 'snapshot' — edmonton|calgary; silently ignored elsewhere); optional time_range (named bucket or {from,to}); optional limit (1..1000).",
  response_summary:
    "Envelope with schema_version, tool, source='CMHC via StatsCan'; data.{dataset, source, unit, served_from, payload}. Payload shape depends on dataset: starts/completions/under_construction/vacancy → {rows: [{date, edmonton, calgary}]}; rents → {rows: [{date, edmontonBachelor, edmontonOneBed, ..., calgaryThreeBed}]}; snapshot → {snapshot: {cma, starts[], completions[], underConstruction[]}}; absorptions → {absorptions: {absorbed[], unabsorbed[]}}; mortgage_rate → {rows: [{date, value}]}.",
  indicators: [...HOUSING_DATASETS],
  example_invocations: [
    {
      description:
        "Edmonton + Calgary CMA housing starts over the last 5 years (monthly).",
      arguments: { dataset: "starts", time_range: "last_5y" },
    },
    {
      description:
        "Edmonton CMA snapshot — starts, completions, and under-construction together.",
      arguments: { dataset: "snapshot", municipality: "edmonton" },
    },
    {
      description:
        "National conventional 5-year posted mortgage rate (StatsCan).",
      arguments: { dataset: "mortgage_rate", time_range: "last_year" },
    },
  ],
});

export function registerHousingTool(server: McpServer): void {
  server.registerTool(
    TOOL_NAME,
    {
      title: "Tamrack — CMHC Housing",
      description: TOOL_DESCRIPTION,
      inputSchema: HousingInputShape,
      annotations: {
        title: "Tamrack — CMHC Housing",
        readOnlyHint: true,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    async (args) => {
      requireScopes(REQUIRED_SCOPES);
      const dataset = args.dataset;
      const municipality = args.municipality;
      const timeRange = args.time_range;
      const periods = periodsForRange(
        timeRange,
        DATASET_DEFAULT_PERIODS[dataset],
      );
      const limit = args.limit;
      const meta = DATASET_META[dataset];

      let payload: z.infer<typeof HousingPayloadSchema>;
      let servedFrom: "upstream" | "fallback" | "empty" = "empty";
      let notes: string | undefined;

      try {
        switch (dataset) {
          case "starts": {
            const rows: CMASeriesPoint[] = await fetchHousingStarts(periods);
            const filtered = rows.filter((r) => withinRange(r.date, timeRange));
            const capped = limit != null ? filtered.slice(-limit) : filtered;
            servedFrom = capped.length > 0 ? "upstream" : "empty";
            payload = { dataset: "starts", rows: capped };
            break;
          }
          case "completions": {
            const rows: CMASeriesPoint[] =
              await fetchHousingCompletions(periods);
            const filtered = rows.filter((r) => withinRange(r.date, timeRange));
            const capped = limit != null ? filtered.slice(-limit) : filtered;
            servedFrom = capped.length > 0 ? "upstream" : "empty";
            payload = { dataset: "completions", rows: capped };
            break;
          }
          case "under_construction": {
            const rows: CMASeriesPoint[] =
              await fetchUnderConstruction(periods);
            const filtered = rows.filter((r) => withinRange(r.date, timeRange));
            const capped = limit != null ? filtered.slice(-limit) : filtered;
            servedFrom = capped.length > 0 ? "upstream" : "empty";
            payload = { dataset: "under_construction", rows: capped };
            break;
          }
          case "vacancy": {
            const rows: CMASeriesPoint[] = await fetchVacancyRates(periods);
            const filtered = rows.filter((r) => withinRange(r.date, timeRange));
            const capped = limit != null ? filtered.slice(-limit) : filtered;
            servedFrom = capped.length > 0 ? "upstream" : "empty";
            payload = { dataset: "vacancy", rows: capped };
            break;
          }
          case "rents": {
            const rows: RentComparisonPoint[] =
              await fetchRentComparison(periods);
            const filtered = rows.filter((r) => withinRange(r.date, timeRange));
            const capped = limit != null ? filtered.slice(-limit) : filtered;
            servedFrom = capped.length > 0 ? "upstream" : "empty";
            payload = { dataset: "rents", rows: capped };
            break;
          }
          case "snapshot": {
            // Snapshot requires a CMA. Default to Edmonton if none was given
            // — the brief said it's fine to silently ignore the param for
            // other datasets, so for consistency we default rather than
            // error here.
            const cma: "Edmonton" | "Calgary" =
              municipality === "calgary" ? "Calgary" : "Edmonton";
            const snap: HousingSnapshot = await fetchHousingSnapshot(
              cma,
              periods,
            );
            const filterSeries = (s: TimeSeriesPoint[]): TimeSeriesPoint[] =>
              s.filter((p) => withinRange(p.date, timeRange));
            const filtered: HousingSnapshot = {
              cma: snap.cma,
              starts: filterSeries(snap.starts),
              completions: filterSeries(snap.completions),
              underConstruction: filterSeries(snap.underConstruction),
            };
            const anyRows =
              filtered.starts.length +
                filtered.completions.length +
                filtered.underConstruction.length >
              0;
            servedFrom = anyRows ? "upstream" : "empty";
            payload = { dataset: "snapshot", snapshot: filtered };
            if (municipality && municipality !== "edmonton" && municipality !== "calgary") {
              notes = `municipality "${municipality}" not a known CMA; defaulted to Edmonton`;
            }
            break;
          }
          case "absorptions": {
            const { absorbed, unabsorbed } = await fetchAbsorptions(periods);
            const filterSeries = (s: TimeSeriesPoint[]): TimeSeriesPoint[] =>
              s.filter((p) => withinRange(p.date, timeRange));
            const fAbs = filterSeries(absorbed);
            const fUnabs = filterSeries(unabsorbed);
            servedFrom = fAbs.length + fUnabs.length > 0 ? "upstream" : "empty";
            payload = {
              dataset: "absorptions",
              absorptions: { absorbed: fAbs, unabsorbed: fUnabs },
            };
            break;
          }
          case "mortgage_rate": {
            const rows: TimeSeriesPoint[] = await fetchMortgageRate(periods);
            const filtered = rows.filter((r) => withinRange(r.date, timeRange));
            const capped = limit != null ? filtered.slice(-limit) : filtered;
            servedFrom = capped.length > 0 ? "upstream" : "empty";
            payload = { dataset: "mortgage_rate", rows: capped };
            break;
          }
        }
      } catch (err) {
        // Substrate fetchers swallow their own errors and return [], so
        // reaching here means something further upstream threw. Degrade
        // to an empty envelope of the right dataset shape rather than
        // letting the SDK convert this into a JSON-RPC error.
        console.warn(
          `[mcp:${TOOL_NAME}] unexpected throw for ${dataset}:`,
          err,
        );
        servedFrom = "empty";
        notes = `substrate fetcher threw for ${dataset}: ${
          err instanceof Error ? err.message : String(err)
        }`;
        payload = emptyPayloadFor(dataset);
      }

      // Silent-ignore note for non-snapshot datasets that received a
      // municipality. Useful for the agent to know why their input was
      // dropped.
      if (
        municipality != null &&
        dataset !== "snapshot" &&
        notes == null
      ) {
        notes = `municipality parameter is silently ignored for dataset "${dataset}" (substrate only exposes Edmonton + Calgary CMAs merged)`;
      }

      const envelope: HousingEnvelope = {
        schema_version: SCHEMA_VERSION,
        tool: TOOL_NAME,
        source: "CMHC via StatsCan",
        data: {
          dataset,
          source: meta.source,
          unit: meta.unit,
          served_from: servedFrom,
          notes,
          payload,
        },
      };

      const parsed = HousingEnvelopeSchema.parse(envelope);

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
  dataset: HousingDataset,
): z.infer<typeof HousingPayloadSchema> {
  switch (dataset) {
    case "starts":
    case "completions":
    case "under_construction":
    case "vacancy":
      return { dataset, rows: [] };
    case "rents":
      return { dataset: "rents", rows: [] };
    case "snapshot":
      return {
        dataset: "snapshot",
        snapshot: {
          cma: "Edmonton",
          starts: [],
          completions: [],
          underConstruction: [],
        },
      };
    case "absorptions":
      return {
        dataset: "absorptions",
        absorptions: { absorbed: [], unabsorbed: [] },
      };
    case "mortgage_rate":
      return { dataset: "mortgage_rate", rows: [] };
  }
}
