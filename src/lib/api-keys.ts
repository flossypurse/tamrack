import { randomUUID, randomBytes, createHash } from "crypto";
import { getDb } from "./db";

const DAILY_RATE_LIMIT = 1000;

export function generateApiKey(): { key: string; id: string; prefix: string; hash: string } {
  const id = randomUUID();
  const raw = randomBytes(24).toString("hex");
  const key = `ap_${raw}`;
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

export async function logApiUsage(keyId: string | null, userId: string | null, endpoint: string, status: number) {
  const pool = await getDb();
  await pool.query(
    `INSERT INTO api_usage (api_key_id, user_id, endpoint, response_status) VALUES ($1, $2, $3, $4)`,
    [keyId, userId, endpoint, status]
  );
}
