#!/usr/bin/env npx tsx
/**
 * Tamrack — Resonate Durable Worker
 *
 * Runs the 7 collection phases as fault-tolerant durable steps.
 * Connects to Resonate server at RESONATE_URL and data Postgres at DATABASE_URL.
 *
 * If a phase crashes mid-run, Resonate resumes from the last completed step
 * instead of re-running all phases from scratch.
 *
 * Env vars:
 *   DATABASE_URL    — Postgres connection string (data DB, shared with webui)
 *   RESONATE_URL    — Resonate server HTTP API (e.g. http://resonate:8001)
 *   RESONATE_TOKEN  — RS256 JWT for Resonate server auth (required when server has auth enabled)
 *
 * Run locally:  DATABASE_URL=... RESONATE_URL=... RESONATE_TOKEN=... npx tsx worker.ts
 * On Fly.io:    Set env vars as Fly secrets, deploy via fly.worker.toml
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
  collectCMHCHousing,
} from "./src/lib/collector";

import { getDb } from "./src/lib/db";
import { captureError, initObservability } from "./src/lib/observability";

// Signal pipeline workflows
import { computeSignals, recomputeSignal } from "./src/workflows/compute-signals";
import { processSignalQueue } from "./src/workflows/process-signal-queue";
import { activateSignalFragment } from "./src/workflows/activate-signal-fragment";

// Substrate operational workflows
import { rolloverSubstratePartitions } from "./src/workflows/partition-rollover";
import { refreshLatestObservations } from "./src/workflows/refresh-matview";
import { snapshotLogHygiene } from "./src/workflows/snapshot-log-hygiene";

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
  { name: "housing",       fn: (_today: string) => collectCMHCHousing() },
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

  // Step IDs are scoped by `today` to prevent Resonate's resolved-step cache
  // from replaying yesterday's results on today's fire. Observed pre-fix on
  // 2026-05-26: the daily-collection workflow completed in 4s because every
  // step ID (e.g. "energy", "population") matched the prior day's resolved
  // promise and short-circuited from cache — no DB writes happened.
  // Including the date in the step ID makes each day's run get fresh cache
  // entries while preserving idempotent mid-run replay (today's string is
  // stable for the duration of one schedule fire).
  const stepId = (suffix: string) => `${today}.${suffix}`;

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
            captureError(e, { phase: "regional", indicator: slug, today });
            return { rows: 0, error: msg };
          }
        },
        (ctx as any).options({ id: stepId(slug) })
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

    // Write a single regional_indicators row to snapshot_log. The per-indicator
    // ctx.run steps above never touch snapshot_log, and collectRegionalIndicators
    // (which does) isn't on this code path — so without this step the regional
    // phase silently looks like it never ran when scanning snapshot_log.
    yield* ctx.run(
      async () => {
        const status = regionalErrors === 0 ? "ok" : "error";
        const error = regionalErrors > 0 ? `${regionalErrors} indicator(s) failed` : null;
        const pool = await getDb();
        await pool.query(
          `INSERT INTO snapshot_log (taken_at, source, records_inserted, status, error) VALUES (NOW(), $1, $2, $3, $4)`,
          ["regional_indicators", regionalRows, status, error],
        );
      },
      (ctx as any).options({ id: stepId("regional-snapshot-log") }),
    );
  }

  // --- Remaining phases (one step each) ---
  for (const phase of NON_REGIONAL_PHASES) {
    const result: PhaseResult = yield* ctx.run(
      async (): Promise<PhaseResult> => {
        const start = Date.now();
        try {
          const rows = await phase.fn(today);
          console.log(`[worker] Phase ${phase.name}: ${rows} rows (${((Date.now() - start) / 1000).toFixed(1)}s)`);
          return { phase: phase.name, rows, status: "ok" };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(`[worker] Phase ${phase.name} failed: ${msg}`);
          captureError(e, { phase: phase.name, today });

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
      },
      (ctx as any).options({ id: stepId(phase.name) })
    );

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
  // Init observability first so uncaught/unhandled handlers cover the rest of main().
  initObservability();

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

  const resonateToken = process.env.RESONATE_TOKEN;

  // TTL = 30 min: the energy phase (single ctx.run) can take 8–23 min.
  // Regional indicators top out at ~3 min each.  Heartbeat sends tasks:[]
  // so leases are never renewed — set TTL high enough to cover the longest
  // single step instead.  Default 60s caused "Version mismatch" 409s.
  const resonate = new Resonate({ url: resonateUrl, ttl: 30 * 60 * 1000, token: resonateToken });

  // Register the collection workflow
  resonate.register("dailyCollection", dailyCollection);

  // Signal pipeline workflows
  resonate.register("computeSignals", computeSignals);
  resonate.register("processSignalQueue", processSignalQueue);
  resonate.register("activateSignalFragment", activateSignalFragment);
  resonate.register("recomputeSignal", recomputeSignal);

  // Substrate operational workflows
  resonate.register("rolloverSubstratePartitions", rolloverSubstratePartitions);
  resonate.register("snapshotLogHygiene", snapshotLogHygiene);
  resonate.register("refreshLatestObservations", refreshLatestObservations);

  console.log("[worker] Registered dailyCollection + signals + ops workflows");

  // The SDK encodes schedule.promiseId as the literal template
  // "{{.id}}.{{.timestamp}}", which starts with "{" — no prefix-scoped
  // JWT can satisfy starts_with(prefix). The schedule is bootstrapped
  // separately and persists on the server, so a 403 here is expected
  // when the worker's token is prefix-scoped, and non-fatal.
  try {
    await resonate.schedule("daily-collection", "0 6 * * *", "dailyCollection");
    console.log("[worker] Scheduled daily-collection cron: 0 6 * * * (6 AM UTC)");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("HTTP 403")) {
      console.log("[worker] Skipping schedule.create (403 with prefix-scoped token); existing schedule preserved");
    } else if (msg.includes("HTTP 401")) {
      console.error("[worker] FATAL: token rejected (HTTP 401) — schedule.create unauthenticated; check RESONATE_TOKEN expiry/validity");
      throw e;
    } else {
      throw e;
    }
  }

  // Signal cron schedules
  try {
    await resonate.schedule("compute-signals", "0 7 * * *", "computeSignals");
    console.log("[worker] Scheduled compute-signals cron: 0 7 * * * (7 AM UTC)");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("HTTP 403")) {
      console.log("[worker] Skipping compute-signals schedule.create (403 with prefix-scoped token); existing schedule preserved");
    } else if (msg.includes("HTTP 401")) {
      console.error("[worker] FATAL: token rejected scheduling compute-signals");
      throw e;
    } else {
      throw e;
    }
  }

  try {
    await resonate.schedule("process-signal-queue", "*/5 * * * *", "processSignalQueue");
    console.log("[worker] Scheduled process-signal-queue cron: */5 * * * *");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("HTTP 403")) {
      console.log("[worker] Skipping process-signal-queue schedule.create (403 with prefix-scoped token); existing schedule preserved");
    } else if (msg.includes("HTTP 401")) {
      console.error("[worker] FATAL: token rejected scheduling process-signal-queue");
      throw e;
    } else {
      throw e;
    }
  }

  // Substrate operational cron schedules (spaced to avoid collision with daily-collection 06:00)
  try {
    await resonate.schedule("monthly-partition-rollover", "0 8 1 * *", "rolloverSubstratePartitions");
    console.log("[worker] Scheduled monthly-partition-rollover: 0 8 1 * *");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("HTTP 403")) {
      console.log("[worker] Skipping monthly-partition-rollover schedule.create (403 with prefix-scoped token); existing schedule preserved");
    } else if (msg.includes("HTTP 401")) {
      console.error("[worker] FATAL: token rejected scheduling monthly-partition-rollover");
      throw e;
    } else {
      throw e;
    }
  }

  try {
    await resonate.schedule("monthly-snapshot-log-hygiene", "30 8 1 * *", "snapshotLogHygiene");
    console.log("[worker] Scheduled monthly-snapshot-log-hygiene: 30 8 1 * *");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("HTTP 403")) {
      console.log("[worker] Skipping monthly-snapshot-log-hygiene schedule.create (403 with prefix-scoped token); existing schedule preserved");
    } else if (msg.includes("HTTP 401")) {
      console.error("[worker] FATAL: token rejected scheduling monthly-snapshot-log-hygiene");
      throw e;
    } else {
      throw e;
    }
  }

  try {
    await resonate.schedule("nightly-matview-refresh", "30 9 * * *", "refreshLatestObservations");
    console.log("[worker] Scheduled nightly-matview-refresh: 30 9 * * *");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("HTTP 403")) {
      console.log("[worker] Skipping nightly-matview-refresh schedule.create (403 with prefix-scoped token); existing schedule preserved");
    } else if (msg.includes("HTTP 401")) {
      console.error("[worker] FATAL: token rejected scheduling nightly-matview-refresh");
      throw e;
    } else {
      throw e;
    }
  }

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
  captureError(err, { phase: "bootstrap" });
  process.exit(1);
});
