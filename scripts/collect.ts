#!/usr/bin/env npx tsx
/**
 * Tamrack — Comprehensive Data Collector
 *
 * Fetches from ALL data sources and stores in SQLite for time-series analysis.
 * Imports directly from the existing lib data-source modules.
 *
 * Usage:
 *   cd tamrack/webui && npx tsx scripts/collect.ts
 *   cd tamrack/webui && npx tsx scripts/collect.ts --source regional
 *   cd tamrack/webui && npx tsx scripts/collect.ts --source energy
 *
 * Sources: regional, energy, municipalities, wells, immigration, projects, macro, all (default)
 *
 * Expected runtime: 3-8 minutes (depending on API responsiveness)
 * Expected data per full run:
 *   - Regional: ~54 indicators × ~340 municipalities × ~10 periods = ~180K rows (first run)
 *   - Energy: ~6 pipelines × ~1000 data points + production + apportionment = ~10K rows
 *   - Municipalities: 22 municipalities × assessment groups + permit groups = ~2K rows/day
 *   - Well licences: ~20-100 per day
 *   - Immigration: ~5K rows (full IRCC history)
 *   - Major projects: ~500-1000 rows
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// ---------------------------------------------------------------------------
// Import data fetchers from lib modules
// These use global fetch — the { next: { revalidate } } option is ignored outside Next.js
// ---------------------------------------------------------------------------

import {
  REGIONAL_INDICATORS,
  fetchRegionalIndicator,
  type RegionalDataPoint,
} from "../src/lib/data-sources-regional";

import {
  CER_ENDPOINTS,
  type CEREndpointKey,
  fetchPipelineThroughput,
  fetchCrudeOilProduction,
  fetchApportionment,
} from "../src/lib/data-sources-cer";

import {
  fetchImmigrationByCategory,
  fetchImmigrationByCMA,
} from "../src/lib/data-sources-ircc";

import {
  fetchAlbertaMajorProjects,
  fetchInfrastructureProjects,
  fetchAERWellLicences,
} from "../src/lib/data-sources-infrastructure";

import {
  MUNICIPALITY_REGISTRY,
  type MunicipalityConfig,
} from "../src/lib/municipality-registry";

import {
  fetchAssessmentsByGroup,
  fetchPermitsByGroup,
} from "../src/lib/municipality-data";

import { STATSCAN_SERIES } from "../src/lib/data-sources";

// ---------------------------------------------------------------------------
// Database setup (standalone — same schema as db.ts)
// ---------------------------------------------------------------------------

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "pulse.db");

fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 10000");

// Run the full migration (matches db.ts)
db.exec(`
  CREATE TABLE IF NOT EXISTS neighbourhood_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_date TEXT NOT NULL,
    neighbourhood TEXT NOT NULL,
    metric TEXT NOT NULL,
    value REAL NOT NULL,
    count INTEGER DEFAULT 0,
    UNIQUE(snapshot_date, neighbourhood, metric)
  );
  CREATE TABLE IF NOT EXISTS macro_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_date TEXT NOT NULL,
    indicator TEXT NOT NULL,
    value REAL NOT NULL,
    UNIQUE(snapshot_date, indicator)
  );
  CREATE TABLE IF NOT EXISTS snapshot_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    taken_at TEXT NOT NULL,
    source TEXT NOT NULL,
    records_inserted INTEGER DEFAULT 0,
    status TEXT DEFAULT 'ok',
    error TEXT
  );

  CREATE TABLE IF NOT EXISTS regional_indicators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    csduid TEXT NOT NULL,
    municipality TEXT NOT NULL,
    indicator TEXT NOT NULL,
    period TEXT NOT NULL,
    value REAL NOT NULL,
    unit TEXT DEFAULT '',
    collected_at TEXT DEFAULT (datetime('now')),
    UNIQUE(csduid, indicator, period)
  );

  CREATE TABLE IF NOT EXISTS energy_throughput (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    pipeline TEXT NOT NULL,
    key_point TEXT DEFAULT '',
    product TEXT DEFAULT '',
    throughput REAL NOT NULL,
    capacity REAL DEFAULT 0,
    utilization REAL DEFAULT 0,
    unit TEXT DEFAULT '1000 b/d',
    collected_at TEXT DEFAULT (datetime('now')),
    UNIQUE(date, pipeline, key_point, product)
  );

  CREATE TABLE IF NOT EXISTS energy_production (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    province TEXT NOT NULL,
    product TEXT DEFAULT '',
    volume REAL NOT NULL,
    unit TEXT DEFAULT '',
    collected_at TEXT DEFAULT (datetime('now')),
    UNIQUE(date, province, product)
  );

  CREATE TABLE IF NOT EXISTS energy_apportionment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    pipeline TEXT NOT NULL,
    original_nominations REAL DEFAULT 0,
    accepted_nominations REAL DEFAULT 0,
    apportionment_pct REAL DEFAULT 0,
    collected_at TEXT DEFAULT (datetime('now')),
    UNIQUE(date, pipeline)
  );

  CREATE TABLE IF NOT EXISTS municipality_assessments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_date TEXT NOT NULL,
    municipality TEXT NOT NULL,
    group_type TEXT NOT NULL,
    group_name TEXT NOT NULL,
    count INTEGER DEFAULT 0,
    avg_value REAL DEFAULT 0,
    min_value REAL DEFAULT 0,
    max_value REAL DEFAULT 0,
    UNIQUE(snapshot_date, municipality, group_type, group_name)
  );

  CREATE TABLE IF NOT EXISTS municipality_permits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_date TEXT NOT NULL,
    municipality TEXT NOT NULL,
    group_name TEXT NOT NULL,
    count INTEGER DEFAULT 0,
    total_value REAL DEFAULT 0,
    UNIQUE(snapshot_date, municipality, group_name)
  );

  CREATE TABLE IF NOT EXISTS well_licences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filing_date TEXT NOT NULL,
    licence_number TEXT NOT NULL,
    well_name TEXT DEFAULT '',
    unique_id TEXT DEFAULT '',
    surface_location TEXT DEFAULT '',
    projected_depth INTEGER DEFAULT 0,
    classification TEXT DEFAULT '',
    substance TEXT DEFAULT '',
    licensee TEXT DEFAULT '',
    collected_at TEXT DEFAULT (datetime('now')),
    UNIQUE(licence_number)
  );

  CREATE TABLE IF NOT EXISTS well_licence_daily (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filing_date TEXT NOT NULL,
    total_count INTEGER DEFAULT 0,
    by_substance TEXT DEFAULT '{}',
    by_classification TEXT DEFAULT '{}',
    UNIQUE(filing_date)
  );

  CREATE TABLE IF NOT EXISTS immigration_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year INTEGER NOT NULL,
    month INTEGER DEFAULT 0,
    province TEXT NOT NULL,
    category TEXT DEFAULT '',
    cma TEXT DEFAULT '',
    count INTEGER DEFAULT 0,
    collected_at TEXT DEFAULT (datetime('now')),
    UNIQUE(year, month, province, category, cma)
  );

  CREATE TABLE IF NOT EXISTS major_projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_date TEXT NOT NULL,
    source TEXT NOT NULL,
    name TEXT NOT NULL,
    sector TEXT DEFAULT '',
    type TEXT DEFAULT '',
    stage TEXT DEFAULT '',
    cost REAL DEFAULT 0,
    location TEXT DEFAULT '',
    municipality TEXT DEFAULT '',
    UNIQUE(snapshot_date, source, name)
  );

  CREATE INDEX IF NOT EXISTS idx_neigh_metric ON neighbourhood_metrics(neighbourhood, metric, snapshot_date);
  CREATE INDEX IF NOT EXISTS idx_neigh_date ON neighbourhood_metrics(snapshot_date, metric);
  CREATE INDEX IF NOT EXISTS idx_macro_date ON macro_metrics(indicator, snapshot_date);
  CREATE INDEX IF NOT EXISTS idx_regional_muni ON regional_indicators(municipality, indicator);
  CREATE INDEX IF NOT EXISTS idx_regional_indicator ON regional_indicators(indicator, period);
  CREATE INDEX IF NOT EXISTS idx_regional_csduid ON regional_indicators(csduid, indicator);
  CREATE INDEX IF NOT EXISTS idx_energy_tp_pipeline ON energy_throughput(pipeline, date);
  CREATE INDEX IF NOT EXISTS idx_energy_prod_date ON energy_production(date, province);
  CREATE INDEX IF NOT EXISTS idx_energy_apport ON energy_apportionment(pipeline, date);
  CREATE INDEX IF NOT EXISTS idx_muni_assess ON municipality_assessments(municipality, snapshot_date);
  CREATE INDEX IF NOT EXISTS idx_muni_permits ON municipality_permits(municipality, snapshot_date);
  CREATE INDEX IF NOT EXISTS idx_well_date ON well_licences(filing_date);
  CREATE INDEX IF NOT EXISTS idx_well_substance ON well_licences(substance, filing_date);
  CREATE INDEX IF NOT EXISTS idx_well_licensee ON well_licences(licensee);
  CREATE INDEX IF NOT EXISTS idx_immigration ON immigration_records(year, province);
  CREATE INDEX IF NOT EXISTS idx_projects ON major_projects(snapshot_date, source);
`);

// ---------------------------------------------------------------------------
// Prepared statements
// ---------------------------------------------------------------------------

const stmts = {
  upsertRegional: db.prepare(`
    INSERT INTO regional_indicators (csduid, municipality, indicator, period, value, unit)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(csduid, indicator, period)
    DO UPDATE SET value = excluded.value, unit = excluded.unit, collected_at = datetime('now')
  `),
  upsertThroughput: db.prepare(`
    INSERT INTO energy_throughput (date, pipeline, key_point, product, throughput, capacity, utilization, unit)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(date, pipeline, key_point, product)
    DO UPDATE SET throughput = excluded.throughput, capacity = excluded.capacity,
                  utilization = excluded.utilization, collected_at = datetime('now')
  `),
  upsertProduction: db.prepare(`
    INSERT INTO energy_production (date, province, product, volume, unit)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(date, province, product)
    DO UPDATE SET volume = excluded.volume, collected_at = datetime('now')
  `),
  upsertApportionment: db.prepare(`
    INSERT INTO energy_apportionment (date, pipeline, original_nominations, accepted_nominations, apportionment_pct)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(date, pipeline)
    DO UPDATE SET original_nominations = excluded.original_nominations,
                  accepted_nominations = excluded.accepted_nominations,
                  apportionment_pct = excluded.apportionment_pct, collected_at = datetime('now')
  `),
  upsertAssessment: db.prepare(`
    INSERT INTO municipality_assessments (snapshot_date, municipality, group_type, group_name, count, avg_value, min_value, max_value)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(snapshot_date, municipality, group_type, group_name)
    DO UPDATE SET count = excluded.count, avg_value = excluded.avg_value,
                  min_value = excluded.min_value, max_value = excluded.max_value
  `),
  upsertPermit: db.prepare(`
    INSERT INTO municipality_permits (snapshot_date, municipality, group_name, count, total_value)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(snapshot_date, municipality, group_name)
    DO UPDATE SET count = excluded.count, total_value = excluded.total_value
  `),
  upsertWellLicence: db.prepare(`
    INSERT INTO well_licences (filing_date, licence_number, well_name, unique_id, surface_location, projected_depth, classification, substance, licensee)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(licence_number)
    DO UPDATE SET well_name = excluded.well_name, collected_at = datetime('now')
  `),
  upsertWellDaily: db.prepare(`
    INSERT INTO well_licence_daily (filing_date, total_count, by_substance, by_classification)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(filing_date)
    DO UPDATE SET total_count = excluded.total_count, by_substance = excluded.by_substance,
                  by_classification = excluded.by_classification
  `),
  upsertImmigration: db.prepare(`
    INSERT INTO immigration_records (year, month, province, category, cma, count)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(year, month, province, category, cma)
    DO UPDATE SET count = excluded.count, collected_at = datetime('now')
  `),
  upsertProject: db.prepare(`
    INSERT INTO major_projects (snapshot_date, source, name, sector, type, stage, cost, location, municipality)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(snapshot_date, source, name)
    DO UPDATE SET sector = excluded.sector, type = excluded.type, stage = excluded.stage,
                  cost = excluded.cost, location = excluded.location, municipality = excluded.municipality
  `),
  upsertMacro: db.prepare(`
    INSERT INTO macro_metrics (snapshot_date, indicator, value)
    VALUES (?, ?, ?)
    ON CONFLICT(snapshot_date, indicator)
    DO UPDATE SET value = excluded.value
  `),
  logEntry: db.prepare(`
    INSERT INTO snapshot_log (taken_at, source, records_inserted, status, error)
    VALUES (datetime('now'), ?, ?, ?, ?)
  `),
};

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
// Constants
// ---------------------------------------------------------------------------

const today = new Date().toISOString().split("T")[0];

const BOC_BASE = "https://www.bankofcanada.ca/valet";
const STATCAN_BASE = "https://www150.statcan.gc.ca/t1/wds/rest";

// ---------------------------------------------------------------------------
// Phase 1: Regional Indicators (the prize)
// 54 indicators × ~340 municipalities × multiple periods
// ---------------------------------------------------------------------------

async function collectRegionalIndicators(): Promise<number> {
  const indicatorNames = Object.keys(REGIONAL_INDICATORS);
  console.log(`  Fetching ${indicatorNames.length} indicators for ~340 municipalities...`);

  let totalRows = 0;
  let successCount = 0;
  let errorCount = 0;

  // Process in batches of 5 concurrent (matches the lib's own limiter)
  const tasks = indicatorNames.map(
    (name) => async () => {
      const data = await fetchRegionalIndicator(name);
      if (data.length === 0) return { name, count: 0 };

      // Aggregate by (csduid, indicator, period) — sum across dimensions
      const aggregated = new Map<string, { csduid: string; municipality: string; indicator: string; period: string; value: number; unit: string }>();

      for (const pt of data) {
        if (!pt.csduid || !pt.period) continue;
        const key = `${pt.csduid}|${pt.indicator}|${pt.period}`;
        const existing = aggregated.get(key);
        if (existing) {
          existing.value += pt.value;
        } else {
          aggregated.set(key, {
            csduid: pt.csduid,
            municipality: pt.municipality,
            indicator: pt.indicator,
            period: pt.period,
            value: pt.value,
            unit: pt.unit,
          });
        }
      }

      // Batch insert in a transaction
      const insert = db.transaction(() => {
        for (const row of aggregated.values()) {
          stmts.upsertRegional.run(
            row.csduid, row.municipality, row.indicator,
            row.period, row.value, row.unit
          );
        }
      });
      insert();

      return { name, count: aggregated.size };
    }
  );

  const results = await runWithConcurrency(tasks, 5);

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled") {
      totalRows += r.value.count;
      if (r.value.count > 0) successCount++;
      else errorCount++;
    } else {
      errorCount++;
      console.log(`    [error] ${indicatorNames[i]}: ${r.reason}`);
    }
  }

  stmts.logEntry.run("regional_indicators", totalRows, "ok", null);
  console.log(`    ${successCount}/${indicatorNames.length} indicators collected, ${totalRows} data points`);
  return totalRows;
}

// ---------------------------------------------------------------------------
// Phase 2: Energy Data (CER pipeline + production)
// ---------------------------------------------------------------------------

async function collectEnergyData(): Promise<number> {
  let totalRows = 0;

  // Pipeline throughput (6 pipelines)
  const throughputKeys: CEREndpointKey[] = [
    "NGTL_THROUGHPUT", "TRANS_MOUNTAIN_THROUGHPUT", "KEYSTONE_THROUGHPUT",
    "ENBRIDGE_MAINLINE_THROUGHPUT", "ALLIANCE_THROUGHPUT", "FOOTHILLS_THROUGHPUT",
  ];

  console.log(`  Fetching ${throughputKeys.length} pipeline throughput datasets...`);

  const throughputTasks = throughputKeys.map(
    (key) => async () => {
      const data = await fetchPipelineThroughput(key);
      if (data.length === 0) return 0;

      const insert = db.transaction(() => {
        for (const pt of data) {
          if (!pt.date) continue;
          stmts.upsertThroughput.run(
            pt.date, pt.pipeline, pt.keyPoint, pt.product,
            pt.throughput, pt.capacity, pt.utilization, pt.unit
          );
        }
      });
      insert();
      return data.length;
    }
  );

  const throughputResults = await runWithConcurrency(throughputTasks, 3);
  for (const r of throughputResults) {
    if (r.status === "fulfilled") totalRows += r.value;
  }
  console.log(`    Pipeline throughput: ${totalRows} rows`);

  // Crude oil production
  try {
    const production = await fetchCrudeOilProduction();
    if (production.length > 0) {
      const insert = db.transaction(() => {
        for (const pt of production) {
          if (!pt.date) continue;
          stmts.upsertProduction.run(pt.date, pt.province, pt.product, pt.volume, pt.unit);
        }
      });
      insert();
      totalRows += production.length;
      console.log(`    Crude production: ${production.length} rows`);
    }
  } catch (e) {
    console.log(`    [error] Crude production: ${e}`);
  }

  // Apportionment
  try {
    const apport = await fetchApportionment();
    if (apport.length > 0) {
      const insert = db.transaction(() => {
        for (const pt of apport) {
          if (!pt.date) continue;
          stmts.upsertApportionment.run(
            pt.date, pt.pipeline, pt.originalNominations,
            pt.acceptedNominations, pt.apportionmentPercent
          );
        }
      });
      insert();
      totalRows += apport.length;
      console.log(`    Apportionment: ${apport.length} rows`);
    }
  } catch (e) {
    console.log(`    [error] Apportionment: ${e}`);
  }

  stmts.logEntry.run("energy_data", totalRows, "ok", null);
  return totalRows;
}

// ---------------------------------------------------------------------------
// Phase 3: Municipality Assessments + Permits (22 live municipalities)
// ---------------------------------------------------------------------------

async function collectMunicipalityData(): Promise<number> {
  const liveMunis = MUNICIPALITY_REGISTRY.filter((m) => m.status === "live");
  console.log(`  Snapshotting ${liveMunis.length} live municipalities...`);

  let totalRows = 0;

  // Assessments — snapshot by zoning and neighbourhood
  const assessmentTasks = liveMunis
    .filter((m) => m.capabilities.includes("assessments") || m.endpoints.assessments || m.endpoints.parcels)
    .map((m) => async () => {
      let count = 0;

      // By zoning
      try {
        const byZoning = await fetchAssessmentsByGroup(m, "zoning");
        if (byZoning.length > 0) {
          const insert = db.transaction(() => {
            for (const row of byZoning) {
              stmts.upsertAssessment.run(
                today, m.slug, "zoning", row.group,
                row.count, row.avgAssessment, row.minAssessment, row.maxAssessment
              );
            }
          });
          insert();
          count += byZoning.length;
        }
      } catch (e) {
        console.log(`    [error] ${m.name} assessments/zoning: ${e}`);
      }

      // By neighbourhood (if available)
      if (m.fields.neighbourhood) {
        try {
          const byHood = await fetchAssessmentsByGroup(m, "neighbourhood");
          if (byHood.length > 0) {
            const insert = db.transaction(() => {
              for (const row of byHood) {
                stmts.upsertAssessment.run(
                  today, m.slug, "neighbourhood", row.group,
                  row.count, row.avgAssessment, row.minAssessment, row.maxAssessment
                );
              }
            });
            insert();
            count += byHood.length;
          }
        } catch {
          // neighbourhood grouping not always available
        }
      }

      return { name: m.name, count };
    });

  console.log(`    Collecting assessments from ${assessmentTasks.length} municipalities...`);
  const assessmentResults = await runWithConcurrency(assessmentTasks, 4);
  for (const r of assessmentResults) {
    if (r.status === "fulfilled") {
      totalRows += r.value.count;
      if (r.value.count > 0) {
        console.log(`      ${r.value.name}: ${r.value.count} groups`);
      }
    }
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
        const insert = db.transaction(() => {
          for (const row of permits) {
            stmts.upsertPermit.run(today, m.slug, row.group, row.count, row.totalValue);
          }
        });
        insert();
        return { name: m.name, count: permits.length };
      }
    } catch {
      // Some municipalities may not have permit data accessible
    }
    return { name: m.name, count: 0 };
  });

  console.log(`    Collecting permits from ${permitTasks.length} municipalities...`);
  const permitResults = await runWithConcurrency(permitTasks, 4);
  for (const r of permitResults) {
    if (r.status === "fulfilled" && r.value.count > 0) {
      totalRows += r.value.count;
      console.log(`      ${r.value.name}: ${r.value.count} permit groups`);
    }
  }

  stmts.logEntry.run("municipality_data", totalRows, "ok", null);
  return totalRows;
}

// ---------------------------------------------------------------------------
// Phase 4: Well Licences (AER daily filings)
// ---------------------------------------------------------------------------

async function collectWellLicences(): Promise<number> {
  console.log(`  Fetching AER well licences for today...`);

  try {
    const licences = await fetchAERWellLicences();
    if (licences.length === 0) {
      console.log(`    No well licences found for today (may be weekend/holiday)`);
      stmts.logEntry.run("well_licences", 0, "ok", "no data for today");
      return 0;
    }

    // Store individual licence records
    const insert = db.transaction(() => {
      for (const lic of licences) {
        if (!lic.licenceNumber) continue;
        stmts.upsertWellLicence.run(
          today, lic.licenceNumber, lic.wellName, lic.uniqueId,
          lic.surfaceLocation, lic.projectedDepth, lic.classification,
          lic.substance, lic.licensee
        );
      }
    });
    insert();

    // Compute and store daily aggregates
    const bySubstance: Record<string, number> = {};
    const byClassification: Record<string, number> = {};
    for (const lic of licences) {
      const sub = lic.substance || "Unknown";
      const cls = lic.classification || "Unknown";
      bySubstance[sub] = (bySubstance[sub] || 0) + 1;
      byClassification[cls] = (byClassification[cls] || 0) + 1;
    }

    stmts.upsertWellDaily.run(
      today, licences.length,
      JSON.stringify(bySubstance), JSON.stringify(byClassification)
    );

    stmts.logEntry.run("well_licences", licences.length, "ok", null);
    console.log(`    ${licences.length} well licences stored`);
    console.log(`    Substances: ${Object.entries(bySubstance).map(([k, v]) => `${k}(${v})`).join(", ")}`);
    return licences.length;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`    [error] Well licences: ${msg}`);
    stmts.logEntry.run("well_licences", 0, "error", msg);
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Phase 5: Immigration (IRCC open data)
// ---------------------------------------------------------------------------

async function collectImmigration(): Promise<number> {
  console.log(`  Fetching IRCC immigration data...`);
  let totalRows = 0;

  // PR by province + category (Alberta)
  try {
    const byCategory = await fetchImmigrationByCategory("Alberta");
    if (byCategory.length > 0) {
      const insert = db.transaction(() => {
        for (const rec of byCategory) {
          stmts.upsertImmigration.run(
            rec.year, rec.month, rec.province, rec.category, "", rec.count
          );
        }
      });
      insert();
      totalRows += byCategory.length;
      console.log(`    PR by category: ${byCategory.length} rows`);
    }
  } catch (e) {
    console.log(`    [error] PR by category: ${e}`);
  }

  // PR by CMA (Edmonton + Calgary)
  for (const cma of ["Edmonton", "Calgary"]) {
    try {
      const byCMA = await fetchImmigrationByCMA(cma);
      if (byCMA.length > 0) {
        const insert = db.transaction(() => {
          for (const rec of byCMA) {
            stmts.upsertImmigration.run(
              rec.year, rec.month, rec.province || "Alberta", "", cma, rec.count
            );
          }
        });
        insert();
        totalRows += byCMA.length;
        console.log(`    PR by CMA (${cma}): ${byCMA.length} rows`);
      }
    } catch (e) {
      console.log(`    [error] PR by CMA (${cma}): ${e}`);
    }
  }

  stmts.logEntry.run("immigration", totalRows, "ok", null);
  return totalRows;
}

// ---------------------------------------------------------------------------
// Phase 6: Major Projects
// ---------------------------------------------------------------------------

async function collectMajorProjects(): Promise<number> {
  console.log(`  Fetching major projects...`);
  let totalRows = 0;

  // Alberta Major Projects (>$5M)
  try {
    const abProjects = await fetchAlbertaMajorProjects();
    if (abProjects.length > 0) {
      const insert = db.transaction(() => {
        for (const p of abProjects) {
          if (!p.name) continue;
          stmts.upsertProject.run(
            today, "alberta", p.name, p.sector, p.type,
            p.stage, p.cost, p.location, p.municipality
          );
        }
      });
      insert();
      totalRows += abProjects.length;
      console.log(`    Alberta major projects: ${abProjects.length}`);
    }
  } catch (e) {
    console.log(`    [error] Alberta major projects: ${e}`);
  }

  // Federal Infrastructure (Alberta)
  try {
    const fedProjects = await fetchInfrastructureProjects("Alberta");
    if (fedProjects.length > 0) {
      const insert = db.transaction(() => {
        for (const p of fedProjects) {
          if (!p.name) continue;
          stmts.upsertProject.run(
            today, "federal", p.name, "", "",
            p.status, p.fundingAmount, p.location, ""
          );
        }
      });
      insert();
      totalRows += fedProjects.length;
      console.log(`    Federal infrastructure projects: ${fedProjects.length}`);
    }
  } catch (e) {
    console.log(`    [error] Federal infrastructure: ${e}`);
  }

  stmts.logEntry.run("major_projects", totalRows, "ok", null);
  return totalRows;
}

// ---------------------------------------------------------------------------
// Phase 7: Expanded Macro Indicators
// ---------------------------------------------------------------------------

async function collectMacroIndicators(): Promise<number> {
  console.log(`  Fetching macro indicators...`);
  let count = 0;

  // BoC series
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
          stmts.upsertMacro.run(today, s.label, val);
          count++;
        }
      }
    } catch (e) {
      console.log(`    [error] BoC ${s.label}: ${e}`);
    }
  }

  // BoC commodity indexes
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
          stmts.upsertMacro.run(today, s.label, val);
          count++;
        }
      }
    } catch {
      // commodity indexes may not have the same structure
    }
  }

  // StatsCan series — expand to all defined series
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

  // Fetch StatsCan series with concurrency limit (they rate-limit aggressively)
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
            stmts.upsertMacro.run(today, s.key, pts[0].value);
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

  stmts.logEntry.run("macro_indicators", count, "ok", null);
  console.log(`    ${count} macro indicators captured`);
  return count;
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

type SourceName = "regional" | "energy" | "municipalities" | "wells" | "immigration" | "projects" | "macro" | "all";

async function main() {
  const args = process.argv.slice(2);
  const sourceArg = args.find((a) => a.startsWith("--source"))
    ? args[args.indexOf("--source") + 1]
    : (args.find((a) => a.startsWith("--source="))?.split("=")[1] ?? "all");

  const source = (sourceArg || "all") as SourceName;

  console.log(`\n╔══════════════════════════════════════════════════╗`);
  console.log(`║  Tamrack — Data Collector                        ║`);
  console.log(`║  ${today}                                   ║`);
  console.log(`║  Source: ${source.padEnd(40)}║`);
  console.log(`╚══════════════════════════════════════════════════╝\n`);

  const start = Date.now();
  const results: { phase: string; rows: number; elapsed: number }[] = [];

  const phases: { name: string; sources: SourceName[]; fn: () => Promise<number> }[] = [
    { name: "Regional Indicators", sources: ["regional", "all"], fn: collectRegionalIndicators },
    { name: "Energy Data", sources: ["energy", "all"], fn: collectEnergyData },
    { name: "Municipality Snapshots", sources: ["municipalities", "all"], fn: collectMunicipalityData },
    { name: "Well Licences", sources: ["wells", "all"], fn: collectWellLicences },
    { name: "Immigration", sources: ["immigration", "all"], fn: collectImmigration },
    { name: "Major Projects", sources: ["projects", "all"], fn: collectMajorProjects },
    { name: "Macro Indicators", sources: ["macro", "all"], fn: collectMacroIndicators },
  ];

  for (const phase of phases) {
    if (!phase.sources.includes(source)) continue;

    console.log(`\n[${phase.name}]`);
    const phaseStart = Date.now();

    try {
      const rows = await phase.fn();
      const elapsed = (Date.now() - phaseStart) / 1000;
      results.push({ phase: phase.name, rows, elapsed });
      console.log(`  ✓ ${rows} rows in ${elapsed.toFixed(1)}s`);
    } catch (e) {
      const elapsed = (Date.now() - phaseStart) / 1000;
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ phase: phase.name, rows: 0, elapsed });
      console.log(`  ✗ ERROR in ${elapsed.toFixed(1)}s: ${msg}`);
      stmts.logEntry.run(phase.name.toLowerCase().replace(/ /g, "_"), 0, "error", msg);
    }
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------

  const totalElapsed = ((Date.now() - start) / 1000).toFixed(1);
  const totalRows = results.reduce((s, r) => s + r.rows, 0);

  console.log(`\n╔══════════════════════════════════════════════════╗`);
  console.log(`║  Collection Complete                             ║`);
  console.log(`╠══════════════════════════════════════════════════╣`);

  for (const r of results) {
    const rowStr = r.rows.toLocaleString().padStart(8);
    const timeStr = `${r.elapsed.toFixed(1)}s`.padStart(7);
    console.log(`║  ${r.phase.padEnd(28)} ${rowStr} rows ${timeStr} ║`);
  }

  console.log(`╠══════════════════════════════════════════════════╣`);
  console.log(`║  Total: ${totalRows.toLocaleString().padStart(8)} rows in ${totalElapsed}s`.padEnd(51) + `║`);
  console.log(`╚══════════════════════════════════════════════════╝`);

  // DB size
  try {
    const stats = fs.statSync(DB_PATH);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(1);
    console.log(`\n  Database: ${DB_PATH} (${sizeMB} MB)`);
  } catch {}

  // Row counts per table
  const tables = [
    "regional_indicators", "energy_throughput", "energy_production",
    "energy_apportionment", "municipality_assessments", "municipality_permits",
    "well_licences", "well_licence_daily", "immigration_records", "major_projects",
    "macro_metrics", "neighbourhood_metrics",
  ];
  console.log("\n  Table row counts:");
  for (const t of tables) {
    try {
      const row = db.prepare(`SELECT COUNT(*) as cnt FROM ${t}`).get() as { cnt: number };
      if (row.cnt > 0) {
        console.log(`    ${t.padEnd(30)} ${row.cnt.toLocaleString()}`);
      }
    } catch {}
  }

  console.log("");
  db.close();
}

main().catch((e) => {
  console.error("\nFatal:", e);
  db.close();
  process.exit(1);
});

// Graceful shutdown
process.on("SIGTERM", () => { db.close(); process.exit(0); });
process.on("SIGINT", () => { db.close(); process.exit(0); });
