/**
 * Crime & Safety data fetchers
 *
 * Sources:
 * - Alberta Regional Dashboard — Crime Severity Index for all municipalities
 * - Calgary Open Data (Socrata SODA) — Community crime & disorder stats
 *
 * All endpoints are free, no auth required.
 * Data is cached daily (revalidate: 86400).
 */

import {
  fetchRegionalIndicator,
  fetchRegionalIndicatorForMunicipality,
  type RegionalDataPoint,
} from "./data-sources-regional";

// ============================================================
// ENDPOINTS
// ============================================================

export const CRIME_ENDPOINTS = {
  // Calgary community-level crime statistics (Socrata SODA)
  CALGARY_CRIME: "https://data.calgary.ca/resource/78gh-n26t.json",
  // Calgary community-level disorder statistics (Socrata SODA)
  CALGARY_DISORDER: "https://data.calgary.ca/resource/h3h6-kgme.json",
} as const;

// ============================================================
// TYPES
// ============================================================

export interface CrimeSeverityPoint {
  municipality: string;
  period: string;
  csi: number;
  unit: string;
}

export interface CalgaryCrimeStat {
  communityName: string;
  category: string;
  crimeCount: number;
  residentCount: number;
  date: string;
  sector: string;
  id: string;
}

export interface CalgaryDisorderStat {
  communityName: string;
  category: string;
  disorderCount: number;
  residentCount: number;
  date: string;
  sector: string;
  id: string;
}

export interface CrimeByCategoryPoint {
  category: string;
  totalCount: number;
}

// ============================================================
// FETCHERS — Crime Severity Index (Regional Dashboard)
// ============================================================

/**
 * Fetch Crime Severity Index for ALL Alberta municipalities.
 * Uses the regionaldashboard.alberta.ca API via the existing regional fetcher.
 */
export async function fetchCrimeSeverityIndex(): Promise<CrimeSeverityPoint[]> {
  try {
    const data: RegionalDataPoint[] = await fetchRegionalIndicator(
      "Crime Severity Index",
    );
    return data.map((pt) => ({
      municipality: pt.municipality,
      period: pt.period,
      csi: pt.value,
      unit: pt.unit || "Index",
    }));
  } catch (err) {
    console.error("[crime] Failed to fetch Crime Severity Index:", err);
    return [];
  }
}

/**
 * Fetch Crime Severity Index for a single municipality (time series).
 */
export async function fetchCrimeSeverityForMunicipality(
  municipalityName: string,
): Promise<CrimeSeverityPoint[]> {
  try {
    const data: RegionalDataPoint[] =
      await fetchRegionalIndicatorForMunicipality(
        "Crime Severity Index",
        municipalityName,
      );
    return data.map((pt) => ({
      municipality: pt.municipality,
      period: pt.period,
      csi: pt.value,
      unit: pt.unit || "Index",
    }));
  } catch (err) {
    console.error(
      `[crime] Failed to fetch CSI for ${municipalityName}:`,
      err,
    );
    return [];
  }
}

/**
 * Fetch CSI trend for a single municipality as TimeSeriesPoint-shaped data.
 * Returns entries sorted ascending by period.
 */
export async function fetchCrimeTrend(
  municipalityName?: string,
): Promise<{ date: string; value: number }[]> {
  if (!municipalityName) return [];
  const data = await fetchCrimeSeverityForMunicipality(municipalityName);
  return data
    .map((pt) => ({ date: pt.period, value: pt.csi }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ============================================================
// FETCHERS — Calgary Crime (Socrata SODA)
// ============================================================

/**
 * Fetch Calgary community crime stats with optional SoQL query params.
 * Default: last 5000 records ordered by date descending.
 */
export async function fetchCalgaryCrimeStats(
  params?: Record<string, string>,
): Promise<CalgaryCrimeStat[]> {
  try {
    const url = new URL(CRIME_ENDPOINTS.CALGARY_CRIME);
    if (params) {
      for (const [key, val] of Object.entries(params)) {
        url.searchParams.set(key, val);
      }
    }
    // Default ordering and limit if not specified
    if (!params?.["$order"]) {
      url.searchParams.set("$order", "date DESC");
    }
    if (!params?.["$limit"]) {
      url.searchParams.set("$limit", "5000");
    }

    const res = await fetch(url.toString(), {
      next: { revalidate: 86400 },
    });
    if (!res.ok) {
      console.error(
        `[crime] Calgary crime fetch failed: ${res.status} ${res.statusText}`,
      );
      return [];
    }
    const raw: Record<string, string>[] = await res.json();
    return raw.map((r) => ({
      communityName: r.community_name ?? "",
      category: r.category ?? "",
      crimeCount: parseInt(r.crime_count ?? "0", 10) || 0,
      residentCount: parseInt(r.resident_count ?? "0", 10) || 0,
      date: r.date ?? "",
      sector: r.sector ?? "",
      id: r.id ?? "",
    }));
  } catch (err) {
    console.error("[crime] Failed to fetch Calgary crime stats:", err);
    return [];
  }
}

/**
 * Fetch Calgary community disorder stats with optional SoQL query params.
 */
export async function fetchCalgaryDisorderStats(
  params?: Record<string, string>,
): Promise<CalgaryDisorderStat[]> {
  try {
    const url = new URL(CRIME_ENDPOINTS.CALGARY_DISORDER);
    if (params) {
      for (const [key, val] of Object.entries(params)) {
        url.searchParams.set(key, val);
      }
    }
    if (!params?.["$order"]) {
      url.searchParams.set("$order", "date DESC");
    }
    if (!params?.["$limit"]) {
      url.searchParams.set("$limit", "5000");
    }

    const res = await fetch(url.toString(), {
      next: { revalidate: 86400 },
    });
    if (!res.ok) {
      console.error(
        `[crime] Calgary disorder fetch failed: ${res.status} ${res.statusText}`,
      );
      return [];
    }
    const raw: Record<string, string>[] = await res.json();
    return raw.map((r) => ({
      communityName: r.community_name ?? "",
      category: r.category ?? "",
      disorderCount: parseInt(r.disorder_count ?? r.crime_count ?? "0", 10) || 0,
      residentCount: parseInt(r.resident_count ?? "0", 10) || 0,
      date: r.date ?? "",
      sector: r.sector ?? "",
      id: r.id ?? "",
    }));
  } catch (err) {
    console.error("[crime] Failed to fetch Calgary disorder stats:", err);
    return [];
  }
}

/**
 * Aggregate Calgary crime stats by category.
 * Returns categories sorted by total crime count descending.
 */
export async function fetchCrimeByCategory(): Promise<CrimeByCategoryPoint[]> {
  try {
    const url = new URL(CRIME_ENDPOINTS.CALGARY_CRIME);
    url.searchParams.set(
      "$select",
      "category,sum(crime_count) as total_count",
    );
    url.searchParams.set("$group", "category");
    url.searchParams.set("$order", "total_count DESC");
    url.searchParams.set("$limit", "50");

    const res = await fetch(url.toString(), {
      next: { revalidate: 86400 },
    });
    if (!res.ok) {
      console.error(
        `[crime] Calgary crime-by-category fetch failed: ${res.status}`,
      );
      return [];
    }
    const raw: Record<string, string>[] = await res.json();
    return raw.map((r) => ({
      category: r.category ?? "Unknown",
      totalCount: parseInt(r.total_count ?? "0", 10) || 0,
    }));
  } catch (err) {
    console.error("[crime] Failed to fetch crime by category:", err);
    return [];
  }
}

/**
 * Fetch Calgary monthly crime trend (total crime count per month).
 * Returns time series sorted ascending by date.
 */
export async function fetchCalgaryMonthlyTrend(): Promise<
  { date: string; value: number }[]
> {
  try {
    const url = new URL(CRIME_ENDPOINTS.CALGARY_CRIME);
    url.searchParams.set(
      "$select",
      "date_trunc_ym(date) as month,sum(crime_count) as total",
    );
    url.searchParams.set("$group", "month");
    url.searchParams.set("$order", "month ASC");
    url.searchParams.set("$limit", "500");

    const res = await fetch(url.toString(), {
      next: { revalidate: 86400 },
    });
    if (!res.ok) {
      console.error(
        `[crime] Calgary monthly trend fetch failed: ${res.status}`,
      );
      return [];
    }
    const raw: Record<string, string>[] = await res.json();
    return raw.map((r) => ({
      date: (r.month ?? "").slice(0, 10),
      value: parseInt(r.total ?? "0", 10) || 0,
    }));
  } catch (err) {
    console.error("[crime] Failed to fetch Calgary monthly trend:", err);
    return [];
  }
}
