/**
 * Signal layer observability — alert detection SQL and severity definitions
 *
 * Five alerts added to the signal pipeline monitoring surface.
 * Each alert exports a detection query and severity metadata.
 * Callers (e.g. a daily cron step in computeSignals, or an external
 * monitoring job) run the query, check the returned rows, and route
 * non-empty results to Sentry as configured below.
 *
 * No external infra is introduced here. All detection runs against the
 * existing Postgres pool via getDb(). Routing uses Sentry's captureMessage /
 * captureEvent already wired in src/lib/observability.ts.
 *
 * Runbook entries for each alert are documented inline.
 */

import { getDb } from "./db";
import { captureError } from "./observability";

// ---------------------------------------------------------------------------
// Severity levels
// ---------------------------------------------------------------------------

export type AlertSeverity = "critical" | "warning" | "info";

export interface AlertResult {
  name: string;
  fired: boolean;
  severity: AlertSeverity;
  detail: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Alert 1 — computeSignals failure rate > 5% in the last 15 minutes
//
// Trigger:  signal_run_log rows in the last 15 min where status='error'
//           exceed 5% of total rows in the same window.
// Severity: critical (email + Slack)
// Runbook:
//   1. Check signal_run_log for the failing workflow_ids.
//   2. Look at the corresponding signals.discovery_runs for error_detail.
//   3. If all failures share the same signal_slug, the signal's SQL has
//      regressed — revert or patch compute-signals.ts.
//   4. If failures are spread across signals, check the DB connection pool
//      (getDb) and substrate.observations partition existence.
//   5. Re-trigger via: resonate.run("repair-<date>", "computeSignals", {})
// ---------------------------------------------------------------------------

export async function checkComputeSignalsFailureRate(): Promise<AlertResult> {
  const pool = await getDb();
  try {
    const { rows } = await pool.query<{
      total: string;
      errors: string;
      error_rate: string;
    }>(`
      SELECT
        COUNT(*)                                              AS total,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END)   AS errors,
        ROUND(
          100.0 * SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END)
          / NULLIF(COUNT(*), 0),
          2
        )                                                    AS error_rate
      FROM signals.signal_run_log
      WHERE run_date >= CURRENT_DATE
        AND workflow_id LIKE '%computeSignals%'
    `);

    const row = rows[0];
    const errorRate = parseFloat(row?.error_rate ?? "0");
    const fired = errorRate > 5;

    return {
      name: "computeSignals.failureRate",
      fired,
      severity: "critical",
      detail: {
        total: row?.total,
        errors: row?.errors,
        error_rate_pct: errorRate,
        threshold_pct: 5,
      },
    };
  } catch (e) {
    captureError(e, { alert: "checkComputeSignalsFailureRate" });
    return {
      name: "computeSignals.failureRate",
      fired: false,
      severity: "critical",
      detail: { error: e instanceof Error ? e.message : String(e) },
    };
  }
}

// ---------------------------------------------------------------------------
// Alert 2 — Activation rate outside 15–40% band (weekly)
//
// Trigger:  signals_activated / hypotheses_proposed < 15% or > 40%
//           over the trailing 7 days in discovery_runs.
// Severity: info (Sentry log only)
// Runbook:
//   1. Pull discovery_runs for the last 7 days, group by run_type.
//   2. If rate < 15%: signal templates are too restrictive or evidence_refs
//      are empty — check activateSignalFragment for "no_event" returns.
//   3. If rate > 40%: templates may be overly permissive — review the
//      narrative_template_id FK on signal_definitions for quality.
//   4. Adjust threshold_pct on affected signal_definitions rows.
// ---------------------------------------------------------------------------

export async function checkActivationRate(): Promise<AlertResult> {
  const pool = await getDb();
  try {
    const { rows } = await pool.query<{
      total_runs: string;
      total_activated: string;
      total_suppressed: string;
      activation_rate: string;
    }>(`
      SELECT
        COUNT(*)                      AS total_runs,
        SUM(events_fired)             AS total_activated,
        SUM(events_suppressed)        AS total_suppressed,
        ROUND(
          100.0 * SUM(events_fired)
          / NULLIF(SUM(events_fired) + SUM(events_suppressed), 0),
          2
        )                             AS activation_rate
      FROM signals.discovery_runs
      WHERE started_at >= NOW() - INTERVAL '7 days'
        AND run_type IN ('scheduled', 'agentic')
    `);

    const row = rows[0];
    const rate = parseFloat(row?.activation_rate ?? "-1");
    const fired = rate >= 0 && (rate < 15 || rate > 40);

    return {
      name: "signals.activationRate",
      fired,
      severity: "info",
      detail: {
        total_runs: row?.total_runs,
        total_activated: row?.total_activated,
        total_suppressed: row?.total_suppressed,
        activation_rate_pct: rate,
        low_threshold_pct: 15,
        high_threshold_pct: 40,
      },
    };
  } catch (e) {
    captureError(e, { alert: "checkActivationRate" });
    return {
      name: "signals.activationRate",
      fired: false,
      severity: "info",
      detail: { error: e instanceof Error ? e.message : String(e) },
    };
  }
}

// ---------------------------------------------------------------------------
// Alert 3 — Corpus hit rate for signal fragments < 10% over 30 days
//
// Trigger:  count of answers that include at least one signal fragment /
//           total answers < 10% in the trailing 30 days.
// Severity: warning (Sentry)
// Runbook:
//   1. Check corpus.narrative_fragments WHERE signal_def_id IS NOT NULL
//      for row count — if near zero, the activation pipeline hasn't run.
//   2. Check smart_query_events for outcome='ok' in the last 30 days.
//   3. Check the composer system prompt for story_template selection logic.
//   4. If fragments exist but don't get retrieved, the embedding index may
//      need a REFRESH MATERIALIZED VIEW on substrate.latest_observations or
//      a re-embed pass on narrative_fragments.
// ---------------------------------------------------------------------------

export async function checkCorpusHitRate(): Promise<AlertResult> {
  const pool = await getDb();
  try {
    // Count answers that reference a signal fragment via JSONB blocks array.
    // smart_dashboards.config JSONB contains the composer's AnswerDocument.
    const { rows } = await pool.query<{
      total_answers: string;
      signal_hits: string;
      hit_rate: string;
    }>(`
      SELECT
        COUNT(*)                                             AS total_answers,
        SUM(CASE
          WHEN config::TEXT LIKE '%signal_def_id%' THEN 1
          ELSE 0
        END)                                               AS signal_hits,
        ROUND(
          100.0 * SUM(CASE
            WHEN config::TEXT LIKE '%signal_def_id%' THEN 1
            ELSE 0
          END) / NULLIF(COUNT(*), 0),
          2
        )                                                  AS hit_rate
      FROM smart_dashboards
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `);

    const row = rows[0];
    const hitRate = parseFloat(row?.hit_rate ?? "100");
    const totalAnswers = parseInt(row?.total_answers ?? "0", 10);
    // Only fire if there are enough answers to be meaningful.
    const fired = totalAnswers >= 10 && hitRate < 10;

    return {
      name: "corpus.signalHitRate",
      fired,
      severity: "warning",
      detail: {
        total_answers: row?.total_answers,
        signal_hits: row?.signal_hits,
        hit_rate_pct: hitRate,
        threshold_pct: 10,
        window_days: 30,
      },
    };
  } catch (e) {
    captureError(e, { alert: "checkCorpusHitRate" });
    return {
      name: "corpus.signalHitRate",
      fired: false,
      severity: "warning",
      detail: { error: e instanceof Error ? e.message : String(e) },
    };
  }
}

// ---------------------------------------------------------------------------
// Alert 4 — Signal staleness: activated fragments past their time_bounded window
//
// Trigger:  corpus.narrative_fragments WHERE freshness='time_bounded' AND
//           upper(observed_window) < NOW() - INTERVAL '1 day'
// Severity: warning (Sentry)
// Runbook:
//   1. Identify the stale fragments by signal_def_id.
//   2. Trigger a recompute: resonate.run("recompute-<slug>-<date>",
//      "recomputeSignal", { signalSlug: "<slug>" })
//   3. If a signal definition was deprecated, set active=FALSE on
//      signal_definitions and archived_at on the fragment to suppress future alerts.
//   4. If the fragment is stale because the S1 materialization didn't run,
//      check signal_run_log for computeSignals errors on that date.
// ---------------------------------------------------------------------------

export async function checkSignalStaleness(): Promise<AlertResult> {
  const pool = await getDb();
  try {
    const { rows } = await pool.query<{
      stale_count: string;
      oldest_window_end: string;
    }>(`
      SELECT
        COUNT(*)                                               AS stale_count,
        MIN(upper(observed_window))::TEXT                      AS oldest_window_end
      FROM corpus.narrative_fragments
      WHERE freshness = 'time_bounded'
        AND signal_def_id IS NOT NULL
        AND upper(observed_window) < CURRENT_DATE - INTERVAL '1 day'
    `);

    const row = rows[0];
    const staleCount = parseInt(row?.stale_count ?? "0", 10);

    return {
      name: "signals.staleness",
      fired: staleCount > 0,
      severity: "warning",
      detail: {
        stale_fragment_count: staleCount,
        oldest_window_end: row?.oldest_window_end,
      },
    };
  } catch (e) {
    captureError(e, { alert: "checkSignalStaleness" });
    return {
      name: "signals.staleness",
      fired: false,
      severity: "warning",
      detail: { error: e instanceof Error ? e.message : String(e) },
    };
  }
}

// ---------------------------------------------------------------------------
// Alert 5 — Per-signal compute time > 2 minutes
//
// Trigger:  signal_run_log.wall_ms > 120000 for any signal today
// Severity: info (Sentry log — gate for incremental decision)
// Runbook:
//   1. Identify the slow signals from signal_run_log (workflow_id pattern).
//   2. Check the materialization SQL in compute-signals.ts for missing indexes.
//   3. If wall_ms > 600000 (10 min), evaluate splitting the signal to a
//      dedicated tamrack-signal-worker Fly app.
//   4. If the signal is consistently > 2 min for 7+ days, set
//      incremental_enabled=TRUE on signal_definitions and implement the
//      incremental path in computeOneSignal.
// ---------------------------------------------------------------------------

export async function checkPerSignalComputeTime(): Promise<AlertResult> {
  const pool = await getDb();
  try {
    const { rows } = await pool.query<{
      workflow_id: string;
      wall_ms: string;
    }>(`
      SELECT workflow_id, wall_ms
      FROM signals.signal_run_log
      WHERE run_date = CURRENT_DATE
        AND wall_ms > 120000
      ORDER BY wall_ms DESC
      LIMIT 10
    `);

    return {
      name: "signals.computeTime",
      fired: rows.length > 0,
      severity: "info",
      detail: {
        slow_signals: rows.map((r) => ({
          workflow_id: r.workflow_id,
          wall_ms: parseInt(r.wall_ms, 10),
        })),
        threshold_ms: 120000,
      },
    };
  } catch (e) {
    captureError(e, { alert: "checkPerSignalComputeTime" });
    return {
      name: "signals.computeTime",
      fired: false,
      severity: "info",
      detail: { error: e instanceof Error ? e.message : String(e) },
    };
  }
}

// ---------------------------------------------------------------------------
// runAllSignalAlerts — convenience runner for cron steps
//
// Returns all alert results. Callers should route fired alerts to Sentry:
//
//   import * as Sentry from "@sentry/node";
//   const results = await runAllSignalAlerts();
//   for (const r of results) {
//     if (r.fired) {
//       Sentry.captureMessage(`[${r.severity}] ${r.name}`, {
//         level: r.severity === "critical" ? "error" : r.severity === "warning" ? "warning" : "info",
//         extra: r.detail,
//       });
//     }
//   }
// ---------------------------------------------------------------------------

export async function runAllSignalAlerts(): Promise<AlertResult[]> {
  const checks = [
    checkComputeSignalsFailureRate(),
    checkActivationRate(),
    checkCorpusHitRate(),
    checkSignalStaleness(),
    checkPerSignalComputeTime(),
  ];

  const results = await Promise.allSettled(checks);
  return results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return {
      name: `alert.check.${i}`,
      fired: false,
      severity: "info" as AlertSeverity,
      detail: { error: r.reason instanceof Error ? r.reason.message : String(r.reason) },
    };
  });
}
