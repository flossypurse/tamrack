/**
 * Business licence collection.
 *
 * Sources:
 *   - Edmonton Open Data (Socrata qhi4-bdpu) — per-business named records
 *   - Calgary Open Data (Socrata vdjc-pybd) — per-business named records
 *
 * Each run fetches active licences from both cities and upserts them into
 * the business_licences table. Returns the total count of rows upserted.
 * Writes a snapshot_log row on both success and error.
 */

import { getDb, withTransaction } from "./db";
import type pg from "pg";

import {
  fetchEdmontonBusinessLicenceRecordDetails,
  fetchCalgaryBusinessLicenceRecords,
} from "./data-sources-business";

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

const SQL = {
  upsert: `
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
      collected_at = NOW()`,

  logEntry: `
    INSERT INTO snapshot_log (taken_at, source, records_inserted, status, error)
    VALUES (NOW(), $1, $2, $3, $4)`,
} as const;

// ---------------------------------------------------------------------------
// Collector
// ---------------------------------------------------------------------------

/**
 * Fetch and persist named business licences from Edmonton and Calgary.
 * Each city sub-fetch is wrapped in try/catch — a failure in one city
 * does not abort the other. Returns the total count of rows upserted.
 */
export async function collectBusinessLicences(_today: string): Promise<number> {
  const pool = await getDb();
  let totalRows = 0;
  const errors: string[] = [];

  // --- Edmonton ---
  try {
    const records = await fetchEdmontonBusinessLicenceRecordDetails(3000);
    if (records.length > 0) {
      await withTransaction(async (client: pg.PoolClient) => {
        for (const r of records) {
          // Synthetic stable key when externalid is absent (should not happen
          // in practice, but guards the UNIQUE constraint from empty collisions).
          const licenceId = r.licenceId ||
            `${r.tradeName.toLowerCase()}|${r.address || ""}`.slice(0, 200);
          await client.query(SQL.upsert, [
            "edmonton",
            licenceId,
            r.tradeName,
            r.address,
            "Edmonton",
            r.neighbourhood || null,
            r.category || null,
            r.status || null,
            r.issueDate || null,
            r.expiryDate || null,
            r.latitude || null,
            r.longitude || null,
          ]);
        }
      });
      totalRows += records.length;
    }
  } catch (e) {
    errors.push(`edmonton: ${e instanceof Error ? e.message : String(e)}`);
  }

  // --- Calgary ---
  try {
    const records = await fetchCalgaryBusinessLicenceRecords(3000);
    if (records.length > 0) {
      await withTransaction(async (client: pg.PoolClient) => {
        for (const r of records) {
          const licenceId = r.licenceId ||
            `${r.tradeName.toLowerCase()}|${r.address || ""}`.slice(0, 200);
          await client.query(SQL.upsert, [
            "calgary",
            licenceId,
            r.tradeName,
            r.address,
            "Calgary",
            r.communityDistrictName || null,
            r.licenceTypes || null,
            r.status || null,
            r.firstIssuedDate || null,
            r.expiryDate || null,
            r.latitude || null,
            r.longitude || null,
          ]);
        }
      });
      totalRows += records.length;
    }
  } catch (e) {
    errors.push(`calgary: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (errors.length > 0) {
    await pool.query(SQL.logEntry, [
      "business_licences",
      totalRows,
      "error",
      errors.join("; "),
    ]);
  } else {
    await pool.query(SQL.logEntry, [
      "business_licences",
      totalRows,
      "ok",
      null,
    ]);
  }

  return totalRows;
}
