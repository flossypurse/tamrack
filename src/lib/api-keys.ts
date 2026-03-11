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

export function createApiKey(userId: string, name: string = "Default"): { key: string; id: string; prefix: string } {
  const db = getDb();
  const { key, id, prefix, hash } = generateApiKey();
  db.prepare(
    `INSERT INTO api_keys (id, user_id, key_hash, key_prefix, name) VALUES (?, ?, ?, ?, ?)`
  ).run(id, userId, hash, prefix, name);
  return { key, id, prefix };
}

export function validateApiKey(key: string): { userId: string; keyId: string } | null {
  const db = getDb();
  const hash = createHash("sha256").update(key).digest("hex");
  const row = db.prepare(
    `SELECT id, user_id FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL`
  ).get(hash) as { id: string; user_id: string } | undefined;

  if (!row) return null;

  // Update last_used_at
  db.prepare(`UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?`).run(row.id);

  return { userId: row.user_id, keyId: row.id };
}

export function revokeApiKey(keyId: string, userId: string): boolean {
  const db = getDb();
  const result = db.prepare(
    `UPDATE api_keys SET revoked_at = datetime('now') WHERE id = ? AND user_id = ?`
  ).run(keyId, userId);
  return result.changes > 0;
}

export function getUserApiKeys(userId: string) {
  const db = getDb();
  return db.prepare(
    `SELECT id, key_prefix, name, last_used_at, created_at, revoked_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC`
  ).all(userId) as { id: string; key_prefix: string; name: string; last_used_at: string | null; created_at: string; revoked_at: string | null }[];
}

export function checkRateLimit(keyId: string): { allowed: boolean; remaining: number } {
  const db = getDb();
  const row = db.prepare(
    `SELECT COUNT(*) as cnt FROM api_usage WHERE api_key_id = ? AND timestamp > datetime('now', '-1 day')`
  ).get(keyId) as { cnt: number };

  const remaining = Math.max(0, DAILY_RATE_LIMIT - row.cnt);
  return { allowed: remaining > 0, remaining };
}

export function logApiUsage(keyId: string | null, userId: string | null, endpoint: string, status: number) {
  const db = getDb();
  db.prepare(
    `INSERT INTO api_usage (api_key_id, user_id, endpoint, response_status) VALUES (?, ?, ?, ?)`
  ).run(keyId, userId, endpoint, status);
}
