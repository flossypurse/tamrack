#!/usr/bin/env npx tsx
/**
 * One-shot backfill for substrate.geo_dimension.
 *
 * Populates three tiers of rows with centroids:
 *   1. Alberta (province, no centroid)
 *   2. ~419 Alberta municipalities — centroids from regionaldashboard.alberta.ca
 *      /api/geojson/csds polygons, joined on CSDUID against /api/lookup/municipalities
 *   3. ~407 Edmonton neighbourhoods — centroids from data.edmonton.ca dataset 3b6m-fezs
 *      (Neighbourhoods - Centroid Point), parented to the Edmonton muni row
 *
 * Idempotent: UPSERTs on the UNIQUE (slug) constraint. Safe to re-run.
 * Writes one row per stage to snapshot_log under source 'substrate.geo_dimension.backfill'.
 *
 * Usage:
 *   DATABASE_URL=postgres://.../tamrack npx tsx scripts/backfill-substrate-geo-dimension.ts
 *   DATABASE_URL=... npx tsx scripts/backfill-substrate-geo-dimension.ts --dry-run
 *
 * --dry-run fetches + transforms but skips DB writes. Useful for verifying
 * upstream availability and coverage when prod DB access isn't reachable.
 */
import { getDb } from "../src/lib/db";

const ARD_BASE = "https://regionaldashboard.alberta.ca";
const EDM_NEIGHBOURHOOD_CENTROIDS = "https://data.edmonton.ca/resource/3b6m-fezs.json";

// Edmonton's StatsCan CSDUID — used to confirm we wrote a parent row before
// resolving neighbourhood parent_id below.
const EDMONTON_CSDUID = "4811061";

interface ArdMunicipality {
  csdu_id: string;
  name: string;
  csd_name_encoded_for_seo: string;
}

interface ArdGeoFeature {
  type: "Feature";
  properties: { CSDUID: string; CSDName?: string };
  geometry:
    | { type: "Polygon"; coordinates: number[][][] }
    | { type: "MultiPolygon"; coordinates: number[][][][] };
}

interface EdmontonNeighbourhood {
  number: string;
  name_mixed: string;
  latitude: string;
  longitude: string;
}

interface GeoRow {
  slug: string;
  name: string;
  geo_type: string;
  csduid: string | null;
  parent_slug: string | null;
  centroid_lat: number | null;
  centroid_lon: number | null;
}

// Centroid of all vertices in a polygon ring set. Not the area-weighted
// centroid — for proportional-symbol overlays the vertex-mean is within a
// few hundred metres of true centre, which is well inside the
// symbol-rendering precision. Trades exactness for one less dependency.
function vertexCentroid(geom: ArdGeoFeature["geometry"]): { lat: number; lon: number } | null {
  const rings: number[][][] = [];
  if (geom.type === "Polygon") {
    rings.push(...geom.coordinates);
  } else if (geom.type === "MultiPolygon") {
    for (const poly of geom.coordinates) rings.push(...poly);
  }
  let sumLon = 0;
  let sumLat = 0;
  let n = 0;
  for (const ring of rings) {
    for (const [lon, lat] of ring) {
      sumLon += lon;
      sumLat += lat;
      n++;
    }
  }
  if (n === 0) return null;
  return { lat: sumLat / n, lon: sumLon / n };
}

async function fetchJson<T>(url: string, timeoutMs = 120_000): Promise<T> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 tamrack-substrate-backfill" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

async function buildRows(): Promise<GeoRow[]> {
  console.log("[fetch] ARD municipalities…");
  const munis = await fetchJson<ArdMunicipality[]>(`${ARD_BASE}/api/lookup/municipalities`);
  console.log(`        ${munis.length} municipalities`);

  console.log("[fetch] ARD CSD geometries…");
  const fc = await fetchJson<{ features: ArdGeoFeature[] }>(`${ARD_BASE}/api/geojson/csds`);
  console.log(`        ${fc.features.length} polygons`);

  const centroidByCsduid = new Map<string, { lat: number; lon: number }>();
  for (const f of fc.features) {
    const c = vertexCentroid(f.geometry);
    if (c) centroidByCsduid.set(f.properties.CSDUID, c);
  }

  console.log("[fetch] Edmonton neighbourhood centroids…");
  // Dataset has ~407 rows; pull a single page large enough to cover them all
  // in one request (Socrata caps at 50k per page by default).
  const nbhds = await fetchJson<EdmontonNeighbourhood[]>(`${EDM_NEIGHBOURHOOD_CENTROIDS}?$limit=10000`);
  console.log(`        ${nbhds.length} neighbourhoods`);

  const rows: GeoRow[] = [];

  rows.push({
    slug: "alberta",
    name: "Alberta",
    geo_type: "province",
    csduid: null,
    parent_slug: null,
    centroid_lat: null,
    centroid_lon: null,
  });

  for (const m of munis) {
    const c = centroidByCsduid.get(m.csdu_id) ?? null;
    rows.push({
      slug: m.csd_name_encoded_for_seo,
      name: m.name,
      geo_type: "municipality",
      csduid: m.csdu_id,
      parent_slug: "alberta",
      centroid_lat: c ? c.lat : null,
      centroid_lon: c ? c.lon : null,
    });
  }

  for (const n of nbhds) {
    const lat = parseFloat(n.latitude);
    const lon = parseFloat(n.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    rows.push({
      slug: `edm-nbhd-${n.number}`,
      name: n.name_mixed,
      geo_type: "neighbourhood",
      csduid: null,
      parent_slug: "edmonton",
      centroid_lat: lat,
      centroid_lon: lon,
    });
  }

  return rows;
}

function roundCoord(v: number | null): number | null {
  // geo_dimension.centroid_{lat,lon} is NUMERIC(9,6); round to 6 decimals
  // (≈11 cm) to keep INSERT values stable across runs.
  if (v === null) return null;
  return Math.round(v * 1_000_000) / 1_000_000;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const rows = await buildRows();

  const muniRows = rows.filter((r) => r.geo_type === "municipality");
  const nbhdRows = rows.filter((r) => r.geo_type === "neighbourhood");
  const muniWithCentroid = muniRows.filter((r) => r.centroid_lat !== null).length;
  const nbhdWithCentroid = nbhdRows.filter((r) => r.centroid_lat !== null).length;

  console.log("");
  console.log(`[summary] province rows:       1`);
  console.log(`[summary] municipality rows:   ${muniRows.length} (${muniWithCentroid} with centroid)`);
  console.log(`[summary] neighbourhood rows:  ${nbhdRows.length} (${nbhdWithCentroid} with centroid)`);
  const pct = ((muniWithCentroid + nbhdWithCentroid) / (muniRows.length + nbhdRows.length)) * 100;
  console.log(`[summary] centroid coverage:   ${pct.toFixed(1)}%`);

  if (dryRun) {
    console.log("[dry-run] skipping DB writes");
    console.log("[dry-run] sample muni:", JSON.stringify(muniRows[0]));
    console.log("[dry-run] sample nbhd:", JSON.stringify(nbhdRows[0]));
    return;
  }

  const pool = await getDb();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Pass 1: insert without parent_id so all slugs resolve. Pass 2: backfill
    // parent_id via subquery. Two passes are needed because municipalities
    // reference Alberta and neighbourhoods reference Edmonton, both of which
    // are rows in the same table.
    let inserted = 0;
    for (const r of rows) {
      const result = await client.query(
        `INSERT INTO substrate.geo_dimension (slug, name, geo_type, csduid, centroid_lat, centroid_lon)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (slug) DO UPDATE SET
           name = EXCLUDED.name,
           geo_type = EXCLUDED.geo_type,
           csduid = EXCLUDED.csduid,
           centroid_lat = EXCLUDED.centroid_lat,
           centroid_lon = EXCLUDED.centroid_lon`,
        [r.slug, r.name, r.geo_type, r.csduid, roundCoord(r.centroid_lat), roundCoord(r.centroid_lon)]
      );
      inserted += result.rowCount ?? 0;
    }
    console.log(`[upsert] ${inserted} rows touched`);

    // Pass 2: resolve parent_id from parent_slug. Single UPDATE per
    // distinct parent — only two parents (alberta, edmonton) so trivial.
    await client.query(
      `UPDATE substrate.geo_dimension AS child
       SET parent_id = parent.id
       FROM substrate.geo_dimension AS parent
       WHERE parent.slug = 'alberta'
         AND child.geo_type = 'municipality'
         AND (child.parent_id IS NULL OR child.parent_id <> parent.id)`
    );
    await client.query(
      `UPDATE substrate.geo_dimension AS child
       SET parent_id = parent.id
       FROM substrate.geo_dimension AS parent
       WHERE parent.slug = 'edmonton'
         AND child.geo_type = 'neighbourhood'
         AND (child.parent_id IS NULL OR child.parent_id <> parent.id)`
    );

    // Sanity check: confirm Edmonton landed and is the resolved parent for
    // neighbourhoods. Fails loudly if the muni endpoint ever drops Edmonton.
    const edm = await client.query(
      `SELECT id FROM substrate.geo_dimension WHERE slug = 'edmonton' AND csduid = $1`,
      [EDMONTON_CSDUID]
    );
    if (edm.rowCount === 0) {
      throw new Error(`Edmonton parent row missing after upsert (CSDUID ${EDMONTON_CSDUID})`);
    }

    await client.query(
      `INSERT INTO snapshot_log (taken_at, source, records_inserted, status, error)
       VALUES (NOW(), $1, $2, 'ok', NULL)`,
      ["substrate.geo_dimension.backfill", rows.length]
    );

    await client.query("COMMIT");
    console.log("[done] backfill committed");

    const verify = await client.query(
      `SELECT
         COUNT(*) FILTER (WHERE geo_type IN ('municipality', 'neighbourhood')) AS total,
         COUNT(*) FILTER (WHERE geo_type IN ('municipality', 'neighbourhood') AND centroid_lat IS NOT NULL) AS with_centroid
       FROM substrate.geo_dimension`
    );
    const v = verify.rows[0];
    const coverage = (Number(v.with_centroid) / Number(v.total)) * 100;
    console.log(`[verify] muni+nbhd coverage: ${v.with_centroid}/${v.total} = ${coverage.toFixed(1)}%`);
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
