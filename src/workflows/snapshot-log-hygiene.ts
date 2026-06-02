/**
 * Snapshot-log hygiene: zombie cleanup (#28) and retention enforcement (#29).
 *
 * Zombie cleanup (#28):
 *   Marks `running` rows older than 2 hours (by taken_at) as `stale`.
 *   A `stale` status lets monitoring distinguish an abandoned run from an
 *   in-flight one without losing the original row for post-mortem queries.
 *
 * Retention (#29):
 *   Hard-deletes rows past their retention window:
 *     - `ok`    rows older than 90 days
 *     - `error` rows older than 365 days  (kept longer for post-mortem)
 *     - `stale` rows older than 90 days   (zombie tombstones, low value)
 *   No daily rollup is written before deletion — snapshot_log is an
 *   operational log, not a fact store, so hard-delete is correct here.
 *
 * This workflow is folded into the monthly partition-rollover schedule so
 * it runs once a month (1st, 08:30 UTC — after the daily fires, before
 * the nightly matview refresh at 09:30 UTC).
 */

import { type Context } from "@resonatehq/sdk";
import { getDb } from "../lib/db";

interface HygieneResult {
  zombiesMarkedStale: number;
  okRowsDeleted: number;
  errorRowsDeleted: number;
  staleRowsDeleted: number;
}

const ZOMBIE_THRESHOLD_HOURS = 2;
const OK_RETENTION_DAYS = 90;
const ERROR_RETENTION_DAYS = 365;
const STALE_RETENTION_DAYS = 90;

/**
 * Step 1 (zombie sweep): update running rows whose taken_at is older than
 * ZOMBIE_THRESHOLD_HOURS with no terminal status to `stale`.
 */
async function markZombieRows(pool: import("pg").Pool): Promise<number> {
  const { rowCount } = await pool.query(`
    UPDATE snapshot_log
       SET status = 'stale',
           error  = COALESCE(error, '') ||
                    format(' [auto-staled: running > %s hours with no terminal status]',
                           $1::int)
     WHERE status = 'running'
       AND taken_at < NOW() - make_interval(hours => $1)
  `, [ZOMBIE_THRESHOLD_HOURS]);
  return rowCount ?? 0;
}

/**
 * Step 2 (retention): hard-delete rows past their window by status bucket.
 */
async function enforceRetention(pool: import("pg").Pool): Promise<{
  okDeleted: number;
  errorDeleted: number;
  staleDeleted: number;
}> {
  const okRes = await pool.query(`
    DELETE FROM snapshot_log
     WHERE status = 'ok'
       AND taken_at < NOW() - make_interval(days => $1)
  `, [OK_RETENTION_DAYS]);

  const errorRes = await pool.query(`
    DELETE FROM snapshot_log
     WHERE status = 'error'
       AND taken_at < NOW() - make_interval(days => $1)
  `, [ERROR_RETENTION_DAYS]);

  const staleRes = await pool.query(`
    DELETE FROM snapshot_log
     WHERE status = 'stale'
       AND taken_at < NOW() - make_interval(days => $1)
  `, [STALE_RETENTION_DAYS]);

  return {
    okDeleted: okRes.rowCount ?? 0,
    errorDeleted: errorRes.rowCount ?? 0,
    staleDeleted: staleRes.rowCount ?? 0,
  };
}

/**
 * Durable workflow: zombie sweep then retention enforcement.
 * Two separate ctx.run steps so that a crash between them doesn't re-run
 * the zombie sweep (which is idempotent but logs better if separated).
 */
export function* snapshotLogHygiene(
  ctx: Context
): Generator<any, HygieneResult, any> {
  const today = new Date().toISOString().split("T")[0];

  const zombiesMarkedStale: number = yield* ctx.run(
    async () => {
      const pool = await getDb();
      const count = await markZombieRows(pool);
      console.log(
        JSON.stringify({
          level: "info",
          event: "snapshot_log_hygiene.zombie_sweep",
          marked_stale: count,
          threshold_hours: ZOMBIE_THRESHOLD_HOURS,
          run_date: today,
        })
      );
      return count;
    },
    (ctx as any).options({ id: `${today}.snapshot-log-zombie-sweep` })
  );

  const retention: { okDeleted: number; errorDeleted: number; staleDeleted: number } =
    yield* ctx.run(
      async () => {
        const pool = await getDb();
        const counts = await enforceRetention(pool);
        console.log(
          JSON.stringify({
            level: "info",
            event: "snapshot_log_hygiene.retention",
            ok_deleted: counts.okDeleted,
            error_deleted: counts.errorDeleted,
            stale_deleted: counts.staleDeleted,
            ok_retention_days: OK_RETENTION_DAYS,
            error_retention_days: ERROR_RETENTION_DAYS,
            run_date: today,
          })
        );
        return counts;
      },
      (ctx as any).options({ id: `${today}.snapshot-log-retention` })
    );

  return {
    zombiesMarkedStale,
    okRowsDeleted: retention.okDeleted,
    errorRowsDeleted: retention.errorDeleted,
    staleRowsDeleted: retention.staleDeleted,
  };
}
