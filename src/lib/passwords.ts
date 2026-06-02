/**
 * Password hashing and verification using argon2id.
 *
 * Uses @node-rs/argon2 (Rust-backed, no native compile step, fast on small VMs).
 *
 * Strength rules (enforced at the application layer before hashing):
 *   - Minimum 12 characters
 *   - Maximum 256 characters (DoS guard — argon2 has no built-in cap)
 *   - Must include characters from at least 3 of:
 *       lowercase letters, uppercase letters, digits, symbols
 */
import { hash, verify } from "@node-rs/argon2";

/** Argon2id parameters. These are conservative defaults suitable for a low-traffic
 *  server. memoryCost is in KiB. */
const ARGON2_OPTIONS = {
  algorithm: 2, // argon2id
  memoryCost: 65536, // 64 MiB
  timeCost: 3,
  parallelism: 1,
} as const;

export async function hashPassword(plaintext: string): Promise<string> {
  return hash(plaintext, ARGON2_OPTIONS);
}

export async function verifyPassword(
  plaintext: string,
  storedHash: string,
): Promise<boolean> {
  try {
    return await verify(storedHash, plaintext, ARGON2_OPTIONS);
  } catch {
    // Malformed hash or algorithm mismatch — treat as wrong password.
    return false;
  }
}

export type PasswordStrengthResult =
  | { ok: true; reason?: undefined }
  | { ok: false; reason: string };

/**
 * Validates password strength per the rules above. Returns `{ ok: true }` on
 * success, or `{ ok: false, reason }` describing the first violated rule.
 */
export function validatePasswordStrength(
  plaintext: string,
): PasswordStrengthResult {
  if (plaintext.length < 12) {
    return { ok: false, reason: "Password must be at least 12 characters." };
  }
  if (plaintext.length > 256) {
    return { ok: false, reason: "Password must be 256 characters or fewer." };
  }

  const hasLower = /[a-z]/.test(plaintext);
  const hasUpper = /[A-Z]/.test(plaintext);
  const hasDigit = /[0-9]/.test(plaintext);
  const hasSymbol = /[^a-zA-Z0-9]/.test(plaintext);

  const categories = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean)
    .length;
  if (categories < 3) {
    return {
      ok: false,
      reason:
        "Password must include characters from at least 3 of: lowercase letters, uppercase letters, digits, symbols.",
    };
  }

  return { ok: true };
}
