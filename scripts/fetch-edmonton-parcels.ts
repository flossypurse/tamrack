#!/usr/bin/env npx tsx
/**
 * Edmonton record-level parcel fetcher.
 *
 * Each parcel is a row in substrate.entities (kind='parcel'); each daily
 * run writes one observation per parcel into the partitioned
 * substrate.observations table (series='edm-parcel-assessed-value',
 * value=assessed_value, qualifier=tax_class, entity_id=parcel).
 *
 * Why entities + observations: parcels are slow-changing identities
 * (account_number is stable) but assessed_value is a time-series. The
 * entity row carries identity + geometry; observations carry the value
 * over time. New parcels (subdivisions, new builds) show up as
 * first_seen=today entities; removed parcels (merges, decommissions)
 * stop getting last_seen updates.
 *
 * Source: data.edmonton.ca/resource/q7d6-ambg.json (Edmonton open data,
 * Socrata). Paginated by `$offset` / `$limit=25000`. ~440K parcels
 * total → ~18 pages. Each page commits independently — partial runs
 * leave a consistent intermediate state and re-runs are idempotent.
 *
 * Parcel identity: `account_number` (the assessment roll number) is the
 * stable identifier. Slug = `edm-parcel-${account_number}`. Geo parent:
 * the Edmonton neighbourhood if `neighbourhood_id` matches an
 * `edm-nbhd-${id}` row in geo_dimension; NULL otherwise (script warns
 * with the unmatched count at end-of-run so backfill gaps are visible).
 *
 * Matview refresh: NOT triggered in-script. A 440K-row refresh is too
 * expensive to run after every parcel snapshot — it stacks with other
 * collector runs and stalls them. Pin the refresh to a nightly cron via
 * `SELECT substrate.refresh_latest_observations();`.
 *
 * Idempotent: per-page UPSERTs on (slug) for entities and
 * (series_id, period, geo_id, entity_id) for observations. Includes
 * --dry-run, --limit-pages=N (smoke-test), and --start-offset=N
 * (resume after a partial failure — see snapshot_log for the last
 * successful offset).
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/fetch-edmonton-parcels.ts
 *   DATABASE_URL=... npx tsx scripts/fetch-edmonton-parcels.ts --dry-run
 *   DATABASE_URL=... npx tsx scripts/fetch-edmonton-parcels.ts --limit-pages=1
 *   DATABASE_URL=... npx tsx scripts/fetch-edmonton-parcels.ts --start-offset=125000
 */
import { getDb } from "../src/lib/db";
import { fetchWithRetry } from "../src/lib/fetch-utils";

const DATASET = "q7d6-ambg";
const SOURCE_NAME = "Edmonton Open Data";
const SOURCE_BASE = "https://data.edmonton.ca";
const SERIES_SLUG = "edm-parcel-assessed-value";
const ENTITY_KIND = "parcel";
const EDMONTON_MUNI_SLUG = "edmonton";

// 25_000 keeps the per-page array footprint (~6 parallel arrays, ~40 MB
// peak after JSON parse) safely below the Fly machine's headroom alongside
// the resident Next.js app.
const PAGE_SIZE = 25_000;

interface SocrataParcel {
  account_number?: string;
  neighbourhood_id?: string;
  assessed_value?: string;
  tax_class?: string;
  latitude?: string;
  longitude?: string;
}

interface CliOpts {
  dryRun: boolean;
  limitPages: number | null;
  startOffset: number;
}

function parseArgs(): CliOpts {
  const dryRun = process.argv.includes("--dry-run");
  const limitArg = process.argv.find((a) => a.startsWith("--limit-pages="));
  const limitPages = limitArg ? Number(limitArg.split("=")[1]) : null;
  const startArg = process.argv.find((a) => a.startsWith("--start-offset="));
  const startOffset = startArg ? Number(startArg.split("=")[1]) : 0;
  if (!Number.isInteger(startOffset) || startOffset < 0) {
    throw new Error(`--start-offset must be a non-negative integer, got ${startArg}`);
  }
  return { dryRun, limitPages, startOffset };
}

async function fetchPage(offset: number): Promise<SocrataParcel[]> {
  const url =
    `${SOURCE_BASE}/resource/${DATASET}.json` +
    `?$select=account_number,neighbourhood_id,assessed_value,tax_class,latitude,longitude` +
    `&$limit=${PAGE_SIZE}&$offset=${offset}&$order=account_number`;
  const res = await fetchWithRetry(url, { userAgent: "tamrack-edmonton-parcels" });
  const body = (await res.json()) as SocrataParcel[];
  if (!Array.isArray(body)) throw new Error(`Socrata returned non-array at offset=${offset}`);
  return body;
}

function roundCoord(s: string | undefined): number | null {
  if (s === undefined) return null;
  const v = Number(s);
  if (!Number.isFinite(v)) return null;
  return Math.round(v * 1_000_000) / 1_000_000;
}

async function main() {
  const opts = parseArgs();
  console.log(
    `[opts] dry-run=${opts.dryRun} limit-pages=${opts.limitPages ?? "all"} start-offset=${opts.startOffset}`
  );

  const pool = await getDb();
  const setupClient = await pool.connect();
  let edmontonId: string;
  let nbhdBySlug: Map<string, string>;
  let sourceId: string | null = null;
  let seriesId: string | null = null;
  let runLogId: number | null = null;
  let unmatchedNbhdCount = 0;

  try {
    const muni = await setupClient.query(
      `SELECT id FROM substrate.geo_dimension WHERE slug = $1`,
      [EDMONTON_MUNI_SLUG]
    );
    if (muni.rowCount === 0) {
      throw new Error(
        `geo_dimension row for ${EDMONTON_MUNI_SLUG} not found — run backfill-substrate-geo-dimension.ts first`
      );
    }
    edmontonId = muni.rows[0].id;

    const nbhds = await setupClient.query(
      `SELECT slug, id FROM substrate.geo_dimension WHERE geo_type = 'neighbourhood' AND parent_id = $1`,
      [edmontonId]
    );
    nbhdBySlug = new Map(
      nbhds.rows.map((r: { slug: string; id: string }) => [r.slug, r.id])
    );
    console.log(`[lookup] edmonton geo_id=${edmontonId}, ${nbhdBySlug.size} neighbourhoods cached`);

    if (!opts.dryRun) {
      const src = await setupClient.query(
        `INSERT INTO substrate.sources (name, base_url, auth_type)
         VALUES ($1, $2, 'public')
         ON CONFLICT (name) DO UPDATE SET base_url = EXCLUDED.base_url
         RETURNING id`,
        [SOURCE_NAME, SOURCE_BASE]
      );
      sourceId = src.rows[0].id;

      const ser = await setupClient.query(
        `INSERT INTO substrate.series_metadata
           (slug, domain, name, source_id, unit, unit_type, cadence, geo_id,
            description, tags, upstream_key, storage_kind, entity_kind)
         VALUES
           ($1, 'parcel', 'Edmonton parcel assessed value (record-level)',
            $2, 'CAD', 'currency', 'daily', $3,
            'Per-parcel assessed value from Edmonton open data q7d6-ambg. Each parcel is a substrate.entities row (kind=parcel); each observation references the parcel via entity_id. value=assessed_value, qualifier=tax_class.',
            ARRAY['edmonton','parcel','record-level','assessment']::text[],
            $4::jsonb, 'entity+observation', $5)
         ON CONFLICT (slug) DO UPDATE SET
           name = EXCLUDED.name,
           source_id = EXCLUDED.source_id,
           description = EXCLUDED.description,
           tags = EXCLUDED.tags,
           upstream_key = EXCLUDED.upstream_key,
           storage_kind = EXCLUDED.storage_kind,
           entity_kind = EXCLUDED.entity_kind
         RETURNING id`,
        [
          SERIES_SLUG,
          sourceId,
          edmontonId,
          JSON.stringify({ kind: "socrata", dataset: DATASET, url: `${SOURCE_BASE}/resource/${DATASET}.json` }),
          ENTITY_KIND,
        ]
      );
      seriesId = ser.rows[0].id;
      console.log(`[setup] source_id=${sourceId} series_id=${seriesId}`);

      // Heartbeat: open a `running` snapshot_log row before the long
      // page loop so a mid-run failure leaves an audit trail.
      const runLog = await setupClient.query(
        `INSERT INTO snapshot_log (taken_at, source, records_inserted, status, error)
         VALUES (NOW(), $1, 0, 'running', NULL)
         RETURNING id`,
        [`substrate.observations.${SERIES_SLUG}`]
      );
      runLogId = runLog.rows[0].id;
      console.log(`[heartbeat] snapshot_log id=${runLogId} marked 'running'`);
    }
  } finally {
    setupClient.release();
  }

  let totalParcels = 0;
  let totalEntityUpserts = 0;
  let totalObsUpserts = 0;
  let skippedNoAccount = 0;
  let skippedBadValue = 0;
  let pageIdx = 0;
  let lastSuccessfulOffset = opts.startOffset - 1;

  try {
    for (let offset = opts.startOffset; ; offset += PAGE_SIZE) {
      pageIdx++;
      if (opts.limitPages !== null && pageIdx > opts.limitPages) {
        console.log(`[stop] hit --limit-pages=${opts.limitPages}`);
        break;
      }

      const t0 = Date.now();
      const page = await fetchPage(offset);
      console.log(`[fetch] page ${pageIdx} offset=${offset} rows=${page.length} (${Date.now() - t0}ms)`);
      if (page.length === 0) break;

      totalParcels += page.length;

      const valid = page.filter((p) => p.account_number && p.account_number.length > 0);
      skippedNoAccount += page.length - valid.length;

      if (opts.dryRun) {
        console.log(`[dry-run] page ${pageIdx} sample:`, JSON.stringify(valid[0]));
        if (page.length < PAGE_SIZE) break;
        continue;
      }

      if (sourceId === null || seriesId === null) {
        throw new Error("setup failed: sourceId/seriesId not set");
      }

      // Build parallel arrays for unnest()-based bulk upsert. parent_id is
      // the nbhd if matched, NULL otherwise — silently bucketing under the
      // muni would make "parcels in nbhd X" queries undercount permanently.
      const slugs: string[] = [];
      const names: string[] = [];
      const geoIds: (string | null)[] = [];
      const lats: (number | null)[] = [];
      const lons: (number | null)[] = [];
      const attrs: string[] = [];
      const values: (number | null)[] = [];
      const qualifiers: (string | null)[] = [];

      for (const p of valid) {
        const slug = `edm-parcel-${p.account_number}`;
        const nbhdSlug = p.neighbourhood_id ? `edm-nbhd-${p.neighbourhood_id}` : null;
        const geoId = (nbhdSlug && nbhdBySlug.get(nbhdSlug)) ?? null;
        if (geoId === null) unmatchedNbhdCount++;
        const value = p.assessed_value !== undefined ? Number(p.assessed_value) : NaN;
        const numericValue = Number.isFinite(value) ? value : null;
        if (numericValue === null) skippedBadValue++;
        slugs.push(slug);
        names.push(slug);
        geoIds.push(geoId);
        lats.push(roundCoord(p.latitude));
        lons.push(roundCoord(p.longitude));
        attrs.push(JSON.stringify({
          account_number: p.account_number,
          neighbourhood_id: p.neighbourhood_id ?? null,
          tax_class: p.tax_class ?? null,
        }));
        values.push(numericValue);
        qualifiers.push(p.tax_class ?? null);
      }

      // Pre-flight: array length parity. unnest() in PG raises if arrays
      // differ in length; assert here so a future edit catches it earlier.
      const n = slugs.length;
      if (
        names.length !== n || geoIds.length !== n || lats.length !== n ||
        lons.length !== n || attrs.length !== n || values.length !== n ||
        qualifiers.length !== n
      ) {
        throw new Error(`array-length parity broken at page ${pageIdx} (n=${n})`);
      }

      const writeClient = await pool.connect();
      try {
        await writeClient.query("BEGIN");

        // Bulk upsert entities (parcels). first_seen DEFAULT CURRENT_DATE
        // on insert; last_seen refreshes to CURRENT_DATE on every upsert.
        const entityResult = await writeClient.query(
          `INSERT INTO substrate.entities
             (slug, kind, name, geo_id, attrs, centroid_lat, centroid_lon, source_id, first_seen, last_seen)
           SELECT u.slug, $1, u.name, u.geo_id::uuid, u.attrs::jsonb, u.lat, u.lon, $2::uuid, CURRENT_DATE, CURRENT_DATE
           FROM unnest($3::text[], $4::text[], $5::text[], $6::numeric[], $7::numeric[], $8::text[])
             AS u(slug, name, geo_id, lat, lon, attrs)
           ON CONFLICT (slug) DO UPDATE SET
             name = EXCLUDED.name,
             geo_id = EXCLUDED.geo_id,
             attrs = EXCLUDED.attrs,
             centroid_lat = EXCLUDED.centroid_lat,
             centroid_lon = EXCLUDED.centroid_lon,
             source_id = EXCLUDED.source_id,
             last_seen = CURRENT_DATE`,
          [ENTITY_KIND, sourceId, slugs, names, geoIds, lats, lons, attrs]
        );
        totalEntityUpserts += entityResult.rowCount ?? 0;

        // Resolve entity_ids + parent geo_ids for the rows we just upserted.
        const lookup = await writeClient.query(
          `SELECT slug, id, geo_id FROM substrate.entities WHERE slug = ANY($1::text[])`,
          [slugs]
        );
        const entityRowBySlug = new Map<string, { id: string; geo_id: string | null }>(
          lookup.rows.map((r: { slug: string; id: string; geo_id: string | null }) => [r.slug, { id: r.id, geo_id: r.geo_id }])
        );

        // Bulk upsert observations. Only parcels with both a numeric value
        // AND a resolved geo_id produce an observation row — observations
        // require NOT NULL geo_id. Parcels without a matched nbhd skip the
        // observation but the entity itself is preserved.
        const obsEntityIds: string[] = [];
        const obsGeoIds: string[] = [];
        const obsValues: number[] = [];
        const obsQualifiers: (string | null)[] = [];
        for (let i = 0; i < slugs.length; i++) {
          const entRow = entityRowBySlug.get(slugs[i]);
          if (!entRow) continue;
          if (values[i] === null) continue;
          if (entRow.geo_id === null) continue;
          obsEntityIds.push(entRow.id);
          obsGeoIds.push(entRow.geo_id);
          obsValues.push(values[i]!);
          obsQualifiers.push(qualifiers[i]);
        }

        // Parity assertion for the obs arrays. unnest() raises at SQL
        // execution time if these arrays drift in length; assert here so a
        // future conditional-push bug surfaces at the obvious source line.
        const obsN = obsEntityIds.length;
        if (
          obsGeoIds.length !== obsN ||
          obsValues.length !== obsN ||
          obsQualifiers.length !== obsN
        ) {
          throw new Error(`obs-array parity broken at page ${pageIdx} (n=${obsN})`);
        }

        if (obsEntityIds.length > 0) {
          const obsResult = await writeClient.query(
            `INSERT INTO substrate.observations
               (series_id, period, geo_id, entity_id, value, raw_value, qualifier, collected_at)
             SELECT $1::uuid, CURRENT_DATE, u.geo_id::uuid, u.entity_id::uuid, u.value, NULL, u.qualifier, NOW()
             FROM unnest($2::text[], $3::text[], $4::numeric[], $5::text[])
               AS u(geo_id, entity_id, value, qualifier)
             ON CONFLICT (series_id, period, geo_id, entity_id) DO UPDATE SET
               value = EXCLUDED.value, qualifier = EXCLUDED.qualifier, collected_at = EXCLUDED.collected_at`,
            [seriesId, obsGeoIds, obsEntityIds, obsValues, obsQualifiers]
          );
          totalObsUpserts += obsResult.rowCount ?? 0;
        }

        await writeClient.query("COMMIT");
        lastSuccessfulOffset = offset;
        console.log(`[upsert] page ${pageIdx}: entities=${entityResult.rowCount} obs=${obsEntityIds.length}`);
      } catch (err) {
        await writeClient.query("ROLLBACK");
        throw err;
      } finally {
        writeClient.release();
      }

      if (page.length < PAGE_SIZE) break;
    }
  } catch (err) {
    if (runLogId !== null) {
      const msg = `${(err as Error).message} | last_successful_offset=${lastSuccessfulOffset}`;
      await pool.query(
        `UPDATE snapshot_log SET status = 'error', error = $1, records_inserted = $2 WHERE id = $3`,
        [msg, totalObsUpserts, runLogId]
      );
      console.error(`[heartbeat] snapshot_log id=${runLogId} marked 'error'; last_successful_offset=${lastSuccessfulOffset}`);
      console.error(`[resume]    re-run with --start-offset=${lastSuccessfulOffset + PAGE_SIZE}`);
    }
    throw err;
  }

  // Cumulative debt: parcels in the table with geo_id=NULL across all
  // historical runs (this run's unmatchedNbhdCount is just today's slice).
  // Visibility surface for "how much backfill is pending."
  let cumulativeNullGeo = 0;
  if (!opts.dryRun) {
    const cumulative = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM substrate.entities WHERE kind = $1 AND geo_id IS NULL`,
      [ENTITY_KIND]
    );
    cumulativeNullGeo = cumulative.rows[0].n;
  }

  console.log("");
  console.log(`[summary] fetched parcels:           ${totalParcels}`);
  console.log(`[summary] entity upserts:            ${totalEntityUpserts}`);
  console.log(`[summary] observation upserts:       ${totalObsUpserts}`);
  console.log(`[summary] skipped (no account_num):  ${skippedNoAccount}`);
  console.log(`[summary] skipped (bad assessed_v):  ${skippedBadValue}`);
  console.log(`[summary] unmatched nbhd this run:   ${unmatchedNbhdCount}`);
  console.log(`[summary] cumulative geo_id=NULL:    ${cumulativeNullGeo}`);
  if (unmatchedNbhdCount > 0 || cumulativeNullGeo > 0) {
    console.warn(
      `[warn] parcels with geo_id=NULL produce no observation row. Re-run backfill-substrate-geo-dimension.ts (if a new neighbourhood appeared upstream) and then this script to backfill.`
    );
  }

  if (!opts.dryRun && runLogId !== null) {
    await pool.query(
      `UPDATE snapshot_log SET status = 'ok', records_inserted = $1 WHERE id = $2`,
      [totalObsUpserts, runLogId]
    );
    console.log(`[heartbeat] snapshot_log id=${runLogId} marked 'ok'`);
    // Matview refresh is intentionally NOT triggered here. A 440K-row
    // CONCURRENT refresh costs ~5 min and stacks with other collectors —
    // pin it to a nightly cron via SELECT substrate.refresh_latest_observations().
    console.log(`[refresh] skipped in-script — pinned to nightly cron`);
  }

  console.log("[done] parcel snapshot complete");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FATAL:", e);
    process.exit(1);
  });
