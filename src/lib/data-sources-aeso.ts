// Data fetching modules for AESO (Alberta Electric System Operator).
//
// STATUS: The legacy api.aeso.ca host is decommissioned (CNAME api.gtm.aeso.ca
// has no A record as of 2026-05-27, confirmed from Fly yyz + public DNS).
// AESO migrated its API to an Azure APIM gateway at https://apimgw.aeso.ca,
// with the developer portal at https://developer-apim.aeso.ca. The new gateway
// requires a re-registered subscription key sent as Ocp-Apim-Subscription-Key,
// and endpoint paths may differ. Until that migration lands, every fetcher
// below resolves to null/[] and the electricity surface returns empty results.
const AESO_BASE = "https://api.aeso.ca";

// ============================================================
// Types
// ============================================================

export interface PoolPricePoint {
  date: string;
  hour: number;
  price: number;
  rollingAvg30: number;
}

export interface SupplyDemandReport {
  totalGeneration: number;
  totalLoad: number;
  netExports: number;
  generationByFuel: { fuel: string; generation: number; capacity: number }[];
}

export interface SystemMarginalPricePoint {
  date: string;
  hour: number;
  price: number;
}

export interface ActualForecastPoint {
  date: string;
  hour: number;
  forecast: number;
  actual: number;
}

export interface TimeSeriesPoint {
  date: string;
  value: number;
  label?: string;
}

// ============================================================
// Generic fetcher
// ============================================================

async function fetchAESO(
  path: string,
  params?: Record<string, string>
): Promise<any> {
  const apiKey = process.env.AESO_API_KEY;
  if (!apiKey) {
    console.warn("[AESO] Missing AESO_API_KEY environment variable");
    return null;
  }

  try {
    const url = new URL(`${AESO_BASE}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }

    const res = await fetch(url.toString(), {
      headers: { "X-API-Key": apiKey },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      console.warn(`[AESO] ${res.status} ${res.statusText} for ${path}`);
      return null;
    }

    return await res.json();
  } catch (err) {
    console.warn(`[AESO] fetch error for ${path}:`, err);
    return null;
  }
}

// ============================================================
// Pool Price (real-time electricity price)
// ============================================================

export async function fetchPoolPrice(
  startDate?: string,
  endDate?: string
): Promise<PoolPricePoint[]> {
  const params: Record<string, string> = {};
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;

  const data = await fetchAESO("/report/v1.1/price/poolPrice", params);
  if (!data?.return?.["Pool Price Report"]) return [];

  return data.return["Pool Price Report"].map((row: any) => ({
    date: row.begin_datetime_utc?.split(" ")[0] ?? row.begin_datetime_mpt?.split(" ")[0] ?? "",
    hour: parseInt(row.begin_datetime_mpt?.split(" ")[1]?.split(":")[0] ?? "0", 10),
    price: parseFloat(row.pool_price) || 0,
    rollingAvg30: parseFloat(row.rolling_30day_avg) || 0,
  }));
}

// ============================================================
// Current Supply Demand
// ============================================================

export async function fetchCurrentSupplyDemand(): Promise<SupplyDemandReport | null> {
  const data = await fetchAESO("/report/v2/csd/summary");
  if (!data?.return) return null;

  const summary = data.return;
  const generationByFuel = (summary.generationDataList ?? []).map((g: any) => ({
    fuel: g.fuel_type ?? "",
    generation: parseFloat(g.aggregated_net_generation) || 0,
    capacity: parseFloat(g.aggregated_maximum_capability) || 0,
  }));

  return {
    totalGeneration: parseFloat(summary.totalGeneration ?? summary.total_net_generation) || 0,
    totalLoad: parseFloat(summary.totalLoad ?? summary.alberta_internal_load) || 0,
    netExports: parseFloat(summary.netExports ?? summary.net_actual_interchange) || 0,
    generationByFuel,
  };
}

// ============================================================
// System Marginal Price
// ============================================================

export async function fetchSystemMarginalPrice(
  startDate?: string,
  endDate?: string
): Promise<SystemMarginalPricePoint[]> {
  const params: Record<string, string> = {};
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;

  const data = await fetchAESO("/report/v1/price/systemMarginalPrice", params);
  if (!data?.return?.["System Marginal Price Report"]) return [];

  return data.return["System Marginal Price Report"].map((row: any) => ({
    date: row.begin_datetime_utc?.split(" ")[0] ?? row.begin_datetime_mpt?.split(" ")[0] ?? "",
    hour: parseInt(row.begin_datetime_mpt?.split(" ")[1]?.split(":")[0] ?? "0", 10),
    price: parseFloat(row.system_marginal_price) || 0,
  }));
}

// ============================================================
// Actual Forecast (generation forecast vs actual)
// ============================================================

export async function fetchActualForecast(
  startDate?: string
): Promise<ActualForecastPoint[]> {
  const params: Record<string, string> = {};
  if (startDate) params.startDate = startDate;

  const data = await fetchAESO("/report/v1/load/actualForecast", params);
  if (!data?.return?.["Actual Forecast Report"]) return [];

  return data.return["Actual Forecast Report"].map((row: any) => ({
    date: row.begin_datetime_mpt?.split(" ")[0] ?? "",
    hour: parseInt(row.begin_datetime_mpt?.split(" ")[1]?.split(":")[0] ?? "0", 10),
    forecast: parseFloat(row.forecast_pool_price ?? row.forecast) || 0,
    actual: parseFloat(row.actual_posted_pool_price ?? row.actual) || 0,
  }));
}

// ============================================================
// Convenience: daily average pool price time series
// ============================================================

export async function fetchPoolPriceTimeSeries(
  days: number = 30
): Promise<TimeSeriesPoint[]> {
  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - days * 86400000)
    .toISOString()
    .split("T")[0];

  const points = await fetchPoolPrice(startDate, endDate);
  if (!points.length) return [];

  // Group by date and compute daily average
  const dailyMap = new Map<string, { sum: number; count: number }>();
  for (const pt of points) {
    const entry = dailyMap.get(pt.date);
    if (entry) {
      entry.sum += pt.price;
      entry.count += 1;
    } else {
      dailyMap.set(pt.date, { sum: pt.price, count: 1 });
    }
  }

  return Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { sum, count }]) => ({
      date,
      value: Math.round((sum / count) * 100) / 100,
      label: `$${(sum / count).toFixed(2)}/MWh`,
    }));
}
