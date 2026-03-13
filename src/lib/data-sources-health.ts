// Alberta Health Data fetchers
// Sources:
//   1. Alberta Regional Dashboard — Life Expectancy, Births and Deaths (municipality-level)
//   2. Alberta Open Data (CKAN) — Leading Causes of Death CSV (province-wide)
//
// All fetchers return empty arrays on error. CSV data cached daily (revalidate: 86400).

import {
  fetchRegionalIndicator,
  type RegionalDataPoint,
} from "@/lib/data-sources-regional";

// ============================================================
// ENDPOINTS
// ============================================================

export const HEALTH_ENDPOINTS = {
  AB_LEADING_CAUSES_OF_DEATH:
    "https://open.alberta.ca/dataset/03339dc5-fb51-4552-97c7-853688fc428d/resource/3e241965-fee3-400e-9652-07cfbf0c0bda/download/deaths-leading-causes.csv",
  // Health Infobase opioid data — endpoint TBD (requires verification)
  // HEALTH_INFOBASE_OPIOIDS: "https://health-infobase.canada.ca/src/data/substance/...",
} as const;

// ============================================================
// TYPES
// ============================================================

export interface LeadingCauseOfDeath {
  year: number;
  cause: string;
  totalDeaths: number;
  ranking: number;
}

export interface LifeExpectancyPoint {
  municipality: string;
  period: string;
  gender: string;
  value: number;
}

export interface BirthDeathPoint {
  municipality: string;
  period: string;
  type: string; // "Births" or "Deaths"
  value: number;
}

// ============================================================
// CSV PARSER
// ============================================================

/**
 * Parses a CSV string into an array of objects.
 * Handles quoted fields containing commas, newlines, and escaped quotes.
 * First row is treated as headers.
 */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        // Check for escaped quote ("")
        if (i + 1 < text.length && text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        // End of quoted field
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

    // Not in quotes
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }

    if (ch === ",") {
      current.push(field.trim());
      field = "";
      i++;
      continue;
    }

    if (ch === "\n" || ch === "\r") {
      current.push(field.trim());
      field = "";
      if (current.length > 1 || current[0] !== "") {
        rows.push(current);
      }
      current = [];
      // Handle \r\n
      if (ch === "\r" && i + 1 < text.length && text[i + 1] === "\n") {
        i++;
      }
      i++;
      continue;
    }

    field += ch;
    i++;
  }

  // Last field / row
  if (field || current.length > 0) {
    current.push(field.trim());
    if (current.length > 1 || current[0] !== "") {
      rows.push(current);
    }
  }

  if (rows.length < 2) return [];

  const headers = rows[0];
  const results: Record<string, string>[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = row[c] ?? "";
    }
    results.push(obj);
  }

  return results;
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Parses a numeric value from a CSV cell, returning 0 for empty/invalid.
 */
function num(val: string | undefined): number {
  if (!val) return 0;
  const cleaned = val.replace(/,/g, "").trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

/**
 * Tries to find a value in a row by checking multiple possible column names.
 */
function col(row: Record<string, string>, ...candidates: string[]): string {
  for (const c of candidates) {
    if (row[c] !== undefined) return row[c];
    const lower = c.toLowerCase();
    for (const key of Object.keys(row)) {
      if (key.toLowerCase() === lower) return row[key];
    }
  }
  return "";
}

// ============================================================
// GENERIC CSV FETCHER
// ============================================================

/**
 * Fetches a CSV endpoint and parses it into an array of objects.
 * Returns empty array on any error.
 */
async function fetchHealthCsv(
  url: string
): Promise<Record<string, string>[]> {
  try {
    const res = await fetch(url, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) {
      console.error(`[health] CSV fetch failed: ${res.status} ${res.statusText} — ${url}`);
      return [];
    }
    const text = await res.text();
    return parseCsv(text);
  } catch (err) {
    console.error(`[health] CSV fetch error for ${url}:`, err);
    return [];
  }
}

// ============================================================
// FETCHERS
// ============================================================

/**
 * Fetches leading causes of death in Alberta from Alberta Open Data CKAN.
 * Province-wide, annual, top 30 causes, 2001-2022.
 */
export async function fetchLeadingCausesOfDeath(): Promise<LeadingCauseOfDeath[]> {
  const rows = await fetchHealthCsv(HEALTH_ENDPOINTS.AB_LEADING_CAUSES_OF_DEATH);
  if (rows.length === 0) return [];

  const results: LeadingCauseOfDeath[] = [];

  for (const row of rows) {
    const year = num(col(row, "Calendar Year", "Year", "calendar year", "year"));
    const cause = col(row, "Cause", "Cause of Death", "cause", "cause of death");
    const totalDeaths = num(col(row, "Total Deaths", "Total deaths", "total deaths", "Count", "Deaths"));
    const ranking = num(col(row, "Ranking", "ranking", "Rank", "rank"));

    if (year > 0 && cause) {
      results.push({ year, cause, totalDeaths, ranking });
    }
  }

  return results;
}

/**
 * Fetches life expectancy data from the Alberta Regional Dashboard.
 * Returns data for all municipalities, or filtered to one if specified.
 */
export async function fetchLifeExpectancy(
  municipality?: string
): Promise<LifeExpectancyPoint[]> {
  const data = await fetchRegionalIndicator("Life Expectancy");
  if (data.length === 0) return [];

  let filtered: RegionalDataPoint[] = data;
  if (municipality) {
    const target = municipality.toLowerCase();
    filtered = data.filter((pt) => pt.municipality.toLowerCase() === target);
  }

  return filtered.map((pt) => {
    // Dimensions typically include gender (Male/Female/Both Sexes)
    const gender =
      pt.dimensions.find(
        (d) => d.name.toLowerCase() === "sex" || d.name.toLowerCase() === "gender"
      )?.value ?? "Both Sexes";

    return {
      municipality: pt.municipality,
      period: pt.period,
      gender,
      value: pt.value,
    };
  });
}

/**
 * Fetches births and deaths data from the Alberta Regional Dashboard.
 * Returns data for all municipalities, or filtered to one if specified.
 */
export async function fetchBirthsAndDeaths(
  municipality?: string
): Promise<BirthDeathPoint[]> {
  const data = await fetchRegionalIndicator("Births and Deaths");
  if (data.length === 0) return [];

  let filtered: RegionalDataPoint[] = data;
  if (municipality) {
    const target = municipality.toLowerCase();
    filtered = data.filter((pt) => pt.municipality.toLowerCase() === target);
  }

  return filtered.map((pt) => {
    // Dimensions typically include type (Births/Deaths)
    const type =
      pt.dimensions.find(
        (d) =>
          d.name.toLowerCase() === "type" ||
          d.name.toLowerCase() === "vital statistics" ||
          d.name.toLowerCase() === "vital event"
      )?.value ?? "Unknown";

    return {
      municipality: pt.municipality,
      period: pt.period,
      type,
      value: pt.value,
    };
  });
}
