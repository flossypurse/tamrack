/**
 * Username validation, normalization, and availability checks.
 *
 * Rules:
 *   - 3–32 characters
 *   - Lowercase ASCII letters, digits, underscore, hyphen only
 *   - Must start with a letter
 *   - Rejected if on the reserved list (impersonation/confusion guard)
 */
import { getDb } from "./db";

/** Usernames that cannot be registered regardless of case. */
export const RESERVED_USERNAMES = new Set([
  "admin",
  "root",
  "support",
  "tamrack",
  "system",
  "null",
  "undefined",
  "me",
  "you",
]);

const USERNAME_RE = /^[a-z][a-z0-9_-]{2,31}$/;

/** Lowercases and trims the raw input. Does NOT validate shape. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export type UsernameValidationResult =
  | { ok: true; reason?: undefined }
  | { ok: false; reason: string };

/**
 * Validates username shape and reserved-list. Returns `{ ok: true }` or
 * `{ ok: false, reason }`.
 *
 * Expects the normalized (lowercased) form as input.
 */
export function validateUsernameShape(
  normalized: string,
): UsernameValidationResult {
  if (!normalized) {
    return { ok: false, reason: "Username is required." };
  }
  if (normalized.length < 3) {
    return { ok: false, reason: "Username must be at least 3 characters." };
  }
  if (normalized.length > 32) {
    return { ok: false, reason: "Username must be 32 characters or fewer." };
  }
  if (!USERNAME_RE.test(normalized)) {
    return {
      ok: false,
      reason:
        "Username may only contain letters, digits, hyphens, and underscores, and must start with a letter.",
    };
  }
  if (RESERVED_USERNAMES.has(normalized)) {
    return { ok: false, reason: "That username is reserved." };
  }
  return { ok: true };
}

/**
 * Returns true when the username is available in the database.
 * Expects the normalized (lowercased) form.
 */
export async function isUsernameAvailable(
  normalized: string,
): Promise<boolean> {
  const pool = await getDb();
  const { rows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM users WHERE username_lower = $1`,
    [normalized],
  );
  return parseInt(rows[0]?.count ?? "0", 10) === 0;
}
