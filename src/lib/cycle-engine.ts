/**
 * Cycle Positioning Engine
 *
 * Computes a 10-dimension "fingerprint" of Alberta's economy at any point in time,
 * then measures cosine similarity between the current fingerprint and fingerprints
 * from five known historical periods.
 *
 * All data comes from BoC Valet + StatsCan WDS (20+ years of history available).
 */

import {
  fetchStatCanTimeSeries,
  fetchBoCTimeSeries,
  STATSCAN_SERIES,
  BOC_SERIES,
  type TimeSeriesPoint,
} from "./data-sources";

// ============================================================
// Types
// ============================================================

export interface CyclePeriod {
  id: string;
  label: string;
  shortLabel: string;
  startDate: string; // YYYY-MM
  endDate: string;
  description: string;
  color: string;
  whatHappenedNext: string;
}

export interface CycleIndicator {
  id: string;
  label: string;
  shortLabel: string;
  source: "statscan" | "boc";
  unit: string;
}

export interface CycleFingerprint {
  /** Z-score for each indicator (same order as CYCLE_INDICATORS) */
  zScores: number[];
  /** Raw values for each indicator */
  rawValues: number[];
  /** Date this fingerprint represents */
  date: string;
}

export interface PeriodMatch {
  period: CyclePeriod;
  similarity: number; // 0-1 cosine similarity
  distance: number; // Euclidean distance (lower = more similar)
  periodFingerprint: CycleFingerprint;
}

export interface WhatHappenedNext {
  indicator: string;
  shortLabel: string;
  unit: string;
  valueAtEnd: number | null;
  valueAfter6mo: number | null;
  valueAfter12mo: number | null;
  valueAfter18mo: number | null;
}

export interface CyclePositionResult {
  current: CycleFingerprint;
  matches: PeriodMatch[];
  bestMatch: PeriodMatch;
  whatHappenedNext: WhatHappenedNext[];
  /** Full time series for the timeline chart, keyed by indicator id */
  historicalSeries: Record<string, TimeSeriesPoint[]>;
  /** All indicators metadata */
  indicators: CycleIndicator[];
}

// ============================================================
// Constants
// ============================================================

export const CYCLE_PERIODS: CyclePeriod[] = [
  {
    id: "boom-2005-2008",
    label: "2005–2008 Oil Boom",
    shortLabel: "Oil Boom",
    startDate: "2005-01",
    endDate: "2008-06",
    description:
      "Oil above $70, unemployment at 3.5%, housing starts surging. Alberta was the hottest economy in Canada.",
    color: "#22c55e",
    whatHappenedNext:
      "The global financial crisis hit. Oil collapsed from $147 to $34. Unemployment doubled. Housing starts fell 60%.",
  },
  {
    id: "crash-2008-2009",
    label: "2008–2009 Financial Crisis",
    shortLabel: "GFC Crash",
    startDate: "2008-07",
    endDate: "2009-06",
    description:
      "Global financial crisis. Oil collapsed from $147 to $34. Mass layoffs in energy sector.",
    color: "#ef4444",
    whatHappenedNext:
      "Stimulus spending + energy price recovery drove a multi-year expansion. Unemployment fell steadily. Starts recovered by 2011.",
  },
  {
    id: "oil-crash-2014-2016",
    label: "2014–2016 Oil Price Crash",
    shortLabel: "Oil Crash",
    startDate: "2014-07",
    endDate: "2016-03",
    description:
      "WCS collapsed, mass layoffs, population outflow. Alberta lost 100,000+ jobs in 18 months.",
    color: "#f97316",
    whatHappenedNext:
      "Slow recovery through 2017-2019. Diversification accelerated. Tech sector grew. Population growth resumed by 2018.",
  },
  {
    id: "covid-2020-2021",
    label: "2020–2021 COVID Shock",
    shortLabel: "COVID",
    startDate: "2020-03",
    endDate: "2021-06",
    description:
      "Lockdowns + negative oil prices + rate cuts to 0.25%. Unprecedented simultaneous demand and supply shock.",
    color: "#a855f7",
    whatHappenedNext:
      "Explosive recovery. Energy prices surged. Immigration rebounded. Housing market overheated. BoC hiked rates aggressively through 2022-2023.",
  },
  {
    id: "recovery-2022-2024",
    label: "2022–2024 Rate Hike Recovery",
    shortLabel: "Recovery",
    startDate: "2022-01",
    endDate: "2024-06",
    description:
      "Energy rebound, immigration surge, BoC rate hikes to 5%. Alberta outperformed national growth despite high rates.",
    color: "#3b82f6",
    whatHappenedNext:
      "BoC began cutting in mid-2024. Immigration policy tightened. Housing affordability remained the dominant issue.",
  },
];

export const CYCLE_INDICATORS: CycleIndicator[] = [
  { id: "policy_rate", label: "BoC Policy Rate", shortLabel: "Rate", source: "boc", unit: "%" },
  { id: "unemployment", label: "AB Unemployment", shortLabel: "Unemp", source: "statscan", unit: "%" },
  { id: "energy_index", label: "Energy Commodity Index", shortLabel: "Energy", source: "boc", unit: "idx" },
  { id: "cad_usd", label: "CAD/USD Exchange", shortLabel: "CAD", source: "boc", unit: "" },
  { id: "housing_starts", label: "Edmonton Housing Starts", shortLabel: "Starts", source: "statscan", unit: "units" },
  { id: "cpi", label: "Alberta CPI", shortLabel: "CPI", source: "statscan", unit: "idx" },
  { id: "retail_sales", label: "AB Retail Sales", shortLabel: "Retail", source: "statscan", unit: "$K" },
  { id: "employment", label: "AB Employment (total)", shortLabel: "Jobs", source: "statscan", unit: "K" },
  { id: "mortgage_rate", label: "5-Year Mortgage Rate", shortLabel: "Mortgage", source: "boc", unit: "%" },
  { id: "weekly_earnings", label: "AB Avg Weekly Earnings", shortLabel: "Earnings", source: "statscan", unit: "$" },
];

// ============================================================
// Data fetching
// ============================================================

interface MonthlyRow {
  month: string; // YYYY-MM
  values: (number | null)[]; // one per CYCLE_INDICATORS
}

/**
 * Fetch all 10 indicator time series with deep history (240 periods = 20 years).
 * Returns a Map<indicatorId, TimeSeriesPoint[]>.
 */
export async function fetchAllCycleSeries(): Promise<Map<string, TimeSeriesPoint[]>> {
  const DEEP = 240; // 20 years of monthly data

  const fetches: Promise<{ id: string; data: TimeSeriesPoint[] }>[] = [
    fetchBoCTimeSeries(BOC_SERIES.POLICY_RATE, DEEP).then((d) => ({ id: "policy_rate", data: d })),
    fetchStatCanTimeSeries(STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.tableId, STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.coordinate, DEEP).then((d) => ({ id: "unemployment", data: d })),
    fetchBoCTimeSeries(BOC_SERIES.BCPI_ENERGY, DEEP).then((d) => ({ id: "energy_index", data: d })),
    fetchBoCTimeSeries(BOC_SERIES.CAD_USD, DEEP).then((d) => ({ id: "cad_usd", data: d })),
    fetchStatCanTimeSeries(STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.tableId, STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.coordinate, DEEP).then((d) => ({ id: "housing_starts", data: d })),
    fetchStatCanTimeSeries(STATSCAN_SERIES.AB_CPI.tableId, STATSCAN_SERIES.AB_CPI.coordinate, DEEP).then((d) => ({ id: "cpi", data: d })),
    fetchStatCanTimeSeries(STATSCAN_SERIES.AB_RETAIL_SALES.tableId, STATSCAN_SERIES.AB_RETAIL_SALES.coordinate, DEEP).then((d) => ({ id: "retail_sales", data: d })),
    fetchStatCanTimeSeries(STATSCAN_SERIES.AB_EMPLOYMENT.tableId, STATSCAN_SERIES.AB_EMPLOYMENT.coordinate, DEEP).then((d) => ({ id: "employment", data: d })),
    fetchBoCTimeSeries(BOC_SERIES.MORTGAGE_5Y_FIXED, DEEP).then((d) => ({ id: "mortgage_rate", data: d })),
    fetchStatCanTimeSeries(STATSCAN_SERIES.AB_WEEKLY_EARNINGS.tableId, STATSCAN_SERIES.AB_WEEKLY_EARNINGS.coordinate, DEEP).then((d) => ({ id: "weekly_earnings", data: d })),
  ];

  const results = await Promise.allSettled(fetches);
  const seriesMap = new Map<string, TimeSeriesPoint[]>();

  for (const result of results) {
    if (result.status === "fulfilled") {
      seriesMap.set(result.value.id, result.value.data);
    }
  }

  return seriesMap;
}

// ============================================================
// Computation
// ============================================================

/**
 * Merge all series into a monthly aligned table.
 * Each row has a month key (YYYY-MM) and an array of values matching CYCLE_INDICATORS order.
 */
function buildMonthlyTable(seriesMap: Map<string, TimeSeriesPoint[]>): MonthlyRow[] {
  // Collect all months across all series
  const allMonths = new Set<string>();
  for (const [, series] of seriesMap) {
    for (const point of series) {
      allMonths.add(point.date.slice(0, 7));
    }
  }

  // Build lookup: indicatorId -> month -> value
  const lookups = new Map<string, Map<string, number>>();
  for (const [id, series] of seriesMap) {
    const monthMap = new Map<string, number>();
    for (const point of series) {
      const month = point.date.slice(0, 7);
      monthMap.set(month, point.value);
    }
    lookups.set(id, monthMap);
  }

  // Build rows
  const months = Array.from(allMonths).sort();
  return months.map((month) => ({
    month,
    values: CYCLE_INDICATORS.map((ind) => {
      const lookup = lookups.get(ind.id);
      return lookup?.get(month) ?? null;
    }),
  }));
}

/**
 * Compute mean and standard deviation for each indicator across the full history.
 */
function computeStats(table: MonthlyRow[]): { means: number[]; stds: number[] } {
  const n = CYCLE_INDICATORS.length;
  const sums = new Array(n).fill(0);
  const counts = new Array(n).fill(0);

  for (const row of table) {
    for (let i = 0; i < n; i++) {
      if (row.values[i] != null) {
        sums[i] += row.values[i]!;
        counts[i]++;
      }
    }
  }

  const means = sums.map((s, i) => (counts[i] > 0 ? s / counts[i] : 0));

  // Variance
  const varSums = new Array(n).fill(0);
  for (const row of table) {
    for (let i = 0; i < n; i++) {
      if (row.values[i] != null) {
        const diff = row.values[i]! - means[i];
        varSums[i] += diff * diff;
      }
    }
  }

  const stds = varSums.map((v, i) => (counts[i] > 1 ? Math.sqrt(v / (counts[i] - 1)) : 1));

  return { means, stds };
}

/**
 * Convert a row of raw values to z-scores using precomputed stats.
 */
function toZScores(values: (number | null)[], means: number[], stds: number[]): number[] {
  return values.map((v, i) => {
    if (v == null) return 0;
    return stds[i] > 0 ? (v - means[i]) / stds[i] : 0;
  });
}

/**
 * Compute average fingerprint for a date range from the monthly table.
 */
function computePeriodFingerprint(
  table: MonthlyRow[],
  startMonth: string,
  endMonth: string,
  means: number[],
  stds: number[]
): CycleFingerprint {
  const rows = table.filter((r) => r.month >= startMonth && r.month <= endMonth);

  if (rows.length === 0) {
    return { zScores: new Array(CYCLE_INDICATORS.length).fill(0), rawValues: new Array(CYCLE_INDICATORS.length).fill(0), date: endMonth };
  }

  const n = CYCLE_INDICATORS.length;
  const avgValues = new Array(n).fill(0);
  const avgCounts = new Array(n).fill(0);

  for (const row of rows) {
    for (let i = 0; i < n; i++) {
      if (row.values[i] != null) {
        avgValues[i] += row.values[i]!;
        avgCounts[i]++;
      }
    }
  }

  const rawValues = avgValues.map((s, i) => (avgCounts[i] > 0 ? s / avgCounts[i] : 0));
  const zScores = toZScores(rawValues, means, stds);

  return { zScores, rawValues, date: endMonth };
}

/**
 * Cosine similarity between two vectors. Returns 0-1 (1 = identical direction).
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom > 0 ? (dot / denom + 1) / 2 : 0.5; // Normalize from [-1,1] to [0,1]
}

/**
 * Euclidean distance between two vectors.
 */
function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * For the best-match period, compute what happened to each indicator
 * at 6, 12, and 18 months after the period ended.
 */
function computeWhatHappenedNext(
  table: MonthlyRow[],
  period: CyclePeriod
): WhatHappenedNext[] {
  const endMonth = period.endDate;

  // Find month offsets from end
  function getMonthOffset(baseMonth: string, offset: number): string {
    const [year, month] = baseMonth.split("-").map(Number);
    const totalMonths = year * 12 + month - 1 + offset;
    const newYear = Math.floor(totalMonths / 12);
    const newMonth = (totalMonths % 12) + 1;
    return `${newYear}-${String(newMonth).padStart(2, "0")}`;
  }

  function findValue(month: string, indicatorIdx: number): number | null {
    // Look for exact match or closest within 2 months
    for (let offset = 0; offset <= 2; offset++) {
      const target = getMonthOffset(month, offset);
      const row = table.find((r) => r.month === target);
      if (row?.values[indicatorIdx] != null) return row.values[indicatorIdx];
      if (offset > 0) {
        const target2 = getMonthOffset(month, -offset);
        const row2 = table.find((r) => r.month === target2);
        if (row2?.values[indicatorIdx] != null) return row2.values[indicatorIdx];
      }
    }
    return null;
  }

  return CYCLE_INDICATORS.map((ind, i) => ({
    indicator: ind.label,
    shortLabel: ind.shortLabel,
    unit: ind.unit,
    valueAtEnd: findValue(endMonth, i),
    valueAfter6mo: findValue(getMonthOffset(endMonth, 6), i),
    valueAfter12mo: findValue(getMonthOffset(endMonth, 12), i),
    valueAfter18mo: findValue(getMonthOffset(endMonth, 18), i),
  }));
}

// ============================================================
// Main entry point
// ============================================================

export async function computeCyclePosition(): Promise<CyclePositionResult> {
  const seriesMap = await fetchAllCycleSeries();

  const table = buildMonthlyTable(seriesMap);
  const { means, stds } = computeStats(table);

  // Current fingerprint: use the most recent 3 months to smooth noise
  const recentRows = table.slice(-3);
  const latestMonth = recentRows.at(-1)?.month || "unknown";
  const n = CYCLE_INDICATORS.length;
  const currentAvg = new Array(n).fill(0);
  const currentCounts = new Array(n).fill(0);
  for (const row of recentRows) {
    for (let i = 0; i < n; i++) {
      if (row.values[i] != null) {
        currentAvg[i] += row.values[i]!;
        currentCounts[i]++;
      }
    }
  }
  const currentRaw = currentAvg.map((s, i) => (currentCounts[i] > 0 ? s / currentCounts[i] : 0));
  const currentZScores = toZScores(currentRaw, means, stds);
  const current: CycleFingerprint = {
    zScores: currentZScores,
    rawValues: currentRaw,
    date: latestMonth,
  };

  // Compute fingerprints for each historical period
  const matches: PeriodMatch[] = CYCLE_PERIODS.map((period) => {
    const fingerprint = computePeriodFingerprint(
      table,
      period.startDate,
      period.endDate,
      means,
      stds
    );
    return {
      period,
      similarity: cosineSimilarity(current.zScores, fingerprint.zScores),
      distance: euclideanDistance(current.zScores, fingerprint.zScores),
      periodFingerprint: fingerprint,
    };
  });

  // Sort by similarity (highest first)
  matches.sort((a, b) => b.similarity - a.similarity);
  const bestMatch = matches[0];

  // What happened next for the best match
  const whatHappenedNext = computeWhatHappenedNext(table, bestMatch.period);

  // Include key series for the timeline visualization
  const historicalSeries: Record<string, TimeSeriesPoint[]> = {};
  for (const [id, data] of seriesMap) {
    historicalSeries[id] = data;
  }

  return {
    current,
    matches,
    bestMatch,
    whatHappenedNext,
    historicalSeries,
    indicators: CYCLE_INDICATORS,
  };
}
