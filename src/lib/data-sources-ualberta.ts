// University of Alberta Open Data Centre for Alberta Urban Real Estate
// https://realestatedata.srv.ualberta.ca/
// Neighbourhood-level property assessment data for Edmonton and Calgary

// ============================================================
// Endpoints — direct CSV downloads
// ============================================================

export const UALBERTA_ENDPOINTS = {
  EDMONTON_ASSESSMENT: "https://realestatedata.srv.ualberta.ca/download-file/2409/",
  CALGARY_ASSESSMENT: "https://realestatedata.srv.ualberta.ca/download-file/2412/",
  EDMONTON_CENSUS: "https://realestatedata.srv.ualberta.ca/download-file/2007/",
  CALGARY_CENSUS: "https://realestatedata.srv.ualberta.ca/download-file/2039/",
  EDMONTON_CRIME: "https://realestatedata.srv.ualberta.ca/download-file/2397/",
  CALGARY_CRIME: "https://realestatedata.srv.ualberta.ca/download-file/2400/",
  EDMONTON_TRANSIT: "https://realestatedata.srv.ualberta.ca/download-file/2403/",
  CALGARY_TRANSIT: "https://realestatedata.srv.ualberta.ca/download-file/2406/",
  EDMONTON_COMMUNITY_SERVICES: "https://realestatedata.srv.ualberta.ca/download-file/2384/",
  CALGARY_COMMUNITY_SERVICES: "https://realestatedata.srv.ualberta.ca/download-file/2386/",
} as const;

// ============================================================
// Types
// ============================================================

export interface NeighbourhoodAssessment {
  city: "Edmonton" | "Calgary";
  neighbourhood: string;
  year: number;
  avgAssessment: number;
  medianAssessment: number;
  propertyCount: number;
  avgLotSize: number;
  avgYearBuilt: number;
}

export interface AssessmentTrend {
  year: number;
  edmonton: number;
  calgary: number;
}

// ============================================================
// CSV Fetcher
// ============================================================

async function fetchCSV(url: string): Promise<Record<string, string>[]> {
  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) {
      console.error(`UAlberta CSV fetch failed: ${res.status} for ${url}`);
      return [];
    }
    const text = await res.text();
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0]);
    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const row: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) {
        row[headers[j].trim()] = (values[j] || "").trim();
      }
      rows.push(row);
    }
    return rows;
  } catch (err) {
    console.error(`UAlberta CSV fetch error:`, err);
    return [];
  }
}

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

// Case-insensitive column lookup
function col(row: Record<string, string>, ...names: string[]): string {
  for (const name of names) {
    if (row[name] !== undefined) return row[name];
    const lower = name.toLowerCase();
    for (const key of Object.keys(row)) {
      if (key.toLowerCase() === lower) return row[key];
    }
  }
  return "";
}

function num(val: string): number {
  const n = parseFloat(val.replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

// ============================================================
// Fetchers
// ============================================================

export async function fetchNeighbourhoodAssessments(
  city: "Edmonton" | "Calgary"
): Promise<NeighbourhoodAssessment[]> {
  const url =
    city === "Edmonton"
      ? UALBERTA_ENDPOINTS.EDMONTON_ASSESSMENT
      : UALBERTA_ENDPOINTS.CALGARY_ASSESSMENT;

  const rows = await fetchCSV(url);
  if (rows.length === 0) return [];

  if (city === "Edmonton") {
    // Edmonton CSV columns: neighbourhoodname, neighbourhoodnumber, year, value, sdassessedvalue,
    // median_yearbuilt, pct_with_unit, avg_assessvalue_without_unit, avg_lotsize, nos_avall_public, Type
    // Type = "Average assessment value" or "Median assessment value"
    const avgRows = rows.filter((r) => col(r, "Type").includes("Average"));
    return avgRows
      .map((row) => ({
        city,
        neighbourhood: col(row, "neighbourhoodname"),
        year: num(col(row, "year")),
        avgAssessment: num(col(row, "value")),
        medianAssessment: 0,
        propertyCount: num(col(row, "nos_avall_public")),
        avgLotSize: num(col(row, "avg_lotsize")),
        avgYearBuilt: num(col(row, "median_yearbuilt")),
      }))
      .filter((a) => a.neighbourhood && a.year > 0);
  } else {
    // Calgary CSV columns: comm_code, sub_property_use, value, Measure, land_size_sm,
    // sd_assess, year_of_construction, num_properties, description, year
    // Measure = "Average assessment value" etc.
    const avgRows = rows.filter((r) => col(r, "Measure").includes("Average"));
    return avgRows
      .map((row) => ({
        city,
        neighbourhood: col(row, "comm_code"),
        year: num(col(row, "year")),
        avgAssessment: num(col(row, "value")),
        medianAssessment: 0,
        propertyCount: num(col(row, "num_properties")),
        avgLotSize: num(col(row, "land_size_sm")),
        avgYearBuilt: num(col(row, "year_of_construction")),
      }))
      .filter((a) => a.neighbourhood && a.year > 0 && a.avgAssessment > 0);
  }
}

export async function fetchCityAssessmentTrend(): Promise<AssessmentTrend[]> {
  const [edm, cal] = await Promise.all([
    fetchNeighbourhoodAssessments("Edmonton"),
    fetchNeighbourhoodAssessments("Calgary"),
  ]);

  // Aggregate to city-wide average per year
  const edmByYear = new Map<number, { sum: number; count: number }>();
  const calByYear = new Map<number, { sum: number; count: number }>();

  for (const a of edm) {
    if (a.avgAssessment <= 0) continue;
    const ex = edmByYear.get(a.year) || { sum: 0, count: 0 };
    ex.sum += a.avgAssessment * a.propertyCount;
    ex.count += a.propertyCount;
    edmByYear.set(a.year, ex);
  }
  for (const a of cal) {
    if (a.avgAssessment <= 0) continue;
    const ex = calByYear.get(a.year) || { sum: 0, count: 0 };
    ex.sum += a.avgAssessment * a.propertyCount;
    ex.count += a.propertyCount;
    calByYear.set(a.year, ex);
  }

  const years = new Set([...edmByYear.keys(), ...calByYear.keys()]);
  return Array.from(years)
    .sort()
    .map((year) => ({
      year,
      edmonton: edmByYear.has(year) ? Math.round(edmByYear.get(year)!.sum / edmByYear.get(year)!.count) : 0,
      calgary: calByYear.has(year) ? Math.round(calByYear.get(year)!.sum / calByYear.get(year)!.count) : 0,
    }));
}

export async function fetchTopNeighbourhoodsByAssessment(
  city: "Edmonton" | "Calgary",
  year?: number,
  limit: number = 20
): Promise<NeighbourhoodAssessment[]> {
  const data = await fetchNeighbourhoodAssessments(city);
  const targetYear = year || Math.max(...data.map((d) => d.year));
  return data
    .filter((d) => d.year === targetYear && d.avgAssessment > 0)
    .sort((a, b) => b.avgAssessment - a.avgAssessment)
    .slice(0, limit);
}
