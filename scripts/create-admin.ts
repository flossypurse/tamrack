/**
 * Creates the first admin user interactively.
 *
 * Prompts for username and password (twice), validates per the auth rules,
 * hashes the password, and inserts a user row with role='admin'. Safe to
 * run after wipe-accounts.ts.
 *
 * Usage:
 *   DATABASE_URL=<url> npx tsx scripts/create-admin.ts
 */
import * as readline from "readline/promises";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { hashPassword, validatePasswordStrength } from "@/lib/passwords";
import {
  normalizeUsername,
  validateUsernameShape,
  isUsernameAvailable,
} from "@/lib/usernames";

function createRl() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

async function prompt(rl: readline.Interface, question: string): Promise<string> {
  return rl.question(question);
}

async function main(): Promise<void> {
  const rl = createRl();

  console.error("");
  console.error("Create admin user");
  console.error("-".repeat(40));

  let username = "";
  for (;;) {
    const raw = await prompt(rl, "  Username: ");
    const normalized = normalizeUsername(raw);
    const validation = validateUsernameShape(normalized);
    if (!validation.ok) {
      console.error(`  Error: ${validation.reason}`);
      continue;
    }
    const available = await isUsernameAvailable(normalized);
    if (!available) {
      console.error(`  Error: Username "${normalized}" is already taken.`);
      continue;
    }
    username = normalized;
    break;
  }

  let password = "";
  for (;;) {
    const pw1 = await prompt(rl, "  Password: ");
    const strength = validatePasswordStrength(pw1);
    if (!strength.ok) {
      console.error(`  Error: ${strength.reason}`);
      continue;
    }
    const pw2 = await prompt(rl, "  Confirm password: ");
    if (pw1 !== pw2) {
      console.error("  Error: Passwords do not match.");
      continue;
    }
    password = pw1;
    break;
  }

  rl.close();

  console.error("");
  console.error(`  Hashing password...`);
  const passwordHash = await hashPassword(password);

  const pool = await getDb();
  const id = randomUUID();

  await pool.query(
    `INSERT INTO users (id, username, password_hash, role, plan, early_access, email)
     VALUES ($1, $2, $3, 'admin', 'founder', TRUE, NULL)`,
    [id, username, passwordHash],
  );

  // Seed a subscription row so the account doesn't fail quota checks.
  const subId = randomUUID();
  await pool.query(
    `INSERT INTO subscriptions (id, user_id, status, plan, trial_start, trial_end)
     VALUES ($1, $2, 'active', 'founder', NOW(), NULL)
     ON CONFLICT (user_id) DO NOTHING`,
    [subId, id],
  );

  console.error(`  Admin user created.`);
  console.error(`  id:       ${id}`);
  console.error(`  username: ${username}`);
  console.error(`  role:     admin`);
  console.error(`  plan:     founder`);
  console.error("");

  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
