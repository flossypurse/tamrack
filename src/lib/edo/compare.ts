/**
 * EDO Peer Comparison Engine (server-only)
 *
 * Fetches regional indicators for multiple municipalities and normalizes
 * data for side-by-side comparison. Reuses fetchRegionalTimeSeries()
 * from data-sources-regional.ts.
 */

import {
  fetchRegionalTimeSeries,
  type TimeSeriesPoint,
} from "../data-sources-regional";
import {
  getMunicipality,
  MUNICIPALITY_REGISTRY,
  type MunicipalityRegion,
} from "../municipality-registry";

// Re-export shared types and constants so server code can import from one place
export {
  COMPARISON_INDICATORS,
  COMPARISON_CATEGORIES,
  DEFAULT_INDICATOR_IDS,
  formatComparisonValue,
  getMunicipalityRegionLabel,
} from "./compare-shared";
export type {
  ComparisonIndicator,
  ComparisonCategory,
  MunicipalityComparison,
  ComparisonDataPoint,
  ComparisonResult,
} from "./compare-shared";

import type {
  ComparisonIndicator,
  MunicipalityComparison,
  ComparisonDataPoint,
  ComparisonResult,
} from "./compare-shared";
import { COMPARISON_INDICATORS } from "./compare-shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function latestValue(series: TimeSeriesPoint[]): number | null {
  if (!series.length) return null;
  return series[series.length - 1].value;
}

function latestPeriod(series: TimeSeriesPoint[]): string {
  if (!series.length) return "";
  return series[series.length - 1].date;
}

function calcChange(series: TimeSeriesPoint[]): string | null {
  if (series.length < 2) return null;
  const prev = series[series.length - 2].value;
  const curr = series[series.length - 1].value;
  if (prev === 0) return null;
  const pct = ((curr - prev) / Math.abs(prev)) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Municipality picker helpers
// ---------------------------------------------------------------------------

export function getComparableMunicipalities(): MunicipalityComparison[] {
  return MUNICIPALITY_REGISTRY.filter((m) => m.status === "live").map((m) => ({
    slug: m.slug,
    name: m.name,
    region: m.region,
    color: m.color,
  }));
}

// ---------------------------------------------------------------------------
// Main comparison fetcher
// ---------------------------------------------------------------------------

async function fetchIndicatorForMunicipality(
  indicator: ComparisonIndicator,
  municipalitySlug: string,
): Promise<ComparisonDataPoint> {
  const config = getMunicipality(municipalitySlug);
  const municipalityName = config
    ? config.name
    : municipalitySlug
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

  try {
    const series = await fetchRegionalTimeSeries(
      indicator.regionalKey,
      municipalityName,
    );
    return {
      municipalitySlug,
      municipalityName,
      indicatorId: indicator.id,
      latestValue: latestValue(series),
      latestPeriod: latestPeriod(series),
      change: calcChange(series),
      trend: series.slice(-10),
    };
  } catch {
    return {
      municipalitySlug,
      municipalityName,
      indicatorId: indicator.id,
      latestValue: null,
      latestPeriod: "",
      change: null,
      trend: [],
    };
  }
}

/**
 * Fetch comparison data for the given municipalities and indicators.
 * Fetches all combinations in parallel.
 */
export async function fetchComparison(
  municipalitySlugs: string[],
  indicatorIds: string[],
): Promise<ComparisonResult> {
  const indicators = COMPARISON_INDICATORS.filter((ind) =>
    indicatorIds.includes(ind.id),
  );

  const municipalities: MunicipalityComparison[] = municipalitySlugs.map((slug) => {
    const config = getMunicipality(slug);
    return {
      slug,
      name: config?.name ?? slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
      region: config?.region ?? ("edmonton-metro" as MunicipalityRegion),
      color: config?.color ?? "#6366f1",
    };
  });

  // Fetch all municipality × indicator combinations in parallel
  const tasks: Promise<ComparisonDataPoint>[] = [];
  for (const slug of municipalitySlugs) {
    for (const indicator of indicators) {
      tasks.push(fetchIndicatorForMunicipality(indicator, slug));
    }
  }

  const data = await Promise.all(tasks);

  return {
    municipalities,
    indicators,
    data,
    generatedAt: new Date().toISOString(),
  };
}
