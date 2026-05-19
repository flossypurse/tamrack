/**
 * Access-request DAO.
 *
 * Charter: tamrack/handoffs/2026-05-19-access-request-resonate-charter.md
 *   - §5 schema (table created in MIGRATION_SQL in db.ts)
 *   - §6 integration points — these are the functions the Resonate workflow
 *     (iter 3) calls via ctx.run, and the API route (iter 4) calls inline
 *     for the rate-limit check.
 *
 * Iter 1 scope: pure data layer. No Resonate import here; the workflow
 * wires these in iter 3. No Mailgun here; iter 2 owns that.
 *
 * Email handling: every function that takes an email lower-cases + trims
 * it before querying. The UNIQUE constraint is on email_lower, so all
 * reads/writes have to go through the same normalization.
 */
import { randomUUID } from "crypto";
import { getDb } from "./db";

// ============================================================
// Types
// ============================================================

export type AccessRequestStatus =
  | "pending"
  | "approved"
  | "denied"
  | "expired"
  | "existing_user";

export interface AccessRequestRow {
  id: string;
  email_lower: string;
  name: string;
  intent: string | null;
  source_ip: string | null;
  status: AccessRequestStatus;
  invite_id: string | null;
  existing_user_id: string | null;
  decided_by: string | null;
  decided_at: string | null;
  resonate_workflow_id: string | null;
  admin_mail_message_id: string | null;
  invite_mail_message_id: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Helpers
// ============================================================

/**
 * Lower-case + trim. The single normalization path so the DB UNIQUE
 * constraint, the workflow ID hash, and every read agree.
 */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Defensive (NOT lib-based) email regex. The API route is the primary
 * validation point; this is depth-of-defense for the DAO so a bad row
 * never lands in `access_requests`.
 *
 * Charter §1 says RFC-5322-ish; this is the same loose shape the auth
 * layer uses elsewhere — local-part + @ + domain with a TLD.
 */
function isPlausibleEmail(email: string): boolean {
  if (email.length === 0 || email.length > 320) return false;
  // No spaces, exactly one @, something on both sides, dot in the domain.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ============================================================
// DAO functions (charter §6)
// ============================================================

export interface UpsertAccessRequestInput {
  name: string;
  email: string;
  intent?: string;
  sourceIp?: string;
}

/**
 * Upsert an access request keyed by lower-cased email.
 *
 * - New row: inserted with status='pending' and a fresh UUID.
 * - Existing row: name/intent/source_ip refreshed; status untouched
 *   (charter §2 step 2: "Sets status='pending' for new rows, leaves
 *   existing status untouched").
 *
 * Returns the canonical row in either case. The workflow uses this as
 * the row-level idempotency anchor (the Resonate workflow ID is the
 * sha256(email_lower) which agrees with the UNIQUE constraint).
 */
export async function upsertAccessRequest(
  v: UpsertAccessRequestInput,
): Promise<AccessRequestRow> {
  const email_lower = normalizeEmail(v.email);
  if (!isPlausibleEmail(email_lower)) {
    throw new Error(`upsertAccessRequest: invalid email shape`);
  }
  const name = v.name.trim();
  if (name.length === 0) {
    throw new Error(`upsertAccessRequest: name required`);
  }
  const intent = v.intent?.trim() || null;
  const sourceIp = v.sourceIp?.trim() || null;

  const id = randomUUID();
  const pool = await getDb();

  const { rows } = await pool.query<AccessRequestRow>(
    `INSERT INTO access_requests (id, email_lower, name, intent, source_ip, status)
     VALUES ($1, $2, $3, $4, $5, 'pending')
     ON CONFLICT (email_lower) DO UPDATE
       SET name = EXCLUDED.name,
           intent = EXCLUDED.intent,
           source_ip = COALESCE(EXCLUDED.source_ip, access_requests.source_ip),
           updated_at = NOW()
     RETURNING id, email_lower, name, intent, source_ip, status,
               invite_id, existing_user_id, decided_by, decided_at,
               resonate_workflow_id, admin_mail_message_id,
               invite_mail_message_id, created_at, updated_at`,
    [id, email_lower, name, intent, sourceIp],
  );

  const row = rows[0];
  if (!row) {
    // Should be impossible — INSERT ... ON CONFLICT DO UPDATE always
    // returns a row. Guard anyway so the workflow gets a clean error.
    throw new Error(`upsertAccessRequest: no row returned`);
  }
  return row;
}

/**
 * Look up a user by email. Used by the workflow's check-existing-user
 * step (charter §2 step 3). Returns just the id — callers don't need
 * the whole user row and the workflow doesn't want to drag PII through
 * Resonate's durable promise serialization.
 */
export async function findUserByEmail(
  email: string,
): Promise<{ id: string } | null> {
  const normalized = normalizeEmail(email);
  const pool = await getDb();
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1`,
    [normalized],
  );
  return rows[0] ?? null;
}

/**
 * Approve: set status, decided_at, decided_by, invite_id.
 * Idempotent UPDATE — re-running with the same args is a no-op.
 */
export async function markApproved(
  id: string,
  actorUserId: string,
  inviteId: string,
): Promise<void> {
  const pool = await getDb();
  await pool.query(
    `UPDATE access_requests
        SET status = 'approved',
            decided_at = NOW(),
            decided_by = $2,
            invite_id = $3,
            updated_at = NOW()
      WHERE id = $1`,
    [id, actorUserId, inviteId],
  );
}

/**
 * Deny: set status, decided_at, decided_by. No invite minted, no
 * requester email (charter §2 step 8b).
 */
export async function markDenied(
  id: string,
  actorUserId: string,
): Promise<void> {
  const pool = await getDb();
  await pool.query(
    `UPDATE access_requests
        SET status = 'denied',
            decided_at = NOW(),
            decided_by = $2,
            updated_at = NOW()
      WHERE id = $1`,
    [id, actorUserId],
  );
}

/**
 * Expire: set status, decided_at. Triggered by the durable promise's
 * TTL firing (charter §2 step 8c). No decided_by — there's no actor.
 */
export async function markExpired(id: string): Promise<void> {
  const pool = await getDb();
  await pool.query(
    `UPDATE access_requests
        SET status = 'expired',
            decided_at = NOW(),
            updated_at = NOW()
      WHERE id = $1`,
    [id],
  );
}

/**
 * Existing-user short-circuit: charter §7 "Email already has an
 * account". Workflow short-circuits before any human-in-the-loop gate;
 * the FYI admin email still fires but no invite is minted and no
 * requester email is sent. status='existing_user' so the admin UI can
 * filter these out of the pending queue.
 */
export async function markExistingUser(
  id: string,
  existingUserId: string,
): Promise<void> {
  const pool = await getDb();
  await pool.query(
    `UPDATE access_requests
        SET status = 'existing_user',
            existing_user_id = $2,
            decided_at = NOW(),
            updated_at = NOW()
      WHERE id = $1`,
    [id, existingUserId],
  );
}

/**
 * IP rate-limit check. Charter §7: max 5 submissions per IP per 24h.
 *
 * - `sourceIp` null/empty → `{ allowed: true, count: 0 }`. Server-side
 *   IP extraction is best-effort; behind some proxies it may be absent.
 *   We don't penalize the requester for the infra failing to forward
 *   X-Forwarded-For; the API route still returns 202 either way.
 * - Otherwise counts rows for this IP in the last 24h. `allowed` is
 *   `count < 5` so the 5th submission slips through and the 6th is
 *   blocked (deliberate: counts requests already on disk).
 */
export async function checkIpRateLimit(
  sourceIp: string | null,
): Promise<{ allowed: boolean; count: number }> {
  if (!sourceIp || sourceIp.trim().length === 0) {
    return { allowed: true, count: 0 };
  }
  const pool = await getDb();
  const { rows } = await pool.query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt
       FROM access_requests
      WHERE source_ip = $1
        AND created_at > NOW() - INTERVAL '24 hours'`,
    [sourceIp],
  );
  const count = Number(rows[0]?.cnt ?? 0);
  return { allowed: count < 5, count };
}
