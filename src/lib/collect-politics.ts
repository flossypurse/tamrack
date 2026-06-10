/**
 * Politics vertical — collector and read functions.
 *
 * Persists Alberta MLAs, Alberta federal MPs, Alberta electoral districts,
 * and recent federal parliament votes to Postgres tables created by the
 * boot DDL in db.ts.
 *
 * Sources (all open-data, no authentication required):
 *   - Represent API (open.north.ca) — MLAs, MPs, electoral districts
 *   - OpenParliament API — parliament votes
 *
 * collectPolitics() is called by the daily collector and by the Resonate
 * worker. Each sub-fetch is wrapped in try/catch so one upstream failure
 * doesn't block the others. A snapshot_log row is written on both success
 * and error (source "politics").
 *
 * Read functions are consumed by the tamrack_politics MCP tool and serve
 * data purely from Postgres — no live upstream fetches at read time.
 */

import { getDb, withTransaction } from "./db";
import type pg from "pg";

import {
  fetchAlbertaMLAs,
  fetchAlbertaFederalMPs,
  fetchAlbertaElectoralDistricts,
  fetchParliamentVotes,
} from "./data-sources-politics";

// ---------------------------------------------------------------------------
// SQL helpers
// ---------------------------------------------------------------------------

const SQL = {
  upsertMLA: `
    INSERT INTO politics_mlas (name, party, district, email, url, photo_url, office)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (name, district) DO UPDATE SET
      party        = EXCLUDED.party,
      email        = EXCLUDED.email,
      url          = EXCLUDED.url,
      photo_url    = EXCLUDED.photo_url,
      office       = EXCLUDED.office,
      collected_at = NOW()`,

  upsertMP: `
    INSERT INTO politics_mps (name, party, riding, province, email, url, photo_url)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (name, riding) DO UPDATE SET
      party        = EXCLUDED.party,
      province     = EXCLUDED.province,
      email        = EXCLUDED.email,
      url          = EXCLUDED.url,
      photo_url    = EXCLUDED.photo_url,
      collected_at = NOW()`,

  upsertDistrict: `
    INSERT INTO politics_electoral_districts (name, external_id, boundary_url)
    VALUES ($1, $2, $3)
    ON CONFLICT (external_id) DO UPDATE SET
      name         = EXCLUDED.name,
      boundary_url = EXCLUDED.boundary_url,
      collected_at = NOW()`,

  upsertVote: `
    INSERT INTO politics_votes (vote_url, session, number, vote_date, yea, nay, paired, result, bill_url, description)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (session, number) DO UPDATE SET
      vote_url     = EXCLUDED.vote_url,
      vote_date    = EXCLUDED.vote_date,
      yea          = EXCLUDED.yea,
      nay          = EXCLUDED.nay,
      paired       = EXCLUDED.paired,
      result       = EXCLUDED.result,
      bill_url     = EXCLUDED.bill_url,
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
 * Fetch politics data from upstream and persist to Postgres.
 *
 * Caps parliament votes at 50 to stay well under the Resonate step TTL.
 * Returns the total number of rows upserted across all sub-fetches.
 * Writes a snapshot_log row (source "politics") on success AND error.
 */
export async function collectPolitics(_today: string): Promise<number> {
  const pool = await getDb();
  let totalRows = 0;
  const errors: string[] = [];

  // --- Alberta MLAs ---
  try {
    const mlas = await fetchAlbertaMLAs();
    if (mlas.length > 0) {
      await withTransaction(async (client: pg.PoolClient) => {
        for (const m of mlas) {
          await client.query(SQL.upsertMLA, [
            m.name, m.party, m.district, m.email, m.url, m.photoUrl, m.office,
          ]);
        }
      });
      totalRows += mlas.length;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[politics] MLA fetch/upsert failed:", msg);
    errors.push(`mlas: ${msg}`);
  }

  // --- Alberta federal MPs ---
  try {
    const mps = await fetchAlbertaFederalMPs();
    if (mps.length > 0) {
      await withTransaction(async (client: pg.PoolClient) => {
        for (const m of mps) {
          await client.query(SQL.upsertMP, [
            m.name, m.party, m.riding, m.province, m.email, m.url, m.photoUrl,
          ]);
        }
      });
      totalRows += mps.length;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[politics] MP fetch/upsert failed:", msg);
    errors.push(`mps: ${msg}`);
  }

  // --- Alberta electoral districts ---
  try {
    const districts = await fetchAlbertaElectoralDistricts();
    if (districts.length > 0) {
      await withTransaction(async (client: pg.PoolClient) => {
        for (const d of districts) {
          if (!d.id) continue;
          await client.query(SQL.upsertDistrict, [d.name, d.id, d.boundaryUrl]);
        }
      });
      totalRows += districts.length;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[politics] Electoral districts fetch/upsert failed:", msg);
    errors.push(`districts: ${msg}`);
  }

  // --- Parliament votes (cap at 50 to stay under step TTL) ---
  try {
    const votes = await fetchParliamentVotes(50);
    if (votes.length > 0) {
      await withTransaction(async (client: pg.PoolClient) => {
        for (const v of votes) {
          if (!v.session || v.number == null) continue;
          await client.query(SQL.upsertVote, [
            v.url, v.session, v.number, v.date,
            v.yea, v.nay, v.paired, v.result, v.billUrl, v.description,
          ]);
        }
      });
      totalRows += votes.length;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[politics] Votes fetch/upsert failed:", msg);
    errors.push(`votes: ${msg}`);
  }

  // --- snapshot_log ---
  if (errors.length > 0) {
    await pool
      .query(SQL.logEntry, ["politics", totalRows, "error", errors.join("; ")])
      .catch(() => {});
  } else {
    await pool
      .query(SQL.logEntry, ["politics", totalRows, "ok", null])
      .catch(() => {});
  }

  return totalRows;
}

// ---------------------------------------------------------------------------
// Read functions (MCP tool layer)
// ---------------------------------------------------------------------------

export interface MlaRow {
  name: string;
  party: string;
  district: string;
  email: string;
  url: string;
}

export interface MpRow {
  name: string;
  party: string;
  riding: string;
  province: string;
  email: string;
  url: string;
}

export interface DistrictRow {
  name: string;
  external_id: string;
  boundary_url: string;
}

export interface VoteRow {
  session: string;
  number: number;
  vote_date: string;
  yea: number;
  nay: number;
  paired: number;
  result: string;
  bill_url: string;
  description: string;
}

/**
 * Read stored Alberta MLAs from Postgres.
 * Returns an empty array when the table has never been populated.
 */
export async function readMLAs(): Promise<MlaRow[]> {
  const pool = await getDb();
  const res = await pool.query<{
    name: string;
    party: string;
    district: string;
    email: string;
    url: string;
  }>(
    `SELECT name, party, district, email, url
       FROM politics_mlas
      ORDER BY district, name`,
  );
  return res.rows;
}

/**
 * Read stored Alberta federal MPs from Postgres.
 * Returns an empty array when the table has never been populated.
 */
export async function readMPs(): Promise<MpRow[]> {
  const pool = await getDb();
  const res = await pool.query<{
    name: string;
    party: string;
    riding: string;
    province: string;
    email: string;
    url: string;
  }>(
    `SELECT name, party, riding, province, email, url
       FROM politics_mps
      ORDER BY riding, name`,
  );
  return res.rows;
}

/**
 * Read stored Alberta electoral districts from Postgres.
 * Returns an empty array when the table has never been populated.
 */
export async function readElectoralDistricts(): Promise<DistrictRow[]> {
  const pool = await getDb();
  const res = await pool.query<{
    name: string;
    external_id: string;
    boundary_url: string;
  }>(
    `SELECT name, external_id, boundary_url
       FROM politics_electoral_districts
      ORDER BY name`,
  );
  return res.rows;
}

/**
 * Read recent parliament votes from Postgres.
 * @param limit  Maximum rows to return (default 25, max 100).
 */
export async function readVotes(limit = 25): Promise<VoteRow[]> {
  const pool = await getDb();
  const cap = Math.min(Math.max(1, limit), 100);
  const res = await pool.query<{
    session: string;
    number: number;
    vote_date: string;
    yea: number;
    nay: number;
    paired: number;
    result: string;
    bill_url: string;
    description: string;
  }>(
    `SELECT session, number, vote_date, yea, nay, paired, result, bill_url, description
       FROM politics_votes
      ORDER BY vote_date DESC, number DESC
      LIMIT $1`,
    [cap],
  );
  return res.rows.map((r) => ({
    session: r.session,
    number: Number(r.number),
    vote_date: r.vote_date,
    yea: Number(r.yea),
    nay: Number(r.nay),
    paired: Number(r.paired),
    result: r.result,
    bill_url: r.bill_url,
    description: r.description,
  }));
}
