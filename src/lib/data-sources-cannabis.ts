// Cannabis industry data fetchers
// Sources:
//   1. Health Canada — Cannabis Market Data (inventory & sales CSV, national, monthly)
//   2. AGLC — Cannabis Licensee Registry (Excel export, Alberta retailers)
//
// All fetchers return empty arrays / 0 on error. Cached daily (revalidate: 86400).

import * as XLSX from "xlsx";

// ============================================================
// ENDPOINTS
// ============================================================

export const CANNABIS_ENDPOINTS = {
  /** Health Canada national cannabis market data — inventory & sales by product type (monthly) */
  HC_CANNABIS_MARKET_DATA:
    "https://open.canada.ca/data/dataset/1f8d838e-f738-4549-8019-edfc0d931cd7/resource/2f960711-2447-472d-81b0-731fdfbf59a1/download/hc-sc_cannabis_market_data_-_donnees_sur_le_marche_du_cannabis_-_inventory_and_sales_en.csv",
  /** AGLC cannabis licensee list — Excel export (all Alberta retail licensees) */
  AGLC_LICENSEE_EXCEL:
    "https://aglc.ca/cannabis/cannabis-licensee-report/EXCEL",
} as const;

// ============================================================
// TYPES
// ============================================================

export interface CannabisProductSales {
  date: string; // YYYY-MM
  productType: string;
  salesUnits: number; // non-medical sales in units
  salesKg: number; // non-medical sales in kg
  medicalUnits: number;
  medicalKg: number;
}

export interface CannabisProductQuarterly {
  date: string; // YYYY-QN label
  driedFlower: number;
  edibles: number;
  extracts: number;
  topicals: number;
}

// ============================================================
// CSV PARSER (same pattern as data-sources-health.ts)
// ============================================================

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
        if (i + 1 < text.length && text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }

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
      if (ch === "\r" && i + 1 < text.length && text[i + 1] === "\n") {
        i++;
      }
      i++;
      continue;
    }

    field += ch;
    i++;
  }

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

function num(val: string | undefined): number {
  if (!val || val === "n/a" || val === "N/A") return 0;
  const cleaned = val.replace(/,/g, "").trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

// ============================================================
// HEALTH CANADA — CANNABIS MARKET DATA
// ============================================================

/**
 * Fetches Health Canada cannabis market data CSV.
 * Returns monthly sales by product type (national aggregate).
 */
export async function fetchHealthCanadaCannabis(): Promise<CannabisProductSales[]> {
  try {
    const res = await fetch(CANNABIS_ENDPOINTS.HC_CANNABIS_MARKET_DATA, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) {
      console.error(`[cannabis] HC CSV fetch failed: ${res.status}`);
      return [];
    }
    const text = await res.text();
    const rows = parseCsv(text);

    return rows
      .filter((r) => r.year_month && r.product_type)
      .map((r) => ({
        date: r.year_month,
        productType: r.product_type,
        salesUnits: num(r.sales_non_medical_units),
        salesKg: num(r.sales_non_medical_kg),
        medicalUnits: num(r.sales_medical_units),
        medicalKg: num(r.sales_medical_kg),
      }));
  } catch (err) {
    console.error("[cannabis] HC CSV fetch error:", err);
    return [];
  }
}

/** Canonical short labels for product types */
const PRODUCT_LABELS: Record<string, string> = {
  "dried cannabis": "Dried Flower",
  "edible cannabis": "Edibles",
  "cannabis extracts": "Extracts",
  "cannabis topicals": "Topicals",
};

/** The four major product categories we chart */
const CHART_TYPES = ["dried cannabis", "edible cannabis", "cannabis extracts", "cannabis topicals"];

/**
 * Aggregates Health Canada monthly data into quarterly totals by product type.
 * Returns data shaped for MultiSeriesLineChart with keys: driedFlower, edibles, extracts, topicals.
 * Values are total non-medical sales in millions of units.
 */
export async function fetchCannabisProductQuarterly(): Promise<CannabisProductQuarterly[]> {
  const raw = await fetchHealthCanadaCannabis();
  if (raw.length === 0) return [];

  // Group by quarter
  const quarterMap = new Map<string, Record<string, number>>();

  for (const r of raw) {
    if (!CHART_TYPES.includes(r.productType)) continue;
    const [year, month] = r.date.split("-");
    const q = Math.ceil(parseInt(month, 10) / 3);
    const qKey = `${year}-Q${q}`;

    if (!quarterMap.has(qKey)) {
      quarterMap.set(qKey, { driedFlower: 0, edibles: 0, extracts: 0, topicals: 0 });
    }
    const bucket = quarterMap.get(qKey)!;

    // Map product type to key
    if (r.productType === "dried cannabis") bucket.driedFlower += r.salesUnits;
    else if (r.productType === "edible cannabis") bucket.edibles += r.salesUnits;
    else if (r.productType === "cannabis extracts") bucket.extracts += r.salesUnits;
    else if (r.productType === "cannabis topicals") bucket.topicals += r.salesUnits;
  }

  // Convert to array sorted by quarter, values in millions
  return Array.from(quarterMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([key]) => {
      // Only include complete quarters (all 3 months present in data)
      const [year, qPart] = key.split("-Q");
      const qNum = parseInt(qPart, 10);
      const startMonth = (qNum - 1) * 3 + 1;
      const monthsInQ = [startMonth, startMonth + 1, startMonth + 2].map(
        (m) => `${year}-${String(m).padStart(2, "0")}`
      );
      return monthsInQ.every((m) => raw.some((r) => r.date === m));
    })
    .map(([key, val]) => ({
      date: key,
      driedFlower: Math.round(val.driedFlower / 1_000_000 * 100) / 100,
      edibles: Math.round(val.edibles / 1_000_000 * 100) / 100,
      extracts: Math.round(val.extracts / 1_000_000 * 100) / 100,
      topicals: Math.round(val.topicals / 1_000_000 * 100) / 100,
    }));
}

/** Short labels for use in chart legends */
export const CANNABIS_PRODUCT_LABELS = PRODUCT_LABELS;

// ============================================================
// AGLC — RETAILER COUNT
// ============================================================

/**
 * Fetches the AGLC cannabis licensee Excel file and counts Alberta retail licensees.
 * Returns the count, or 0 on error.
 *
 * The AGLC export at /cannabis/cannabis-licensee-report/EXCEL is a stable URL
 * returning an .xls file with columns: Authorization Number, Site City Name,
 * Establishment Name, etc. We count all rows (each = one licensed retail location).
 */
export async function fetchAglcRetailerCount(): Promise<number> {
  try {
    const res = await fetch(CANNABIS_ENDPOINTS.AGLC_LICENSEE_EXCEL, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) {
      console.error(`[cannabis] AGLC Excel fetch failed: ${res.status}`);
      return 0;
    }
    const buf = await res.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(buf), { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return 0;
    const rows = XLSX.utils.sheet_to_json(sheet);
    // Each row is one licensed retail location
    return rows.length;
  } catch (err) {
    console.error("[cannabis] AGLC Excel fetch error:", err);
    return 0;
  }
}
