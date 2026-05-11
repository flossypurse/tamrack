/**
 * `alberta_macro` tool registration.
 *
 * Wraps the macro fetchers in `src/lib/data-sources.ts` (Bank of Canada Valet
 * + Statistics Canada WDS + Alberta Open Data) behind a single typed MCP
 * surface. The HTTP `/api/macro` route remains the public REST entry point;
 * this tool is the agent-facing one. Same substrate, same upstream contract.
 *
 * Indicators (8):
 *   - policy_rate     → BoC POLICY_RATE          (V39079)            daily
 *   - cad_usd         → BoC CAD_USD              (FXCADUSD)          daily
 *   - mortgage_5y     → BoC MORTGAGE_5Y_FIXED    (V80691335)         weekly-ish
 *   - unemployment    → StatsCan AB_UNEMPLOYMENT_RATE  (14-10-0287)  monthly
 *   - cpi             → StatsCan AB_CPI                (18-10-0004)  monthly
 *   - gdp             → StatsCan AB_GDP                (36-10-0402)  annual
 *   - housing_starts  → StatsCan EDMONTON_HOUSING_STARTS (34-10-0154) monthly
 *   - aax             → Alberta Activity Index (open.alberta.ca xlsx) monthly
 *
 * Upstream + fallback policy:
 *   - First try the live fetcher with a periods count derived from
 *     `time_range`. If that returns 0 rows (upstream down, rate-limited,
 *     schema change, etc.), fall back to `fallbackMacroTimeSeries(indicator,
 *     limit)` which queries the `macro_metrics` table snapshotted by the
 *     collection worker.
 *   - Explicit `{from, to}` ranges are applied *after* fetch so we always
 *     fetch a stable LATEST-N window from upstream then filter — keeps the
 *     fetcher cache hot and avoids the StatsCan API's idiosyncratic
 *     date-range endpoints.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  BOC_SERIES,
  STATSCAN_SERIES,
  fetchAlbertaActivityIndex,
  fetchBoCTimeSeries,
  fetchStatCanTimeSeries,
  type TimeSeriesPoint,
} from "@/lib/data-sources";
import { fallbackMacroTimeSeries } from "@/lib/data-fallback";

import {
  SCHEMA_VERSION,
  TimeRangeSchema,
  type TimeRange,
} from "../schemas";
import { updateToolEntry, MACRO_INDICATORS } from "../registry";

// ---------------------------------------------------------------------------
// Indicator catalogue
// ---------------------------------------------------------------------------

type MacroFetcherKind = "boc" | "statscan" | "aax";

interface MacroIndicatorSpec {
  kind: MacroFetcherKind;
  /** BoC series id (for kind=boc). */
  bocSeries?: string;
  /** StatsCan table id (for kind=statscan). */
  statcanTableId?: number;
  /** StatsCan coordinate string (for kind=statscan). */
  statcanCoordinate?: string;
  /**
   * Default periods to request when no `time_range` is supplied. Picked to
   * match the dominant query shape the substrate already serves the products.
   */
  defaultPeriods: number;
  /** Human-readable provenance string for the response envelope. */
  source: string;
  /** Unit returned by the upstream (best-effort). */
  unit: string;
  /** One-liner used in the tool input schema's enum descriptor. */
  label: string;
}

const MACRO_INDICATOR_SPECS: Record<
  (typeof MACRO_INDICATORS)[number],
  MacroIndicatorSpec
> = {
  policy_rate: {
    kind: "boc",
    bocSeries: BOC_SERIES.POLICY_RATE,
    defaultPeriods: 365,
    source: "Bank of Canada Valet API",
    unit: "percent",
    label: "BoC overnight policy rate",
  },
  cad_usd: {
    kind: "boc",
    bocSeries: BOC_SERIES.CAD_USD,
    defaultPeriods: 365,
    source: "Bank of Canada Valet API",
    unit: "CAD per USD",
    label: "CAD/USD exchange rate",
  },
  mortgage_5y: {
    kind: "boc",
    bocSeries: BOC_SERIES.MORTGAGE_5Y_FIXED,
    defaultPeriods: 52,
    source: "Bank of Canada Valet API",
    unit: "percent",
    label: "Conventional 5-year fixed mortgage rate",
  },
  unemployment: {
    kind: "statscan",
    statcanTableId: STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.tableId,
    statcanCoordinate: STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.coordinate,
    defaultPeriods: 24,
    source: "Statistics Canada WDS (Table 14-10-0287)",
    unit: "percent",
    label: "Alberta unemployment rate, monthly",
  },
  cpi: {
    kind: "statscan",
    statcanTableId: STATSCAN_SERIES.AB_CPI.tableId,
    statcanCoordinate: STATSCAN_SERIES.AB_CPI.coordinate,
    defaultPeriods: 24,
    source: "Statistics Canada WDS (Table 18-10-0004)",
    unit: "index 2002=100",
    label: "Alberta CPI, monthly",
  },
  gdp: {
    kind: "statscan",
    statcanTableId: STATSCAN_SERIES.AB_GDP.tableId,
    statcanCoordinate: STATSCAN_SERIES.AB_GDP.coordinate,
    defaultPeriods: 10,
    source: "Statistics Canada WDS (Table 36-10-0402)",
    unit: "chained 2017 CAD, millions",
    label: "Alberta real GDP, annual",
  },
  housing_starts: {
    kind: "statscan",
    statcanTableId: STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.tableId,
    statcanCoordinate: STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.coordinate,
    defaultPeriods: 24,
    source: "Statistics Canada WDS (Table 34-10-0154, Edmonton CMA)",
    unit: "dwelling units",
    label: "Edmonton CMA housing starts, monthly",
  },
  aax: {
    kind: "aax",
    defaultPeriods: 36,
    source: "Government of Alberta — Alberta Activity Index (open.alberta.ca)",
    unit: "index",
    label: "Alberta Activity Index, monthly",
  },
};

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const MacroIndicatorSchema = z
  .enum([...MACRO_INDICATORS])
  .describe(
    "Macro indicator. policy_rate / cad_usd / mortgage_5y (BoC); unemployment / cpi / gdp / housing_starts (StatsCan); aax (Alberta Activity Index).",
  );

const MacroInputShape = {
  indicator: MacroIndicatorSchema,
  time_range: TimeRangeSchema.optional(),
};

const MacroPointSchema = z.object({
  date: z.iso.date(),
  value: z.number(),
});
type MacroPoint = z.infer<typeof MacroPointSchema>;

const MacroDataSchema = z.object({
  indicator: MacroIndicatorSchema,
  source: z.string(),
  unit: z.string(),
  last_observation: MacroPointSchema.nullable(),
  served_from: z.enum(["upstream", "fallback", "empty"]),
  points: z.array(MacroPointSchema),
});

const MacroEnvelopeSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  tool: z.literal("alberta_macro"),
  source: z.string(),
  data: MacroDataSchema,
});
type MacroEnvelope = z.infer<typeof MacroEnvelopeSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Translate a `time_range` into the LATEST-N count we ask the upstream for.
 * `last_30d`  → 30 (caps to spec's defaultPeriods if smaller)
 * `last_year` → 365 (daily) / 12 (monthly) — we don't know cadence here, so
 *               we use a generous upper bound and rely on the substrate's
 *               post-fetch filtering. The substrate fetchers de-dupe in-flight
 *               and revalidate hourly, so over-asking is cheap.
 * `last_5y`   → 1825 daily / 60 monthly equivalent — same logic.
 * `ytd`       → days since Jan 1.
 * explicit    → defer to default; explicit windows filter post-fetch.
 */
function periodsForRange(range: TimeRange | undefined, defaultPeriods: number): number {
  if (!range) return defaultPeriods;
  if (typeof range === "string") {
    switch (range) {
      case "last_30d":
        return Math.max(30, defaultPeriods);
      case "last_year":
        return Math.max(365, defaultPeriods);
      case "last_5y":
        return Math.max(1825, defaultPeriods);
      case "ytd": {
        const now = new Date();
        const startOfYear = Date.UTC(now.getUTCFullYear(), 0, 1);
        const days = Math.floor((now.getTime() - startOfYear) / 86_400_000) + 1;
        return Math.max(days, defaultPeriods);
      }
    }
  }
  // Explicit { from, to }: we ask for a wide window (5y default) and filter.
  return Math.max(1825, defaultPeriods);
}

function filterByRange(points: MacroPoint[], range: TimeRange | undefined): MacroPoint[] {
  if (!range || typeof range === "string") {
    // Named ranges are best-effort enforced by `periodsForRange`. We don't
    // additionally clip here because monthly cadence + a "last_30d" range
    // would otherwise return zero rows when the most recent obs is older
    // than 30 days. Substrate's cadence varies per indicator; let the agent
    // decide if the head of the series is fresh enough.
    return points;
  }
  const fromMs = range.from ? Date.parse(range.from) : Number.NEGATIVE_INFINITY;
  const toMs = range.to ? Date.parse(range.to) : Number.POSITIVE_INFINITY;
  return points.filter((p) => {
    const t = Date.parse(p.date);
    return Number.isFinite(t) && t >= fromMs && t <= toMs;
  });
}

/**
 * Coerce a substrate `TimeSeriesPoint[]` to the validated MacroPoint shape.
 * Drops rows missing a date or numeric value — defensive against upstream
 * shape drift.
 */
function normalisePoints(raw: TimeSeriesPoint[]): MacroPoint[] {
  const out: MacroPoint[] = [];
  for (const r of raw) {
    if (!r) continue;
    const date = typeof r.date === "string" ? r.date.slice(0, 10) : "";
    const value = typeof r.value === "number" ? r.value : Number(r.value);
    if (!date || !Number.isFinite(value)) continue;
    out.push({ date, value });
  }
  // Ascending order — substrate is inconsistent across BoC vs StatsCan.
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

async function fetchMacro(
  indicator: (typeof MACRO_INDICATORS)[number],
  periods: number,
): Promise<TimeSeriesPoint[]> {
  const spec = MACRO_INDICATOR_SPECS[indicator];
  switch (spec.kind) {
    case "boc": {
      if (!spec.bocSeries) return [];
      return await fetchBoCTimeSeries(spec.bocSeries, periods);
    }
    case "statscan": {
      if (!spec.statcanTableId || !spec.statcanCoordinate) return [];
      return await fetchStatCanTimeSeries(
        spec.statcanTableId,
        spec.statcanCoordinate,
        periods,
      );
    }
    case "aax": {
      const all = await fetchAlbertaActivityIndex();
      return all.slice(-periods);
    }
  }
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

const TOOL_NAME = "alberta_macro";

const TOOL_DESCRIPTION =
  "Province- and country-level macro indicators for Canada and Alberta. " +
  "BoC policy rate / CAD-USD / 5y mortgage (Bank of Canada Valet), " +
  "Alberta unemployment / CPI / GDP / Edmonton CMA housing starts " +
  "(Statistics Canada WDS), and the Alberta Activity Index (open.alberta.ca). " +
  "Returns a typed time series with provenance and unit. Falls back to a " +
  "Postgres snapshot when the upstream source is unavailable.";

// Flip the registry entry to "live" once at module load. The per-request
// server instances all share this in-memory registry, so doing it here keeps
// the mutation exactly-once per process instead of per request.
updateToolEntry(TOOL_NAME, {
  status: "live",
  parameters_summary:
    "indicator (enum: policy_rate, cad_usd, mortgage_5y, unemployment, cpi, gdp, housing_starts, aax); optional time_range (named bucket or {from,to}).",
  response_summary:
    "Envelope with schema_version, tool, source; data.{indicator,source,unit,last_observation,served_from,points[{date,value}]}.",
  indicators: [...MACRO_INDICATORS],
  example_invocations: [
    {
      description:
        "Bank of Canada policy rate over the last year (daily series).",
      arguments: { indicator: "policy_rate", time_range: "last_year" },
    },
    {
      description:
        "Alberta CPI for the trailing two years (monthly, StatsCan).",
      arguments: { indicator: "cpi", time_range: "last_5y" },
    },
    {
      description: "Alberta Activity Index — most recent ~3 years.",
      arguments: { indicator: "aax" },
    },
  ],
});

export function registerMacroTool(server: McpServer): void {
  server.registerTool(
    TOOL_NAME,
    {
      title: "Alberta Pulse — Macro Indicators",
      description: TOOL_DESCRIPTION,
      inputSchema: MacroInputShape,
      annotations: {
        title: "Alberta Pulse — Macro Indicators",
        readOnlyHint: true,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    async (args) => {
      const indicator = args.indicator;
      const timeRange = args.time_range;
      const spec = MACRO_INDICATOR_SPECS[indicator];

      const periods = periodsForRange(timeRange, spec.defaultPeriods);

      // Try upstream first.
      let raw: TimeSeriesPoint[] = [];
      let servedFrom: "upstream" | "fallback" | "empty" = "upstream";
      try {
        raw = await fetchMacro(indicator, periods);
      } catch (err) {
        console.warn(`[mcp:${TOOL_NAME}] upstream threw for ${indicator}:`, err);
        raw = [];
      }

      // Fall back to Postgres snapshot if upstream returned nothing.
      if (raw.length === 0) {
        const fb = await fallbackMacroTimeSeries(indicator, Math.min(periods, 1000));
        raw = fb.map((r) => ({ date: r.date, value: r.value }));
        servedFrom = raw.length > 0 ? "fallback" : "empty";
      }

      const normalised = normalisePoints(raw);
      const filtered = filterByRange(normalised, timeRange);

      const last = filtered.length > 0 ? filtered[filtered.length - 1] : null;

      const envelope: MacroEnvelope = {
        schema_version: SCHEMA_VERSION,
        tool: TOOL_NAME,
        source: spec.source,
        data: {
          indicator,
          source: spec.source,
          unit: spec.unit,
          last_observation: last,
          served_from: servedFrom,
          points: filtered,
        },
      };

      // Defensive shape validation before handing to the transport. If a
      // future substrate change ever produces an out-of-schema row, fail
      // loud instead of leaking garbage to the agent.
      const parsed = MacroEnvelopeSchema.parse(envelope);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(parsed, null, 2),
          },
        ],
        structuredContent: parsed as unknown as Record<string, unknown>,
      };
    },
  );
}
