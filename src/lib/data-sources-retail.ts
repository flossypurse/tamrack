/**
 * Retail & Business data fetchers
 *
 * Sources:
 * - Statistics Canada WDS API — Monthly retail trade (20-10-0056), food services (21-10-0019),
 *   business openings/closures (33-10-0270)
 * - Edmonton Open Data (Socrata SODA) — Business licences (qhi4-bdpu)
 * - Alberta Open Data — Retail trade CSV
 *
 * All endpoints are free, no auth required.
 */

import {
  fetchStatCanTimeSeries,
  fetchEdmontonData,
  STATSCAN_SERIES,
  EDMONTON_DATASETS,
  type TimeSeriesPoint,
} from "./data-sources";

// ============================================================
// TYPES
// ============================================================

export interface RetailSubsectorPoint {
  date: string;
  total: number;
  motorVehicle: number;
  furniture: number;
  electronics: number;
  buildingMaterials: number;
  foodBeverage: number;
  health: number;
  gasoline: number;
  clothing: number;
  sporting: number;
  generalMerch: number;
}

export interface FoodServicesPoint {
  date: string;
  total: number;
  fullService: number;
  limitedService: number;
  drinking: number;
}

export interface BusinessDynamicsPoint {
  date: string;
  active: number;
  openings: number;
  closures: number;
}

export interface EdmontonBusinessLicence {
  tradeName: string;
  category: string;
  neighbourhood: string;
  status: string;
  issueDate: string;
  expiryDate: string;
  address: string;
}

export interface LicenceCategorySummary {
  category: string;
  count: number;
}

export interface LicenceNeighbourhoodSummary {
  neighbourhood: string;
  count: number;
}

export interface LicenceTrend {
  date: string;
  value: number;
}

// ============================================================
// RETAIL SALES BY SUBSECTOR
// ============================================================

export async function fetchRetailSubsectors(
  latestN: number = 60
): Promise<RetailSubsectorPoint[]> {
  try {
    const [
      total, motorVehicle, furniture, electronics, buildingMaterials,
      foodBeverage, health, gasoline, clothing, sporting, generalMerch,
    ] = await Promise.all([
      fetchStatCanTimeSeries(STATSCAN_SERIES.AB_RETAIL_SALES.tableId, STATSCAN_SERIES.AB_RETAIL_SALES.coordinate, latestN).catch(() => []),
      fetchStatCanTimeSeries(STATSCAN_SERIES.AB_RETAIL_MOTOR_VEHICLE.tableId, STATSCAN_SERIES.AB_RETAIL_MOTOR_VEHICLE.coordinate, latestN).catch(() => []),
      fetchStatCanTimeSeries(STATSCAN_SERIES.AB_RETAIL_FURNITURE.tableId, STATSCAN_SERIES.AB_RETAIL_FURNITURE.coordinate, latestN).catch(() => []),
      fetchStatCanTimeSeries(STATSCAN_SERIES.AB_RETAIL_ELECTRONICS.tableId, STATSCAN_SERIES.AB_RETAIL_ELECTRONICS.coordinate, latestN).catch(() => []),
      fetchStatCanTimeSeries(STATSCAN_SERIES.AB_RETAIL_BUILDING_MATERIALS.tableId, STATSCAN_SERIES.AB_RETAIL_BUILDING_MATERIALS.coordinate, latestN).catch(() => []),
      fetchStatCanTimeSeries(STATSCAN_SERIES.AB_RETAIL_FOOD_BEVERAGE.tableId, STATSCAN_SERIES.AB_RETAIL_FOOD_BEVERAGE.coordinate, latestN).catch(() => []),
      fetchStatCanTimeSeries(STATSCAN_SERIES.AB_RETAIL_HEALTH.tableId, STATSCAN_SERIES.AB_RETAIL_HEALTH.coordinate, latestN).catch(() => []),
      fetchStatCanTimeSeries(STATSCAN_SERIES.AB_RETAIL_GASOLINE.tableId, STATSCAN_SERIES.AB_RETAIL_GASOLINE.coordinate, latestN).catch(() => []),
      fetchStatCanTimeSeries(STATSCAN_SERIES.AB_RETAIL_CLOTHING.tableId, STATSCAN_SERIES.AB_RETAIL_CLOTHING.coordinate, latestN).catch(() => []),
      fetchStatCanTimeSeries(STATSCAN_SERIES.AB_RETAIL_SPORTING.tableId, STATSCAN_SERIES.AB_RETAIL_SPORTING.coordinate, latestN).catch(() => []),
      fetchStatCanTimeSeries(STATSCAN_SERIES.AB_RETAIL_GENERAL_MERCH.tableId, STATSCAN_SERIES.AB_RETAIL_GENERAL_MERCH.coordinate, latestN).catch(() => []),
    ]);

    // Build lookup maps by date
    const lookup = (arr: TimeSeriesPoint[]) => new Map(arr.map((p) => [p.date, p.value]));
    const mvMap = lookup(motorVehicle);
    const furMap = lookup(furniture);
    const elecMap = lookup(electronics);
    const buildMap = lookup(buildingMaterials);
    const foodMap = lookup(foodBeverage);
    const healthMap = lookup(health);
    const gasMap = lookup(gasoline);
    const clothMap = lookup(clothing);
    const sportMap = lookup(sporting);
    const genMap = lookup(generalMerch);

    return total.map((p) => ({
      date: p.date,
      total: p.value,
      motorVehicle: mvMap.get(p.date) ?? 0,
      furniture: furMap.get(p.date) ?? 0,
      electronics: elecMap.get(p.date) ?? 0,
      buildingMaterials: buildMap.get(p.date) ?? 0,
      foodBeverage: foodMap.get(p.date) ?? 0,
      health: healthMap.get(p.date) ?? 0,
      gasoline: gasMap.get(p.date) ?? 0,
      clothing: clothMap.get(p.date) ?? 0,
      sporting: sportMap.get(p.date) ?? 0,
      generalMerch: genMap.get(p.date) ?? 0,
    }));
  } catch (err) {
    console.warn("fetchRetailSubsectors failed:", err);
    return [];
  }
}

// ============================================================
// E-COMMERCE
// ============================================================

export async function fetchEcommerceSales(
  latestN: number = 60
): Promise<TimeSeriesPoint[]> {
  try {
    return await fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_RETAIL_ECOMMERCE.tableId,
      STATSCAN_SERIES.AB_RETAIL_ECOMMERCE.coordinate,
      latestN
    );
  } catch (err) {
    console.warn("fetchEcommerceSales failed:", err);
    return [];
  }
}

// ============================================================
// FOOD SERVICES & DRINKING PLACES
// ============================================================

export async function fetchFoodServices(
  latestN: number = 60
): Promise<FoodServicesPoint[]> {
  try {
    const [total, full, limited, drinking] = await Promise.all([
      fetchStatCanTimeSeries(STATSCAN_SERIES.AB_FOOD_SERVICES_TOTAL.tableId, STATSCAN_SERIES.AB_FOOD_SERVICES_TOTAL.coordinate, latestN).catch(() => []),
      fetchStatCanTimeSeries(STATSCAN_SERIES.AB_FOOD_SERVICES_FULL.tableId, STATSCAN_SERIES.AB_FOOD_SERVICES_FULL.coordinate, latestN).catch(() => []),
      fetchStatCanTimeSeries(STATSCAN_SERIES.AB_FOOD_SERVICES_LIMITED.tableId, STATSCAN_SERIES.AB_FOOD_SERVICES_LIMITED.coordinate, latestN).catch(() => []),
      fetchStatCanTimeSeries(STATSCAN_SERIES.AB_FOOD_SERVICES_DRINKING.tableId, STATSCAN_SERIES.AB_FOOD_SERVICES_DRINKING.coordinate, latestN).catch(() => []),
    ]);

    const fullMap = new Map(full.map((p) => [p.date, p.value]));
    const limitedMap = new Map(limited.map((p) => [p.date, p.value]));
    const drinkMap = new Map(drinking.map((p) => [p.date, p.value]));

    return total.map((p) => ({
      date: p.date,
      total: p.value,
      fullService: fullMap.get(p.date) ?? 0,
      limitedService: limitedMap.get(p.date) ?? 0,
      drinking: drinkMap.get(p.date) ?? 0,
    }));
  } catch (err) {
    console.warn("fetchFoodServices failed:", err);
    return [];
  }
}

// ============================================================
// BUSINESS OPENINGS & CLOSURES
// ============================================================

export async function fetchBusinessDynamics(
  latestN: number = 60
): Promise<BusinessDynamicsPoint[]> {
  try {
    const [active, openings, closures] = await Promise.all([
      fetchStatCanTimeSeries(STATSCAN_SERIES.AB_BUSINESS_COUNT.tableId, STATSCAN_SERIES.AB_BUSINESS_COUNT.coordinate, latestN).catch(() => []),
      fetchStatCanTimeSeries(STATSCAN_SERIES.AB_BUSINESS_OPENINGS.tableId, STATSCAN_SERIES.AB_BUSINESS_OPENINGS.coordinate, latestN).catch(() => []),
      fetchStatCanTimeSeries(STATSCAN_SERIES.AB_BUSINESS_CLOSURES.tableId, STATSCAN_SERIES.AB_BUSINESS_CLOSURES.coordinate, latestN).catch(() => []),
    ]);

    const openMap = new Map(openings.map((p) => [p.date, p.value]));
    const closeMap = new Map(closures.map((p) => [p.date, p.value]));

    return active.map((p) => ({
      date: p.date,
      active: p.value,
      openings: openMap.get(p.date) ?? 0,
      closures: closeMap.get(p.date) ?? 0,
    }));
  } catch (err) {
    console.warn("fetchBusinessDynamics failed:", err);
    return [];
  }
}

export async function fetchRetailBusinessDynamics(
  latestN: number = 60
): Promise<BusinessDynamicsPoint[]> {
  try {
    const [active, openings, closures] = await Promise.all([
      fetchStatCanTimeSeries(STATSCAN_SERIES.AB_BUSINESS_COUNT_RETAIL.tableId, STATSCAN_SERIES.AB_BUSINESS_COUNT_RETAIL.coordinate, latestN).catch(() => []),
      fetchStatCanTimeSeries(STATSCAN_SERIES.AB_BUSINESS_OPENINGS_RETAIL.tableId, STATSCAN_SERIES.AB_BUSINESS_OPENINGS_RETAIL.coordinate, latestN).catch(() => []),
      fetchStatCanTimeSeries(STATSCAN_SERIES.AB_BUSINESS_CLOSURES_RETAIL.tableId, STATSCAN_SERIES.AB_BUSINESS_CLOSURES_RETAIL.coordinate, latestN).catch(() => []),
    ]);

    const openMap = new Map(openings.map((p) => [p.date, p.value]));
    const closeMap = new Map(closures.map((p) => [p.date, p.value]));

    return active.map((p) => ({
      date: p.date,
      active: p.value,
      openings: openMap.get(p.date) ?? 0,
      closures: closeMap.get(p.date) ?? 0,
    }));
  } catch (err) {
    console.warn("fetchRetailBusinessDynamics failed:", err);
    return [];
  }
}

export async function fetchFoodBusinessDynamics(
  latestN: number = 60
): Promise<BusinessDynamicsPoint[]> {
  try {
    const [active, openings, closures] = await Promise.all([
      fetchStatCanTimeSeries(STATSCAN_SERIES.AB_BUSINESS_COUNT_FOOD.tableId, STATSCAN_SERIES.AB_BUSINESS_COUNT_FOOD.coordinate, latestN).catch(() => []),
      fetchStatCanTimeSeries(STATSCAN_SERIES.AB_BUSINESS_OPENINGS_FOOD.tableId, STATSCAN_SERIES.AB_BUSINESS_OPENINGS_FOOD.coordinate, latestN).catch(() => []),
      fetchStatCanTimeSeries(STATSCAN_SERIES.AB_BUSINESS_CLOSURES_FOOD.tableId, STATSCAN_SERIES.AB_BUSINESS_CLOSURES_FOOD.coordinate, latestN).catch(() => []),
    ]);

    const openMap = new Map(openings.map((p) => [p.date, p.value]));
    const closeMap = new Map(closures.map((p) => [p.date, p.value]));

    return active.map((p) => ({
      date: p.date,
      active: p.value,
      openings: openMap.get(p.date) ?? 0,
      closures: closeMap.get(p.date) ?? 0,
    }));
  } catch (err) {
    console.warn("fetchFoodBusinessDynamics failed:", err);
    return [];
  }
}

// ============================================================
// EDMONTON BUSINESS LICENCES (Socrata SODA)
// ============================================================

export async function fetchEdmontonBusinessLicences(
  limit: number = 5000
): Promise<EdmontonBusinessLicence[]> {
  try {
    const data = await fetchEdmontonData(EDMONTON_DATASETS.BUSINESS_LICENCES, {
      $limit: String(limit),
      $order: "issue_date DESC",
      $where: "status = 'ISSUED'",
    });
    return (data as Record<string, string>[]).map((r) => ({
      tradeName: r.trade_name || r.trading_name || "",
      category: r.category || r.licence_type || "",
      neighbourhood: r.neighbourhood || "",
      status: r.status || "",
      issueDate: r.issue_date || "",
      expiryDate: r.expiry_date || "",
      address: r.address || "",
    }));
  } catch (err) {
    console.warn("fetchEdmontonBusinessLicences failed:", err);
    return [];
  }
}

export async function fetchEdmontonLicencesByCategory(): Promise<LicenceCategorySummary[]> {
  try {
    const data = await fetchEdmontonData(EDMONTON_DATASETS.BUSINESS_LICENCES, {
      $query:
        "SELECT category, count(*) as cnt WHERE status = 'ISSUED' GROUP BY category ORDER BY cnt DESC LIMIT 25",
    });
    return (data as Record<string, string>[]).map((r) => ({
      category: r.category || "Unknown",
      count: parseInt(r.cnt, 10) || 0,
    }));
  } catch (err) {
    console.warn("fetchEdmontonLicencesByCategory failed:", err);
    return [];
  }
}

export async function fetchEdmontonLicencesByNeighbourhood(): Promise<LicenceNeighbourhoodSummary[]> {
  try {
    const data = await fetchEdmontonData(EDMONTON_DATASETS.BUSINESS_LICENCES, {
      $query:
        "SELECT neighbourhood, count(*) as cnt WHERE status = 'ISSUED' AND neighbourhood IS NOT NULL GROUP BY neighbourhood ORDER BY cnt DESC LIMIT 25",
    });
    return (data as Record<string, string>[]).map((r) => ({
      neighbourhood: r.neighbourhood || "Unknown",
      count: parseInt(r.cnt, 10) || 0,
    }));
  } catch (err) {
    console.warn("fetchEdmontonLicencesByNeighbourhood failed:", err);
    return [];
  }
}

export async function fetchEdmontonLicenceMonthlyTrend(): Promise<LicenceTrend[]> {
  try {
    const data = await fetchEdmontonData(EDMONTON_DATASETS.BUSINESS_LICENCES, {
      $query:
        "SELECT date_trunc_ym(issue_date) as month, count(*) as cnt WHERE issue_date > '2020-01-01' GROUP BY date_trunc_ym(issue_date) ORDER BY month",
    });
    return (data as Record<string, string>[]).map((r) => ({
      date: r.month ? r.month.slice(0, 7) : "",
      value: parseInt(r.cnt, 10) || 0,
    }));
  } catch (err) {
    console.warn("fetchEdmontonLicenceMonthlyTrend failed:", err);
    return [];
  }
}

// ============================================================
// ALBERTA OPEN DATA — RETAIL TRADE CSV
// ============================================================

const AB_RETAIL_CSV_URL =
  "https://open.alberta.ca/dataset/61c19b7c-5e5c-4be2-87a7-9b6c3ca0e36e/resource/cc8e5a51-3543-4776-8c70-3b7f8b900e4a/download/retail-trade.csv";

export async function fetchAlbertaRetailTradeCSV(): Promise<TimeSeriesPoint[]> {
  try {
    const res = await fetch(AB_RETAIL_CSV_URL, { next: { revalidate: 86400 } });
    if (!res.ok) {
      console.warn(`Alberta retail CSV: HTTP ${res.status}`);
      return [];
    }
    const text = await res.text();
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];

    // Parse CSV — header row then data rows
    const header = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
    const dateIdx = header.findIndex((h) => /date|period|ref/i.test(h));
    const valueIdx = header.findIndex((h) => /value|sales|retail/i.test(h));

    if (dateIdx < 0 || valueIdx < 0) {
      // Fallback: assume first col is date, second is value
      return lines.slice(1).map((line) => {
        const cols = line.split(",").map((c) => c.trim().replace(/"/g, ""));
        return { date: cols[0], value: parseFloat(cols[1]) || 0 };
      }).filter((p) => p.date && !isNaN(p.value));
    }

    return lines.slice(1).map((line) => {
      const cols = line.split(",").map((c) => c.trim().replace(/"/g, ""));
      return { date: cols[dateIdx], value: parseFloat(cols[valueIdx]) || 0 };
    }).filter((p) => p.date && !isNaN(p.value));
  } catch (err) {
    console.warn("fetchAlbertaRetailTradeCSV failed:", err);
    return [];
  }
}
