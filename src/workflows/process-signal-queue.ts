/**
 * processSignalQueue — outbox drain workflow
 *
 * Polls signals.signal_queue every 5 minutes, claims up to 50 rows
 * with FOR UPDATE SKIP LOCKED (safe for concurrent worker machines),
 * and for each claimed row dispatches activateSignalFragment via RPC.
 * Rows are deleted only after successful activation (Write-Last).
 * Entries older than 1 hour that are still unclaimed are dead-lettered
 * to snapshot_log with status='error'.
 *
 * Schedule: *\/5 * * * * (every 5 minutes UTC)
 *
 * Resonate rules:
 *  - ctx.run() step IDs scoped by timestamp bucket
 *  - UPSERT / ON CONFLICT for any persistent write
 *  - Per-step try/catch tolerance
 *  - Structured JSON logs only
 *  - ctx.beginRpc() MUST be called from the generator, not from inside
 *    ctx.run() — beginRpc() uses yield* and cannot appear in async fns
 */

import type { Context } from "@resonatehq/sdk";
import { getDb } from "../lib/db";
import { captureError } from "../lib/observability";
import type { ActivateSignalFragmentInput } from "./activate-signal-fragment";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QueueRow {
  id: string; // BIGSERIAL as string from pg
  series_id: string;
  geo_id: string;
  period: string;
  collected_at: string;
  claimed_at: string | null;
}

interface SignalDefForQueue {
  id: string;
  slug: string;
  signal_type: string;
}

interface ClaimedBatch {
  rows: QueueRow[];
  deadLettered: number;
}

interface DrainResult {
  claimed: number;
  activated: number;
  failed: number;
  deadLettered: number;
}

// ---------------------------------------------------------------------------
// Claim batch + dead-letter stuck rows (pure async DB work, no Resonate RPC)
// ---------------------------------------------------------------------------

async function claimBatch(bucket: string): Promise<ClaimedBatch> {
  const pool = await getDb();

  // Claim up to 50 rows atomically.
  const { rows } = await pool.query<QueueRow>(`
    UPDATE signals.signal_queue
    SET claimed_at = NOW()
    WHERE id IN (
      SELECT id FROM signals.signal_queue
      WHERE claimed_at IS NULL
        AND processed_at IS NULL
      ORDER BY collected_at ASC
      LIMIT 50
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, series_id, geo_id, period::TEXT, collected_at, claimed_at
  `);

  // Dead-letter rows stuck > 1 hour unclaimed.
  const { rowCount: dlCount } = await pool.query(`
    UPDATE signals.signal_queue
    SET processed_at = NOW()
    WHERE claimed_at IS NULL
      AND processed_at IS NULL
      AND collected_at < NOW() - INTERVAL '1 hour'
  `);

  const deadLettered = dlCount ?? 0;

  if (deadLettered > 0) {
    await pool.query(
      `INSERT INTO snapshot_log (taken_at, source, records_inserted, status, error)
       VALUES (NOW(), $1, $2, 'error', $3)`,
      [
        "processSignalQueue.deadLetter",
        deadLettered,
        `${deadLettered} signal_queue entries exceeded 1h without claim; dead-lettered`,
      ]
    );
    console.log(JSON.stringify({
      event: "processSignalQueue.deadLetter",
      count: deadLettered,
      bucket,
    }));
  }

  return { rows, deadLettered };
}

/**
 * Look up which signal definitions depend on a series_id.
 */
async function getDefsForSeries(seriesId: string): Promise<SignalDefForQueue[]> {
  const pool = await getDb();
  const { rows } = await pool.query<SignalDefForQueue>(`
    SELECT id, slug, signal_type
    FROM signals.signal_definitions
    WHERE active = TRUE
      AND $1 = ANY(series_scope)
    ORDER BY priority ASC
  `, [seriesId]);
  return rows;
}

/**
 * Mark a queue row as processed after successful RPC dispatch.
 */
async function markProcessed(rowId: string): Promise<void> {
  const pool = await getDb();
  await pool.query(
    `UPDATE signals.signal_queue SET processed_at = NOW() WHERE id = $1`,
    [rowId]
  );
}

// ---------------------------------------------------------------------------
// processSignalQueue — Resonate generator workflow
// ---------------------------------------------------------------------------

export function* processSignalQueue(
  ctx: Context
): Generator<any, DrainResult, any> {
  // Use a 5-minute bucket so replays within the same schedule fire reuse the
  // same step ID and don't double-drain.
  const now = new Date();
  const bucketMin = Math.floor(now.getMinutes() / 5) * 5;
  const bucket = `${now.toISOString().split("T")[0]}.${String(now.getHours()).padStart(2, "0")}${String(bucketMin).padStart(2, "0")}`;

  const stepId = (suffix: string) => `${bucket}.processSignalQueue.${suffix}`;

  // --- Step 1: Claim a batch of queue rows ---
  const batch: ClaimedBatch = yield* ctx.run(
    async (): Promise<ClaimedBatch> => {
      return claimBatch(bucket);
    },
    (ctx as any).options({ id: stepId("claim") })
  );

  const result: DrainResult = {
    claimed: batch.rows.length,
    activated: 0,
    failed: 0,
    deadLettered: batch.deadLettered,
  };

  // --- Step 2: For each claimed row, look up defs + dispatch RPC ---
  for (const row of batch.rows) {
    let defsForRow: SignalDefForQueue[] = [];

    try {
      defsForRow = yield* ctx.run(
        async (): Promise<SignalDefForQueue[]> => {
          return getDefsForSeries(row.series_id);
        },
        (ctx as any).options({ id: stepId(`defs.${row.id}`) })
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      captureError(e, { workflow: "processSignalQueue", step: "loadDefs", rowId: row.id });
      console.log(JSON.stringify({
        event: "processSignalQueue.loadDefsFailed",
        rowId: row.id,
        error: msg,
        bucket,
      }));
      result.failed++;
      continue;
    }

    if (defsForRow.length === 0) {
      // No signal definition references this series — mark processed and move on.
      try {
        yield* ctx.run(
          async (): Promise<void> => { await markProcessed(row.id); },
          (ctx as any).options({ id: stepId(`skip.${row.id}`) })
        );
      } catch {
        // non-fatal
      }
      result.activated++;
      continue;
    }

    let rowFailed = false;

    for (const def of defsForRow) {
      const rpcId = stepId(`activate.${row.id}.${def.id}`);
      const input: ActivateSignalFragmentInput = {
        signalDefId: def.id,
        signalSlug: def.slug,
        seriesId: row.series_id,
        geoId: row.geo_id,
        period: row.period,
        queueRowId: row.id,
      };

      try {
        // ctx.beginRpc dispatches activateSignalFragment as a durable RPC.
        // id is the FIRST positional argument per the Resonate SDK contract.
        yield* ctx.beginRpc(
          rpcId,
          "activateSignalFragment",
          [input],
          (ctx as any).options({ id: rpcId })
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        captureError(e, { workflow: "processSignalQueue", step: "beginRpc", rowId: row.id, defSlug: def.slug });
        console.log(JSON.stringify({
          event: "processSignalQueue.rpcFailed",
          rowId: row.id,
          defSlug: def.slug,
          error: msg,
          bucket,
        }));
        rowFailed = true;
      }
    }

    if (!rowFailed) {
      // Mark processed only after all RPCs dispatched without error.
      try {
        yield* ctx.run(
          async (): Promise<void> => { await markProcessed(row.id); },
          (ctx as any).options({ id: stepId(`mark.${row.id}`) })
        );
        result.activated++;
      } catch (e) {
        captureError(e, { workflow: "processSignalQueue", step: "markProcessed", rowId: row.id });
        result.failed++;
      }
    } else {
      // Leave the row claimed but unprocessed — retry on next fire.
      // Dead-letter window (1h) will catch truly stuck rows.
      result.failed++;
    }
  }

  console.log(JSON.stringify({
    event: "processSignalQueue.complete",
    workflowId: stepId("root"),
    claimed: result.claimed,
    activated: result.activated,
    failed: result.failed,
    deadLettered: result.deadLettered,
    bucket,
  }));

  return result;
}
