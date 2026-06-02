/**
 * Monthly partition rollover for substrate.observations.
 *
 * Pre-creates the +12-month forward partition so the leading edge of the
 * sliding window stays ahead of incoming rows. Idempotent via
 * CREATE TABLE IF NOT EXISTS, so safe to re-run.
 *
 * Also checks for rows that landed in the DEFAULT partition and logs a
 * warning — that indicates either a typo'd period date or a missed rollover.
 */

import { type Context } from "@resonatehq/sdk";
import { getDb } from "../lib/db";

interface RolloverResult {
  partition: string;
  defaultCount: number;
  defaultWarning: boolean;
}

/**
 * Durable workflow: add the +12-month partition if it doesn't exist,
 * then alert if anything has accumulated in observations_default.
 */
export function* rolloverSubstratePartitions(
  ctx: Context
): Generator<any, RolloverResult, any> {
  const today = new Date().toISOString().split("T")[0];

  const result: RolloverResult = yield* ctx.run(
    async (): Promise<RolloverResult> => {
      const pool = await getDb();

      // Pre-create the partition that will be needed 12 months from now.
      // Using a DO block keeps the logic inside the DB so timezone handling
      // is consistent with Postgres CURRENT_DATE rather than Node's clock.
      await pool.query(`
        DO $obs_rollover$
        DECLARE
          v_start DATE;
          v_end   DATE;
          v_name  TEXT;
        BEGIN
          v_start := (date_trunc('month', CURRENT_DATE) + INTERVAL '12 months')::date;
          v_end   := (v_start + INTERVAL '1 month')::date;
          v_name  := format('observations_%s', to_char(v_start, 'YYYY_MM'));
          EXECUTE format(
            'CREATE TABLE IF NOT EXISTS substrate.%I PARTITION OF substrate.observations
               FOR VALUES FROM (%L) TO (%L)',
            v_name, v_start, v_end
          );
        END $obs_rollover$;
      `);

      // Compute the partition name we just created (for the result record).
      const nameResult = await pool.query<{ name: string }>(`
        SELECT format(
          'observations_%s',
          to_char(date_trunc('month', CURRENT_DATE) + INTERVAL '12 months', 'YYYY_MM')
        ) AS name
      `);
      const partitionName = nameResult.rows[0]?.name ?? "unknown";

      // Check whether any rows landed in the DEFAULT partition.
      // A non-zero count means either a typo'd period or the rollover cron
      // fell behind. Log it clearly so alerting tools can pick it up.
      const defaultResult = await pool.query<{ cnt: string }>(`
        SELECT count(*)::text AS cnt FROM ONLY substrate.observations_default
      `);
      const defaultCount = parseInt(defaultResult.rows[0]?.cnt ?? "0", 10);

      if (defaultCount > 0) {
        console.error(
          JSON.stringify({
            level: "error",
            event: "partition_rollover.default_overflow",
            default_count: defaultCount,
            message:
              "Rows found in substrate.observations_default — check for typo'd period dates or a missed rollover",
            run_date: today,
          })
        );
      } else {
        console.log(
          JSON.stringify({
            level: "info",
            event: "partition_rollover.ok",
            partition: partitionName,
            default_count: 0,
            run_date: today,
          })
        );
      }

      return {
        partition: partitionName,
        defaultCount,
        defaultWarning: defaultCount > 0,
      };
    },
    (ctx as any).options({ id: `${today}.partition-rollover` })
  );

  return result;
}
