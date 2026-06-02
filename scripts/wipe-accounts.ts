/**
 * DESTRUCTIVE — wipes all user account data from the database.
 *
 * Deletes all rows from: users (CASCADE → subscriptions, api_keys, api_usage,
 * invites, access_requests FKs). Also issues a belt-and-braces DELETE on
 * access_requests for rows with no user FK.
 *
 * Smart-dashboard rows (saved_dashboards) survive — their user_id is
 * ON DELETE SET NULL, preserving the saved work.
 *
 * This script is human-gated. To confirm, you must type the exact database
 * name when prompted. Do not run against production unless you have
 * explicitly decided to wipe all accounts.
 *
 * Usage:
 *   DATABASE_URL=<url> npx tsx scripts/wipe-accounts.ts
 */
import * as readline from "readline/promises";
import { getDb } from "@/lib/db";

async function confirm(prompt: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    return await rl.question(prompt);
  } finally {
    rl.close();
  }
}

async function getDbName(pool: Awaited<ReturnType<typeof getDb>>): Promise<string> {
  const { rows } = await pool.query<{ current_database: string }>(
    `SELECT current_database()`,
  );
  return rows[0]?.current_database ?? "(unknown)";
}

async function main(): Promise<void> {
  const pool = await getDb();
  const dbName = await getDbName(pool);

  console.error("");
  console.error("=".repeat(60));
  console.error("  DESTRUCTIVE OPERATION — ACCOUNT WIPE");
  console.error("=".repeat(60));
  console.error("");
  console.error(`  Database: ${dbName}`);
  console.error("");
  console.error(
    "  This will DELETE all rows from: users, access_requests.",
  );
  console.error(
    "  Cascades will also remove: subscriptions, api_keys, api_usage,",
  );
  console.error("  invites (and their redeemed_by_user_id FK).");
  console.error(
    "  Smart-dashboard rows are preserved (user_id set to NULL).",
  );
  console.error("");

  const answer = await confirm(
    `  Type the database name to confirm: `,
  );

  if (answer.trim() !== dbName) {
    console.error("");
    console.error(
      `  Confirmation mismatch. Expected "${dbName}", got "${answer.trim()}". Aborting.`,
    );
    process.exit(1);
  }

  console.error("");
  console.error("  Wiping...");

  await pool.query("BEGIN");
  try {
    const usersResult = await pool.query(`DELETE FROM users`);
    const arResult = await pool.query(`DELETE FROM access_requests`);
    await pool.query("COMMIT");

    console.error(
      `  Done. Deleted ${usersResult.rowCount ?? 0} user(s), ` +
      `${arResult.rowCount ?? 0} access_request(s).`,
    );
    console.error("");
    console.error("  Next step: run scripts/create-admin.ts to add the first admin user.");
    console.error("");
  } catch (err) {
    await pool.query("ROLLBACK");
    throw err;
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
