/**
 * Alberta Regional Dashboard API fetchers
 * Source: https://regionaldashboard.alberta.ca
 *
 * Provides access to 50+ socioeconomic indicators for all Alberta municipalities.
 * Data is cached daily (revalidate: 86400).
 * Falls back to PostgreSQL snapshots when the upstream API is unavailable.
 */

import { fallbackRegionalIndicator } from "./data-fallback";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimeSeriesPoint {
  date: string;
  value: number;
  label?: string;
}

export interface RegionalDimension {
  name: string;
  value: string;
}

export interface RegionalDataPoint {
  csduid: string;
  municipality: string;
  period: string;
  indicator: string;
  dimensions: RegionalDimension[];
  value: number;
  unit: string;
}

/** Raw shape returned by the API. */
interface RawRegionalRecord {
  CSDUID: string;
  CSD: string;
  Period: string;
  IndicatorSummaryDescription: string;
  Dimensions: { Name: string; Value: string; IsDisplay: boolean; DisplayOrder: number }[];
  UnitOfMeasure: string;
  OriginalValue: number;
}

// ---------------------------------------------------------------------------
// Indicator registry — URL-safe encoded names
// ---------------------------------------------------------------------------

export const REGIONAL_INDICATORS: Record<string, string> = {
  "Population": "Population",
  "Housing Starts": "Housing%20Starts",
  "Unemployment Rate": "Unemployment%20Rate",
  "Building Permits": "Building%20Permits",
  "Average Weekly Earnings": "Average%20Weekly%20Earnings",
  "Labour Force": "Labour%20Force",
  "Median Household Income": "Median%20Household%20Income",
  "Business Counts": "Business%20Counts",
  "Net Migration": "Net%20Migration",
  "Assessment Base": "Assessment%20Base",
  "Crime Severity Index": "Crime%20Severity%20Index",
  "Average Residential Sale Price": "Average%20Residential%20Sale%20Price",
  "Farm Cash Receipts": "Farm%20Cash%20Receipts",
  "Marital Status": "Marital%20Status",
  "Educational Attainment": "Educational%20Attainment",
  "Percent of Small Businesses": "Percent%20of%20Small%20Businesses",
  "Total Equalized Assessment": "Total%20Equalized%20Assessment",
  "Major Projects": "Major%20Projects",
  "Greenhouse Gas Emissions": "Greenhouse%20Gas%20Emissions",
  "Dwelling Units": "Dwelling%20Units",
  "Well Count": "Well%20Count",
  "K - 9 Enrollments": "K%20-%209%20Enrollments",
  "Residential Share of Property Assessments": "Residential%20Share%20of%20Property%20Assessments",
  "High School Enrollments": "High%20School%20Enrollments",
  "Municipal Tax Rates": "Municipal%20Tax%20Rates",
  "Incorporations": "Incorporations",
  "Percent Visible Minority": "Percent%20Visible%20Minority",
  "Births and Deaths": "Births%20and%20Deaths",
  "Average Rent": "Average%20Rent",
  "Census Employment": "Census%20Employment",
  "Percent Aboriginal": "Percent%20Aboriginal",
  "Natural Gas Production": "Natural%20Gas%20Production",
  "Pigs": "Pigs",
  "Businesses": "Businesses",
  "Percent Official Language Speakers": "Percent%20Official%20Language%20Speakers",
  "Net Commuter Flow": "Net%20Commuter%20Flow",
  "Percent Single Family Houses": "Percent%20Single%20Family%20Houses",
  "Natural Gas Reserves": "Natural%20Gas%20Reserves",
  "Motorized Vehicle Registrations": "Motorized%20Vehicle%20Registrations",
  "Driver's Licenses": "Driver's%20Licenses",
  "Crop Acres": "Crop%20Acres",
  "Life Expectancy": "Life%20Expectancy",
  "Median Income": "Median%20Income",
  "Bankruptcies": "Bankruptcies",
  "Vacancy Rates": "Vacancy%20Rates",
  "Cattle and Calves": "Cattle%20and%20Calves",
  "Permanent Resident Landings": "Permanent%20Resident%20Landings",
  "Air Quality Index": "Air%20Quality%20Index",
  "Employment Insurance Beneficiaries": "Employment%20Insurance%20Beneficiaries",
  "Temporary Resident Entries": "Temporary%20Resident%20Entries",
  "Daily Vehicles per KM": "Daily%20Vehicles%20per%20KM",
  "Temporary Resident Stock": "Temporary%20Resident%20Stock",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_URL = "https://regionaldashboard.alberta.ca/export/opendata";

function buildUrl(indicatorEncoded: string): string {
  return `${BASE_URL}/${indicatorEncoded}/jsons`;
}

function resolveIndicator(indicator: string): string {
  // Accept either human-readable name or pre-encoded value
  if (REGIONAL_INDICATORS[indicator]) {
    return REGIONAL_INDICATORS[indicator];
  }
  // Check if the caller passed the encoded form directly
  const entry = Object.values(REGIONAL_INDICATORS).find((v) => v === indicator);
  if (entry) return entry;
  // Fallback: URL-encode whatever was given
  return encodeURIComponent(indicator);
}

// Normalize an indicator argument to the canonical human-readable key. Callers
// across the app pass either the human form ("Total Equalized Assessment")
// or the encoded form (REGIONAL_INDICATORS["Total Equalized Assessment"] →
// "Total%20Equalized%20Assessment"). Without canonicalization the writer
// downstream of fetchRegionalIndicator would persist URL-encoded indicator
// names as ghost rows on every page render that happened to use the encoded
// form. Canonicalizing at the boundary keeps the DB schema consistent and
// lets the fallback query do an exact-match `WHERE indicator = $1`.
function canonicalIndicatorName(input: string): string {
  if (REGIONAL_INDICATORS[input]) return input;
  for (const [key, encoded] of Object.entries(REGIONAL_INDICATORS)) {
    if (encoded === input) return key;
  }
  try {
    return decodeURIComponent(input);
  } catch {
    return input;
  }
}

function parseRecord(raw: RawRegionalRecord): RegionalDataPoint {
  return {
    csduid: raw.CSDUID ?? "",
    municipality: raw.CSD ?? "",
    period: raw.Period ?? "",
    indicator: raw.IndicatorSummaryDescription ?? "",
    dimensions: (raw.Dimensions ?? []).map((d) => ({
      name: d.Name,
      value: d.Value,
    })),
    value: raw.OriginalValue ?? 0,
    unit: raw.UnitOfMeasure ?? "",
  };
}

// ---------------------------------------------------------------------------
// Concurrency limiter for batched fetches
// ---------------------------------------------------------------------------

async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  maxConcurrent: number,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let index = 0;

  async function worker(): Promise<void> {
    while (index < tasks.length) {
      const i = index++;
      try {
        const value = await tasks[i]();
        results[i] = { status: "fulfilled", value };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  }

  const workers = Array.from({ length: Math.min(maxConcurrent, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------

/**
 * Fetch a single indicator for ALL municipalities.
 * Retries once after 2s if the first attempt fails (Alberta API is flaky).
 * Persists successful fetches to the DB so future fallbacks have data.
 */
export async function fetchRegionalIndicator(
  indicator: string,
): Promise<RegionalDataPoint[]> {
  const canonical = canonicalIndicatorName(indicator);
  const encoded = resolveIndicator(canonical);
  const url = buildUrl(encoded);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 2000));
      }
      const res = await fetch(url, { next: { revalidate: 86400 } });
      if (!res.ok) {
        console.warn(`[regional] ${canonical}: HTTP ${res.status} (attempt ${attempt + 1})`);
        continue;
      }

      // Guard: check content-type is JSON before parsing
      const contentType = res.headers.get("content-type") || "";
      const body = await res.text();

      if (!body || body.length === 0) {
        console.warn(`[regional] ${canonical}: empty response (attempt ${attempt + 1})`);
        continue;
      }

      if (!contentType.includes("json") && !body.startsWith("[")) {
        console.warn(`[regional] ${canonical}: non-JSON response (${contentType}) (attempt ${attempt + 1})`);
        continue;
      }

      const raw: RawRegionalRecord[] = JSON.parse(body);
      const parsed = raw.map(parseRecord);
      if (parsed.length === 0) {
        continue;
      }

      // Persist to DB in the background so future fallbacks have data
      persistToDb(canonical, parsed).catch(() => {});

      return parsed;
    } catch (err) {
      console.warn(`[regional] ${canonical}: fetch error (attempt ${attempt + 1}):`, err);
    }
  }

  console.error(`[regional] ${canonical}: all attempts failed — trying DB fallback`);
  return dbFallback(canonical);
}

/** Persist fetched data to PostgreSQL so future fallbacks have data */
async function persistToDb(indicator: string, data: RegionalDataPoint[]): Promise<void> {
  try {
    const { upsertRegionalIndicator } = await import("./db");
    // Batch insert — limit to avoid blocking for too long
    const batch = data.slice(0, 2000);
    for (const pt of batch) {
      await upsertRegionalIndicator(
        pt.csduid,
        pt.municipality,
        indicator,
        pt.period,
        pt.value,
        pt.unit
      );
    }
    console.log(`[regional] Persisted ${batch.length} rows for "${indicator}"`);
  } catch {
    // Silently ignore — persistence is best-effort
  }
}

/** Convert DB fallback rows into RegionalDataPoint[] */
async function dbFallback(indicator: string, municipality?: string): Promise<RegionalDataPoint[]> {
  const rows = await fallbackRegionalIndicator(indicator, municipality);
  return rows.map((r) => ({
    csduid: "",
    municipality: r.municipality,
    period: r.period,
    indicator,
    dimensions: [],
    value: r.value,
    unit: r.unit,
  }));
}

/**
 * Fetch a single indicator filtered to one municipality (case-insensitive match).
 */
export async function fetchRegionalIndicatorForMunicipality(
  indicator: string,
  municipalityName: string,
): Promise<RegionalDataPoint[]> {
  const all = await fetchRegionalIndicator(indicator);
  const target = municipalityName.toLowerCase();
  return all.filter((pt) => pt.municipality.toLowerCase() === target);
}

/**
 * Fetch ALL indicators for a single municipality.
 * Batched with max 5 concurrent requests via Promise.allSettled.
 */
export async function fetchAllRegionalDataForMunicipality(
  municipalityName: string,
): Promise<Record<string, RegionalDataPoint[]>> {
  const indicatorNames = Object.keys(REGIONAL_INDICATORS);

  const tasks = indicatorNames.map(
    (name) => () => fetchRegionalIndicatorForMunicipality(name, municipalityName),
  );

  const settled = await runWithConcurrency(tasks, 10);

  const result: Record<string, RegionalDataPoint[]> = {};
  for (let i = 0; i < indicatorNames.length; i++) {
    const outcome = settled[i];
    result[indicatorNames[i]] =
      outcome.status === "fulfilled" ? outcome.value : [];
  }

  return result;
}

/**
 * Convenience: fetch one indicator for one municipality and return as
 * TimeSeriesPoint[] sorted by date ascending.
 *
 * Aggregates by period — if multiple dimension rows exist for the same period,
 * they are summed (e.g. housing starts by type).
 */
export async function fetchRegionalTimeSeries(
  indicator: string,
  municipalityName: string,
): Promise<TimeSeriesPoint[]> {
  const points = await fetchRegionalIndicatorForMunicipality(indicator, municipalityName);

  // Aggregate by period
  const byPeriod = new Map<string, { total: number; label: string }>();
  for (const pt of points) {
    const existing = byPeriod.get(pt.period);
    if (existing) {
      existing.total += pt.value;
    } else {
      byPeriod.set(pt.period, { total: pt.value, label: pt.indicator });
    }
  }

  const series: TimeSeriesPoint[] = [];
  for (const [period, { total, label }] of byPeriod) {
    series.push({
      date: period,
      value: total,
      label,
    });
  }

  // Sort ascending by date string
  series.sort((a, b) => a.date.localeCompare(b.date));

  return series;
}
