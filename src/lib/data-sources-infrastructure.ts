// Federal and provincial infrastructure, energy, wildfire, tourism, and tax data sources
// Mixed formats: JSON, CSV, fixed-width text, CKAN APIs

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
    const data = await res.json();
    const rows = Array.isArray(data) ? data : data?.data ?? data?.rows ?? [];

    return rows.map((r: Record<string, unknown>) => ({
      name: String(r["Project Name"] ?? r["project_name"] ?? r["name"] ?? ""),
      sector: String(r["Sector"] ?? r["sector"] ?? ""),
      type: String(r["Type"] ?? r["type"] ?? r["Project Type"] ?? ""),
      stage: String(r["Stage"] ?? r["stage"] ?? r["Status"] ?? ""),
      cost: parseFloat(String(r["Estimated Cost"] ?? r["cost"] ?? r["Cost ($Million)"] ?? "0")) || 0,
      location: String(r["Location"] ?? r["location"] ?? r["Region"] ?? ""),
      municipality: String(r["Municipality"] ?? r["municipality"] ?? r["Nearest Municipality"] ?? ""),
    }));
  } catch (err) {
    console.error("Alberta Major Projects fetch error:", err);
    return [];
  }
}

// ============================================================
// AER Well Licences (Daily fixed-width text)
// ============================================================

/**
 * Fetch AER well licences for a given date (defaults to today).
 * File format is fixed-width text at static.aer.ca.
 */
export async function fetchAERWellLicences(
  date?: Date
): Promise<WellLicence[]> {
  try {
    const d = date ?? new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const url = `${AER_WELL_BASE}/WELLS${mm}${dd}.TXT`;

    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) {
      console.error(`AER well licences fetch failed: ${res.status} for ${url}`);
      return [];
    }
    const text = await res.text();
    const lines = text.split("\n");

    // Skip header lines (typically first 2-3 lines are headers/dashes)
    const dataLines = lines.filter(
      (l) =>
        l.trim().length > 0 &&
        !l.startsWith("-") &&
        !l.startsWith("=") &&
        !l.toLowerCase().includes("well name") &&
        !l.toLowerCase().includes("licence")
    );

    // AER fixed-width format — approximate column positions
    // Columns vary by year; these are common widths
    return dataLines.map((line) => ({
      licenceNumber: line.substring(0, 10).trim(),
      wellName: line.substring(10, 50).trim(),
      uniqueId: line.substring(50, 66).trim(),
      surfaceLocation: line.substring(66, 100).trim(),
      projectedDepth: parseInt(line.substring(100, 110).trim(), 10) || 0,
      classification: line.substring(110, 125).trim(),
      substance: line.substring(125, 145).trim(),
      licensee: line.substring(145).trim(),
    }));
  } catch (err) {
    console.error("AER well licences fetch error:", err);
    return [];
  }
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
