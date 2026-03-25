/**
 * EDO Investment Pitch Kit — Shared types, constants, and helpers.
 * Safe to import from both client and server components.
 * Follows the compare-shared.ts / reports-shared.ts pattern to avoid pg/tls client bundle issues.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PitchKitConfig {
  municipalitySlug: string;
  municipalityName: string;
  /** Optional peer slugs for competitive positioning section */
  peerSlugs: string[];
}

export interface PitchKit {
  municipalityName: string;
  municipalitySlug: string;
  region: string;
  generatedAt: string;
  sections: PitchKitSections;
}

export interface PitchKitSections {
  overview: PitchOverviewSection;
  workforce: PitchWorkforceSection;
  realEstate: PitchRealEstateSection;
  infrastructure: PitchInfrastructureSection;
  growth: PitchGrowthSection;
  competitive: PitchCompetitiveSection;
  amenities: PitchAmenitiesSection;
}

// -- Section types --

export interface PitchMetric {
  label: string;
  value: number | null;
  formatted: string;
  unit: string;
  period: string;
  change?: string;
  trend: { date: string; value: number }[];
}

export interface PitchOverviewSection {
  population: PitchMetric;
  medianIncome: PitchMetric;
  assessmentBase: PitchMetric;
  businessCount: PitchMetric;
  crimeSeverity: PitchMetric;
  narrative: string;
}

export interface PitchWorkforceSection {
  labourForce: PitchMetric;
  unemploymentRate: PitchMetric;
  avgWeeklyEarnings: PitchMetric;
  k9Enrolment: PitchMetric;
  hsEnrolment: PitchMetric;
  narrative: string;
}

export interface PitchRealEstateSection {
  assessmentBase: PitchMetric;
  avgSalePrice: PitchMetric;
  housingStarts: PitchMetric;
  vacancyRate: PitchMetric;
  avgRent: PitchMetric;
  municipalTaxRate: PitchMetric;
  residentialShare: PitchMetric;
  narrative: string;
}

export interface PitchInfrastructureSection {
  parcelsTracked: PitchMetric;
  businessCategories: number;
  zoningDistricts: number;
  dwellingUnits: PitchMetric;
  vehicleRegistrations: PitchMetric;
  narrative: string;
}

export interface PitchGrowthSection {
  populationTrend: PitchMetric;
  buildingPermits: PitchMetric;
  incorporations: PitchMetric;
  netMigration: PitchMetric;
  permanentResidents: PitchMetric;
  narrative: string;
}

export interface PitchCompetitiveSection {
  /** Benchmarks vs peers/province. Each row: indicator, municipality value, peer avg, provincial avg */
  benchmarks: PitchBenchmarkRow[];
  peerNames: string[];
  narrative: string;
}

export interface PitchBenchmarkRow {
  indicator: string;
  municipalityValue: string;
  peerAvg: string;
  municipalityRaw: number | null;
  peerAvgRaw: number | null;
}

export interface PitchAmenitiesSection {
  amenities: PitchAmenity[];
  narrative: string;
}

export interface PitchAmenity {
  type: string;
  label: string;
  count: number;
  topPlaces: { name: string; rating?: number }[];
}

// ---------------------------------------------------------------------------
// Pitch section definitions (for rendering order)
// ---------------------------------------------------------------------------

export interface PitchSectionDef {
  id: keyof PitchKitSections;
  title: string;
  icon: string; // lucide icon name
  description: string;
}

export const PITCH_SECTIONS: PitchSectionDef[] = [
  { id: "overview", title: "Community Overview", icon: "Building2", description: "Population, income, economy at a glance" },
  { id: "workforce", title: "Workforce & Talent", icon: "Users", description: "Labour force, earnings, education pipeline" },
  { id: "realEstate", title: "Real Estate & Land", icon: "Home", description: "Assessments, pricing, vacancy, tax rates" },
  { id: "infrastructure", title: "Infrastructure & Connectivity", icon: "Network", description: "Parcels, zoning, transportation access" },
  { id: "growth", title: "Growth Story", icon: "TrendingUp", description: "Population, permits, migration, business formation" },
  { id: "competitive", title: "Competitive Position", icon: "Target", description: "Benchmarks vs peers and provincial averages" },
  { id: "amenities", title: "Nearby Amenities", icon: "MapPin", description: "Schools, hospitals, restaurants, parks, services" },
];

// ---------------------------------------------------------------------------
// Amenity type labels
// ---------------------------------------------------------------------------

export const AMENITY_LABELS: Record<string, string> = {
  restaurant: "Restaurants",
  school: "Schools",
  hospital: "Hospitals",
  pharmacy: "Pharmacies",
  supermarket: "Supermarkets",
  gas_station: "Gas Stations",
  bank: "Banks",
  gym: "Gyms & Fitness",
  park: "Parks",
  library: "Libraries",
};

// ---------------------------------------------------------------------------
// localStorage helpers for pitch kit history
// ---------------------------------------------------------------------------

const STORAGE_KEY = "edo-pitch-history";
const MAX_PITCHES = 10;

export interface SavedPitchKit {
  id: string;
  config: PitchKitConfig;
  generatedAt: string;
  data: PitchKit;
}

export function generatePitchId(): string {
  return `pitch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function loadPitchHistory(): SavedPitchKit[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedPitchKit[];
  } catch {
    return [];
  }
}

export function savePitchKit(pitch: SavedPitchKit): void {
  if (typeof window === "undefined") return;
  const history = loadPitchHistory();
  history.unshift(pitch);
  const trimmed = history.slice(0, MAX_PITCHES);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export function deletePitchKit(pitchId: string): void {
  if (typeof window === "undefined") return;
  const history = loadPitchHistory();
  const filtered = history.filter((p) => p.id !== pitchId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}
