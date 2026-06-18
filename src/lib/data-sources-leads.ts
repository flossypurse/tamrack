/**
 * Data fetcher for the per-geo demand-heat lead-score composite.
 *
 * This module is the boundary between the database and the pure scorer.
 * It fetches inputs from existing Postgres tables (read-only SELECT only —
 * no writes, no upserts) and hands plain objects to `computeLeadScores`.
 *
 * === Sources ===
 *
 *   Hiring momentum    — jobbank_postings / jobbank_monthly (per-city Tier-B
 *                        count + MoM momentum). Populated by the daily Job
 *                        Bank collector. If no rows exist yet, returns an
 *                        empty array and the scorer fills those slots with
 *                        the no-data neutral (0.5 when all empty, 0 otherwise).
 *
 *   Permit expansion   — municipality_permits (permit count per municipality
 *                        per snapshot_date). Two most-recent snapshots per
 *                        municipality are fetched; the scorer computes growth.
 *
 *   Business formation — regional_indicators WHERE indicator = 'Incorporations'
 *                        (per csduid, most recent period). The ARD indicator
 *                        name is case-sensitive; 'Incorporations' is the value
 *                        observed in the wild.
 *
 *   Procurement        — opportunities table, open tenders count. This is
 *                        ONE number (provincial backdrop), not per-geo.
 *
 * === Column assumptions (confirm before first deploy) ===
 *
 *   municipality_permits: snapshot_date TEXT, municipality TEXT,
 *                          group_name TEXT, count INTEGER, total_value FLOAT
 *     The scorer aggregates all group_name rows per (municipality, snapshot_date).
 *     If NO geo has permit data the dimension has no variance and normalizes to
 *     a flat 0.5; if SOME do, geos without it contribute 0 and rank low there.
 *
 *   regional_indicators: csduid TEXT, municipality TEXT, indicator TEXT,
 *                         period TEXT, value FLOAT
 *     Queried with indicator = 'Incorporations' (exact string match).
 *     If no rows exist, formation dimension defaults to 0.
 *
 *   opportunities: closing_date TEXT, status TEXT
 *     Open = closing_date >= today (or empty) — matches the existing
 *     readOpportunities() logic. Count only (no row fetch).
 */

import { getDb } from "./db";
import { MUNICIPALITY_REGISTRY } from "./municipality-registry";
import {
  readHiringSummary,
} from "./data-sources-jobbank";
import {
  computeLeadScores,
  type LeadScoreInputs,
  type LeadScoreResult,
  type GeoDescriptor,
  type MuniPermitInput,
  type GeoFormationInput,
} from "./leads-score";

// ---------------------------------------------------------------------------
// Registry helpers
// ---------------------------------------------------------------------------

/**
 * Returns the canonical geo list consumed by the scorer.
 * Includes all registry entries — live and planned — so no geo is silently
 * excluded just because its ArcGIS endpoints are unavailable. The csduid
 * field is set to '' for entries that don't carry one in the registry; the
 * scorer will find no formation data for those geos and fall back to neutral.
 */
function getGeoDescriptors(): GeoDescriptor[] {
  return MUNICIPALITY_REGISTRY.map((m) => ({
    slug: m.slug,
    name: m.name,
    // The MunicipalityConfig type does not expose csduid directly.
    // We derive it from the name by looking up the regional_indicators table
    // at query time. For the descriptor list we use '' and rely on the
    // formation query to populate formationByCsduid keyed on what the DB has.
    // The slug is used for permit + hiring matching; csduid is used only for
    // formation lookup.
    csduid: "",
  }));
}

// ---------------------------------------------------------------------------
// Individual input fetchers (all SELECT-only, never write)
// ---------------------------------------------------------------------------

/**
 * Fetch per-city Tier-B hiring counts from the most recent stored Job Bank
 * month, plus the MoM delta from the monthly aggregate.
 *
 * Returns hiringByCity array + the data month string.
 * Returns { hiringByCity: [], hiringMonth: null } when no data is stored yet.
 */
async function fetchHiringInputs(): Promise<{
  hiringByCity: LeadScoreInputs["hiringByCity"];
  hiringMonth: string | null;
  momDeltaPct: number | null;
}> {
  try {
    const summary = await readHiringSummary();
    if (!summary) return { hiringByCity: [], hiringMonth: null, momDeltaPct: null };

    const momDeltaPct = summary.momentum?.deltaPct ?? null;

    // byCity gives us total Tier-B count per city.
    // The MoM delta is province-level, so we broadcast it to every city row
    // as a proxy (best available at v1 — no per-city prior-month breakdown
    // is stored in the DB).
    const hiringByCity = summary.byCity.map((c) => ({
      city: c.city,
      tierBCount: c.count,
      momDeltaPct,
    }));

    return { hiringByCity, hiringMonth: summary.month, momDeltaPct };
  } catch (err) {
    console.warn("[leads] hiring fetch failed:", err);
    return { hiringByCity: [], hiringMonth: null, momDeltaPct: null };
  }
}

/**
 * Fetch permit volume per municipality from municipality_permits.
 *
 * Aggregates all group_name rows for each (municipality, snapshot_date) so
 * the permit count is a total-permits-issued number per snapshot, not split
 * by permit type.
 *
 * Returns permitsBySlug keyed on a normalized municipality name. The key
 * normalization attempts a slug-like lowercasing + hyphenation; the scorer
 * also tries city-name matching so imperfect alignment is tolerated.
 *
 * COLUMN ASSUMPTIONS:
 *   municipality_permits.snapshot_date TEXT  — ISO date 'YYYY-MM-DD'
 *   municipality_permits.municipality TEXT   — municipality name (varies by source)
 *   municipality_permits.count INTEGER       — permit count for this group
 */
async function fetchPermitInputs(
  registryNames: Map<string, string>,
): Promise<{
  permitsBySlug: LeadScoreInputs["permitsBySlug"];
  permitSnapshotDate: string | null;
}> {
  try {
    const pool = await getDb();

    // Get the two most-recent snapshot_dates per municipality in one query.
    // We use a window function to rank snapshots per municipality.
    const { rows } = await pool.query<{
      municipality: string;
      snapshot_date: string;
      total_count: string;
      snap_rank: string;
    }>(`
      SELECT municipality, snapshot_date,
             SUM(count)::BIGINT AS total_count,
             RANK() OVER (PARTITION BY municipality ORDER BY snapshot_date DESC) AS snap_rank
        FROM municipality_permits
       GROUP BY municipality, snapshot_date
    `);

    if (rows.length === 0) {
      return { permitsBySlug: {}, permitSnapshotDate: null };
    }

    // Group by municipality: latest and prior snapshot
    type SnapData = { total: number; date: string };
    const byMuni = new Map<string, { latest: SnapData; prior: SnapData | null }>();

    for (const r of rows) {
      const rank = Number(r.snap_rank);
      if (rank > 2) continue; // only need two most-recent snapshots
      const muni = r.municipality;
      const total = Number(r.total_count);
      const existing = byMuni.get(muni);
      if (rank === 1) {
        if (!existing) {
          byMuni.set(muni, { latest: { total, date: r.snapshot_date }, prior: null });
        } else {
          existing.latest = { total, date: r.snapshot_date };
        }
      } else {
        // rank === 2 = prior snapshot
        if (!existing) {
          byMuni.set(muni, {
            latest: { total: 0, date: "" },
            prior: { total, date: r.snapshot_date },
          });
        } else {
          existing.prior = { total, date: r.snapshot_date };
        }
      }
    }

    // Determine the overall latest snapshot date (for meta)
    let permitSnapshotDate: string | null = null;
    for (const v of byMuni.values()) {
      if (v.latest.date && (!permitSnapshotDate || v.latest.date > permitSnapshotDate)) {
        permitSnapshotDate = v.latest.date;
      }
    }

    // Map municipality name -> slug using the registry lookup
    const permitsBySlug: LeadScoreInputs["permitsBySlug"] = {};
    for (const [muniName, snapData] of byMuni.entries()) {
      if (!snapData.latest.date) continue; // incomplete entry
      const slug = registryNames.get(muniName.toLowerCase());
      if (!slug) continue; // no registry match — skip
      const row: MuniPermitInput = {
        municipality: muniName,
        count: snapData.latest.total,
        priorCount: snapData.prior?.total ?? null,
      };
      permitsBySlug[slug] = row;
    }

    return { permitsBySlug, permitSnapshotDate };
  } catch (err) {
    console.warn("[leads] permit fetch failed:", err);
    return { permitsBySlug: {}, permitSnapshotDate: null };
  }
}

/**
 * Fetch business-formation data from regional_indicators WHERE indicator = 'Incorporations'.
 *
 * Returns formationByCsduid keyed on csduid.
 *
 * COLUMN ASSUMPTIONS:
 *   regional_indicators.csduid TEXT      — Alberta CSD code
 *   regional_indicators.indicator TEXT   — exact string 'Incorporations'
 *   regional_indicators.period TEXT      — ISO period (compared lexicographically)
 *   regional_indicators.value FLOAT      — indicator value
 */
async function fetchFormationInputs(): Promise<{
  formationByCsduid: LeadScoreInputs["formationByCsduid"];
  formationPeriod: string | null;
  csduidToSlug: Map<string, string>;
}> {
  try {
    const pool = await getDb();

    // Most-recent Incorporations value per csduid
    const { rows } = await pool.query<{
      csduid: string;
      municipality: string;
      value: string;
      period: string;
    }>(`
      SELECT DISTINCT ON (csduid)
             csduid, municipality, value::FLOAT AS value, period
        FROM regional_indicators
       WHERE indicator = 'Incorporations'
         AND csduid IS NOT NULL
         AND csduid <> ''
       ORDER BY csduid, period DESC
    `);

    if (rows.length === 0) {
      return { formationByCsduid: {}, formationPeriod: null, csduidToSlug: new Map() };
    }

    // Determine the most common/latest period for meta
    const periodCounts = new Map<string, number>();
    for (const r of rows) {
      periodCounts.set(r.period, (periodCounts.get(r.period) ?? 0) + 1);
    }
    // Use the most-frequently-seen period as representative
    let formationPeriod: string | null = null;
    let maxCount = 0;
    for (const [period, count] of periodCounts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        formationPeriod = period;
      }
    }

    const formationByCsduid: LeadScoreInputs["formationByCsduid"] = {};
    const csduidToSlug = new Map<string, string>();

    // Also build a municipality-name -> csduid mapping for registry enrichment
    const muniNameToCsduid = new Map<string, string>();

    for (const r of rows) {
      const formation: GeoFormationInput = {
        csduid: r.csduid,
        incorporations: Number(r.value),
      };
      formationByCsduid[r.csduid] = formation;
      muniNameToCsduid.set(r.municipality.toLowerCase(), r.csduid);
    }

    // Enrich csduidToSlug by matching DB municipality names to registry slugs
    for (const m of MUNICIPALITY_REGISTRY) {
      const csduid = muniNameToCsduid.get(m.name.toLowerCase());
      if (csduid) csduidToSlug.set(csduid, m.slug);
    }

    return { formationByCsduid, formationPeriod, csduidToSlug };
  } catch (err) {
    console.warn("[leads] formation fetch failed:", err);
    return { formationByCsduid: {}, formationPeriod: null, csduidToSlug: new Map() };
  }
}

/**
 * Count open opportunities (provincial procurement backdrop).
 *
 * COLUMN ASSUMPTIONS:
 *   opportunities.closing_date TEXT  — ISO datetime or empty for standing notices
 */
async function fetchOpenTenderCount(): Promise<number> {
  try {
    const pool = await getDb();
    const todayIso = new Date().toISOString().slice(0, 10);
    const { rows } = await pool.query<{ cnt: string }>(`
      SELECT COUNT(*)::BIGINT AS cnt
        FROM opportunities
       WHERE closing_date = ''
          OR LEFT(closing_date, 10) >= $1
    `, [todayIso]);
    return Number(rows[0]?.cnt ?? 0);
  } catch (err) {
    console.warn("[leads] tender count failed:", err);
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Fetch all lead-score inputs from the database and run the pure scorer.
 *
 * @param limitToSlugs - Optional array of municipality slugs to restrict the
 *                       result to (e.g. from a `?limit=N` API parameter that
 *                       wants only the top N geos). Omit to score all geos.
 * @returns            Ranked `LeadScoreResult` — compute-on-read, no writes.
 */
export async function readLeadScores(limitToSlugs?: string[]): Promise<LeadScoreResult> {
  // Build registry lookup maps
  const registryNames = new Map<string, string>(); // lookup key -> slug
  for (const m of MUNICIPALITY_REGISTRY) {
    registryNames.set(m.name.toLowerCase(), m.slug);
    // municipality_permits.municipality stores the registry slug verbatim
    // (e.g. "grande-prairie", "strathcona"), so the raw slug must be a key or
    // any multi-word slug silently fails to match. Also map the de-hyphenated
    // form so name-style values still resolve.
    registryNames.set(m.slug, m.slug);
    registryNames.set(m.slug.replace(/-/g, " "), m.slug);
  }

  // Fetch all inputs in parallel — failures are silently degraded to empty
  const [hiringResult, tenderCount, formationResult] = await Promise.all([
    fetchHiringInputs(),
    fetchOpenTenderCount(),
    fetchFormationInputs(),
  ]);

  const permitResult = await fetchPermitInputs(registryNames);

  // Enrich GeoDescriptors with csduid from the formation query results
  // (the registry doesn't store csduid, but regional_indicators does)
  const geoDescriptors: GeoDescriptor[] = MUNICIPALITY_REGISTRY.map((m) => {
    // Find the csduid that matched this slug
    let csduid = "";
    for (const [cs, slug] of formationResult.csduidToSlug.entries()) {
      if (slug === m.slug) {
        csduid = cs;
        break;
      }
    }
    return { slug: m.slug, name: m.name, csduid };
  });

  const inputs: LeadScoreInputs = {
    hiringByCity: hiringResult.hiringByCity,
    permitsBySlug: permitResult.permitsBySlug,
    formationByCsduid: formationResult.formationByCsduid,
    openTenderCount: tenderCount,
    hiringMonth: hiringResult.hiringMonth,
    permitSnapshotDate: permitResult.permitSnapshotDate,
    formationPeriod: formationResult.formationPeriod,
  };

  const result = computeLeadScores(geoDescriptors, inputs);

  // Apply optional slug filter AFTER scoring so normalization is over the full set
  if (limitToSlugs && limitToSlugs.length > 0) {
    const slugSet = new Set(limitToSlugs);
    result.rankings = result.rankings.filter((r) => slugSet.has(r.slug));
  }

  return result;
}
