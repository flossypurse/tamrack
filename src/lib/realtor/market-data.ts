/**
 * Realtor Market Data Aggregator
 *
 * Aggregates real estate data across a realtor's operating area (multi-municipality).
 * Sources: regionaldashboard.alberta.ca, CMHC (StatsCan), ArcGIS/Socrata permits,
 * UAlberta neighbourhood assessments.
 */

import {
  fetchRegionalTimeSeries,
  type TimeSeriesPoint,
} from "../data-sources-regional";
import {
  fetchVacancyRates,
  fetchRentComparison,
  fetchHousingStarts,
  type CMASeriesPoint,
  type RentComparisonPoint,
} from "../data-sources-cmhc";
import {
  fetchCityAssessmentTrend,
  type AssessmentTrend,
} from "../data-sources-ualberta";
import {
  getMunicipality,
  type MunicipalityConfig,
} from "../municipality-registry";
import { fetchPermitsByGroup, type PermitSummary } from "../municipality-data";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RealtorMetric {
  label: string;
  value: number | null;
  formatted: string;
  unit: string;
  period: string;
  change?: string;
  trend: TimeSeriesPoint[];
}

export interface RentalSummary {
  vacancyRates: CMASeriesPoint[];
  rents: RentComparisonPoint[];
}

export interface RealtorMarketSnapshot {
  operatingArea: string[];
  municipalityNames: string[];
  generatedAt: string;

  // Headline metrics (aggregated across operating area)
  headlines: {
    avgSalePrice: RealtorMetric;
    buildingPermits: RealtorMetric;
    vacancyRate: RealtorMetric;
    housingStarts: RealtorMetric;
    population: RealtorMetric;
    medianIncome: RealtorMetric;
  };

  // Per-municipality breakdown
  perMunicipality: {
    slug: string;
    name: string;
    avgSalePrice: RealtorMetric;
    buildingPermits: RealtorMetric;
    housingStarts: RealtorMetric;
    assessmentBase: RealtorMetric;
  }[];

  // Permit activity from ArcGIS/Socrata
  permitActivity: {
    slug: string;
    name: string;
    permits: PermitSummary[];
  }[];

  // Rental market (CMHC — Edmonton/Calgary metros)
  rental: RentalSummary;

  // Assessment trends (UAlberta — Edmonton/Calgary)
  assessmentTrends: AssessmentTrend[];
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
): RealtorMetric {
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

/** Average multiple time series by aligning on period and taking mean */
function averageSeries(allSeries: TimeSeriesPoint[][]): TimeSeriesPoint[] {
  const byDate = new Map<string, { total: number; count: number }>();
  for (const series of allSeries) {
    for (const pt of series) {
      const ex = byDate.get(pt.date) || { total: 0, count: 0 };
      ex.total += pt.value;
      ex.count++;
      byDate.set(pt.date, ex);
    }
  }
  return Array.from(byDate.entries())
    .map(([date, { total, count }]) => ({
      date,
      value: Math.round(total / count),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Sum multiple time series by aligning on period */
function sumSeries(allSeries: TimeSeriesPoint[][]): TimeSeriesPoint[] {
  const byDate = new Map<string, number>();
  for (const series of allSeries) {
    for (const pt of series) {
      byDate.set(pt.date, (byDate.get(pt.date) || 0) + pt.value);
    }
  }
  return Array.from(byDate.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ---------------------------------------------------------------------------
// Main aggregator
// ---------------------------------------------------------------------------

export async function buildMarketSnapshot(
  operatingArea: string[],
): Promise<RealtorMarketSnapshot> {
  const names = operatingArea.map(slugToName);

  // Fetch regional indicators for each municipality in parallel
  const perMuniData = await Promise.all(
    operatingArea.map(async (slug, i) => {
      const name = names[i];
      const [avgSalePrice, buildingPermits, housingStarts, assessmentBase, population, medianIncome, vacancyRate] =
        await Promise.all([
          safeTimeSeries("Average Residential Sale Price", name),
          safeTimeSeries("Building Permits", name),
          safeTimeSeries("Housing Starts", name),
          safeTimeSeries("Assessment Base", name),
          safeTimeSeries("Population", name),
          safeTimeSeries("Median Household Income", name),
          safeTimeSeries("Vacancy Rates", name),
        ]);
      return { slug, name, avgSalePrice, buildingPermits, housingStarts, assessmentBase, population, medianIncome, vacancyRate };
    }),
  );

  // Aggregate headline metrics across operating area
  const allSalePriceSeries = perMuniData.map((d) => d.avgSalePrice).filter((s) => s.length > 0);
  const allPermitSeries = perMuniData.map((d) => d.buildingPermits).filter((s) => s.length > 0);
  const allStartsSeries = perMuniData.map((d) => d.housingStarts).filter((s) => s.length > 0);
  const allPopSeries = perMuniData.map((d) => d.population).filter((s) => s.length > 0);
  const allIncomeSeries = perMuniData.map((d) => d.medianIncome).filter((s) => s.length > 0);
  const allVacancySeries = perMuniData.map((d) => d.vacancyRate).filter((s) => s.length > 0);

  const aggSalePrice = averageSeries(allSalePriceSeries);
  const aggPermits = sumSeries(allPermitSeries);
  const aggStarts = sumSeries(allStartsSeries);
  const aggPop = sumSeries(allPopSeries);
  const aggIncome = averageSeries(allIncomeSeries);
  const aggVacancy = averageSeries(allVacancySeries);

  // Per-municipality metrics
  const perMunicipality = perMuniData.map((d) => ({
    slug: d.slug,
    name: d.name,
    avgSalePrice: makeMetric("Avg Sale Price", d.avgSalePrice, formatCurrency, "$"),
    buildingPermits: makeMetric("Building Permits", d.buildingPermits, formatNumber, "permits"),
    housingStarts: makeMetric("Housing Starts", d.housingStarts, formatNumber, "starts"),
    assessmentBase: makeMetric("Assessment Base", d.assessmentBase, formatCurrency, "$"),
  }));

  // Fetch permit activity from ArcGIS/Socrata for municipalities that have permit endpoints
  const permitActivity = await Promise.all(
    operatingArea.map(async (slug) => {
      const config = getMunicipality(slug);
      if (!config) return { slug, name: slugToName(slug), permits: [] as PermitSummary[] };
      const hasPermits = config.endpoints.permits || config.endpoints.devPermits;
      if (!hasPermits) return { slug, name: config.name, permits: [] as PermitSummary[] };
      const permits = await fetchPermitsByGroup(config).catch(() => [] as PermitSummary[]);
      return { slug, name: config.name, permits: permits.slice(0, 10) };
    }),
  );

  // Fetch CMHC rental data and assessment trends in parallel
  const [vacancyRates, rents, assessmentTrends, cmhcStarts] = await Promise.all([
    fetchVacancyRates(10).catch(() => [] as CMASeriesPoint[]),
    fetchRentComparison(10).catch(() => [] as RentComparisonPoint[]),
    fetchCityAssessmentTrend().catch(() => [] as AssessmentTrend[]),
    fetchHousingStarts(12).catch(() => [] as CMASeriesPoint[]),
  ]);

  return {
    operatingArea,
    municipalityNames: names,
    generatedAt: new Date().toISOString(),
    headlines: {
      avgSalePrice: makeMetric("Avg Sale Price", aggSalePrice, formatCurrency, "$"),
      buildingPermits: makeMetric("Building Permits", aggPermits, formatNumber, "permits"),
      vacancyRate: makeMetric("Vacancy Rate", aggVacancy, formatPercent, "%"),
      housingStarts: makeMetric("Housing Starts", aggStarts, formatNumber, "starts"),
      population: makeMetric("Population", aggPop, formatNumber, "people"),
      medianIncome: makeMetric("Median Income", aggIncome, formatCurrency, "$"),
    },
    perMunicipality,
    permitActivity: permitActivity.filter((p) => p.permits.length > 0),
    rental: { vacancyRates, rents },
    assessmentTrends: assessmentTrends.slice(-10),
  };
}
