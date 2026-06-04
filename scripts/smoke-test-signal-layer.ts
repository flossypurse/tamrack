#!/usr/bin/env npx tsx
/**
 * Smoke test for the signal layer pipeline.
 *
 * Verifies:
 *  1. signals.signal_definitions has an active row for 'edmonton-business-panel'
 *  2. Triggers recomputeSignal for that definition with maxGeo=1 + 7-day window
 *  3. Verifies a corpus.narrative_fragments row was written with signal_def_id set
 *  4. Verifies the embedding column is populated (non-null)
 *
 * Safe to run against production — all writes are idempotent UPSERTs.
 * Exits 0 on success, non-zero on any failure.
 *
 * Usage:
 *   DATABASE_URL=... RESONATE_URL=... RESONATE_TOKEN=... npx tsx scripts/smoke-test-signal-layer.ts
 */

import { Resonate } from "@resonatehq/sdk";
import { getDb } from "../src/lib/db";

const TARGET_SIGNAL_SLUG = "edmonton-business-panel";
const SMOKE_WINDOW_DAYS = 7;
const SMOKE_MAX_GEO = 1;
const TIMEOUT_MS = 120_000; // 2 minutes max

function fail(msg: string): never {
  console.error(`[smoke] FAIL: ${msg}`);
  process.exit(1);
}

function pass(msg: string): void {
  console.log(`[smoke] PASS: ${msg}`);
}

async function main(): Promise<void> {
  const resonateUrl = process.env.RESONATE_URL;
  const dbUrl = process.env.DATABASE_URL;

  if (!resonateUrl) fail("RESONATE_URL is required");
  if (!dbUrl) fail("DATABASE_URL is required");

  const pool = await getDb();

  // --- Step 1: Verify signal_definitions row exists ---
  {
    const { rows } = await pool.query(
      `SELECT id, slug, active
       FROM signals.signal_definitions
       WHERE slug = $1 AND active = TRUE
       LIMIT 1`,
      [TARGET_SIGNAL_SLUG]
    );

    if (rows.length === 0) {
      fail(
        `signals.signal_definitions has no active row with slug='${TARGET_SIGNAL_SLUG}'. ` +
        `Run the schema migration and seed the S1 signal definition row before smoke-testing.`
      );
    }

    const defRow = rows[0] as { id: string; slug: string; active: boolean };
    pass(`signal_definitions row found: id=${defRow.id} slug=${defRow.slug}`);
  }

  // --- Step 2: Trigger recomputeSignal via Resonate ---
  const resonateToken = process.env.RESONATE_TOKEN;
  const resonate = new Resonate({
    url: resonateUrl!,
    ttl: 30 * 60 * 1000,
    token: resonateToken,
  });

  // Import workflow functions dynamically to avoid triggering side effects
  // at module load time (the worker import path is relative to the project root).
  // activateSignalFragment must be registered too: recomputeSignal invokes it as
  // a local function call to write the corpus fragment.
  const { recomputeSignal } = await import("../src/workflows/compute-signals");
  const { activateSignalFragment } = await import("../src/workflows/activate-signal-fragment");
  resonate.register("recomputeSignal", recomputeSignal as any);
  resonate.register("activateSignalFragment", activateSignalFragment as any);

  // The runId must start with the worker token's prefix ("access-request") or
  // the server rejects task.create with HTTP 403. Schedule-fired roots are
  // created server-side and exempt; a client-initiated run like this is not.
  const runId = `access-request.smoke-signal-layer-${Date.now()}`;
  console.log(`[smoke] Triggering recomputeSignal run: ${runId}`);

  const runResult = await Promise.race([
    resonate.run(runId, "recomputeSignal", {
      signalSlug: TARGET_SIGNAL_SLUG,
      windowDays: SMOKE_WINDOW_DAYS,
      maxGeo: SMOKE_MAX_GEO,
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`recomputeSignal timed out after ${TIMEOUT_MS}ms`)), TIMEOUT_MS)
    ),
  ]).catch((e: unknown) => {
    fail(`recomputeSignal failed: ${e instanceof Error ? e.message : String(e)}`);
  });

  if (runResult === null) {
    // null means signal_definitions row not found or no geos — already
    // asserted above, so this path means a geo issue.
    fail(
      `recomputeSignal returned null. Check that substrate.geo_dimension has ` +
      `at least one row with geo_type matching the edmonton-business-panel geo_scope.`
    );
  }

  const result = runResult as { status: string; error?: string; signalSlug?: string };
  if (result.status !== "ok") {
    fail(`recomputeSignal returned status='${result.status}': ${result.error ?? "(no detail)"}`);
  }

  pass(`recomputeSignal completed: signalSlug=${result.signalSlug ?? TARGET_SIGNAL_SLUG}`);

  // --- Step 3: Verify corpus.narrative_fragments row was written ---
  {
    // Give the UPSERT a moment to commit — recomputeSignal is synchronous
    // within the smoke context, but wait briefly in case of async indexing.
    const { rows } = await pool.query(
      `SELECT id, signal_def_id, geo_scope, body_template,
              (embedding IS NOT NULL) AS has_embedding
       FROM corpus.narrative_fragments
       WHERE signal_def_id IN (
         SELECT id FROM signals.signal_definitions WHERE slug = $1
       )
       ORDER BY updated_at DESC
       LIMIT 1`,
      [TARGET_SIGNAL_SLUG]
    );

    if (rows.length === 0) {
      fail(
        `No corpus.narrative_fragments row found for signal slug='${TARGET_SIGNAL_SLUG}'. ` +
        `activateSignalFragment may not have been triggered, or the corpus schema migration ` +
        `has not been applied yet.`
      );
    }

    const frag = rows[0] as {
      id: string;
      signal_def_id: string;
      geo_scope: string;
      body_template: string;
      has_embedding: boolean;
    };

    pass(`corpus.narrative_fragments row found: id=${frag.id}`);

    // --- Step 4: Verify embedding is populated ---
    if (!frag.has_embedding) {
      fail(
        `corpus.narrative_fragments row ${frag.id} has no embedding. ` +
        `Check that OPENAI_API_KEY is set and the embedding step in ` +
        `activateSignalFragment did not silently fail. ` +
        `Look for "activateSignalFragment.embedError" in logs.`
      );
    }

    pass(`embedding populated for fragment ${frag.id}`);
  }

  resonate.stop();
  console.log("[smoke] All checks passed.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[smoke] Uncaught error:", err);
  process.exit(1);
});
