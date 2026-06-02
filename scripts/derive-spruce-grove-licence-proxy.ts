#!/usr/bin/env npx tsx
/**
 * Spruce Grove licence proxy adapter.
 *
 * Spruce Grove publishes no business-licence layer through any of its
 * ArcGIS endpoints. Investigation report at handoffs/2026-05-31-... .
 * The strongest available signals are:
 *
 *   1. Development-permit-stage data from `municipality_permits` (count
 *      of permits filed per snapshot_date per group_name). New commercial
 *      space often precedes a new business licence by 3-6 months, so the
 *      filed-permit count is a forward-leaning proxy for licence flow.
 *
 *   2. The `Incorporations` indicator from `regional_indicators` for
 *      Spruce Grove's CSDUID (the count of new provincial corporations
 *      registered to a Spruce Grove address per period). This is a
 *      concurrent proxy — a new corporation usually has a licence within
 *      the same period.
 *
 * This script derives two series into substrate.observations from those
 * two upstream tables. Both series are labelled clearly as proxies so
 * downstream narrative templates credit them as such instead of conflating
 * with direct licence data from Edmonton / Stony Plain.
 *
 * The Spruce Grove geo_dimension row is resolved at runtime by slug
 * (`spruce-grove`); CSDUID comes from the ARD-sourced row. The handoff
 * cited CSDUID 4811056 for Spruce Grove but ARD says 4811049 (4811056 is
 * Fort Saskatchewan) — looking up by slug avoids the discrepancy.
 *
 * Idempotent: re-running upserts onto (series_id, period, geo_id). Includes
 * --dry-run for inspection without DB writes.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/derive-spruce-grove-licence-proxy.ts
 *   DATABASE_URL=... npx tsx scripts/derive-spruce-grove-licence-proxy.ts --dry-run
 *   DATABASE_URL=... npx tsx scripts/derive-spruce-grove-licence-proxy.ts --since=2024-01-01
 *
 * --since caps the upstream lookup window — without it the script re-derives
 * every historical observation on each run. Default is unbounded (full
 * history) for backfill; in scheduled production use the cron should pass
 * --since=<yesterday> so frozen history isn't re-written daily.
 */
import { getDb } from "../src/lib/db";

const SOURCE_NAME = "Tri-Region licence proxy";
const SPRUCE_GROVE_SLUG = "spruce-grove";
const SPRUCE_GROVE_MUNICIPALITY = "Spruce Grove"; // matches municipality_permits.municipality

const PERMITS_SERIES_SLUG = "spruce-grove-licence-proxy-dev-permits";
const INCORP_SERIES_SLUG = "spruce-grove-licence-proxy-incorporations";

interface PermitRow {
  snapshot_date: string;
  total_count: string;
}
interface IncorpRow {
  period: string;
  value: string;
}

/**
 * Parse an `regional_indicators.period` string into a DATE. Inputs we expect:
 *   "2024"          → 2024-01-01
 *   "2024-Q1"       → 2024-01-01
 *   "2024-Q2"       → 2024-04-01
 *   "2024-01"       → 2024-01-01
 *   "2024-01-15"    → 2024-01-15
 * Returns null for anything else — the caller skips unparseable rows.
 */
function periodToDate(period: string): string | null {
  const m4 = /^\d{4}$/.exec(period);
  if (m4) return `${period}-01-01`;
  const mq = /^(\d{4})-Q([1-4])$/.exec(period);
  if (mq) {
    const startMonth = (Number(mq[2]) - 1) * 3 + 1;
    return `${mq[1]}-${String(startMonth).padStart(2, "0")}-01`;
  }
  const mm = /^(\d{4})-(\d{2})$/.exec(period);
  if (mm) return `${period}-01`;
  const md = /^\d{4}-\d{2}-\d{2}$/.exec(period);
  if (md) return period;
  return null;
}

function parseSince(): string | null {
  const arg = process.argv.find((a) => a.startsWith("--since="));
  if (!arg) return null;
  const v = arg.split("=")[1];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    throw new Error(`--since must be YYYY-MM-DD, got ${v}`);
  }
  return v;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const since = parseSince();
  if (since) console.log(`[opts] --since=${since} (upstream rows older than this are skipped)`);
  const pool = await getDb();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const parent = await client.query(
      `SELECT id, csduid FROM substrate.geo_dimension WHERE slug = $1`,
      [SPRUCE_GROVE_SLUG]
    );
    if (parent.rowCount === 0) {
      throw new Error(
        `geo_dimension row for ${SPRUCE_GROVE_SLUG} not found — run backfill-substrate-geo-dimension.ts first`
      );
    }
    const spruceId: string = parent.rows[0].id;
    const spruceCsduid: string | null = parent.rows[0].csduid;
    if (!spruceCsduid) {
      throw new Error(`geo_dimension row for ${SPRUCE_GROVE_SLUG} has no csduid — needed for regional_indicators join`);
    }
    console.log(`[lookup] spruce-grove geo_id=${spruceId} csduid=${spruceCsduid}`);

    // --- Permits proxy: aggregate municipality_permits → one row per snapshot_date ---
    // snapshot_date is stored as TEXT; `>= $2` works as a string compare since
    // the YYYY-MM-DD format sorts lexicographically.
    const permits = await client.query<PermitRow>(
      `SELECT snapshot_date, SUM(count)::text AS total_count
         FROM municipality_permits
         WHERE municipality = $1
           AND ($2::text IS NULL OR snapshot_date >= $2)
         GROUP BY snapshot_date
         ORDER BY snapshot_date`,
      [SPRUCE_GROVE_MUNICIPALITY, since]
    );
    console.log(`[derive] dev-permits proxy: ${permits.rowCount} distinct snapshot_dates`);

    // --- Incorporations proxy: regional_indicators filtered to Spruce csduid ---
    // `period` here is the free-form TEXT we'll later parse via periodToDate;
    // string >= compare is safe for the period formats we accept (year, quarter,
    // month, day all sort sensibly within their own formats — mixed-format
    // ordering is fine since we only need to drop ANCIENT rows).
    const incorp = await client.query<IncorpRow>(
      `SELECT period, value::text AS value
         FROM regional_indicators
         WHERE csduid = $1 AND indicator = 'Incorporations'
           AND ($2::text IS NULL OR period >= $2)
         ORDER BY period`,
      [spruceCsduid, since ? since.slice(0, 4) : null]
    );
    console.log(`[derive] incorporations proxy: ${incorp.rowCount} distinct periods`);

    // Granularity-collision guard: warn if two distinct upstream period strings
    // map to the same observation DATE (e.g. "2024" and "2024-Q1" both →
    // 2024-01-01). The DB UNIQUE on (series_id, period, geo_id) would silently
    // pick one — surfacing the collision aborts the run rather than silently
    // letting last-write-wins corrupt the time-series. Operators must then
    // either split the series by granularity OR pre-filter the source to one
    // granularity before re-running.
    const periodToOriginals = new Map<string, Set<string>>();
    for (const r of incorp.rows) {
      const mapped = periodToDate(r.period);
      if (!mapped) continue;
      let set = periodToOriginals.get(mapped);
      if (!set) {
        set = new Set();
        periodToOriginals.set(mapped, set);
      }
      set.add(r.period);
    }
    const collisions: Array<{ date: string; originals: string[] }> = [];
    for (const [date, originals] of periodToOriginals) {
      if (originals.size > 1) {
        collisions.push({ date, originals: [...originals] });
      }
    }
    if (collisions.length > 0) {
      for (const c of collisions) {
        console.error(
          `[guard] period collision: incorporations source rows ${c.originals.map((o) => `"${o}"`).join(", ")} all map to ${c.date}`
        );
      }
      throw new Error(
        `${collisions.length} period collision(s) detected in incorporations source data. Split the series by granularity (annual / quarterly / monthly) or pre-filter the source before re-running. See [guard] log lines above for details.`
      );
    }

    if (dryRun) {
      console.log("[dry-run] sample permits row:", permits.rows[0] ?? "(none)");
      console.log("[dry-run] sample incorp row:", incorp.rows[0] ?? "(none)");
      console.log("[dry-run] skipping writes");
      await client.query("ROLLBACK");
      return;
    }

    // Upsert source.
    const src = await client.query(
      `INSERT INTO substrate.sources (name, base_url, auth_type)
       VALUES ($1, NULL, 'derived')
       ON CONFLICT (name) DO UPDATE SET auth_type = EXCLUDED.auth_type
       RETURNING id`,
      [SOURCE_NAME]
    );
    const sourceId: string = src.rows[0].id;

    // Upsert both series_metadata rows.
    const permitsSer = await client.query(
      `INSERT INTO substrate.series_metadata
         (slug, domain, name, source_id, unit, unit_type, cadence, geo_id,
          description, tags, upstream_key, is_derived, derivation_lineage)
       VALUES
         ($1, 'business_licence_proxy', 'Spruce Grove dev-permit count (licence proxy)',
          $2, 'permits', 'count', 'daily', $3,
          'PROXY: derived from municipality_permits aggregated to total count per snapshot_date for Spruce Grove. Forward-leaning proxy for licence flow — commercial dev permits typically precede licences by 3-6 months.',
          ARRAY['tri-region','licence-proxy','spruce-grove','derived']::text[],
          $4::jsonb, TRUE, $5::jsonb)
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         source_id = EXCLUDED.source_id,
         description = EXCLUDED.description,
         tags = EXCLUDED.tags,
         upstream_key = EXCLUDED.upstream_key,
         is_derived = EXCLUDED.is_derived,
         derivation_lineage = EXCLUDED.derivation_lineage
       RETURNING id`,
      [
        PERMITS_SERIES_SLUG,
        sourceId,
        spruceId,
        JSON.stringify({ kind: "derived", upstream_table: "municipality_permits", municipality: SPRUCE_GROVE_MUNICIPALITY }),
        JSON.stringify({
          v: 1,
          kind: "rollup",
          upstream: [{ table: "municipality_permits", filter: { municipality: SPRUCE_GROVE_MUNICIPALITY }, aggregate: "SUM(count) per snapshot_date" }],
        }),
      ]
    );
    const permitsSeriesId: string = permitsSer.rows[0].id;

    const incorpSer = await client.query(
      `INSERT INTO substrate.series_metadata
         (slug, domain, name, source_id, unit, unit_type, cadence, geo_id,
          description, tags, upstream_key, is_derived, derivation_lineage)
       VALUES
         ($1, 'business_licence_proxy', 'Spruce Grove incorporations (licence proxy)',
          $2, 'incorporations', 'count', 'period', $3,
          'PROXY: regional_indicators.Incorporations for Spruce Grove CSDUID. Concurrent proxy — new corporations typically file a licence within the same period.',
          ARRAY['tri-region','licence-proxy','spruce-grove','derived']::text[],
          $4::jsonb, TRUE, $5::jsonb)
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         source_id = EXCLUDED.source_id,
         description = EXCLUDED.description,
         tags = EXCLUDED.tags,
         upstream_key = EXCLUDED.upstream_key,
         is_derived = EXCLUDED.is_derived,
         derivation_lineage = EXCLUDED.derivation_lineage
       RETURNING id`,
      [
        INCORP_SERIES_SLUG,
        sourceId,
        spruceId,
        JSON.stringify({ kind: "derived", upstream_table: "regional_indicators", csduid: spruceCsduid, indicator: "Incorporations" }),
        JSON.stringify({
          v: 1,
          kind: "proxy",
          upstream: [{ table: "regional_indicators", filter: { csduid: spruceCsduid, indicator: "Incorporations" } }],
        }),
      ]
    );
    const incorpSeriesId: string = incorpSer.rows[0].id;

    // Write permits observations: one row per snapshot_date.
    let permitsObs = 0;
    for (const r of permits.rows) {
      const value = Number(r.total_count);
      if (!Number.isFinite(value)) continue;
      const result = await client.query(
        `INSERT INTO substrate.observations
           (series_id, period, geo_id, entity_id, value, raw_value, qualifier, collected_at)
         VALUES ($1, $2::date, $3, NULL, $4, NULL, NULL, NOW())
         ON CONFLICT (series_id, period, geo_id, entity_id) DO UPDATE SET
           value = EXCLUDED.value, collected_at = EXCLUDED.collected_at`,
        [permitsSeriesId, r.snapshot_date, spruceId, value]
      );
      permitsObs += result.rowCount ?? 0;
    }

    // Write incorporations observations: parse period → DATE.
    let incorpObs = 0;
    let skippedPeriods = 0;
    for (const r of incorp.rows) {
      const periodDate = periodToDate(r.period);
      if (!periodDate) {
        skippedPeriods++;
        continue;
      }
      const value = Number(r.value);
      if (!Number.isFinite(value)) continue;
      const result = await client.query(
        `INSERT INTO substrate.observations
           (series_id, period, geo_id, entity_id, value, raw_value, qualifier, collected_at)
         VALUES ($1, $2::date, $3, NULL, $4, $5, NULL, NOW())
         ON CONFLICT (series_id, period, geo_id, entity_id) DO UPDATE SET
           value = EXCLUDED.value, raw_value = EXCLUDED.raw_value, collected_at = EXCLUDED.collected_at`,
        [incorpSeriesId, periodDate, spruceId, value, r.period]
      );
      incorpObs += result.rowCount ?? 0;
    }
    if (skippedPeriods > 0) {
      console.warn(`[derive] incorporations proxy: ${skippedPeriods} rows had unparseable period string`);
    }

    await client.query(
      `INSERT INTO snapshot_log (taken_at, source, records_inserted, status, error)
       VALUES (NOW(), $1, $2, 'ok', NULL)`,
      [`substrate.observations.${PERMITS_SERIES_SLUG}`, permitsObs]
    );
    await client.query(
      `INSERT INTO snapshot_log (taken_at, source, records_inserted, status, error)
       VALUES (NOW(), $1, $2, 'ok', NULL)`,
      [`substrate.observations.${INCORP_SERIES_SLUG}`, incorpObs]
    );

    await client.query("COMMIT");
    console.log(`[upsert] dev-permits observations: ${permitsObs}`);
    console.log(`[upsert] incorporations observations: ${incorpObs}`);

    const refreshResult = await pool.query<{ refresh_latest_observations: boolean }>(
      `SELECT substrate.refresh_latest_observations()`
    );
    const refreshed = refreshResult.rows[0]?.refresh_latest_observations;
    console.log(`[refresh] substrate.latest_observations: ${refreshed ? "refreshed" : "skipped (advisory lock held by another caller)"}`);

    console.log("[done] proxy derivation committed");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FATAL:", e);
    process.exit(1);
  });
