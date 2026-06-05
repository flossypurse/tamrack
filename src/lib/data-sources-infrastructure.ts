// Federal and provincial infrastructure, energy, wildfire, tourism, and tax data sources
// Mixed formats: JSON, CSV, fixed-width text, CKAN APIs

import { FIRE_ENDPOINTS } from "./data-sources-fire";

// ============================================================
// Endpoints
// ============================================================

const INFRA_CANADA_URL =
  "https://www.infrastructure.gc.ca/alt-format/opendata/project-list-liste-de-projets-bil.json";

const AB_MAJOR_PROJECTS_URL =
  "https://open.alberta.ca/dataset/3e4efd44-7a00-46d1-9c7c-171028a01066/resource/8a6396c1-5b3f-4e90-ad64-77c1e7746ba7/download/rows.json";

// AER well licences: daily fixed-width file
// Pattern: https://static.aer.ca/prd/data/well-lic/WELLS{MMDD}.TXT
const AER_WELL_BASE = "https://static.aer.ca/prd/data/well-lic";

const WILDFIRE_HISTORICAL_URL = "https://open.alberta.ca/opendata/wildfire-data";

const CRA_BASE =
  "https://www.canada.ca/content/dam/cra-arc/prog-policy/stats/itstb-sipti/2024";

// ============================================================
// Interfaces
// ============================================================

export interface InfraProject {
  name: string;
  description: string;
  location: string;
  fundingAmount: number;
  status: string;
  program: string;
}

export interface MajorProject {
  name: string;
  sector: string;
  type: string;
  stage: string;
  cost: number;
  location: string;
  municipality: string;
}

export interface WellLicence {
  wellName: string;
  licenceNumber: string;
  uniqueId: string;
  surfaceLocation: string;
  projectedDepth: number;
  classification: string;
  substance: string;
  licensee: string;
}

export interface WildfireRecord {
  year: number;
  cause: string;
  size: number;
  lat: number;
  lon: number;
  forestArea: string;
}

export interface TourismRecord {
  year: number;
  visitorOrigin: string;
  visits: number;
  expenditures: number;
}

export interface TimeSeriesPoint {
  year: number;
  value: number;
}

// ============================================================
// Generic CSV fetcher (reusable)
// ============================================================

async function fetchCSV(url: string): Promise<Record<string, string>[]> {
  try {
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) {
      console.error(`CSV fetch failed: ${res.status} for ${url}`);
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
    console.error(`CSV fetch error for ${url}:`, err);
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

// ============================================================
// Infrastructure Canada Projects
// ============================================================

/**
 * Federal infrastructure projects, filtered by province.
 * Defaults to Alberta.
 */
export async function fetchInfrastructureProjects(
  province: string = "Alberta"
): Promise<InfraProject[]> {
  try {
    const res = await fetch(INFRA_CANADA_URL, { next: { revalidate: 86400 } });
    if (!res.ok) {
      console.error(`Infrastructure Canada fetch failed: ${res.status}`);
      return [];
    }
    const data = await res.json();
    const projects = Array.isArray(data) ? data : data?.projects ?? data?.data ?? [];

    return projects
      .filter((p: Record<string, unknown>) => {
        const prov =
          (p["province"] as string) ??
          (p["Province"] as string) ??
          (p["province_territory"] as string) ??
          "";
        return prov.toLowerCase().includes(province.toLowerCase());
      })
      .map((p: Record<string, unknown>) => ({
        name: String(p["project_name"] ?? p["Project Name"] ?? p["name"] ?? ""),
        description: String(p["description"] ?? p["Description"] ?? ""),
        location: String(
          p["municipality"] ?? p["Municipality"] ?? p["location"] ?? ""
        ),
        fundingAmount: parseFloat(String(p["federal_funding"] ?? p["Federal Funding"] ?? p["funding"] ?? "0")) || 0,
        status: String(p["status"] ?? p["Status"] ?? ""),
        program: String(p["program"] ?? p["Program"] ?? ""),
      }));
  } catch (err) {
    console.error("Infrastructure Canada fetch error:", err);
    return [];
  }
}

// ============================================================
// Alberta Major Projects (>$5M)
// ============================================================

/**
 * Alberta major projects inventory (projects over $5M).
 *
 * The upstream payload is Socrata's `rows.json` shape:
 *   { meta: { view: { columns: [{ name, ... }, ...] } }, data: [[...], ...] }
 * where each `data[i]` is a positional array indexed by column position.
 * We build a name → index map from `meta.view.columns` and read fields by name.
 */
export async function fetchAlbertaMajorProjects(): Promise<MajorProject[]> {
  try {
    const res = await fetch(AB_MAJOR_PROJECTS_URL, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) {
      console.error(`Alberta Major Projects fetch failed: ${res.status}`);
      return [];
    }
    const payload = await res.json();
    const columns: { name?: string }[] =
      payload?.meta?.view?.columns ?? [];
    const rows: unknown[][] = Array.isArray(payload?.data) ? payload.data : [];
    if (columns.length === 0 || rows.length === 0) return [];

    const idx: Record<string, number> = {};
    columns.forEach((c, i) => {
      if (c?.name) idx[c.name] = i;
    });

    const get = (row: unknown[], col: string): unknown =>
      idx[col] === undefined ? undefined : row[idx[col]];

    return rows
      .map((r) => {
        // Location is a Socrata `location` cell: [human, lat, lon, ..., needs_recoding]
        const loc = get(r, "Location");
        const locationStr =
          Array.isArray(loc) && loc[1] && loc[2]
            ? `${loc[1]},${loc[2]}`
            : "";

        return {
          name: String(get(r, "Name") ?? ""),
          sector: String(get(r, "Sector") ?? ""),
          type: String(get(r, "Sector") ?? ""), // dataset has no separate Type column
          stage: String(get(r, "Stage") ?? ""),
          cost: parseFloat(String(get(r, "Cost") ?? "0")) || 0,
          location: locationStr,
          municipality: String(
            get(r, "From Municipality") ?? get(r, "To Municipality") ?? ""
          ),
        };
      })
      .filter((p) => p.name.length > 0);
  } catch (err) {
    console.error("Alberta Major Projects fetch error:", err);
    return [];
  }
}

// ============================================================
// AER Well Licences (Daily fixed-width text)
// ============================================================

/** Marker thrown when AER's static directory rejects the request. */
export class AERAccessBlockedError extends Error {
  constructor(url: string, status: number) {
    super(`AER static directory blocked (${status}) at ${url}`);
    this.name = "AERAccessBlockedError";
  }
}

/**
 * Fetch AER well licences for a given date (defaults to today).
 *
 * The historical source — `static.aer.ca/prd/data/well-lic/WELLS{MMDD}.TXT` —
 * started returning HTTP 403 around 2026-03-14 and the entire `prd/data/`
 * tree is now access-walled. No public Open Alberta dataset currently
 * exposes the daily licence flow as a parseable file; only quarterly PDFs
 * are published. Until a replacement source is identified, this fetcher
 * throws AERAccessBlockedError on 403 so the collector can log a real
 * error row instead of misleading "ok with no data".
 */
export async function fetchAERWellLicences(
  date?: Date
): Promise<WellLicence[]> {
  const d = date ?? new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const url = `${AER_WELL_BASE}/WELLS${mm}${dd}.TXT`;

  let res: Response;
  try {
    res = await fetch(url, { next: { revalidate: 86400 } });
  } catch (err) {
    console.error("AER well licences fetch error:", err);
    return [];
  }

  if (res.status === 403) {
    throw new AERAccessBlockedError(url, res.status);
  }
  if (!res.ok) {
    console.error(`AER well licences fetch failed: ${res.status} for ${url}`);
    return [];
  }

  const text = await res.text();

  // The file uses CRLF — strip \r from every line.
  const rawLines = text.split("\n").map((l) => l.replace(/\r$/, ""));

  // ── Locate the data section ──────────────────────────────────────────────
  // The header block opens with a legend delimited by two "----" divider
  // lines.  Data records start immediately after the second divider.
  let dataStart = 0;
  let dividerCount = 0;
  for (let i = 0; i < rawLines.length; i++) {
    if (rawLines[i].trim().startsWith("----")) {
      dividerCount++;
      if (dividerCount === 2) {
        dataStart = i + 1;
        break;
      }
    }
  }

  // Data ends at the "AMENDMENTS OF WELL LICENCES" sub-section header or at
  // the "-------- END OF WELL LICENCES DAILY LIST --------" footer.
  let dataEnd = rawLines.length;
  for (let i = dataStart; i < rawLines.length; i++) {
    const t = rawLines[i].trim();
    if (
      t.includes("AMENDMENTS OF WELL LICENCES") ||
      t.startsWith("-------- END OF WELL")
    ) {
      dataEnd = i;
      break;
    }
  }

  // ── Group lines into per-record blocks ──────────────────────────────────
  // A record-start line has a 6–7 digit licence number in columns [40,51)
  // and a non-empty well name in columns [4,40).  Everything from one
  // record-start up to (but not including) the next is one block.
  const isRecordStart = (line: string): boolean => {
    if (line.length < 51) return false;
    const licField = line.substring(40, 51).trim();
    const wellField = line.substring(4, 40).trim();
    return /^\d{6,7}$/.test(licField) && wellField.length > 0;
  };

  const blocks: string[][] = [];
  let current: string[] | null = null;
  for (let i = dataStart; i < dataEnd; i++) {
    const line = rawLines[i];
    if (isRecordStart(line)) {
      if (current) blocks.push(current);
      current = [line];
    } else if (current !== null) {
      current.push(line);
    }
  }
  if (current) blocks.push(current);

  // ── Parse each block ────────────────────────────────────────────────────
  // Each standard well-licence record consists of exactly 5 content lines
  // (non-blank), using fixed column ranges confirmed against the live file:
  //
  //   Line A (record-start): wellName=[4,40)  licenceNumber=[40,51)
  //   Line B:                uniqueId=[4,25)  projectedDepth=[72,end)
  //   Line C:                classification=[4,28)
  //   Line D:                substance=[72,end)
  //   Line E:                licensee=[4,72)  surfaceLocation=[72,end)
  //
  // Some records are followed by WELL NAME:/BOTTOMHOLE continuation lines;
  // those are ignored by taking only the first 5 non-blank lines.
  const parseDepth = (raw: string): number => {
    const m = raw.trim().match(/^([0-9]+(?:\.[0-9]+)?)/);
    return m ? parseFloat(m[1]) : 0;
  };

  return blocks.map((block) => {
    const content = block.filter((l) => l.trim().length > 0);
    const A = content[0] ?? "";
    const B = content[1] ?? "";
    const C = content[2] ?? "";
    const D = content[3] ?? "";
    const E = content[4] ?? "";

    // uniqueId: the UWI portion sits in [4,25); [25,28) bleeds into the
    // surface-coordinate direction indicator (e.g. "  S" / "  N").
    const rawUniqueId = A.length >= 1 ? B.substring(4, 25).trim() : "";

    return {
      wellName: A.substring(4, 40).trim(),
      licenceNumber: A.substring(40, 51).trim(),
      uniqueId: rawUniqueId,
      projectedDepth: parseDepth(B.substring(72)),
      classification: C.substring(4, 28).trim(),
      substance: D.substring(72).trim(),
      licensee: E.substring(4, 72).trim(),
      surfaceLocation: E.substring(72).trim(),
    };
  });
}

// ============================================================
// Alberta Wildfire Historical (CKAN)
// ============================================================

/**
 * Fetch historical wildfire data from Alberta Open Data (CKAN).
 * Attempts to resolve the CKAN dataset to find a CSV resource.
 */
export async function fetchWildfireHistorical(): Promise<WildfireRecord[]> {
  try {
    // Try CKAN package API to find the CSV resource URL
    const ckanApi =
      "https://open.alberta.ca/api/3/action/package_show?id=wildfire-data";
    const pkgRes = await fetch(ckanApi, { next: { revalidate: 86400 } });

    if (!pkgRes.ok) {
      console.error(`Wildfire CKAN package fetch failed: ${pkgRes.status}`);
      return [];
    }

    const pkg = await pkgRes.json();
    const resources = pkg?.result?.resources ?? [];
    const csvResource = resources.find(
      (r: Record<string, unknown>) =>
        String(r["format"] ?? "").toLowerCase() === "csv"
    );

    if (!csvResource?.url) {
      console.error("No CSV resource found in wildfire CKAN dataset");
      return [];
    }

    const rows = await fetchCSV(csvResource.url);
    return rows.map((r) => ({
      year: parseInt(r["Year"] ?? r["year"] ?? r["YEAR"] ?? "0", 10),
      cause: r["Cause"] ?? r["cause"] ?? r["General Cause"] ?? "",
      size: parseFloat(r["Size (ha)"] ?? r["size"] ?? r["Area (ha)"] ?? "0") || 0,
      lat: parseFloat(r["Latitude"] ?? r["lat"] ?? r["LAT"] ?? "0") || 0,
      lon: parseFloat(r["Longitude"] ?? r["lon"] ?? r["LONG"] ?? "0") || 0,
      forestArea: r["Forest Area"] ?? r["forest_area"] ?? r["Forest"] ?? "",
    }));
  } catch (err) {
    console.error("Wildfire historical fetch error:", err);
    return [];
  }
}

// ============================================================
// CWFIS Active Fires (Natural Resources Canada)
// ============================================================

// Active-fires URL lives in data-sources-fire.ts (FIRE_ENDPOINTS.CWFIS_ACTIVE_FIRES)
// so both callers stay in sync when NRCan rolls the endpoint again.

const HISTORICAL_WILDFIRE_CSV_URL =
  "https://open.alberta.ca/dataset/a221e7a0-4f46-4be7-9c5a-e29de9a3447e/resource/80480824-0c50-456c-9723-f9d4fc136141/download/fp-historical-wildfire-data-2006-2025.csv";

export interface CWFISFire {
  agency: string;
  firename: string;
  lat: number;
  lon: number;
  startdate: string;
  hectares: number;
  stageOfControl: string;
  responseType: string;
}

export interface HistoricalWildfire {
  year: number;
  fireNumber: string;
  size: number;
  sizeClass: string;
  latitude: number;
  longitude: number;
  generalCause: string;
  startDate: string;
}

export interface WildfireYearlySummary {
  year: number;
  count: number;
  totalHectares: number;
}

export interface WildfireCauseBreakdown {
  cause: string;
  count: number;
  totalHectares: number;
}

/**
 * Fetch active fires from CWFIS (Canadian Wildland Fire Information System),
 * filtered to Alberta (agency === "ab").
 */
export async function fetchCWFISActiveFires(): Promise<CWFISFire[]> {
  try {
    const rows = await fetchCSV(FIRE_ENDPOINTS.CWFIS_ACTIVE_FIRES);
    return rows
      .filter((r) => {
        const agency = (r["agency_code"] ?? r["agency"] ?? r["Agency"] ?? "").toUpperCase();
        return agency === "AB";
      })
      .map((r) => ({
        agency: r["agency_code"] ?? r["agency"] ?? r["Agency"] ?? "",
        firename:
          r["agency_fire_id"] ??
          r["national_fire_id"] ??
          r["firename"] ??
          r["FireName"] ??
          r["fire_name"] ??
          "",
        lat: parseFloat(r["latitude"] ?? r["lat"] ?? r["Lat"] ?? "0") || 0,
        lon: parseFloat(r["longitude"] ?? r["lon"] ?? r["Lon"] ?? "0") || 0,
        startdate:
          r["record_start"] ??
          r["situation_report_date"] ??
          r["startdate"] ??
          r["StartDate"] ??
          r["start_date"] ??
          "",
        hectares:
          parseFloat(r["fire_size"] ?? r["hectares"] ?? r["Hectares"] ?? r["ha"] ?? "0") || 0,
        stageOfControl:
          r["stage_of_control_status"] ??
          r["stage_of_control"] ??
          r["StageOfControl"] ??
          r["status"] ??
          "",
        responseType:
          r["response_type"] ?? r["ResponseType"] ?? r["type"] ?? "",
      }));
  } catch (err) {
    console.error("CWFIS active fires fetch error:", err);
    return [];
  }
}

/**
 * Fetch historical wildfire data from Alberta Open Data direct CSV (2006-2025).
 * Optionally filter to fires starting from a given year.
 */
export async function fetchHistoricalWildfires(
  startYear?: number
): Promise<HistoricalWildfire[]> {
  try {
    const rows = await fetchCSV(HISTORICAL_WILDFIRE_CSV_URL);
    const fires = rows.map((r) => ({
      year:
        parseInt(r["YEAR"] ?? r["Year"] ?? r["year"] ?? "0", 10),
      fireNumber: r["FIRE_NUMBER"] ?? r["Fire_Number"] ?? r["fire_number"] ?? "",
      size:
        parseFloat(
          r["CURRENT_SIZE"] ?? r["Current_Size"] ?? r["SIZE_HA"] ?? r["Size"] ?? "0"
        ) || 0,
      sizeClass: r["SIZE_CLASS"] ?? r["Size_Class"] ?? r["size_class"] ?? "",
      latitude:
        parseFloat(r["LATITUDE"] ?? r["Latitude"] ?? r["lat"] ?? "0") || 0,
      longitude:
        parseFloat(r["LONGITUDE"] ?? r["Longitude"] ?? r["lon"] ?? "0") || 0,
      generalCause:
        r["GENERAL_CAUSE"] ?? r["General_Cause"] ?? r["general_cause"] ?? "",
      startDate:
        r["FIRE_START_DATE"] ?? r["Fire_Start_Date"] ?? r["start_date"] ?? "",
    }));
    if (startYear) {
      return fires.filter((f) => f.year >= startYear);
    }
    return fires;
  } catch (err) {
    console.error("Historical wildfire CSV fetch error:", err);
    return [];
  }
}

/**
 * Aggregate historical fires by year for trend charts.
 * Returns yearly fire count and total hectares burned.
 */
export async function fetchWildfireYearlySummary(): Promise<
  WildfireYearlySummary[]
> {
  const fires = await fetchHistoricalWildfires();
  const byYear = new Map<number, { count: number; totalHectares: number }>();

  for (const f of fires) {
    if (f.year < 2006) continue;
    const entry = byYear.get(f.year) ?? { count: 0, totalHectares: 0 };
    entry.count += 1;
    entry.totalHectares += f.size;
    byYear.set(f.year, entry);
  }

  return Array.from(byYear.entries())
    .map(([year, data]) => ({
      year,
      count: data.count,
      totalHectares: Math.round(data.totalHectares),
    }))
    .sort((a, b) => a.year - b.year);
}

/**
 * Aggregate historical fires by general cause (Lightning, Human, etc.).
 */
export async function fetchWildfireCauseBreakdown(): Promise<
  WildfireCauseBreakdown[]
> {
  const fires = await fetchHistoricalWildfires();
  const byCause = new Map<string, { count: number; totalHectares: number }>();

  for (const f of fires) {
    const cause = f.generalCause || "Unknown";
    const entry = byCause.get(cause) ?? { count: 0, totalHectares: 0 };
    entry.count += 1;
    entry.totalHectares += f.size;
    byCause.set(cause, entry);
  }

  return Array.from(byCause.entries())
    .map(([cause, data]) => ({
      cause,
      count: data.count,
      totalHectares: Math.round(data.totalHectares),
    }))
    .sort((a, b) => b.count - a.count);
}

// ============================================================
// Alberta Tourism (CKAN)
// ============================================================

/**
 * Fetch tourism visits and expenditures by visitor origin from Alberta Open Data.
 */
export async function fetchTourismData(): Promise<TourismRecord[]> {
  try {
    const ckanApi =
      "https://open.alberta.ca/api/3/action/package_show?id=visits-and-expenditures-by-visitor-origin";
    const pkgRes = await fetch(ckanApi, { next: { revalidate: 86400 } });

    if (!pkgRes.ok) {
      console.error(`Tourism CKAN package fetch failed: ${pkgRes.status}`);
      return [];
    }

    const pkg = await pkgRes.json();
    const resources = pkg?.result?.resources ?? [];
    const csvResource = resources.find(
      (r: Record<string, unknown>) =>
        String(r["format"] ?? "").toLowerCase() === "csv"
    );

    if (!csvResource?.url) {
      console.error("No CSV resource found in tourism CKAN dataset");
      return [];
    }

    const rows = await fetchCSV(csvResource.url);
    return rows.map((r) => ({
      year: parseInt(r["Year"] ?? r["year"] ?? "0", 10),
      visitorOrigin: r["Visitor Origin"] ?? r["visitor_origin"] ?? r["Origin"] ?? "",
      visits: parseInt(r["Visits"] ?? r["visits"] ?? r["Number of Visits"] ?? "0", 10) || 0,
      expenditures:
        parseFloat(
          r["Expenditures"] ?? r["expenditures"] ?? r["Spending"] ?? "0"
        ) || 0,
    }));
  } catch (err) {
    console.error("Tourism data fetch error:", err);
    return [];
  }
}

// ============================================================
// CRA Tax Filer Statistics
// ============================================================

/**
 * Fetch CRA tax filer statistics tables.
 * Tables 1-6 available; default is table 1 (filers by province and bracket).
 */
export async function fetchCRATaxStats(
  table: number = 1
): Promise<Record<string, string>[]> {
  try {
    const paddedTable = String(table).padStart(2, "0");
    const url = `${CRA_BASE}/tbl${paddedTable}.csv`;
    return await fetchCSV(url);
  } catch (err) {
    console.error(`CRA tax stats fetch error for table ${table}:`, err);
    return [];
  }
}
