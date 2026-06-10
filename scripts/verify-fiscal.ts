/**
 * Verify the fiscal vertical: DDL, upserts, and read helpers.
 *
 * Run with:
 *   DATABASE_URL="postgresql://postgres@127.0.0.1:54399/tamrack_verify_fiscal" \
 *   npx tsx scripts/verify-fiscal.ts
 */

import { getDb } from "../src/lib/db";
import {
  collectFiscal,
  readGrants,
  readTransfers,
  readContracts,
} from "../src/lib/collect-fiscal";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`  FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`  PASS: ${message}`);
}

// Seed a row directly via SQL so the verify script doesn't need live network.
async function seedGrant(pool: Awaited<ReturnType<typeof getDb>>) {
  await pool.query(
    `INSERT INTO fiscal_ab_grants
       (fiscal_year, ministry, recipient, program, amount, description)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (fiscal_year, ministry, recipient, program) DO UPDATE SET
       amount = EXCLUDED.amount, description = EXCLUDED.description`,
    ["2023-24", "Treasury Board", "Test Recipient A", "Test Program", 500000, "Verify seed"],
  );
  // Second row same FY
  await pool.query(
    `INSERT INTO fiscal_ab_grants
       (fiscal_year, ministry, recipient, program, amount, description)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (fiscal_year, ministry, recipient, program) DO UPDATE SET
       amount = EXCLUDED.amount, description = EXCLUDED.description`,
    ["2023-24", "Health", "Test Recipient B", "Health Program", 1200000, "Health seed"],
  );
  // Third row different FY
  await pool.query(
    `INSERT INTO fiscal_ab_grants
       (fiscal_year, ministry, recipient, program, amount, description)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (fiscal_year, ministry, recipient, program) DO UPDATE SET
       amount = EXCLUDED.amount, description = EXCLUDED.description`,
    ["2022-23", "Environment", "Test Recipient C", "Env Program", 300000, "Env seed"],
  );
}

async function seedTransfers(pool: Awaited<ReturnType<typeof getDb>>) {
  await pool.query(
    `INSERT INTO fiscal_federal_transfers (year, province, transfer_type, amount)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (year, transfer_type) DO UPDATE SET amount = EXCLUDED.amount`,
    [2024, "Alberta", "Canada Health Transfer", 8500000000],
  );
  await pool.query(
    `INSERT INTO fiscal_federal_transfers (year, province, transfer_type, amount)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (year, transfer_type) DO UPDATE SET amount = EXCLUDED.amount`,
    [2024, "Alberta", "Canada Social Transfer", 2100000000],
  );
  await pool.query(
    `INSERT INTO fiscal_federal_transfers (year, province, transfer_type, amount)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (year, transfer_type) DO UPDATE SET amount = EXCLUDED.amount`,
    [2023, "Alberta", "Canada Health Transfer", 8000000000],
  );
}

async function seedContracts(pool: Awaited<ReturnType<typeof getDb>>) {
  await pool.query(
    `INSERT INTO fiscal_federal_contracts
       (vendor, department, description, contract_date, value, province)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (vendor, department, contract_date, value) DO UPDATE SET
       description = EXCLUDED.description`,
    ["Acme IT Ltd", "National Defence", "IT consulting services", "2024-03-01", 450000, "Alberta"],
  );
  await pool.query(
    `INSERT INTO fiscal_federal_contracts
       (vendor, department, description, contract_date, value, province)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (vendor, department, contract_date, value) DO UPDATE SET
       description = EXCLUDED.description`,
    ["BuildCo Inc", "Infrastructure Canada", "Bridge inspection", "2024-01-15", 120000, "Alberta"],
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("[verify-fiscal] Connecting to Postgres ...");
  const pool = await getDb(); // runs MIGRATION_SQL, creates tables

  console.log("\n--- Table creation ---");
  const tableCheck = await pool.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename IN ('fiscal_ab_grants','fiscal_federal_transfers','fiscal_federal_contracts')
      ORDER BY tablename`,
  );
  const tableNames = tableCheck.rows.map((r) => r.tablename).sort();
  assert(tableNames.length === 3, "all 3 fiscal tables exist");
  assert(tableNames.includes("fiscal_ab_grants"), "fiscal_ab_grants exists");
  assert(tableNames.includes("fiscal_federal_transfers"), "fiscal_federal_transfers exists");
  assert(tableNames.includes("fiscal_federal_contracts"), "fiscal_federal_contracts exists");

  console.log("\n--- Seed rows directly ---");
  await seedGrant(pool);
  await seedTransfers(pool);
  await seedContracts(pool);
  console.log("  seeded grants (3 rows), transfers (3 rows), contracts (2 rows)");

  console.log("\n--- readGrants (all) ---");
  const allGrants = await readGrants({ limit: 50 });
  assert(allGrants.length === 3, `readGrants returns 3 rows, got ${allGrants.length}`);
  assert(allGrants[0].amount >= allGrants[1].amount, "readGrants ordered by amount DESC");

  console.log("\n--- readGrants (fiscalYear filter) ---");
  const grants2324 = await readGrants({ fiscalYear: "2023-24", limit: 50 });
  assert(grants2324.length === 2, `readGrants fiscalYear='2023-24' returns 2 rows, got ${grants2324.length}`);
  assert(
    grants2324.every((r) => r.fiscalYear === "2023-24"),
    "all returned grants have correct fiscalYear",
  );

  console.log("\n--- readTransfers (all) ---");
  const allTransfers = await readTransfers();
  assert(allTransfers.length === 3, `readTransfers returns 3 rows, got ${allTransfers.length}`);
  assert(allTransfers[0].year >= allTransfers[allTransfers.length - 1].year, "transfers ordered year DESC");

  console.log("\n--- readTransfers (year filter) ---");
  const transfers2024 = await readTransfers({ year: 2024 });
  assert(transfers2024.length === 2, `readTransfers year=2024 returns 2 rows, got ${transfers2024.length}`);
  assert(
    transfers2024.every((r) => r.year === 2024),
    "all returned transfers have year=2024",
  );

  console.log("\n--- readContracts ---");
  const allContracts = await readContracts({ limit: 10 });
  assert(allContracts.length === 2, `readContracts returns 2 rows, got ${allContracts.length}`);

  console.log("\n--- UPSERT idempotency (re-seed same rows) ---");
  await seedGrant(pool);
  await seedTransfers(pool);
  await seedContracts(pool);
  const grantsAfter = await readGrants({ limit: 50 });
  assert(grantsAfter.length === 3, `row count stable after re-seed: grants=${grantsAfter.length}`);
  const transfersAfter = await readTransfers();
  assert(transfersAfter.length === 3, `row count stable after re-seed: transfers=${transfersAfter.length}`);
  const contractsAfter = await readContracts({ limit: 10 });
  assert(contractsAfter.length === 2, `row count stable after re-seed: contracts=${contractsAfter.length}`);

  console.log("\n--- collectFiscal (no-network run, expects 0 from empty upstream) ---");
  // The fetchers hit real URLs; on a local DB they'll get 0 rows or fail.
  // collectFiscal is try/caught per sub-fetch, so it always returns a count
  // and writes a snapshot_log row.  We just assert it doesn't throw.
  let fiscalCount: number | undefined;
  let fiscalError: unknown;
  try {
    fiscalCount = await collectFiscal("2026-06-10");
  } catch (e) {
    fiscalError = e;
  }
  assert(fiscalError === undefined, "collectFiscal does not throw");
  assert(typeof fiscalCount === "number", `collectFiscal returns a number (got ${fiscalCount})`);

  // Verify snapshot_log row was written
  const logRow = await pool.query<{ status: string }>(
    `SELECT status FROM snapshot_log WHERE source = 'fiscal' ORDER BY taken_at DESC LIMIT 1`,
  );
  assert(logRow.rows.length > 0, "snapshot_log row written by collectFiscal");

  console.log("\n[verify-fiscal] All assertions passed.");
  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("[verify-fiscal] Uncaught error:", err);
  process.exit(1);
});
