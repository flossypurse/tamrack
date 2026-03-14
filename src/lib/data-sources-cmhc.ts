// CMHC Housing Market data — convenience wrappers around StatsCan WDS
// Provides comparison views across Edmonton + Calgary CMAs
// Tables: 34-10-0154 (starts), 34-10-0127 (vacancy), 34-10-0133 (rents),
//         34-10-0153 (absorptions), 34-10-0145 (mortgage rate)

import {
  fetchStatCanTimeSeries,
  STATSCAN_SERIES,
  type TimeSeriesPoint,
} from "./data-sources";

// ============================================================
// Types
// ============================================================

export interface CMASeriesPoint {
  date: string;
  edmonton: number;
  calgary: number;
}

export interface RentComparisonPoint {
  date: string;
  edmontonBachelor: number;
  edmontonOneBed: number;
  edmontonTwoBed: number;
  edmontonThreeBed: number;
  calgaryBachelor: number;
  calgaryOneBed: number;
  calgaryTwoBed: number;
  calgaryThreeBed: number;
}

export interface HousingSnapshot {
  cma: "Edmonton" | "Calgary";
  starts: TimeSeriesPoint[];
  completions: TimeSeriesPoint[];
  underConstruction: TimeSeriesPoint[];
}

// ============================================================
// Housing Starts / Completions / Under Construction
// ============================================================

export async function fetchHousingStarts(
  latestN: number = 60
): Promise<CMASeriesPoint[]> {
  const [edm, cal] = await Promise.all([
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.tableId,
      STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.coordinate,
      latestN
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.CALGARY_HOUSING_STARTS.tableId,
      STATSCAN_SERIES.CALGARY_HOUSING_STARTS.coordinate,
      latestN
    ).catch(() => []),
  ]);
  return mergeCMA(edm, cal);
}

export async function fetchHousingCompletions(
  latestN: number = 60
): Promise<CMASeriesPoint[]> {
  const [edm, cal] = await Promise.all([
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.EDMONTON_HOUSING_COMPLETIONS.tableId,
      STATSCAN_SERIES.EDMONTON_HOUSING_COMPLETIONS.coordinate,
      latestN
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.CALGARY_HOUSING_COMPLETIONS.tableId,
      STATSCAN_SERIES.CALGARY_HOUSING_COMPLETIONS.coordinate,
      latestN
    ).catch(() => []),
  ]);
  return mergeCMA(edm, cal);
}

export async function fetchUnderConstruction(
  latestN: number = 60
): Promise<CMASeriesPoint[]> {
  const [edm, cal] = await Promise.all([
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.EDMONTON_UNDER_CONSTRUCTION.tableId,
      STATSCAN_SERIES.EDMONTON_UNDER_CONSTRUCTION.coordinate,
      latestN
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.CALGARY_UNDER_CONSTRUCTION.tableId,
      STATSCAN_SERIES.CALGARY_UNDER_CONSTRUCTION.coordinate,
      latestN
    ).catch(() => []),
  ]);
  return mergeCMA(edm, cal);
}

export async function fetchHousingSnapshot(
  cma: "Edmonton" | "Calgary",
  latestN: number = 60
): Promise<HousingSnapshot> {
  const series =
    cma === "Edmonton"
      ? {
          starts: STATSCAN_SERIES.EDMONTON_HOUSING_STARTS,
          completions: STATSCAN_SERIES.EDMONTON_HOUSING_COMPLETIONS,
          underConstruction: STATSCAN_SERIES.EDMONTON_UNDER_CONSTRUCTION,
        }
      : {
          starts: STATSCAN_SERIES.CALGARY_HOUSING_STARTS,
          completions: STATSCAN_SERIES.CALGARY_HOUSING_COMPLETIONS,
          underConstruction: STATSCAN_SERIES.CALGARY_UNDER_CONSTRUCTION,
        };

  const [starts, completions, underConstruction] = await Promise.all([
    fetchStatCanTimeSeries(series.starts.tableId, series.starts.coordinate, latestN).catch(() => []),
    fetchStatCanTimeSeries(series.completions.tableId, series.completions.coordinate, latestN).catch(() => []),
    fetchStatCanTimeSeries(series.underConstruction.tableId, series.underConstruction.coordinate, latestN).catch(() => []),
  ]);

  return { cma, starts, completions, underConstruction };
}

// ============================================================
// Vacancy Rates
// ============================================================

export async function fetchVacancyRates(
  latestN: number = 20
): Promise<CMASeriesPoint[]> {
  const [edm, cal] = await Promise.all([
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.EDMONTON_VACANCY_RATE.tableId,
      STATSCAN_SERIES.EDMONTON_VACANCY_RATE.coordinate,
      latestN
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.CALGARY_VACANCY_RATE.tableId,
      STATSCAN_SERIES.CALGARY_VACANCY_RATE.coordinate,
      latestN
    ).catch(() => []),
  ]);
  return mergeCMA(edm, cal);
}

// ============================================================
// Average Rents
// ============================================================

export async function fetchRentComparison(
  latestN: number = 20
): Promise<RentComparisonPoint[]> {
  const [
    edmBach, edmOne, edmTwo, edmThree,
    calBach, calOne, calTwo, calThree,
  ] = await Promise.all([
    fetchStatCanTimeSeries(STATSCAN_SERIES.EDMONTON_RENT_BACHELOR.tableId, STATSCAN_SERIES.EDMONTON_RENT_BACHELOR.coordinate, latestN).catch(() => []),
    fetchStatCanTimeSeries(STATSCAN_SERIES.EDMONTON_RENT_1BED.tableId, STATSCAN_SERIES.EDMONTON_RENT_1BED.coordinate, latestN).catch(() => []),
    fetchStatCanTimeSeries(STATSCAN_SERIES.EDMONTON_RENT_2BED.tableId, STATSCAN_SERIES.EDMONTON_RENT_2BED.coordinate, latestN).catch(() => []),
    fetchStatCanTimeSeries(STATSCAN_SERIES.EDMONTON_RENT_3BED.tableId, STATSCAN_SERIES.EDMONTON_RENT_3BED.coordinate, latestN).catch(() => []),
    fetchStatCanTimeSeries(STATSCAN_SERIES.CALGARY_RENT_BACHELOR.tableId, STATSCAN_SERIES.CALGARY_RENT_BACHELOR.coordinate, latestN).catch(() => []),
    fetchStatCanTimeSeries(STATSCAN_SERIES.CALGARY_RENT_1BED.tableId, STATSCAN_SERIES.CALGARY_RENT_1BED.coordinate, latestN).catch(() => []),
    fetchStatCanTimeSeries(STATSCAN_SERIES.CALGARY_RENT_2BED.tableId, STATSCAN_SERIES.CALGARY_RENT_2BED.coordinate, latestN).catch(() => []),
    fetchStatCanTimeSeries(STATSCAN_SERIES.CALGARY_RENT_3BED.tableId, STATSCAN_SERIES.CALGARY_RENT_3BED.coordinate, latestN).catch(() => []),
  ]);

  const map = new Map<string, RentComparisonPoint>();
  const ensure = (date: string) => {
    if (!map.has(date)) {
      map.set(date, {
        date,
        edmontonBachelor: 0, edmontonOneBed: 0, edmontonTwoBed: 0, edmontonThreeBed: 0,
        calgaryBachelor: 0, calgaryOneBed: 0, calgaryTwoBed: 0, calgaryThreeBed: 0,
      });
    }
    return map.get(date)!;
  };

  for (const p of edmBach) ensure(p.date).edmontonBachelor = p.value;
  for (const p of edmOne) ensure(p.date).edmontonOneBed = p.value;
  for (const p of edmTwo) ensure(p.date).edmontonTwoBed = p.value;
  for (const p of edmThree) ensure(p.date).edmontonThreeBed = p.value;
  for (const p of calBach) ensure(p.date).calgaryBachelor = p.value;
  for (const p of calOne) ensure(p.date).calgaryOneBed = p.value;
  for (const p of calTwo) ensure(p.date).calgaryTwoBed = p.value;
  for (const p of calThree) ensure(p.date).calgaryThreeBed = p.value;

  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// ============================================================
// Absorptions (Province-level — Alberta)
// ============================================================

export async function fetchAbsorptions(
  latestN: number = 40
): Promise<{ absorbed: TimeSeriesPoint[]; unabsorbed: TimeSeriesPoint[] }> {
  const [absorbed, unabsorbed] = await Promise.all([
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_ABSORPTION_RATE.tableId,
      STATSCAN_SERIES.AB_ABSORPTION_RATE.coordinate,
      latestN
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_UNABSORBED.tableId,
      STATSCAN_SERIES.AB_UNABSORBED.coordinate,
      latestN
    ).catch(() => []),
  ]);
  return { absorbed, unabsorbed };
}

// ============================================================
// Mortgage Rate (National)
// ============================================================

export async function fetchMortgageRate(
  latestN: number = 60
): Promise<TimeSeriesPoint[]> {
  return fetchStatCanTimeSeries(
    STATSCAN_SERIES.MORTGAGE_RATE_5Y_CONVENTIONAL.tableId,
    STATSCAN_SERIES.MORTGAGE_RATE_5Y_CONVENTIONAL.coordinate,
    latestN
  ).catch(() => []);
}

// ============================================================
// Helpers
// ============================================================

function mergeCMA(
  edmonton: TimeSeriesPoint[],
  calgary: TimeSeriesPoint[]
): CMASeriesPoint[] {
  const map = new Map<string, CMASeriesPoint>();
  for (const p of edmonton) {
    map.set(p.date, { date: p.date, edmonton: p.value, calgary: 0 });
  }
  for (const p of calgary) {
    const ex = map.get(p.date);
    if (ex) {
      ex.calgary = p.value;
    } else {
      map.set(p.date, { date: p.date, edmonton: 0, calgary: p.value });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}
