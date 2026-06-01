#!/usr/bin/env npx tsx
/**
 * Edmonton record-level parcel fetcher (Phase 0 §0.2).
 *
 * Replaces the legacy aggregate `q7d6-ambg` fetcher (which rolled up to
 * per-neighbourhood `avg_assessment` / `min_assessment` / `max_assessment`
 * in `neighbourhood_metrics`) with a record-level snapshot in
 * `substrate.observations`. Each parcel is materialized as a
 * `geo_dimension` row (geo_type='parcel'); each daily run writes one
 * observation per parcel into the partitioned `observations` table.
 *
 * Why record-level: aggregate signals lose the long tail. With per-parcel
 * data, downstream queries can answer "which parcels' assessed_value
 * changed > N% YoY", "show me the top-decile residential parcels in
 * Westmount", "diff yesterday's snapshot vs today to detect new builds",
 * etc. The aggregate path stays in place for the existing scorecards.
 *
 * Source: data.edmonton.ca/resource/q7d6-ambg.json (Edmonton open data,
 * Socrata). Paginated by `$offset` / `$limit=50000`. ~440K parcels total
 * → ~9 pages. Each page commits independently — partial runs leave a
 * consistent intermediate state and a re-run picks up where it stopped
 * via the idempotent UPSERT pattern.
 *
 * Parcel identity: `account_number` is the assessment roll number, stable
 * across snapshots. Slug = `edm-parcel-${account_number}`. Parent geo is
 * the Edmonton neighbourhood (by `edm-nbhd-${neighbourhood_id}`) if it
 * exists in geo_dimension, otherwise the `edmonton` muni row, otherwise
 * NULL (defensive fallback — shouldn't happen after the geo-dimension
 * backfill).
 *
 * Series:
 *   `edm-parcel-assessed-value` — value = Number(assessed_value),
 *                                  qualifier = tax_class
 *
 * Idempotent: per-page UPSERTs on (slug) for geo_dimension and
 * (series_id, period, geo_id) for observations. Includes --dry-run.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/fetch-edmonton-parcels.ts
 *   DATABASE_URL=... npx tsx scripts/fetch-edmonton-parcels.ts --dry-run
 *   DATABASE_URL=... npx tsx scripts/fetch-edmonton-parcels.ts --limit-pages=1   # smoke-test
 */
import { getDb } from "../src/lib/db";

const DATASET = "q7d6-ambg";
const SOURCE_NAME = "Edmonton Open Data";
const SOURCE_BASE = "https://data.edmonton.ca";
const SERIES_SLUG = "edm-parcel-assessed-value";
const EDMONTON_MUNI_SLUG = "edmonton";
const PAGE_SIZE = 50_000;

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
}

function parseArgs(): CliOpts {
  const dryRun = process.argv.includes("--dry-run");
  const limitArg = process.argv.find((a) => a.startsWith("--limit-pages="));
  const limitPages = limitArg ? Number(limitArg.split("=")[1]) : null;
  return { dryRun, limitPages };
}

async function fetchPage(offset: number): Promise<SocrataParcel[]> {
  const url =
    `${SOURCE_BASE}/resource/${DATASET}.json` +
    `?$select=account_number,neighbourhood_id,assessed_value,tax_class,latitude,longitude` +
    `&$limit=${PAGE_SIZE}&$offset=${offset}&$order=account_number`;
  const res = await fetch(url, {
    headers: { "User-Agent": "tamrack-edmonton-parcels" },
  });
  if (!res.ok) throw new Error(`Socrata ${res.status} at offset=${offset}`);
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
  console.log(`[opts] dry-run=${opts.dryRun} limit-pages=${opts.limitPages ?? "all"}`);

  const pool = await getDb();
  const setupClient = await pool.connect();
  let edmontonId: string;
  let nbhdBySlug: Map<string, string>;
  let sourceId: string | null = null;
  let seriesId: string | null = null;

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
            description, tags, upstream_key)
         VALUES
           ($1, 'parcel', 'Edmonton parcel assessed value (record-level)',
            $2, 'CAD', 'currency', 'daily', $3,
            'Per-parcel assessed value from Edmonton open data q7d6-ambg. value=assessed_value, qualifier=tax_class. Each parcel is a geo_dimension row (geo_type=parcel).',
            ARRAY['edmonton','parcel','record-level','assessment']::text[],
            $4::jsonb)
         ON CONFLICT (slug) DO UPDATE SET
           name = EXCLUDED.name,
           source_id = EXCLUDED.source_id,
           description = EXCLUDED.description,
           tags = EXCLUDED.tags,
           upstream_key = EXCLUDED.upstream_key
         RETURNING id`,
        [
          SERIES_SLUG,
          sourceId,
          edmontonId,
          JSON.stringify({ kind: "socrata", dataset: DATASET, url: `${SOURCE_BASE}/resource/${DATASET}.json` }),
        ]
      );
      seriesId = ser.rows[0].id;
      console.log(`[setup] source_id=${sourceId} series_id=${seriesId}`);
    }
  } finally {
    setupClient.release();
  }

  let totalParcels = 0;
  let totalGeoUpserts = 0;
  let totalObsUpserts = 0;
  let skippedNoAccount = 0;
  let skippedBadValue = 0;
  let pageIdx = 0;

  for (let offset = 0; ; offset += PAGE_SIZE) {
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

    // Filter to rows with a usable account_number — that's our slug key.
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

    // ---- Bulk upsert geo_dimension via unnest() ----
    const slugs: string[] = [];
    const names: string[] = [];
    const parentIds: string[] = [];
    const lats: (number | null)[] = [];
    const lons: (number | null)[] = [];
    for (const p of valid) {
      const slug = `edm-parcel-${p.account_number}`;
      const nbhdSlug = p.neighbourhood_id ? `edm-nbhd-${p.neighbourhood_id}` : null;
      const parentId = (nbhdSlug && nbhdBySlug.get(nbhdSlug)) || edmontonId;
      slugs.push(slug);
      names.push(slug); // No human-readable name in the dataset; slug doubles as display.
      parentIds.push(parentId);
      lats.push(roundCoord(p.latitude));
      lons.push(roundCoord(p.longitude));
    }

    const writeClient = await pool.connect();
    try {
      await writeClient.query("BEGIN");

      const geoResult = await writeClient.query(
        `INSERT INTO substrate.geo_dimension
           (slug, name, geo_type, parent_id, centroid_lat, centroid_lon)
         SELECT u.slug, u.name, 'parcel', u.parent_id::uuid, u.lat, u.lon
         FROM unnest($1::text[], $2::text[], $3::text[], $4::numeric[], $5::numeric[])
           AS u(slug, name, parent_id, lat, lon)
         ON CONFLICT (slug) DO UPDATE SET
           parent_id = EXCLUDED.parent_id,
           centroid_lat = EXCLUDED.centroid_lat,
           centroid_lon = EXCLUDED.centroid_lon`,
        [slugs, names, parentIds, lats, lons]
      );
      totalGeoUpserts += geoResult.rowCount ?? 0;

      // Resolve geo_ids for the parcels we just upserted.
      const geoLookup = await writeClient.query(
        `SELECT slug, id FROM substrate.geo_dimension WHERE slug = ANY($1::text[])`,
        [slugs]
      );
      const geoIdBySlug = new Map<string, string>(
        geoLookup.rows.map((r: { slug: string; id: string }) => [r.slug, r.id])
      );

      // ---- Bulk upsert observations via unnest() ----
      const obsGeoIds: string[] = [];
      const obsValues: (number | null)[] = [];
      const obsQualifiers: (string | null)[] = [];
      for (const p of valid) {
        const slug = `edm-parcel-${p.account_number}`;
        const geoId = geoIdBySlug.get(slug);
        if (!geoId) continue;
        const value = p.assessed_value !== undefined ? Number(p.assessed_value) : NaN;
        if (!Number.isFinite(value)) {
          skippedBadValue++;
          continue;
        }
        obsGeoIds.push(geoId);
        obsValues.push(value);
        obsQualifiers.push(p.tax_class ?? null);
      }

      if (obsGeoIds.length > 0) {
        const obsResult = await writeClient.query(
          `INSERT INTO substrate.observations
             (series_id, period, geo_id, value, raw_value, qualifier, collected_at)
           SELECT $1::uuid, CURRENT_DATE, u.geo_id::uuid, u.value, NULL, u.qualifier, NOW()
           FROM unnest($2::text[], $3::numeric[], $4::text[])
             AS u(geo_id, value, qualifier)
           ON CONFLICT (series_id, period, geo_id) DO UPDATE SET
             value = EXCLUDED.value, qualifier = EXCLUDED.qualifier, collected_at = EXCLUDED.collected_at`,
          [seriesId, obsGeoIds, obsValues, obsQualifiers]
        );
        totalObsUpserts += obsResult.rowCount ?? 0;
      }

      await writeClient.query("COMMIT");
      console.log(`[upsert] page ${pageIdx}: geo=${geoResult.rowCount} obs=${obsGeoIds.length}`);
    } catch (err) {
      await writeClient.query("ROLLBACK");
      throw err;
    } finally {
      writeClient.release();
    }

    if (page.length < PAGE_SIZE) break;
  }

  console.log("");
  console.log(`[summary] fetched parcels:           ${totalParcels}`);
  console.log(`[summary] geo_dimension upserts:     ${totalGeoUpserts}`);
  console.log(`[summary] observations upserts:      ${totalObsUpserts}`);
  console.log(`[summary] skipped (no account_num):  ${skippedNoAccount}`);
  console.log(`[summary] skipped (bad assessed_v):  ${skippedBadValue}`);

  if (!opts.dryRun) {
    await pool.query(
      `INSERT INTO snapshot_log (taken_at, source, records_inserted, status, error)
       VALUES (NOW(), $1, $2, 'ok', NULL)`,
      [`substrate.observations.${SERIES_SLUG}`, totalObsUpserts]
    );
    await pool.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY substrate.latest_observations`);
    console.log(`[refresh] substrate.latest_observations refreshed concurrently`);
  }

  console.log("[done] parcel snapshot complete");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FATAL:", e);
    process.exit(1);
  });
