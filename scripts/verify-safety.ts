/**
 * Local verification runner for the safety vertical.
 *
 * Usage:
 *   DATABASE_URL="postgresql://postgres@127.0.0.1:54399/tamrack_verify_safety" \
 *   npx tsx scripts/verify-safety.ts
 *
 * Bootstraps the schema via getDb(), seeds rows directly, calls the
 * collect-safety read helpers, and asserts expected values.
 * Exits 0 on all assertions passing, 1 on any failure.
 */

import { getDb } from "../src/lib/db";
import {
  readCrimeSeverity,
  readFireByType,
} from "../src/lib/collect-safety";

async function main(): Promise<void> {
  console.log("[verify-safety] Connecting and running boot DDL…");
  const pool = await getDb();
  console.log("[verify-safety] Schema ready.");

  let failures = 0;
  function assert(label: string, condition: boolean, detail?: unknown): void {
    if (condition) {
      console.log(`  PASS  ${label}`);
    } else {
      console.error(`  FAIL  ${label}`, detail ?? "");
      failures++;
    }
  }

  // ── Seed crime severity rows ───────────────────────────────────────────────
  console.log("\n[verify-safety] Seeding safety_crime_severity…");

  await pool.query(`
    INSERT INTO safety_crime_severity (municipality, period, csi, unit)
    VALUES
      ('Edmonton', '2022', 92.5, 'Index'),
      ('Edmonton', '2023', 88.1, 'Index'),
      ('Calgary',  '2022', 75.0, 'Index'),
      ('Calgary',  '2023', 72.4, 'Index'),
      ('Lethbridge', '2023', 110.2, 'Index')
    ON CONFLICT (municipality, period)
    DO UPDATE SET csi = EXCLUDED.csi, unit = EXCLUDED.unit
  `);
  console.log("[verify-safety] Crime rows seeded.");

  // ── Seed fire by-type rows ─────────────────────────────────────────────────
  console.log("[verify-safety] Seeding safety_fire_by_type…");

  const today = new Date().toISOString().slice(0, 10);
  await pool.query(
    `INSERT INTO safety_fire_by_type (snapshot_date, event_type, incident_count, avg_duration_mins)
     VALUES
       ($1, 'Medical', 52000, 28.5),
       ($1, 'Fire',    8000,  45.2),
       ($1, 'Rescue',  3500,  60.1)
     ON CONFLICT (snapshot_date, event_type)
     DO UPDATE SET incident_count = EXCLUDED.incident_count, avg_duration_mins = EXCLUDED.avg_duration_mins`,
    [today]
  );
  console.log("[verify-safety] Fire rows seeded.");

  // ── Assertions: readCrimeSeverity (all) ────────────────────────────────────
  console.log("\n[verify-safety] readCrimeSeverity() — all:");
  const allCrime = await readCrimeSeverity();
  assert("returns 5 rows total", allCrime.length === 5, allCrime.length);
  assert(
    "rows have municipality, period, csi, unit fields",
    allCrime.every((r) => r.municipality && r.period && typeof r.csi === "number" && r.unit),
    allCrime[0],
  );
  const csiValues = allCrime.map((r) => r.csi);
  assert("csi values are numeric", csiValues.every((v) => Number.isFinite(v)));

  // ── Assertions: readCrimeSeverity (municipality filter) ───────────────────
  console.log("\n[verify-safety] readCrimeSeverity('Edmonton'):");
  const edmCrime = await readCrimeSeverity("Edmonton");
  assert("returns 2 Edmonton rows", edmCrime.length === 2, edmCrime.length);
  assert(
    "all rows are Edmonton",
    edmCrime.every((r) => r.municipality === "Edmonton"),
  );
  assert("CSI for Edmonton 2022 is 92.5", edmCrime[0].csi === 92.5, edmCrime[0]);
  assert("CSI for Edmonton 2023 is 88.1", edmCrime[1].csi === 88.1, edmCrime[1]);

  // ── Assertions: readCrimeSeverity (case-insensitive) ─────────────────────
  const calCrime = await readCrimeSeverity("calgary");
  assert("case-insensitive filter: 2 Calgary rows", calCrime.length === 2, calCrime.length);

  // ── Assertions: readFireByType ────────────────────────────────────────────
  console.log("\n[verify-safety] readFireByType():");
  const fire = await readFireByType();
  assert("returns 3 fire rows for today", fire.length === 3, fire.length);
  assert(
    "rows have snapshot_date, event_type, incident_count, avg_duration_mins",
    fire.every(
      (r) =>
        r.snapshot_date === today &&
        r.event_type &&
        typeof r.incident_count === "number" &&
        typeof r.avg_duration_mins === "number",
    ),
    fire[0],
  );
  const medRow = fire.find((r) => r.event_type === "Medical");
  assert("Medical row has incident_count 52000", medRow?.incident_count === 52000, medRow);
  assert("Medical avg_duration_mins is 28.5", medRow?.avg_duration_mins === 28.5, medRow);

  // ── Conflict idempotency: upsert same rows again ─────────────────────────
  console.log("\n[verify-safety] Conflict idempotency check:");
  await pool.query(`
    INSERT INTO safety_crime_severity (municipality, period, csi, unit)
    VALUES ('Edmonton', '2023', 99.9, 'Index')
    ON CONFLICT (municipality, period)
    DO UPDATE SET csi = EXCLUDED.csi
  `);
  const updatedEdm = await readCrimeSeverity("Edmonton");
  const edm2023 = updatedEdm.find((r) => r.period === "2023");
  assert("UPSERT updated Edmonton 2023 CSI to 99.9", edm2023?.csi === 99.9, edm2023);

  // ── Table structure checks ────────────────────────────────────────────────
  console.log("\n[verify-safety] Table structure checks:");

  const crimeTableRes = await pool.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'safety_crime_severity'
     ORDER BY ordinal_position`
  );
  const crimeColumns = crimeTableRes.rows.map((r) => r.column_name);
  assert(
    "safety_crime_severity has expected columns",
    ["id", "municipality", "period", "csi", "unit", "collected_at"].every((c) =>
      crimeColumns.includes(c)
    ),
    crimeColumns,
  );

  const fireTableRes = await pool.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'safety_fire_by_type'
     ORDER BY ordinal_position`
  );
  const fireColumns = fireTableRes.rows.map((r) => r.column_name);
  assert(
    "safety_fire_by_type has expected columns",
    ["id", "snapshot_date", "event_type", "incident_count", "avg_duration_mins", "collected_at"].every(
      (c) => fireColumns.includes(c)
    ),
    fireColumns,
  );

  // ── Unique constraint checks ──────────────────────────────────────────────
  const crimeUniqRes = await pool.query<{ conname: string }>(
    `SELECT conname FROM pg_constraint
     WHERE conrelid = 'safety_crime_severity'::regclass AND contype = 'u'`
  );
  assert(
    "safety_crime_severity has a unique constraint",
    crimeUniqRes.rows.length > 0,
    crimeUniqRes.rows,
  );

  const fireUniqRes = await pool.query<{ conname: string }>(
    `SELECT conname FROM pg_constraint
     WHERE conrelid = 'safety_fire_by_type'::regclass AND contype = 'u'`
  );
  assert(
    "safety_fire_by_type has a unique constraint",
    fireUniqRes.rows.length > 0,
    fireUniqRes.rows,
  );

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n[verify-safety] ${failures === 0 ? "All assertions passed." : `${failures} FAILURE(S)`}`);
  await pool.end();
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("[verify-safety] Fatal:", err);
  process.exit(1);
});
