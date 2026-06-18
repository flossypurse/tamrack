/**
 * Environment data collection and read layer.
 *
 * Collects daily snapshots from four real-time feeds and persists them to
 * Postgres so the MCP tool can serve the latest stored readings without
 * blocking on upstream APIs at query time.
 *
 * Sources:
 *   - ECCC AQHI observations  (api.weather.gc.ca) — Alberta stations
 *   - ECCC hydrometric         (api.weather.gc.ca) — Alberta water levels
 *   - USGS earthquake feed     — Alberta bounding box (49-60°N, 120-110°W)
 *   - Alberta Wildfire ArcGIS  — active fire count summary (no stable per-fire id)
 *
 * Design notes:
 *   - Each sub-fetch is wrapped in its own try/catch; one failed feed does
 *     not abort the others.
 *   - All writes UPSERT on the table's UNIQUE conflict key so re-running the
 *     collector on the same day refreshes stale readings in place.
 *   - A snapshot_log row (source: "environment") is written on both success
 *     and error paths.
 *   - Returns the total number of rows upserted across all feeds.
 */

import type pg from "pg";

import { getDb, withTransaction } from "./db";
import {
  fetchAlbertaAQHI,
  fetchAlbertaWaterLevels,
  fetchAlbertaEarthquakes,
  fetchActiveWildfires,
} from "./data-sources";

// ---------------------------------------------------------------------------
// SQL helpers
// ---------------------------------------------------------------------------

const SQL_UPSERT_AQHI = `
  INSERT INTO env_aqhi_snapshots
    (snapshot_date, location_id, location_name, aqhi, observation_time, latitude, longitude)
  VALUES ($1, $2, $3, $4, $5, $6, $7)
  ON CONFLICT (snapshot_date, location_id) DO UPDATE SET
    location_name    = EXCLUDED.location_name,
    aqhi             = EXCLUDED.aqhi,
    observation_time = EXCLUDED.observation_time,
    latitude         = EXCLUDED.latitude,
    longitude        = EXCLUDED.longitude,
    collected_at     = NOW()
`;

const SQL_UPSERT_WATER = `
  INSERT INTO env_water_snapshots
    (snapshot_date, station_id, station_name, water_level, discharge, reading_time, latitude, longitude)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  ON CONFLICT (snapshot_date, station_id) DO UPDATE SET
    station_name  = EXCLUDED.station_name,
    water_level   = EXCLUDED.water_level,
    discharge     = EXCLUDED.discharge,
    reading_time  = EXCLUDED.reading_time,
    latitude      = EXCLUDED.latitude,
    longitude     = EXCLUDED.longitude,
    collected_at  = NOW()
`;

const SQL_UPSERT_QUAKE = `
  INSERT INTO env_earthquake_events
    (event_id, snapshot_date, magnitude, location, latitude, longitude, depth_km, event_time, source)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  ON CONFLICT (event_id) DO UPDATE SET
    snapshot_date = EXCLUDED.snapshot_date,
    magnitude     = EXCLUDED.magnitude,
    location      = EXCLUDED.location,
    latitude      = EXCLUDED.latitude,
    longitude     = EXCLUDED.longitude,
    depth_km      = EXCLUDED.depth_km,
    event_time    = EXCLUDED.event_time,
    collected_at  = NOW()
`;

const SQL_UPSERT_WILDFIRE = `
  INSERT INTO env_wildfire_daily
    (snapshot_date, active_count, total_size_ha, out_of_control, being_held, under_control)
  VALUES ($1, $2, $3, $4, $5, $6)
  ON CONFLICT (snapshot_date) DO UPDATE SET
    active_count   = EXCLUDED.active_count,
    total_size_ha  = EXCLUDED.total_size_ha,
    out_of_control = EXCLUDED.out_of_control,
    being_held     = EXCLUDED.being_held,
    under_control  = EXCLUDED.under_control,
    collected_at   = NOW()
`;

const SQL_LOG = `
  INSERT INTO snapshot_log (taken_at, source, records_inserted, status, error)
  VALUES (NOW(), $1, $2, $3, $4)
`;

// ---------------------------------------------------------------------------
// Collector
// ---------------------------------------------------------------------------

/**
 * Snapshot all environment feeds for `today` (YYYY-MM-DD).
 * Returns the total number of rows upserted across all feeds.
 */
export async function collectEnvironment(today: string): Promise<number> {
  const pool = await getDb();
  let totalRows = 0;
  const errors: string[] = [];

  // --- AQHI ---
  try {
    const readings = await fetchAlbertaAQHI();
    if (readings.length > 0) {
      await withTransaction(async (client: pg.PoolClient) => {
        for (const r of readings) {
          await client.query(SQL_UPSERT_AQHI, [
            today,
            r.locationId,
            r.location,
            r.aqhi,
            r.observationTime,
            r.latitude,
            r.longitude,
          ]);
        }
      });
      totalRows += readings.length;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`aqhi: ${msg}`);
    await pool
      .query(SQL_LOG, ["environment:aqhi", 0, "error", msg])
      .catch(() => {});
  }

  // --- Water levels ---
  try {
    const stations = await fetchAlbertaWaterLevels();
    if (stations.length > 0) {
      await withTransaction(async (client: pg.PoolClient) => {
        for (const s of stations) {
          await client.query(SQL_UPSERT_WATER, [
            today,
            s.stationId,
            s.stationName,
            s.waterLevel,
            s.discharge,
            s.date,
            s.latitude,
            s.longitude,
          ]);
        }
      });
      totalRows += stations.length;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`water: ${msg}`);
    await pool
      .query(SQL_LOG, ["environment:water", 0, "error", msg])
      .catch(() => {});
  }

  // --- Earthquakes ---
  // Fetch 30 days so a daily run keeps the last month current.
  // UNIQUE is on event_id (USGS stable id), so older events upsert in place.
  try {
    const quakes = await fetchAlbertaEarthquakes(30);
    if (quakes.length > 0) {
      await withTransaction(async (client: pg.PoolClient) => {
        for (const q of quakes) {
          if (!q.id) continue;
          await client.query(SQL_UPSERT_QUAKE, [
            q.id,
            today,
            q.magnitude,
            q.location,
            q.latitude,
            q.longitude,
            q.depth,
            q.time,
            q.source,
          ]);
        }
      });
      totalRows += quakes.length;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`earthquakes: ${msg}`);
    await pool
      .query(SQL_LOG, ["environment:earthquakes", 0, "error", msg])
      .catch(() => {});
  }

  // --- Wildfires (count summary only — no stable per-fire id) ---
  try {
    const fires = await fetchActiveWildfires();
    let totalSizeHa = 0;
    let outOfControl = 0;
    let beingHeld = 0;
    let underControl = 0;
    for (const f of fires) {
      totalSizeHa += f.size || 0;
      const soc = (f.stageOfControl || "").toLowerCase();
      if (soc.includes("out of control")) outOfControl++;
      else if (soc.includes("being held")) beingHeld++;
      else if (soc.includes("under control") || soc.includes("extinguish")) underControl++;
    }
    await pool.query(SQL_UPSERT_WILDFIRE, [
      today,
      fires.length,
      totalSizeHa,
      outOfControl,
      beingHeld,
      underControl,
    ]);
    totalRows += 1;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`wildfires: ${msg}`);
    await pool
      .query(SQL_LOG, ["environment:wildfires", 0, "error", msg])
      .catch(() => {});
  }

  // --- Summary snapshot_log row ---
  if (errors.length === 0) {
    await pool.query(SQL_LOG, ["environment", totalRows, "ok", null]);
  } else {
    await pool.query(SQL_LOG, [
      "environment",
      totalRows,
      "error",
      errors.join("; "),
    ]);
  }

  return totalRows;
}

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

export interface AQHIRow {
  snapshot_date: string;
  location_id: string;
  location_name: string;
  aqhi: number;
  observation_time: string;
  latitude: number;
  longitude: number;
}

export interface WaterRow {
  snapshot_date: string;
  station_id: string;
  station_name: string;
  water_level: number | null;
  discharge: number | null;
  reading_time: string;
  latitude: number;
  longitude: number;
}

export interface EarthquakeRow {
  event_id: string;
  snapshot_date: string;
  magnitude: number;
  location: string;
  latitude: number;
  longitude: number;
  depth_km: number;
  event_time: string;
  source: string;
}

export interface WildfireDailyRow {
  snapshot_date: string;
  active_count: number;
  total_size_ha: number;
  out_of_control: number;
  being_held: number;
  under_control: number;
}

/**
 * Latest stored AQHI snapshot.
 * @param date — specific date (YYYY-MM-DD); omit for the most recent.
 */
export async function readAQHI(date?: string): Promise<AQHIRow[]> {
  const pool = await getDb();
  if (date) {
    const { rows } = await pool.query<AQHIRow>(
      `SELECT snapshot_date, location_id, location_name, aqhi, observation_time, latitude, longitude
         FROM env_aqhi_snapshots
         WHERE snapshot_date = $1
         ORDER BY aqhi DESC`,
      [date],
    );
    return rows;
  }
  const { rows } = await pool.query<AQHIRow>(
    `SELECT snapshot_date, location_id, location_name, aqhi, observation_time, latitude, longitude
       FROM env_aqhi_snapshots
       WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM env_aqhi_snapshots)
       ORDER BY aqhi DESC`,
  );
  return rows;
}

/**
 * Latest stored water-level snapshot.
 * @param date — specific date (YYYY-MM-DD); omit for the most recent.
 */
export async function readWaterLevels(date?: string): Promise<WaterRow[]> {
  const pool = await getDb();
  if (date) {
    const { rows } = await pool.query<WaterRow>(
      `SELECT snapshot_date, station_id, station_name, water_level, discharge, reading_time, latitude, longitude
         FROM env_water_snapshots
         WHERE snapshot_date = $1
         ORDER BY station_name`,
      [date],
    );
    return rows;
  }
  const { rows } = await pool.query<WaterRow>(
    `SELECT snapshot_date, station_id, station_name, water_level, discharge, reading_time, latitude, longitude
       FROM env_water_snapshots
       WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM env_water_snapshots)
       ORDER BY station_name`,
  );
  return rows;
}

/**
 * Stored earthquake events, most recent first.
 * @param days — look-back window in days (default 30).
 * @param minMagnitude — optional lower bound on magnitude.
 */
export async function readEarthquakes(
  days: number = 30,
  minMagnitude?: number,
): Promise<EarthquakeRow[]> {
  const pool = await getDb();
  // Window on when the quake actually happened (event_time, ISO 8601 and so
  // lexically date-sortable), NOT when it was collected (snapshot_date).
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString();
  const { rows } = await pool.query<EarthquakeRow>(
    `SELECT event_id, snapshot_date, magnitude, location, latitude, longitude, depth_km, event_time, source
       FROM env_earthquake_events
       WHERE event_time >= $1
         AND ($2::double precision IS NULL OR magnitude >= $2)
       ORDER BY event_time DESC`,
    [cutoff, minMagnitude ?? null],
  );
  return rows;
}

/**
 * Stored wildfire daily summaries, most recent first.
 * @param days — look-back window in days (default 30).
 */
export async function readWildfireSummaries(
  days: number = 30,
): Promise<WildfireDailyRow[]> {
  const pool = await getDb();
  const cutoff = new Date(Date.now() - days * 86400_000)
    .toISOString()
    .slice(0, 10);
  const { rows } = await pool.query<WildfireDailyRow>(
    `SELECT snapshot_date, active_count, total_size_ha, out_of_control, being_held, under_control
       FROM env_wildfire_daily
       WHERE snapshot_date >= $1
       ORDER BY snapshot_date DESC`,
    [cutoff],
  );
  return rows;
}
