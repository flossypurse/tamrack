/**
 * Nightly materialized-view refresh for substrate.latest_observations.
 *
 * substrate.refresh_latest_observations() is advisory-locked and returns
 * FALSE if a refresh is already in flight, so it's safe to fire
 * unconditionally after the daily collection crons complete.
 *
 * Schedule: after the 06:00 daily-collection cron and the 08:00 cron
 * window — 09:30 UTC avoids collision with those fires.
 */

import { type Context } from "@resonatehq/sdk";
import { getDb } from "../lib/db";

interface RefreshResult {
  refreshed: boolean;
  skippedAlreadyRunning: boolean;
  durationMs: number;
}

/**
 * Durable workflow: call substrate.refresh_latest_observations() and
 * record the outcome. The function returns TRUE if the refresh ran and
 * FALSE if it was skipped because another session holds the advisory lock.
 */
export function* refreshLatestObservations(
  ctx: Context
): Generator<any, RefreshResult, any> {
  const today = new Date().toISOString().split("T")[0];

  const result: RefreshResult = yield* ctx.run(
    async (): Promise<RefreshResult> => {
      const pool = await getDb();
      const start = Date.now();

      const { rows } = await pool.query<{ refreshed: boolean }>(`
        SELECT substrate.refresh_latest_observations() AS refreshed
      `);

      const refreshed = rows[0]?.refreshed ?? false;
      const durationMs = Date.now() - start;
      const skipped = !refreshed;

      if (skipped) {
        console.log(
          JSON.stringify({
            level: "warn",
            event: "matview_refresh.skipped",
            reason: "advisory_lock_held",
            duration_ms: durationMs,
            run_date: today,
          })
        );
      } else {
        console.log(
          JSON.stringify({
            level: "info",
            event: "matview_refresh.ok",
            duration_ms: durationMs,
            run_date: today,
          })
        );
      }

      return { refreshed, skippedAlreadyRunning: skipped, durationMs };
    },
    (ctx as any).options({ id: `${today}.refresh-latest-observations` })
  );

  return result;
}
