/**
 * Verification script for health data persistence.
 *
 * Runs boot-DDL, seeds rows via the upsert/read helpers, and asserts
 * expected aggregates. No top-level await (tsx transpiles to CJS).
 *
 * Usage:
 *   DATABASE_URL="postgresql://postgres@127.0.0.1:54399/tamrack_verify_health" \
 *     npx tsx scripts/verify-health.ts
 */

import { getDb } from "../src/lib/db";
import {
  collectHealth,
  readLifeExpectancy,
  readBirthsDeaths,
  readCausesOfDeath,
} from "../src/lib/collect-health";

// ---------------------------------------------------------------------------
// Seed helpers — direct SQL inserts to add known test rows
// ---------------------------------------------------------------------------

async function seedLifeExpectancy(): Promise<void> {
  const pool = await getDb();
  const rows = [
    { municipality: "VerifyMuni1", period: "2019", gender: "Both Sexes", value: 82.1 },
    { municipality: "VerifyMuni1", period: "2019", gender: "Male",       value: 80.5 },
    { municipality: "VerifyMuni2", period: "2019", gender: "Both Sexes", value: 83.0 },
  ];
  for (const r of rows) {
    await pool.query(
      `INSERT INTO health_life_expectancy (municipality, period, gender, value)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (municipality, period, gender)
       DO UPDATE SET value = EXCLUDED.value, collected_at = NOW()`,
      [r.municipality, r.period, r.gender, r.value],
    );
  }
}

async function seedBirthsDeaths(): Promise<void> {
  const pool = await getDb();
  const rows = [
    { municipality: "VerifyMuni1", period: "2020", type: "Births", value: 12500 },
    { municipality: "VerifyMuni1", period: "2020", type: "Deaths", value: 7200 },
    { municipality: "VerifyMuni2", period: "2020", type: "Births", value: 14800 },
  ];
  for (const r of rows) {
    await pool.query(
      `INSERT INTO health_births_deaths (municipality, period, type, value)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (municipality, period, type)
       DO UPDATE SET value = EXCLUDED.value, collected_at = NOW()`,
      [r.municipality, r.period, r.type, r.value],
    );
  }
}

async function seedCausesOfDeath(): Promise<void> {
  const pool = await getDb();
  // Use a future year unlikely to clash with real upstream data
  const rows = [
    { year: 2099, cause: "Cause A (verify)",  total_deaths: 7800, ranking: 1 },
    { year: 2099, cause: "Cause B (verify)",  total_deaths: 4200, ranking: 2 },
    { year: 2099, cause: "Cause C (verify)",  total_deaths: 2100, ranking: 3 },
  ];
  for (const r of rows) {
    await pool.query(
      `INSERT INTO health_causes_of_death (year, cause, total_deaths, ranking)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (year, cause)
       DO UPDATE SET total_deaths = EXCLUDED.total_deaths, ranking = EXCLUDED.ranking,
                     collected_at = NOW()`,
      [r.year, r.cause, r.total_deaths, r.ranking],
    );
  }
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

function assert(condition: boolean, msg: string): void {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("[verify-health] Connecting and running boot-DDL...");
  await getDb(); // runs MIGRATION_SQL
  console.log("[verify-health] Boot-DDL complete.");

  // Seed known rows with municipality/year values that won't clash with upstream data
  console.log("[verify-health] Seeding test rows...");
  await seedLifeExpectancy();
  await seedBirthsDeaths();
  await seedCausesOfDeath();
  console.log("[verify-health] Seed complete.");

  // collectHealth: may return real rows if upstream is reachable; must not throw
  // and must write a snapshot_log row.
  console.log("[verify-health] Running collectHealth(today)...");
  const today = new Date().toISOString().split("T")[0];
  const collected = await collectHealth(today);
  console.log(`[verify-health] collectHealth returned ${collected} rows`);

  // Read life expectancy — filter to seeded test municipality
  const leFiltered = await readLifeExpectancy({ municipality: "VerifyMuni1" });
  assert(
    leFiltered.length === 2,
    `readLifeExpectancy(VerifyMuni1) expected 2 rows, got ${leFiltered.length}`,
  );
  console.log(`PASS: readLifeExpectancy(VerifyMuni1) → ${leFiltered.length} rows`);

  // Broad read returns at least the seeded rows
  const leAll = await readLifeExpectancy();
  assert(
    leAll.length >= 3,
    `readLifeExpectancy() expected >= 3 rows, got ${leAll.length}`,
  );
  console.log(`PASS: readLifeExpectancy() → ${leAll.length} rows (>= 3 seeded)`);

  // Read births / deaths — filter to seeded test municipality
  const bdFiltered = await readBirthsDeaths({ municipality: "VerifyMuni1" });
  assert(
    bdFiltered.length === 2,
    `readBirthsDeaths(VerifyMuni1) expected 2 rows, got ${bdFiltered.length}`,
  );
  console.log(`PASS: readBirthsDeaths(VerifyMuni1) → ${bdFiltered.length} rows`);

  const bdAll = await readBirthsDeaths();
  assert(
    bdAll.length >= 3,
    `readBirthsDeaths() expected >= 3 rows, got ${bdAll.length}`,
  );
  console.log(`PASS: readBirthsDeaths() → ${bdAll.length} rows (>= 3 seeded)`);

  // Read causes of death — pinned to seeded year 2099
  const cod2099 = await readCausesOfDeath({ year: 2099 });
  assert(
    cod2099.length === 3,
    `readCausesOfDeath(2099) expected 3 rows, got ${cod2099.length}`,
  );
  assert(cod2099[0].year === 2099, `first row year expected 2099, got ${cod2099[0].year}`);
  assert(cod2099[0].ranking === 1, `first row ranking expected 1, got ${cod2099[0].ranking}`);
  assert(
    cod2099[0].cause === "Cause A (verify)",
    `first cause expected "Cause A (verify)", got "${cod2099[0].cause}"`,
  );
  console.log(
    `PASS: readCausesOfDeath(2099) → ${cod2099.length} rows, ranking[0]=${cod2099[0].ranking}, cause="${cod2099[0].cause}"`,
  );

  // Default (no year) returns the latest year — that might be 2099 now or a real upstream year
  const codDefault = await readCausesOfDeath();
  assert(
    codDefault.length > 0,
    `readCausesOfDeath() (default) expected > 0 rows, got ${codDefault.length}`,
  );
  console.log(
    `PASS: readCausesOfDeath() (default year) → ${codDefault.length} rows, year=${codDefault[0].year}`,
  );

  // Verify snapshot_log entry was written by collectHealth
  const pool = await getDb();
  const logRes = await pool.query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM snapshot_log WHERE source = 'health'`,
  );
  const logCount = Number(logRes.rows[0]?.cnt ?? 0);
  assert(logCount >= 1, `snapshot_log expected at least 1 health row, got ${logCount}`);
  console.log(`PASS: snapshot_log has ${logCount} health row(s)`);

  console.log("[verify-health] All assertions passed.");
  process.exit(0);
}

main().catch((e) => {
  console.error("[verify-health] FAILED:", e);
  process.exit(1);
});
