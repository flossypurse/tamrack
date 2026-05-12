/**
 * Issue a new API key for a user identified by email.
 *
 * Designed to be run with DATABASE_URL pointed at a reachable Postgres (the
 * Railway public URL in dev, internal URL via `railway run` in CI). The key
 * prints to stdout exactly once — copy it; it cannot be recovered.
 *
 * Usage:
 *   tsx scripts/issue-api-key.ts <email> [name] [--scopes=a,b,c] [--create-user]
 *
 * Examples:
 *   tsx scripts/issue-api-key.ts cully@example.com mcp-test
 *   tsx scripts/issue-api-key.ts cully@example.com research --scopes=intel:profile:write,intel:research:write
 *
 * Revoke later via DELETE /api/api-keys or by setting revoked_at in Postgres.
 */
import { createApiKey } from "@/lib/api-keys";
import { getDb } from "@/lib/db";

function parseScopes(): string[] {
  const flag = process.argv.find((a) => a.startsWith("--scopes="));
  if (!flag) return [];
  return flag
    .slice("--scopes=".length)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main(): Promise<void> {
  // Positional args = first two non-flag args.
  const positional = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const email = positional[0];
  const name = positional[1] ?? "manual";
  const scopes = parseScopes();

  if (!email) {
    console.error("usage: tsx scripts/issue-api-key.ts <email> [name]");
    process.exit(2);
  }

  const pool = await getDb();
  const lookup = await pool.query<{ id: string }>(
    `SELECT id FROM users WHERE email = $1 LIMIT 1`,
    [email],
  );

  let userId: string;
  if (lookup.rows[0]) {
    userId = lookup.rows[0].id;
  } else if (process.argv.includes("--create-user")) {
    const { randomUUID } = await import("crypto");
    userId = randomUUID();
    await pool.query(
      `INSERT INTO users (id, email, name, role) VALUES ($1, $2, $3, $4)`,
      [userId, email, name, "user"],
    );
    console.error(`created user ${userId} <${email}>`);
  } else {
    console.error(`no user with email "${email}" (pass --create-user to insert one)`);
    process.exit(1);
  }

  const result = await createApiKey(userId, name, scopes);

  console.log(JSON.stringify({ ...result, email, name }, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
