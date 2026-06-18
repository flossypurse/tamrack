/**
 * Early-access invite tokens.
 *
 * Charter: self-signup is OFF. Cully issues invite tokens 1:1; each token
 * redeems for exactly one user account + a fresh `tk_*` API key, then is
 * marked redeemed and never accepted again.
 *
 * Storage model:
 *   - `invites` table holds a sha256 hash of the token (never the plaintext)
 *   - Plaintext is shown ONCE at creation time, surfaced through the admin
 *     UI as the invite URL. After that it lives only in whoever's mailbox /
 *     iMessage the operator pasted it into.
 *   - `redeemed_at` is set atomically (UPDATE ... WHERE redeemed_at IS NULL)
 *     to prevent races where a token is consumed twice.
 *   - 30-day expiry from creation; expired tokens are rejected even if
 *     unredeemed.
 *
 * Flip switch:
 *   EARLY_ACCESS=true (default) — invite wall on, self-signup blocked.
 *   EARLY_ACCESS=false           — public launch, anyone can sign up.
 * Read by middleware + by the signup gate page.
 */
import { randomUUID, randomBytes, createHash } from "crypto";
import { getDb } from "./db";

// The one-shot key/token cookie constants moved to ./key-cookies so the
// key/token UI can depend on them without coupling to the invite system.

/** Days before an unredeemed invite expires. */
const INVITE_TTL_DAYS = 30;

/** Token prefix — separate namespace from API keys to avoid confusion. */
export const INVITE_PREFIX = "tinv_" as const;

export function isEarlyAccessOn(): boolean {
  // Default ON. Only the literal string "false" turns it off.
  return (process.env.EARLY_ACCESS ?? "true").toLowerCase() !== "false";
}

/**
 * Generate a fresh invite token. Returns the plaintext (one-time-visible)
 * and the corresponding row id. Callers persist via `createInvite()`.
 */
function generateInviteToken(): { token: string; hash: string } {
  // 32 bytes = 64 hex chars, ~256 bits entropy. Same envelope as api-keys.ts.
  const raw = randomBytes(32).toString("hex");
  const token = `${INVITE_PREFIX}${raw}`;
  const hash = createHash("sha256").update(token).digest("hex");
  return { token, hash };
}

export interface CreateInviteInput {
  createdByUserId: string;
  /** Optional human hint — the email Cully intends to send this to. */
  emailHint?: string;
}

export interface CreatedInvite {
  id: string;
  token: string;
  /** Full redemption URL — what the operator pastes to the invitee. */
  url: string;
  expiresAt: string;
}

/**
 * Create + persist a new invite. Returns the plaintext token; it is NOT
 * retrievable later — the hash is what's stored.
 */
export async function createInvite(
  input: CreateInviteInput,
  origin: string,
): Promise<CreatedInvite> {
  const pool = await getDb();
  const id = randomUUID();
  const { token, hash } = generateInviteToken();
  const expiresAt = new Date(
    Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  await pool.query(
    `INSERT INTO invites (id, token_hash, created_by, email_hint, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, hash, input.createdByUserId, input.emailHint ?? null, expiresAt],
  );

  const url = `${origin.replace(/\/$/, "")}/invite/${token}`;
  return { id, token, url, expiresAt };
}

export interface InviteRow {
  id: string;
  created_by: string;
  email_hint: string | null;
  redeemed_at: string | null;
  redeemed_by_user_id: string | null;
  expires_at: string;
  created_at: string;
}

/**
 * Look up an invite by plaintext token (hashes it first). Returns null if
 * unknown / expired / already redeemed.
 */
export async function lookupInvite(token: string): Promise<InviteRow | null> {
  if (!token.startsWith(INVITE_PREFIX)) return null;
  const pool = await getDb();
  const hash = createHash("sha256").update(token).digest("hex");
  const { rows } = await pool.query(
    `SELECT id, created_by, email_hint, redeemed_at, redeemed_by_user_id,
            expires_at, created_at
       FROM invites
      WHERE token_hash = $1`,
    [hash],
  );
  const row = rows[0] as InviteRow | undefined;
  if (!row) return null;
  if (row.redeemed_at) return null;
  if (new Date(row.expires_at) < new Date()) return null;
  return row;
}

/**
 * Atomically mark an invite redeemed. Uses a conditional UPDATE so a
 * concurrent redemption attempt fails cleanly (rowCount === 0). Returns
 * true on first success, false if the token was already consumed.
 */
export async function redeemInvite(
  token: string,
  userId: string,
): Promise<boolean> {
  if (!token.startsWith(INVITE_PREFIX)) return false;
  const pool = await getDb();
  const hash = createHash("sha256").update(token).digest("hex");
  const result = await pool.query(
    `UPDATE invites
        SET redeemed_at = NOW(),
            redeemed_by_user_id = $2
      WHERE token_hash = $1
        AND redeemed_at IS NULL
        AND expires_at > NOW()`,
    [hash, userId],
  );
  return (result.rowCount ?? 0) > 0;
}

export interface InviteListEntry {
  id: string;
  email_hint: string | null;
  redeemed_at: string | null;
  redeemed_by_user_id: string | null;
  expires_at: string;
  created_at: string;
  status: "pending" | "redeemed" | "expired";
}

export async function listInvites(): Promise<InviteListEntry[]> {
  const pool = await getDb();
  const { rows } = await pool.query<{
    id: string;
    email_hint: string | null;
    redeemed_at: string | null;
    redeemed_by_user_id: string | null;
    expires_at: string;
    created_at: string;
  }>(
    `SELECT id, email_hint, redeemed_at, redeemed_by_user_id,
            expires_at, created_at
       FROM invites
      ORDER BY created_at DESC
      LIMIT 200`,
  );
  const now = Date.now();
  return rows.map((r) => {
    let status: InviteListEntry["status"];
    if (r.redeemed_at) status = "redeemed";
    else if (new Date(r.expires_at).getTime() < now) status = "expired";
    else status = "pending";
    return { ...r, status };
  });
}
