/**
 * EDO Peer Comparison — Shared types, constants, and formatters.
 * Safe to import from both client and server components.
 */

import {
  REGION_LABELS,
  type MunicipalityRegion,
} from "../municipality-registry";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComparisonIndicator {
  id: string;
  label: string;
  category: ComparisonCategory;
  unit: string;
  format: "number" | "currency" | "percent" | "rate";
  /** regionaldashboard.alberta.ca indicator name */
  regionalKey: string;
}

export type ComparisonCategory =
  | "overview"
  | "economy"
  | "demographics"
  | "housing"
  | "labour"
  | "infrastructure";

export interface MunicipalityComparison {
  slug: string;
  name: string;
  region: MunicipalityRegion;
  color: string;
}

export interface ComparisonDataPoint {
  municipalitySlug: string;
  municipalityName: string;
  indicatorId: string;
  latestValue: number | null;
  latestPeriod: string;
  change: string | null;
  trend: { date: string; value: number }[];
}

export interface ComparisonResult {
  municipalities: MunicipalityComparison[];
  indicators: ComparisonIndicator[];
  data: ComparisonDataPoint[];
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Indicator catalogue — curated set suitable for comparison
// ---------------------------------------------------------------------------

export const COMPARISON_INDICATORS: ComparisonIndicator[] = [
  // Overview
  { id: "population", label: "Population", category: "overview", unit: "people", format: "number", regionalKey: "Population" },
  { id: "assessment-base", label: "Assessment Base", category: "overview", unit: "$", format: "currency", regionalKey: "Assessment Base" },
  { id: "building-permits", label: "Building Permits", category: "overview", unit: "permits", format: "number", regionalKey: "Building Permits" },
  { id: "business-counts", label: "Business Counts", category: "overview", unit: "businesses", format: "number", regionalKey: "Business Counts" },
  { id: "crime-severity", label: "Crime Severity Index", category: "overview", unit: "index", format: "number", regionalKey: "Crime Severity Index" },

  // Economy
  { id: "median-income", label: "Median Household Income", category: "economy", unit: "$", format: "currency", regionalKey: "Median Household Income" },
  { id: "avg-weekly-earnings", label: "Avg Weekly Earnings", category: "economy", unit: "$", format: "currency", regionalKey: "Average Weekly Earnings" },
  { id: "incorporations", label: "Incorporations", category: "economy", unit: "new businesses", format: "number", regionalKey: "Incorporations" },
  { id: "municipal-tax-rate", label: "Municipal Tax Rate", category: "economy", unit: "mills", format: "rate", regionalKey: "Municipal Tax Rates" },
  { id: "bankruptcies", label: "Bankruptcies", category: "economy", unit: "filings", format: "number", regionalKey: "Bankruptcies" },

  // Demographics
  { id: "net-migration", label: "Net Migration", category: "demographics", unit: "people", format: "number", regionalKey: "Net Migration" },
  { id: "permanent-residents", label: "Permanent Resident Landings", category: "demographics", unit: "landings", format: "number", regionalKey: "Permanent Resident Landings" },
  { id: "life-expectancy", label: "Life Expectancy", category: "demographics", unit: "years", format: "number", regionalKey: "Life Expectancy" },
  { id: "k9-enrolment", label: "K-9 Enrolment", category: "demographics", unit: "students", format: "number", regionalKey: "K - 9 Enrollments" },
  { id: "hs-enrolment", label: "High School Enrolment", category: "demographics", unit: "students", format: "number", regionalKey: "High School Enrollments" },

  // Housing
  { id: "housing-starts", label: "Housing Starts", category: "housing", unit: "starts", format: "number", regionalKey: "Housing Starts" },
  { id: "avg-rent", label: "Average Rent", category: "housing", unit: "$/month", format: "currency", regionalKey: "Average Rent" },
  { id: "avg-sale-price", label: "Avg Residential Sale Price", category: "housing", unit: "$", format: "currency", regionalKey: "Average Residential Sale Price" },
  { id: "vacancy-rate", label: "Vacancy Rate", category: "housing", unit: "%", format: "percent", regionalKey: "Vacancy Rates" },
  { id: "dwelling-units", label: "Dwelling Units", category: "housing", unit: "units", format: "number", regionalKey: "Dwelling Units" },

  // Labour
  { id: "unemployment", label: "Unemployment Rate", category: "labour", unit: "%", format: "percent", regionalKey: "Unemployment Rate" },
  { id: "labour-force", label: "Labour Force", category: "labour", unit: "people", format: "number", regionalKey: "Labour Force" },
  { id: "ei-beneficiaries", label: "EI Beneficiaries", category: "labour", unit: "people", format: "number", regionalKey: "Employment Insurance Beneficiaries" },

  // Infrastructure
  { id: "ghg-emissions", label: "GHG Emissions", category: "infrastructure", unit: "tonnes CO₂e", format: "number", regionalKey: "Greenhouse Gas Emissions" },
  { id: "vehicle-registrations", label: "Vehicle Registrations", category: "infrastructure", unit: "vehicles", format: "number", regionalKey: "Motorized Vehicle Registrations" },
  { id: "well-count", label: "Well Count", category: "infrastructure", unit: "wells", format: "number", regionalKey: "Well Count" },
];

export const COMPARISON_CATEGORIES: { id: ComparisonCategory; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "economy", label: "Economy" },
  { id: "demographics", label: "Demographics" },
  { id: "housing", label: "Housing" },
  { id: "labour", label: "Labour" },
  { id: "infrastructure", label: "Infrastructure" },
];

export const DEFAULT_INDICATOR_IDS = [
  "population",
  "assessment-base",
  "building-permits",
  "unemployment",
  "median-income",
  "housing-starts",
];

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

export function formatComparisonValue(value: number | null, format: ComparisonIndicator["format"]): string {
  if (value === null || value === undefined) return "—";
  switch (format) {
    case "currency":
      if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
      if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
      if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
      return `$${value.toLocaleString()}`;
    case "percent":
      return `${value.toFixed(1)}%`;
    case "rate":
      return value.toFixed(2);
    default:
      if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
      if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
      if (Number.isInteger(value)) return value.toLocaleString();
      return value.toFixed(1);
  }
}

export function getMunicipalityRegionLabel(region: MunicipalityRegion): string {
  return REGION_LABELS[region];
}
