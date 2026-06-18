/**
 * processResearchQueue — durable queue-drain workflow
 *
 * Mirrors process-signal-queue.ts. Claims a small batch from
 * intel_research_queue (FOR UPDATE SKIP LOCKED) and for each claimed row
 * dispatches researchOperator via ctx.beginRpc().
 *
 * Batch size is intentionally small (default 5) because each research run
 * is expensive (multiple Anthropic calls). The schedule is commented out —
 * enabling it is a gated decision.
 *
 * Resonate rules:
 *   - ctx.beginRpc() MUST be called from the generator, never inside ctx.run()
 *   - Step IDs scoped by ISO-timestamp bucket for replay-safety
 *   - Per-step try/catch tolerance
 *   - Structured JSON logs only
 */

import type { Context } from "@resonatehq/sdk";
import {
  claimQueueBatch,
  reapStaleRunning,
  type ClaimedRow,
} from "../lib/data-sources-intel-queue";
import type { ResearchOperatorInput } from "./research-operator";
import { captureError } from "../lib/observability";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ResearchMode = "dry-run" | "live";

export interface ProcessResearchQueueInput {
  mode?: ResearchMode;
  batchSize?: number;
}

interface DrainResult {
  claimed: number;
  dispatched: number;
  failed: number;
  reaped: number;
}

// ---------------------------------------------------------------------------
// processResearchQueue — Resonate generator workflow
// ---------------------------------------------------------------------------

export function* processResearchQueue(
  ctx: Context,
  input: ProcessResearchQueueInput = {}
): Generator<any, DrainResult, any> {
  const { mode = "dry-run", batchSize = 5 } = input;

  // 5-minute bucket so replays within the same schedule fire reuse step IDs.
  const now = new Date();
  const bucketMin = Math.floor(now.getMinutes() / 5) * 5;
  const bucket = `${now.toISOString().split("T")[0]}.${String(now.getHours()).padStart(2, "0")}${String(bucketMin).padStart(2, "0")}`;

  const stepId = (suffix: string) =>
    `${bucket}.processResearchQueue.${suffix}`;

  // --- Step 1: Reap stuck 'running' rows (worker crashed mid-batch) ---
  const reaped: number = yield* ctx.run(
    async (): Promise<number> => {
      try {
        return await reapStaleRunning(30);
      } catch (e) {
        captureError(e, {
          workflow: "processResearchQueue",
          step: "reap",
          bucket,
        });
        return 0;
      }
    },
    (ctx as any).options({ id: stepId("reap") })
  );

  if (reaped > 0) {
    console.log(
      JSON.stringify({
        event: "processResearchQueue.reaped",
        count: reaped,
        bucket,
      })
    );
  }

  // --- Step 2: Claim a batch ---
  const batch: ClaimedRow[] = yield* ctx.run(
    async (): Promise<ClaimedRow[]> => {
      return claimQueueBatch(batchSize);
    },
    (ctx as any).options({ id: stepId("claim") })
  );

  const result: DrainResult = {
    claimed: batch.length,
    dispatched: 0,
    failed: 0,
    reaped,
  };

  if (batch.length === 0) {
    console.log(
      JSON.stringify({
        event: "processResearchQueue.empty",
        bucket,
        mode,
      })
    );
    return result;
  }

  // --- Step 3: Dispatch researchOperator for each claimed row via RPC ---
  for (const row of batch) {
    // Fold the attempt number into the RPC id + input so a re-claimed operator
    // (attempts incremented) dispatches a fresh run instead of replaying the
    // previous attempt's cached promise.
    const rpcId = stepId(`research.${row.operator_id}.a${row.attempts}`);
    const rpcInput: ResearchOperatorInput = {
      operatorId: row.operator_id,
      mode,
      attempt: row.attempts,
    };

    try {
      // ctx.beginRpc dispatches researchOperator as a durable RPC.
      // Called from the generator (not inside ctx.run) — yield* is required.
      // Function name first, workflow input second, options object last
      // (Resonate SDK positional arg order — options must be last).
      yield* ctx.beginRpc(
        "researchOperator",
        rpcInput,
        (ctx as any).options({ id: rpcId })
      );
      result.dispatched++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      captureError(e, {
        workflow: "processResearchQueue",
        step: "beginRpc",
        operatorId: row.operator_id,
        bucket,
      });
      console.log(
        JSON.stringify({
          event: "processResearchQueue.rpcFailed",
          operatorId: row.operator_id,
          error: msg,
          bucket,
        })
      );
      result.failed++;
    }
  }

  console.log(
    JSON.stringify({
      event: "processResearchQueue.complete",
      ...result,
      mode,
      bucket,
    })
  );

  return result;
}
