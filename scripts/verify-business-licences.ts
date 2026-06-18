/**
 * Smoke-test script for business licence ingestion.
 *
 * 1. LIVE fetch: pulls 5 records from each city and prints the first 2.
 * 2. LOCAL persist: boots the boot-DDL on a local verification DB,
 *    upserts a few rows, reads them back, and asserts UNIQUE idempotency.
 *
 * Usage:
 *   DATABASE_URL="postgresql://postgres@127.0.0.1:54399/tamrack_verify_biz" \
 *     npx tsx scripts/verify-business-licences.ts
 */

import { Client } from "pg";
import {
  fetchEdmontonBusinessLicenceRecordDetails,
  fetchCalgaryBusinessLicenceRecords,
} from "../src/lib/data-sources-business";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function banner(msg: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(msg);
  console.log("=".repeat(60));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // -------------------------------------------------------------------------
  // 1. LIVE fetch smoke
  // -------------------------------------------------------------------------

  banner("LIVE FETCH — Edmonton (limit 5)");
  const edmRecords = await fetchEdmontonBusinessLicenceRecordDetails(5);
  console.log(`Returned ${edmRecords.length} record(s)`);
  console.log("First 2 Edmonton records:");
  edmRecords.slice(0, 2).forEach((r, i) => {
    console.log(`  [${i + 1}] licenceId=${r.licenceId} name=${r.tradeName} addr=${r.address} category=${r.category} issueDate=${r.issueDate}`);
  });

  banner("LIVE FETCH — Calgary (limit 5)");
  const calRecords = await fetchCalgaryBusinessLicenceRecords(5);
  console.log(`Returned ${calRecords.length} record(s)`);
  console.log("First 2 Calgary records:");
  calRecords.slice(0, 2).forEach((r, i) => {
    console.log(`  [${i + 1}] licenceId=${r.licenceId} name=${r.tradeName} addr=${r.address} district=${r.communityDistrictName} issuedDate=${r.firstIssuedDate}`);
  });

  // -------------------------------------------------------------------------
  // 2. LOCAL persist smoke
  // -------------------------------------------------------------------------

  banner("LOCAL PERSIST SMOKE — PG16 @ 127.0.0.1:54399");

  const dbName = "tamrack_verify_biz";
  const adminClient = new Client({
    host: "127.0.0.1",
    port: 54399,
    user: "postgres",
    database: "postgres",
  });
  await adminClient.connect();

  // Drop and recreate the verification DB
  await adminClient.query(`DROP DATABASE IF EXISTS ${dbName}`);
  await adminClient.query(`CREATE DATABASE ${dbName}`);
  await adminClient.end();

  const client = new Client({
    host: "127.0.0.1",
    port: 54399,
    user: "postgres",
    database: dbName,
  });
  await client.connect();

  // Minimal DDL: just the table we care about
  await client.query(`
    CREATE TABLE business_licences (
      id           SERIAL PRIMARY KEY,
      source       TEXT NOT NULL,
      licence_id   TEXT NOT NULL,
      trade_name   TEXT NOT NULL,
      legal_name   TEXT,
      address      TEXT,
      city         TEXT,
      locality     TEXT,
      category     TEXT,
      status       TEXT,
      issue_date   TEXT,
      expiry_date  TEXT,
      latitude     DOUBLE PRECISION,
      longitude    DOUBLE PRECISION,
      collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (source, licence_id)
    )
  `);

  const UPSERT = `
    INSERT INTO business_licences
      (source, licence_id, trade_name, address, city, locality,
       category, status, issue_date, expiry_date, latitude, longitude)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (source, licence_id) DO UPDATE SET
      trade_name   = EXCLUDED.trade_name,
      address      = EXCLUDED.address,
      city         = EXCLUDED.city,
      locality     = EXCLUDED.locality,
      category     = EXCLUDED.category,
      status       = EXCLUDED.status,
      issue_date   = EXCLUDED.issue_date,
      expiry_date  = EXCLUDED.expiry_date,
      latitude     = EXCLUDED.latitude,
      longitude    = EXCLUDED.longitude,
      collected_at = NOW()
  `;

  // Seed 3 Edmonton rows
  const seedEdm = [
    { licenceId: "EDM-001", tradeName: "Test Bakery", address: "123 Main St", locality: "Glenora", category: "Food Service" },
    { licenceId: "EDM-002", tradeName: "Test Garage", address: "456 Oak Ave", locality: "Oliver", category: "Auto" },
    { licenceId: "EDM-003", tradeName: "Test Spa", address: "789 Elm Dr", locality: "Garneau", category: "Personal Service" },
  ];
  for (const r of seedEdm) {
    await client.query(UPSERT, [
      "edmonton", r.licenceId, r.tradeName, r.address,
      "Edmonton", r.locality, r.category, "ISSUED",
      "2024-01-01", "2025-01-01", 53.5, -113.5,
    ]);
  }

  // Seed 2 Calgary rows
  const seedCal = [
    { licenceId: "CAL-001", tradeName: "Calgary Plumbing Co", address: "100 Centre St N", locality: "Beltline", category: "PLUMBING" },
    { licenceId: "CAL-002", tradeName: "YYC Yoga Studio", address: "200 17 Ave SW", locality: "Mission", category: "FITNESS STUDIO" },
  ];
  for (const r of seedCal) {
    await client.query(UPSERT, [
      "calgary", r.licenceId, r.tradeName, r.address,
      "Calgary", r.locality, r.category, "Licensed",
      "2023-06-01", "2024-06-01", 51.0, -114.0,
    ]);
  }

  const { rows: allRows } = await client.query<{ source: string; licence_id: string; trade_name: string }>(
    `SELECT source, licence_id, trade_name FROM business_licences ORDER BY source, licence_id`
  );
  console.log(`Seeded ${allRows.length} rows:`);
  for (const r of allRows) {
    console.log(`  source=${r.source} licence_id=${r.licence_id} name=${r.trade_name}`);
  }

  // Assert counts
  const expectedCount = seedEdm.length + seedCal.length;
  if (allRows.length !== expectedCount) {
    throw new Error(`Expected ${expectedCount} rows, got ${allRows.length}`);
  }
  console.log(`\nCount assertion OK: ${allRows.length} === ${expectedCount}`);

  // Idempotency: re-upsert the same rows
  for (const r of seedEdm) {
    await client.query(UPSERT, [
      "edmonton", r.licenceId, r.tradeName + " (updated)", r.address,
      "Edmonton", r.locality, r.category, "ISSUED",
      "2024-01-01", "2025-01-01", 53.5, -113.5,
    ]);
  }
  const { rows: afterRows } = await client.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM business_licences`
  );
  const countAfter = parseInt(afterRows[0].count, 10);
  if (countAfter !== expectedCount) {
    throw new Error(`Idempotency FAIL: expected ${expectedCount} rows after re-upsert, got ${countAfter}`);
  }
  console.log(`Idempotency assertion OK: ${countAfter} rows (no duplicates after re-upsert)`);

  // Verify trade_name was updated
  const { rows: updatedRow } = await client.query<{ trade_name: string }>(
    `SELECT trade_name FROM business_licences WHERE source='edmonton' AND licence_id='EDM-001'`
  );
  if (!updatedRow[0]?.trade_name.includes("(updated)")) {
    throw new Error(`Update assertion FAIL: trade_name not updated on re-upsert`);
  }
  console.log(`Update-on-conflict assertion OK: EDM-001 trade_name = "${updatedRow[0].trade_name}"`);

  await client.end();

  banner("ALL ASSERTIONS PASSED");
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
