// IRCC (Immigration, Refugees and Citizenship Canada) data sources
// All direct CSV downloads, no authentication required

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
// Generic CSV fetcher
// ============================================================

async function fetchCSV(url: string): Promise<Record<string, string>[]> {
  try {
    const res = await fetch(url, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) {
      console.error(`IRCC CSV fetch failed: ${res.status} ${res.statusText} for ${url}`);
      return [];
    }
    const text = await res.text();
    const lines = text.split("\n").filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0]);
    const rows: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const row: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) {
        row[headers[j].trim()] = (values[j] ?? "").trim();
      }
      rows.push(row);
    }
    return rows;
  } catch (err) {
    console.error(`IRCC CSV fetch error for ${url}:`, err);
    return [];
  }
}

/** Parse a single CSV line, handling quoted fields with commas */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
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
  const rows = await fetchCSV(IRCC_ENDPOINTS.PR_BY_PROVINCE_CATEGORY);
  return rows
    .filter((r) => {
      const prov = r["Province/Territory of Intended Destination"] ?? r["Province"] ?? "";
      return prov.toLowerCase().includes(province.toLowerCase());
    })
    .map((r) => ({
      year: parseInt(r["Year"] ?? r["YEAR"] ?? "0", 10),
      month: parseInt(r["Month"] ?? r["MONTH"] ?? "0", 10),
      province: r["Province/Territory of Intended Destination"] ?? r["Province"] ?? "",
      category: r["Immigration Category"] ?? r["IMMCAT"] ?? "",
      count: parseInt(r["Count"] ?? r["VALUE"] ?? r["Persons"] ?? "0", 10) || 0,
    }));
}

/**
 * Permanent residents by Census Metropolitan Area.
 * Filter by CMA name (e.g., "Edmonton", "Calgary").
 */
export async function fetchImmigrationByCMA(
  cma: string = "Edmonton"
): Promise<ImmigrationRecord[]> {
  const rows = await fetchCSV(IRCC_ENDPOINTS.PR_BY_PROVINCE_CMA);
  return rows
    .filter((r) => {
      const cmaField = r["CMA"] ?? r["Census Metropolitan Area"] ?? "";
      return cmaField.toLowerCase().includes(cma.toLowerCase());
    })
    .map((r) => ({
      year: parseInt(r["Year"] ?? r["YEAR"] ?? "0", 10),
      month: parseInt(r["Month"] ?? r["MONTH"] ?? "0", 10),
      province: r["Province/Territory of Intended Destination"] ?? r["Province"] ?? "",
      category: r["CMA"] ?? r["Census Metropolitan Area"] ?? "",
      count: parseInt(r["Count"] ?? r["VALUE"] ?? r["Persons"] ?? "0", 10) || 0,
    }));
}

/**
 * Permanent residents by occupation (NOC code).
 * Defaults to Alberta.
 */
export async function fetchImmigrationByOccupation(
  province: string = "Alberta"
): Promise<OccupationRecord[]> {
  const rows = await fetchCSV(IRCC_ENDPOINTS.PR_BY_OCCUPATION);
  return rows
    .filter((r) => {
      const prov = r["Province/Territory of Intended Destination"] ?? r["Province"] ?? "";
      return prov.toLowerCase().includes(province.toLowerCase());
    })
    .map((r) => ({
      year: parseInt(r["Year"] ?? r["YEAR"] ?? "0", 10),
      month: parseInt(r["Month"] ?? r["MONTH"] ?? "0", 10),
      province: r["Province/Territory of Intended Destination"] ?? r["Province"] ?? "",
      occupation: r["NOC 4 Description"] ?? r["Occupation"] ?? "",
      occupationCode: r["NOC 4"] ?? r["NOC"] ?? "",
      count: parseInt(r["Count"] ?? r["VALUE"] ?? r["Persons"] ?? "0", 10) || 0,
    }));
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
