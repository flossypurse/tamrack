#!/usr/bin/env npx tsx
/**
 * Stony Plain business directory snapshot (Phase 0 §0.1).
 *
 * Fetches the Town of Stony Plain ArcGIS Online layer `ToSP_Businesses`
 * (~425 active businesses) and upserts each as a row in substrate.entities
 * (kind='business'). The business directory is a slow-changing dimension,
 * not a time-series fact, so it lives in entities rather than observations:
 *
 *   * `first_seen` / `last_seen` capture presence over time without
 *     writing 425 obs/day into the fact table (~155K rows/year saved).
 *   * Diff queries become simple WHERE clauses:
 *       new openings:    first_seen = CURRENT_DATE
 *       recent closures: last_seen < CURRENT_DATE - INTERVAL '1 day'
 *
 * Source: services.arcgis.com/ScgF04sks0ZKbWe3 — Stony Plain's hosted
 * ArcGIS Online org. The dataset has no issue/expiry fields, just NAME,
 * CATEGORY, Linc, Roll, and point geometry. Captured as entity attrs.
 *
 * Slug per business: `stony-plain-biz-${FID}`. FID is ArcGIS's stable
 * dataset-internal ID. A republish-from-scratch would regenerate FIDs and
 * produce one-time apparent churn (all old entities go stale, all new ones
 * appear); swap to a composite (Linc, Roll) key at that point.
 *
 * Idempotent: re-running the same day refreshes last_seen on all 425
 * entities without affecting first_seen. Includes --dry-run.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/fetch-stony-plain-businesses.ts
 *   DATABASE_URL=... npx tsx scripts/fetch-stony-plain-businesses.ts --dry-run
 */
import { getDb } from "../src/lib/db";
import { fetchWithRetry } from "../src/lib/fetch-utils";

const SOURCE_NAME = "Stony Plain ArcGIS Online";
const SOURCE_BASE = "https://services.arcgis.com/ScgF04sks0ZKbWe3";
const ENTITY_KIND = "business";
const STONY_PLAIN_SLUG = "stony-plain";
const SERIES_SLUG = "stony-plain-businesses";

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
  while (offset < 50_000) {
    const url = `${QUERY_URL}&resultOffset=${offset}&resultRecordCount=${pageSize}`;
    const res = await fetchWithRetry(url, { userAgent: "tamrack-stony-plain-businesses" });
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

  const valid = features.filter((f) => f.attributes && typeof f.attributes.FID === "number");
  console.log(`[fetch] ${valid.length} features with valid FID`);

  if (dryRun) {
    console.log("[dry-run] sample feature:", JSON.stringify(valid[0], null, 2));
    console.log(`[dry-run] would upsert: 1 source, ${valid.length} entities (kind='${ENTITY_KIND}')`);
    return;
  }

  const pool = await getDb();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

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

    const src = await client.query(
      `INSERT INTO substrate.sources (name, base_url, auth_type)
       VALUES ($1, $2, 'public')
       ON CONFLICT (name) DO UPDATE SET base_url = EXCLUDED.base_url
       RETURNING id`,
      [SOURCE_NAME, SOURCE_BASE]
    );
    const sourceId: string = src.rows[0].id;

    // Series_metadata row: storage_kind='entity+observation' because we
    // maintain both the entity dimension (one row per business) AND a
    // daily count observation (one row per day with value=count(active)).
    // Without the count observation, the composer can't answer "how many
    // businesses in Stony Plain over time?" — entities alone don't
    // expose a time-series.
    const ser = await client.query(
      `INSERT INTO substrate.series_metadata
         (slug, domain, name, source_id, unit, unit_type, cadence, geo_id,
          description, tags, upstream_key, storage_kind, entity_kind)
       VALUES
         ($1, 'business_directory', 'Stony Plain active businesses',
          $2, 'businesses', 'count', 'daily', $3,
          'Per-business entities (kind=business) with first_seen/last_seen presence, plus one daily count observation (value=count(active entities in Stony Plain)). Diff queries against entities; count time-series against observations.',
          ARRAY['tri-region','business-directory','direct-fetch']::text[],
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
        stonyId,
        JSON.stringify({ kind: "arcgis", url: QUERY_URL }),
        ENTITY_KIND,
      ]
    );
    const seriesId: string = ser.rows[0].id;

    // Upsert one entity row per business. ON CONFLICT (slug) DO UPDATE
    // refreshes last_seen + mutable attrs but leaves first_seen at the
    // initial-discovery date. A subsequent run that misses a business
    // (the directory removed it) leaves that entity's last_seen at its
    // prior value — that's how we detect closures.
    let entityUpserts = 0;
    for (const f of valid) {
      const slug = `stony-plain-biz-${f.attributes.FID}`;
      const name = (f.attributes.NAME ?? "(unnamed)").trim() || "(unnamed)";
      const lon = roundCoord(f.geometry?.x ?? null);
      const lat = roundCoord(f.geometry?.y ?? null);
      const attrs = {
        FID: f.attributes.FID,
        NAME: f.attributes.NAME,
        CATEGORY: f.attributes.CATEGORY,
        Linc: f.attributes.Linc,
        Roll: f.attributes.Roll,
      };
      const r = await client.query(
        `INSERT INTO substrate.entities
           (slug, kind, name, geo_id, attrs, centroid_lat, centroid_lon, source_id, first_seen, last_seen)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, CURRENT_DATE, CURRENT_DATE)
         ON CONFLICT (slug) DO UPDATE SET
           name = EXCLUDED.name,
           geo_id = EXCLUDED.geo_id,
           attrs = EXCLUDED.attrs,
           centroid_lat = EXCLUDED.centroid_lat,
           centroid_lon = EXCLUDED.centroid_lon,
           source_id = EXCLUDED.source_id,
           last_seen = CURRENT_DATE`,
        [slug, ENTITY_KIND, name, stonyId, JSON.stringify(attrs), lat, lon, sourceId]
      );
      entityUpserts += r.rowCount ?? 0;
    }

    // Sanity report: how many businesses haven't been seen today (potential closures).
    const staleCount = await client.query(
      `SELECT count(*)::int AS n
         FROM substrate.entities
         WHERE kind = $1 AND geo_id = $2 AND last_seen < CURRENT_DATE`,
      [ENTITY_KIND, stonyId]
    );

    // Daily count observation: one row per run-day with value =
    // count(active entities seen today). Gives the composer a normal
    // time-series to plot ("Stony Plain businesses over time") without
    // requiring it to aggregate entities at query time.
    const activeCount = await client.query(
      `SELECT count(*)::int AS n
         FROM substrate.entities
         WHERE kind = $1 AND geo_id = $2 AND last_seen = CURRENT_DATE`,
      [ENTITY_KIND, stonyId]
    );
    await client.query(
      `INSERT INTO substrate.observations
         (series_id, period, geo_id, entity_id, value, raw_value, qualifier, collected_at)
       VALUES ($1, CURRENT_DATE, $2, NULL, $3, NULL, NULL, NOW())
       ON CONFLICT (series_id, period, geo_id, entity_id) DO UPDATE SET
         value = EXCLUDED.value, collected_at = EXCLUDED.collected_at`,
      [seriesId, stonyId, activeCount.rows[0].n]
    );

    await client.query(
      `INSERT INTO snapshot_log (taken_at, source, records_inserted, status, error)
       VALUES (NOW(), $1, $2, 'ok', NULL)`,
      [`substrate.entities.${ENTITY_KIND}.stony-plain`, entityUpserts]
    );

    await client.query("COMMIT");
    console.log(`[upsert] entities: ${entityUpserts} rows touched (today's directory)`);
    console.log(`[count]  active businesses today: ${activeCount.rows[0].n}`);
    console.log(`[diff]   stale (last_seen < today): ${staleCount.rows[0].n}`);

    // Refresh the matview so today's count observation is visible to scorecards.
    const refreshResult = await pool.query<{ refresh_latest_observations: boolean }>(
      `SELECT substrate.refresh_latest_observations()`
    );
    const refreshed = refreshResult.rows[0]?.refresh_latest_observations;
    console.log(`[refresh] latest_observations: ${refreshed ? "refreshed" : "skipped (advisory lock held)"}`);

    console.log("[done]   snapshot committed");
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
