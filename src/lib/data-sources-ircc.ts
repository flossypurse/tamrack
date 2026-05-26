// IRCC (Immigration, Refugees and Citizenship Canada) data sources
// IRCC publishes tab-separated values (.csv extension is misleading).
// All direct downloads, no authentication required.

import { fetchCSV } from "./csv-utils";

// IRCC files use 3-letter English month abbreviations in EN_MONTH.
const MONTH_NAME_TO_NUM: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

function parseMonth(s: string): number {
  if (!s) return 0;
  const key = s.slice(0, 3);
  return MONTH_NAME_TO_NUM[key] ?? (parseInt(s, 10) || 0);
}

// IRCC uses "--" to indicate suppressed values (cells < 5 for privacy).
function parseCount(s: string): number {
  if (!s || s === "--") return 0;
  return parseInt(s, 10) || 0;
}

export const IRCC_ENDPOINTS = {
  PR_BY_PROVINCE_CATEGORY: "https://www.ircc.canada.ca/opendata-donneesouvertes/data/ODP-PR-PT_IMMCAT.csv",
  PR_BY_PROVINCE_CMA: "https://www.ircc.canada.ca/opendata-donneesouvertes/data/ODP-PR-PT_CMA.csv",
  PR_BY_AGE_GROUP: "https://www.ircc.canada.ca/opendata-donneesouvertes/data/ODP-PR-AgeGroup.csv",
  PR_BY_OCCUPATION: "https://www.ircc.canada.ca/opendata-donneesouvertes/data/ODP-PR-PT_NOC4.csv",
  PR_BY_CENSUS_SUBDIVISION: "https://www.ircc.canada.ca/opendata-donneesouvertes/data/ODP-PR-CSD.csv",
} as const;

// ============================================================
// Interfaces
// ============================================================

export interface ImmigrationRecord {
  year: number;
  month: number;
  province: string;
  category: string;
  count: number;
}

export interface OccupationRecord {
  year: number;
  month: number;
  province: string;
  occupation: string;
  occupationCode: string;
  count: number;
}

export interface TimeSeriesPoint {
  year: number;
  value: number;
}

// ============================================================
// Fetchers
// ============================================================

/**
 * Permanent residents by province and immigration category.
 * Defaults to Alberta.
 */
export async function fetchImmigrationByCategory(
  province: string = "Alberta"
): Promise<ImmigrationRecord[]> {
  const rows = await fetchCSV(IRCC_ENDPOINTS.PR_BY_PROVINCE_CATEGORY, {
    delimiter: "\t",
  });
  return rows
    .filter((r) =>
      (r["EN_PROVINCE_TERRITORY"] ?? "")
        .toLowerCase()
        .includes(province.toLowerCase())
    )
    .map((r) => ({
      year: parseInt(r["EN_YEAR"] ?? "0", 10) || 0,
      month: parseMonth(r["EN_MONTH"] ?? ""),
      province: r["EN_PROVINCE_TERRITORY"] ?? "",
      // Prefer the most specific level available, falling back to broader category names.
      category:
        r["EN_IMMIGRATION_CATEGORY-COMPONENT"] ||
        r["EN_IMMIGRATION_CATEGORY-GROUP"] ||
        r["EN_IMMIGRATION_CATEGORY-MAIN_CATEGORY"] ||
        "",
      count: parseCount(r["TOTAL"] ?? ""),
    }));
}

/**
 * Permanent residents by Census Metropolitan Area.
 * Filter by CMA name (e.g., "Edmonton", "Calgary").
 */
export async function fetchImmigrationByCMA(
  cma: string = "Edmonton"
): Promise<ImmigrationRecord[]> {
  const rows = await fetchCSV(IRCC_ENDPOINTS.PR_BY_PROVINCE_CMA, {
    delimiter: "\t",
  });
  return rows
    .filter((r) =>
      (r["EN_CENSUS_METROPOLITAN_AREA"] ?? "")
        .toLowerCase()
        .includes(cma.toLowerCase())
    )
    .map((r) => ({
      year: parseInt(r["EN_YEAR"] ?? "0", 10) || 0,
      month: parseMonth(r["EN_MONTH"] ?? ""),
      province: r["EN_PROVINCE_TERRITORY"] ?? "",
      category: r["EN_CENSUS_METROPOLITAN_AREA"] ?? "",
      count: parseCount(r["TOTAL"] ?? ""),
    }));
}

/**
 * Permanent residents by occupation (NOC code).
 * Defaults to Alberta.
 *
 * Note: the NOC file uses `EN_PROVINCE/TERRITORY` (with a slash) as the
 * column header. The `EN_OCCUPATION` field encodes both NOC code and
 * description as a single string like `"0013 - Senior managers - ..."`.
 */
export async function fetchImmigrationByOccupation(
  province: string = "Alberta"
): Promise<OccupationRecord[]> {
  const rows = await fetchCSV(IRCC_ENDPOINTS.PR_BY_OCCUPATION, {
    delimiter: "\t",
  });
  return rows
    .filter((r) =>
      (r["EN_PROVINCE/TERRITORY"] ?? "")
        .toLowerCase()
        .includes(province.toLowerCase())
    )
    .map((r) => {
      const occ = r["EN_OCCUPATION"] ?? "";
      // Split "0013 - Senior managers ..." into code + description.
      const match = occ.match(/^(\S+)\s*-\s*(.*)$/);
      return {
        year: parseInt(r["EN_YEAR"] ?? "0", 10) || 0,
        month: parseMonth(r["EN_MONTH"] ?? ""),
        province: r["EN_PROVINCE/TERRITORY"] ?? "",
        occupation: match ? match[2] : occ,
        occupationCode: match ? match[1] : "",
        count: parseCount(r["TOTAL"] ?? ""),
      };
    });
}

/**
 * Total PR landings by year for a province.
 * Aggregates monthly data from the category endpoint into annual totals.
 * Defaults to Alberta.
 */
export async function fetchImmigrationTimeSeries(
  province: string = "Alberta"
): Promise<TimeSeriesPoint[]> {
  const records = await fetchImmigrationByCategory(province);
  const byYear = new Map<number, number>();

  for (const rec of records) {
    if (rec.year > 0) {
      byYear.set(rec.year, (byYear.get(rec.year) ?? 0) + rec.count);
    }
  }

  return Array.from(byYear.entries())
    .map(([year, value]) => ({ year, value }))
    .sort((a, b) => a.year - b.year);
}
