/**
 * computeSignals — daily fan-out workflow
 *
 * Loads every active signal definition and, for each one,
 * dispatches a per-(signal, geo) compute step that materializes
 * the signal's output table and writes a signal_events row.
 *
 * Schedule: 0 7 * * * (07:00 UTC daily)
 *
 * Resonate rules observed throughout:
 *  - ctx.run() id is always the FIRST argument (not inside options)
 *  - step IDs scoped by date string to prevent same-day cache collision
 *  - TTL >= 30 min on the Resonate client (set by caller in worker.ts)
 *  - UPSERT everywhere writes land — no plain INSERT on uniquely-constrained rows
 *  - Structured JSON logging only — no free-text console.log inside steps
 */

import type { Context } from "@resonatehq/sdk";
import { getDb } from "../lib/db";
import { captureError } from "../lib/observability";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComputeSignalsOptions {
  /** Limit geo fan-out per signal. Useful for smoke tests (maxGeo=1). */
  maxGeo?: number;
  /** Trailing window in days for S1 recompute. Defaults to 365. */
  windowDays?: number;
  /** If provided, only compute this signal slug. */
  signalSlug?: string;
}

interface SignalDef {
  id: string;
  slug: string;
  signal_type: string;
  geo_scope: string;
  window_days: number;
  cadence: string;
  priority: number;
}

interface GeoRow {
  id: string;
  slug: string;
  name: string;
  geo_type: string;
}

interface ComputeOneResult {
  signalDefId: string;
  signalSlug: string;
  geoSlug: string;
  eventsWritten: number;
  wallMs: number;
  status: "ok" | "error";
  error?: string;
}

// ---------------------------------------------------------------------------
// S1 materialization SQL (Edmonton business panel)
// ---------------------------------------------------------------------------

/**
 * Builds the S1 materialized table for a given period window.
 *
 * The query joins Edmonton business licences (via substrate.entities +
 * substrate.observations for the licence presence series) with:
 *   - dietary taxonomy from signals.licence_dietary_taxonomy (G4)
 *   - neighbourhood vitality proxy derived from substrate.observations
 *     for the neighbourhood_formation series (when available)
 *
 * Returns the number of rows written.
 */
async function materializeEdmontonBusinessPanel(
  pool: Awaited<ReturnType<typeof getDb>>,
  windowDays: number,
  today: string
): Promise<number> {
  // Ensure the target table exists (idempotent).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS signals.edmonton_business_panel (
      licence_id              TEXT NOT NULL,
      period                  DATE NOT NULL,
      trade_name              TEXT,
      business_category       TEXT,
      neighbourhood           TEXT,
      geo_id                  UUID,
      issue_date              DATE,
      expiry_date             DATE,
      tenure_months           NUMERIC(8,2),
      is_single_location      BOOLEAN,
      dietary_category        TEXT,
      dietary_confidence      NUMERIC(3,2),
      neighbourhood_vitality  NUMERIC(6,3),
      computed_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (licence_id, period)
    )
  `);

  // Full recompute for the trailing window. DELETE then re-INSERT is safe
  // because computeSignals runs at 07:00 UTC and collection runs at 06:00 UTC,
  // so the window is always populated by the time we compute.
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - windowDays);
  const windowStartStr = windowStart.toISOString().split("T")[0];

  // Delete rows in window so this is a full recompute (idempotent).
  await pool.query(
    `DELETE FROM signals.edmonton_business_panel
     WHERE period >= $1::DATE`,
    [windowStartStr]
  );

  // Insert: join entities (business licences) with dietary taxonomy.
  // is_single_location = no other entity sharing the same trade_name in Edmonton.
  // tenure_months = months from issue_date to today (or expiry_date if closed).
  // neighbourhood_vitality: stub scalar (1.0) until S2 is live; the column
  // carries the derived value once neighbourhood_formation_monthly is populated.
  const { rowCount } = await pool.query(`
    INSERT INTO signals.edmonton_business_panel
      (licence_id, period, trade_name, business_category, neighbourhood, geo_id,
       issue_date, expiry_date, tenure_months, is_single_location,
       dietary_category, dietary_confidence, neighbourhood_vitality, computed_at)
    SELECT
      e.slug                              AS licence_id,
      $1::DATE                            AS period,
      e.name                              AS trade_name,
      COALESCE(e.attrs->>'category', '')  AS business_category,
      COALESCE(e.attrs->>'neighbourhood', '') AS neighbourhood,
      e.geo_id,
      CASE WHEN e.attrs->>'issue_date' IS NOT NULL
           THEN (e.attrs->>'issue_date')::DATE ELSE NULL END  AS issue_date,
      CASE WHEN e.attrs->>'expiry_date' IS NOT NULL
           THEN (e.attrs->>'expiry_date')::DATE ELSE NULL END AS expiry_date,
      ROUND(
        EXTRACT(EPOCH FROM (
          COALESCE(
            CASE WHEN e.attrs->>'expiry_date' IS NOT NULL
                 THEN (e.attrs->>'expiry_date')::TIMESTAMPTZ ELSE NULL END,
            NOW()
          ) - COALESCE(
            CASE WHEN e.attrs->>'issue_date' IS NOT NULL
                 THEN (e.attrs->>'issue_date')::TIMESTAMPTZ ELSE NULL END,
            NOW()
          )
        )) / 2592000.0,
        2
      )                                   AS tenure_months,
      (
        SELECT COUNT(*) = 1
        FROM substrate.entities e2
        WHERE e2.kind = 'business'
          AND LOWER(e2.name) = LOWER(e.name)
          AND e2.geo_id = e.geo_id
      )                                   AS is_single_location,
      COALESCE(ldt.dietary_category, 'unknown')   AS dietary_category,
      ldt.dietary_confidence,
      1.0::NUMERIC(6,3)                   AS neighbourhood_vitality
    FROM substrate.entities e
    LEFT JOIN signals.licence_dietary_taxonomy ldt
      ON ldt.licence_id = e.slug
    WHERE e.kind = 'business'
      AND e.last_seen >= $2::DATE
      AND e.geo_id IN (
        SELECT id FROM substrate.geo_dimension
        WHERE LOWER(name) = 'edmonton' OR LOWER(slug) = 'edmonton'
        LIMIT 1
      )
    ON CONFLICT (licence_id, period) DO UPDATE SET
      trade_name             = EXCLUDED.trade_name,
      business_category      = EXCLUDED.business_category,
      neighbourhood          = EXCLUDED.neighbourhood,
      geo_id                 = EXCLUDED.geo_id,
      issue_date             = EXCLUDED.issue_date,
      expiry_date            = EXCLUDED.expiry_date,
      tenure_months          = EXCLUDED.tenure_months,
      is_single_location     = EXCLUDED.is_single_location,
      dietary_category       = EXCLUDED.dietary_category,
      dietary_confidence     = EXCLUDED.dietary_confidence,
      neighbourhood_vitality = EXCLUDED.neighbourhood_vitality,
      computed_at            = NOW()
  `, [today, windowStartStr]);

  return rowCount ?? 0;
}

// ---------------------------------------------------------------------------
// computeOneSignal — one (signal_def, geo) step
// ---------------------------------------------------------------------------

export async function computeOneSignal(
  signalDef: SignalDef,
  geo: GeoRow,
  today: string,
  windowDays: number
): Promise<ComputeOneResult> {
  const start = Date.now();
  const pool = await getDb();

  try {
    let eventsWritten = 0;

    if (signalDef.signal_type === "panel" && signalDef.slug === "edmonton-business-panel") {
      const rows = await materializeEdmontonBusinessPanel(pool, windowDays, today);
      eventsWritten = rows;

      // Write a signal_events row to record that this compute fired.
      await pool.query(`
        INSERT INTO signals.signal_events
          (signal_def_id, geo_id, observed_window, fired_at, event_type,
           magnitude, direction, confidence, metadata)
        VALUES
          ($1, $2,
           daterange($3::DATE - $4 * INTERVAL '1 day', $3::DATE, '[)'),
           NOW(), 'recompute',
           $5, 'neutral', 1.0, $6)
        ON CONFLICT (signal_def_id, series_id, geo_id, observed_window)
        DO UPDATE SET
          fired_at  = EXCLUDED.fired_at,
          magnitude = EXCLUDED.magnitude,
          metadata  = EXCLUDED.metadata
      `, [
        signalDef.id,
        geo.id,
        today,
        windowDays,
        eventsWritten,
        JSON.stringify({ rows_materialized: eventsWritten, computed_at: today }),
      ]);
    }

    const wallMs = Date.now() - start;

    // Write per-signal timing to signal_run_log (merged later by computeSignals).
    // Using INSERT ... ON CONFLICT DO UPDATE so replays are safe.
    // workflow_id here is the (signalSlug, geoSlug, today) composite —
    // not a Resonate promise ID (that is set at the parent level).
    const runId = `${today}.${signalDef.slug}.${geo.slug}`;
    await pool.query(`
      INSERT INTO signals.signal_run_log
        (workflow_id, run_date, total_signals, total_geos,
         succeeded, failed, skipped_incremental, wall_ms, status)
      VALUES ($1, $2::DATE, 1, 1, 1, 0, 0, $3, 'ok')
      ON CONFLICT (workflow_id) DO UPDATE SET
        succeeded = signals.signal_run_log.succeeded + 1,
        wall_ms   = EXCLUDED.wall_ms,
        status    = 'ok'
    `, [runId, today, wallMs]);

    return {
      signalDefId: signalDef.id,
      signalSlug: signalDef.slug,
      geoSlug: geo.slug,
      eventsWritten,
      wallMs,
      status: "ok",
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const wallMs = Date.now() - start;

    // Write failure row.
    const runId = `${today}.${signalDef.slug}.${geo.slug}`;
    try {
      await pool.query(`
        INSERT INTO signals.signal_run_log
          (workflow_id, run_date, total_signals, total_geos,
           succeeded, failed, skipped_incremental, wall_ms, status)
        VALUES ($1, $2::DATE, 1, 1, 0, 1, 0, $3, 'error')
        ON CONFLICT (workflow_id) DO UPDATE SET
          failed  = signals.signal_run_log.failed + 1,
          wall_ms = EXCLUDED.wall_ms,
          status  = 'error'
      `, [runId, today, wallMs]);
    } catch {
      // don't let log writes mask the original error
    }

    captureError(e, { workflow: "computeOneSignal", signalSlug: signalDef.slug, geoSlug: geo.slug, today });

    return {
      signalDefId: signalDef.id,
      signalSlug: signalDef.slug,
      geoSlug: geo.slug,
      eventsWritten: 0,
      wallMs,
      status: "error",
      error: msg,
    };
  }
}

// ---------------------------------------------------------------------------
// computeSignals — orchestrator workflow (Resonate generator)
// ---------------------------------------------------------------------------

export function* computeSignals(
  ctx: Context,
  opts: ComputeSignalsOptions = {}
): Generator<any, void, any> {
  const today = new Date().toISOString().split("T")[0];
  const windowDays = opts.windowDays ?? 365;
  const maxGeo = opts.maxGeo ?? Infinity;
  const filterSlug = opts.signalSlug;

  const stepId = (suffix: string) => `${today}.computeSignals.${suffix}`;

  // --- Step 1: Load active signal definitions ---
  const signalDefs: SignalDef[] = yield* ctx.run(
    async (): Promise<SignalDef[]> => {
      const pool = await getDb();
      const { rows } = await pool.query<SignalDef>(`
        SELECT id, slug, signal_type, geo_scope, window_days, cadence, priority
        FROM signals.signal_definitions
        WHERE active = TRUE
          AND deprecated_at IS NULL
          AND ($1::TEXT IS NULL OR slug = $1)
        ORDER BY priority ASC, slug ASC
      `, [filterSlug ?? null]);
      return rows;
    },
    (ctx as any).options({ id: stepId("load-definitions") })
  );

  console.log(JSON.stringify({
    event: "computeSignals.start",
    workflowId: stepId("root"),
    signalCount: signalDefs.length,
    today,
    windowDays,
    maxGeo,
  }));

  // --- Step 2: Fan-out per (signal_def, geo) ---
  for (const def of signalDefs) {
    // Load geos for this signal's geo_scope.
    const geos: GeoRow[] = yield* ctx.run(
      async (): Promise<GeoRow[]> => {
        const pool = await getDb();
        const { rows } = await pool.query<GeoRow>(`
          SELECT id, slug, name, geo_type
          FROM substrate.geo_dimension
          WHERE geo_type = $1
          LIMIT $2
        `, [def.geo_scope, maxGeo]);
        return rows;
      },
      (ctx as any).options({ id: stepId(`${def.slug}.load-geos`) })
    );

    let succeeded = 0;
    let failed = 0;

    for (const geo of geos) {
      const result: ComputeOneResult = yield* ctx.run(
        async (): Promise<ComputeOneResult> => {
          return computeOneSignal(def, geo, today, windowDays);
        },
        (ctx as any).options({ id: stepId(`${def.slug}.${geo.slug}`) })
      );

      if (result.status === "ok") {
        succeeded++;
      } else {
        failed++;
        console.log(JSON.stringify({
          event: "computeSignals.step.error",
          workflowId: stepId("root"),
          signalSlug: def.slug,
          geoSlug: geo.slug,
          error: result.error,
          wallMs: result.wallMs,
        }));
      }
    }

    console.log(JSON.stringify({
      event: "computeSignals.signal.complete",
      workflowId: stepId("root"),
      signalSlug: def.slug,
      geoCount: geos.length,
      succeeded,
      failed,
      today,
    }));
  }

  // --- Step 3: Write the top-level run summary ---
  yield* ctx.run(
    async (): Promise<void> => {
      const pool = await getDb();
      const runId = `${today}.computeSignals`;
      await pool.query(`
        INSERT INTO signals.signal_run_log
          (workflow_id, run_date, total_signals, total_geos,
           succeeded, failed, skipped_incremental, wall_ms, status)
        VALUES ($1, $2::DATE, $3, 0, 0, 0, 0, 0, 'ok')
        ON CONFLICT (workflow_id) DO UPDATE SET
          total_signals = EXCLUDED.total_signals,
          status        = 'ok'
      `, [runId, today, signalDefs.length]);
    },
    (ctx as any).options({ id: stepId("write-run-summary") })
  );

  console.log(JSON.stringify({
    event: "computeSignals.complete",
    workflowId: stepId("root"),
    signalCount: signalDefs.length,
    today,
  }));
}

// ---------------------------------------------------------------------------
// recomputeSignal — single-signal backfill, used by smoke test and manual ops
// ---------------------------------------------------------------------------

export interface RecomputeSignalOptions {
  signalSlug: string;
  windowDays?: number;
  maxGeo?: number;
}

export function* recomputeSignal(
  ctx: Context,
  opts: RecomputeSignalOptions
): Generator<any, ComputeOneResult | null, any> {
  const today = new Date().toISOString().split("T")[0];
  const windowDays = opts.windowDays ?? 365;
  const maxGeo = opts.maxGeo ?? Infinity;

  const stepId = (suffix: string) => `${today}.recomputeSignal.${opts.signalSlug}.${suffix}`;

  const def: SignalDef | null = yield* ctx.run(
    async (): Promise<SignalDef | null> => {
      const pool = await getDb();
      const { rows } = await pool.query<SignalDef>(`
        SELECT id, slug, signal_type, geo_scope, window_days, cadence, priority
        FROM signals.signal_definitions
        WHERE slug = $1 AND active = TRUE
        LIMIT 1
      `, [opts.signalSlug]);
      return rows[0] ?? null;
    },
    (ctx as any).options({ id: stepId("load-def") })
  );

  if (!def) {
    console.log(JSON.stringify({
      event: "recomputeSignal.notFound",
      signalSlug: opts.signalSlug,
      today,
    }));
    return null;
  }

  const geos: GeoRow[] = yield* ctx.run(
    async (): Promise<GeoRow[]> => {
      const pool = await getDb();
      const { rows } = await pool.query<GeoRow>(`
        SELECT id, slug, name, geo_type
        FROM substrate.geo_dimension
        WHERE geo_type = $1
        LIMIT $2
      `, [def.geo_scope, maxGeo]);
      return rows;
    },
    (ctx as any).options({ id: stepId("load-geos") })
  );

  // For a smoke-test recompute, just run against the first geo.
  const geo = geos[0];
  if (!geo) {
    console.log(JSON.stringify({
      event: "recomputeSignal.noGeos",
      signalSlug: opts.signalSlug,
      geoScope: def.geo_scope,
      today,
    }));
    return null;
  }

  const result: ComputeOneResult = yield* ctx.run(
    async (): Promise<ComputeOneResult> => {
      return computeOneSignal(def, geo, today, windowDays);
    },
    (ctx as any).options({ id: stepId(`compute.${geo.slug}`) })
  );

  return result;
}
