/**
 * Email-based invite tokens for the username/password auth system.
 *
 * Flow: admin enters invitee email → this module creates an invite row and
 * returns a tokenized signup link → `transactional-email.ts` sends it →
 * recipient clicks `/signup?token=<tinv_*>` → sets username + password.
 *
 * Token format: tinv_<64 hex chars> (reuses the existing tinv_* generator
 * and invites table schema; token_hash stores sha256 of the plaintext).
 *
 * Idempotency: the atomic UPDATE on (redeemed_at IS NULL AND expires_at > NOW())
 * prevents double-redeem races.
 */
import { randomUUID, randomBytes, createHash } from "crypto";
import { getDb } from "./db";

export const INVITE_PREFIX = "tinv_" as const;

/** Days before an unredeemed invite expires. */
const INVITE_TTL_DAYS = 30;

function generateInviteToken(): { token: string; hash: string } {
  const raw = randomBytes(32).toString("hex");
  const token = `${INVITE_PREFIX}${raw}` as const;
  const hash = createHash("sha256").update(token).digest("hex");
  return { token, hash };
}

export interface CreateEmailInviteInput {
  createdByUserId: string;
  /** Email address the invite will be sent to. */
  recipientEmail: string;
}

export interface CreatedEmailInvite {
  id: string;
  /** Plaintext token — shown once, used as the signup link query param. */
  token: string;
  /** Full signup URL: `${appUrl}/signup?token=${token}` */
  signupUrl: string;
  expiresAt: string;
}

/**
 * Creates a new invite row and returns the plaintext token (NOT retrievable
 * later — the hash is what's stored).
 *
 * Note: the /signup route is not yet built and lands in a later iteration — the signupUrl returned here is scaffolding.
 *
 * @param input    Who is creating the invite and the recipient email.
 * @param appUrl   Runtime APP_URL (e.g. "https://tamrack.ca"). No trailing slash.
 */
export async function createEmailInvite(
  input: CreateEmailInviteInput,
  appUrl: string,
): Promise<CreatedEmailInvite> {
  const pool = await getDb();
  const id = randomUUID();
  const { token, hash } = generateInviteToken();
  const expiresAt = new Date(
    Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  await pool.query(
    `INSERT INTO invites (id, token_hash, created_by, email_hint, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, hash, input.createdByUserId, input.recipientEmail, expiresAt],
  );

  const base = appUrl.replace(/\/$/, "");
  const signupUrl = `${base}/signup?token=${token}`;
  return { id, token, signupUrl, expiresAt };
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
 * Looks up an invite by plaintext token. Returns null if the token is
 * unknown, already redeemed, or expired.
 */
export async function lookupEmailInvite(
  token: string,
): Promise<InviteRow | null> {
  if (!token.startsWith(INVITE_PREFIX)) return null;
  const pool = await getDb();
  const hash = createHash("sha256").update(token).digest("hex");
  const { rows } = await pool.query<InviteRow>(
    `SELECT id, created_by, email_hint, redeemed_at, redeemed_by_user_id,
            expires_at, created_at
       FROM invites
      WHERE token_hash = $1`,
    [hash],
  );
  const row = rows[0];
  if (!row) return null;
  if (row.redeemed_at) return null;
  if (new Date(row.expires_at) < new Date()) return null;
  return row;
}

/**
 * Atomically marks an invite redeemed. Returns true on first success, false
 * if the token was already consumed or has expired.
 *
 * The caller is responsible for passing a userId that already exists in the
 * users table (insert the user row before calling this, or use a deferred FK
 * within the same transaction).
 */
export async function redeemEmailInvite(
  token: string,
  userId: string,
): Promise<boolean> {
  if (!token.startsWith(INVITE_PREFIX)) return false;
  const pool = await getDb();
  const hash = createHash("sha256").update(token).digest("hex");
  const result = await pool.query(
    `UPDATE invites
        SET redeemed_at          = NOW(),
            redeemed_by_user_id  = $2
      WHERE token_hash            = $1
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

export async function listEmailInvites(): Promise<InviteListEntry[]> {
  const pool = await getDb();
  const { rows } = await pool.query<Omit<InviteListEntry, "status">>(
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
