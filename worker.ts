#!/usr/bin/env npx tsx
/**
 * Alberta Pulse — Resonate Durable Worker
 *
 * Runs the 7 collection phases as fault-tolerant durable steps.
 * Connects to Resonate server at RESONATE_URL and data Postgres at DATABASE_URL.
 *
 * If a phase crashes mid-run, Resonate resumes from the last completed step
 * instead of re-running all phases from scratch.
 *
 * Env vars:
 *   DATABASE_URL  — Postgres connection string (data DB, shared with webui)
 *   RESONATE_URL  — Resonate server HTTP API (e.g. http://resonate:8001)
 *
 * Run locally:  DATABASE_URL=... RESONATE_URL=... npx tsx worker.ts
 * On Railway:   Set env vars in Railway dashboard, deploy as a separate service
 */

import { Resonate, type Context } from "@resonatehq/sdk";

import {
  REGIONAL_INDICATORS,
  collectOneRegionalIndicator,
  collectEnergyData,
  collectMunicipalityData,
  collectWellLicences,
  collectImmigration,
  collectMajorProjects,
  collectMacroIndicators,
} from "./src/lib/collector";

import { getDb } from "./src/lib/db";

// ---------------------------------------------------------------------------
// Phase definitions
// ---------------------------------------------------------------------------

interface PhaseResult {
  phase: string;
  rows: number;
  status: "ok" | "error";
  error?: string;
}

// Non-regional phases run as a single ctx.run step each (payloads are small).
const NON_REGIONAL_PHASES = [
  { name: "energy",        fn: (_today: string) => collectEnergyData() },
  { name: "municipalities", fn: (today: string) => collectMunicipalityData(today) },
  { name: "wells",         fn: (today: string) => collectWellLicences(today) },
  { name: "immigration",   fn: (_today: string) => collectImmigration() },
  { name: "projects",      fn: (today: string) => collectMajorProjects(today) },
  { name: "macro",         fn: (today: string) => collectMacroIndicators(today) },
] as const;

// Slug-safe key for Resonate step IDs (must be deterministic across replays).
function indicatorSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ---------------------------------------------------------------------------
// Durable workflow: each phase is a separate Resonate step.
// The regional phase is further split: one ctx.run step per indicator so
// OOM on a single large payload only replays that one indicator, not the
// whole phase.
// ---------------------------------------------------------------------------

function* dailyCollection(ctx: Context): Generator<any, PhaseResult[], any> {
  const today = new Date().toISOString().split("T")[0];
  const results: PhaseResult[] = [];

  // --- Phase: regional (per-indicator steps) ---
  {
    const indicatorNames = Object.keys(REGIONAL_INDICATORS);
    let regionalRows = 0;
    let regionalErrors = 0;

    for (const name of indicatorNames) {
      const slug = indicatorSlug(name);
      const start = Date.now();

      const indicatorResult: { rows: number; error?: string } = yield* ctx.run(
        async (): Promise<{ rows: number; error?: string }> => {
          try {
            const rows = await collectOneRegionalIndicator(name);
            return { rows };
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error(`[worker] Indicator ${slug} failed: ${msg}`);
            return { rows: 0, error: msg };
          }
        }
      );

      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      if (indicatorResult.error) {
        regionalErrors++;
        console.warn(`[worker] Indicator ${slug}: 0 rows (${elapsed}s) — ${indicatorResult.error}`);
      } else {
        regionalRows += indicatorResult.rows;
        console.log(`[worker] Indicator ${slug}: ${indicatorResult.rows} rows (${elapsed}s)`);
      }
    }

    console.log(`[worker] Phase regional: ${regionalRows} rows (${regionalErrors} errors)`);
    results.push({ phase: "regional", rows: regionalRows, status: regionalErrors === 0 ? "ok" : "error" });
  }

  // --- Remaining phases (one step each) ---
  for (const phase of NON_REGIONAL_PHASES) {
    const result: PhaseResult = yield* ctx.run(async (): Promise<PhaseResult> => {
      const start = Date.now();
      try {
        const rows = await phase.fn(today);
        console.log(`[worker] Phase ${phase.name}: ${rows} rows (${((Date.now() - start) / 1000).toFixed(1)}s)`);
        return { phase: phase.name, rows, status: "ok" };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[worker] Phase ${phase.name} failed: ${msg}`);

        // Log error to snapshot_log
        try {
          const pool = await getDb();
          await pool.query(
            `INSERT INTO snapshot_log (taken_at, source, records_inserted, status, error) VALUES (NOW(), $1, 0, 'error', $2)`,
            [phase.name, msg]
          );
        } catch {
          // Don't let logging failures break the workflow
        }

        return { phase: phase.name, rows: 0, status: "error", error: msg };
      }
    });

    results.push(result);
  }

  const totalRows = results.reduce((s, r) => s + r.rows, 0);
  const errors = results.filter((r) => r.status === "error").length;
  console.log(`[worker] Collection complete: ${totalRows} total rows, ${errors} errors`);

  return results;
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

async function main() {
  const resonateUrl = process.env.RESONATE_URL;
  if (!resonateUrl) {
    console.error("RESONATE_URL is required");
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  // Ensure database is migrated before starting
  await getDb();

  console.log(`[worker] Connecting to Resonate at ${resonateUrl}`);
  console.log(`[worker] Connected to data Postgres`);

  // TTL = 30 min: the energy phase (single ctx.run) can take 8–23 min.
  // Regional indicators top out at ~3 min each.  Heartbeat sends tasks:[]
  // so leases are never renewed — set TTL high enough to cover the longest
  // single step instead.  Default 60s caused "Version mismatch" 409s.
  const resonate = new Resonate({ url: resonateUrl, ttl: 30 * 60 * 1000 });

  // Register the collection workflow
  resonate.register("dailyCollection", dailyCollection);

  // Schedule daily at 6:00 AM UTC (midnight MST)
  await resonate.schedule("daily-collection", "0 6 * * *", "dailyCollection");

  console.log("[worker] Registered dailyCollection workflow");
  console.log("[worker] Scheduled daily-collection cron: 0 6 * * * (6 AM UTC)");
  console.log("[worker] Worker running. Press Ctrl+C to stop.");

  // Keep the process alive — Resonate SDK handles the event loop
  process.on("SIGTERM", () => {
    console.log("[worker] Received SIGTERM, shutting down...");
    resonate.stop();
    process.exit(0);
  });

  process.on("SIGINT", () => {
    console.log("[worker] Received SIGINT, shutting down...");
    resonate.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[worker] Fatal error:", err);
  process.exit(1);
});
