/**
 * Seed the edmonton-business-panel signal definition into
 * signals.signal_definitions.
 *
 * Idempotent: INSERT ... ON CONFLICT (slug, version) DO UPDATE, so re-running
 * is safe on a live database.
 *
 * This is the S1 panel signal. Notes on the seeded values:
 *   - signal_type = 'panel' — computeOneSignal branches on this to run
 *     materializeEdmontonBusinessPanel.
 *   - geo_scope = 'edmonton' — matched by the geo loader as a geo SLUG (a panel
 *     scoped to one place), not a geo_type. The loader resolves it to exactly
 *     the Edmonton geo, so maxGeo=1 is deterministic.
 *   - series_scope = '{}' — empty for now. The scheduled computeSignals + a
 *     manual recomputeSignal both run off the definition directly; series_scope
 *     only drives the processSignalQueue auto-trigger, which needs an Edmonton
 *     business-licence series that isn't ingested yet.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... npx tsx scripts/seed-signal-definition.ts
 */

import { getDb } from "@/lib/db";

async function main() {
  const pool = await getDb();

  const result = await pool.query<{ id: string; slug: string; geo_scope: string }>(
    `
    INSERT INTO signals.signal_definitions
      (slug, signal_type, geo_scope, series_scope, window_days, cadence, active, priority)
    VALUES
      ('edmonton-business-panel', 'panel', 'edmonton', '{}', 365, 'daily', TRUE, 100)
    ON CONFLICT (slug, version) DO UPDATE SET
      signal_type = EXCLUDED.signal_type,
      geo_scope   = EXCLUDED.geo_scope,
      window_days = EXCLUDED.window_days,
      cadence     = EXCLUDED.cadence,
      active      = TRUE
    RETURNING id, slug, geo_scope
    `,
  );

  const row = result.rows[0];
  if (row) {
    console.log(JSON.stringify({ event: "seed_signal_definition", slug: row.slug, id: row.id, geo_scope: row.geo_scope, status: "ok" }));
  } else {
    console.error(JSON.stringify({ event: "seed_signal_definition", status: "error", detail: "no row returned" }));
    process.exit(1);
  }

  await pool.end();
}

main().catch((err) => {
  console.error(JSON.stringify({ event: "seed_signal_definition", status: "fatal", error: String(err) }));
  process.exit(1);
});
