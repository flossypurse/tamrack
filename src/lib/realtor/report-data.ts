/**
 * Realtor Report Data Aggregator
 *
 * Builds a single-municipality report snapshot for client-facing market reports.
 * Sources: regionaldashboard.alberta.ca, CMHC (StatsCan), UAlberta neighbourhood
 * assessments, ArcGIS/Socrata permits.
 */

import {
  fetchRegionalTimeSeries,
  type TimeSeriesPoint,
} from "../data-sources-regional";
import {
  fetchVacancyRates,
  fetchRentComparison,
  type CMASeriesPoint,
  type RentComparisonPoint,
} from "../data-sources-cmhc";
import {
  fetchNeighbourhoodAssessments,
  type NeighbourhoodAssessment,
} from "../data-sources-ualberta";
import {
  getMunicipality,
} from "../municipality-registry";
import {
  fetchPermitsByGroup,
  fetchAssessmentsByGroup,
  type PermitSummary,
  type AssessmentByGroup,
} from "../municipality-data";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReportMetric {
  label: string;
  value: number | null;
  formatted: string;
  unit: string;
  period: string;
  change?: string;
  trend: TimeSeriesPoint[];
}

export interface ReportNeighbourhood {
  neighbourhood: string;
  avgAssessment: number;
  propertyCount: number;
  yoyChange: number | null;
  avgLotSize: number;
  avgYearBuilt: number;
}

export interface ReportSnapshot {
  slug: string;
  name: string;
  generatedAt: string;

  // Headline metrics
  headlines: {
    avgSalePrice: ReportMetric;
    buildingPermits: ReportMetric;
    housingStarts: ReportMetric;
    vacancyRate: ReportMetric;
    assessmentBase: ReportMetric;
    population: ReportMetric;
  };

  // Permit activity from ArcGIS/Socrata
  permitActivity: PermitSummary[];

  // Zoning breakdown (non-Edmonton/Calgary municipalities)
  zoningBreakdown: AssessmentByGroup[];

  // Neighbourhood assessments (Edmonton/Calgary only)
  hasNeighbourhoodData: boolean;
  neighbourhoods: ReportNeighbourhood[];
  latestAssessmentYear: number | null;

  // Rental snapshot (CMHC — Edmonton/Calgary metros)
  rental: {
    vacancyRates: CMASeriesPoint[];
    rents: RentComparisonPoint[];
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugToName(slug: string): string {
  const config = getMunicipality(slug);
  if (config) return config.name;
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatNumber(n: number | null): string {
  if (n === null || n === undefined) return "—";
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toFixed(1);
}

function formatCurrency(n: number | null): string {
  if (n === null) return "—";
  if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function formatPercent(n: number | null): string {
  if (n === null) return "—";
  return `${n.toFixed(1)}%`;
}

function latestValue(series: TimeSeriesPoint[]): number | null {
  if (!series.length) return null;
  return series[series.length - 1].value;
}

function latestPeriod(series: TimeSeriesPoint[]): string {
  if (!series.length) return "";
  return series[series.length - 1].date;
}

function calcChange(series: TimeSeriesPoint[]): string | undefined {
  if (series.length < 2) return undefined;
  const prev = series[series.length - 2].value;
  const curr = series[series.length - 1].value;
  if (prev === 0) return undefined;
  const pct = ((curr - prev) / Math.abs(prev)) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

async function safeTimeSeries(
  indicator: string,
  municipalityName: string,
): Promise<TimeSeriesPoint[]> {
  try {
    return await fetchRegionalTimeSeries(indicator, municipalityName);
  } catch {
    return [];
  }
}

function makeMetric(
  label: string,
  series: TimeSeriesPoint[],
  formatter: (n: number | null) => string,
  unit: string,
): ReportMetric {
  return {
    label,
    value: latestValue(series),
    formatted: formatter(latestValue(series)),
    unit,
    period: latestPeriod(series),
    change: calcChange(series),
    trend: series.slice(-10),
  };
}

function buildNeighbourhoodRankings(
  assessments: NeighbourhoodAssessment[],
): { latestYear: number | null; rankings: ReportNeighbourhood[] } {
  if (assessments.length === 0) return { latestYear: null, rankings: [] };

  const latestYear = Math.max(...assessments.map((a) => a.year));
  const prevYear = latestYear - 1;

  const latestData = assessments.filter((a) => a.year === latestYear);
  const prevData = assessments.filter((a) => a.year === prevYear);

  const prevMap = new Map<string, number>();
  for (const a of prevData) {
    prevMap.set(a.neighbourhood, a.avgAssessment);
  }

  const rankings: ReportNeighbourhood[] = latestData
    .filter((a) => a.avgAssessment > 0 && a.propertyCount > 0)
    .map((a) => {
      const prevAvg = prevMap.get(a.neighbourhood);
      const yoyChange =
        prevAvg && prevAvg > 0
          ? ((a.avgAssessment - prevAvg) / prevAvg) * 100
          : null;

      return {
        neighbourhood: a.neighbourhood,
        avgAssessment: Math.round(a.avgAssessment),
        propertyCount: a.propertyCount,
        yoyChange: yoyChange !== null ? Math.round(yoyChange * 10) / 10 : null,
        avgLotSize: a.avgLotSize,
        avgYearBuilt: Math.round(a.avgYearBuilt),
      };
    })
    .sort((a, b) => b.avgAssessment - a.avgAssessment);

  return { latestYear, rankings };
}

// ---------------------------------------------------------------------------
// Main aggregator
// ---------------------------------------------------------------------------

export async function buildReportSnapshot(
  slug: string,
): Promise<ReportSnapshot> {
  const name = slugToName(slug);
  const config = getMunicipality(slug);

  // Fetch regional indicators
  const [avgSalePrice, buildingPermits, housingStarts, vacancyRate, assessmentBase, population] =
    await Promise.all([
      safeTimeSeries("Average Residential Sale Price", name),
      safeTimeSeries("Building Permits", name),
      safeTimeSeries("Housing Starts", name),
      safeTimeSeries("Vacancy Rates", name),
      safeTimeSeries("Assessment Base", name),
      safeTimeSeries("Population", name),
    ]);

  // Fetch permit activity + zoning + neighbourhood data + rental in parallel
  const hasNeighbourhoodData = slug === "edmonton" || slug === "calgary";

  const [permitActivity, zoningBreakdown, neighbourhoodAssessments, vacancyRates, rents] =
    await Promise.all([
      config
        ? fetchPermitsByGroup(config).catch(() => [] as PermitSummary[])
        : Promise.resolve([] as PermitSummary[]),
      config && !hasNeighbourhoodData
        ? fetchAssessmentsByGroup(config, "zoning").catch(() => [] as AssessmentByGroup[])
        : Promise.resolve([] as AssessmentByGroup[]),
      hasNeighbourhoodData
        ? fetchNeighbourhoodAssessments(slug === "edmonton" ? "Edmonton" : "Calgary").catch(() => [])
        : Promise.resolve([] as NeighbourhoodAssessment[]),
      fetchVacancyRates(6).catch(() => [] as CMASeriesPoint[]),
      fetchRentComparison(3).catch(() => [] as RentComparisonPoint[]),
    ]);

  const { latestYear, rankings } = buildNeighbourhoodRankings(neighbourhoodAssessments);

  return {
    slug,
    name,
    generatedAt: new Date().toISOString(),
    headlines: {
      avgSalePrice: makeMetric("Avg Sale Price", avgSalePrice, formatCurrency, "$"),
      buildingPermits: makeMetric("Building Permits", buildingPermits, formatNumber, "permits"),
      housingStarts: makeMetric("Housing Starts", housingStarts, formatNumber, "starts"),
      vacancyRate: makeMetric("Vacancy Rate", vacancyRate, formatPercent, "%"),
      assessmentBase: makeMetric("Assessment Base", assessmentBase, formatCurrency, "$"),
      population: makeMetric("Population", population, formatNumber, "people"),
    },
    permitActivity: permitActivity.slice(0, 10),
    zoningBreakdown,
    hasNeighbourhoodData,
    neighbourhoods: rankings,
    latestAssessmentYear: latestYear,
    rental: { vacancyRates, rents },
  };
}
