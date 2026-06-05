// Generic data fetchers that work with any municipality in the registry
// Reads endpoint URLs + field mappings from MunicipalityConfig

import { type MunicipalityConfig } from "./municipality-registry";

// ============================================================
// Generic ArcGIS fetcher (reusable across all municipalities)
// ============================================================

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

async function fetchCount(url: string): Promise<number> {
  const res = await fetch(
    `${url}/query?where=1%3D1&returnCountOnly=true&f=json`,
    { next: { revalidate: 86400 } }
  );
  const data = await res.json();
  return data.count || 0;
}

// Socrata (Calgary, Lethbridge) fetcher
async function fetchSocrata(
  url: string,
  params: Record<string, string>
): Promise<Record<string, unknown>[]> {
  const searchParams = new URLSearchParams(params);
  const res = await fetch(`${url}?${searchParams.toString()}`, {
    next: { revalidate: 3600 },
  });
  return res.json();
}

function isSocrataEndpoint(url: string): boolean {
  return url.includes("/resource/") && url.endsWith(".json");
}

// ============================================================
// Standardized result types
// ============================================================

export interface AssessmentByGroup {
  group: string;        // zoning, neighbourhood, subdivision — whatever grouping field is available
  count: number;
  avgAssessment: number;
  minAssessment: number;
  maxAssessment: number;
}

export interface TopProperty {
  address: string;
  assessment: number;
  zoning: string;
  neighbourhood: string;
  yearBuilt: number;
  salePrice: number;
}

export interface BusinessCategory {
  category: string;
  count: number;
}

export interface VacantLot {
  group: string;
  count: number;
  avgAssessment: number;
}

export interface ConstructionProject {
  project: string;
  phase: string;
  startDate: string;
  endDate: string;
  location: string;
}

export interface PermitSummary {
  group: string;       // subdivision, neighbourhood, or type
  count: number;
  totalValue: number;
}

export interface RecentPermit {
  type: string;
  address: string;
  date: string;
  value: number;
  description: string;
  municipality: string;
}

export interface MunicipalityMetrics {
  totalParcels: number;
  totalAssessed: number;
  avgAssessment: number;
  medianAssessment: number;
  topZoning: string;
  vacantCount: number;
  businessCount: number;
}

// ============================================================
// Generic fetchers
// ============================================================

export async function fetchAssessmentsByGroup(
  config: MunicipalityConfig,
  groupBy: "zoning" | "neighbourhood" | "subdivision" = "zoning"
): Promise<AssessmentByGroup[]> {
  const endpoint = config.endpoints.assessments || config.endpoints.parcels;
  if (!endpoint) return [];

  const valueField = config.fields.assessmentValue;
  if (!valueField) return [];

  // Determine grouping field
  let groupField: string | undefined;
  if (groupBy === "zoning") groupField = config.fields.zoning;
  else if (groupBy === "neighbourhood") groupField = config.fields.neighbourhood;
  else if (groupBy === "subdivision") groupField = config.fields.subdivision;
  if (!groupField) {
    // Fall back to whatever is available
    groupField = config.fields.neighbourhood || config.fields.zoning || config.fields.subdivision;
  }
  if (!groupField) return [];

  try {
    let data: Record<string, unknown>[];

    if (isSocrataEndpoint(endpoint.url)) {
      // Socrata API — use a custom assessmentWhere if supplied (e.g. when the
      // assessment value column is stored as TEXT so "field > 0" is a type error).
      const socrataWhere = config.filters?.assessmentWhere
        || `${valueField} > 0 AND ${groupField} IS NOT NULL`;
      data = await fetchSocrata(endpoint.url, {
        $select: `${groupField}, ${valueField}`,
        $where: socrataWhere,
        $limit: "5000",
      });
    } else {
      // ArcGIS
      data = await fetchArcGIS(endpoint.url, {
        where: config.filters?.assessmentWhere || `${valueField} > 0`,
        outFields: `${groupField},${valueField}`,
        returnGeometry: "false",
        resultRecordCount: "5000",
      });
    }

    const map = new Map<string, { count: number; total: number; min: number; max: number }>();
    for (const row of data) {
      const group = String(row[groupField] || "Unknown").trim();
      if (!group || group === "Unknown") continue;
      const val = parseFloat(String(row[valueField] || "0").replace(/[,$]/g, ""));
      if (isNaN(val) || val <= 0) continue;
      const existing = map.get(group) || { count: 0, total: 0, min: Infinity, max: 0 };
      existing.count++;
      existing.total += val;
      existing.min = Math.min(existing.min, val);
      existing.max = Math.max(existing.max, val);
      map.set(group, existing);
    }

    return Array.from(map.entries())
      .map(([group, stats]) => ({
        group,
        count: stats.count,
        avgAssessment: Math.round(stats.total / stats.count),
        minAssessment: stats.min === Infinity ? 0 : Math.round(stats.min),
        maxAssessment: Math.round(stats.max),
      }))
      .filter((a) => a.count >= 3)
      .sort((a, b) => b.count - a.count);
  } catch {
    return [];
  }
}

export async function fetchTopProperties(
  config: MunicipalityConfig,
  limit: number = 20
): Promise<TopProperty[]> {
  const endpoint = config.endpoints.assessments || config.endpoints.parcels;
  if (!endpoint) return [];

  const valueField = config.fields.assessmentValue;
  if (!valueField) return [];

  const addressField = config.fields.address || "ADDRESS";
  const zoningField = config.fields.zoning || "";
  const neighbourhoodField = config.fields.neighbourhood || config.fields.subdivision || "";
  const yearBuiltField = config.fields.yearBuilt || "";
  const salePriceField = config.fields.salePrice || "";

  const outFields = [addressField, valueField, zoningField, neighbourhoodField, yearBuiltField, salePriceField]
    .filter(Boolean)
    .join(",");

  try {
    let data: Record<string, unknown>[];

    if (isSocrataEndpoint(endpoint.url)) {
      data = await fetchSocrata(endpoint.url, {
        $select: outFields,
        $where: `${valueField} > 0`,
        $order: `${valueField} DESC`,
        $limit: String(limit),
      });
    } else {
      data = await fetchArcGIS(endpoint.url, {
        where: config.filters?.assessmentWhere || `${valueField} > 0`,
        outFields,
        returnGeometry: "false",
        resultRecordCount: String(limit),
        orderByFields: `${valueField} DESC`,
      });
    }

    return data.map((a) => ({
      address: String(a[addressField] || ""),
      assessment: parseFloat(String(a[valueField] || "0").replace(/[,$]/g, "")) || 0,
      zoning: zoningField ? String(a[zoningField] || "") : "",
      neighbourhood: neighbourhoodField ? String(a[neighbourhoodField] || "") : "",
      yearBuilt: yearBuiltField ? Number(a[yearBuiltField] || 0) : 0,
      salePrice: salePriceField ? Number(a[salePriceField] || 0) : 0,
    }));
  } catch {
    return [];
  }
}

export async function fetchParcelCount(config: MunicipalityConfig): Promise<number> {
  const endpoint = config.endpoints.assessments || config.endpoints.parcels;
  if (!endpoint) return 0;

  try {
    if (isSocrataEndpoint(endpoint.url)) {
      const data = await fetchSocrata(endpoint.url, {
        $select: "count(*) as cnt",
      });
      return Number(data?.[0]?.cnt || 0);
    }
    return fetchCount(endpoint.url);
  } catch {
    return 0;
  }
}

export async function fetchBusinessCategories(
  config: MunicipalityConfig
): Promise<BusinessCategory[]> {
  const endpoint = config.endpoints.businesses;
  if (!endpoint) return [];

  const categoryField = config.fields.businessCategory;
  if (!categoryField) return [];

  try {
    const data = await fetchArcGIS(endpoint.url, {
      where: "1=1",
      outFields: categoryField,
      returnGeometry: "false",
      resultRecordCount: "2000",
    });

    const map = new Map<string, number>();
    for (const row of data) {
      const cat = String(row[categoryField] || "Uncategorized").trim();
      map.set(cat, (map.get(cat) || 0) + 1);
    }

    return Array.from(map.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  } catch {
    return [];
  }
}

export async function fetchVacantLots(
  config: MunicipalityConfig
): Promise<VacantLot[]> {
  const endpoint = config.endpoints.vacantLots;
  if (!endpoint) return [];

  const zoningField = config.fields.vacantZoning || config.fields.zoning || "ZONING";
  const assessField = config.fields.vacantAssessment || config.fields.assessmentValue || "";

  try {
    const outFields = [zoningField, assessField].filter(Boolean).join(",");
    const data = await fetchArcGIS(endpoint.url, {
      where: "1=1",
      outFields,
      returnGeometry: "false",
      resultRecordCount: "2000",
    });

    const map = new Map<string, { count: number; total: number }>();
    for (const row of data) {
      const zone = String(row[zoningField] || "Unknown").trim();
      const val = assessField ? Number(row[assessField] || 0) : 0;
      const existing = map.get(zone) || { count: 0, total: 0 };
      existing.count++;
      existing.total += val;
      map.set(zone, existing);
    }

    return Array.from(map.entries())
      .map(([group, stats]) => ({
        group,
        count: stats.count,
        avgAssessment: stats.count > 0 ? Math.round(stats.total / stats.count) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  } catch {
    return [];
  }
}

export async function fetchVacantCount(config: MunicipalityConfig): Promise<number> {
  const endpoint = config.endpoints.vacantLots;
  if (!endpoint) return 0;
  try {
    return fetchCount(endpoint.url);
  } catch {
    return 0;
  }
}

export async function fetchConstructionProjects(
  config: MunicipalityConfig
): Promise<ConstructionProject[]> {
  const endpoint = config.endpoints.construction;
  if (!endpoint) return [];

  const f = config.fields;
  const nameField = f.projectName || "Program";
  const phaseField = f.projectPhase || "Project_Phase";
  const startField = f.projectStart || "Start_Date";
  const endField = f.projectEnd || "End_date";
  const locField = f.projectLocation || "Location";

  try {
    const data = await fetchArcGIS(endpoint.url, {
      where: "1=1",
      outFields: [nameField, phaseField, startField, endField, locField].join(","),
      returnGeometry: "false",
      resultRecordCount: "50",
    });

    return data.map((a) => ({
      project: String(a[nameField] || ""),
      phase: String(a[phaseField] || ""),
      startDate: a[startField] ? String(a[startField]) : "",
      endDate: a[endField] ? String(a[endField]) : "",
      location: String(a[locField] || ""),
    }));
  } catch {
    return [];
  }
}

export async function fetchPermitsByGroup(
  config: MunicipalityConfig,
  limit: number = 2000
): Promise<PermitSummary[]> {
  // Prefer the dedicated building-permits endpoint for group snapshots.
  // devPermits (development applications) uses different field names than the
  // building-permits endpoint, so mixing them yields no-such-column errors for
  // cities like Edmonton/Calgary that have both.  Fall back to devPermits for
  // municipalities that only publish development permits (e.g. Strathcona, St. Albert).
  const endpoint = config.endpoints.permits || config.endpoints.devPermits;
  if (!endpoint) return [];

  const groupField = config.fields.subdivision || config.fields.permitType || "";
  if (!groupField) return [];

  const valueField = config.fields.permitValue || "";

  try {
    let data: Record<string, unknown>[];

    if (isSocrataEndpoint(endpoint.url)) {
      data = await fetchSocrata(endpoint.url, {
        $select: `${groupField}, count(*) as cnt${valueField ? `, sum(${valueField}) as total_value` : ""}`,
        $group: groupField,
        $order: "cnt DESC",
        $limit: "50",
      });
      return (data || []).map((d) => ({
        group: String(d[groupField] || "Unknown"),
        count: Number(d.cnt || 0),
        totalValue: Number(d.total_value || 0),
      }));
    }

    const outFields = [groupField, valueField].filter(Boolean).join(",");
    data = await fetchArcGIS(endpoint.url, {
      where: config.filters?.residentialFilter || "1=1",
      outFields,
      returnGeometry: "false",
      resultRecordCount: String(limit),
    });

    const map = new Map<string, { count: number; totalValue: number }>();
    for (const row of data) {
      const group = String(row[groupField] || "Unknown").trim();
      const val = valueField ? Number(row[valueField] || 0) : 0;
      const existing = map.get(group) || { count: 0, totalValue: 0 };
      existing.count++;
      existing.totalValue += val;
      map.set(group, existing);
    }

    return Array.from(map.entries())
      .map(([group, stats]) => ({ group, count: stats.count, totalValue: stats.totalValue }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 25);
  } catch {
    return [];
  }
}

export async function fetchRecentPermits(
  config: MunicipalityConfig,
  limit: number = 50
): Promise<RecentPermit[]> {
  const endpoint = config.endpoints.devPermits || config.endpoints.permits;
  if (!endpoint) return [];

  const typeField = config.fields.permitType || "";
  const addressField = config.fields.permitAddress || config.fields.address || "";
  const dateField = config.fields.permitDate || "";
  const valueField = config.fields.permitValue || "";
  const descField = config.fields.permitDescription || "";

  const outFields = [typeField, addressField, dateField, valueField, descField]
    .filter(Boolean)
    .join(",");

  if (!outFields) return [];

  try {
    let data: Record<string, unknown>[];

    if (isSocrataEndpoint(endpoint.url)) {
      const params: Record<string, string> = {
        $select: outFields,
        $limit: String(limit),
      };
      if (dateField) {
        params.$order = `${dateField} DESC`;
      }
      data = await fetchSocrata(endpoint.url, params);
    } else {
      data = await fetchArcGIS(endpoint.url, {
        where: config.filters?.residentialFilter || "1=1",
        outFields,
        returnGeometry: "false",
        resultRecordCount: String(limit),
        ...(dateField ? { orderByFields: `${dateField} DESC` } : {}),
      });
    }

    return (data || []).map((row) => {
      let date = "";
      if (dateField && row[dateField]) {
        const raw = row[dateField];
        if (typeof raw === "number" && raw > 1_000_000_000) {
          // Epoch milliseconds
          date = new Date(raw).toISOString().slice(0, 10);
        } else {
          const str = String(raw);
          const parsed = new Date(str);
          date = isNaN(parsed.getTime()) ? str.slice(0, 10) : parsed.toISOString().slice(0, 10);
        }
      }

      return {
        type: typeField ? String(row[typeField] || "").trim() : "",
        address: addressField ? String(row[addressField] || "").trim() : "",
        date,
        value: valueField ? Number(row[valueField] || 0) : 0,
        description: descField ? String(row[descField] || "").trim() : "",
        municipality: config.name,
      };
    }).filter((p) => p.type || p.address || p.description);
  } catch {
    return [];
  }
}

export async function fetchMunicipalityMetrics(
  config: MunicipalityConfig
): Promise<MunicipalityMetrics> {
  const [parcelCount, assessments, vacantCount, businesses] = await Promise.all([
    fetchParcelCount(config),
    fetchAssessmentsByGroup(config, "zoning"),
    config.capabilities.includes("vacant_lots") ? fetchVacantCount(config) : Promise.resolve(0),
    config.capabilities.includes("businesses") ? fetchBusinessCategories(config).then((b) => b.reduce((s, c) => s + c.count, 0)) : Promise.resolve(0),
  ]);

  const totalAssessed = assessments.reduce((s, a) => s + a.count, 0);
  const avgAssessment = assessments.length > 0
    ? Math.round(assessments.reduce((s, a) => s + a.avgAssessment * a.count, 0) / Math.max(totalAssessed, 1))
    : 0;
  const topZoning = assessments[0]?.group || "N/A";

  return {
    totalParcels: parcelCount,
    totalAssessed,
    avgAssessment,
    medianAssessment: 0,
    topZoning,
    vacantCount,
    businessCount: businesses,
  };
}
