/**
 * Upstream Fallback — serves data from PostgreSQL when live API calls fail.
 *
 * The Resonate collection worker periodically snapshots all upstream data into
 * the DB. When a live fetch returns empty (API down, rate-limited, schema change),
 * these functions query the most recent snapshot instead.
 *
 * This provides resilience: users see slightly stale data rather than empty charts.
 */

import { getDb } from "./db";

export interface FallbackTimeSeriesPoint {
  date: string;
  value: number;
}

/**
 * Fallback for macro metrics (BoC rates, StatsCan indicators).
 * Queries the macro_metrics table populated by the collection worker.
 */
export async function fallbackMacroTimeSeries(
  indicator: string,
  limit: number = 60,
): Promise<FallbackTimeSeriesPoint[]> {
  try {
    const pool = await getDb();
    const { rows } = await pool.query(
      `SELECT snapshot_date as date, value
       FROM macro_metrics
       WHERE indicator = $1
       ORDER BY snapshot_date DESC
       LIMIT $2`,
      [indicator, limit],
    );
    if (rows.length > 0) {
      console.log(`[fallback] Serving ${rows.length} cached macro_metrics rows for "${indicator}"`);
    }
    return rows.reverse();
  } catch (err) {
    console.error("[fallback] macro_metrics query failed:", err);
    return [];
  }
}

/**
 * Fallback for regional dashboard indicators.
 * Queries the regional_indicators table populated by the collection worker.
 */
export async function fallbackRegionalIndicator(
  indicator: string,
  municipalityName?: string,
): Promise<
  { municipality: string; period: string; value: number; unit: string }[]
> {
  try {
    const pool = await getDb();
    let query: string;
    let params: (string | undefined)[];

    if (municipalityName) {
      query = `SELECT municipality, period, value, unit
               FROM regional_indicators
               WHERE indicator = $1 AND LOWER(municipality) = LOWER($2)
               ORDER BY period ASC`;
      params = [indicator, municipalityName];
    } else {
      query = `SELECT municipality, period, value, unit
               FROM regional_indicators
               WHERE indicator = $1
               ORDER BY period ASC`;
      params = [indicator];
    }

    const { rows } = await pool.query(query, params);
    if (rows.length > 0) {
      console.log(
        `[fallback] Serving ${rows.length} cached regional_indicators rows for "${indicator}"${municipalityName ? ` (${municipalityName})` : ""}`,
      );
    }
    return rows;
  } catch (err) {
    console.error("[fallback] regional_indicators query failed:", err);
    return [];
  }
}

/**
 * Fallback for municipality assessment data.
 * Returns the most recent snapshot from municipality_assessments table.
 */
export async function fallbackMunicipalityAssessments(
  municipality: string,
  groupType: string = "zoning",
): Promise<{ group: string; count: number; avgAssessment: number }[]> {
  try {
    const pool = await getDb();
    const { rows } = await pool.query(
      `SELECT group_name as group, count, avg_value as "avgAssessment"
       FROM municipality_assessments
       WHERE municipality = $1 AND group_type = $2
         AND snapshot_date = (
           SELECT MAX(snapshot_date)
           FROM municipality_assessments
           WHERE municipality = $1 AND group_type = $2
         )
       ORDER BY count DESC`,
      [municipality, groupType],
    );
    if (rows.length > 0) {
      console.log(
        `[fallback] Serving ${rows.length} cached assessment rows for "${municipality}" (${groupType})`,
      );
    }
    return rows;
  } catch (err) {
    console.error("[fallback] municipality_assessments query failed:", err);
    return [];
  }
}
