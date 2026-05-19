#!/usr/bin/env npx tsx
/**
 * Daily snapshot script — pulls all API data and stores in SQLite.
 * Run manually or via cron: npx tsx scripts/snapshot.ts
 *
 * Each run captures a point-in-time view of:
 * - Neighbourhood-level building permits, dev permits, assessments, renovations
 * - Macro indicators (BoC rate, unemployment, CPI, etc.)
 *
 * Historical accumulation enables change detection:
 * "Which neighbourhoods are heating up?" requires knowing what they looked like last month.
 */

import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "pulse.db");
const EDMONTON_BASE = "https://data.edmonton.ca/resource";
const BOC_BASE = "https://www.bankofcanada.ca/valet";
const STATCAN_BASE = "https://www150.statcan.gc.ca/t1/wds/rest";

const DATASETS = {
  BUILDING_PERMITS: "rwuh-apwg",
  PROPERTY_ASSESSMENTS: "q7d6-ambg",
  BUSINESS_LICENCES: "qhi4-bdpu",
  DEVELOPMENT_PERMITS: "q4gd-6q9r",
};

const today = new Date().toISOString().split("T")[0];

// ============================================================
// DB setup (duplicated from db.ts to keep script standalone)
// ============================================================

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

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
  CREATE INDEX IF NOT EXISTS idx_neigh_metric ON neighbourhood_metrics(neighbourhood, metric, snapshot_date);
  CREATE INDEX IF NOT EXISTS idx_neigh_date ON neighbourhood_metrics(snapshot_date, metric);
  CREATE INDEX IF NOT EXISTS idx_macro_date ON macro_metrics(indicator, snapshot_date);
`);

const upsertNeigh = db.prepare(`
  INSERT INTO neighbourhood_metrics (snapshot_date, neighbourhood, metric, value, count)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(snapshot_date, neighbourhood, metric)
  DO UPDATE SET value = excluded.value, count = excluded.count
`);

const upsertMacro = db.prepare(`
  INSERT INTO macro_metrics (snapshot_date, indicator, value)
  VALUES (?, ?, ?)
  ON CONFLICT(snapshot_date, indicator)
  DO UPDATE SET value = excluded.value
`);

const logEntry = db.prepare(`
  INSERT INTO snapshot_log (taken_at, source, records_inserted, status, error)
  VALUES (datetime('now'), ?, ?, ?, ?)
`);

// ============================================================
// Fetch helpers
// ============================================================

async function fetchEdmonton(datasetId: string, params: Record<string, string>) {
  const url = new URL(`${EDMONTON_BASE}/${datasetId}.json`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Edmonton API ${res.status}: ${res.statusText}`);
  return res.json();
}

async function fetchBoC(seriesName: string, recent: number) {
  const res = await fetch(`${BOC_BASE}/observations/${seriesName}/json?recent=${recent}`);
  if (!res.ok) throw new Error(`BoC API ${res.status}`);
  return res.json();
}

async function fetchStatCan(tableId: number, coordinate: string, latestN: number) {
  const res = await fetch(`${STATCAN_BASE}/getDataFromCubePidCoordAndLatestNPeriods`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([{ productId: tableId, coordinate, latestN }]),
  });
  if (!res.ok) throw new Error(`StatsCan API ${res.status}`);
  return res.json();
}

// ============================================================
// Snapshot functions
// ============================================================

async function snapshotBuildingPermits() {
  console.log("  Building permits by neighbourhood...");
  const data = await fetchEdmonton(DATASETS.BUILDING_PERMITS, {
    $query: `SELECT neighbourhood, count(*) as cnt, sum(units_added) as total_units, sum(construction_value) as total_val WHERE issue_date > '2024-01-01' AND neighbourhood IS NOT NULL GROUP BY neighbourhood ORDER BY cnt DESC`,
  });
  if (!Array.isArray(data)) throw new Error("Bad response");

  const insert = db.transaction(() => {
    for (const row of data) {
      const hood = row.neighbourhood || "Unknown";
      const permits = parseInt(row.cnt || "0");
      const units = parseInt(row.total_units || "0");
      const value = parseInt(row.total_val || "0");
      upsertNeigh.run(today, hood, "permits", permits, 0);
      upsertNeigh.run(today, hood, "units_added", units, permits);
      upsertNeigh.run(today, hood, "construction_value", value, permits);
    }
  });
  insert();
  logEntry.run("building_permits", data.length * 3, "ok", null);
  console.log(`    ${data.length} neighbourhoods captured`);
}

async function snapshotDevPermits() {
  console.log("  Development permits by neighbourhood...");
  const data = await fetchEdmonton(DATASETS.DEVELOPMENT_PERMITS, {
    $query: `SELECT neighbourhood, neighbourhood_classification, count(*) as cnt WHERE permit_date > '2024-01-01' AND neighbourhood IS NOT NULL GROUP BY neighbourhood, neighbourhood_classification ORDER BY cnt DESC`,
  });
  if (!Array.isArray(data)) throw new Error("Bad response");

  const insert = db.transaction(() => {
    // Aggregate by neighbourhood (some have multiple classifications)
    const byHood = new Map<string, { count: number; redev: boolean }>();
    for (const row of data) {
      const hood = row.neighbourhood || "Unknown";
      const existing = byHood.get(hood) || { count: 0, redev: false };
      existing.count += parseInt(row.cnt || "0");
      if (row.neighbourhood_classification === "Redeveloping") existing.redev = true;
      byHood.set(hood, existing);
    }
    for (const [hood, stats] of byHood) {
      upsertNeigh.run(today, hood, "dev_permits", stats.count, 0);
      if (stats.redev) {
        upsertNeigh.run(today, hood, "is_redeveloping", 1, 0);
      }
    }
  });
  insert();
  logEntry.run("dev_permits", data.length, "ok", null);
  console.log(`    ${data.length} rows captured`);
}

async function snapshotAssessments() {
  console.log("  Property assessments by neighbourhood...");
  const data = await fetchEdmonton(DATASETS.PROPERTY_ASSESSMENTS, {
    $query: `SELECT neighbourhood, count(*) as cnt, avg(assessed_value::number) as avg_val, min(assessed_value::number) as min_val, max(assessed_value::number) as max_val WHERE tax_class='Residential' AND neighbourhood IS NOT NULL GROUP BY neighbourhood HAVING count(*) > 10 ORDER BY avg_val DESC`,
  });
  if (!Array.isArray(data)) throw new Error("Bad response");

  const insert = db.transaction(() => {
    for (const row of data) {
      const hood = row.neighbourhood || "Unknown";
      const avg = Math.round(parseFloat(row.avg_val || "0"));
      const count = parseInt(row.cnt || "0");
      const min = Math.round(parseFloat(row.min_val || "0"));
      const max = Math.round(parseFloat(row.max_val || "0"));
      upsertNeigh.run(today, hood, "avg_assessment", avg, count);
      upsertNeigh.run(today, hood, "min_assessment", min, count);
      upsertNeigh.run(today, hood, "max_assessment", max, count);
      // Spread = max-min/avg — higher spread means more diverse property values
      if (avg > 0) {
        upsertNeigh.run(today, hood, "assessment_spread", Math.round(((max - min) / avg) * 100), count);
      }
    }
  });
  insert();
  logEntry.run("assessments", data.length * 4, "ok", null);
  console.log(`    ${data.length} neighbourhoods captured`);
}

async function snapshotRenovations() {
  console.log("  Renovation permits by neighbourhood...");
  const data = await fetchEdmonton(DATASETS.BUILDING_PERMITS, {
    $query: `SELECT neighbourhood, count(*) as cnt, sum(construction_value) as total_val WHERE issue_date > '2024-01-01' AND job_category='Home Improvement' AND neighbourhood IS NOT NULL GROUP BY neighbourhood ORDER BY cnt DESC`,
  });
  if (!Array.isArray(data)) throw new Error("Bad response");

  const insert = db.transaction(() => {
    for (const row of data) {
      const hood = row.neighbourhood || "Unknown";
      const permits = parseInt(row.cnt || "0");
      const value = parseInt(row.total_val || "0");
      upsertNeigh.run(today, hood, "renovation_permits", permits, 0);
      upsertNeigh.run(today, hood, "renovation_value", value, permits);
    }
  });
  insert();
  logEntry.run("renovations", data.length * 2, "ok", null);
  console.log(`    ${data.length} neighbourhoods captured`);
}

async function snapshotBusinessLicences() {
  console.log("  Business licences by neighbourhood...");
  // Business licences have a trade_name and neighbourhood field
  const data = await fetchEdmonton(DATASETS.BUSINESS_LICENCES, {
    $query: `SELECT neighbourhood, count(*) as cnt WHERE most_recent_issue_date > '2024-01-01' AND neighbourhood IS NOT NULL GROUP BY neighbourhood ORDER BY cnt DESC LIMIT 200`,
  });
  if (!Array.isArray(data)) throw new Error("Bad response");

  const insert = db.transaction(() => {
    for (const row of data) {
      const hood = row.neighbourhood || "Unknown";
      const count = parseInt(row.cnt || "0");
      upsertNeigh.run(today, hood, "business_licences", count, 0);
    }
  });
  insert();
  logEntry.run("business_licences", data.length, "ok", null);
  console.log(`    ${data.length} neighbourhoods captured`);
}

async function snapshotMacroIndicators() {
  console.log("  Macro indicators...");
  let count = 0;

  // BoC
  try {
    const series = [
      { name: "V39079", label: "boc_policy_rate" },
      { name: "FXCADUSD", label: "cad_usd" },
      { name: "V80691335", label: "mortgage_5y_fixed" },
      { name: "V80691336", label: "mortgage_5y_variable" },
    ];
    for (const s of series) {
      const data = await fetchBoC(s.name, 1);
      const obs = data?.observations?.[0];
      if (obs) {
        const val = parseFloat((obs[s.name] as { v: string })?.v || "0");
        if (val) {
          upsertMacro.run(today, s.label, val);
          count++;
        }
      }
    }
  } catch (e) {
    console.log(`    BoC error: ${e}`);
  }

  // StatsCan
  try {
    const statsSeries = [
      { tableId: 14100287, coordinate: "10.7.1.1.1.1.0.0.0.0", label: "ab_unemployment" },
      { tableId: 18100004, coordinate: "23.2.0.0.0.0.0.0.0.0", label: "ab_cpi" },
    ];
    for (const s of statsSeries) {
      const data = await fetchStatCan(s.tableId, s.coordinate, 1);
      const item = Array.isArray(data) ? data[0] : data;
      if (item?.status === "SUCCESS") {
        const pts = item.object?.vectorDataPoint;
        if (pts?.length) {
          upsertMacro.run(today, s.label, pts[0].value);
          count++;
        }
      }
    }
  } catch (e) {
    console.log(`    StatsCan error: ${e}`);
  }

  logEntry.run("macro_indicators", count, "ok", null);
  console.log(`    ${count} indicators captured`);
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log(`\n Tamrack Snapshot — ${today}\n`);
  const start = Date.now();

  const tasks = [
    { name: "Building Permits", fn: snapshotBuildingPermits },
    { name: "Development Permits", fn: snapshotDevPermits },
    { name: "Assessments", fn: snapshotAssessments },
    { name: "Renovations", fn: snapshotRenovations },
    { name: "Business Licences", fn: snapshotBusinessLicences },
    { name: "Macro Indicators", fn: snapshotMacroIndicators },
  ];

  for (const task of tasks) {
    try {
      await task.fn();
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.log(`  ERROR [${task.name}]: ${errMsg}`);
      logEntry.run(task.name.toLowerCase().replace(/ /g, "_"), 0, "error", errMsg);
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n Done in ${elapsed}s\n`);

  // Print summary
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM neighbourhood_metrics WHERE snapshot_date = ?`).get(today) as { cnt: number };
  const snapshots = db.prepare(`SELECT COUNT(DISTINCT snapshot_date) as cnt FROM neighbourhood_metrics`).get() as { cnt: number };
  console.log(` Today: ${total.cnt} neighbourhood data points`);
  console.log(` Total snapshots in DB: ${snapshots.cnt} days\n`);

  db.close();
}

main().catch((e) => {
  console.error("Fatal:", e);
  db.close();
  process.exit(1);
});
