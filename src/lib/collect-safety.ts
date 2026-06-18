/**
 * Public Safety vertical — collector and read helpers.
 *
 * Stored datasets:
 *   - Crime Severity Index (per municipality / period) from the Alberta
 *     Regional Dashboard via fetchCrimeSeverityIndex().
 *   - Edmonton Fire Rescue incident summaries (by event type, daily
 *     snapshot) via fetchEdmontonFireByType().
 *
 * NOT stored:
 *   - 511 Alberta alerts — ephemeral, no snapshot semantics. The MCP
 *     tool calls fetch511Alerts() live at query time.
 *   - CWFIS active fires — active-only list, no daily accumulation value.
 *
 * All writes are idempotent (UPSERT on unique conflict keys).
 * snapshot_log rows are written on both success and error (source "safety").
 * Sub-fetches are individually try/caught so one source failure cannot
 * block others.
 */

import type pg from "pg";
import { getDb, withTransaction } from "./db";
import {
  fetchCrimeSeverityIndex,
} from "./data-sources-crime";
import {
  fetchEdmontonFireByType,
} from "./data-sources-fire";

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

const SQL_UPSERT_CRIME = `
  INSERT INTO safety_crime_severity (municipality, period, csi, unit)
  VALUES ($1, $2, $3, $4)
  ON CONFLICT (municipality, period)
  DO UPDATE SET
    csi          = EXCLUDED.csi,
    unit         = EXCLUDED.unit,
    collected_at = NOW()
`;

const SQL_UPSERT_FIRE = `
  INSERT INTO safety_fire_by_type (snapshot_date, event_type, incident_count, avg_duration_mins)
  VALUES ($1, $2, $3, $4)
  ON CONFLICT (snapshot_date, event_type)
  DO UPDATE SET
    incident_count    = EXCLUDED.incident_count,
    avg_duration_mins = EXCLUDED.avg_duration_mins,
    collected_at      = NOW()
`;

const SQL_LOG = `
  INSERT INTO snapshot_log (taken_at, source, records_inserted, status, error)
  VALUES (NOW(), $1, $2, $3, $4)
`;

// ---------------------------------------------------------------------------
// Collector
// ---------------------------------------------------------------------------

/**
 * Fetch and persist crime severity + fire incident summaries.
 *
 * Returns the total row count written. Writes a snapshot_log row on
 * both success and error. Each sub-source is guarded by its own try/catch
 * so a flaky upstream cannot abort the whole phase.
 *
 * Stays fast (no per-neighbourhood enrichment loops that could exceed the
 * Resonate task TTL). Crime fetch is ~340 rows; fire by-type is ~10–20 rows.
 */
export async function collectSafety(today: string): Promise<number> {
  const pool = await getDb();
  let total = 0;
  const errors: string[] = [];

  // --- Crime Severity Index ---
  try {
    const crimeRows = await fetchCrimeSeverityIndex();
    if (crimeRows.length > 0) {
      const inserted = await withTransaction(async (client: pg.PoolClient) => {
        let n = 0;
        for (const row of crimeRows) {
          if (!row.municipality || !row.period) continue;
          await client.query(SQL_UPSERT_CRIME, [
            row.municipality,
            row.period,
            row.csi,
            row.unit || "Index",
          ]);
          n++;
        }
        return n;
      });
      total += inserted;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[safety] crime severity fetch/upsert failed:", msg);
    errors.push(`crime: ${msg}`);
  }

  // --- Edmonton Fire by Type ---
  try {
    const fireRows = await fetchEdmontonFireByType();
    if (fireRows.length > 0) {
      const inserted = await withTransaction(async (client: pg.PoolClient) => {
        let n = 0;
        for (const row of fireRows) {
          if (!row.eventType) continue;
          await client.query(SQL_UPSERT_FIRE, [
            today,
            row.eventType,
            row.count,
            row.avgDuration,
          ]);
          n++;
        }
        return n;
      });
      total += inserted;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[safety] fire by-type fetch/upsert failed:", msg);
    errors.push(`fire: ${msg}`);
  }

  // Snapshot log — one row summarising the run
  const logStatus = errors.length === 0 ? "ok" : "error";
  const logError = errors.length > 0 ? errors.join("; ") : null;
  await pool.query(SQL_LOG, ["safety", total, logStatus, logError]);

  return total;
}

// ---------------------------------------------------------------------------
// Read helpers (used by the MCP tool)
// ---------------------------------------------------------------------------

export interface CrimeSeverityRow {
  municipality: string;
  period: string;
  csi: number;
  unit: string;
}

/**
 * Read stored crime severity rows.
 *
 * If `municipality` is provided, returns the time series for that
 * municipality. Otherwise returns all stored rows ordered by municipality
 * then period. Results capped at 2000 rows.
 */
export async function readCrimeSeverity(
  municipality?: string
): Promise<CrimeSeverityRow[]> {
  const pool = await getDb();
  let result;
  if (municipality) {
    result = await pool.query<{ municipality: string; period: string; csi: string; unit: string }>(
      `SELECT municipality, period, csi, unit
         FROM safety_crime_severity
         WHERE LOWER(municipality) = LOWER($1)
         ORDER BY period ASC
         LIMIT 500`,
      [municipality]
    );
  } else {
    result = await pool.query<{ municipality: string; period: string; csi: string; unit: string }>(
      `SELECT municipality, period, csi, unit
         FROM safety_crime_severity
         ORDER BY municipality ASC, period ASC
         LIMIT 2000`
    );
  }
  return result.rows.map((r) => ({
    municipality: r.municipality,
    period: r.period,
    csi: Number(r.csi),
    unit: r.unit,
  }));
}

export interface FireByTypeRow {
  snapshot_date: string;
  event_type: string;
  incident_count: number;
  avg_duration_mins: number;
}

/**
 * Read the latest stored Edmonton fire incident summary by event type.
 *
 * Returns rows for the most recent snapshot_date in the table (i.e. the
 * last successful daily collect run). Falls back to all dates if no
 * rows exist for the current day.
 */
export async function readFireByType(): Promise<FireByTypeRow[]> {
  const pool = await getDb();
  const result = await pool.query<{
    snapshot_date: string;
    event_type: string;
    incident_count: string;
    avg_duration_mins: string;
  }>(
    `SELECT snapshot_date, event_type, incident_count, avg_duration_mins
       FROM safety_fire_by_type
       WHERE snapshot_date = (
         SELECT MAX(snapshot_date) FROM safety_fire_by_type
       )
       ORDER BY incident_count DESC`
  );
  return result.rows.map((r) => ({
    snapshot_date: r.snapshot_date,
    event_type: r.event_type,
    incident_count: Number(r.incident_count),
    avg_duration_mins: Number(r.avg_duration_mins),
  }));
}
