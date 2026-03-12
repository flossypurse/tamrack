// Data fetching modules for Alberta economic data sources
// All free, no API keys required (except where noted)

const STATCAN_BASE = "https://www150.statcan.gc.ca/t1/wds/rest";
const BOC_BASE = "https://www.bankofcanada.ca/valet";
const EDMONTON_BASE = "https://data.edmonton.ca/resource";

// ============================================================
// STATISTICS CANADA (WDS API)
// ============================================================

interface StatCanCoordinate {
  tableId: string;
  coordinate: string;
  latestN: number;
}

export async function fetchStatCanTable(
  tableId: string,
  coordinate: string,
  latestN: number = 20
) {
  const body: StatCanCoordinate[] = [{ tableId, coordinate, latestN }];
  const res = await fetch(
    `${STATCAN_BASE}/getDataFromCubePidCoordAndLatestNPeriods`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      next: { revalidate: 3600 },
    }
  );
  const data = await res.json();
  return data;
}

export async function fetchStatCanVectors(
  vectorIds: number[],
  startDate: string,
  endDate: string
) {
  const body = vectorIds.map((id) => ({
    vectorId: id,
    startDataPointReleaseDate: startDate,
    endDataPointReleaseDate: endDate,
  }));
  const res = await fetch(`${STATCAN_BASE}/getBulkVectorDataByRange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    next: { revalidate: 3600 },
  });
  return res.json();
}

// StatsCan table + coordinate pairs for Alberta data
// Coordinates are: dimensionMember IDs separated by dots, padded to 10 positions
export const STATSCAN_SERIES = {
  // Table 14-10-0287: Labour force characteristics
  // Coordinate: Alberta(10).UnemploymentRate(7).TotalGender(1).15+(1).Estimate(1).SeasonallyAdj(1)
  AB_UNEMPLOYMENT_RATE: { tableId: 14100287, coordinate: "10.7.1.1.1.1.0.0.0.0" },
  AB_EMPLOYMENT: { tableId: 14100287, coordinate: "10.3.1.1.1.1.0.0.0.0" },

  // Table 18-10-0004: CPI monthly
  // Coordinate: Alberta(23).AllItems(2)
  AB_CPI: { tableId: 18100004, coordinate: "23.2.0.0.0.0.0.0.0.0" },
  EDMONTON_CPI: { tableId: 18100004, coordinate: "24.2.0.0.0.0.0.0.0.0" },

  // Table 17-10-0005: Population estimates by province
  // Coordinate: Alberta(10).TotalGender(1).AllAges(1)
  AB_POPULATION: { tableId: 17100005, coordinate: "10.1.1.0.0.0.0.0.0.0" },

  // Table 34-10-0292: Building permits — Edmonton CMA (covers all metro municipalities)
  // Dims: Geography(54=Edmonton CMA).TypeOfBuilding.TypeOfWork.Variables.SeasonalAdj
  // Total residential permit value (unadjusted)
  EDMONTON_CMA_RES_PERMIT_VALUE: { tableId: 34100292, coordinate: "54.4.1.1.1.0.0.0.0.0" },
  // Total residential dwelling units created
  EDMONTON_CMA_RES_UNITS: { tableId: 34100292, coordinate: "54.4.3.2.1.0.0.0.0.0" },
  // Single-family dwelling units created
  EDMONTON_CMA_SINGLE_UNITS: { tableId: 34100292, coordinate: "54.10.3.2.1.0.0.0.0.0" },
  // Number of residential permits
  EDMONTON_CMA_RES_PERMIT_COUNT: { tableId: 34100292, coordinate: "54.4.1.5.1.0.0.0.0.0" },

  // Alberta GDP — Table 36-10-0402, chained (2017) dollars
  // Coordinate: Alberta(9).Chained2017$(2).AllIndustries(1)
  AB_GDP: { tableId: 36100402, coordinate: "9.2.1.0.0.0.0.0.0.0" },

  // Alberta Retail Sales — Table 20-10-0056 (replaced discontinued 20-10-0008)
  // Coordinate: Alberta(16).RetailTrade(1).TotalSales(1).SeasonallyAdj(2)
  AB_RETAIL_SALES: { tableId: 20100056, coordinate: "16.1.1.2.0.0.0.0.0.0" },

  // GDP by Industry (Table 36-10-0402) — Alberta(9).Chained2017$(2).Industry(N)
  AB_GDP_MINING_OIL_GAS: { tableId: 36100402, coordinate: "9.2.22.0.0.0.0.0.0.0" }, // Mining, quarrying, oil & gas extraction
  AB_GDP_CONSTRUCTION: { tableId: 36100402, coordinate: "9.2.47.0.0.0.0.0.0.0" },
  AB_GDP_AGRICULTURE: { tableId: 36100402, coordinate: "9.2.11.0.0.0.0.0.0.0" }, // Agriculture, forestry, fishing & hunting
  AB_GDP_MANUFACTURING: { tableId: 36100402, coordinate: "9.2.58.0.0.0.0.0.0.0" },
  AB_GDP_REAL_ESTATE: { tableId: 36100402, coordinate: "9.2.228.0.0.0.0.0.0.0" }, // Real estate & rental/leasing
  AB_GDP_SERVICES: { tableId: 36100402, coordinate: "9.2.298.0.0.0.0.0.0.0" }, // Public administration
  AB_GDP_TECH: { tableId: 36100402, coordinate: "9.2.237.0.0.0.0.0.0.0" }, // Professional/scientific/tech services

  // Labour force — Table 14-10-0287: Alberta(10)
  AB_PARTICIPATION_RATE: { tableId: 14100287, coordinate: "10.8.1.1.1.1.0.0.0.0" }, // Participation rate(8)
  AB_EMPLOYMENT_RATE: { tableId: 14100287, coordinate: "10.9.1.1.1.1.0.0.0.0" }, // Employment rate(9)

  // Edmonton unemployment — Table 14-10-0445 (census subdivision, 3-month moving avg)
  EDMONTON_UNEMPLOYMENT_RATE: { tableId: 14100445, coordinate: "34.8.1.0.0.0.0.0.0.0" }, // Edmonton(34).UnempRate(8).Estimate(1)

  // Job vacancies — Table 14-10-0441 (replaced archived 14-10-0325)
  AB_JOB_VACANCIES: { tableId: 14100441, coordinate: "10.1.0.0.0.0.0.0.0.0" }, // Alberta(10).JobVacancies(1)

  // Population components — Table 17-10-0008: Demographic growth, annual, Alberta(10)
  AB_BIRTHS: { tableId: 17100008, coordinate: "10.1.0.0.0.0.0.0.0.0" },
  AB_DEATHS: { tableId: 17100008, coordinate: "10.2.0.0.0.0.0.0.0.0" },
  AB_IMMIGRATION: { tableId: 17100008, coordinate: "10.3.0.0.0.0.0.0.0.0" },
  AB_EMIGRATION: { tableId: 17100008, coordinate: "10.13.0.0.0.0.0.0.0.0" }, // Net emigration
  AB_NET_INTERPROVINCIAL: { tableId: 17100008, coordinate: "10.5.0.0.0.0.0.0.0.0" },
  // Note: separate interprovincial in/out not available in this table — only net

  // Farm cash receipts — Table 32-10-0045: Alberta(10)
  AB_FARM_CASH_RECEIPTS: { tableId: 32100045, coordinate: "10.1.0.0.0.0.0.0.0.0" }, // Total farm cash receipts
  AB_FARM_CROP_RECEIPTS: { tableId: 32100045, coordinate: "10.2.0.0.0.0.0.0.0.0" }, // Total crop receipts
  AB_FARM_LIVESTOCK_RECEIPTS: { tableId: 32100045, coordinate: "10.41.0.0.0.0.0.0.0.0" }, // Total livestock receipts

  // Average weekly earnings — Table 14-10-0223: Alberta(10), incl overtime(2), excl unclassified(2)
  AB_WEEKLY_EARNINGS: { tableId: 14100223, coordinate: "10.2.2.0.0.0.0.0.0.0" },

  // Business counts — Table 33-10-0270: Experimental business openings/closures, Alberta(38)
  AB_BUSINESS_COUNT: { tableId: 33100270, coordinate: "38.1.1.0.0.0.0.0.0.0" }, // Active businesses

  // CMHC housing data via StatsCan — Table 34-10-0154
  // "Housing starts, under construction and completions in selected CMAs"
  // Edmonton CMA(4), metric dimension: starts(1)/underConstruction(2)/completions(3), totalUnits(1)
  EDMONTON_HOUSING_STARTS: { tableId: 34100154, coordinate: "4.1.1.0.0.0.0.0.0.0" },
  EDMONTON_HOUSING_COMPLETIONS: { tableId: 34100154, coordinate: "4.3.1.0.0.0.0.0.0.0" },
  EDMONTON_UNDER_CONSTRUCTION: { tableId: 34100154, coordinate: "4.2.1.0.0.0.0.0.0.0" },

  // CMHC Rental vacancy rate — Table 34-10-0127
  // Apartment structures of six units+, privately initiated. Annual (October survey).
  // Edmonton CMA = member 4
  EDMONTON_VACANCY_RATE: { tableId: 34100127, coordinate: "4.0.0.0.0.0.0.0.0.0" },

  // CMHC Average rents — Table 34-10-0133
  // Edmonton CMA = member 148, structure type: apartment 3+ = 1, unit type: bachelor=1/1bed=2/2bed=3/3bed=4
  EDMONTON_RENT_BACHELOR: { tableId: 34100133, coordinate: "148.1.1.0.0.0.0.0.0.0" },
  EDMONTON_RENT_1BED: { tableId: 34100133, coordinate: "148.1.2.0.0.0.0.0.0.0" },
  EDMONTON_RENT_2BED: { tableId: 34100133, coordinate: "148.1.3.0.0.0.0.0.0.0" },
  EDMONTON_RENT_3BED: { tableId: 34100133, coordinate: "148.1.4.0.0.0.0.0.0.0" },
} as const;

// ============================================================
// BANK OF CANADA (Valet API)
// ============================================================

export interface BoCObservation {
  d: string; // date
  [key: string]: { v: string } | string;
}

export async function fetchBoCSeriesGroup(groupName: string) {
  const res = await fetch(`${BOC_BASE}/groups/${groupName}/json`, {
    next: { revalidate: 3600 },
  });
  return res.json();
}

export async function fetchBoCObservations(
  seriesName: string,
  recent?: number,
  startDate?: string,
  endDate?: string
) {
  let url = `${BOC_BASE}/observations/${seriesName}/json`;
  const params = new URLSearchParams();
  if (recent) params.set("recent", String(recent));
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);
  const qs = params.toString();
  if (qs) url += `?${qs}`;

  const res = await fetch(url, { next: { revalidate: 3600 } });
  return res.json();
}

// Key BoC series
export const BOC_SERIES = {
  POLICY_RATE: "V39079",
  PRIME_RATE: "V80691311",
  CAD_USD: "FXCADUSD",
  CPI_TRIM: "STATIC_CPITRIM_V41693271_M",
  MORTGAGE_5Y_FIXED: "V80691335",
  MORTGAGE_5Y_VARIABLE: "V80691336",
  // Bank of Canada Commodity Price Indexes (monthly)
  BCPI_ALL: "M.BCPI",
  BCPI_ENERGY: "M.ENER",
  BCPI_NON_ENERGY: "M.BCNE",
  BCPI_AGRICULTURE: "M.AGRI",
  BCPI_METALS: "M.MTLS",
  BCPI_FORESTRY: "M.FOPR",
  BCPI_FISH: "M.FISH",
} as const;

// ============================================================
// EDMONTON OPEN DATA (Socrata SODA API)
// ============================================================

export async function fetchEdmontonData(
  datasetId: string,
  params?: Record<string, string>
) {
  const url = new URL(`${EDMONTON_BASE}/${datasetId}.json`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
  return res.json();
}

// Key Edmonton dataset IDs
export const EDMONTON_DATASETS = {
  BUILDING_PERMITS: "rwuh-apwg",
  PROPERTY_ASSESSMENTS: "q7d6-ambg",
  BUSINESS_LICENCES: "qhi4-bdpu",
  DEVELOPMENT_PERMITS: "q4gd-6q9r",
  ROAD_CONSTRUCTION: "7wiq-4rgy",
} as const;

// ============================================================
// ALBERTA OPEN DATA (CKAN API)
// ============================================================

const ALBERTA_CKAN = "https://open.alberta.ca/api/3/action";

export async function fetchAlbertaActivityIndex(): Promise<TimeSeriesPoint[]> {
  try {
    const url =
      "https://open.alberta.ca/dataset/fd4d584a-305e-432e-b2e8-60b11cc47973/resource/ad4cb55d-4df3-4455-a6dc-71ce010a79b2/download/alberta-activity-index-data-tables.xlsx";
    const res = await fetch(url, { next: { revalidate: 86400 } });
    const buffer = await res.arrayBuffer();
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
    }) as unknown as unknown[][];
    const points: TimeSeriesPoint[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 2) continue;
      const dateVal = row[0];
      const value = parseFloat(String(row[1]));
      if (isNaN(value)) continue;
      // Parse date — could be Excel serial or date string
      let dateStr: string;
      if (typeof dateVal === "string" && dateVal.includes("-")) {
        dateStr = dateVal.slice(0, 10);
      } else if (typeof dateVal === "string" && dateVal.includes("/")) {
        const parts = dateVal.split("/");
        dateStr = `${parts[2]}-${parts[0].padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
      } else {
        // Try parsing as a date string
        const d = new Date(String(dateVal));
        if (isNaN(d.getTime())) continue;
        dateStr = d.toISOString().slice(0, 10);
      }
      points.push({ date: dateStr, value });
    }
    return points;
  } catch {
    return [];
  }
}

export async function searchAlbertaDatasets(query: string, rows: number = 10) {
  const res = await fetch(
    `${ALBERTA_CKAN}/package_search?q=${encodeURIComponent(query)}&rows=${rows}`,
    { next: { revalidate: 86400 } }
  );
  return res.json();
}

export async function fetchAlbertaCKANResource(datasetId: string): Promise<string | null> {
  try {
    const meta = await fetch(
      `${ALBERTA_CKAN}/package_show?id=${datasetId}`,
      { next: { revalidate: 86400 } }
    );
    const pkg = await meta.json();
    const csvResource = pkg.result?.resources?.find(
      (r: { format?: string }) => r.format?.toLowerCase() === 'csv'
    );
    if (!csvResource?.url) return null;
    const csv = await fetch(csvResource.url, { next: { revalidate: 86400 } });
    return csv.text();
  } catch {
    return null;
  }
}

// ============================================================
// CONVENIENCE: Fetch and normalize for dashboard display
// ============================================================

export interface TimeSeriesPoint {
  date: string;
  value: number;
  label?: string;
}

export async function fetchBoCTimeSeries(
  seriesName: string,
  recent: number = 60
): Promise<TimeSeriesPoint[]> {
  try {
    const data = await fetchBoCObservations(seriesName, recent);
    if (!data?.observations) return [];
    return data.observations.map((obs: Record<string, { v: string } | string>) => ({
      date: obs.d as string,
      value: parseFloat((obs[seriesName] as { v: string })?.v || "0"),
    }));
  } catch {
    return [];
  }
}

export async function fetchEdmontonPermitsSummary(): Promise<TimeSeriesPoint[]> {
  try {
    // Get recent permits grouped by month
    const data = await fetchEdmontonData(EDMONTON_DATASETS.BUILDING_PERMITS, {
      $query:
        "SELECT date_trunc_ym(issue_date) as month, count(*) as cnt, sum(construction_value) as total_value WHERE issue_date > '2023-01-01' GROUP BY date_trunc_ym(issue_date) ORDER BY month",
    });
    if (!Array.isArray(data)) return [];
    return data.map((row: { month: string; cnt: string; total_value: string }) => ({
      date: row.month?.split("T")[0] || "",
      value: parseInt(row.cnt || "0"),
      label: `$${(parseInt(row.total_value || "0") / 1_000_000).toFixed(1)}M`,
    }));
  } catch {
    return [];
  }
}

export async function fetchEdmontonBusinessLicences(): Promise<TimeSeriesPoint[]> {
  try {
    // Business licences dataset stores dates as text, so we can't use
    // date_trunc_ym server-side. Fetch dates and aggregate in JS.
    const data = await fetchEdmontonData(EDMONTON_DATASETS.BUSINESS_LICENCES, {
      $select: "most_recent_issue_date",
      $where: "most_recent_issue_date > '2024-01-01'",
      $limit: "50000",
    });
    if (!Array.isArray(data)) return [];
    const counts: Record<string, number> = {};
    for (const row of data) {
      const d = row.most_recent_issue_date;
      if (!d) continue;
      const month = d.slice(0, 7); // "YYYY-MM"
      counts[month] = (counts[month] || 0) + 1;
    }
    return Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ date: `${month}-01`, value: count }));
  } catch {
    return [];
  }
}

// ============================================================
// CONVENIENCE: Fetch and normalize StatsCan for dashboard
// ============================================================

// Concurrency limiter — at most 2 StatsCan requests in flight per worker
const STATCAN_MAX_CONCURRENT = 2;
let statcanInFlight = 0;
const statcanQueue: Array<() => void> = [];

function acquireStatCanSlot(): Promise<void> {
  if (statcanInFlight < STATCAN_MAX_CONCURRENT) {
    statcanInFlight++;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    statcanQueue.push(() => { statcanInFlight++; resolve(); });
  });
}

function releaseStatCanSlot() {
  statcanInFlight--;
  const next = statcanQueue.shift();
  if (next) next();
}

// In-flight request dedup cache (same tableId+coordinate → reuse promise)
const inflightCache = new Map<string, Promise<TimeSeriesPoint[]>>();

async function _fetchStatCanTimeSeries(
  tableId: number,
  coordinate: string,
  latestN: number
): Promise<TimeSeriesPoint[]> {
  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      // Back off on 429: 1s, 3s
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
    await acquireStatCanSlot();
    try {
      const body = [{ productId: tableId, coordinate, latestN }];
      const res = await fetch(
        `${STATCAN_BASE}/getDataFromCubePidCoordAndLatestNPeriods`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          next: { revalidate: 3600 },
        }
      );
      if (!res.ok) {
        console.warn(`StatsCan ${tableId}/${coordinate}: HTTP ${res.status} (attempt ${attempt + 1})`);
        continue;
      }
      const data = await res.json();
      const item = Array.isArray(data) ? data[0] : data;
      if (item?.status !== "SUCCESS") {
        console.warn(`StatsCan ${tableId}/${coordinate}: status=${item?.status} (attempt ${attempt + 1})`);
        continue;
      }
      const points = item.object?.vectorDataPoint || [];
      return points.map((p: { refPer: string; value: number }) => ({
        date: p.refPer,
        value: p.value,
      }));
    } catch (err) {
      console.warn(`StatsCan ${tableId}/${coordinate}: ${err} (attempt ${attempt + 1})`);
    } finally {
      releaseStatCanSlot();
    }
  }
  console.error(`StatsCan ${tableId}/${coordinate}: all ${maxRetries} attempts failed`);
  return [];
}

export function fetchStatCanTimeSeries(
  tableId: number,
  coordinate: string,
  latestN: number = 24
): Promise<TimeSeriesPoint[]> {
  // Dedup by tableId+coordinate, using the largest latestN requested
  const key = `${tableId}:${coordinate}`;
  const existing = inflightCache.get(key);
  if (existing) {
    // Return cached promise, slicing to requested size
    return existing.then((pts) => pts.slice(-latestN));
  }
  // Fetch with a generous latestN to satisfy all callers
  const maxN = Math.max(latestN, 40);
  const promise = _fetchStatCanTimeSeries(tableId, coordinate, maxN);
  inflightCache.set(key, promise);
  // Clear from cache after resolution so next render cycle re-fetches
  promise.finally(() => {
    setTimeout(() => inflightCache.delete(key), 100);
  });
  return promise.then((pts) => pts.slice(-latestN));
}

// ============================================================
// CONVENIENCE: Edmonton development permits & property assessments
// ============================================================

export async function fetchEdmontonDevPermits(): Promise<TimeSeriesPoint[]> {
  try {
    const data = await fetchEdmontonData(EDMONTON_DATASETS.DEVELOPMENT_PERMITS, {
      $query:
        "SELECT date_trunc_ym(permit_date) as month, count(*) as cnt WHERE permit_date > '2023-01-01' GROUP BY date_trunc_ym(permit_date) ORDER BY month",
    });
    if (!Array.isArray(data)) return [];
    return data.map((row: { month: string; cnt: string }) => ({
      date: row.month?.split("T")[0] || "",
      value: parseInt(row.cnt || "0"),
    }));
  } catch {
    return [];
  }
}

export interface AssessmentByWard {
  ward: string;
  count: number;
  avgValue: number;
}

export async function fetchEdmontonAssessmentsByWard(): Promise<AssessmentByWard[]> {
  try {
    const data = await fetchEdmontonData(EDMONTON_DATASETS.PROPERTY_ASSESSMENTS, {
      $query:
        "SELECT ward, count(*) as cnt, avg(assessed_value::number) as avg_val WHERE tax_class='Residential' AND ward IS NOT NULL GROUP BY ward ORDER BY avg_val DESC",
    });
    if (!Array.isArray(data)) return [];
    return data.map((row: { ward: string; cnt: string; avg_val: string }) => ({
      ward: row.ward || "Unknown",
      count: parseInt(row.cnt || "0"),
      avgValue: Math.round(parseFloat(row.avg_val || "0")),
    }));
  } catch {
    return [];
  }
}

// ============================================================
// REAL ESTATE INTELLIGENCE
// ============================================================

export interface HotNeighbourhood {
  neighbourhood: string;
  permits: number;
  units: number;
  totalValue: number;
  avgValue: number;
}

export async function fetchHotNeighbourhoods(
  limit: number = 15
): Promise<HotNeighbourhood[]> {
  try {
    const data = await fetchEdmontonData(EDMONTON_DATASETS.BUILDING_PERMITS, {
      $query: `SELECT neighbourhood, count(*) as cnt, sum(units_added) as total_units, sum(construction_value) as total_val WHERE issue_date > '2025-01-01' AND (job_category='Single, Semi-detached & Rowhousing' OR job_category='House Combination') AND neighbourhood IS NOT NULL GROUP BY neighbourhood ORDER BY total_units DESC LIMIT ${limit}`,
    });
    if (!Array.isArray(data)) return [];
    return data.map(
      (row: {
        neighbourhood: string;
        cnt: string;
        total_units: string;
        total_val: string;
      }) => {
        const permits = parseInt(row.cnt || "0");
        const totalValue = parseInt(row.total_val || "0");
        return {
          neighbourhood: row.neighbourhood || "Unknown",
          permits,
          units: parseInt(row.total_units || "0"),
          totalValue,
          avgValue: permits > 0 ? Math.round(totalValue / permits) : 0,
        };
      }
    );
  } catch {
    return [];
  }
}

export interface ResidentialDevPermit {
  address: string;
  neighbourhood: string;
  neighbourhoodClass: string;
  description: string;
  date: string;
  status: string;
  zoning: string;
}

export async function fetchRecentResidentialDevPermits(
  limit: number = 20
): Promise<ResidentialDevPermit[]> {
  try {
    const data = await fetchEdmontonData(EDMONTON_DATASETS.DEVELOPMENT_PERMITS, {
      $query: `SELECT address, neighbourhood, neighbourhood_classification, description_of_development, permit_date, status, zoning WHERE permit_date > '2025-01-01' AND description_of_development like '%Residential%' ORDER BY permit_date DESC LIMIT ${limit}`,
    });
    if (!Array.isArray(data)) return [];
    return data.map(
      (row: {
        address: string;
        neighbourhood: string;
        neighbourhood_classification: string;
        description_of_development: string;
        permit_date: string;
        status: string;
        zoning: string;
      }) => ({
        address: row.address || "",
        neighbourhood: row.neighbourhood || "",
        neighbourhoodClass: row.neighbourhood_classification || "",
        description: row.description_of_development || "",
        date: row.permit_date?.split("T")[0] || "",
        status: row.status || "",
        zoning: row.zoning || "",
      })
    );
  } catch {
    return [];
  }
}

export interface RedevelopingArea {
  neighbourhood: string;
  permits: number;
}

export async function fetchRedevelopingActivity(): Promise<RedevelopingArea[]> {
  try {
    const data = await fetchEdmontonData(EDMONTON_DATASETS.DEVELOPMENT_PERMITS, {
      $query:
        "SELECT neighbourhood, count(*) as cnt WHERE permit_date > '2025-01-01' AND neighbourhood_classification = 'Redeveloping' AND description_of_development like '%Residential%' GROUP BY neighbourhood ORDER BY cnt DESC LIMIT 15",
    });
    if (!Array.isArray(data)) return [];
    return data.map((row: { neighbourhood: string; cnt: string }) => ({
      neighbourhood: row.neighbourhood || "Unknown",
      permits: parseInt(row.cnt || "0"),
    }));
  } catch {
    return [];
  }
}

export async function fetchResidentialPermitTrend(): Promise<TimeSeriesPoint[]> {
  try {
    const data = await fetchEdmontonData(EDMONTON_DATASETS.BUILDING_PERMITS, {
      $query:
        "SELECT date_trunc_ym(issue_date) as month, sum(units_added) as total_units WHERE issue_date > '2023-01-01' AND (job_category='Single, Semi-detached & Rowhousing' OR job_category='House Combination') GROUP BY date_trunc_ym(issue_date) ORDER BY month",
    });
    if (!Array.isArray(data)) return [];
    return data.map((row: { month: string; total_units: string }) => ({
      date: row.month?.split("T")[0] || "",
      value: parseInt(row.total_units || "0"),
    }));
  } catch {
    return [];
  }
}

export interface NeighbourhoodAssessment {
  neighbourhood: string;
  count: number;
  avgValue: number;
}

export async function fetchTopNeighbourhoodAssessments(
  limit: number = 15
): Promise<NeighbourhoodAssessment[]> {
  try {
    const data = await fetchEdmontonData(EDMONTON_DATASETS.PROPERTY_ASSESSMENTS, {
      $query: `SELECT neighbourhood, count(*) as cnt, avg(assessed_value::number) as avg_val WHERE tax_class='Residential' AND neighbourhood IS NOT NULL GROUP BY neighbourhood HAVING count(*) > 100 ORDER BY avg_val DESC LIMIT ${limit}`,
    });
    if (!Array.isArray(data)) return [];
    return data.map(
      (row: { neighbourhood: string; cnt: string; avg_val: string }) => ({
        neighbourhood: row.neighbourhood || "Unknown",
        count: parseInt(row.cnt || "0"),
        avgValue: Math.round(parseFloat(row.avg_val || "0")),
      })
    );
  } catch {
    return [];
  }
}

export async function fetchHomeImprovementHotspots(): Promise<
  HotNeighbourhood[]
> {
  try {
    const data = await fetchEdmontonData(EDMONTON_DATASETS.BUILDING_PERMITS, {
      $query:
        "SELECT neighbourhood, count(*) as cnt, sum(construction_value) as total_val WHERE issue_date > '2025-01-01' AND job_category='Home Improvement' AND neighbourhood IS NOT NULL GROUP BY neighbourhood ORDER BY cnt DESC LIMIT 15",
    });
    if (!Array.isArray(data)) return [];
    return data.map(
      (row: { neighbourhood: string; cnt: string; total_val: string }) => {
        const permits = parseInt(row.cnt || "0");
        const totalValue = parseInt(row.total_val || "0");
        return {
          neighbourhood: row.neighbourhood || "Unknown",
          permits,
          units: 0,
          totalValue,
          avgValue: permits > 0 ? Math.round(totalValue / permits) : 0,
        };
      }
    );
  } catch {
    return [];
  }
}

// ============================================================
// STRATHCONA COUNTY (ArcGIS REST — Sherwood Park & area)
// ============================================================

const STRATHCONA_DEV_PERMITS =
  "https://services.arcgis.com/B7ZrK1Hv4P1dsm9R/arcgis/rest/services/Development_Permits/FeatureServer/0";
const STRATHCONA_ASSESSMENTS =
  "https://services.arcgis.com/B7ZrK1Hv4P1dsm9R/arcgis/rest/services/2025%20Property%20Tax%20Assessment/FeatureServer/0";

async function fetchArcGIS(
  url: string,
  params: Record<string, string>
): Promise<Record<string, unknown>[]> {
  const searchParams = new URLSearchParams({
    f: "json",
    ...params,
  });
  const res = await fetch(`${url}/query?${searchParams.toString()}`, {
    next: { revalidate: 3600 },
  });
  const data = await res.json();
  if (!data?.features) return [];
  return data.features.map(
    (f: { attributes: Record<string, unknown> }) => f.attributes
  );
}

export interface StrathconaPermit {
  fileNum: string;
  description: string;
  subdivision: string;
  address: string;
  status: string;
  value: number;
  units: string;
  date: string;
}

export async function fetchStrathconaResidentialPermits(
  limit: number = 20
): Promise<StrathconaPermit[]> {
  try {
    const data = await fetchArcGIS(STRATHCONA_DEV_PERMITS, {
      where: "CATEGORY='RESIDENTIAL' AND ISSUE_YEAR>=2024",
      outFields:
        "EXTERNALFILENUM,DESCRIPTION,SUBDIVISION,CIVICADDRESS,STATUS,ISSUEDATE,DEVELOPMENTUSE,SQUAREFOOTAGE",
      orderByFields: "ISSUEDATE DESC",
      resultRecordCount: String(limit),
    });
    return data.map((a) => ({
      fileNum: String(a.EXTERNALFILENUM || ""),
      description: String(a.DESCRIPTION || ""),
      subdivision: String(a.SUBDIVISION || ""),
      address: String(a.CIVICADDRESS || ""),
      status: String(a.STATUS || ""),
      value: Number(a.SQUAREFOOTAGE || 0),
      units: String(a.DEVELOPMENTUSE || ""),
      date: a.ISSUEDATE
        ? new Date(Number(a.ISSUEDATE)).toISOString().split("T")[0]
        : "",
    }));
  } catch {
    return [];
  }
}

export interface StrathconaSubdivisionActivity {
  subdivision: string;
  permits: number;
  totalValue: number;
}

export async function fetchStrathconaHotSubdivisions(): Promise<
  StrathconaSubdivisionActivity[]
> {
  try {
    const data = await fetchArcGIS(STRATHCONA_DEV_PERMITS, {
      where: "CATEGORY='RESIDENTIAL' AND ISSUE_YEAR>=2024",
      outFields: "SUBDIVISION,SQUAREFOOTAGE",
      resultRecordCount: "2000",
    });
    // Aggregate by subdivision
    const map = new Map<
      string,
      { permits: number; totalValue: number }
    >();
    for (const row of data) {
      const sub = String(row.SUBDIVISION || "Unknown");
      const existing = map.get(sub) || { permits: 0, totalValue: 0 };
      existing.permits++;
      existing.totalValue += Number(row.SQUAREFOOTAGE || 0);
      map.set(sub, existing);
    }
    return Array.from(map.entries())
      .map(([subdivision, stats]) => ({ subdivision, ...stats }))
      .sort((a, b) => b.permits - a.permits)
      .slice(0, 15);
  } catch {
    return [];
  }
}

export interface StrathconaAssessment {
  neighbourhood: string;
  count: number;
  avgValue: number;
}

export async function fetchStrathconaAssessmentsByArea(): Promise<
  StrathconaAssessment[]
> {
  try {
    // ArcGIS doesn't support GROUP BY, so we fetch a sample and aggregate
    const data = await fetchArcGIS(STRATHCONA_ASSESSMENTS, {
      where: "1=1",
      outFields: "address,bldg,assess_2024",
      resultRecordCount: "5000",
      orderByFields: "assess_2024 DESC",
    });
    // Group by building type as a proxy for area comparison
    const map = new Map<
      string,
      { count: number; totalValue: number }
    >();
    for (const row of data) {
      const bldg = String(row.bldg || "Unknown");
      const existing = map.get(bldg) || { count: 0, totalValue: 0 };
      existing.count++;
      existing.totalValue += Number(row.assess_2024 || 0);
      map.set(bldg, existing);
    }
    return Array.from(map.entries())
      .map(([neighbourhood, stats]) => ({
        neighbourhood,
        count: stats.count,
        avgValue: Math.round(stats.totalValue / stats.count),
      }))
      .filter((a) => a.count >= 5)
      .sort((a, b) => b.avgValue - a.avgValue)
      .slice(0, 15);
  } catch {
    return [];
  }
}

// ============================================================
// ST. ALBERT (ArcGIS REST)
// ============================================================

const ST_ALBERT_DEV_PERMITS_CURRENT =
  "https://services1.arcgis.com/fyyY0cNXvmUWvX1x/arcgis/rest/services/DP_PastYear_YTD_ETL_public_view/FeatureServer/2";
const ST_ALBERT_DEV_PERMITS_PAST =
  "https://services1.arcgis.com/fyyY0cNXvmUWvX1x/arcgis/rest/services/DP_PastYear_YTD_ETL_public_view/FeatureServer/3";
const ST_ALBERT_ASSESSMENTS =
  "https://services1.arcgis.com/fyyY0cNXvmUWvX1x/arcgis/rest/services/LandscapeTaxAssessment2025_view/FeatureServer/0";

export interface StAlbertDevPermit {
  address: string;
  type: string;
  subject: string;
  status: string;
  date: string;
}

export async function fetchStAlbertDevPermits(
  limit: number = 20
): Promise<StAlbertDevPermit[]> {
  try {
    // Fetch from both current year and past year layers
    const [current, past] = await Promise.all([
      fetchArcGIS(ST_ALBERT_DEV_PERMITS_CURRENT, {
        where: "1=1",
        outFields: "ADDRESS,TYPE,SUBJECT,STATUS,APPROVED_DATE",
        orderByFields: "APPROVED_DATE DESC",
        resultRecordCount: String(limit),
      }),
      fetchArcGIS(ST_ALBERT_DEV_PERMITS_PAST, {
        where: "1=1",
        outFields: "ADDRESS,TYPE,SUBJECT,STATUS,APPROVED_DATE",
        orderByFields: "APPROVED_DATE DESC",
        resultRecordCount: String(limit),
      }),
    ]);
    const all = [...current, ...past]
      .map((a) => ({
        address: String(a.ADDRESS || ""),
        type: String(a.TYPE || ""),
        subject: String(a.SUBJECT || ""),
        status: String(a.STATUS || ""),
        date: a.APPROVED_DATE
          ? new Date(Number(a.APPROVED_DATE)).toISOString().split("T")[0]
          : "",
      }))
      .filter((p) => p.type.includes("RES") || p.subject.includes("DWELL"))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit);
    return all;
  } catch {
    return [];
  }
}

export interface StAlbertAssessment {
  neighbourhood: string;
  count: number;
  avgValue: number;
}

export async function fetchStAlbertDevPermitsSummary(): Promise<TimeSeriesPoint[]> {
  try {
    const data = await fetchArcGIS(ST_ALBERT_DEV_PERMITS_CURRENT, {
      where: "1=1",
      outFields: "TYPE,STATUS,APPROVED_DATE",
      resultRecordCount: "2000",
    });
    // Count by month
    const counts: Record<string, number> = {};
    for (const row of data) {
      if (!row.APPROVED_DATE) continue;
      const d = new Date(Number(row.APPROVED_DATE));
      const month = d.toISOString().slice(0, 7);
      counts[month] = (counts[month] || 0) + 1;
    }
    return Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ date: `${month}-01`, value: count }));
  } catch {
    return [];
  }
}

export async function fetchStAlbertAssessmentsByNeighbourhood(): Promise<
  StAlbertAssessment[]
> {
  try {
    const data = await fetchArcGIS(ST_ALBERT_ASSESSMENTS, {
      where: "Property_Class='Residential'",
      outFields: "Neighbourhood,Assessed_Value",
      resultRecordCount: "5000",
    });
    const map = new Map<
      string,
      { count: number; totalValue: number }
    >();
    for (const row of data) {
      const hood = String(row.Neighbourhood || "Unknown");
      const existing = map.get(hood) || { count: 0, totalValue: 0 };
      existing.count++;
      existing.totalValue += Number(row.Assessed_Value || 0);
      map.set(hood, existing);
    }
    return Array.from(map.entries())
      .map(([neighbourhood, stats]) => ({
        neighbourhood,
        count: stats.count,
        avgValue: Math.round(stats.totalValue / stats.count),
      }))
      .filter((a) => a.count >= 5)
      .sort((a, b) => b.avgValue - a.avgValue)
      .slice(0, 15);
  } catch {
    return [];
  }
}

// ============================================================
// PARKLAND COUNTY (ArcGIS REST — MapServer)
// ============================================================

const PARKLAND_PARCELS =
  "https://maps.parklandcounty.com/arcgis/rest/services/discoverParkland/Query/MapServer/2000";
const PARKLAND_LAND_USE =
  "https://maps.parklandcounty.com/arcgis/rest/services/Dynamics/DynamicsCRM/MapServer/29";
const PARKLAND_SUBDIVISIONS =
  "https://maps.parklandcounty.com/arcgis/rest/services/Dynamics/DynamicsCRM/MapServer/18";

// MapServer query works identically to FeatureServer — reuse fetchArcGIS

export interface ParklandSubdivisionAssessment {
  subdivision: string;
  count: number;
  avgAssessment: number;
  minAssessment: number;
  maxAssessment: number;
}

export async function fetchParklandAssessmentsBySubdivision(): Promise<
  ParklandSubdivisionAssessment[]
> {
  try {
    const data = await fetchArcGIS(PARKLAND_PARCELS, {
      where: "Subdivision IS NOT NULL AND Assessment IS NOT NULL",
      outFields: "Subdivision,Assessment,AssessmentYear",
      returnGeometry: "false",
      resultRecordCount: "5000",
    });
    const map = new Map<
      string,
      { count: number; total: number; min: number; max: number }
    >();
    for (const row of data) {
      const sub = String(row.Subdivision || "Unknown").trim();
      const val = parseFloat(String(row.Assessment || "0").replace(/[,$]/g, ""));
      if (isNaN(val) || val <= 0) continue;
      const existing = map.get(sub) || {
        count: 0,
        total: 0,
        min: Infinity,
        max: 0,
      };
      existing.count++;
      existing.total += val;
      existing.min = Math.min(existing.min, val);
      existing.max = Math.max(existing.max, val);
      map.set(sub, existing);
    }
    return Array.from(map.entries())
      .map(([subdivision, stats]) => ({
        subdivision,
        count: stats.count,
        avgAssessment: Math.round(stats.total / stats.count),
        minAssessment: stats.min === Infinity ? 0 : Math.round(stats.min),
        maxAssessment: Math.round(stats.max),
      }))
      .filter((a) => a.count >= 3)
      .sort((a, b) => b.count - a.count)
      .slice(0, 25);
  } catch {
    return [];
  }
}

export interface ParklandParcel {
  address: string;
  subdivision: string;
  assessment: number;
  assessmentYear: number;
  zoning: string;
  acreage: number;
  rollNo: string;
}

export async function fetchParklandRecentParcels(
  limit: number = 20
): Promise<ParklandParcel[]> {
  try {
    const data = await fetchArcGIS(PARKLAND_PARCELS, {
      where: "Subdivision IS NOT NULL AND Assessment IS NOT NULL",
      outFields:
        "MunicipalAddress,Subdivision,Assessment,AssessmentYear,Zoning,AreaAcre,RollNo",
      returnGeometry: "false",
      resultRecordCount: String(limit),
      orderByFields: "Assessment DESC",
    });
    return data.map((a) => ({
      address: String(a.MunicipalAddress || ""),
      subdivision: String(a.Subdivision || ""),
      assessment: parseFloat(String(a.Assessment || "0").replace(/[,$]/g, "")),
      assessmentYear: Number(a.AssessmentYear || 0),
      zoning: String(a.Zoning || ""),
      acreage: Number(a.AreaAcre || 0),
      rollNo: String(a.RollNo || ""),
    }));
  } catch {
    return [];
  }
}

export interface ParklandZoningSummary {
  zoning: string;
  zoningAbbr: string;
  areaHa: number;
}

export async function fetchParklandZoningSummary(): Promise<
  ParklandZoningSummary[]
> {
  try {
    const data = await fetchArcGIS(PARKLAND_LAND_USE, {
      where: "1=1",
      outFields: "Zoning,Zoning_Abbr,Hectares",
      returnGeometry: "false",
      resultRecordCount: "200",
    });
    // Aggregate by zoning type (multiple polygons per zone)
    const map = new Map<string, { abbr: string; totalHa: number }>();
    for (const row of data) {
      const zone = String(row.Zoning || "Unknown");
      const abbr = String(row.Zoning_Abbr || "");
      const ha = Number(row.Hectares || 0);
      const existing = map.get(zone) || { abbr, totalHa: 0 };
      existing.totalHa += ha;
      map.set(zone, existing);
    }
    return Array.from(map.entries())
      .map(([zoning, stats]) => ({
        zoning,
        zoningAbbr: stats.abbr,
        areaHa: Math.round(stats.totalHa),
      }))
      .sort((a, b) => b.areaHa - a.areaHa);
  } catch {
    return [];
  }
}

export interface ParklandSubdivisionInfo {
  name: string;
}

export async function fetchParklandSubdivisions(): Promise<
  ParklandSubdivisionInfo[]
> {
  try {
    const data = await fetchArcGIS(PARKLAND_SUBDIVISIONS, {
      where: "SubName IS NOT NULL",
      outFields: "SubName",
      returnGeometry: "false",
      resultRecordCount: "200",
    });
    const names = new Set<string>();
    for (const row of data) {
      const name = String(row.SubName || "").trim();
      if (name) names.add(name);
    }
    return Array.from(names)
      .sort()
      .map((name) => ({ name }));
  } catch {
    return [];
  }
}

export async function fetchParklandParcelCount(): Promise<number> {
  try {
    const res = await fetch(
      `${PARKLAND_PARCELS}/query?where=1%3D1&returnCountOnly=true&f=json`,
      { next: { revalidate: 86400 } }
    );
    const data = await res.json();
    return data.count || 0;
  } catch {
    return 0;
  }
}

export async function fetchParklandAssessmentsByZoning(): Promise<
  { zoning: string; count: number; avgAssessment: number }[]
> {
  try {
    const data = await fetchArcGIS(PARKLAND_PARCELS, {
      where: "Assessment IS NOT NULL AND Zoning IS NOT NULL",
      outFields: "Zoning,Assessment",
      returnGeometry: "false",
      resultRecordCount: "5000",
    });
    const map = new Map<string, { count: number; total: number }>();
    for (const row of data) {
      const zone = String(row.Zoning || "").trim();
      if (!zone) continue;
      const val = parseFloat(String(row.Assessment || "0").replace(/[,$]/g, ""));
      if (isNaN(val) || val <= 0) continue;
      const existing = map.get(zone) || { count: 0, total: 0 };
      existing.count++;
      existing.total += val;
      map.set(zone, existing);
    }
    return Array.from(map.entries())
      .map(([zoning, stats]) => ({
        zoning,
        count: stats.count,
        avgAssessment: Math.round(stats.total / stats.count),
      }))
      .sort((a, b) => b.count - a.count);
  } catch {
    return [];
  }
}

// ============================================================
// STONY PLAIN (ArcGIS Online — FeatureServer)
// ============================================================

const STONY_PLAIN_BASE =
  "https://services.arcgis.com/ScgF04sks0ZKbWe3/arcgis/rest/services";
const STONY_PLAIN_PARCELS = `${STONY_PLAIN_BASE}/Land_Development_Dashboard_Parcels_Public_View/FeatureServer/0`;
const STONY_PLAIN_ASSESSMENTS = `${STONY_PLAIN_BASE}/2026_Assessments/FeatureServer/0`;
const STONY_PLAIN_BUSINESSES = `${STONY_PLAIN_BASE}/ToSP_Businesses/FeatureServer/0`;
const STONY_PLAIN_VACANT = `${STONY_PLAIN_BASE}/Vacant_Lots/FeatureServer/0`;
const STONY_PLAIN_CONSTRUCTION = `${STONY_PLAIN_BASE}/Construction_Projects/FeatureServer/0`;
const STONY_PLAIN_NEIGHBOURHOODS = `${STONY_PLAIN_BASE}/Land_Development_Base_Layers_WFL1/FeatureServer/7`;
const STONY_PLAIN_LUB = `${STONY_PLAIN_BASE}/Land_Development_Base_Layers_WFL1/FeatureServer/11`;

export interface StonyPlainParcel {
  address: string;
  zoning: string;
  zoningName: string;
  yearBuilt: number;
  salePrice: number;
  assessment: number;
  assessmentYear: number;
  areaAcre: number;
  isDevelopable: boolean;
}

export async function fetchStonyPlainAssessmentsByZoning(): Promise<
  { zoning: string; zoningName: string; count: number; avgAssessment: number }[]
> {
  try {
    const data = await fetchArcGIS(STONY_PLAIN_PARCELS, {
      where: "TASS > 0 AND PMZONC IS NOT NULL",
      outFields: "PMZONC,TASS",
      returnGeometry: "false",
      resultRecordCount: "5000",
    });
    const map = new Map<string, { count: number; total: number }>();
    for (const row of data) {
      const zone = String(row.PMZONC || "").trim();
      if (!zone) continue;
      const val = Number(row.TASS || 0);
      if (val <= 0) continue;
      const existing = map.get(zone) || { count: 0, total: 0 };
      existing.count++;
      existing.total += val;
      map.set(zone, existing);
    }
    return Array.from(map.entries())
      .map(([zoning, stats]) => ({
        zoning,
        zoningName: zoning,
        count: stats.count,
        avgAssessment: Math.round(stats.total / stats.count),
      }))
      .sort((a, b) => b.count - a.count);
  } catch {
    return [];
  }
}

export async function fetchStonyPlainHighValueParcels(
  limit: number = 20
): Promise<StonyPlainParcel[]> {
  try {
    const data = await fetchArcGIS(STONY_PLAIN_PARCELS, {
      where: "TASS > 0",
      outFields:
        "PMNSD,PMZONC,PMYRBL,TXSLAM,TASS,PMYRAS,Area_Acre",
      returnGeometry: "false",
      resultRecordCount: String(limit),
      orderByFields: "TASS DESC",
    });
    return data.map((a) => ({
      address: String(a.PMNSD || ""),
      zoning: String(a.PMZONC || ""),
      zoningName: String(a.PMZONC || ""),
      yearBuilt: Number(a.PMYRBL || 0),
      salePrice: Number(a.TXSLAM || 0),
      assessment: Number(a.TASS || 0),
      assessmentYear: Number(a.PMYRAS || 0),
      areaAcre: Number(a.Area_Acre || 0),
      isDevelopable: false,
    }));
  } catch {
    return [];
  }
}

export interface StonyPlainBusiness {
  name: string;
  category: string;
  address: string;
}

export async function fetchStonyPlainBusinesses(): Promise<StonyPlainBusiness[]> {
  try {
    const data = await fetchArcGIS(STONY_PLAIN_BUSINESSES, {
      where: "1=1",
      outFields: "NAME,CATEGORY,Number,Street_Name,Street_Type",
      returnGeometry: "false",
      resultRecordCount: "500",
    });
    return data.map((a) => ({
      name: String(a.NAME || ""),
      category: String(a.CATEGORY || ""),
      address: `${a.Number || ""} ${a.Street_Name || ""} ${a.Street_Type || ""}`.trim(),
    }));
  } catch {
    return [];
  }
}

export async function fetchStonyPlainBusinessesByCategory(): Promise<
  { category: string; count: number }[]
> {
  try {
    const businesses = await fetchStonyPlainBusinesses();
    const map = new Map<string, number>();
    for (const b of businesses) {
      const cat = b.category || "Uncategorized";
      map.set(cat, (map.get(cat) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  } catch {
    return [];
  }
}

export async function fetchStonyPlainVacantLots(): Promise<
  { zoning: string; count: number; avgAssessment: number }[]
> {
  try {
    const data = await fetchArcGIS(STONY_PLAIN_VACANT, {
      where: "1=1",
      outFields: "PMZNC1,PMZND1,ASSES",
      returnGeometry: "false",
      resultRecordCount: "500",
    });
    const map = new Map<string, { count: number; total: number }>();
    for (const row of data) {
      const zone = String(row.PMZND1 || row.PMZNC1 || "Unknown");
      const val = Number(row.ASSES || 0);
      const existing = map.get(zone) || { count: 0, total: 0 };
      existing.count++;
      existing.total += val;
      map.set(zone, existing);
    }
    return Array.from(map.entries())
      .map(([zoning, stats]) => ({
        zoning,
        count: stats.count,
        avgAssessment: stats.count > 0 ? Math.round(stats.total / stats.count) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  } catch {
    return [];
  }
}

export interface StonyPlainConstruction {
  project: string;
  phase: string;
  manager: string;
  startDate: string;
  endDate: string;
  location: string;
}

export async function fetchStonyPlainConstructionProjects(): Promise<
  StonyPlainConstruction[]
> {
  try {
    const data = await fetchArcGIS(STONY_PLAIN_CONSTRUCTION, {
      where: "1=1",
      outFields: "Program,Project_Phase,Project_Manager,Start_Date,End_date,Location",
      returnGeometry: "false",
      resultRecordCount: "50",
    });
    return data.map((a) => ({
      project: String(a.Program || ""),
      phase: String(a.Project_Phase || ""),
      manager: String(a.Project_Manager || ""),
      startDate: a.Start_Date ? String(a.Start_Date) : "",
      endDate: a.End_date ? String(a.End_date) : "",
      location: String(a.Location || ""),
    }));
  } catch {
    return [];
  }
}

export async function fetchStonyPlainParcelCount(): Promise<number> {
  try {
    const res = await fetch(
      `${STONY_PLAIN_PARCELS}/query?where=1%3D1&returnCountOnly=true&f=json`,
      { next: { revalidate: 86400 } }
    );
    const data = await res.json();
    return data.count || 0;
  } catch {
    return 0;
  }
}

export async function fetchStonyPlainVacantCount(): Promise<number> {
  try {
    const res = await fetch(
      `${STONY_PLAIN_VACANT}/query?where=1%3D1&returnCountOnly=true&f=json`,
      { next: { revalidate: 86400 } }
    );
    const data = await res.json();
    return data.count || 0;
  } catch {
    return 0;
  }
}

// ============================================================
// SPRUCE GROVE (ArcGIS Server — MapServer + FeatureServer)
// ============================================================

const SPRUCE_GROVE_ADDRESSES =
  "https://gisinfo.sprucegrove.org/gis/rest/services/Integrations/MRFEnforcementCentreWFS/FeatureServer/0";
const SPRUCE_GROVE_ZONING =
  "https://gisinfo.sprucegrove.org/gis/rest/services/BusinessPartners/CorporateWMS/MapServer/30";
const SPRUCE_GROVE_DEV_STAGES =
  "https://gisinfo.sprucegrove.org/gis/rest/services/BusinessPartners/CorporateWMS/MapServer/40";


export async function fetchSpruceGroveAddressesBySubdivision(): Promise<
  { subdivision: string; count: number }[]
> {
  try {
    const data = await fetchArcGIS(SPRUCE_GROVE_ADDRESSES, {
      where: "SUBDIVISION IS NOT NULL",
      outFields: "SUBDIVISION",
      returnGeometry: "false",
      resultRecordCount: "5000",
    });
    const map = new Map<string, number>();
    for (const row of data) {
      const sub = String(row.SUBDIVISION || "").trim();
      if (!sub) continue;
      map.set(sub, (map.get(sub) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([subdivision, count]) => ({ subdivision, count }))
      .sort((a, b) => b.count - a.count);
  } catch {
    return [];
  }
}

export async function fetchSpruceGroveByPropertyType(): Promise<
  { type: string; count: number }[]
> {
  try {
    const data = await fetchArcGIS(SPRUCE_GROVE_ADDRESSES, {
      where: "ASSESS_DESC IS NOT NULL",
      outFields: "ASSESS_DESC",
      returnGeometry: "false",
      resultRecordCount: "5000",
    });
    const map = new Map<string, number>();
    for (const row of data) {
      const type = String(row.ASSESS_DESC || "").trim();
      if (!type) continue;
      map.set(type, (map.get(type) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  } catch {
    return [];
  }
}

export async function fetchSpruceGroveZoning(): Promise<
  { zoneClass: string; zoneDesc: string; count: number }[]
> {
  try {
    const data = await fetchArcGIS(SPRUCE_GROVE_ZONING, {
      where: "ZONECLASS IS NOT NULL",
      outFields: "ZONECLASS,ZONEDESC",
      returnGeometry: "false",
      resultRecordCount: "2000",
    });
    const map = new Map<string, { desc: string; count: number }>();
    for (const row of data) {
      const cls = String(row.ZONECLASS || "").trim();
      const desc = String(row.ZONEDESC || "").trim();
      if (!cls) continue;
      const existing = map.get(cls) || { desc, count: 0 };
      existing.count++;
      map.set(cls, existing);
    }
    return Array.from(map.entries())
      .map(([zoneClass, stats]) => ({
        zoneClass,
        zoneDesc: stats.desc,
        count: stats.count,
      }))
      .sort((a, b) => b.count - a.count);
  } catch {
    return [];
  }
}

export interface SpruceGroveDevelopmentStage {
  name: string;
  developer: string;
  residentialLots: number;
  totalLots: number;
  year: number;
  plan: string;
}

export async function fetchSprucGroveDevelopmentStages(): Promise<
  SpruceGroveDevelopmentStage[]
> {
  try {
    const data = await fetchArcGIS(SPRUCE_GROVE_DEV_STAGES, {
      where: "1=1",
      outFields:
        "StageFullName,DevelopmentName,Developer,ResidentialLotCount,TotalLotCount,Year,RegisteredPlan",
      returnGeometry: "false",
      resultRecordCount: "300",
      orderByFields: "Year DESC",
    });
    return data.map((a) => ({
      name: String(a.StageFullName || a.DevelopmentName || ""),
      developer: String(a.Developer || ""),
      residentialLots: Number(a.ResidentialLotCount || 0),
      totalLots: Number(a.TotalLotCount || 0),
      year: Number(a.Year || 0),
      plan: String(a.RegisteredPlan || ""),
    }));
  } catch {
    return [];
  }
}

export async function fetchSpruceGroveAddressCount(): Promise<number> {
  try {
    const res = await fetch(
      `${SPRUCE_GROVE_ADDRESSES}/query?where=1%3D1&returnCountOnly=true&f=json`,
      { next: { revalidate: 86400 } }
    );
    const data = await res.json();
    return data.count || 0;
  } catch {
    return 0;
  }
}

export async function fetchSpruceGroveVacantParcels(): Promise<
  { subdivision: string; count: number }[]
> {
  try {
    const data = await fetchArcGIS(SPRUCE_GROVE_ADDRESSES, {
      where: "ASSESS_DESC = 'VACANT RESIDENTIAL LAND' OR ASSESS_DESC = 'VACANT COMMERCIAL LAND'",
      outFields: "ASSESS_DESC,SUBDIVISION",
      returnGeometry: "false",
      resultRecordCount: "2000",
    });
    const map = new Map<string, number>();
    for (const row of data) {
      const type = String(row.ASSESS_DESC || "Unknown").trim();
      map.set(type, (map.get(type) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([subdivision, count]) => ({ subdivision, count }))
      .sort((a, b) => b.count - a.count);
  } catch {
    return [];
  }
}

// ============================================================
// EDMONTON ROAD CONSTRUCTION (SODA API)
// ============================================================

export interface RoadConstructionProject {
  fileNumber: string;
  startDate: string;
  finishDate: string;
  workReason: string;
  street: string;
  intersections: string;
  lat: number | null;
  lng: number | null;
}

export async function fetchEdmontonRoadConstruction(
  limit: number = 50
): Promise<RoadConstructionProject[]> {
  try {
    const data = await fetchEdmontonData(EDMONTON_DATASETS.ROAD_CONSTRUCTION, {
      $where: "work_reason IN('ROAD CONSTRUCTION NEW','ROAD CONSTRUCTION REHAB','LRT CONSTRUCTION','BRIDGE REHABILITATION','DRAINAGE INSTALL','TRAFFIC SIGNAL INSTALL')",
      $order: "start_date DESC",
      $limit: String(limit),
    });
    return (data || []).map((d: Record<string, unknown>) => ({
      fileNumber: String(d.file_number || ""),
      startDate: String(d.start_date || "").slice(0, 10),
      finishDate: String(d.finish_date || "").slice(0, 10),
      workReason: String(d.work_reason || ""),
      street: String(d.street_full_name || ""),
      intersections: String(d.road_segment_intersections || ""),
      lat: d.latitude ? Number(d.latitude) : null,
      lng: d.longitude ? Number(d.longitude) : null,
    }));
  } catch {
    return [];
  }
}

export async function fetchRoadConstructionByType(): Promise<
  { type: string; count: number }[]
> {
  try {
    const data = await fetchEdmontonData(EDMONTON_DATASETS.ROAD_CONSTRUCTION, {
      $select: "work_reason, count(*) as cnt",
      $group: "work_reason",
      $order: "cnt DESC",
      $limit: "20",
    });
    return (data || []).map((d: Record<string, unknown>) => ({
      type: String(d.work_reason || "Unknown").replace(/_/g, " "),
      count: Number(d.cnt || 0),
    }));
  } catch {
    return [];
  }
}

// ============================================================
// ALBERTA MUNICIPAL MILL RATES (Alberta Open Data XLSX)
// ============================================================

export interface MillRateEntry {
  municipality: string;
  status: string;
  residential: number;
  nonResidential: number;
  farmland: number;
  year: number;
}

const METRO_MUNICIPALITIES = [
  "EDMONTON",
  "ST. ALBERT",
  "SPRUCE GROVE",
  "STONY PLAIN",
  "STRATHCONA COUNTY",
  "PARKLAND COUNTY",
  "LEDUC",
  "BEAUMONT",
  "FORT SASKATCHEWAN",
  "DEVON",
  "MORINVILLE",
  "STURGEON COUNTY",
];

export async function fetchAlbertaMillRates(): Promise<MillRateEntry[]> {
  try {
    const url =
      "https://open.alberta.ca/dataset/cde4c4fd-a0b2-4816-af43-13de7a3fd3e3/resource/3a5ae050-ca7e-43b1-b3b9-8cea7330637b/download/2024_financial_year.xlsx";
    const res = await fetch(url, { next: { revalidate: 86400 } });
    const buffer = await res.arrayBuffer();
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "array" });

    // Find the mill rate sheet
    const sheetName = workbook.SheetNames.find((n: string) =>
      n.toLowerCase().includes("mill rate")
    );
    if (!sheetName) return [];

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: true,
    }) as unknown[][];

    const results: MillRateEntry[] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 9) continue;
      const municipality = String(row[3] || "").trim().toUpperCase();
      if (!METRO_MUNICIPALITIES.includes(municipality)) continue;

      results.push({
        municipality: String(row[3] || "").trim(),
        status: String(row[1] || "").trim(),
        residential: parseFloat(String(row[5] || 0)) || 0,
        nonResidential: parseFloat(String(row[7] || 0)) || 0,
        farmland: parseFloat(String(row[6] || 0)) || 0,
        year: parseInt(String(row[0] || 2024)) || 2024,
      });
    }
    return results.sort((a, b) => a.residential - b.residential);
  } catch {
    return [];
  }
}

// ============================================================
// ALBERTA MAJOR PROJECTS API
// ============================================================

export interface MajorProject {
  id: number;
  name: string;
  municipality: string;
  sector: string;
  stage: string;
  cost: number;
  developer: string;
  type: string;
  scheduleStart: string;
  scheduleEnd: string;
}

export async function fetchMajorProjects(
  municipalities?: string[]
): Promise<MajorProject[]> {
  try {
    const res = await fetch(
      "https://majorprojects.alberta.ca/api/MajorProjects",
      { next: { revalidate: 86400 } }
    );
    const geojson = await res.json();
    const features = geojson?.features || geojson || [];
    const projects: MajorProject[] = [];

    for (const feature of features) {
      const p = feature.properties || feature;
      const munis: string[] = Array.isArray(p.municipalities)
        ? p.municipalities
        : typeof p.municipalities === "string"
          ? [p.municipalities]
          : [];

      const matchesMuni =
        !municipalities ||
        municipalities.some((m) =>
          munis.some(
            (pm: string) =>
              pm.toLowerCase().includes(m.toLowerCase())
          )
        );
      if (!matchesMuni) continue;

      projects.push({
        id: p.id || 0,
        name: String(p.name || ""),
        municipality: munis.join(", "),
        sector: String(p.sector || ""),
        stage: String(p.stage || ""),
        cost: parseFloat(String(p.cost || 0)) || 0,
        developer: String(p.developer || ""),
        type: String(p.type || ""),
        scheduleStart: String(p.schedule || ""),
        scheduleEnd: String(p.scheduleEnd || ""),
      });
    }

    return projects.sort((a, b) => b.cost - a.cost);
  } catch {
    return [];
  }
}

export async function fetchMajorProjectsBySector(
  municipalities?: string[]
): Promise<{ sector: string; count: number; totalCost: number }[]> {
  const projects = await fetchMajorProjects(municipalities);
  const map = new Map<string, { count: number; totalCost: number }>();
  for (const p of projects) {
    const existing = map.get(p.sector) || { count: 0, totalCost: 0 };
    existing.count++;
    existing.totalCost += p.cost;
    map.set(p.sector, existing);
  }
  return Array.from(map.entries())
    .map(([sector, { count, totalCost }]) => ({ sector, count, totalCost }))
    .sort((a, b) => b.totalCost - a.totalCost);
}
