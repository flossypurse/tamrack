/**
 * EDO Investment Pitch Kit Engine (server-only)
 *
 * Assembles investor-facing data by reusing existing aggregators:
 * - buildCommunityProfile() for core municipality metrics
 * - fetchComparison() for peer benchmarking
 * - Google Maps API for nearby amenities
 *
 * No duplicated fetch logic.
 */

import { buildCommunityProfile, type CommunityProfile, type ProfileMetric } from "./profile-data";
import { fetchComparison } from "./compare";
import { COMPARISON_INDICATORS, formatComparisonValue } from "./compare-shared";
import { getMunicipality } from "../municipality-registry";
import {
  geocodeMunicipality,
  searchNearbyPlaces,
  type PlaceSummary,
} from "../data-sources-google";

// Re-export shared types and constants for server-side consumers
export {
  PITCH_SECTIONS,
  AMENITY_LABELS,
  generatePitchId,
} from "./pitch-shared";
export type {
  PitchKit,
  PitchKitConfig,
  PitchKitSections,
  PitchMetric,
  PitchOverviewSection,
  PitchWorkforceSection,
  PitchRealEstateSection,
  PitchInfrastructureSection,
  PitchGrowthSection,
  PitchCompetitiveSection,
  PitchAmenitiesSection,
  PitchBenchmarkRow,
  PitchAmenity,
  PitchSectionDef,
  SavedPitchKit,
} from "./pitch-shared";

import type {
  PitchKit,
  PitchKitConfig,
  PitchMetric,
  PitchOverviewSection,
  PitchWorkforceSection,
  PitchRealEstateSection,
  PitchInfrastructureSection,
  PitchGrowthSection,
  PitchCompetitiveSection,
  PitchAmenitiesSection,
  PitchBenchmarkRow,
  PitchAmenity,
} from "./pitch-shared";
import { AMENITY_LABELS } from "./pitch-shared";

// ---------------------------------------------------------------------------
// ProfileMetric → PitchMetric converter
// ---------------------------------------------------------------------------

function toPitchMetric(m: ProfileMetric): PitchMetric {
  return {
    label: m.label,
    value: m.value,
    formatted: m.formatted,
    unit: m.unit,
    period: m.period,
    change: m.change,
    trend: m.trend,
  };
}

function findMetric(metrics: ProfileMetric[], label: string): PitchMetric {
  const m = metrics.find((x) => x.label === label);
  if (m) return toPitchMetric(m);
  return { label, value: null, formatted: "—", unit: "", period: "", trend: [] };
}

// ---------------------------------------------------------------------------
// Narrative generators — auto-generate investor-facing text from data
// ---------------------------------------------------------------------------

function overviewNarrative(s: PitchOverviewSection, name: string): string {
  const parts: string[] = [];
  parts.push(`${name} is a community of ${s.population.formatted} residents`);
  if (s.medianIncome.value) {
    parts.push(`with a median household income of ${s.medianIncome.formatted}`);
  }
  if (s.assessmentBase.value) {
    parts.push(`The total assessment base stands at ${s.assessmentBase.formatted}`);
  }
  if (s.businessCount.value) {
    parts.push(`supporting ${s.businessCount.formatted} active businesses`);
  }
  if (s.population.change) {
    const dir = s.population.change.startsWith("+") ? "growing" : "adjusting";
    parts.push(`The population is ${dir} (${s.population.change} period-over-period)`);
  }
  return parts.join(". ") + ".";
}

function workforceNarrative(s: PitchWorkforceSection, name: string): string {
  const parts: string[] = [];
  if (s.labourForce.value) {
    parts.push(`${name} has a labour force of ${s.labourForce.formatted}`);
  }
  if (s.unemploymentRate.value) {
    parts.push(`with an unemployment rate of ${s.unemploymentRate.formatted}`);
  }
  if (s.avgWeeklyEarnings.value) {
    parts.push(`Average weekly earnings are ${s.avgWeeklyEarnings.formatted}`);
  }
  if (s.k9Enrolment.value || s.hsEnrolment.value) {
    const total = (s.k9Enrolment.value ?? 0) + (s.hsEnrolment.value ?? 0);
    if (total > 0) {
      parts.push(`The education pipeline includes ${total.toLocaleString()} students in K-12`);
    }
  }
  return parts.length > 0 ? parts.join(". ") + "." : `Workforce data for ${name}.`;
}

function realEstateNarrative(s: PitchRealEstateSection, name: string): string {
  const parts: string[] = [];
  if (s.avgSalePrice.value) {
    parts.push(`Average residential sale price in ${name} is ${s.avgSalePrice.formatted}`);
  }
  if (s.vacancyRate.value) {
    parts.push(`with a vacancy rate of ${s.vacancyRate.formatted}`);
  }
  if (s.municipalTaxRate.value) {
    parts.push(`The municipal tax rate is ${s.municipalTaxRate.formatted} mills`);
  }
  if (s.housingStarts.value) {
    parts.push(`Housing starts: ${s.housingStarts.formatted}`);
    if (s.housingStarts.change) {
      parts.push(`(${s.housingStarts.change} change)`);
    }
  }
  return parts.length > 0 ? parts.join(". ") + "." : `Real estate data for ${name}.`;
}

function infrastructureNarrative(s: PitchInfrastructureSection, name: string): string {
  const parts: string[] = [];
  if (s.parcelsTracked.value) {
    parts.push(`${name} has ${s.parcelsTracked.formatted} tracked land parcels`);
  }
  if (s.businessCategories > 0) {
    parts.push(`${s.businessCategories} distinct business categories`);
  }
  if (s.dwellingUnits.value) {
    parts.push(`${s.dwellingUnits.formatted} dwelling units`);
  }
  return parts.length > 0 ? parts.join(". ") + "." : `Infrastructure data for ${name}.`;
}

function growthNarrative(s: PitchGrowthSection, name: string): string {
  const parts: string[] = [];
  if (s.populationTrend.change) {
    const dir = s.populationTrend.change.startsWith("+") ? "growth" : "change";
    parts.push(`${name} shows population ${dir} of ${s.populationTrend.change}`);
  }
  if (s.buildingPermits.value) {
    parts.push(`with ${s.buildingPermits.formatted} building permits issued`);
  }
  if (s.incorporations.value) {
    parts.push(`${s.incorporations.formatted} new business incorporations`);
  }
  if (s.netMigration.value) {
    parts.push(`Net migration: ${s.netMigration.formatted}`);
  }
  return parts.length > 0 ? parts.join(". ") + "." : `Growth trajectory for ${name}.`;
}

function competitiveNarrative(benchmarks: PitchBenchmarkRow[], name: string, peerNames: string[]): string {
  if (benchmarks.length === 0 || peerNames.length === 0) {
    return `Add peer municipalities to see how ${name} compares.`;
  }
  const wins = benchmarks.filter(
    (b) => b.municipalityRaw !== null && b.peerAvgRaw !== null && b.municipalityRaw > b.peerAvgRaw,
  );
  const total = benchmarks.filter((b) => b.municipalityRaw !== null && b.peerAvgRaw !== null).length;
  return `${name} outperforms the peer average on ${wins.length} of ${total} benchmarked indicators compared to ${peerNames.join(", ")}.`;
}

function amenitiesNarrative(amenities: PitchAmenity[], name: string): string {
  const total = amenities.reduce((sum, a) => sum + a.count, 0);
  if (total === 0) return `Amenity data is being gathered for ${name}.`;
  const top = amenities
    .filter((a) => a.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((a) => `${a.count} ${a.label.toLowerCase()}`);
  return `Within a 10 km radius, ${name} offers ${total} key amenities including ${top.join(", ")}.`;
}

// ---------------------------------------------------------------------------
// Amenities fetcher (Google Maps)
// ---------------------------------------------------------------------------

const AMENITY_TYPES = [
  "restaurant",
  "school",
  "hospital",
  "pharmacy",
  "supermarket",
  "gas_station",
  "bank",
  "gym",
  "park",
  "library",
] as const;

async function fetchAmenities(municipalityName: string): Promise<PitchAmenity[]> {
  const geo = await geocodeMunicipality(municipalityName);
  if (!geo) {
    return AMENITY_TYPES.map((type) => ({
      type,
      label: AMENITY_LABELS[type] ?? type,
      count: 0,
      topPlaces: [],
    }));
  }

  const results: PitchAmenity[] = [];

  // Fetch sequentially to respect API rate limits
  for (const type of AMENITY_TYPES) {
    try {
      const places = await searchNearbyPlaces(geo.lat, geo.lng, type, 10000);
      const topPlaces = places
        .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
        .slice(0, 3)
        .map((p) => ({ name: p.name, rating: p.rating }));

      results.push({
        type,
        label: AMENITY_LABELS[type] ?? type,
        count: places.length,
        topPlaces,
      });
    } catch {
      results.push({
        type,
        label: AMENITY_LABELS[type] ?? type,
        count: 0,
        topPlaces: [],
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Competitive benchmarking
// ---------------------------------------------------------------------------

/** Key indicators for investor benchmarking */
const BENCHMARK_INDICATOR_IDS = [
  "population",
  "median-income",
  "unemployment",
  "assessment-base",
  "building-permits",
  "housing-starts",
  "avg-sale-price",
  "vacancy-rate",
  "labour-force",
  "municipal-tax-rate",
];

async function buildBenchmarks(
  municipalitySlug: string,
  peerSlugs: string[],
): Promise<{ benchmarks: PitchBenchmarkRow[]; peerNames: string[] }> {
  if (peerSlugs.length === 0) {
    return { benchmarks: [], peerNames: [] };
  }

  const allSlugs = [municipalitySlug, ...peerSlugs.filter((s) => s !== municipalitySlug)];
  const result = await fetchComparison(allSlugs, BENCHMARK_INDICATOR_IDS);

  const peerNames = result.municipalities
    .filter((m) => m.slug !== municipalitySlug)
    .map((m) => m.name);

  const benchmarks: PitchBenchmarkRow[] = result.indicators.map((ind) => {
    const muniDp = result.data.find(
      (d) => d.municipalitySlug === municipalitySlug && d.indicatorId === ind.id,
    );
    const peerDps = result.data.filter(
      (d) => d.municipalitySlug !== municipalitySlug && d.indicatorId === ind.id,
    );
    const peerValues = peerDps
      .map((d) => d.latestValue)
      .filter((v): v is number => v !== null);
    const peerAvgRaw = peerValues.length > 0
      ? peerValues.reduce((a, b) => a + b, 0) / peerValues.length
      : null;

    return {
      indicator: ind.label,
      municipalityValue: formatComparisonValue(muniDp?.latestValue ?? null, ind.format),
      peerAvg: formatComparisonValue(peerAvgRaw, ind.format),
      municipalityRaw: muniDp?.latestValue ?? null,
      peerAvgRaw,
    };
  });

  return { benchmarks, peerNames };
}

// ---------------------------------------------------------------------------
// Main pitch kit assembler
// ---------------------------------------------------------------------------

export async function buildPitchKit(config: PitchKitConfig): Promise<PitchKit> {
  const muniConfig = getMunicipality(config.municipalitySlug);
  const municipalityName = muniConfig?.name ?? config.municipalityName;

  // Fetch data in parallel: profile + benchmarks + amenities
  const [profile, benchmarkResult, amenities] = await Promise.all([
    buildCommunityProfile(config.municipalitySlug),
    buildBenchmarks(config.municipalitySlug, config.peerSlugs),
    fetchAmenities(municipalityName),
  ]);

  // -- Build sections from profile data --

  const overview: PitchOverviewSection = {
    population: findMetric(profile.sections.overview.metrics, "Population"),
    medianIncome: findMetric(profile.sections.economy.metrics, "Median Household Income"),
    assessmentBase: findMetric(profile.sections.overview.metrics, "Assessment Base"),
    businessCount: findMetric(profile.sections.overview.metrics, "Business Counts"),
    crimeSeverity: findMetric(profile.sections.overview.metrics, "Crime Severity Index"),
    narrative: "",
  };
  overview.narrative = overviewNarrative(overview, municipalityName);

  const workforce: PitchWorkforceSection = {
    labourForce: findMetric(profile.sections.labour.metrics, "Labour Force"),
    unemploymentRate: findMetric(profile.sections.labour.metrics, "Unemployment Rate"),
    avgWeeklyEarnings: findMetric(profile.sections.economy.metrics, "Avg Weekly Earnings"),
    k9Enrolment: findMetric(profile.sections.demographics.metrics, "K-9 Enrolment"),
    hsEnrolment: findMetric(profile.sections.labour.metrics, "High School Enrolment"),
    narrative: "",
  };
  workforce.narrative = workforceNarrative(workforce, municipalityName);

  const realEstate: PitchRealEstateSection = {
    assessmentBase: findMetric(profile.sections.overview.metrics, "Assessment Base"),
    avgSalePrice: findMetric(profile.sections.housing.metrics, "Avg Sale Price"),
    housingStarts: findMetric(profile.sections.housing.metrics, "Housing Starts"),
    vacancyRate: findMetric(profile.sections.housing.metrics, "Vacancy Rate"),
    avgRent: findMetric(profile.sections.housing.metrics, "Average Rent"),
    municipalTaxRate: findMetric(profile.sections.economy.metrics, "Municipal Tax Rate"),
    residentialShare: findMetric(profile.sections.economy.metrics, "Residential Assessment Share"),
    narrative: "",
  };
  realEstate.narrative = realEstateNarrative(realEstate, municipalityName);

  const infraMetrics = profile.sections.infrastructure.metrics;
  const parcelsMetric = infraMetrics.find((m) => m.label === "Parcels Tracked");
  const bizCatCount = infraMetrics.find((m) => m.label === "Business Categories")?.value ?? 0;
  const zoningCount = infraMetrics.find((m) => m.label === "Zoning Districts")?.value ?? 0;

  const infrastructure: PitchInfrastructureSection = {
    parcelsTracked: parcelsMetric ? toPitchMetric(parcelsMetric) : findMetric([], "Parcels Tracked"),
    businessCategories: bizCatCount,
    zoningDistricts: zoningCount,
    dwellingUnits: findMetric(profile.sections.housing.metrics, "Dwelling Units"),
    vehicleRegistrations: { label: "Vehicle Registrations", value: null, formatted: "—", unit: "vehicles", period: "", trend: [] },
    narrative: "",
  };
  infrastructure.narrative = infrastructureNarrative(infrastructure, municipalityName);

  const growth: PitchGrowthSection = {
    populationTrend: findMetric(profile.sections.overview.metrics, "Population"),
    buildingPermits: findMetric(profile.sections.overview.metrics, "Building Permits"),
    incorporations: findMetric(profile.sections.economy.metrics, "Incorporations"),
    netMigration: findMetric(profile.sections.demographics.metrics, "Net Migration"),
    permanentResidents: findMetric(profile.sections.demographics.metrics, "Permanent Residents"),
    narrative: "",
  };
  growth.narrative = growthNarrative(growth, municipalityName);

  const competitive: PitchCompetitiveSection = {
    benchmarks: benchmarkResult.benchmarks,
    peerNames: benchmarkResult.peerNames,
    narrative: competitiveNarrative(benchmarkResult.benchmarks, municipalityName, benchmarkResult.peerNames),
  };

  const amenitiesSection: PitchAmenitiesSection = {
    amenities,
    narrative: amenitiesNarrative(amenities, municipalityName),
  };

  return {
    municipalityName,
    municipalitySlug: config.municipalitySlug,
    region: muniConfig?.region ?? "unknown",
    generatedAt: new Date().toISOString(),
    sections: {
      overview,
      workforce,
      realEstate,
      infrastructure,
      growth,
      competitive,
      amenities: amenitiesSection,
    },
  };
}
