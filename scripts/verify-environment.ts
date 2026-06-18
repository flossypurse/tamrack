/**
 * Verification script for the environment vertical.
 *
 * Runs boot-DDL, seeds rows into the four environment tables, calls the
 * read helpers, and asserts expected values.  Exits 0 on success, 1 on
 * any assertion failure.
 *
 * Usage:
 *   DATABASE_URL="postgresql://postgres@127.0.0.1:54399/tamrack_verify_environment" \
 *     npx tsx scripts/verify-environment.ts
 */

import { getDb } from "../src/lib/db";
import {
  readAQHI,
  readWaterLevels,
  readEarthquakes,
  readWildfireSummaries,
} from "../src/lib/collect-environment";

let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

async function main() {
  console.log("[verify-environment] booting DDL …");
  const pool = await getDb();
  console.log("[verify-environment] DDL applied\n");

  const today = "2026-06-10";
  const yesterday = "2026-06-09";

  // -------------------------------------------------------------------------
  // Seed env_aqhi_snapshots
  // -------------------------------------------------------------------------
  console.log("=== env_aqhi_snapshots ===");
  await pool.query(`
    INSERT INTO env_aqhi_snapshots
      (snapshot_date, location_id, location_name, aqhi, observation_time, latitude, longitude)
    VALUES
      ($1, 'AB-EDM-001', 'Edmonton South', 3, '2026-06-10T14:00:00Z', 53.5, -113.5),
      ($1, 'AB-CAL-001', 'Calgary NW',     5, '2026-06-10T14:00:00Z', 51.1, -114.1)
    ON CONFLICT (snapshot_date, location_id) DO UPDATE SET
      aqhi = EXCLUDED.aqhi, collected_at = NOW()
  `, [today]);

  // Upsert seed — same date, should update not double-insert
  await pool.query(`
    INSERT INTO env_aqhi_snapshots
      (snapshot_date, location_id, location_name, aqhi, observation_time, latitude, longitude)
    VALUES ($1, 'AB-EDM-001', 'Edmonton South', 4, '2026-06-10T15:00:00Z', 53.5, -113.5)
    ON CONFLICT (snapshot_date, location_id) DO UPDATE SET aqhi = EXCLUDED.aqhi
  `, [today]);

  const aqhi = await readAQHI(today);
  assert("readAQHI returns 2 stations", aqhi.length === 2, `got ${aqhi.length}`);
  const edm = aqhi.find((r) => r.location_id === "AB-EDM-001");
  assert("Edmonton AQHI upsert resolved to 4", edm?.aqhi === 4, `got ${edm?.aqhi}`);

  const aqhiLatest = await readAQHI(); // no date arg — should return today
  assert("readAQHI() (no date) returns latest snapshot", aqhiLatest.length === 2);

  // -------------------------------------------------------------------------
  // Seed env_water_snapshots
  // -------------------------------------------------------------------------
  console.log("\n=== env_water_snapshots ===");
  await pool.query(`
    INSERT INTO env_water_snapshots
      (snapshot_date, station_id, station_name, water_level, discharge, reading_time, latitude, longitude)
    VALUES
      ($1, '05DF001', 'North Saskatchewan River at Edmonton', 3.45, 250.0, '2026-06-10T14:00:00Z', 53.54, -113.49),
      ($1, '05BH004', 'Bow River at Banff',                  1.12, 12.0,  '2026-06-10T14:00:00Z', 51.17, -115.57)
    ON CONFLICT (snapshot_date, station_id) DO UPDATE SET
      water_level = EXCLUDED.water_level, collected_at = NOW()
  `, [today]);

  const water = await readWaterLevels(today);
  assert("readWaterLevels returns 2 stations", water.length === 2, `got ${water.length}`);
  const nsask = water.find((r) => r.station_id === "05DF001");
  assert("North Saskatchewan water level = 3.45", nsask?.water_level === 3.45, `got ${nsask?.water_level}`);

  const waterLatest = await readWaterLevels();
  assert("readWaterLevels() (no date) returns latest snapshot", waterLatest.length === 2);

  // -------------------------------------------------------------------------
  // Seed env_earthquake_events
  // -------------------------------------------------------------------------
  console.log("\n=== env_earthquake_events ===");
  await pool.query(`
    INSERT INTO env_earthquake_events
      (event_id, snapshot_date, magnitude, location, latitude, longitude, depth_km, event_time, source)
    VALUES
      ('usgs-aa001', $1, 2.3, '10km NW of Red Deer, AB', 52.3, -113.8, 8.0, '2026-06-10T12:00:00Z', 'USGS'),
      ('usgs-aa002', $2, 3.1, '5km S of Fort McMurray, AB', 56.6, -111.4, 15.0, '2026-06-09T06:00:00Z', 'USGS')
    ON CONFLICT (event_id) DO UPDATE SET magnitude = EXCLUDED.magnitude
  `, [today, yesterday]);

  // Upsert idempotency test
  await pool.query(`
    INSERT INTO env_earthquake_events
      (event_id, snapshot_date, magnitude, location, latitude, longitude, depth_km, event_time, source)
    VALUES ('usgs-aa001', $1, 2.4, '10km NW of Red Deer, AB', 52.3, -113.8, 8.0, '2026-06-10T12:00:00Z', 'USGS')
    ON CONFLICT (event_id) DO UPDATE SET magnitude = EXCLUDED.magnitude
  `, [today]);

  const quakes = await readEarthquakes(30);
  assert("readEarthquakes returns 2 events", quakes.length === 2, `got ${quakes.length}`);

  const aa001 = quakes.find((q) => q.event_id === "usgs-aa001");
  assert("usgs-aa001 magnitude upserted to 2.4", aa001?.magnitude === 2.4, `got ${aa001?.magnitude}`);

  const quakesFiltered = await readEarthquakes(30, 3.0);
  assert("readEarthquakes with min_magnitude=3.0 returns 1 event", quakesFiltered.length === 1, `got ${quakesFiltered.length}`);
  assert("filtered event is usgs-aa002", quakesFiltered[0]?.event_id === "usgs-aa002");

  // -------------------------------------------------------------------------
  // Seed env_wildfire_daily
  // -------------------------------------------------------------------------
  console.log("\n=== env_wildfire_daily ===");
  await pool.query(`
    INSERT INTO env_wildfire_daily
      (snapshot_date, active_count, total_size_ha, out_of_control, being_held, under_control)
    VALUES
      ($1, 12, 4500.0, 3, 5, 4),
      ($2, 8,  2100.0, 1, 4, 3)
    ON CONFLICT (snapshot_date) DO UPDATE SET active_count = EXCLUDED.active_count
  `, [today, yesterday]);

  const wildfires = await readWildfireSummaries(30);
  assert("readWildfireSummaries returns 2 rows", wildfires.length === 2, `got ${wildfires.length}`);
  const todayFires = wildfires.find((r) => r.snapshot_date === today);
  assert("today active_count = 12", todayFires?.active_count === 12, `got ${todayFires?.active_count}`);
  assert("today total_size_ha = 4500", todayFires?.total_size_ha === 4500, `got ${todayFires?.total_size_ha}`);

  // Upsert test
  await pool.query(`
    INSERT INTO env_wildfire_daily
      (snapshot_date, active_count, total_size_ha, out_of_control, being_held, under_control)
    VALUES ($1, 15, 5000.0, 4, 6, 5)
    ON CONFLICT (snapshot_date) DO UPDATE SET active_count = EXCLUDED.active_count, total_size_ha = EXCLUDED.total_size_ha
  `, [today]);
  const wildfires2 = await readWildfireSummaries(30);
  const todayFires2 = wildfires2.find((r) => r.snapshot_date === today);
  assert("wildfire upsert updated active_count to 15", todayFires2?.active_count === 15, `got ${todayFires2?.active_count}`);
  assert("wildfire upsert did not add duplicate row", wildfires2.length === 2, `got ${wildfires2.length}`);

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log(`\n[verify-environment] ${failed === 0 ? "ALL ASSERTIONS PASSED" : `${failed} ASSERTION(S) FAILED`}`);
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("[verify-environment] Fatal error:", err);
  process.exit(1);
});
