/**
 * Fiscal vertical — collector and read helpers.
 *
 * collectFiscal(today) fetches three government spending feeds and upserts
 * them into Postgres.  Each sub-fetch is independently try/caught so a
 * single upstream failure does not abort the others.  A snapshot_log row
 * is written on both success and error (source: "fiscal").
 *
 * Read helpers (readGrants, readTransfers, readContracts) are used by the
 * MCP tool to serve stored data without a live fetch at query time.
 *
 * Sources (all open government data):
 *   - Alberta Grant Disclosure          open.alberta.ca CKAN
 *   - Federal Major Transfers           open.canada.ca CKAN
 *   - Federal Contracts (AB)            open.canada.ca proactive disclosure
 */

import { getDb, withTransaction } from "./db";
import type pg from "pg";
import {
  fetchAlbertaGrants,
  fetchFederalTransfers,
  fetchFederalContractsAB,
  type GrantRecord,
  type FederalTransfer,
  type FederalContract,
} from "./data-sources-fiscal";

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

const SQL = {
  upsertAbGrant: `
    INSERT INTO fiscal_ab_grants
      (fiscal_year, ministry, recipient, program, amount, description)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (fiscal_year, ministry, recipient, program) DO UPDATE SET
      amount       = EXCLUDED.amount,
      description  = EXCLUDED.description,
      collected_at = NOW()`,

  upsertFedTransfer: `
    INSERT INTO fiscal_federal_transfers
      (year, province, transfer_type, amount)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (year, transfer_type) DO UPDATE SET
      amount       = EXCLUDED.amount,
      collected_at = NOW()`,

  upsertFedContract: `
    INSERT INTO fiscal_federal_contracts
      (vendor, department, description, contract_date, value, province)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (vendor, department, contract_date, value) DO UPDATE SET
      description  = EXCLUDED.description,
      collected_at = NOW()`,

  logEntry: `
    INSERT INTO snapshot_log (taken_at, source, records_inserted, status, error)
    VALUES (NOW(), $1, $2, $3, $4)`,
} as const;

// ---------------------------------------------------------------------------
// Collector
// ---------------------------------------------------------------------------

/**
 * Fetch and persist all fiscal feeds for one run.
 *
 * Sub-fetch limits are intentionally modest: the large CKAN CSVs can be
 * 50–200k rows.  Caching a few hundred rows per run keeps each Resonate
 * step well under the 60s TTL window; prior runs accumulate the history.
 *
 * Returns the total number of rows upserted across all three feeds.
 * Writes a single snapshot_log row with source "fiscal" on success or
 * error.
 */
export async function collectFiscal(_today: string): Promise<number> {
  const pool = await getDb();
  let totalRows = 0;
  const errors: string[] = [];

  // --- Alberta grants ---
  try {
    const grants = await fetchAlbertaGrants();
    if (grants.length > 0) {
      const batch = grants.slice(0, 500);
      await withTransaction(async (client: pg.PoolClient) => {
        for (const g of batch) {
          if (!g.fiscalYear) continue;
          await client.query(SQL.upsertAbGrant, [
            g.fiscalYear,
            g.ministry,
            g.recipient,
            g.program,
            g.amount,
            g.description,
          ]);
        }
      });
      totalRows += batch.length;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[fiscal] Alberta grants fetch failed:", msg);
    errors.push(`grants: ${msg}`);
  }

  // --- Federal transfers ---
  try {
    const transfers = await fetchFederalTransfers();
    if (transfers.length > 0) {
      await withTransaction(async (client: pg.PoolClient) => {
        for (const t of transfers) {
          if (!t.year || !t.transferType) continue;
          await client.query(SQL.upsertFedTransfer, [
            t.year,
            t.province || "Alberta",
            t.transferType,
            t.amount,
          ]);
        }
      });
      totalRows += transfers.length;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[fiscal] Federal transfers fetch failed:", msg);
    errors.push(`transfers: ${msg}`);
  }

  // --- Federal contracts ---
  try {
    const contracts = await fetchFederalContractsAB(300);
    if (contracts.length > 0) {
      await withTransaction(async (client: pg.PoolClient) => {
        for (const c of contracts) {
          await client.query(SQL.upsertFedContract, [
            c.vendor,
            c.department,
            c.description,
            c.contractDate,
            c.value,
            c.province || "Alberta",
          ]);
        }
      });
      totalRows += contracts.length;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[fiscal] Federal contracts fetch failed:", msg);
    errors.push(`contracts: ${msg}`);
  }

  const hasErrors = errors.length > 0;
  await pool
    .query(SQL.logEntry, [
      "fiscal",
      totalRows,
      hasErrors ? "error" : "ok",
      hasErrors ? errors.join("; ") : null,
    ])
    .catch(() => {});

  return totalRows;
}

// ---------------------------------------------------------------------------
// Read helpers (used by MCP tool — no live fetch)
// ---------------------------------------------------------------------------

export interface GrantRow {
  fiscalYear: string;
  ministry: string;
  recipient: string;
  program: string;
  amount: number;
  description: string;
}

export interface TransferRow {
  year: number;
  province: string;
  transferType: string;
  amount: number;
}

export interface ContractRow {
  vendor: string;
  department: string;
  description: string;
  contractDate: string;
  value: number;
  province: string;
}

/**
 * Read stored Alberta grant rows, optionally filtered to a fiscal year.
 * Returns rows ordered by amount descending.
 */
export async function readGrants(options?: {
  fiscalYear?: string;
  limit?: number;
}): Promise<GrantRow[]> {
  const pool = await getDb();
  const limit = options?.limit ?? 200;

  if (options?.fiscalYear) {
    const { rows } = await pool.query<{
      fiscal_year: string;
      ministry: string;
      recipient: string;
      program: string;
      amount: number;
      description: string;
    }>(
      `SELECT fiscal_year, ministry, recipient, program, amount, description
         FROM fiscal_ab_grants
        WHERE fiscal_year = $1
        ORDER BY amount DESC
        LIMIT $2`,
      [options.fiscalYear, limit],
    );
    return rows.map((r) => ({
      fiscalYear: r.fiscal_year,
      ministry: r.ministry,
      recipient: r.recipient,
      program: r.program,
      amount: Number(r.amount),
      description: r.description,
    }));
  }

  const { rows } = await pool.query<{
    fiscal_year: string;
    ministry: string;
    recipient: string;
    program: string;
    amount: number;
    description: string;
  }>(
    `SELECT fiscal_year, ministry, recipient, program, amount, description
       FROM fiscal_ab_grants
      ORDER BY amount DESC
      LIMIT $1`,
    [limit],
  );
  return rows.map((r) => ({
    fiscalYear: r.fiscal_year,
    ministry: r.ministry,
    recipient: r.recipient,
    program: r.program,
    amount: Number(r.amount),
    description: r.description,
  }));
}

/**
 * Read stored federal transfers to Alberta.
 * Returns rows ordered by year descending, then amount descending.
 */
export async function readTransfers(options?: {
  year?: number;
}): Promise<TransferRow[]> {
  const pool = await getDb();

  if (options?.year) {
    const { rows } = await pool.query<{
      year: number;
      province: string;
      transfer_type: string;
      amount: number;
    }>(
      `SELECT year, province, transfer_type, amount
         FROM fiscal_federal_transfers
        WHERE year = $1
        ORDER BY amount DESC`,
      [options.year],
    );
    return rows.map((r) => ({
      year: Number(r.year),
      province: r.province,
      transferType: r.transfer_type,
      amount: Number(r.amount),
    }));
  }

  const { rows } = await pool.query<{
    year: number;
    province: string;
    transfer_type: string;
    amount: number;
  }>(
    `SELECT year, province, transfer_type, amount
       FROM fiscal_federal_transfers
      ORDER BY year DESC, amount DESC`,
  );
  return rows.map((r) => ({
    year: Number(r.year),
    province: r.province,
    transferType: r.transfer_type,
    amount: Number(r.amount),
  }));
}

/**
 * Read stored federal contract rows in Alberta.
 * Returns rows ordered by contract_date descending.
 */
export async function readContracts(options?: {
  limit?: number;
}): Promise<ContractRow[]> {
  const pool = await getDb();
  const limit = options?.limit ?? 200;

  const { rows } = await pool.query<{
    vendor: string;
    department: string;
    description: string;
    contract_date: string;
    value: number;
    province: string;
  }>(
    `SELECT vendor, department, description, contract_date, value, province
       FROM fiscal_federal_contracts
      ORDER BY contract_date DESC, value DESC
      LIMIT $1`,
    [limit],
  );
  return rows.map((r) => ({
    vendor: r.vendor,
    department: r.department,
    description: r.description,
    contractDate: r.contract_date,
    value: Number(r.value),
    province: r.province,
  }));
}

// Re-export source types for convenience (MCP tool uses GrantRecord etc.)
export type { GrantRecord, FederalTransfer, FederalContract };
