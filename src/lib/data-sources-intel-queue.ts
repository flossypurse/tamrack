/**
 * Research queue substrate.
 *
 * `intel_research_queue` is the control plane the research worker drains.
 * Claim semantics use `FOR UPDATE SKIP LOCKED` so multiple workers can run
 * safely (only one runs today, but the lock keeps restart-safety free).
 *
 * Status lifecycle:
 *   pending -> running (claim) -> done (success) | failed (giving up)
 * A failed row with attempts < max can be reset to pending and retried.
 */
import { getDb } from "./db";

export type QueueStatus = "pending" | "running" | "done" | "failed";

export interface QueueRow {
  operator_id: string;
  priority: number;
  status: QueueStatus;
  attempts: number;
  last_error: string | null;
  enqueued_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface EnqueueInput {
  operator_id: string;
  priority?: number;
}

export async function enqueueOperator(input: EnqueueInput): Promise<QueueRow> {
  const pool = await getDb();
  const { rows } = await pool.query<QueueRow>(
    `INSERT INTO intel_research_queue (operator_id, priority)
     VALUES ($1, $2)
     ON CONFLICT (operator_id) DO UPDATE SET
       priority = LEAST(intel_research_queue.priority, EXCLUDED.priority),
       status = CASE
         WHEN intel_research_queue.status IN ('failed','done')
              AND intel_research_queue.attempts < 3
           THEN 'pending'
         ELSE intel_research_queue.status
       END
     RETURNING operator_id, priority, status, attempts, last_error,
               enqueued_at, started_at, completed_at`,
    [input.operator_id, input.priority ?? 100],
  );
  return rows[0];
}

export interface ClaimedRow {
  operator_id: string;
  attempts: number;
  priority: number;
}

/**
 * Claim up to `limit` pending rows. Uses FOR UPDATE SKIP LOCKED so concurrent
 * workers don't collide. Failed rows with attempts < `max_attempts` are
 * reclaimable.
 */
export async function claimQueueBatch(
  limit: number,
  max_attempts: number = 3,
): Promise<ClaimedRow[]> {
  const pool = await getDb();
  const { rows } = await pool.query<ClaimedRow>(
    `WITH claimed AS (
       SELECT operator_id
         FROM intel_research_queue
        WHERE (status = 'pending')
           OR (status = 'failed' AND attempts < $2)
        ORDER BY priority ASC, enqueued_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
     )
     UPDATE intel_research_queue q
        SET status = 'running',
            started_at = NOW(),
            attempts = q.attempts + 1
       FROM claimed
      WHERE q.operator_id = claimed.operator_id
      RETURNING q.operator_id, q.attempts, q.priority`,
    [limit, max_attempts],
  );
  return rows;
}

export async function markQueueDone(operatorId: string): Promise<void> {
  const pool = await getDb();
  await pool.query(
    `UPDATE intel_research_queue
        SET status = 'done', completed_at = NOW(), last_error = NULL
      WHERE operator_id = $1`,
    [operatorId],
  );
}

export async function markQueueFailed(operatorId: string, error: string): Promise<void> {
  const pool = await getDb();
  await pool.query(
    `UPDATE intel_research_queue
        SET status = 'failed', completed_at = NOW(), last_error = $2
      WHERE operator_id = $1`,
    [operatorId, error.slice(0, 4000)],
  );
}

/**
 * Reap rows stuck in 'running' for too long (worker crashed mid-batch).
 * Increments `attempts` so a crash consumes retry budget, then returns the row
 * to 'pending' for re-claim — UNLESS it has now hit `maxAttempts`, in which
 * case it is dead-lettered to 'failed'. Without the attempt bump + cap, a row
 * that crashes the worker every run would cycle forever, burning paid research
 * calls (claimQueueBatch claims any 'pending' row regardless of attempts).
 */
export async function reapStaleRunning(
  maxRunningMinutes: number = 30,
  maxAttempts: number = 3,
): Promise<number> {
  const pool = await getDb();
  const { rowCount } = await pool.query(
    `UPDATE intel_research_queue
        SET attempts = attempts + 1,
            started_at = NULL,
            status = CASE WHEN attempts + 1 >= $2 THEN 'failed' ELSE 'pending' END,
            last_error = CASE WHEN attempts + 1 >= $2
                              THEN 'reaped: exceeded max attempts while stuck in running'
                              ELSE last_error END
      WHERE status = 'running'
        AND started_at < NOW() - ($1 || ' minutes')::interval`,
    [String(maxRunningMinutes), maxAttempts],
  );
  return rowCount ?? 0;
}

export interface QueueStats {
  pending: number;
  running: number;
  done: number;
  failed: number;
}

export async function getQueueStats(): Promise<QueueStats> {
  const pool = await getDb();
  const { rows } = await pool.query<{ status: QueueStatus; count: string }>(
    `SELECT status, COUNT(*)::text AS count FROM intel_research_queue GROUP BY status`,
  );
  const stats: QueueStats = { pending: 0, running: 0, done: 0, failed: 0 };
  for (const r of rows) stats[r.status] = parseInt(r.count, 10);
  return stats;
}

export interface ListQueueFilters {
  status?: QueueStatus | "all";
  limit?: number;
  offset?: number;
}

export async function listQueueRows(filters: ListQueueFilters = {}): Promise<QueueRow[]> {
  const pool = await getDb();
  const params: unknown[] = [];
  let where = "";
  if (filters.status && filters.status !== "all") {
    params.push(filters.status);
    where = `WHERE status = $${params.length}`;
  }
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
  const offset = Math.max(filters.offset ?? 0, 0);
  params.push(limit, offset);
  const { rows } = await pool.query<QueueRow>(
    `SELECT operator_id, priority, status, attempts, last_error,
            enqueued_at, started_at, completed_at
       FROM intel_research_queue
       ${where}
      ORDER BY priority ASC, enqueued_at ASC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows;
}
