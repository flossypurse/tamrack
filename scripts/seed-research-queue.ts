/**
 * Seed the `intel_research_queue` table with priority bands.
 *
 * Priorities (lower = higher priority):
 *   10  — core tri-region (Acheson / Spruce Grove / Stony Plain) + has website
 *   20  — core tri-region, no website
 *   50  — anywhere with website
 *   100 — default (everything else)
 *
 * Idempotent: ON CONFLICT (operator_id) updates priority to LEAST of new vs
 * existing, never raises it. So a re-run with the same logic won't disturb
 * rows already promoted by hand.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/seed-research-queue.ts
 */
import { getDb } from "@/lib/db";

const CORE_TRI_REGION_CITIES = [
  "acheson",
  "spruce grove",
  "stony plain",
  "parkland county",
];

async function main(): Promise<void> {
  const pool = await getDb();

  const result = await pool.query<{ inserted: string }>(
    `INSERT INTO intel_research_queue (operator_id, priority)
     SELECT id,
            CASE
              WHEN LOWER(city) = ANY($1::text[]) AND website IS NOT NULL AND website <> '' THEN 10
              WHEN LOWER(city) = ANY($1::text[]) THEN 20
              WHEN website IS NOT NULL AND website <> '' THEN 50
              ELSE 100
            END
       FROM intel_operators
     ON CONFLICT (operator_id) DO UPDATE
       SET priority = LEAST(intel_research_queue.priority, EXCLUDED.priority)
     RETURNING (xmax = 0)::text AS inserted`,
    [CORE_TRI_REGION_CITIES],
  );

  const inserted = result.rows.filter((r) => r.inserted === "true").length;
  const updated = result.rows.length - inserted;

  const stats = await pool.query<{ priority: number; count: string }>(
    `SELECT priority, COUNT(*)::text AS count
       FROM intel_research_queue
       WHERE status = 'pending'
       GROUP BY priority
       ORDER BY priority ASC`,
  );

  console.log(`seeded queue: inserted=${inserted} updated=${updated}`);
  console.log("priority distribution (pending only):");
  for (const r of stats.rows) {
    console.log(`  p=${r.priority}: ${r.count} operators`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
