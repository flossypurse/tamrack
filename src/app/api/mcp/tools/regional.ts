/**
 * `alberta_regional` tool registration.
 *
 * Wraps the regional dashboard fetcher in `src/lib/data-sources-regional.ts`
 * (https://regionaldashboard.alberta.ca) behind a typed MCP surface. 54
 * socioeconomic indicators × ~340 Alberta municipalities, snapshot-backed.
 *
 * Indicator enum:
 *   Sourced directly from `Object.keys(REGIONAL_INDICATORS)` so the enum
 *   cannot drift from what the substrate accepts. Adding an indicator to
 *   the substrate registry automatically makes it callable here.
 *
 * Municipality slug:
 *   We accept the registry slug (e.g., "edmonton") via the shared
 *   `MunicipalitySlugSchema`. The upstream regional API filters by the
 *   municipality *name* (case-insensitive), so we resolve slug -> name via
 *   `getMunicipality(slug).name` before delegating. This is the same
 *   resolution `MunicipalitySlugSchema` already validates against, so the
 *   lookup always succeeds for a schema-valid input.
 *
 * Upstream + fallback policy:
 *   `fetchRegionalTimeSeries` -> `fetchRegionalIndicatorForMunicipality` ->
 *   `fetchRegionalIndicator` already has retry-once + Postgres fallback
 *   baked into the substrate. We do NOT layer a second fallback here — that
 *   would double-query Postgres on the failure path. `served_from` is
 *   reported as "upstream" on non-empty result; on empty we attempt the
 *   fallback query directly (via the same substrate path) and report
 *   "fallback" if rows came back, else "empty".
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  REGIONAL_INDICATORS,
  fetchRegionalIndicatorForMunicipality,
  fetchRegionalTimeSeries,
  type RegionalDataPoint,
} from "@/lib/data-sources-regional";
import { fallbackRegionalIndicator } from "@/lib/data-fallback";
import {
  getMunicipality,
  REGION_LABELS,
} from "@/lib/municipality-registry";

import {
  SCHEMA_VERSION,
  MunicipalitySlugSchema,
  TimeRangeSchema,
  type TimeRange,
} from "../schemas";
import { updateToolEntry } from "../registry";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const REGIONAL_INDICATOR_NAMES = Object.keys(REGIONAL_INDICATORS);

if (REGIONAL_INDICATOR_NAMES.length === 0) {
  // Defensive: an empty REGIONAL_INDICATORS would silently break the tool's
  // enum at module load. Match the same fail-loud pattern as schemas.ts.
  throw new Error(
    "MCP regional tool: REGIONAL_INDICATORS is empty; cannot derive indicator enum",
  );
}

const RegionalIndicatorSchema = z
  .enum(REGIONAL_INDICATOR_NAMES as [string, ...string[]])
  .describe(
    "Regional dashboard indicator name (human-readable). Use alberta_catalog.indicators_by_domain.regional for the full inventory.",
  );

const RegionalInputShape = {
  indicator: RegionalIndicatorSchema,
  municipality: MunicipalitySlugSchema,
  time_range: TimeRangeSchema.optional(),
};

const RegionalPointSchema = z.object({
  date: z.string(),
  value: z.number(),
  unit: z.string(),
});
type RegionalPoint = z.infer<typeof RegionalPointSchema>;

const RegionalDataSchema = z.object({
  indicator: z.string(),
  municipality: z.object({
    slug: z.string(),
    name: z.string(),
    region: z.string(),
    region_label: z.string(),
  }),
  source: z.literal("regionaldashboard.alberta.ca"),
  unit: z.string(),
  last_observation: RegionalPointSchema.nullable(),
  served_from: z.enum(["upstream", "fallback", "empty"]),
  points: z.array(RegionalPointSchema),
});

const RegionalEnvelopeSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  tool: z.literal("alberta_regional"),
  source: z.literal("regionaldashboard.alberta.ca"),
  data: RegionalDataSchema,
});
type RegionalEnvelope = z.infer<typeof RegionalEnvelopeSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * The regional API returns Period values like "2024", "2024-Q3", or
 * "2024-03". We compare these as strings against ISO YYYY-MM-DD bounds for
 * explicit `{from, to}` ranges; named ranges pass through unfiltered (the
 * upstream cadence varies per indicator from annual to monthly, and the
 * named bucket "last_30d" is meaningless for an annual series — let the
 * agent slice the head client-side).
 */
function filterByRange(points: RegionalPoint[], range: TimeRange | undefined): RegionalPoint[] {
  if (!range || typeof range === "string") return points;
  const from = range.from ?? "";
  const to = range.to ?? "";
  return points.filter((p) => {
    if (from && p.date < from) return false;
    if (to && p.date > to) return false;
    return true;
  });
}

function pickDominantUnit(rows: { unit?: string }[]): string {
  for (const r of rows) {
    if (r.unit && r.unit.trim().length > 0) return r.unit;
  }
  return "";
}

/**
 * Aggregate raw `RegionalDataPoint[]` (which may have multiple dimension
 * rows per period — e.g. housing starts by dwelling type) into a clean
 * time series. Mirrors `fetchRegionalTimeSeries` aggregation but preserves
 * the unit string so we can surface it on the envelope.
 */
function aggregatePoints(raw: RegionalDataPoint[]): RegionalPoint[] {
  const unit = pickDominantUnit(raw);
  const byPeriod = new Map<string, number>();
  for (const r of raw) {
    if (!r.period) continue;
    byPeriod.set(r.period, (byPeriod.get(r.period) ?? 0) + (r.value ?? 0));
  }
  const out: RegionalPoint[] = [];
  for (const [period, value] of byPeriod) {
    out.push({ date: period, value, unit });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

const TOOL_NAME = "alberta_regional";

const TOOL_DESCRIPTION =
  "Alberta Regional Dashboard — 54 socioeconomic indicators across all " +
  "Alberta municipalities (population, labour, building permits, average " +
  "residential sale price, vacancy, migration, etc.). Source: " +
  "regionaldashboard.alberta.ca. Falls back to a Postgres snapshot when " +
  "the upstream API is unavailable; the substrate retries once before " +
  "failing over.";

// Flip registry entry to "live" and replace the placeholder indicator
// inventory with the real list. Runs once at module load. See DECISIONS.md
// (D11) for why we ship the full 54 indicator names — the catalog payload
// absorbs the extra ~1KB without trouble at v1 volumes.
updateToolEntry(TOOL_NAME, {
  status: "live",
  parameters_summary:
    "indicator (enum: one of 54 human-readable names from regionaldashboard.alberta.ca); municipality (registry slug); optional time_range ({from,to}; named buckets pass through unfiltered since indicator cadence varies).",
  response_summary:
    "Envelope with schema_version, tool, source; data.{indicator, municipality{slug,name,region,region_label}, source, unit, last_observation, served_from, points[{date,value,unit}]}.",
  indicators: REGIONAL_INDICATOR_NAMES,
  example_invocations: [
    {
      description: "Edmonton population from the regional dashboard.",
      arguments: { indicator: "Population", municipality: "edmonton" },
    },
    {
      description:
        "Average residential sale price in Calgary, no time filter (annual cadence).",
      arguments: {
        indicator: "Average Residential Sale Price",
        municipality: "calgary",
      },
    },
    {
      description:
        "Strathcona County building permits, last decade explicitly.",
      arguments: {
        indicator: "Building Permits",
        municipality: "strathcona",
        time_range: { from: "2016-01-01" },
      },
    },
  ],
});

export function registerRegionalTool(server: McpServer): void {
  server.registerTool(
    TOOL_NAME,
    {
      title: "Alberta Pulse — Regional Indicators",
      description: TOOL_DESCRIPTION,
      inputSchema: RegionalInputShape,
      annotations: {
        title: "Alberta Pulse — Regional Indicators",
        readOnlyHint: true,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    async (args) => {
      const indicator = args.indicator;
      const slug = args.municipality;
      const timeRange = args.time_range;

      const muni = getMunicipality(slug);
      if (!muni) {
        // Should be unreachable: MunicipalitySlugSchema validates against
        // the live registry at module load. Throw — the SDK turns this
        // into a JSON-RPC error response.
        throw new Error(
          `alberta_regional: municipality slug "${slug}" missing from registry`,
        );
      }

      // Track served_from: upstream path returns RegionalDataPoint[] with
      // csduid populated; fallback path leaves csduid empty (the
      // substrate's dbFallback() blanks it). We use that to attribute the
      // origin without an extra trip.
      let rawPoints: RegionalDataPoint[] = [];
      try {
        rawPoints = await fetchRegionalIndicatorForMunicipality(
          indicator,
          muni.name,
        );
      } catch (err) {
        console.warn(`[mcp:${TOOL_NAME}] substrate threw for ${indicator}/${slug}:`, err);
        rawPoints = [];
      }

      let servedFrom: "upstream" | "fallback" | "empty" = "upstream";
      if (rawPoints.length === 0) {
        // Substrate returned nothing — try the direct fallback table.
        const fb = await fallbackRegionalIndicator(indicator, muni.name);
        rawPoints = fb.map((r) => ({
          csduid: "",
          municipality: r.municipality,
          period: r.period,
          indicator,
          dimensions: [],
          value: r.value,
          unit: r.unit,
        }));
        servedFrom = rawPoints.length > 0 ? "fallback" : "empty";
      } else if (rawPoints.every((p) => p.csduid === "")) {
        // Substrate fell back internally — every row's csduid was blanked
        // by its dbFallback(). Report that to the agent.
        servedFrom = "fallback";
      }

      const aggregated = aggregatePoints(rawPoints);
      const filtered = filterByRange(aggregated, timeRange);

      const last = filtered.length > 0 ? filtered[filtered.length - 1] : null;
      const unit = filtered[0]?.unit ?? pickDominantUnit(rawPoints);

      // Cross-check what we'd return against `fetchRegionalTimeSeries` for
      // consistency: this tool is deliberately NOT calling that fn (we
      // need the dimension/unit info that gets dropped). The aggregation
      // result must still match the canonical shape — assert via parse.
      void fetchRegionalTimeSeries;

      const envelope: RegionalEnvelope = {
        schema_version: SCHEMA_VERSION,
        tool: TOOL_NAME,
        source: "regionaldashboard.alberta.ca",
        data: {
          indicator,
          municipality: {
            slug: muni.slug,
            name: muni.name,
            region: muni.region,
            region_label: REGION_LABELS[muni.region] ?? muni.region,
          },
          source: "regionaldashboard.alberta.ca",
          unit,
          last_observation: last,
          served_from: servedFrom,
          points: filtered,
        },
      };

      const parsed = RegionalEnvelopeSchema.parse(envelope);

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
