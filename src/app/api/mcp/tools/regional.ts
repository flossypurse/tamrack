/**
 * `tamrack_regional` tool registration.
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
 *   `fetchRegionalIndicatorForMunicipality` -> `fetchRegionalIndicator` already
 *   has retry-once + an UNFILTERED Postgres fallback baked into the substrate.
 *   `served_from` is reported as "upstream" on a non-empty result whose rows
 *   carry a csduid; "fallback" when every row's csduid is blank (the substrate
 *   fell back internally). When the substrate returns zero rows for this
 *   municipality we make ONE more, municipality-scoped fallback query here and
 *   report "fallback"/"empty" accordingly — so on the worst-case (upstream
 *   down + nothing for this muni) Postgres is touched twice. Acceptable: the
 *   second query is scoped and only runs on the empty path.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  REGIONAL_INDICATORS,
  fetchRegionalIndicatorForMunicipality,
  fetchRegionalTimeSeries,
  isNonAdditiveIndicator,
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
} from "../schemas";
import { clipByRange } from "../lib/time-range";
import { updateToolEntry } from "../registry";
import { requireScopes } from "../lib/auth-context";

const REQUIRED_SCOPES = ["tamrack:regional:read"] as const;

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
    "Regional dashboard indicator name (human-readable). Use tamrack_catalog.indicators_by_domain.regional for the full inventory.",
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
  tool: z.literal("tamrack_regional"),
  source: z.literal("regionaldashboard.alberta.ca"),
  data: RegionalDataSchema,
});
type RegionalEnvelope = z.infer<typeof RegionalEnvelopeSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pickDominantUnit(rows: { unit?: string }[]): string {
  for (const r of rows) {
    if (r.unit && r.unit.trim().length > 0) return r.unit;
  }
  return "";
}

/**
 * Fallback units for indicators the upstream/snapshot leaves blank. After the
 * averaging fix above the values are interpretable; we still surface a unit so
 * a bare decimal like 0.13 reads as a ratio (proportion), not an index.
 * Consulted only when the upstream unit is empty.
 */
const REGIONAL_UNIT_DEFAULTS: Record<string, string> = {
  "Unemployment Rate": "ratio",
  "Vacancy Rates": "ratio",
  "Residential Share of Property Assessments": "ratio",
  "Percent of Small Businesses": "ratio",
  "Percent Visible Minority": "ratio",
  "Percent Aboriginal": "ratio",
  "Percent Official Language Speakers": "ratio",
  "Percent Single Family Houses": "ratio",
  "Life Expectancy": "years",
  "Population": "count",
  "Dwelling Units": "count",
  "Labour Force": "count",
};

/** Resolve the unit to surface: prefer the upstream's, else a curated
 * default for the indicator, else empty. */
function unitFor(indicator: string, upstreamUnit: string): string {
  if (upstreamUnit && upstreamUnit.trim().length > 0) return upstreamUnit;
  return REGIONAL_UNIT_DEFAULTS[indicator] ?? "";
}

/**
 * Aggregate raw `RegionalDataPoint[]` (which may have multiple dimension
 * rows per period) into a clean time series. Additive indicators sum their
 * dimension rows; non-additive ones (rates/prices/averages — see
 * `NON_ADDITIVE_REGIONAL_INDICATORS`) average them so the value stays
 * meaningful. Preserves the unit string so we can surface it on the envelope.
 */
function aggregatePoints(
  raw: RegionalDataPoint[],
  indicator: string,
): RegionalPoint[] {
  const unit = pickDominantUnit(raw);
  const average = isNonAdditiveIndicator(indicator);
  const byPeriod = new Map<string, { sum: number; count: number }>();
  for (const r of raw) {
    if (!r.period) continue;
    const acc = byPeriod.get(r.period) ?? { sum: 0, count: 0 };
    acc.sum += r.value ?? 0;
    acc.count += 1;
    byPeriod.set(r.period, acc);
  }
  const out: RegionalPoint[] = [];
  for (const [period, { sum, count }] of byPeriod) {
    const value = average && count > 0 ? sum / count : sum;
    out.push({ date: period, value, unit });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

const TOOL_NAME = "tamrack_regional";

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
    "indicator (enum: one of 54 human-readable names from regionaldashboard.alberta.ca); municipality (registry slug); optional time_range (named bucket or {from,to}; named buckets clip to a real window relative to the latest observation, so e.g. last_5y on an annual series returns ~5 points).",
  response_summary:
    "Envelope with schema_version, tool, source; data.{indicator, municipality{slug,name,region,region_label}, source, unit, last_observation, served_from, points[{date,value,unit}]}.",
  indicators: REGIONAL_INDICATOR_NAMES,
  // NB: the 54 × ~340 indicator×municipality surface is very sparse — many
  // pairs simply have no rows upstream or in the snapshot (e.g. Population is
  // currently empty for every municipality). The canonical examples below are
  // chosen to be populated so they never return an empty envelope; agents
  // should still branch on `served_from`/`points.length` for arbitrary pairs.
  example_invocations: [
    {
      description: "Edmonton building permit values from the regional dashboard.",
      arguments: { indicator: "Building Permits", municipality: "edmonton" },
    },
    {
      description: "Edmonton dwelling units, annual (no time filter).",
      arguments: { indicator: "Dwelling Units", municipality: "edmonton" },
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
      title: "Tamrack — Regional Indicators",
      description: TOOL_DESCRIPTION,
      inputSchema: RegionalInputShape,
      annotations: {
        title: "Tamrack — Regional Indicators",
        readOnlyHint: true,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    async (args) => {
      requireScopes(REQUIRED_SCOPES);
      const indicator = args.indicator;
      const slug = args.municipality;
      const timeRange = args.time_range;

      const muni = getMunicipality(slug);
      if (!muni) {
        // Should be unreachable: MunicipalitySlugSchema validates against
        // the live registry at module load. Throw — the SDK turns this
        // into a JSON-RPC error response.
        throw new Error(
          `tamrack_regional: municipality slug "${slug}" missing from registry`,
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

      const aggregated = aggregatePoints(rawPoints, indicator);
      // Period labels ("2024", "2024-Q3", "2024-03") are anchored to a
      // comparable ISO date inside clipByRange; named ranges become real
      // windows relative to the latest period in the series.
      const clipped = clipByRange(aggregated, timeRange);

      // Resolve a non-empty unit (BUG 5) and stamp it on every point so the
      // envelope unit and the per-point unit can't disagree.
      const unit = unitFor(indicator, pickDominantUnit(rawPoints));
      const filtered = clipped.map((p) => ({ ...p, unit: p.unit || unit }));

      const last = filtered.length > 0 ? filtered[filtered.length - 1] : null;

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
