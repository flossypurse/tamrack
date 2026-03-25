/**
 * EDO Community Profile Data Aggregator
 *
 * Pulls all available data for a given municipality into a structured
 * CommunityProfile object. Sources:
 * - regionaldashboard.alberta.ca (54 indicators)
 * - Municipality registry (ArcGIS endpoints)
 * - municipality-data.ts (assessments, businesses, permits)
 */

import {
  fetchRegionalIndicatorForMunicipality,
  fetchRegionalTimeSeries,
  type TimeSeriesPoint,
} from "../data-sources-regional";
import {
  getMunicipality,
  type MunicipalityConfig,
} from "../municipality-registry";
import {
  fetchParcelCount,
  fetchBusinessCategories,
  fetchAssessmentsByGroup,
  type BusinessCategory,
  type AssessmentByGroup,
} from "../municipality-data";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProfileMetric {
  label: string;
  value: number | null;
  formatted: string;
  unit: string;
  period: string;
  change?: string; // e.g. "+2.3%"
  trend: TimeSeriesPoint[];
  source: string;
}

export interface ProfileSection {
  title: string;
  metrics: ProfileMetric[];
  lastUpdated: string;
}

export interface CommunityProfile {
  municipalityName: string;
  municipalitySlug: string;
  region: string;
  population: number | null;
  generatedAt: string;
  sections: {
    overview: ProfileSection;
    economy: ProfileSection;
    demographics: ProfileSection;
    housing: ProfileSection;
    labour: ProfileSection;
    infrastructure: ProfileSection;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function formatRate(n: number | null): string {
  if (n === null) return "—";
  return n.toFixed(2);
}

/** Get the latest value from a time series */
function latestValue(series: TimeSeriesPoint[]): number | null {
  if (!series.length) return null;
  return series[series.length - 1].value;
}

/** Get the latest period label */
function latestPeriod(series: TimeSeriesPoint[]): string {
  if (!series.length) return "";
  return series[series.length - 1].date;
}

/** Calculate change between last two values */
function calcChange(series: TimeSeriesPoint[]): string | undefined {
  if (series.length < 2) return undefined;
  const prev = series[series.length - 2].value;
  const curr = series[series.length - 1].value;
  if (prev === 0) return undefined;
  const pct = ((curr - prev) / Math.abs(prev)) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Regional indicator fetcher with error tolerance
// ---------------------------------------------------------------------------

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

async function safeLatestDimensioned(
  indicator: string,
  municipalityName: string,
): Promise<{ value: number | null; period: string; dimensions: string }> {
  try {
    const points = await fetchRegionalIndicatorForMunicipality(indicator, municipalityName);
    if (!points.length) return { value: null, period: "", dimensions: "" };
    // Sort by period desc, take latest
    const sorted = [...points].sort((a, b) => b.period.localeCompare(a.period));
    const latestPeriodVal = sorted[0].period;
    const latestPoints = sorted.filter((p) => p.period === latestPeriodVal);
    // Sum all dimension values for that period
    const total = latestPoints.reduce((s, p) => s + p.value, 0);
    const dims = latestPoints.map((p) => p.dimensions.map((d) => d.value).join(", ")).join("; ");
    return { value: total, period: latestPeriodVal, dimensions: dims };
  } catch {
    return { value: null, period: "", dimensions: "" };
  }
}

// ---------------------------------------------------------------------------
// Main aggregator
// ---------------------------------------------------------------------------

export async function buildCommunityProfile(
  municipalitySlug: string,
): Promise<CommunityProfile> {
  const config = getMunicipality(municipalitySlug);
  const municipalityName = config
    ? config.name
    : municipalitySlug
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

  // Fetch all regional indicators in parallel
  const [
    populationTs,
    assessmentBaseTs,
    buildingPermitsTs,
    businessCountsTs,
    unemploymentTs,
    medianIncomeTs,
    avgWeeklyEarningsTs,
    labourForceTs,
    netMigrationTs,
    housingStartsTs,
    avgRentTs,
    avgSalePriceTs,
    vacancyRateTs,
    dwellingUnitsTs,
    crimeSeverityTs,
    lifeExpectancyTs,
    educationData,
    municipalTaxRateTs,
    ghgTs,
    incorporationsTs,
    k9EnrollTs,
    hsEnrollTs,
    residentialShareTs,
    birthsDeathsData,
    visibleMinorityData,
    permanentResidentTs,
  ] = await Promise.all([
    safeTimeSeries("Population", municipalityName),
    safeTimeSeries("Assessment Base", municipalityName),
    safeTimeSeries("Building Permits", municipalityName),
    safeTimeSeries("Business Counts", municipalityName),
    safeTimeSeries("Unemployment Rate", municipalityName),
    safeTimeSeries("Median Household Income", municipalityName),
    safeTimeSeries("Average Weekly Earnings", municipalityName),
    safeTimeSeries("Labour Force", municipalityName),
    safeTimeSeries("Net Migration", municipalityName),
    safeTimeSeries("Housing Starts", municipalityName),
    safeTimeSeries("Average Rent", municipalityName),
    safeTimeSeries("Average Residential Sale Price", municipalityName),
    safeTimeSeries("Vacancy Rates", municipalityName),
    safeTimeSeries("Dwelling Units", municipalityName),
    safeTimeSeries("Crime Severity Index", municipalityName),
    safeTimeSeries("Life Expectancy", municipalityName),
    safeLatestDimensioned("Educational Attainment", municipalityName),
    safeTimeSeries("Municipal Tax Rates", municipalityName),
    safeTimeSeries("Greenhouse Gas Emissions", municipalityName),
    safeTimeSeries("Incorporations", municipalityName),
    safeTimeSeries("K - 9 Enrollments", municipalityName),
    safeTimeSeries("High School Enrollments", municipalityName),
    safeTimeSeries("Residential Share of Property Assessments", municipalityName),
    safeLatestDimensioned("Births and Deaths", municipalityName),
    safeLatestDimensioned("Percent Visible Minority", municipalityName),
    safeTimeSeries("Permanent Resident Landings", municipalityName),
  ]);

  // Fetch ArcGIS-based data if available
  let parcelCount = 0;
  let businessCategories: BusinessCategory[] = [];
  let assessmentsByZoning: AssessmentByGroup[] = [];

  if (config) {
    [parcelCount, businessCategories, assessmentsByZoning] = await Promise.all([
      fetchParcelCount(config).catch(() => 0),
      fetchBusinessCategories(config).catch(() => [] as BusinessCategory[]),
      fetchAssessmentsByGroup(config, "zoning").catch(() => [] as AssessmentByGroup[]),
    ]);
  }

  const now = new Date().toISOString();

  const makeMetric = (
    label: string,
    series: TimeSeriesPoint[],
    formatter: (n: number | null) => string,
    unit: string,
    source: string,
  ): ProfileMetric => ({
    label,
    value: latestValue(series),
    formatted: formatter(latestValue(series)),
    unit,
    period: latestPeriod(series),
    change: calcChange(series),
    trend: series.slice(-10), // last 10 data points for sparkline
    source,
  });

  const regionalSrc = "regionaldashboard.alberta.ca";
  const arcgisSrc = config?.dataSource ?? "Municipal ArcGIS";

  return {
    municipalityName,
    municipalitySlug,
    region: config?.region ?? "unknown",
    population: latestValue(populationTs),
    generatedAt: now,
    sections: {
      overview: {
        title: "Overview",
        lastUpdated: now,
        metrics: [
          makeMetric("Population", populationTs, formatNumber, "people", regionalSrc),
          makeMetric("Assessment Base", assessmentBaseTs, formatCurrency, "$", regionalSrc),
          makeMetric("Building Permits", buildingPermitsTs, formatNumber, "permits", regionalSrc),
          makeMetric("Business Counts", businessCountsTs, formatNumber, "businesses", regionalSrc),
          makeMetric("Crime Severity Index", crimeSeverityTs, formatNumber, "index", regionalSrc),
        ],
      },
      economy: {
        title: "Economy",
        lastUpdated: now,
        metrics: [
          makeMetric("Median Household Income", medianIncomeTs, formatCurrency, "$", regionalSrc),
          makeMetric("Avg Weekly Earnings", avgWeeklyEarningsTs, formatCurrency, "$", regionalSrc),
          makeMetric("Incorporations", incorporationsTs, formatNumber, "new businesses", regionalSrc),
          makeMetric("Municipal Tax Rate", municipalTaxRateTs, formatRate, "mills", regionalSrc),
          makeMetric("Residential Assessment Share", residentialShareTs, formatPercent, "%", regionalSrc),
        ],
      },
      demographics: {
        title: "Demographics",
        lastUpdated: now,
        metrics: [
          makeMetric("Net Migration", netMigrationTs, formatNumber, "people", regionalSrc),
          makeMetric("Permanent Residents", permanentResidentTs, formatNumber, "landings", regionalSrc),
          makeMetric("Life Expectancy", lifeExpectancyTs, formatNumber, "years", regionalSrc),
          {
            label: "Visible Minority",
            value: visibleMinorityData.value,
            formatted: formatPercent(visibleMinorityData.value),
            unit: "%",
            period: visibleMinorityData.period,
            trend: [],
            source: regionalSrc,
          },
          makeMetric("K-9 Enrolment", k9EnrollTs, formatNumber, "students", regionalSrc),
        ],
      },
      housing: {
        title: "Housing",
        lastUpdated: now,
        metrics: [
          makeMetric("Housing Starts", housingStartsTs, formatNumber, "starts", regionalSrc),
          makeMetric("Average Rent", avgRentTs, formatCurrency, "$/month", regionalSrc),
          makeMetric("Avg Sale Price", avgSalePriceTs, formatCurrency, "$", regionalSrc),
          makeMetric("Vacancy Rate", vacancyRateTs, formatPercent, "%", regionalSrc),
          makeMetric("Dwelling Units", dwellingUnitsTs, formatNumber, "units", regionalSrc),
        ],
      },
      labour: {
        title: "Labour",
        lastUpdated: now,
        metrics: [
          makeMetric("Unemployment Rate", unemploymentTs, formatPercent, "%", regionalSrc),
          makeMetric("Labour Force", labourForceTs, formatNumber, "people", regionalSrc),
          makeMetric("High School Enrolment", hsEnrollTs, formatNumber, "students", regionalSrc),
          makeMetric("GHG Emissions", ghgTs, formatNumber, "tonnes CO₂e", regionalSrc),
        ],
      },
      infrastructure: {
        title: "Infrastructure & Local Data",
        lastUpdated: now,
        metrics: [
          {
            label: "Parcels Tracked",
            value: parcelCount || null,
            formatted: parcelCount ? formatNumber(parcelCount) : "—",
            unit: "parcels",
            period: "Current",
            trend: [],
            source: arcgisSrc,
          },
          {
            label: "Business Categories",
            value: businessCategories.length || null,
            formatted: businessCategories.length ? String(businessCategories.length) : "—",
            unit: "categories",
            period: "Current",
            trend: [],
            source: arcgisSrc,
          },
          {
            label: "Zoning Districts",
            value: assessmentsByZoning.length || null,
            formatted: assessmentsByZoning.length ? String(assessmentsByZoning.length) : "—",
            unit: "zones",
            period: "Current",
            trend: [],
            source: arcgisSrc,
          },
          {
            label: "Top Zoning",
            value: null,
            formatted: assessmentsByZoning[0]?.group ?? "—",
            unit: "",
            period: "Current",
            trend: [],
            source: arcgisSrc,
          },
        ],
      },
    },
  };
}

/** Fetch just the 4 headline metrics for the EDO dashboard (lighter weight) */
export async function fetchHeadlineMetrics(
  municipalitySlug: string,
): Promise<{
  population: ProfileMetric;
  assessmentBase: ProfileMetric;
  buildingPermits: ProfileMetric;
  businessCount: ProfileMetric;
}> {
  const config = getMunicipality(municipalitySlug);
  const municipalityName = config
    ? config.name
    : municipalitySlug
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

  const regionalSrc = "regionaldashboard.alberta.ca";

  const [populationTs, assessmentBaseTs, buildingPermitsTs, businessCountsTs] =
    await Promise.all([
      safeTimeSeries("Population", municipalityName),
      safeTimeSeries("Assessment Base", municipalityName),
      safeTimeSeries("Building Permits", municipalityName),
      safeTimeSeries("Business Counts", municipalityName),
    ]);

  const makeMetric = (
    label: string,
    series: TimeSeriesPoint[],
    formatter: (n: number | null) => string,
    unit: string,
  ): ProfileMetric => ({
    label,
    value: latestValue(series),
    formatted: formatter(latestValue(series)),
    unit,
    period: latestPeriod(series),
    change: calcChange(series),
    trend: series.slice(-10),
    source: regionalSrc,
  });

  return {
    population: makeMetric("Population", populationTs, formatNumber, "people"),
    assessmentBase: makeMetric("Assessment Base", assessmentBaseTs, formatCurrency, "$"),
    buildingPermits: makeMetric("Building Permits", buildingPermitsTs, formatNumber, "permits"),
    businessCount: makeMetric("Business Counts", businessCountsTs, formatNumber, "businesses"),
  };
}
