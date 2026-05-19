import { randomUUID, randomBytes, createHash } from "crypto";
import { getDb } from "./db";

const DAILY_RATE_LIMIT = 1000;

/**
 * New Tamrack key prefix. Generated for every fresh key after rebrand.
 */
export const TAMRACK_KEY_PREFIX = "tk_" as const;

/**
 * Legacy Alberta Pulse key prefix. Existing `ap_*` keys remain valid for
 * 90 days post-cutover per the Tamrack charter. After the dual-accept
 * window ends, drop this prefix from {@link ACCEPTED_KEY_PREFIXES} and
 * the validator will start rejecting `ap_*` keys.
 *
 * Cutover date: set by the agent doing the migration job — record it in
 * the env or in TAMRACK-CHARTER.md and revisit before
 * {@link AP_PREFIX_SUNSET_AT}.
 */
export const LEGACY_AP_KEY_PREFIX = "ap_" as const;

/**
 * Sunset date for the `ap_*` prefix. Computed at +90d from the file's
 * last meaningful update (charter date 2026-05-14 → sunset 2026-08-12).
 * Update when the actual cutover date is locked.
 */
export const AP_PREFIX_SUNSET_AT = "2026-08-16" as const;

/**
 * Prefixes the validator accepts during the dual-accept window. Order
 * matters only for code that wants to iterate — semantically equivalent.
 */
const ACCEPTED_KEY_PREFIXES = [TAMRACK_KEY_PREFIX, LEGACY_AP_KEY_PREFIX] as const;

/**
 * Returns true if `value` starts with any of the accepted key prefixes.
 * Used by api-auth to gate Bearer token extraction.
 */
export function hasAcceptedKeyPrefix(value: string): boolean {
  return ACCEPTED_KEY_PREFIXES.some((p) => value.startsWith(p));
}

export function generateApiKey(): { key: string; id: string; prefix: string; hash: string } {
  const id = randomUUID();
  const raw = randomBytes(24).toString("hex");
  // New keys always get the Tamrack prefix. The `ap_*` prefix is read-only
  // (validated) but never minted any more.
  const key = `${TAMRACK_KEY_PREFIX}${raw}`;
  const prefix = key.slice(0, 10);
  const hash = createHash("sha256").update(key).digest("hex");
  return { key, id, prefix, hash };
}

export async function createApiKey(
  userId: string,
  name: string = "Default",
  scopes: string[] = [],
): Promise<{ key: string; id: string; prefix: string; scopes: string[] }> {
  const pool = await getDb();
  const { key, id, prefix, hash } = generateApiKey();
  await pool.query(
    `INSERT INTO api_keys (id, user_id, key_hash, key_prefix, name, scopes)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, userId, hash, prefix, name, scopes],
  );
  return { key, id, prefix, scopes };
}

export async function validateApiKey(
  key: string,
): Promise<{ userId: string; keyId: string; scopes: string[] } | null> {
  // Reject keys that don't carry any accepted prefix without hitting the db.
  if (!hasAcceptedKeyPrefix(key)) return null;

  const pool = await getDb();
  const hash = createHash("sha256").update(key).digest("hex");
  const { rows } = await pool.query(
    `SELECT id, user_id, scopes FROM api_keys WHERE key_hash = $1 AND revoked_at IS NULL`,
    [hash],
  );

  if (!rows[0]) return null;

  // Update last_used_at
  await pool.query(`UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`, [rows[0].id]);

  return {
    userId: rows[0].user_id,
    keyId: rows[0].id,
    scopes: (rows[0].scopes as string[] | null) ?? [],
  };
}

export async function revokeApiKey(keyId: string, userId: string): Promise<boolean> {
  const pool = await getDb();
  const result = await pool.query(
    `UPDATE api_keys SET revoked_at = NOW() WHERE id = $1 AND user_id = $2`,
    [keyId, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function getUserApiKeys(userId: string) {
  const pool = await getDb();
  const { rows } = await pool.query(
    `SELECT id, key_prefix, name, last_used_at, created_at, revoked_at FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return rows as { id: string; key_prefix: string; name: string; last_used_at: string | null; created_at: string; revoked_at: string | null }[];
}

export async function checkRateLimit(keyId: string): Promise<{ allowed: boolean; remaining: number }> {
  const pool = await getDb();
  const { rows } = await pool.query(
    `SELECT COUNT(*) as cnt FROM api_usage WHERE api_key_id = $1 AND timestamp > NOW() - INTERVAL '1 day'`,
    [keyId]
  );

  const remaining = Math.max(0, DAILY_RATE_LIMIT - Number(rows[0].cnt));
  return { allowed: remaining > 0, remaining };
}

export async function logApiUsage(
  keyId: string | null,
  userId: string | null,
  endpoint: string,
  status: number,
  costUnits: number = 1,
  countedTowardPlan: boolean = true,
) {
  const pool = await getDb();
  await pool.query(
    `INSERT INTO api_usage (api_key_id, user_id, endpoint, response_status, cost_units, counted_toward_plan)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [keyId, userId, endpoint, status, costUnits, countedTowardPlan],
  );
}

// ─── Plan + quota helpers ────────────────────────────────────────────

/**
 * Plan-tier metadata. Charter spec:
 *   - free:    0 units included
 *   - tamrack: 50,000 units / mo, then $0.0001/unit overage
 *   - founder: legacy / grandfathered — unlimited within reason, no metering
 */
export type PlanTier = "free" | "tamrack" | "founder";

export interface PlanLimits {
  included_units: number;
  /** Whether overage requests are allowed (vs blocked at quota). */
  overage_allowed: boolean;
  /** Whether overage should emit Stripe meter events. */
  meters_overage: boolean;
}

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: { included_units: 0, overage_allowed: false, meters_overage: false },
  tamrack: { included_units: 50_000, overage_allowed: true, meters_overage: true },
  founder: { included_units: Number.POSITIVE_INFINITY, overage_allowed: true, meters_overage: false },
};

export interface UserPlanState {
  plan: PlanTier;
  monthly_units_used: number;
  monthly_units_resets_at: string | null;
}

export async function getUserPlanState(userId: string): Promise<UserPlanState | null> {
  const pool = await getDb();
  const { rows } = await pool.query(
    `SELECT plan, monthly_units_used, monthly_units_resets_at FROM users WHERE id = $1`,
    [userId],
  );
  if (!rows[0]) return null;
  return {
    plan: (rows[0].plan ?? "free") as PlanTier,
    monthly_units_used: Number(rows[0].monthly_units_used ?? 0),
    monthly_units_resets_at: rows[0].monthly_units_resets_at ?? null,
  };
}

/**
 * Increment the user's monthly unit counter atomically. Returns the
 * new counter value and whether this increment overflowed the plan's
 * included quota (used by the meter emitter to decide whether to ping
 * Stripe).
 *
 * If `monthly_units_resets_at` is in the past, reset the counter to 0
 * before incrementing (per-call rollover keeps us out of needing a cron).
 */
export async function incrementUserUnits(
  userId: string,
  units: number,
): Promise<{ new_total: number; plan: PlanTier; overage_units: number }> {
  const pool = await getDb();
  // Single UPDATE: roll the counter to 0 if the reset boundary is in the
  // past, refresh the boundary if needed, and add `units` — all atomic.
  // Returns the post-increment total + the user's plan so the caller can
  // decide overage routing without a second query.
  const { rows } = await pool.query(
    `UPDATE users
        SET monthly_units_used = (
              CASE
                WHEN monthly_units_resets_at IS NOT NULL AND monthly_units_resets_at < NOW()
                  THEN 0
                ELSE monthly_units_used
              END
            ) + $2,
            monthly_units_resets_at = CASE
              WHEN monthly_units_resets_at IS NULL OR monthly_units_resets_at < NOW()
                THEN (DATE_TRUNC('month', NOW()) + INTERVAL '1 month')
              ELSE monthly_units_resets_at
            END
      WHERE id = $1
      RETURNING plan, monthly_units_used`,
    [userId, units],
  );
  if (!rows[0]) {
    return { new_total: units, plan: "free", overage_units: units };
  }
  const plan = (rows[0].plan ?? "free") as PlanTier;
  const newTotal = Number(rows[0].monthly_units_used ?? 0);
  const included = PLAN_LIMITS[plan].included_units;
  // Overage portion of THIS increment only. Previous total = newTotal - units.
  // Overage units = how many of `units` landed above the included threshold.
  let overage = 0;
  if (Number.isFinite(included)) {
    const previousTotal = newTotal - units;
    const previousOverage = Math.max(0, previousTotal - included);
    const newOverage = Math.max(0, newTotal - included);
    overage = newOverage - previousOverage;
  }
  return { new_total: newTotal, plan, overage_units: Math.max(0, overage) };
}
