/**
 * Alberta Pulse — Shared Collection Logic
 *
 * Runs the 7 data collection phases using Postgres via getDb()/withTransaction().
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
  upsertWellLicence: `
    INSERT INTO well_licences (filing_date, licence_number, well_name, unique_id, surface_location, projected_depth, classification, substance, licensee)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT(licence_number)
    DO UPDATE SET well_name = EXCLUDED.well_name, collected_at = NOW()`,
  upsertWellDaily: `
    INSERT INTO well_licence_daily (filing_date, total_count, by_substance, by_classification)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT(filing_date)
    DO UPDATE SET total_count = EXCLUDED.total_count, by_substance = EXCLUDED.by_substance,
                  by_classification = EXCLUDED.by_classification`,
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

  // Daily aggregates
  const bySubstance: Record<string, number> = {};
  const byClassification: Record<string, number> = {};
  for (const lic of licences) {
    const sub = lic.substance || "Unknown";
    const cls = lic.classification || "Unknown";
    bySubstance[sub] = (bySubstance[sub] || 0) + 1;
    byClassification[cls] = (byClassification[cls] || 0) + 1;
  }

  await pool.query(SQL.upsertWellDaily, [
    today, licences.length,
    JSON.stringify(bySubstance), JSON.stringify(byClassification),
  ]);

  await pool.query(SQL.logEntry, ["well_licences", licences.length, "ok", null]);
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
