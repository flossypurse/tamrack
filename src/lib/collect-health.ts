/**
 * Health data collection and read helpers.
 *
 * Sources:
 *   - Alberta Regional Dashboard — Life Expectancy and Births/Deaths
 *     (municipality-level, via fetchRegionalIndicator).
 *   - Alberta Open Data CKAN — Leading Causes of Death CSV
 *     (province-wide, annual, top 30 causes).
 *
 * All three fetchers are non-fatal: a failure in one sub-fetch leaves the
 * others unaffected. A snapshot_log row is written on both success and error.
 */

import { getDb, withTransaction } from "./db";
import type pg from "pg";

import {
  fetchLeadingCausesOfDeath,
  fetchLifeExpectancy,
  fetchBirthsAndDeaths,
  type LeadingCauseOfDeath,
  type LifeExpectancyPoint,
  type BirthDeathPoint,
} from "./data-sources-health";

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

const SQL = {
  upsertLifeExpectancy: `
    INSERT INTO health_life_expectancy (municipality, period, gender, value)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (municipality, period, gender)
    DO UPDATE SET value = EXCLUDED.value, collected_at = NOW()`,

  upsertBirthsDeaths: `
    INSERT INTO health_births_deaths (municipality, period, type, value)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (municipality, period, type)
    DO UPDATE SET value = EXCLUDED.value, collected_at = NOW()`,

  upsertCausesOfDeath: `
    INSERT INTO health_causes_of_death (year, cause, total_deaths, ranking)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (year, cause)
    DO UPDATE SET total_deaths = EXCLUDED.total_deaths, ranking = EXCLUDED.ranking,
                  collected_at = NOW()`,

  logEntry: `
    INSERT INTO snapshot_log (taken_at, source, records_inserted, status, error)
    VALUES (NOW(), $1, $2, $3, $4)`,
} as const;

// ---------------------------------------------------------------------------
// Collector
// ---------------------------------------------------------------------------

/**
 * Fetch and persist all three health datasets.
 * Each sub-fetch is wrapped in try/catch — a partial failure still persists
 * the datasets that succeeded, and a snapshot_log row is always written.
 * Returns the total count of rows upserted.
 */
export async function collectHealth(today: string): Promise<number> {
  void today; // kept for phase-fn signature parity; health data is not date-keyed

  const pool = await getDb();
  let totalRows = 0;

  // --- Life expectancy ---
  try {
    const points: LifeExpectancyPoint[] = await fetchLifeExpectancy();
    if (points.length > 0) {
      await withTransaction(async (client: pg.PoolClient) => {
        for (const pt of points) {
          await client.query(SQL.upsertLifeExpectancy, [
            pt.municipality,
            pt.period,
            pt.gender,
            pt.value,
          ]);
        }
      });
      totalRows += points.length;
    }
  } catch {
    // Non-fatal: life-expectancy failure does not abort causes-of-death
  }

  // --- Births and deaths ---
  try {
    const points: BirthDeathPoint[] = await fetchBirthsAndDeaths();
    if (points.length > 0) {
      await withTransaction(async (client: pg.PoolClient) => {
        for (const pt of points) {
          await client.query(SQL.upsertBirthsDeaths, [
            pt.municipality,
            pt.period,
            pt.type,
            pt.value,
          ]);
        }
      });
      totalRows += points.length;
    }
  } catch {
    // Non-fatal
  }

  // --- Leading causes of death ---
  try {
    const causes: LeadingCauseOfDeath[] = await fetchLeadingCausesOfDeath();
    if (causes.length > 0) {
      await withTransaction(async (client: pg.PoolClient) => {
        for (const c of causes) {
          await client.query(SQL.upsertCausesOfDeath, [
            c.year,
            c.cause,
            c.totalDeaths,
            c.ranking,
          ]);
        }
      });
      totalRows += causes.length;
    }
  } catch {
    // Non-fatal
  }

  await pool.query(SQL.logEntry, ["health", totalRows, "ok", null]);
  return totalRows;
}

// ---------------------------------------------------------------------------
// Read helpers (used by the MCP tool)
// ---------------------------------------------------------------------------

export interface LifeExpectancyRow {
  municipality: string;
  period: string;
  gender: string;
  value: number;
}

export interface BirthsDeathsRow {
  municipality: string;
  period: string;
  type: string;
  value: number;
}

export interface CauseOfDeathRow {
  year: number;
  cause: string;
  total_deaths: number;
  ranking: number;
}

/**
 * Life expectancy rows. Optional filters by municipality and/or gender.
 * Returns all rows ordered by municipality, period, gender.
 */
export async function readLifeExpectancy(opts?: {
  municipality?: string;
  gender?: string;
}): Promise<LifeExpectancyRow[]> {
  const pool = await getDb();
  const conditions: string[] = [];
  const params: (string | null)[] = [];

  if (opts?.municipality) {
    params.push(opts.municipality.toLowerCase());
    conditions.push(`LOWER(municipality) = $${params.length}`);
  }
  if (opts?.gender) {
    params.push(opts.gender.toLowerCase());
    conditions.push(`LOWER(gender) = $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const { rows } = await pool.query<LifeExpectancyRow>(
    `SELECT municipality, period, gender, value
       FROM health_life_expectancy
       ${where}
       ORDER BY municipality, period, gender`,
    params,
  );
  return rows.map((r) => ({
    municipality: r.municipality,
    period: r.period,
    gender: r.gender,
    value: Number(r.value),
  }));
}

/**
 * Births and deaths rows. Optional filter by municipality and/or type.
 * Returns all rows ordered by municipality, period, type.
 */
export async function readBirthsDeaths(opts?: {
  municipality?: string;
  type?: string;
}): Promise<BirthsDeathsRow[]> {
  const pool = await getDb();
  const conditions: string[] = [];
  const params: (string | null)[] = [];

  if (opts?.municipality) {
    params.push(opts.municipality.toLowerCase());
    conditions.push(`LOWER(municipality) = $${params.length}`);
  }
  if (opts?.type) {
    params.push(opts.type.toLowerCase());
    conditions.push(`LOWER(type) = $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const { rows } = await pool.query<BirthsDeathsRow>(
    `SELECT municipality, period, type, value
       FROM health_births_deaths
       ${where}
       ORDER BY municipality, period, type`,
    params,
  );
  return rows.map((r) => ({
    municipality: r.municipality,
    period: r.period,
    type: r.type,
    value: Number(r.value),
  }));
}

/**
 * Leading causes of death. Optional filter by year.
 * Defaults to the latest stored year when no year is specified.
 * Returns rows ordered by year, ranking.
 */
export async function readCausesOfDeath(opts?: {
  year?: number;
}): Promise<CauseOfDeathRow[]> {
  const pool = await getDb();
  const { rows } = await pool.query<CauseOfDeathRow>(
    `SELECT year, cause, total_deaths, ranking
       FROM health_causes_of_death
       WHERE year = COALESCE(
         $1,
         (SELECT MAX(year) FROM health_causes_of_death)
       )
       ORDER BY ranking ASC, total_deaths DESC`,
    [opts?.year ?? null],
  );
  return rows.map((r) => ({
    year: Number(r.year),
    cause: r.cause,
    total_deaths: Number(r.total_deaths),
    ranking: Number(r.ranking),
  }));
}
