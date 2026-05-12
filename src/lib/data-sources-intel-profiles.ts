/**
 * Research profile substrate for `intel_operators`.
 *
 * Append-only writes: each new profile bumps the previous `current` row to
 * `current = FALSE` inside the same transaction. A partial unique index
 * guarantees exactly one current row per operator at any moment.
 *
 * Reads default to the current row; history reads return all rows ordered by
 * `researched_at DESC`.
 */
import { randomUUID } from "crypto";
import { getDb } from "./db";

export type ProfileResearcher = `agent-${string}` | `manual:${string}` | `crowdsource:${string}`;

export interface IntelOperatorProfile {
  id: string;
  operator_id: string;
  profile_schema: string;
  researcher: string;
  researched_at: string;
  current: boolean;
  raw_profile_md: string;
  structured: Record<string, unknown>;
  sources: Array<{ url: string; accessed_at?: string; kind?: string }>;
  data_gaps: string[];
  confidence: number;
  confidence_breakdown: Record<string, unknown>;
  cost_usd: number | null;
  tokens_in: number | null;
  tokens_out: number | null;
  duration_ms: number | null;
  created_at: string;
}

export interface ProfileWriteInput {
  profile_schema: string;
  researcher: string;
  raw_profile_md: string;
  structured: Record<string, unknown>;
  sources: Array<{ url: string; accessed_at?: string; kind?: string }>;
  data_gaps: string[];
  confidence: number;
  confidence_breakdown?: Record<string, unknown>;
  cost_usd?: number | null;
  tokens_in?: number | null;
  tokens_out?: number | null;
  duration_ms?: number | null;
}

const PROFILE_FIELDS = `
  id,
  operator_id,
  profile_schema,
  researcher,
  researched_at,
  current,
  raw_profile_md,
  structured,
  sources,
  data_gaps,
  confidence,
  confidence_breakdown,
  cost_usd,
  tokens_in,
  tokens_out,
  duration_ms,
  created_at
`;

export async function getCurrentProfile(operatorId: string): Promise<IntelOperatorProfile | null> {
  const pool = await getDb();
  const { rows } = await pool.query<IntelOperatorProfile>(
    `SELECT ${PROFILE_FIELDS}
       FROM intel_operator_profiles
      WHERE operator_id = $1 AND current = TRUE
      LIMIT 1`,
    [operatorId],
  );
  return rows[0] ?? null;
}

export async function getProfileHistory(operatorId: string): Promise<IntelOperatorProfile[]> {
  const pool = await getDb();
  const { rows } = await pool.query<IntelOperatorProfile>(
    `SELECT ${PROFILE_FIELDS}
       FROM intel_operator_profiles
      WHERE operator_id = $1
      ORDER BY researched_at DESC`,
    [operatorId],
  );
  return rows;
}

export interface ProfileWriteResult {
  profile_id: string;
  operator_id: string;
  researched_at: string;
  previous_profile_id: string | null;
}

export async function writeProfile(
  operatorId: string,
  payload: ProfileWriteInput,
): Promise<ProfileWriteResult> {
  if (payload.sources.length === 0) {
    throw new Error("writeProfile: at least one source is required");
  }
  if (!Number.isFinite(payload.confidence) || payload.confidence < 0 || payload.confidence > 1) {
    throw new Error(`writeProfile: confidence must be in [0,1], got ${payload.confidence}`);
  }
  if (payload.raw_profile_md.trim().length === 0) {
    throw new Error("writeProfile: raw_profile_md must be non-empty");
  }

  const pool = await getDb();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const operatorCheck = await client.query(
      `SELECT 1 FROM intel_operators WHERE id = $1`,
      [operatorId],
    );
    if (operatorCheck.rowCount === 0) {
      throw new Error(`writeProfile: operator ${operatorId} does not exist`);
    }

    const prev = await client.query<{ id: string }>(
      `UPDATE intel_operator_profiles
          SET current = FALSE
        WHERE operator_id = $1 AND current = TRUE
        RETURNING id`,
      [operatorId],
    );

    const newId = randomUUID();
    const insert = await client.query<{ researched_at: string }>(
      `INSERT INTO intel_operator_profiles (
         id, operator_id, profile_schema, researcher, current,
         raw_profile_md, structured, sources, data_gaps,
         confidence, confidence_breakdown,
         cost_usd, tokens_in, tokens_out, duration_ms
       ) VALUES (
         $1, $2, $3, $4, TRUE,
         $5, $6, $7, $8,
         $9, $10,
         $11, $12, $13, $14
       )
       RETURNING researched_at`,
      [
        newId,
        operatorId,
        payload.profile_schema,
        payload.researcher,
        payload.raw_profile_md,
        JSON.stringify(payload.structured ?? {}),
        JSON.stringify(payload.sources),
        payload.data_gaps,
        payload.confidence,
        JSON.stringify(payload.confidence_breakdown ?? {}),
        payload.cost_usd ?? null,
        payload.tokens_in ?? null,
        payload.tokens_out ?? null,
        payload.duration_ms ?? null,
      ],
    );

    // Best-effort: mark the research queue row done when a profile lands.
    // Skipped silently if no queue row exists (manual writes outside the
    // worker loop). The constraint check is satisfied because 'done' is in
    // chk_research_status.
    await client.query(
      `UPDATE intel_research_queue
          SET status = 'done', completed_at = NOW(), last_error = NULL
        WHERE operator_id = $1`,
      [operatorId],
    );

    await client.query("COMMIT");

    return {
      profile_id: newId,
      operator_id: operatorId,
      researched_at: insert.rows[0].researched_at,
      previous_profile_id: prev.rows[0]?.id ?? null,
    };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function countProfileHistory(operatorId: string): Promise<number> {
  const pool = await getDb();
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM intel_operator_profiles WHERE operator_id = $1`,
    [operatorId],
  );
  return parseInt(rows[0]?.count ?? "0", 10);
}
