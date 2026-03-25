/**
 * Realtor Prospect Data Aggregator
 *
 * Surfaces development permits, construction activity, and assessment changes
 * across a realtor's operating area to identify potential buyers and sellers.
 * Sources: ArcGIS/Socrata permits, municipality construction data,
 * regionaldashboard.alberta.ca assessment/housing indicators.
 */

import {
  fetchRegionalTimeSeries,
  type TimeSeriesPoint,
} from "../data-sources-regional";
import {
  getMunicipality,
  type MunicipalityConfig,
} from "../municipality-registry";
import {
  fetchRecentPermits,
  fetchConstructionProjects,
  fetchPermitsByGroup,
  type RecentPermit,
  type ConstructionProject,
  type PermitSummary,
} from "../municipality-data";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PermitVolumeTrend {
  date: string;
  value: number;
}

export interface HotZone {
  slug: string;
  name: string;
  permitCount: number;
  constructionCount: number;
  assessmentChange: string | undefined;
  score: number; // composite activity score
}

export interface MuniConstruction {
  slug: string;
  name: string;
  projects: ConstructionProject[];
}

export interface MuniPermitGroups {
  slug: string;
  name: string;
  permits: PermitSummary[];
}

export interface ProspectSnapshot {
  operatingArea: string[];
  municipalityNames: string[];
  generatedAt: string;

  // Recent individual permits across operating area
  recentPermits: RecentPermit[];

  // Permit volume trend (from regional dashboard "Building Permits" indicator)
  permitVolumeTrend: PermitVolumeTrend[];

  // Permit breakdown by type per municipality
  permitGroups: MuniPermitGroups[];

  // Construction activity per municipality
  construction: MuniConstruction[];

  // Assessment trends per municipality
  assessmentTrends: {
    slug: string;
    name: string;
    trend: TimeSeriesPoint[];
    latestValue: number | null;
    change: string | undefined;
  }[];

  // Housing starts trends per municipality
  housingStartsTrend: PermitVolumeTrend[];

  // Hot zones — municipalities ranked by activity
  hotZones: HotZone[];
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

function calcChange(series: TimeSeriesPoint[]): string | undefined {
  if (series.length < 2) return undefined;
  const prev = series[series.length - 2].value;
  const curr = series[series.length - 1].value;
  if (prev === 0) return undefined;
  const pct = ((curr - prev) / Math.abs(prev)) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function sumSeries(allSeries: TimeSeriesPoint[][]): PermitVolumeTrend[] {
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

export async function buildProspectSnapshot(
  operatingArea: string[],
): Promise<ProspectSnapshot> {
  const names = operatingArea.map(slugToName);
  const configs = operatingArea
    .map((slug) => ({ slug, config: getMunicipality(slug) }))
    .filter((c): c is { slug: string; config: MunicipalityConfig } => !!c.config);

  // Fetch all data in parallel
  const [
    recentPermitsResults,
    constructionResults,
    permitGroupResults,
    regionalData,
  ] = await Promise.all([
    // Recent individual permits from ArcGIS/Socrata
    Promise.all(
      configs
        .filter((c) => c.config.endpoints.devPermits || c.config.endpoints.permits)
        .map(async (c) => {
          const permits = await fetchRecentPermits(c.config, 30).catch(() => []);
          return permits;
        }),
    ),

    // Construction projects
    Promise.all(
      configs
        .filter((c) => c.config.capabilities.includes("construction"))
        .map(async (c) => ({
          slug: c.slug,
          name: c.config.name,
          projects: await fetchConstructionProjects(c.config).catch(() => []),
        })),
    ),

    // Permit groups by type
    Promise.all(
      configs
        .filter((c) => c.config.endpoints.devPermits || c.config.endpoints.permits)
        .map(async (c) => ({
          slug: c.slug,
          name: c.config.name,
          permits: await fetchPermitsByGroup(c.config).catch(() => []),
        })),
    ),

    // Regional dashboard indicators for each municipality
    Promise.all(
      operatingArea.map(async (slug, i) => {
        const name = names[i];
        const [buildingPermits, assessmentBase, housingStarts] = await Promise.all([
          safeTimeSeries("Building Permits", name),
          safeTimeSeries("Assessment Base", name),
          safeTimeSeries("Housing Starts", name),
        ]);
        return { slug, name, buildingPermits, assessmentBase, housingStarts };
      }),
    ),
  ]);

  // Flatten and sort recent permits by date (newest first)
  const recentPermits = recentPermitsResults
    .flat()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 100);

  // Aggregate permit volume trend across operating area
  const allPermitSeries = regionalData
    .map((d) => d.buildingPermits)
    .filter((s) => s.length > 0);
  const permitVolumeTrend = sumSeries(allPermitSeries);

  // Aggregate housing starts trend
  const allStartsSeries = regionalData
    .map((d) => d.housingStarts)
    .filter((s) => s.length > 0);
  const housingStartsTrend = sumSeries(allStartsSeries);

  // Assessment trends per municipality
  const assessmentTrends = regionalData.map((d) => ({
    slug: d.slug,
    name: d.name,
    trend: d.assessmentBase.slice(-10),
    latestValue: d.assessmentBase.length > 0
      ? d.assessmentBase[d.assessmentBase.length - 1].value
      : null,
    change: calcChange(d.assessmentBase),
  }));

  // Filter construction to those with actual projects
  const construction = constructionResults.filter((c) => c.projects.length > 0);

  // Filter permit groups to those with data
  const permitGroups = permitGroupResults.filter((p) => p.permits.length > 0);

  // Calculate hot zones (composite activity score)
  const hotZones: HotZone[] = operatingArea.map((slug, i) => {
    const name = names[i];
    const permitGroupData = permitGroups.find((p) => p.slug === slug);
    const constructionData = construction.find((c) => c.slug === slug);
    const assessmentData = assessmentTrends.find((a) => a.slug === slug);

    const permitCount = permitGroupData
      ? permitGroupData.permits.reduce((sum, p) => sum + p.count, 0)
      : 0;
    const constructionCount = constructionData?.projects.length || 0;

    // Score: permits (weight 1) + construction (weight 3) + assessment change bonus
    let score = permitCount + constructionCount * 3;
    if (assessmentData?.change) {
      const pct = parseFloat(assessmentData.change);
      if (!isNaN(pct) && pct > 0) score += pct * 2;
    }

    return {
      slug,
      name,
      permitCount,
      constructionCount,
      assessmentChange: assessmentData?.change,
      score,
    };
  })
    .sort((a, b) => b.score - a.score);

  return {
    operatingArea,
    municipalityNames: names,
    generatedAt: new Date().toISOString(),
    recentPermits,
    permitVolumeTrend: permitVolumeTrend.slice(-20),
    permitGroups,
    construction,
    assessmentTrends,
    housingStartsTrend: housingStartsTrend.slice(-20),
    hotZones,
  };
}
