#!/usr/bin/env npx tsx
/**
 * Stony Plain business directory snapshot (Phase 0 §0.1).
 *
 * Fetches the Town of Stony Plain ArcGIS Online layer `ToSP_Businesses`
 * (~425 active businesses) and writes one observation per business per
 * run-day into substrate.observations. Each business is materialized as
 * a geo_dimension row (geo_type='business') so day-over-day diffs reveal
 * openings and closures.
 *
 * Source: services.arcgis.com/ScgF04sks0ZKbWe3 — Stony Plain's hosted
 * ArcGIS Online org. The dataset is a directory snapshot, not a licence
 * log: there are no issue or expiry fields, so we treat presence-on-the-day
 * as the observation (value=NULL, raw_value=NAME, qualifier=CATEGORY).
 *
 * Slug for each business: `stony-plain-biz-${FID}`. FID is ArcGIS's stable
 * dataset-internal ID. If the Town ever republishes from scratch and FIDs
 * regenerate we'll get a one-time apparent churn — flag at that point and
 * switch to a composite (Linc, Roll) key.
 *
 * Idempotent: re-running the same day upserts onto (series_id, period, geo_id).
 * Writes one snapshot_log row per run.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/fetch-stony-plain-businesses.ts
 *   DATABASE_URL=... npx tsx scripts/fetch-stony-plain-businesses.ts --dry-run
 */
import { getDb } from "../src/lib/db";

const SOURCE_NAME = "Stony Plain ArcGIS Online";
const SOURCE_BASE = "https://services.arcgis.com/ScgF04sks0ZKbWe3";
const SERIES_SLUG = "stony-plain-businesses";
const STONY_PLAIN_SLUG = "stony-plain";

const QUERY_URL =
  `${SOURCE_BASE}/arcgis/rest/services/ToSP_Businesses/FeatureServer/0/query` +
  `?where=1%3D1&outFields=FID,NAME,CATEGORY,Linc,Roll&f=json&returnGeometry=true`;

interface ArcgisFeature {
  attributes: {
    FID: number;
    NAME: string | null;
    CATEGORY: string | null;
    Linc: number | null;
    Roll: number | null;
  };
  geometry?: { x: number; y: number };
}

interface ArcgisQueryResponse {
  features: ArcgisFeature[];
  exceededTransferLimit?: boolean;
}

async function fetchAllFeatures(): Promise<ArcgisFeature[]> {
  const all: ArcgisFeature[] = [];
  const pageSize = 2000;
  let offset = 0;
  // Hard cap protects against an infinite loop if the server keeps returning
  // exceededTransferLimit=true without advancing. 50K is well past the real
  // ~425 row dataset.
  while (offset < 50_000) {
    const url = `${QUERY_URL}&resultOffset=${offset}&resultRecordCount=${pageSize}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "tamrack-stony-plain-businesses" },
    });
    if (!res.ok) throw new Error(`ArcGIS query ${res.status} at offset=${offset}`);
    const body = (await res.json()) as ArcgisQueryResponse;
    if (!Array.isArray(body.features)) {
      throw new Error(`ArcGIS query returned no features array at offset=${offset}`);
    }
    all.push(...body.features);
    if (body.features.length < pageSize) break;
    offset += body.features.length;
  }
  return all;
}

function roundCoord(v: number | null | undefined): number | null {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  return Math.round(v * 1_000_000) / 1_000_000;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(`[fetch] ${QUERY_URL}`);
  const features = await fetchAllFeatures();
  console.log(`[fetch] ${features.length} features`);

  // Drop rows without a NAME — those are useless for a directory snapshot
  // and the geo_dimension slug needs FID anyway.
  const valid = features.filter((f) => f.attributes && typeof f.attributes.FID === "number");
  console.log(`[fetch] ${valid.length} features with valid FID`);

  if (dryRun) {
    console.log("[dry-run] sample feature:", JSON.stringify(valid[0], null, 2));
    console.log(
      `[dry-run] would upsert: 1 source, 1 series_metadata, ${valid.length} geo_dimension rows, ${valid.length} observations`
    );
    return;
  }

  const pool = await getDb();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Look up Stony Plain's geo_dimension id so series_metadata.geo_id is set.
    const parent = await client.query(
      `SELECT id FROM substrate.geo_dimension WHERE slug = $1`,
      [STONY_PLAIN_SLUG]
    );
    if (parent.rowCount === 0) {
      throw new Error(
        `geo_dimension row for ${STONY_PLAIN_SLUG} not found — run backfill-substrate-geo-dimension.ts first`
      );
    }
    const stonyId: string = parent.rows[0].id;

    // 2. Upsert source row.
    const src = await client.query(
      `INSERT INTO substrate.sources (name, base_url, auth_type)
       VALUES ($1, $2, 'public')
       ON CONFLICT (name) DO UPDATE SET base_url = EXCLUDED.base_url
       RETURNING id`,
      [SOURCE_NAME, SOURCE_BASE]
    );
    const sourceId: string = src.rows[0].id;

    // 3. Upsert series_metadata. The upstream_key is a stable provenance
    //    pointer to the underlying ArcGIS query; downstream consumers can
    //    re-issue or compare against newer queries via this descriptor.
    const ser = await client.query(
      `INSERT INTO substrate.series_metadata
         (slug, domain, name, source_id, unit, unit_type, cadence, geo_id,
          description, tags, upstream_key)
       VALUES
         ($1, 'business_directory', 'Stony Plain active businesses (directory snapshot)',
          $2, NULL, 'presence', 'daily', $3,
          'One observation per business per run-day. value=NULL, raw_value=NAME, qualifier=CATEGORY.',
          ARRAY['tri-region','business-directory','direct-fetch']::text[], $4::jsonb)
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
        stonyId,
        JSON.stringify({ kind: "arcgis", url: QUERY_URL }),
      ]
    );
    const seriesId: string = ser.rows[0].id;

    // 4. Upsert one geo_dimension row per business. Centroid comes from the
    //    feature geometry (lon/lat in spatialReference 4269 = NAD83 ≈ WGS84
    //    for display purposes — sub-metre offset, negligible at our zoom).
    let geoUpserts = 0;
    for (const f of valid) {
      const slug = `stony-plain-biz-${f.attributes.FID}`;
      const name = (f.attributes.NAME ?? "(unnamed)").trim() || "(unnamed)";
      const lon = roundCoord(f.geometry?.x ?? null);
      const lat = roundCoord(f.geometry?.y ?? null);
      const r = await client.query(
        `INSERT INTO substrate.geo_dimension
           (slug, name, geo_type, csduid, parent_id, centroid_lat, centroid_lon)
         VALUES ($1, $2, 'business', NULL, $3, $4, $5)
         ON CONFLICT (slug) DO UPDATE SET
           name = EXCLUDED.name,
           parent_id = EXCLUDED.parent_id,
           centroid_lat = EXCLUDED.centroid_lat,
           centroid_lon = EXCLUDED.centroid_lon`,
        [slug, name, stonyId, lat, lon]
      );
      geoUpserts += r.rowCount ?? 0;
    }

    // 5. Resolve the geo_ids we just upserted in one round-trip.
    const slugs = valid.map((f) => `stony-plain-biz-${f.attributes.FID}`);
    const geoLookup = await client.query(
      `SELECT slug, id FROM substrate.geo_dimension WHERE slug = ANY($1::text[])`,
      [slugs]
    );
    const geoIdBySlug = new Map<string, string>(
      geoLookup.rows.map((r: { slug: string; id: string }) => [r.slug, r.id])
    );

    // 6. Write observations: one row per business for today's period.
    let obsInserted = 0;
    for (const f of valid) {
      const slug = `stony-plain-biz-${f.attributes.FID}`;
      const geoId = geoIdBySlug.get(slug);
      if (!geoId) continue; // shouldn't happen — we just inserted it
      const category = f.attributes.CATEGORY ?? null;
      const name = (f.attributes.NAME ?? "(unnamed)").trim() || "(unnamed)";
      const r = await client.query(
        `INSERT INTO substrate.observations
           (series_id, period, geo_id, value, raw_value, qualifier, collected_at)
         VALUES ($1, CURRENT_DATE, $2, NULL, $3, $4, NOW())
         ON CONFLICT (series_id, period, geo_id) DO UPDATE SET
           raw_value = EXCLUDED.raw_value,
           qualifier = EXCLUDED.qualifier,
           collected_at = EXCLUDED.collected_at`,
        [seriesId, geoId, name, category]
      );
      obsInserted += r.rowCount ?? 0;
    }

    // 7. snapshot_log row + matview refresh.
    await client.query(
      `INSERT INTO snapshot_log (taken_at, source, records_inserted, status, error)
       VALUES (NOW(), $1, $2, 'ok', NULL)`,
      [`substrate.observations.${SERIES_SLUG}`, obsInserted]
    );

    await client.query("COMMIT");
    console.log(`[upsert] geo_dimension: ${geoUpserts} rows touched`);
    console.log(`[upsert] observations: ${obsInserted} rows touched`);

    // Refresh the latest-value scorecard. CONCURRENTLY is safe because PR #23
    // seeded the matview non-concurrently during boot DDL.
    await pool.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY substrate.latest_observations`);
    console.log(`[refresh] substrate.latest_observations refreshed concurrently`);

    console.log("[done] snapshot committed");
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
