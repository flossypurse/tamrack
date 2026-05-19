/**
 * Tamrack access check — session-side.
 *
 * Middleware can't reach Postgres (Edge runtime), so the "is this user
 * actually allowed in?" check lives in the page/route handler. Returns
 * true for invitees (users.early_access = TRUE) and paid Tamrack users
 * (users.plan in 'founder'/'tamrack'). Returns false for everyone else,
 * including grandfathered EDO/Realtor customers (they are intentionally
 * sent to /sunset rather than into the Tamrack surfaces).
 */
import { getDb } from "./db";

export type TamrackAccessReason = "early_access" | "plan" | "none";

export interface TamrackAccess {
  authorized: boolean;
  reason: TamrackAccessReason;
}

export async function userHasTamrackAccess(
  userId: string,
): Promise<TamrackAccess> {
  const pool = await getDb();
  const { rows } = await pool.query<{
    early_access: boolean | null;
    plan: string | null;
  }>(
    `SELECT early_access, plan FROM users WHERE id = $1`,
    [userId],
  );
  const row = rows[0];
  if (!row) return { authorized: false, reason: "none" };
  if (row.early_access === true) {
    return { authorized: true, reason: "early_access" };
  }
  if (row.plan === "founder" || row.plan === "tamrack") {
    return { authorized: true, reason: "plan" };
  }
  return { authorized: false, reason: "none" };
}
