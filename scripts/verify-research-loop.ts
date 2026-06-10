/**
 * Dry-run verification for the research-loop engine.
 *
 * Exercises the load → stub-research → compose → writeProfile → queue-done
 * data path by calling the pure step helpers directly, WITHOUT any paid API
 * calls (mode='dry-run'). It does NOT stand up a Resonate server, so the
 * generator orchestration (ctx.run step IDs, ctx.beginRpc dispatch, TTL/retry)
 * is not covered here — that needs a live Resonate integration test.
 *
 * Prerequisites:
 *   DATABASE_URL pointing to a fresh/empty PostgreSQL 16+ database. The example
 *   below uses a local throwaway cluster; any empty Postgres 16 URL works.
 *
 * Usage:
 *   DATABASE_URL="postgresql://postgres@127.0.0.1:54399/tamrack_verify_research" \
 *     npx tsx scripts/verify-research-loop.ts
 */
import { randomUUID, createHash } from "crypto";
import { getDb } from "@/lib/db";
import { loadOperator, researchFacts, composeProfile, persistProfile } from "@/workflows/research-operator";
import { getCurrentProfile } from "@/lib/data-sources-intel-profiles";
import { enqueueOperator } from "@/lib/data-sources-intel-queue";

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passed++;
  } else {
    console.error(`  FAIL: ${message}`);
    failed++;
  }
}

function assertEq<T>(actual: T, expected: T, label: string): void {
  if (actual === expected) {
    console.log(`  PASS: ${label} === ${String(expected)}`);
    passed++;
  } else {
    console.error(`  FAIL: ${label} — expected ${String(expected)}, got ${String(actual)}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

/**
 * Derive a deterministic UUID v5-style from (source, member_id) so re-runs
 * produce the same operator ID. Matches the pattern in seed-intel-operators.ts.
 */
function deriveOperatorId(source: string, memberId: string): string {
  const hash = createHash("sha256")
    .update(`${source}:${memberId}`)
    .digest("hex");
  // Shape as UUID v4 (just need a stable UUID-format string).
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    "4" + hash.slice(13, 16),
    ((parseInt(hash[16], 16) & 0x3) | 0x8).toString(16) + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join("-");
}

async function seedTestOperator(operatorId: string): Promise<void> {
  const pool = await getDb();
  await pool.query(
    `INSERT INTO intel_operators
       (id, source, source_member_id, name, categories, city, region, website)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO NOTHING`,
    [
      operatorId,
      "verify-script",
      "TEST-001",
      "Acme Test Supply Co.",
      ["Wholesale", "Industrial Supply"],
      "Stony Plain",
      "AB",
      "https://example.com/acme-test",
    ]
  );
}

// ---------------------------------------------------------------------------
// v1 structured shape validation helpers
// ---------------------------------------------------------------------------

function isV1Structured(obj: unknown): obj is {
  identity: { canonical_name: string };
  location: { region: string };
  classification: { sector: string };
  scale: object;
  contacts: unknown[];
  signals: object;
  summary: string;
} {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.identity === "object" &&
    typeof o.location === "object" &&
    typeof o.classification === "object" &&
    typeof o.scale === "object" &&
    Array.isArray(o.contacts) &&
    typeof o.signals === "object" &&
    typeof o.summary === "string"
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("=== verify-research-loop (dry-run) ===\n");

  // 1. Boot DDL (getDb runs migrations on first call).
  console.log("Step 1: Booting schema...");
  const pool = await getDb();
  console.log("  Schema ready.\n");

  // 2. Seed one operator + enqueue it.
  const operatorId = deriveOperatorId("verify-script", "TEST-001");
  console.log(`Step 2: Seeding operator ${operatorId}...`);
  await seedTestOperator(operatorId);
  const queueRow = await enqueueOperator({ operator_id: operatorId, priority: 1 });
  assertEq(queueRow.operator_id, operatorId, "queue row operator_id");
  assertEq(queueRow.status, "pending", "initial queue status");
  console.log();

  // 3. Exercise load step.
  console.log("Step 3: loadOperator...");
  const operator = await loadOperator(operatorId);
  assert(operator !== null, "operator loaded successfully");
  assertEq(operator?.name, "Acme Test Supply Co.", "operator name");
  assertEq(operator?.city, "Stony Plain", "operator city");
  console.log();

  if (!operator) {
    console.error("FATAL: operator not found — aborting");
    process.exit(1);
  }

  // 4. Exercise research step (dry-run — no paid calls).
  console.log("Step 4: researchFacts (dry-run)...");
  const t0 = Date.now();
  const research = await researchFacts(operator, "dry-run");
  assert(research.rawMd.length > 0, "rawMd is non-empty");
  assert(research.sources.length >= 1, "at least one source");
  assert(
    research.sources.every((s) => s.url.startsWith("http")),
    "all sources have http URLs"
  );
  assertEq(research.researchedAt.length > 0, true, "researchedAt is set");
  console.log(`  Duration: ${Date.now() - t0}ms`);
  console.log();

  // 5. Exercise compose step (dry-run — no paid calls).
  console.log("Step 5: composeProfile (dry-run)...");
  const payload = await composeProfile(operator, research, "dry-run");
  assertEq(payload.profile_schema, "v1", "profile_schema");
  assertEq(payload.researcher, "agent-research-loop", "researcher");
  assert(payload.raw_profile_md.trim().length > 0, "raw_profile_md non-empty");
  assert(payload.sources.length >= 1, "sources has at least 1 entry");
  assert(
    Number.isFinite(payload.confidence) &&
      payload.confidence >= 0 &&
      payload.confidence <= 1,
    `confidence in [0,1] (got ${payload.confidence})`
  );
  assert(Array.isArray(payload.data_gaps), "data_gaps is array");
  assert(isV1Structured(payload.structured), "structured matches v1 shape");

  // Check region is always AB.
  const structured = payload.structured as Record<string, unknown>;
  const location = structured.location as Record<string, unknown>;
  assertEq(location?.region as string, "AB", "location.region === AB");

  // Check identity canonical name is set.
  const identity = structured.identity as Record<string, unknown>;
  assert(
    typeof identity?.canonical_name === "string" &&
      (identity.canonical_name as string).length > 0,
    "identity.canonical_name is non-empty string"
  );

  console.log();

  // 6. Exercise write step — calls writeProfile which also marks queue done.
  console.log("Step 6: persistProfile (writeProfile)...");
  const profileId = await persistProfile(operatorId, payload);
  assert(typeof profileId === "string" && profileId.length > 0, "profileId returned");
  console.log(`  Profile ID: ${profileId}`);
  console.log();

  // 7. Assert profile exists in DB.
  console.log("Step 7: Verify profile persisted...");
  const profile = await getCurrentProfile(operatorId);
  assert(profile !== null, "current profile row exists");
  assertEq(profile?.profile_schema, "v1", "stored profile_schema=v1");
  // pg returns NUMERIC(4,3) as a string; coerce before range check.
  const storedConf = parseFloat(String(profile?.confidence ?? "NaN"));
  assert(
    Number.isFinite(storedConf) && storedConf >= 0 && storedConf <= 1,
    `stored confidence in [0,1] (got ${profile?.confidence})`
  );
  assert(
    Array.isArray(profile?.sources) && (profile?.sources ?? []).length >= 1,
    "stored sources.length >= 1"
  );
  assert(
    typeof profile?.structured === "object" && profile?.structured !== null,
    "stored structured is object"
  );
  assert(isV1Structured(profile?.structured), "stored structured matches v1 shape");
  console.log();

  // 8. Assert queue row is 'done'.
  console.log("Step 8: Verify queue row marked done...");
  const { rows } = await pool.query<{ status: string }>(
    `SELECT status FROM intel_research_queue WHERE operator_id = $1`,
    [operatorId]
  );
  assertEq(rows[0]?.status, "done", "queue row status=done");
  console.log();

  // 9. Summary.
  console.log("=== Results ===");
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);

  await pool.end();

  if (failed > 0) {
    console.error(`\n${failed} assertion(s) failed.`);
    process.exit(1);
  }

  console.log("\nAll assertions passed.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Unhandled error:", err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
