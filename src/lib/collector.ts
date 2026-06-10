/**
 * Alberta Pulse — Shared Collection Logic
 *
 * Runs the 17 data collection phases using Postgres via getDb()/withTransaction().
 * Used by both the API route (/api/admin/collect) and the Resonate worker.
 *
 * Each phase is independent — failures in one don't block others.
 * All inserts are idempotent (upsert on unique constraints).
 */

import { getDb, withTransaction } from "./db";
import type pg from "pg";

import {
  REGIONAL_INDICATORS,
  canonicalIndicatorName,
  fetchRegionalIndicator,
  regionalIndicatorUrl,
} from "./data-sources-regional";

export { REGIONAL_INDICATORS };

import {
  type CEREndpointKey,
  fetchPipelineThroughput,
  fetchCrudeOilProduction,
  fetchApportionment,
} from "./data-sources-cer";

import {
  fetchImmigrationByCategory,
  fetchImmigrationByCMA,
} from "./data-sources-ircc";

import {
  fetchAlbertaMajorProjects,
  fetchInfrastructureProjects,
  fetchAERWellLicences,
  AERAccessBlockedError,
  type WellLicence,
} from "./data-sources-infrastructure";

import { MUNICIPALITY_REGISTRY } from "./municipality-registry";

import {
  fetchAssessmentsByGroup,
  fetchPermitsByGroup,
  fetchZoningDistribution,
} from "./municipality-data";

import { STATSCAN_SERIES } from "./data-sources";

import {
  fetchHousingStarts,
  fetchHousingCompletions,
  fetchUnderConstruction,
  fetchVacancyRates,
  fetchRentComparison,
  fetchAbsorptions,
  fetchMortgageRate,
} from "./data-sources-cmhc";

import {
  fetchOpenTenderOpportunities,
  ProcurementAccessBlockedError,
} from "./data-sources-procurement";
import { fetchJobBankPostings } from "./data-sources-jobbank";
import { fetchWithRetry } from "./fetch-utils";
import { collectHealth } from "./collect-health";
import { collectSafety } from "./collect-safety";
import { collectPolitics } from "./collect-politics";
import { collectFiscal } from "./collect-fiscal";
import { collectEnvironment } from "./collect-environment";
import { collectBusinessLicences } from "./collect-business-licences";
import { resolveAllOperators } from "./entity-resolution";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PhaseResult {
  phase: string;
  rows: number;
  elapsed: number;
  status: "ok" | "error";
  error?: string;
}

export interface CollectionResult {
  started_at: string;
  finished_at: string;
  elapsed: number;
  phases: PhaseResult[];
  total_rows: number;
}

export type SourceName =
  | "regional"
  | "energy"
  | "municipalities"
  | "wells"
  | "immigration"
  | "projects"
  | "macro"
  | "housing"
  | "procurement"
  | "jobbank"
  | "spruce-grove-proxy"
  | "stony-plain-entities"
  | "health"
  | "safety"
  | "politics"
  | "fiscal"
  | "environment"
  | "business-licences"
  | "entity-resolution"
  | "all";

// ---------------------------------------------------------------------------
// Concurrency helper
// ---------------------------------------------------------------------------

async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  maxConcurrent: number
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let index = 0;

  async function worker(): Promise<void> {
    while (index < tasks.length) {
      const i = index++;
      try {
        const value = await tasks[i]();
        results[i] = { status: "fulfilled", value };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(maxConcurrent, tasks.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// SQL helpers — parameterized queries for Postgres
// ---------------------------------------------------------------------------

const SQL = {
  upsertRegional: `
    INSERT INTO regional_indicators (csduid, municipality, indicator, period, value, unit)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT(csduid, indicator, period)
    DO UPDATE SET value = EXCLUDED.value, unit = EXCLUDED.unit, collected_at = NOW()`,
  upsertThroughput: `
    INSERT INTO energy_throughput (date, pipeline, key_point, product, throughput, capacity, utilization, unit)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT(date, pipeline, key_point, product)
    DO UPDATE SET throughput = EXCLUDED.throughput, capacity = EXCLUDED.capacity,
                  utilization = EXCLUDED.utilization, collected_at = NOW()`,
  upsertProduction: `
    INSERT INTO energy_production (date, province, product, volume, unit)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT(date, province, product)
    DO UPDATE SET volume = EXCLUDED.volume, collected_at = NOW()`,
  upsertApportionment: `
    INSERT INTO energy_apportionment (date, pipeline, original_nominations, accepted_nominations, apportionment_pct)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT(date, pipeline)
    DO UPDATE SET original_nominations = EXCLUDED.original_nominations,
                  accepted_nominations = EXCLUDED.accepted_nominations,
                  apportionment_pct = EXCLUDED.apportionment_pct, collected_at = NOW()`,
  upsertAssessment: `
    INSERT INTO municipality_assessments (snapshot_date, municipality, group_type, group_name, count, avg_value, min_value, max_value)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT(snapshot_date, municipality, group_type, group_name)
    DO UPDATE SET count = EXCLUDED.count, avg_value = EXCLUDED.avg_value,
                  min_value = EXCLUDED.min_value, max_value = EXCLUDED.max_value`,
  upsertPermit: `
    INSERT INTO municipality_permits (snapshot_date, municipality, group_name, count, total_value)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT(snapshot_date, municipality, group_name)
    DO UPDATE SET count = EXCLUDED.count, total_value = EXCLUDED.total_value`,
  upsertZoningDistribution: `
    INSERT INTO municipality_zoning_distribution (municipality, zoning_category, parcel_count, snapshot_date)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT(municipality, zoning_category, snapshot_date)
    DO UPDATE SET parcel_count = EXCLUDED.parcel_count, collected_at = NOW()`,
  // Conflict target changed from (licence_number) to (licence_number, filing_date)
  // so re-appearing licences accumulate history rows instead of overwriting them.
  // Matches the UNIQUE constraint added in the 2026-06-04 boot migration.
  upsertWellLicence: `
    INSERT INTO well_licences (filing_date, licence_number, well_name, unique_id, surface_location, projected_depth, classification, substance, licensee)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT(licence_number, filing_date)
    DO UPDATE SET well_name = EXCLUDED.well_name, collected_at = NOW()`,
  upsertWellDaily: `
    INSERT INTO well_licence_daily (filing_date, total_count, by_substance, by_classification, by_licensee)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT(filing_date)
    DO UPDATE SET total_count = EXCLUDED.total_count, by_substance = EXCLUDED.by_substance,
                  by_classification = EXCLUDED.by_classification, by_licensee = EXCLUDED.by_licensee`,
  upsertImmigration: `
    INSERT INTO immigration_records (year, month, province, category, cma, count)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT(year, month, province, category, cma)
    DO UPDATE SET count = EXCLUDED.count, collected_at = NOW()`,
  upsertProject: `
    INSERT INTO major_projects (snapshot_date, source, name, sector, type, stage, cost, location, municipality)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT(snapshot_date, source, name)
    DO UPDATE SET sector = EXCLUDED.sector, type = EXCLUDED.type, stage = EXCLUDED.stage,
                  cost = EXCLUDED.cost, location = EXCLUDED.location, municipality = EXCLUDED.municipality`,
  upsertMacro: `
    INSERT INTO macro_metrics (snapshot_date, indicator, value)
    VALUES ($1, $2, $3)
    ON CONFLICT(snapshot_date, indicator)
    DO UPDATE SET value = EXCLUDED.value`,
  upsertCMHC: `
    INSERT INTO cmhc_housing_snapshots (period, cma, metric, value, unit)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT(period, cma, metric)
    DO UPDATE SET value = EXCLUDED.value, unit = EXCLUDED.unit, collected_at = NOW()`,
  upsertOpportunity: `
    INSERT INTO opportunities (
      reference_number, solicitation_number, title, buyer, category,
      procurement_method, gsin, gsin_description, unspsc, unspsc_description,
      regions_of_opportunity, regions_of_delivery, publication_date,
      closing_date, expected_start_date, expected_end_date, status,
      notice_url, matched_terms, source
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
    ON CONFLICT (reference_number, publication_date) DO UPDATE SET
      solicitation_number = EXCLUDED.solicitation_number,
      title               = EXCLUDED.title,
      buyer               = EXCLUDED.buyer,
      category            = EXCLUDED.category,
      procurement_method  = EXCLUDED.procurement_method,
      gsin                = EXCLUDED.gsin,
      gsin_description    = EXCLUDED.gsin_description,
      unspsc              = EXCLUDED.unspsc,
      unspsc_description  = EXCLUDED.unspsc_description,
      regions_of_opportunity = EXCLUDED.regions_of_opportunity,
      regions_of_delivery    = EXCLUDED.regions_of_delivery,
      closing_date        = EXCLUDED.closing_date,
      expected_start_date = EXCLUDED.expected_start_date,
      expected_end_date   = EXCLUDED.expected_end_date,
      status              = EXCLUDED.status,
      notice_url          = EXCLUDED.notice_url,
      matched_terms       = EXCLUDED.matched_terms,
      collected_at        = NOW()`,
  upsertJobBankPosting: `
    INSERT INTO jobbank_postings (
      wic_id, data_month, job_title, noc21_code, noc21_name, matched_noc_code,
      matched_noc_name, city, province, economic_region, naics_sector,
      first_posting_date, vacancy_count, employment_type, employment_term,
      salary_min, salary_max, salary_per, source
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
    ON CONFLICT (wic_id, data_month) DO UPDATE SET
      job_title          = EXCLUDED.job_title,
      noc21_code         = EXCLUDED.noc21_code,
      noc21_name         = EXCLUDED.noc21_name,
      matched_noc_code   = EXCLUDED.matched_noc_code,
      matched_noc_name   = EXCLUDED.matched_noc_name,
      city               = EXCLUDED.city,
      province           = EXCLUDED.province,
      economic_region    = EXCLUDED.economic_region,
      naics_sector       = EXCLUDED.naics_sector,
      first_posting_date = EXCLUDED.first_posting_date,
      vacancy_count      = EXCLUDED.vacancy_count,
      employment_type    = EXCLUDED.employment_type,
      employment_term    = EXCLUDED.employment_term,
      salary_min         = EXCLUDED.salary_min,
      salary_max         = EXCLUDED.salary_max,
      salary_per         = EXCLUDED.salary_per,
      collected_at       = NOW()`,
  upsertJobBankMonthly: `
    INSERT INTO jobbank_monthly (data_month, total_alberta_postings, tier_b_postings)
    VALUES ($1, $2, $3)
    ON CONFLICT (data_month) DO UPDATE SET
      total_alberta_postings = EXCLUDED.total_alberta_postings,
      tier_b_postings        = EXCLUDED.tier_b_postings,
      collected_at           = NOW()`,
  logEntry: `
    INSERT INTO snapshot_log (taken_at, source, records_inserted, status, error)
    VALUES (NOW(), $1, $2, $3, $4)`,
} as const;

// ---------------------------------------------------------------------------
// Phase 1: Regional Indicators
// ---------------------------------------------------------------------------

/**
 * Fetch and persist a single regional indicator for all municipalities.
 * Exported so worker.ts can issue one ctx.run step per indicator, keeping
 * only one payload in memory at a time (each payload can be 23–34 MB).
 */
export async function collectOneRegionalIndicator(name: string): Promise<number> {
  // Persisted indicator label must match what fetchRegionalIndicator's own
  // side-effect persist uses — otherwise the same upstream dataset lands in
  // the DB twice under two different names (e.g. "Total Equalized Assessment"
  // from persistToDb and "Property Assessments" from this loop, because
  // Alberta's API returns the latter as IndicatorSummaryDescription for the
  // former endpoint).
  const canonical = canonicalIndicatorName(name);
  const data = await fetchRegionalIndicator(name);
  if (data.length === 0) return 0;

  const aggregated = new Map<
    string,
    { csduid: string; municipality: string; indicator: string; period: string; value: number; unit: string }
  >();

  // Drift detection: Alberta's API returns IndicatorSummaryDescription per row,
  // which can diverge from the canonical key we requested (e.g. requesting
  // Total%20Equalized%20Assessment returns rows labelled "Property Assessments").
  // Warn loudly when that happens so future label drift surfaces in logs/Sentry
  // before it silently creates orphan rows.
  const upstreamLabels = new Set<string>();
  for (const pt of data) {
    if (pt.indicator && pt.indicator !== canonical) upstreamLabels.add(pt.indicator);
  }
  if (upstreamLabels.size > 0) {
    console.warn(
      `[regional] indicator drift: requested "${canonical}", upstream returned [${[...upstreamLabels].map((l) => `"${l}"`).join(", ")}] from ${regionalIndicatorUrl(canonical)}`,
    );
  }

  for (const pt of data) {
    if (!pt.csduid || !pt.period) continue;
    const key = `${pt.csduid}|${canonical}|${pt.period}`;
    const existing = aggregated.get(key);
    if (existing) {
      existing.value += pt.value;
    } else {
      aggregated.set(key, {
        csduid: pt.csduid,
        municipality: pt.municipality,
        indicator: canonical,
        period: pt.period,
        value: pt.value,
        unit: pt.unit,
      });
    }
  }

  return await withTransaction(async (client: pg.PoolClient) => {
    for (const row of aggregated.values()) {
      await client.query(SQL.upsertRegional, [
        row.csduid, row.municipality, row.indicator,
        row.period, row.value, row.unit,
      ]);
    }
    return aggregated.size;
  });
}

export async function collectRegionalIndicators(): Promise<number> {
  const pool = await getDb();
  const indicatorNames = Object.keys(REGIONAL_INDICATORS);
  let totalRows = 0;

  const tasks = indicatorNames.map((name) => () => collectOneRegionalIndicator(name));

  const results = await runWithConcurrency(tasks, 5);
  for (const r of results) {
    if (r.status === "fulfilled") totalRows += r.value;
  }

  await pool.query(SQL.logEntry, ["regional_indicators", totalRows, "ok", null]);
  return totalRows;
}

// ---------------------------------------------------------------------------
// Phase 2: Energy Data
// ---------------------------------------------------------------------------

export async function collectEnergyData(): Promise<number> {
  const pool = await getDb();
  let totalRows = 0;

  const throughputKeys: CEREndpointKey[] = [
    "NGTL_THROUGHPUT", "TRANS_MOUNTAIN_THROUGHPUT", "KEYSTONE_THROUGHPUT",
    "ENBRIDGE_MAINLINE_THROUGHPUT", "ALLIANCE_THROUGHPUT", "FOOTHILLS_THROUGHPUT",
  ];

  const throughputTasks = throughputKeys.map(
    (key) => async () => {
      const data = await fetchPipelineThroughput(key);
      if (data.length === 0) return 0;
      return await withTransaction(async (client: pg.PoolClient) => {
        for (const pt of data) {
          if (!pt.date) continue;
          await client.query(SQL.upsertThroughput, [
            pt.date, pt.pipeline, pt.keyPoint, pt.product,
            pt.throughput, pt.capacity, pt.utilization, pt.unit,
          ]);
        }
        return data.length;
      });
    }
  );

  const throughputResults = await runWithConcurrency(throughputTasks, 3);
  for (const r of throughputResults) {
    if (r.status === "fulfilled") totalRows += r.value;
  }

  // Crude oil production
  try {
    const production = await fetchCrudeOilProduction();
    if (production.length > 0) {
      await withTransaction(async (client: pg.PoolClient) => {
        for (const pt of production) {
          if (!pt.date) continue;
          await client.query(SQL.upsertProduction, [
            pt.date, pt.province, pt.product, pt.volume, pt.unit,
          ]);
        }
      });
      totalRows += production.length;
    }
  } catch {
    // Non-fatal
  }

  // Apportionment
  try {
    const apport = await fetchApportionment();
    if (apport.length > 0) {
      await withTransaction(async (client: pg.PoolClient) => {
        for (const pt of apport) {
          if (!pt.date) continue;
          await client.query(SQL.upsertApportionment, [
            pt.date, pt.pipeline, pt.originalNominations,
            pt.acceptedNominations, pt.apportionmentPercent,
          ]);
        }
      });
      totalRows += apport.length;
    }
  } catch {
    // Non-fatal
  }

  await pool.query(SQL.logEntry, ["energy_data", totalRows, "ok", null]);
  return totalRows;
}

// ---------------------------------------------------------------------------
// Phase 3: Municipality Snapshots
// ---------------------------------------------------------------------------

export async function collectMunicipalityData(today: string): Promise<number> {
  const pool = await getDb();
  const liveMunis = MUNICIPALITY_REGISTRY.filter((m) => m.status === "live");
  let totalRows = 0;

  // logPerMuni surfaces per-muni outcomes that were previously swallowed by
  // bare try/catch. Each muni gets its own snapshot_log row with
  // source = "municipality_data:<slug>:<kind>" so a single query can tell
  // which munis are healthy without scraping container logs.
  const logPerMuni = async (
    slug: string,
    kind: "zoning" | "neighbourhood" | "permits",
    rows: number,
    error?: string
  ) => {
    try {
      await pool.query(SQL.logEntry, [
        `municipality_data:${slug}:${kind}`,
        rows,
        error ? "error" : "ok",
        error ?? null,
      ]);
    } catch {
      // logging failure must not mask the upstream outcome
    }
  };

  // Assessments
  const assessmentTasks = liveMunis
    .filter((m) => m.capabilities.includes("assessments") || m.endpoints.assessments || m.endpoints.parcels)
    .map((m) => async () => {
      let count = 0;
      try {
        const byZoning = await fetchAssessmentsByGroup(m, "zoning");
        if (byZoning.length > 0) {
          await withTransaction(async (client: pg.PoolClient) => {
            for (const row of byZoning) {
              await client.query(SQL.upsertAssessment, [
                today, m.slug, "zoning", row.group,
                row.count, row.avgAssessment, row.minAssessment, row.maxAssessment,
              ]);
            }
          });
          count += byZoning.length;
        }
        await logPerMuni(m.slug, "zoning", byZoning.length);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await logPerMuni(m.slug, "zoning", 0, msg);
      }

      if (m.fields.neighbourhood) {
        try {
          const byHood = await fetchAssessmentsByGroup(m, "neighbourhood");
          if (byHood.length > 0) {
            await withTransaction(async (client: pg.PoolClient) => {
              for (const row of byHood) {
                await client.query(SQL.upsertAssessment, [
                  today, m.slug, "neighbourhood", row.group,
                  row.count, row.avgAssessment, row.minAssessment, row.maxAssessment,
                ]);
              }
            });
            count += byHood.length;
          }
          await logPerMuni(m.slug, "neighbourhood", byHood.length);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await logPerMuni(m.slug, "neighbourhood", 0, msg);
        }
      }
      return count;
    });

  const assessmentResults = await runWithConcurrency(assessmentTasks, 4);
  for (const r of assessmentResults) {
    if (r.status === "fulfilled") totalRows += r.value;
  }

  // Permits
  const permitMunis = liveMunis.filter(
    (m) => m.capabilities.includes("permits") || m.capabilities.includes("dev_permits") ||
           m.endpoints.permits || m.endpoints.devPermits
  );

  const permitTasks = permitMunis.map((m) => async () => {
    try {
      const permits = await fetchPermitsByGroup(m);
      if (permits.length > 0) {
        await withTransaction(async (client: pg.PoolClient) => {
          for (const row of permits) {
            await client.query(SQL.upsertPermit, [
              today, m.slug, row.group, row.count, row.totalValue,
            ]);
          }
        });
      }
      await logPerMuni(m.slug, "permits", permits.length);
      return permits.length;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await logPerMuni(m.slug, "permits", 0, msg);
      return 0;
    }
  });

  const permitResults = await runWithConcurrency(permitTasks, 4);
  for (const r of permitResults) {
    if (r.status === "fulfilled") totalRows += r.value;
  }

  // Zoning distribution — count-only collection for munis with no assessment $
  // Targets munis that have a zoning/parcels endpoint but no assessmentValue field.
  // These are precisely the 6 munis that previously produced 0 rows: Cochrane,
  // Airdrie, Spruce Grove, Sturgeon County, Leduc County, Lloydminster.
  const zoningDistMunis = liveMunis.filter(
    (m) =>
      !m.fields.assessmentValue &&
      (m.endpoints.zoning || m.endpoints.parcels)
  );

  const zoningDistTasks = zoningDistMunis.map((m) => async () => {
    try {
      const rows = await fetchZoningDistribution(m);
      if (rows.length > 0) {
        await withTransaction(async (client: pg.PoolClient) => {
          for (const row of rows) {
            await client.query(SQL.upsertZoningDistribution, [
              m.slug, row.zoningCategory, row.parcelCount, today,
            ]);
          }
        });
      }
      await pool.query(SQL.logEntry, [
        `municipality_data:${m.slug}:zoning_distribution`,
        rows.length,
        "ok",
        null,
      ]);
      return rows.length;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await pool.query(SQL.logEntry, [
        `municipality_data:${m.slug}:zoning_distribution`,
        0,
        "error",
        msg,
      ]).catch(() => {});
      return 0;
    }
  });

  const zoningDistResults = await runWithConcurrency(zoningDistTasks, 4);
  for (const r of zoningDistResults) {
    if (r.status === "fulfilled") totalRows += r.value;
  }

  await pool.query(SQL.logEntry, ["municipality_data", totalRows, "ok", null]);
  return totalRows;
}

// ---------------------------------------------------------------------------
// Well-licence intelligence derivation
// ---------------------------------------------------------------------------

/**
 * Slug-safe: lowercase, trim, replace any non-alphanumeric run with a dash.
 * e.g. "Pembina Pipeline Corp." → "pembina-pipeline-corp"
 */
function licenseeSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Derive well-licence intelligence into the substrate model.
 *
 * Runs AFTER the raw well_licences rows are persisted for `today`. Produces:
 *
 *   1. substrate.entities rows (kind = 'well-operator') for each distinct
 *      licensee seen today. First-seen is set on insert; last_seen is bumped
 *      on every run that sees the operator.
 *
 *   2. substrate.observations rows for three series:
 *        well-licences-new-by-substance       — one obs row per substance value today
 *        well-licences-new-by-classification  — one obs row per classification today
 *        well-licences-new-by-operator        — one obs row per licensee today
 *
 *      All three use the 'alberta' geo_dimension slug (province-level).
 *      The entity_id column is set for the operator series (links to the
 *      substrate.entities row for that operator); substance and classification
 *      series leave entity_id NULL (geo-level aggregates, qualifier carries
 *      the bucket label).
 *
 * All writes are idempotent (ON CONFLICT DO UPDATE / DO NOTHING).
 * This function is non-fatal from the caller's perspective — failures are
 * logged to snapshot_log but do not abort the collection run.
 */
export async function deriveWellLicenceIntelligence(
  today: string,
  licences: WellLicence[],
  bySubstance: Record<string, number>,
  byClassification: Record<string, number>,
  byLicensee: Record<string, number>,
): Promise<void> {
  if (licences.length === 0) return;

  const pool = await getDb();

  // ------------------------------------------------------------------
  // Resolve IDs we need from substrate
  // ------------------------------------------------------------------

  // Geo: Alberta province-level
  const geoRes = await pool.query<{ id: string }>(
    `SELECT id FROM substrate.geo_dimension
     WHERE slug = 'alberta' OR (LOWER(name) = 'alberta' AND geo_type = 'province')
     LIMIT 1`
  );
  const geoId = geoRes.rows[0]?.id;
  if (!geoId) {
    // Alberta geo row not yet seeded — log and bail; derivation will retry next run.
    console.warn(JSON.stringify({
      event: "deriveWellLicenceIntelligence.noAlbertaGeo",
      today,
    }));
    return;
  }

  // Source: AER Well Licences
  const srcRes = await pool.query<{ id: string }>(
    `SELECT id FROM substrate.sources WHERE name = 'AER Well Licences' LIMIT 1`
  );
  const sourceId = srcRes.rows[0]?.id ?? null;

  // Series metadata IDs
  const seriesRes = await pool.query<{ id: string; slug: string }>(
    `SELECT id, slug FROM substrate.series_metadata
     WHERE slug IN (
       'well-licences-new-by-substance',
       'well-licences-new-by-classification',
       'well-licences-new-by-operator'
     )`
  );
  const seriesMap = new Map(seriesRes.rows.map((r) => [r.slug, r.id]));

  const subSeriesId = seriesMap.get("well-licences-new-by-substance");
  const clsSeriesId = seriesMap.get("well-licences-new-by-classification");
  const opSeriesId  = seriesMap.get("well-licences-new-by-operator");

  // ------------------------------------------------------------------
  // 1. Upsert operator entities
  // ------------------------------------------------------------------

  // Map licensee name → substrate.entities.id so we can link observations.
  const operatorIdMap = new Map<string, string>();

  for (const [licensee, _count] of Object.entries(byLicensee)) {
    if (!licensee || licensee === "Unknown") continue;
    const slug = `well-operator-${licenseeSlug(licensee)}`;

    const opRes = await pool.query<{ id: string }>(
      `INSERT INTO substrate.entities
         (slug, kind, name, geo_id, source_id, attrs, first_seen, last_seen)
       VALUES ($1, 'well-operator', $2, $3, $4, '{}'::jsonb, $5::date, $5::date)
       ON CONFLICT (slug) DO UPDATE SET
         last_seen = GREATEST(substrate.entities.last_seen, EXCLUDED.last_seen),
         name      = EXCLUDED.name
       RETURNING id`,
      [slug, licensee, geoId, sourceId, today]
    );
    const opId = opRes.rows[0]?.id;
    if (opId) operatorIdMap.set(licensee, opId);
  }

  // ------------------------------------------------------------------
  // 2. Substance observations (geo-level, one row per day)
  //
  // substrate.observations UNIQUE is (series_id, period, geo_id, entity_id)
  // with NULLS NOT DISTINCT — only one NULL-entity row is allowed per
  // (series, period, geo). We write the total count as `value` and the
  // per-bucket JSON as `raw_value`. A UI that needs per-substance breakdown
  // can JOIN against well_licence_daily.by_substance for the same date.
  // ------------------------------------------------------------------

  if (subSeriesId) {
    const total = Object.values(bySubstance).reduce((s, n) => s + n, 0);
    await pool.query(
      `INSERT INTO substrate.observations
         (series_id, period, geo_id, entity_id, value, raw_value, collected_at)
       VALUES ($1, $2::date, $3, NULL, $4, $5, NOW())
       ON CONFLICT (series_id, period, geo_id, entity_id) DO UPDATE SET
         value        = EXCLUDED.value,
         raw_value    = EXCLUDED.raw_value,
         collected_at = NOW()`,
      [subSeriesId, today, geoId, total, JSON.stringify(bySubstance)]
    );
  }

  // ------------------------------------------------------------------
  // 3. Classification observations (geo-level, one row per day)
  //
  // Same single-row-per-day convention as substance series above.
  // raw_value holds the JSON breakdown; value is total count.
  // ------------------------------------------------------------------

  if (clsSeriesId) {
    const total = Object.values(byClassification).reduce((s, n) => s + n, 0);
    await pool.query(
      `INSERT INTO substrate.observations
         (series_id, period, geo_id, entity_id, value, raw_value, collected_at)
       VALUES ($1, $2::date, $3, NULL, $4, $5, NOW())
       ON CONFLICT (series_id, period, geo_id, entity_id) DO UPDATE SET
         value        = EXCLUDED.value,
         raw_value    = EXCLUDED.raw_value,
         collected_at = NOW()`,
      [clsSeriesId, today, geoId, total, JSON.stringify(byClassification)]
    );
  }

  // ------------------------------------------------------------------
  // 4. Operator observations (entity-keyed)
  //
  // One row per (series, period, geo, entity_id). entity_id is the
  // substrate.entities UUID for this operator; unknown/blank licensees
  // are skipped (no entity was created for them above).
  // ------------------------------------------------------------------

  if (opSeriesId) {
    for (const [licensee, count] of Object.entries(byLicensee)) {
      const entityId = operatorIdMap.get(licensee);
      if (!entityId) continue; // skip "Unknown" and any blank-name entries
      await pool.query(
        `INSERT INTO substrate.observations
           (series_id, period, geo_id, entity_id, value, qualifier, collected_at)
         VALUES ($1, $2::date, $3, $4, $5, $6, NOW())
         ON CONFLICT (series_id, period, geo_id, entity_id) DO UPDATE SET
           value        = EXCLUDED.value,
           qualifier    = EXCLUDED.qualifier,
           collected_at = NOW()`,
        [opSeriesId, today, geoId, entityId, count, licensee]
      );
    }
  }

  await pool.query(SQL.logEntry, [
    "well_licences_derive",
    licences.length,
    "ok",
    null,
  ]);
}

// ---------------------------------------------------------------------------
// Phase 4: Well Licences
// ---------------------------------------------------------------------------

export async function collectWellLicences(today: string): Promise<number> {
  const pool = await getDb();

  let licences: Awaited<ReturnType<typeof fetchAERWellLicences>>;
  try {
    licences = await fetchAERWellLicences();
  } catch (e) {
    if (e instanceof AERAccessBlockedError) {
      await pool.query(SQL.logEntry, ["well_licences", 0, "error", e.message]);
      return 0;
    }
    throw e;
  }

  if (licences.length === 0) {
    await pool.query(SQL.logEntry, ["well_licences", 0, "ok", "no data for today"]);
    return 0;
  }

  await withTransaction(async (client: pg.PoolClient) => {
    for (const lic of licences) {
      if (!lic.licenceNumber) continue;
      await client.query(SQL.upsertWellLicence, [
        today, lic.licenceNumber, lic.wellName, lic.uniqueId,
        lic.surfaceLocation, lic.projectedDepth, lic.classification,
        lic.substance, lic.licensee,
      ]);
    }
  });

  // Daily aggregates — three breakdown dimensions
  const bySubstance: Record<string, number> = {};
  const byClassification: Record<string, number> = {};
  const byLicensee: Record<string, number> = {};
  for (const lic of licences) {
    const sub = lic.substance || "Unknown";
    const cls = lic.classification || "Unknown";
    const lnk = lic.licensee || "Unknown";
    bySubstance[sub] = (bySubstance[sub] || 0) + 1;
    byClassification[cls] = (byClassification[cls] || 0) + 1;
    byLicensee[lnk] = (byLicensee[lnk] || 0) + 1;
  }

  await pool.query(SQL.upsertWellDaily, [
    today, licences.length,
    JSON.stringify(bySubstance), JSON.stringify(byClassification),
    JSON.stringify(byLicensee),
  ]);

  await pool.query(SQL.logEntry, ["well_licences", licences.length, "ok", null]);

  // Derive intelligence from today's licences into the substrate model.
  // Non-fatal: collection success is not conditional on derivation success.
  try {
    await deriveWellLicenceIntelligence(today, licences, bySubstance, byClassification, byLicensee);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await pool.query(SQL.logEntry, ["well_licences_derive", 0, "error", msg]).catch(() => {});
  }

  return licences.length;
}

// ---------------------------------------------------------------------------
// Phase 5: Immigration
// ---------------------------------------------------------------------------

export async function collectImmigration(): Promise<number> {
  let totalRows = 0;

  try {
    const byCategory = await fetchImmigrationByCategory("Alberta");
    if (byCategory.length > 0) {
      await withTransaction(async (client: pg.PoolClient) => {
        for (const rec of byCategory) {
          await client.query(SQL.upsertImmigration, [
            rec.year, rec.month, rec.province, rec.category, "", rec.count,
          ]);
        }
      });
      totalRows += byCategory.length;
    }
  } catch {
    // Non-fatal
  }

  for (const cma of ["Edmonton", "Calgary"]) {
    try {
      const byCMA = await fetchImmigrationByCMA(cma);
      if (byCMA.length > 0) {
        await withTransaction(async (client: pg.PoolClient) => {
          for (const rec of byCMA) {
            await client.query(SQL.upsertImmigration, [
              rec.year, rec.month, rec.province || "Alberta", "", cma, rec.count,
            ]);
          }
        });
        totalRows += byCMA.length;
      }
    } catch {
      // Non-fatal
    }
  }

  const pool = await getDb();
  await pool.query(SQL.logEntry, ["immigration", totalRows, "ok", null]);
  return totalRows;
}

// ---------------------------------------------------------------------------
// Phase 6: Major Projects
// ---------------------------------------------------------------------------

export async function collectMajorProjects(today: string): Promise<number> {
  const pool = await getDb();
  let albertaRows = 0;
  let federalRows = 0;

  try {
    const abProjects = await fetchAlbertaMajorProjects();
    if (abProjects.length > 0) {
      await withTransaction(async (client: pg.PoolClient) => {
        for (const p of abProjects) {
          if (!p.name) continue;
          // upsert_major_project handles version-bump-on-stage-change. The
          // legacy `major_projects` table is no longer written for Alberta
          // (federal projects still use it below).
          await client.query(
            `CALL substrate.upsert_major_project($1, $2, $3, $4, $5, $6, $7::date)`,
            [p.name, null, p.municipality, null, p.cost, p.stage, today]
          );
        }
      });
      albertaRows = abProjects.length;
    }
  } catch (err) {
    // Log the error explicitly so a procedure raise doesn't fail silently —
    // snapshot_log is the only signal the morning audit checks.
    const msg = err instanceof Error ? err.message : String(err);
    await pool
      .query(SQL.logEntry, ["substrate.major_projects_versioned", 0, "error", msg])
      .catch(() => {});
  }

  // Daily reconciliation: how many rows landed for today's snapshot. Runs
  // outside the try/catch above so it always logs, even if the upsert loop
  // partially succeeded before throwing (committed rows still count).
  try {
    const countRes = await pool.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n
         FROM substrate.major_projects_versioned
         WHERE snapshot_date = $1::date`,
      [today]
    );
    const n = countRes.rows[0]?.n ?? 0;
    await pool.query(SQL.logEntry, ["substrate.major_projects_versioned", n, "ok", null]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await pool
      .query(SQL.logEntry, ["substrate.major_projects_versioned", 0, "error", msg])
      .catch(() => {});
  }

  try {
    const fedProjects = await fetchInfrastructureProjects("Alberta");
    if (fedProjects.length > 0) {
      await withTransaction(async (client: pg.PoolClient) => {
        for (const p of fedProjects) {
          if (!p.name) continue;
          await client.query(SQL.upsertProject, [
            today, "federal", p.name, "", "",
            p.status, p.fundingAmount, p.location, "",
          ]);
        }
      });
      federalRows = fedProjects.length;
    }
  } catch {
    // Non-fatal
  }

  // Legacy snapshot_log row now reflects only what actually wrote to
  // `major_projects` (federal). Alberta has its own reconciliation row above.
  await pool.query(SQL.logEntry, ["major_projects", federalRows, "ok", null]);
  return albertaRows + federalRows;
}

// ---------------------------------------------------------------------------
// Phase 7: Macro Indicators
// ---------------------------------------------------------------------------

const BOC_BASE = "https://www.bankofcanada.ca/valet";
const STATCAN_BASE = "https://www150.statcan.gc.ca/t1/wds/rest";

export async function collectMacroIndicators(today: string): Promise<number> {
  const pool = await getDb();
  let count = 0;

  const bocSeries = [
    { name: "V39079", label: "boc_policy_rate" },
    { name: "V80691311", label: "boc_prime_rate" },
    { name: "FXCADUSD", label: "cad_usd" },
    { name: "V80691335", label: "mortgage_5y_fixed" },
    { name: "V80691336", label: "mortgage_5y_variable" },
  ];

  for (const s of bocSeries) {
    try {
      const res = await fetch(`${BOC_BASE}/observations/${s.name}/json?recent=1`);
      if (!res.ok) continue;
      const data = await res.json();
      const obs = data?.observations?.[0];
      if (obs) {
        const val = parseFloat((obs[s.name] as { v: string })?.v || "0");
        if (val) {
          await pool.query(SQL.upsertMacro, [today, s.label, val]);
          count++;
        }
      }
    } catch {
      // Individual series failure is non-fatal
    }
  }

  const commoditySeries = [
    { name: "STATIC_BCPIALL_MONTHLY", label: "boc_commodity_all" },
    { name: "STATIC_BCPIENE_MONTHLY", label: "boc_commodity_energy" },
    { name: "STATIC_BCPINNE_MONTHLY", label: "boc_commodity_non_energy" },
  ];

  for (const s of commoditySeries) {
    try {
      const res = await fetch(`${BOC_BASE}/observations/${s.name}/json?recent=1`);
      if (!res.ok) continue;
      const data = await res.json();
      const obs = data?.observations?.[0];
      if (obs) {
        const val = parseFloat((obs[s.name] as { v: string })?.v || "0");
        if (val) {
          await pool.query(SQL.upsertMacro, [today, s.label, val]);
          count++;
        }
      }
    } catch {
      // Non-fatal
    }
  }

  const statsSeries: { key: string; tableId: number; coordinate: string }[] = [
    { key: "ab_unemployment", tableId: STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.tableId, coordinate: STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.coordinate },
    { key: "ab_employment", tableId: STATSCAN_SERIES.AB_EMPLOYMENT.tableId, coordinate: STATSCAN_SERIES.AB_EMPLOYMENT.coordinate },
    { key: "ab_cpi", tableId: STATSCAN_SERIES.AB_CPI.tableId, coordinate: STATSCAN_SERIES.AB_CPI.coordinate },
    { key: "edmonton_cpi", tableId: STATSCAN_SERIES.EDMONTON_CPI.tableId, coordinate: STATSCAN_SERIES.EDMONTON_CPI.coordinate },
    { key: "ab_population", tableId: STATSCAN_SERIES.AB_POPULATION.tableId, coordinate: STATSCAN_SERIES.AB_POPULATION.coordinate },
    { key: "ab_gdp", tableId: STATSCAN_SERIES.AB_GDP.tableId, coordinate: STATSCAN_SERIES.AB_GDP.coordinate },
    { key: "ab_gdp_mining_oil_gas", tableId: STATSCAN_SERIES.AB_GDP_MINING_OIL_GAS.tableId, coordinate: STATSCAN_SERIES.AB_GDP_MINING_OIL_GAS.coordinate },
    { key: "ab_gdp_construction", tableId: STATSCAN_SERIES.AB_GDP_CONSTRUCTION.tableId, coordinate: STATSCAN_SERIES.AB_GDP_CONSTRUCTION.coordinate },
    { key: "ab_gdp_real_estate", tableId: STATSCAN_SERIES.AB_GDP_REAL_ESTATE.tableId, coordinate: STATSCAN_SERIES.AB_GDP_REAL_ESTATE.coordinate },
    { key: "ab_retail_sales", tableId: STATSCAN_SERIES.AB_RETAIL_SALES.tableId, coordinate: STATSCAN_SERIES.AB_RETAIL_SALES.coordinate },
    { key: "ab_participation_rate", tableId: STATSCAN_SERIES.AB_PARTICIPATION_RATE.tableId, coordinate: STATSCAN_SERIES.AB_PARTICIPATION_RATE.coordinate },
    { key: "ab_weekly_earnings", tableId: STATSCAN_SERIES.AB_WEEKLY_EARNINGS.tableId, coordinate: STATSCAN_SERIES.AB_WEEKLY_EARNINGS.coordinate },
    { key: "ab_job_vacancies", tableId: STATSCAN_SERIES.AB_JOB_VACANCIES.tableId, coordinate: STATSCAN_SERIES.AB_JOB_VACANCIES.coordinate },
    { key: "edmonton_housing_starts", tableId: STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.tableId, coordinate: STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.coordinate },
    { key: "edmonton_housing_completions", tableId: STATSCAN_SERIES.EDMONTON_HOUSING_COMPLETIONS.tableId, coordinate: STATSCAN_SERIES.EDMONTON_HOUSING_COMPLETIONS.coordinate },
    { key: "edmonton_vacancy_rate", tableId: STATSCAN_SERIES.EDMONTON_VACANCY_RATE.tableId, coordinate: STATSCAN_SERIES.EDMONTON_VACANCY_RATE.coordinate },
    { key: "ab_net_interprovincial", tableId: STATSCAN_SERIES.AB_NET_INTERPROVINCIAL.tableId, coordinate: STATSCAN_SERIES.AB_NET_INTERPROVINCIAL.coordinate },
    { key: "ab_farm_cash_receipts", tableId: STATSCAN_SERIES.AB_FARM_CASH_RECEIPTS.tableId, coordinate: STATSCAN_SERIES.AB_FARM_CASH_RECEIPTS.coordinate },
  ];

  const statsTasks = statsSeries.map(
    (s) => async () => {
      try {
        const res = await fetch(`${STATCAN_BASE}/getDataFromCubePidCoordAndLatestNPeriods`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify([{ productId: s.tableId, coordinate: s.coordinate, latestN: 1 }]),
        });
        if (!res.ok) return null;
        const data = await res.json();
        const item = Array.isArray(data) ? data[0] : data;
        if (item?.status === "SUCCESS") {
          const pts = item.object?.vectorDataPoint;
          if (pts?.length) {
            await pool.query(SQL.upsertMacro, [today, s.key, pts[0].value]);
            return s.key;
          }
        }
      } catch {
        // Individual series failure is non-fatal
      }
      return null;
    }
  );

  const statsResults = await runWithConcurrency(statsTasks, 3);
  for (const r of statsResults) {
    if (r.status === "fulfilled" && r.value) count++;
  }

  await pool.query(SQL.logEntry, ["macro_indicators", count, "ok", null]);
  return count;
}

// ---------------------------------------------------------------------------
// Phase: CMHC Housing (StatsCan table 34-10-0154 + siblings, no API key)
// ---------------------------------------------------------------------------
export async function collectCMHCHousing(): Promise<number> {
  const pool = await getDb();
  let count = 0;

  async function upsertCMASeries(
    series: { date: string; edmonton: number; calgary: number }[],
    metric: string,
    unit: string
  ): Promise<number> {
    if (!series.length) return 0;
    return withTransaction(async (client: pg.PoolClient) => {
      let n = 0;
      for (const pt of series) {
        if (!pt.date) continue;
        if (pt.edmonton > 0) {
          await client.query(SQL.upsertCMHC, [pt.date, "Edmonton", metric, pt.edmonton, unit]);
          n++;
        }
        if (pt.calgary > 0) {
          await client.query(SQL.upsertCMHC, [pt.date, "Calgary", metric, pt.calgary, unit]);
          n++;
        }
      }
      return n;
    });
  }

  try { count += await upsertCMASeries(await fetchHousingStarts(60), "starts", "units"); } catch { /* non-fatal */ }
  try { count += await upsertCMASeries(await fetchHousingCompletions(60), "completions", "units"); } catch { /* non-fatal */ }
  try { count += await upsertCMASeries(await fetchUnderConstruction(60), "under_construction", "units"); } catch { /* non-fatal */ }
  try { count += await upsertCMASeries(await fetchVacancyRates(20), "vacancy_rate", "%"); } catch { /* non-fatal */ }

  try {
    const rents = await fetchRentComparison(20);
    if (rents.length > 0) {
      await withTransaction(async (client: pg.PoolClient) => {
        for (const pt of rents) {
          if (!pt.date) continue;
          const rentMetrics: [string, number, number][] = [
            ["rent_bachelor", pt.edmontonBachelor, pt.calgaryBachelor],
            ["rent_1bed",     pt.edmontonOneBed,   pt.calgaryOneBed],
            ["rent_2bed",     pt.edmontonTwoBed,   pt.calgaryTwoBed],
            ["rent_3bed",     pt.edmontonThreeBed, pt.calgaryThreeBed],
          ];
          for (const [metric, edm, cal] of rentMetrics) {
            if (edm > 0) { await client.query(SQL.upsertCMHC, [pt.date, "Edmonton", metric, edm, "$/month"]); count++; }
            if (cal > 0) { await client.query(SQL.upsertCMHC, [pt.date, "Calgary", metric, cal, "$/month"]); count++; }
          }
        }
      });
    }
  } catch { /* non-fatal */ }

  try {
    const { absorbed, unabsorbed } = await fetchAbsorptions(40);
    await withTransaction(async (client: pg.PoolClient) => {
      for (const pt of absorbed) { if (pt.date && pt.value) { await client.query(SQL.upsertCMHC, [pt.date, "Alberta", "absorbed", pt.value, "units"]); count++; } }
      for (const pt of unabsorbed) { if (pt.date && pt.value) { await client.query(SQL.upsertCMHC, [pt.date, "Alberta", "unabsorbed", pt.value, "units"]); count++; } }
    });
  } catch { /* non-fatal */ }

  try {
    const mortgage = await fetchMortgageRate(60);
    if (mortgage.length > 0) {
      await withTransaction(async (client: pg.PoolClient) => {
        for (const pt of mortgage) { if (pt.date && pt.value) { await client.query(SQL.upsertCMHC, [pt.date, "Canada", "mortgage_rate_5y", pt.value, "%"]); count++; } }
      });
    }
  } catch { /* non-fatal */ }

  await pool.query(SQL.logEntry, ["cmhc_housing", count, "ok", null]);
  return count;
}

// ---------------------------------------------------------------------------
// Phase: Procurement (demand-side feed — CanadaBuys open tenders)
// ---------------------------------------------------------------------------

/**
 * Fetch the CanadaBuys open-tender CSV and upsert the IT/software/AI/data-
 * relevant, nationally-deliverable notices into the `opportunities` table.
 *
 * Stores ALL statuses including already-closed notices (excludeClosed: false)
 * so amendments update mutable fields in place and so the table retains the
 * award/recompete-timing history; the read layer (readOpportunities) derives
 * open-vs-closed at query time. Every row UPSERTs on
 * (reference_number, publication_date) — amendment re-publishes update
 * closing_date/status rather than inserting duplicates.
 *
 * Writes a snapshot_log row on success AND failure (source: "procurement").
 */
export async function collectProcurementData(_today: string): Promise<number> {
  const pool = await getDb();

  let tenders: Awaited<ReturnType<typeof fetchOpenTenderOpportunities>>;
  try {
    tenders = await fetchOpenTenderOpportunities({
      relevantOnly: true,
      excludeClosed: false,
    });
  } catch (e) {
    if (e instanceof ProcurementAccessBlockedError) {
      await pool.query(SQL.logEntry, ["procurement", 0, "error", e.message]);
      return 0;
    }
    throw e;
  }

  if (tenders.length === 0) {
    await pool.query(SQL.logEntry, ["procurement", 0, "ok", "no relevant tenders"]);
    return 0;
  }

  let inserted = 0;
  await withTransaction(async (client: pg.PoolClient) => {
    for (const t of tenders) {
      // The natural key needs both parts; skip notices missing either.
      if (!t.referenceNumber || !t.publicationDate) continue;
      await client.query(SQL.upsertOpportunity, [
        t.referenceNumber, t.solicitationNumber, t.title, t.buyer, t.category,
        t.procurementMethod, t.gsin, t.gsinDescription, t.unspsc, t.unspscDescription,
        t.regionsOfOpportunity, t.regionsOfDelivery, t.publicationDate,
        t.closingDate, t.expectedStartDate, t.expectedEndDate, t.status,
        t.noticeUrl, JSON.stringify(t.matchedTerms), "canadabuys",
      ]);
      inserted++;
    }
  });

  await pool.query(SQL.logEntry, ["procurement", inserted, "ok", null]);
  return inserted;
}

// ---------------------------------------------------------------------------
// Phase: Job Bank hiring signals (latent-demand feed)
// ---------------------------------------------------------------------------

/**
 * Fetch the latest Canada Job Bank monthly snapshot, store the Alberta Tier-B
 * postings (manual-process roles that signal automatable operations work) plus
 * a monthly aggregate. The monthly CSV is a complete snapshot of one month and
 * CKAN keeps prior months as separate resources, so storing each month as it's
 * collected builds the month-over-month momentum series cheaply.
 *
 * One fetch (all Alberta postings) → derive the total denominator + the Tier-B
 * subset. Returns the number of Tier-B rows upserted. snapshot_log on ok/error.
 */
export async function collectJobBankData(_today: string): Promise<number> {
  const pool = await getDb();

  // One fetch of all Alberta postings; the fetcher never throws (returns []).
  // The result bundles the authoritative data month from the same CKAN lookup,
  // so rows are always stored under the month they actually came from.
  const { postings: all, month } = await fetchJobBankPostings({
    province: "Alberta",
    tierBOnly: false,
  });
  if (all.length === 0) {
    await pool.query(SQL.logEntry, ["jobbank", 0, "error", "no postings (fetch failed or empty feed)"]);
    return 0;
  }

  const tierB = all.filter((p) => !!p.matchedNocCode && !!p.wicId);
  // Fall back to the current month only if CKAN didn't return one.
  const dataMonth = month || new Date().toISOString().slice(0, 7);

  await withTransaction(async (client: pg.PoolClient) => {
    for (const p of tierB) {
      await client.query(SQL.upsertJobBankPosting, [
        p.wicId, dataMonth, p.jobTitle, p.noc21Code, p.noc21Name, p.matchedNocCode,
        p.matchedNocName, p.city, p.province, p.economicRegion, p.naicsSector,
        p.firstPostingDate, p.vacancyCount, p.employmentType, p.employmentTerm,
        p.salaryMin, p.salaryMax, p.salaryPer, "jobbank",
      ]);
    }
    await client.query(SQL.upsertJobBankMonthly, [dataMonth, all.length, tierB.length]);
  });

  await pool.query(SQL.logEntry, ["jobbank", tierB.length, "ok", null]);
  return tierB.length;
}

// ---------------------------------------------------------------------------
// Phase: Spruce Grove licence proxy (derived observations)
// ---------------------------------------------------------------------------

/**
 * Derive Spruce Grove licence-proxy observation series from existing upstream
 * tables (municipality_permits + regional_indicators.Incorporations).
 *
 * Writes to substrate.observations — two series:
 *   spruce-grove-licence-proxy-dev-permits   (daily, forward-leaning proxy)
 *   spruce-grove-licence-proxy-incorporations (period, concurrent proxy)
 *
 * Idempotent: all writes are ON CONFLICT DO UPDATE. Passes `since=yesterday`
 * so frozen historical periods are not re-derived on every run.
 *
 * snapshot_log source strings:
 *   substrate.observations.spruce-grove-licence-proxy-dev-permits
 *   substrate.observations.spruce-grove-licence-proxy-incorporations
 */
export async function collectSpruceGroveProxy(today: string): Promise<number> {
  const pool = await getDb();

  // Compute yesterday as the --since cutoff: avoids re-deriving frozen history
  // while still picking up any permit/indicator rows written today or yesterday.
  // Integer day subtraction: CURRENT_DATE - 1 (integer literal) is safe on
  // Crunchy Bridge (avoids the INTERVAL footgun with daterange operators).
  const sinceRes = await pool.query<{ d: string }>(
    `SELECT (CURRENT_DATE - 1)::text AS d`
  );
  const since: string = sinceRes.rows[0].d;

  const SPRUCE_GROVE_SLUG = "spruce-grove";
  const SPRUCE_GROVE_MUNICIPALITY = "Spruce Grove";
  const PERMITS_SERIES_SLUG = "spruce-grove-licence-proxy-dev-permits";
  const INCORP_SERIES_SLUG = "spruce-grove-licence-proxy-incorporations";
  const SOURCE_NAME_PROXY = "Tri-Region licence proxy";

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const parent = await client.query<{ id: string; csduid: string | null }>(
      `SELECT id, csduid FROM substrate.geo_dimension WHERE slug = $1`,
      [SPRUCE_GROVE_SLUG]
    );
    if (parent.rowCount === 0) {
      const msg = `geo_dimension row for ${SPRUCE_GROVE_SLUG} not found`;
      await pool.query(SQL.logEntry, [`substrate.observations.${PERMITS_SERIES_SLUG}`, 0, "error", msg]);
      await pool.query(SQL.logEntry, [`substrate.observations.${INCORP_SERIES_SLUG}`, 0, "error", msg]);
      await client.query("ROLLBACK");
      return 0;
    }
    const spruceId: string = parent.rows[0].id;
    const spruceCsduid: string | null = parent.rows[0].csduid;
    if (!spruceCsduid) {
      const msg = `geo_dimension row for ${SPRUCE_GROVE_SLUG} has no csduid`;
      await pool.query(SQL.logEntry, [`substrate.observations.${PERMITS_SERIES_SLUG}`, 0, "error", msg]);
      await pool.query(SQL.logEntry, [`substrate.observations.${INCORP_SERIES_SLUG}`, 0, "error", msg]);
      await client.query("ROLLBACK");
      return 0;
    }

    // Upsert source.
    const src = await client.query<{ id: string }>(
      `INSERT INTO substrate.sources (name, base_url, auth_type)
       VALUES ($1, NULL, 'derived')
       ON CONFLICT (name) DO UPDATE SET auth_type = EXCLUDED.auth_type
       RETURNING id`,
      [SOURCE_NAME_PROXY]
    );
    const sourceId: string = src.rows[0].id;

    // Upsert permits series_metadata.
    const permitsSer = await client.query<{ id: string }>(
      `INSERT INTO substrate.series_metadata
         (slug, domain, name, source_id, unit, unit_type, cadence, geo_id,
          description, tags, upstream_key, is_derived, derivation_lineage)
       VALUES
         ($1, 'business_licence_proxy', 'Spruce Grove dev-permit count (licence proxy)',
          $2, 'permits', 'count', 'daily', $3,
          'PROXY: derived from municipality_permits aggregated to total count per snapshot_date for Spruce Grove.',
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
        PERMITS_SERIES_SLUG, sourceId, spruceId,
        JSON.stringify({ kind: "derived", upstream_table: "municipality_permits", municipality: SPRUCE_GROVE_MUNICIPALITY }),
        JSON.stringify({ v: 1, kind: "rollup", upstream: [{ table: "municipality_permits", filter: { municipality: SPRUCE_GROVE_MUNICIPALITY }, aggregate: "SUM(count) per snapshot_date" }] }),
      ]
    );
    const permitsSeriesId: string = permitsSer.rows[0].id;

    // Upsert incorporations series_metadata.
    const incorpSer = await client.query<{ id: string }>(
      `INSERT INTO substrate.series_metadata
         (slug, domain, name, source_id, unit, unit_type, cadence, geo_id,
          description, tags, upstream_key, is_derived, derivation_lineage)
       VALUES
         ($1, 'business_licence_proxy', 'Spruce Grove incorporations (licence proxy)',
          $2, 'incorporations', 'count', 'period', $3,
          'PROXY: regional_indicators.Incorporations for Spruce Grove CSDUID.',
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
        INCORP_SERIES_SLUG, sourceId, spruceId,
        JSON.stringify({ kind: "derived", upstream_table: "regional_indicators", csduid: spruceCsduid, indicator: "Incorporations" }),
        JSON.stringify({ v: 1, kind: "proxy", upstream: [{ table: "regional_indicators", filter: { csduid: spruceCsduid, indicator: "Incorporations" } }] }),
      ]
    );
    const incorpSeriesId: string = incorpSer.rows[0].id;

    // Fetch permit rows since yesterday.
    interface PermitRow { snapshot_date: string; total_count: string }
    const permits = await client.query<PermitRow>(
      `SELECT snapshot_date, SUM(count)::text AS total_count
         FROM municipality_permits
         WHERE municipality = $1 AND snapshot_date >= $2
         GROUP BY snapshot_date
         ORDER BY snapshot_date`,
      [SPRUCE_GROVE_MUNICIPALITY, since]
    );

    // Fetch incorporations rows (year-granular --since uses the year portion).
    interface IncorpRow { period: string; value: string }
    const incorp = await client.query<IncorpRow>(
      `SELECT period, value::text AS value
         FROM regional_indicators
         WHERE csduid = $1 AND indicator = 'Incorporations'
           AND period >= $2
         ORDER BY period`,
      [spruceCsduid, since.slice(0, 4)]
    );

    // Parse a period string to a DATE string (YYYY-MM-DD).
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
      if (/^\d{4}-\d{2}-\d{2}$/.test(period)) return period;
      return null;
    }

    // Write permits observations.
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

    // Write incorporations observations.
    let incorpObs = 0;
    for (const r of incorp.rows) {
      const periodDate = periodToDate(r.period);
      if (!periodDate) continue;
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

    await client.query(SQL.logEntry, [`substrate.observations.${PERMITS_SERIES_SLUG}`, permitsObs, "ok", null]);
    await client.query(SQL.logEntry, [`substrate.observations.${INCORP_SERIES_SLUG}`, incorpObs, "ok", null]);

    await client.query("COMMIT");
    console.log(`[collector] spruce-grove-proxy: ${permitsObs} permit obs, ${incorpObs} incorp obs (since ${since})`);
    return permitsObs + incorpObs;
  } catch (err) {
    await client.query("ROLLBACK");
    const msg = err instanceof Error ? err.message : String(err);
    await pool.query(SQL.logEntry, [`substrate.observations.${PERMITS_SERIES_SLUG}`, 0, "error", msg]).catch(() => {});
    await pool.query(SQL.logEntry, [`substrate.observations.${INCORP_SERIES_SLUG}`, 0, "error", msg]).catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Phase: Stony Plain business entities
// ---------------------------------------------------------------------------

// ArcGIS feature types reused internally.
interface StonyPlainFeature {
  attributes: {
    FID: number;
    NAME: string | null;
    CATEGORY: string | null;
    Linc: number | null;
    Roll: number | null;
  };
  geometry?: { x: number; y: number };
}

interface StonyPlainQueryResponse {
  features: StonyPlainFeature[];
  exceededTransferLimit?: boolean;
}

async function fetchStonyPlainFeatures(): Promise<StonyPlainFeature[]> {
  const SOURCE_BASE = "https://services.arcgis.com/ScgF04sks0ZKbWe3";
  const QUERY_URL =
    `${SOURCE_BASE}/arcgis/rest/services/ToSP_Businesses/FeatureServer/0/query` +
    `?where=1%3D1&outFields=FID,NAME,CATEGORY,Linc,Roll&f=json&returnGeometry=true`;

  const all: StonyPlainFeature[] = [];
  const pageSize = 2000;
  let offset = 0;
  while (offset < 50_000) {
    const url = `${QUERY_URL}&resultOffset=${offset}&resultRecordCount=${pageSize}`;
    const res = await fetchWithRetry(url, { userAgent: "tamrack-stony-plain-businesses" });
    const body = (await res.json()) as StonyPlainQueryResponse;
    if (!Array.isArray(body.features)) {
      throw new Error(`ArcGIS query returned no features array at offset=${offset}`);
    }
    all.push(...body.features);
    if (body.features.length < pageSize) break;
    offset += body.features.length;
  }
  return all;
}

/**
 * Fetch the Stony Plain ArcGIS business directory and upsert each business as
 * a substrate.entities row (kind='business'), plus write one daily count
 * observation to substrate.observations.
 *
 * Idempotent: ON CONFLICT (slug) DO UPDATE refreshes last_seen without
 * touching first_seen. Runs that miss a business leave last_seen stale —
 * that is how closures are detected.
 *
 * snapshot_log source string: substrate.entities.business.stony-plain
 */
export async function collectStonyPlainEntities(_today: string): Promise<number> {
  const SOURCE_NAME_SP = "Stony Plain ArcGIS Online";
  const SOURCE_BASE_SP = "https://services.arcgis.com/ScgF04sks0ZKbWe3";
  const QUERY_URL_SP =
    `${SOURCE_BASE_SP}/arcgis/rest/services/ToSP_Businesses/FeatureServer/0/query` +
    `?where=1%3D1&outFields=FID,NAME,CATEGORY,Linc,Roll&f=json&returnGeometry=true`;
  const ENTITY_KIND = "business";
  const STONY_PLAIN_SLUG = "stony-plain";
  const SERIES_SLUG = "stony-plain-businesses";

  const features = await fetchStonyPlainFeatures();
  const valid = features.filter((f) => f.attributes && typeof f.attributes.FID === "number");
  console.log(`[collector] stony-plain-entities: fetched ${features.length} features, ${valid.length} with valid FID`);

  const pool = await getDb();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const parent = await client.query<{ id: string }>(
      `SELECT id FROM substrate.geo_dimension WHERE slug = $1`,
      [STONY_PLAIN_SLUG]
    );
    if (parent.rowCount === 0) {
      const msg = `geo_dimension row for ${STONY_PLAIN_SLUG} not found`;
      await pool.query(SQL.logEntry, [`substrate.entities.${ENTITY_KIND}.stony-plain`, 0, "error", msg]);
      await client.query("ROLLBACK");
      return 0;
    }
    const stonyId: string = parent.rows[0].id;

    const src = await client.query<{ id: string }>(
      `INSERT INTO substrate.sources (name, base_url, auth_type)
       VALUES ($1, $2, 'public')
       ON CONFLICT (name) DO UPDATE SET base_url = EXCLUDED.base_url
       RETURNING id`,
      [SOURCE_NAME_SP, SOURCE_BASE_SP]
    );
    const sourceId: string = src.rows[0].id;

    // Upsert series_metadata (entity+observation dual storage).
    const ser = await client.query<{ id: string }>(
      `INSERT INTO substrate.series_metadata
         (slug, domain, name, source_id, unit, unit_type, cadence, geo_id,
          description, tags, upstream_key, storage_kind, entity_kind)
       VALUES
         ($1, 'business_directory', 'Stony Plain active businesses',
          $2, 'businesses', 'count', 'daily', $3,
          'Per-business entities (kind=business) with first_seen/last_seen presence, plus one daily count observation.',
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
        SERIES_SLUG, sourceId, stonyId,
        JSON.stringify({ kind: "arcgis", url: QUERY_URL_SP }),
        ENTITY_KIND,
      ]
    );
    const seriesId: string = ser.rows[0].id;

    // Upsert one entity row per business.
    let entityUpserts = 0;
    for (const f of valid) {
      const slug = `stony-plain-biz-${f.attributes.FID}`;
      const name = (f.attributes.NAME ?? "(unnamed)").trim() || "(unnamed)";
      const lon = f.geometry?.x != null && Number.isFinite(f.geometry.x)
        ? Math.round(f.geometry.x * 1_000_000) / 1_000_000
        : null;
      const lat = f.geometry?.y != null && Number.isFinite(f.geometry.y)
        ? Math.round(f.geometry.y * 1_000_000) / 1_000_000
        : null;
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

    // Active count today (for the daily observation row).
    const activeCount = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n
         FROM substrate.entities
         WHERE kind = $1 AND geo_id = $2 AND last_seen = CURRENT_DATE`,
      [ENTITY_KIND, stonyId]
    );

    // Daily count observation.
    await client.query(
      `INSERT INTO substrate.observations
         (series_id, period, geo_id, entity_id, value, raw_value, qualifier, collected_at)
       VALUES ($1, CURRENT_DATE, $2, NULL, $3, NULL, NULL, NOW())
       ON CONFLICT (series_id, period, geo_id, entity_id) DO UPDATE SET
         value = EXCLUDED.value, collected_at = EXCLUDED.collected_at`,
      [seriesId, stonyId, activeCount.rows[0].n]
    );

    await client.query(SQL.logEntry, [
      `substrate.entities.${ENTITY_KIND}.stony-plain`,
      entityUpserts,
      "ok",
      null,
    ]);

    await client.query("COMMIT");
    console.log(`[collector] stony-plain-entities: ${entityUpserts} entities upserted, ${activeCount.rows[0].n} active today`);
    return entityUpserts;
  } catch (err) {
    await client.query("ROLLBACK");
    const msg = err instanceof Error ? err.message : String(err);
    await pool.query(SQL.logEntry, [`substrate.entities.${ENTITY_KIND}.stony-plain`, 0, "error", msg]).catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

const PHASES: {
  name: string;
  key: string;
  sources: SourceName[];
  fn: (today: string) => Promise<number>;
}[] = [
  {
    name: "Regional Indicators",
    key: "regional_indicators",
    sources: ["regional", "all"],
    fn: () => collectRegionalIndicators(),
  },
  {
    name: "Energy Data",
    key: "energy_data",
    sources: ["energy", "all"],
    fn: () => collectEnergyData(),
  },
  {
    name: "Municipality Snapshots",
    key: "municipality_data",
    sources: ["municipalities", "all"],
    fn: (today) => collectMunicipalityData(today),
  },
  {
    name: "Well Licences",
    key: "well_licences",
    sources: ["wells", "all"],
    fn: (today) => collectWellLicences(today),
  },
  {
    name: "Immigration",
    key: "immigration",
    sources: ["immigration", "all"],
    fn: () => collectImmigration(),
  },
  {
    name: "Major Projects",
    key: "major_projects",
    sources: ["projects", "all"],
    fn: (today) => collectMajorProjects(today),
  },
  {
    name: "Macro Indicators",
    key: "macro_indicators",
    sources: ["macro", "all"],
    fn: (today) => collectMacroIndicators(today),
  },
  {
    name: "CMHC Housing",
    key: "cmhc_housing",
    sources: ["housing", "all"],
    fn: () => collectCMHCHousing(),
  },
  {
    name: "Procurement",
    key: "procurement",
    sources: ["procurement", "all"],
    fn: (today) => collectProcurementData(today),
  },
  {
    name: "Job Bank Hiring",
    key: "jobbank",
    sources: ["jobbank", "all"],
    fn: (today) => collectJobBankData(today),
  },
  {
    name: "Spruce Grove Licence Proxy",
    key: "spruce-grove-proxy",
    sources: ["spruce-grove-proxy", "all"],
    fn: (today) => collectSpruceGroveProxy(today),
  },
  {
    name: "Stony Plain Business Entities",
    key: "stony-plain-entities",
    sources: ["stony-plain-entities", "all"],
    fn: (today) => collectStonyPlainEntities(today),
  },
  {
    name: "Health",
    key: "health",
    sources: ["health", "all"],
    fn: (today) => collectHealth(today),
  },
  {
    name: "Public Safety",
    key: "safety",
    sources: ["safety", "all"],
    fn: (today) => collectSafety(today),
  },
  {
    name: "Politics",
    key: "politics",
    sources: ["politics", "all"],
    fn: (today) => collectPolitics(today),
  },
  {
    name: "Fiscal",
    key: "fiscal",
    sources: ["fiscal", "all"],
    fn: (today) => collectFiscal(today),
  },
  {
    name: "Environment",
    key: "environment",
    sources: ["environment", "all"],
    fn: (today) => collectEnvironment(today),
  },
  {
    name: "Business Licences",
    key: "business-licences",
    sources: ["business-licences", "all"],
    fn: (today) => collectBusinessLicences(today),
  },
  {
    name: "Entity Resolution",
    key: "entity-resolution",
    sources: ["entity-resolution", "all"],
    fn: (today) => resolveAllOperators(today),
  },
];

/**
 * Run data collection for the specified source (or all sources).
 * Each phase runs independently — failures are captured, not thrown.
 */
export async function runCollection(
  source: SourceName = "all"
): Promise<CollectionResult> {
  const startedAt = new Date().toISOString();
  const today = startedAt.split("T")[0];
  const start = Date.now();
  const pool = await getDb();

  const phases: PhaseResult[] = [];

  for (const phase of PHASES) {
    if (!phase.sources.includes(source)) continue;

    const phaseStart = Date.now();
    try {
      const rows = await phase.fn(today);
      phases.push({
        phase: phase.name,
        rows,
        elapsed: (Date.now() - phaseStart) / 1000,
        status: "ok",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      phases.push({
        phase: phase.name,
        rows: 0,
        elapsed: (Date.now() - phaseStart) / 1000,
        status: "error",
        error: msg,
      });
      await pool.query(SQL.logEntry, [phase.key, 0, "error", msg]);
    }
  }

  const finishedAt = new Date().toISOString();
  return {
    started_at: startedAt,
    finished_at: finishedAt,
    elapsed: (Date.now() - start) / 1000,
    phases,
    total_rows: phases.reduce((s, p) => s + p.rows, 0),
  };
}

/** Get the list of phase names for UI display */
export function getPhaseNames(): string[] {
  return PHASES.map((p) => p.name);
}
