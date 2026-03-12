// Canada Energy Regulator (CER) open data fetchers
// All endpoints are direct CSV downloads at https://www.cer-rec.gc.ca/open/
// No authentication required

// ============================================================
// ENDPOINTS
// ============================================================

export const CER_ENDPOINTS = {
  // Pipeline throughput and capacity
  NGTL_THROUGHPUT:
    "https://www.cer-rec.gc.ca/open/energy/throughput-capacity/ngtl-throughput-and-capacity.csv",
  TRANS_MOUNTAIN_THROUGHPUT:
    "https://www.cer-rec.gc.ca/open/energy/throughput-capacity/trans-mountain-throughput-and-capacity.csv",
  KEYSTONE_THROUGHPUT:
    "https://www.cer-rec.gc.ca/open/energy/throughput-capacity/keystone-throughput-and-capacity.csv",
  ENBRIDGE_MAINLINE_THROUGHPUT:
    "https://www.cer-rec.gc.ca/open/energy/throughput-capacity/enbridge-mainline-throughput-and-capacity.csv",
  ALLIANCE_THROUGHPUT:
    "https://www.cer-rec.gc.ca/open/energy/throughput-capacity/alliance-throughput-and-capacity.csv",
  FOOTHILLS_THROUGHPUT:
    "https://www.cer-rec.gc.ca/open/energy/throughput-capacity/foothills-throughput-and-capacity.csv",
  APPORTIONMENT:
    "https://www.cer-rec.gc.ca/open/energy/throughput-capacity/apportionment.csv",

  // Production
  CRUDE_OIL_PRODUCTION:
    "https://www.cer-rec.gc.ca/open/energy/estimated-monthly-production-of-crude-oil-by-province.csv",
  NATURAL_GAS_PRODUCTION:
    "https://www.cer-rec.gc.ca/open/energy/historical-canadian-provincial-marketable-natural-gas-production.csv",

  // Exports & imports
  CRUDE_EXPORTS_RAIL:
    "https://www.cer-rec.gc.ca/open/energy/canadian-crude-oil-exports-rail-monthly.csv",
  CRUDE_EXPORTS_DESTINATION:
    "https://www.cer-rec.gc.ca/open/imports-exports/crude-oil-exports-by-destination-annual.csv",
  NATURAL_GAS_EXPORTS:
    "https://www.cer-rec.gc.ca/open/imports-exports/natural-gas-exports-annual.csv",
  CRUDE_RUNS_WEEKLY:
    "https://www.cer-rec.gc.ca/open/imports-exports/crude-runs-weekly.csv",

  // Safety
  PIPELINE_INCIDENTS:
    "https://www.cer-rec.gc.ca/open/incident/pipeline-incidents-data.csv",

  // Financial
  PIPELINE_FINANCIALS:
    "https://www.cer-rec.gc.ca/open/energy/pipeline-financials.csv",
} as const;

export type CEREndpointKey = keyof typeof CER_ENDPOINTS;

// ============================================================
// TYPES
// ============================================================

export interface PipelineThroughputPoint {
  date: string; // YYYY-MM or YYYY-MM-DD
  pipeline: string;
  keyPoint: string;
  product: string;
  throughput: number; // thousand barrels/day or million cubic metres/day
  capacity: number;
  utilization: number; // 0–1 ratio (throughput / capacity)
  unit: string;
}

export interface ProductionPoint {
  date: string; // YYYY-MM
  province: string;
  product: string;
  volume: number;
  unit: string;
}

export interface PipelineIncident {
  incidentNumber: string;
  date: string;
  pipeline: string;
  company: string;
  province: string;
  nearestPopulatedCentre: string;
  substance: string;
  significantIncident: boolean;
  releaseType: string;
  status: string;
  whatHappened: string;
  whyItHappened: string;
  volumeReleased: number;
  volumeRecovered: number;
  unit: string;
}

export interface ApportionmentPoint {
  date: string; // YYYY-MM
  pipeline: string;
  originalNominations: number;
  acceptedNominations: number;
  apportionmentPercent: number; // 0–100
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
// GENERIC CSV FETCHER
// ============================================================

/**
 * Fetches a CER CSV endpoint and parses it into an array of objects.
 * Returns empty array on any error (network, parse, etc).
 */
export async function fetchCERCsv(
  url: string
): Promise<Record<string, string>[]> {
  try {
    const res = await fetch(url, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) {
      console.error(`CER fetch failed: ${res.status} ${res.statusText} — ${url}`);
      return [];
    }
    const text = await res.text();
    return parseCsv(text);
  } catch (err) {
    console.error(`CER fetch error for ${url}:`, err);
    return [];
  }
}

// ============================================================
// SPECIALIZED FETCHERS
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
 * CER CSVs use inconsistent naming across datasets.
 */
function col(row: Record<string, string>, ...candidates: string[]): string {
  for (const c of candidates) {
    // Exact match
    if (row[c] !== undefined) return row[c];
    // Case-insensitive match
    const lower = c.toLowerCase();
    for (const key of Object.keys(row)) {
      if (key.toLowerCase() === lower) return row[key];
    }
  }
  return "";
}

/**
 * Fetches pipeline throughput/capacity data for a given pipeline endpoint.
 * Normalizes the varying column names across different pipeline CSVs.
 */
export async function fetchPipelineThroughput(
  pipeline: CEREndpointKey
): Promise<PipelineThroughputPoint[]> {
  const url = CER_ENDPOINTS[pipeline];
  if (!url) return [];

  const rows = await fetchCERCsv(url);
  if (rows.length === 0) return [];

  // Derive pipeline name from the endpoint key
  const pipelineName = pipeline
    .replace(/_THROUGHPUT$/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return rows.map((row) => {
    const throughput = num(
      col(row, "Throughput (1000 b/d)", "Throughput", "Throughput (Mm³/d)", "throughput")
    );
    const capacity = num(
      col(row, "Capacity (1000 b/d)", "Capacity", "Capacity (Mm³/d)", "capacity")
    );
    const utilization =
      capacity > 0 ? throughput / capacity : 0;

    return {
      date: col(row, "Date", "date", "Month", "month", "Period"),
      pipeline: col(row, "Pipeline", "pipeline", "Key Point") || pipelineName,
      keyPoint: col(row, "Key Point", "Key point", "key point", "keyPoint"),
      product: col(row, "Product", "product", "Direction"),
      throughput,
      capacity,
      utilization: Math.round(utilization * 1000) / 1000,
      unit: col(row, "Unit", "unit") || "1000 b/d",
    };
  });
}

/**
 * Fetches crude oil production data, optionally filtered to a single province.
 * Defaults to "Alberta" if province is specified without match, returns all rows.
 */
export async function fetchCrudeOilProduction(
  province?: string
): Promise<ProductionPoint[]> {
  const rows = await fetchCERCsv(CER_ENDPOINTS.CRUDE_OIL_PRODUCTION);
  if (rows.length === 0) return [];

  const filterProvince = province ?? "Alberta";

  const results: ProductionPoint[] = [];
  for (const row of rows) {
    const rowProvince = col(row, "Province", "province", "Region", "region");

    if (
      filterProvince &&
      !rowProvince.toLowerCase().includes(filterProvince.toLowerCase())
    ) {
      continue;
    }

    results.push({
      date: col(row, "Date", "date", "Month", "month", "Period"),
      province: rowProvince,
      product: col(row, "Product", "product", "Type", "type"),
      volume: num(col(row, "Production", "production", "Volume", "volume", "Value")),
      unit:
        col(row, "Unit", "unit") || "thousand barrels per day",
    });
  }

  return results;
}

/**
 * Fetches CER pipeline incident data.
 */
export async function fetchPipelineIncidents(): Promise<PipelineIncident[]> {
  const rows = await fetchCERCsv(CER_ENDPOINTS.PIPELINE_INCIDENTS);
  if (rows.length === 0) return [];

  return rows.map((row) => ({
    incidentNumber: col(
      row,
      "Incident Number",
      "incident number",
      "Incident number"
    ),
    date: col(row, "Reported Date", "Date", "Incident Date", "date"),
    pipeline: col(row, "Pipeline", "pipeline", "Regulated Pipeline"),
    company: col(row, "Company", "company", "Operator"),
    province: col(row, "Province", "province"),
    nearestPopulatedCentre: col(
      row,
      "Nearest Populated Centre",
      "nearest populated centre",
      "Location"
    ),
    substance: col(row, "Substance", "substance", "Released Substance"),
    significantIncident:
      col(
        row,
        "Significant Incident",
        "significant incident",
        "Significant"
      ).toLowerCase() === "yes" ||
      col(
        row,
        "Significant Incident",
        "significant incident",
        "Significant"
      ).toLowerCase() === "true",
    releaseType: col(row, "Release Type", "release type", "Type"),
    status: col(row, "Status", "status"),
    whatHappened: col(row, "What Happened", "what happened", "What happened"),
    whyItHappened: col(row, "Why It Happened", "why it happened", "Why it happened"),
    volumeReleased: num(
      col(row, "Volume Released", "Approximate Volume Released", "volume released")
    ),
    volumeRecovered: num(
      col(row, "Volume Recovered", "Approximate Volume Recovered", "volume recovered")
    ),
    unit: col(row, "Unit", "unit") || "m³",
  }));
}

/**
 * Fetches pipeline apportionment (congestion) data.
 * Apportionment occurs when shipper nominations exceed pipeline capacity.
 */
export async function fetchApportionment(): Promise<ApportionmentPoint[]> {
  const rows = await fetchCERCsv(CER_ENDPOINTS.APPORTIONMENT);
  if (rows.length === 0) return [];

  return rows.map((row) => {
    const original = num(
      col(row, "Original Nominations", "original nominations", "Nominations")
    );
    const accepted = num(
      col(row, "Accepted Nominations", "accepted nominations", "Accepted")
    );
    const explicitPct = num(
      col(row, "Apportionment Percentage", "apportionment percentage", "Apportionment (%)")
    );

    // Use explicit percentage if available, otherwise calculate
    const apportionmentPercent =
      explicitPct > 0
        ? explicitPct
        : original > 0
          ? Math.round(((original - accepted) / original) * 10000) / 100
          : 0;

    return {
      date: col(row, "Date", "date", "Month", "month", "Period"),
      pipeline: col(row, "Pipeline", "pipeline", "Pipeline Name"),
      originalNominations: original,
      acceptedNominations: accepted,
      apportionmentPercent,
    };
  });
}
