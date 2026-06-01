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

const SOURCE_NAME = "Stony Plain ArcGIS Online";
const SOURCE_BASE = "https://services.arcgis.com/ScgF04sks0ZKbWe3";
const ENTITY_KIND = "business";
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

// Exponential backoff against transient 5xx and 429.
async function fetchWithRetry(url: string, attempts = 3, baseMs = 1000): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "tamrack-stony-plain-businesses" },
      });
      if (res.ok) return res;
      if (res.status >= 500 || res.status === 429) {
        lastErr = new Error(`HTTP ${res.status}`);
        const wait = baseMs * 2 ** (attempt - 1);
        console.warn(`[retry] ${res.status} on attempt ${attempt}/${attempts}; sleeping ${wait}ms`);
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastErr = err;
      if (attempt === attempts) break;
      const wait = baseMs * 2 ** (attempt - 1);
      console.warn(`[retry] ${(err as Error).message} on attempt ${attempt}/${attempts}; sleeping ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr ?? new Error("fetchWithRetry exhausted attempts");
}

async function fetchAllFeatures(): Promise<ArcgisFeature[]> {
  const all: ArcgisFeature[] = [];
  const pageSize = 2000;
  let offset = 0;
  while (offset < 50_000) {
    const url = `${QUERY_URL}&resultOffset=${offset}&resultRecordCount=${pageSize}`;
    const res = await fetchWithRetry(url);
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

    await client.query(
      `INSERT INTO snapshot_log (taken_at, source, records_inserted, status, error)
       VALUES (NOW(), $1, $2, 'ok', NULL)`,
      [`substrate.entities.${ENTITY_KIND}.stony-plain`, entityUpserts]
    );

    await client.query("COMMIT");
    console.log(`[upsert] entities: ${entityUpserts} rows touched (today's directory)`);
    console.log(`[diff]   stale (last_seen < today): ${staleCount.rows[0].n}`);
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
