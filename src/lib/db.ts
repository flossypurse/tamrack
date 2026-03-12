import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "pulse.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    fs.mkdirSync(DB_DIR, { recursive: true });
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    migrate(_db);
  }
  return _db;
}

function migrate(db: Database.Database) {
  db.exec(`
    -- Neighbourhood-level metrics over time
    CREATE TABLE IF NOT EXISTS neighbourhood_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snapshot_date TEXT NOT NULL,       -- YYYY-MM-DD
      neighbourhood TEXT NOT NULL,
      metric TEXT NOT NULL,              -- e.g. 'permits', 'units', 'construction_value', 'avg_assessment', 'dev_permits', 'renovation_permits'
      value REAL NOT NULL,
      count INTEGER DEFAULT 0,
      UNIQUE(snapshot_date, neighbourhood, metric)
    );

    -- Macro indicators over time (BoC rate, unemployment, etc.)
    CREATE TABLE IF NOT EXISTS macro_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snapshot_date TEXT NOT NULL,
      indicator TEXT NOT NULL,
      value REAL NOT NULL,
      UNIQUE(snapshot_date, indicator)
    );

    -- Snapshot log — tracks when we last pulled data
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

    -- ============================================================
    -- Auth & SaaS tables
    -- ============================================================

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      image TEXT,
      role TEXT DEFAULT 'user',
      email_verified TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_account_id TEXT NOT NULL,
      refresh_token TEXT,
      access_token TEXT,
      expires_at INTEGER,
      token_type TEXT,
      scope TEXT,
      id_token TEXT,
      UNIQUE(provider, provider_account_id)
    );

    CREATE TABLE IF NOT EXISTS verification_tokens (
      identifier TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires TEXT NOT NULL,
      UNIQUE(identifier, token)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      session_token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL REFERENCES users(id),
      stripe_customer_id TEXT UNIQUE,
      status TEXT NOT NULL DEFAULT 'trialing',
      plan TEXT DEFAULT 'pro',
      trial_start TEXT,
      trial_end TEXT,
      current_period_start TEXT,
      current_period_end TEXT,
      cancel_at_period_end INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key_hash TEXT UNIQUE NOT NULL,
      key_prefix TEXT NOT NULL,
      name TEXT DEFAULT 'Default',
      last_used_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      revoked_at TEXT
    );

    CREATE TABLE IF NOT EXISTS api_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      api_key_id TEXT REFERENCES api_keys(id),
      user_id TEXT REFERENCES users(id),
      endpoint TEXT NOT NULL,
      timestamp TEXT DEFAULT (datetime('now')),
      response_status INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_api_usage_key ON api_usage(api_key_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_api_usage_user ON api_usage(user_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe ON subscriptions(stripe_customer_id);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

    -- ============================================================
    -- Data collection tables (expanded snapshot system)
    -- ============================================================

    -- Regional dashboard indicators: 54 indicators × ~340 municipalities
    -- Stores the government's own time-series (period = their reporting period)
    -- Upsert on each collection run — new government periods get added automatically
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

    -- Pipeline throughput and capacity (CER open data)
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

    -- Oil and gas production by province (CER open data)
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

    -- Pipeline apportionment / congestion (CER open data)
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

    -- Municipality-level assessment snapshots (daily from ArcGIS/Socrata)
    -- Our snapshot_date matters here — source only shows current state
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

    -- Municipality-level permit snapshots (daily from ArcGIS/Socrata)
    CREATE TABLE IF NOT EXISTS municipality_permits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snapshot_date TEXT NOT NULL,
      municipality TEXT NOT NULL,
      group_name TEXT NOT NULL,
      count INTEGER DEFAULT 0,
      total_value REAL DEFAULT 0,
      UNIQUE(snapshot_date, municipality, group_name)
    );

    -- AER well licence filings (individual records)
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

    -- Daily well licence aggregate counts (for quick time-series)
    CREATE TABLE IF NOT EXISTS well_licence_daily (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filing_date TEXT NOT NULL,
      total_count INTEGER DEFAULT 0,
      by_substance TEXT DEFAULT '{}',
      by_classification TEXT DEFAULT '{}',
      UNIQUE(filing_date)
    );

    -- IRCC immigration data (government time-series, upsert)
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

    -- Major project inventory snapshots
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

    -- Indexes for new tables
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
}

// ============================================================
// Insert helpers
// ============================================================

export function upsertNeighbourhoodMetric(
  snapshotDate: string,
  neighbourhood: string,
  metric: string,
  value: number,
  count: number = 0
) {
  const db = getDb();
  db.prepare(`
    INSERT INTO neighbourhood_metrics (snapshot_date, neighbourhood, metric, value, count)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(snapshot_date, neighbourhood, metric)
    DO UPDATE SET value = excluded.value, count = excluded.count
  `).run(snapshotDate, neighbourhood, metric, value, count);
}

export function upsertMacroMetric(
  snapshotDate: string,
  indicator: string,
  value: number
) {
  const db = getDb();
  db.prepare(`
    INSERT INTO macro_metrics (snapshot_date, indicator, value)
    VALUES (?, ?, ?)
    ON CONFLICT(snapshot_date, indicator)
    DO UPDATE SET value = excluded.value
  `).run(snapshotDate, indicator, value);
}

export function logSnapshot(source: string, recordsInserted: number, status = "ok", error?: string) {
  const db = getDb();
  db.prepare(`
    INSERT INTO snapshot_log (taken_at, source, records_inserted, status, error)
    VALUES (datetime('now'), ?, ?, ?, ?)
  `).run(source, recordsInserted, status, error ?? null);
}

// ============================================================
// Query helpers
// ============================================================

export interface NeighbourhoodMetricRow {
  snapshot_date: string;
  neighbourhood: string;
  metric: string;
  value: number;
  count: number;
}

export function getNeighbourhoodHistory(
  neighbourhood: string,
  metric: string,
  limit: number = 52
): NeighbourhoodMetricRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM neighbourhood_metrics
    WHERE neighbourhood = ? AND metric = ?
    ORDER BY snapshot_date DESC
    LIMIT ?
  `).all(neighbourhood, metric, limit) as NeighbourhoodMetricRow[];
}

export function getLatestNeighbourhoodMetrics(
  metric: string
): NeighbourhoodMetricRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT nm.* FROM neighbourhood_metrics nm
    INNER JOIN (
      SELECT MAX(snapshot_date) as max_date FROM neighbourhood_metrics WHERE metric = ?
    ) latest ON nm.snapshot_date = latest.max_date
    WHERE nm.metric = ?
    ORDER BY nm.value DESC
  `).all(metric, metric) as NeighbourhoodMetricRow[];
}

export function getMetricChange(
  metric: string,
  daysBack: number = 30
): { neighbourhood: string; current: number; previous: number; change: number; pct_change: number }[] {
  const db = getDb();
  return db.prepare(`
    WITH latest AS (
      SELECT neighbourhood, value as current_val
      FROM neighbourhood_metrics
      WHERE metric = ? AND snapshot_date = (SELECT MAX(snapshot_date) FROM neighbourhood_metrics WHERE metric = ?)
    ),
    previous AS (
      SELECT neighbourhood, value as prev_val
      FROM neighbourhood_metrics
      WHERE metric = ? AND snapshot_date <= date('now', '-' || ? || ' days')
      AND snapshot_date = (
        SELECT MAX(snapshot_date) FROM neighbourhood_metrics
        WHERE metric = ? AND snapshot_date <= date('now', '-' || ? || ' days')
      )
    )
    SELECT
      latest.neighbourhood,
      latest.current_val as current,
      COALESCE(previous.prev_val, 0) as previous,
      (latest.current_val - COALESCE(previous.prev_val, 0)) as change,
      CASE WHEN COALESCE(previous.prev_val, 0) = 0 THEN 0
           ELSE ROUND(((latest.current_val - previous.prev_val) / ABS(previous.prev_val)) * 100, 1)
      END as pct_change
    FROM latest
    LEFT JOIN previous ON latest.neighbourhood = previous.neighbourhood
    ORDER BY change DESC
  `).all(metric, metric, metric, daysBack, metric, daysBack) as { neighbourhood: string; current: number; previous: number; change: number; pct_change: number }[];
}

export function getSnapshotLog(limit: number = 20): { taken_at: string; source: string; records_inserted: number; status: string; error: string | null }[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM snapshot_log ORDER BY taken_at DESC LIMIT ?
  `).all(limit) as { taken_at: string; source: string; records_inserted: number; status: string; error: string | null }[];
}

export function getSnapshotCount(): number {
  const db = getDb();
  const row = db.prepare(`SELECT COUNT(DISTINCT snapshot_date) as cnt FROM neighbourhood_metrics`).get() as { cnt: number };
  return row?.cnt ?? 0;
}

// ============================================================
// Regional indicators
// ============================================================

export function upsertRegionalIndicator(
  csduid: string,
  municipality: string,
  indicator: string,
  period: string,
  value: number,
  unit: string = ""
) {
  const db = getDb();
  db.prepare(`
    INSERT INTO regional_indicators (csduid, municipality, indicator, period, value, unit)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(csduid, indicator, period)
    DO UPDATE SET value = excluded.value, unit = excluded.unit, collected_at = datetime('now')
  `).run(csduid, municipality, indicator, period, value, unit);
}

export interface RegionalIndicatorRow {
  csduid: string;
  municipality: string;
  indicator: string;
  period: string;
  value: number;
  unit: string;
}

export function getRegionalTimeSeries(
  municipality: string,
  indicator: string,
  limit: number = 50
): RegionalIndicatorRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM regional_indicators
    WHERE LOWER(municipality) = LOWER(?) AND indicator = ?
    ORDER BY period ASC
    LIMIT ?
  `).all(municipality, indicator, limit) as RegionalIndicatorRow[];
}

export function getRegionalLatest(
  indicator: string
): RegionalIndicatorRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT ri.* FROM regional_indicators ri
    INNER JOIN (
      SELECT csduid, MAX(period) as max_period
      FROM regional_indicators
      WHERE indicator = ?
      GROUP BY csduid
    ) latest ON ri.csduid = latest.csduid AND ri.period = latest.max_period
    WHERE ri.indicator = ?
    ORDER BY ri.value DESC
  `).all(indicator, indicator) as RegionalIndicatorRow[];
}

export function getRegionalMunicipalityCount(): number {
  const db = getDb();
  const row = db.prepare(`SELECT COUNT(DISTINCT municipality) as cnt FROM regional_indicators`).get() as { cnt: number };
  return row?.cnt ?? 0;
}

export function getRegionalIndicatorCount(): number {
  const db = getDb();
  const row = db.prepare(`SELECT COUNT(DISTINCT indicator) as cnt FROM regional_indicators`).get() as { cnt: number };
  return row?.cnt ?? 0;
}

// ============================================================
// Energy data
// ============================================================

export function upsertEnergyThroughput(
  date: string, pipeline: string, keyPoint: string, product: string,
  throughput: number, capacity: number, utilization: number, unit: string
) {
  const db = getDb();
  db.prepare(`
    INSERT INTO energy_throughput (date, pipeline, key_point, product, throughput, capacity, utilization, unit)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(date, pipeline, key_point, product)
    DO UPDATE SET throughput = excluded.throughput, capacity = excluded.capacity,
                  utilization = excluded.utilization, collected_at = datetime('now')
  `).run(date, pipeline, keyPoint, product, throughput, capacity, utilization, unit);
}

export function upsertEnergyProduction(
  date: string, province: string, product: string, volume: number, unit: string
) {
  const db = getDb();
  db.prepare(`
    INSERT INTO energy_production (date, province, product, volume, unit)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(date, province, product)
    DO UPDATE SET volume = excluded.volume, collected_at = datetime('now')
  `).run(date, province, product, volume, unit);
}

export function upsertEnergyApportionment(
  date: string, pipeline: string, original: number, accepted: number, pct: number
) {
  const db = getDb();
  db.prepare(`
    INSERT INTO energy_apportionment (date, pipeline, original_nominations, accepted_nominations, apportionment_pct)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(date, pipeline)
    DO UPDATE SET original_nominations = excluded.original_nominations,
                  accepted_nominations = excluded.accepted_nominations,
                  apportionment_pct = excluded.apportionment_pct, collected_at = datetime('now')
  `).run(date, pipeline, original, accepted, pct);
}

// ============================================================
// Municipality assessments & permits
// ============================================================

export function upsertMunicipalityAssessment(
  snapshotDate: string, municipality: string, groupType: string, groupName: string,
  count: number, avgValue: number, minValue: number, maxValue: number
) {
  const db = getDb();
  db.prepare(`
    INSERT INTO municipality_assessments (snapshot_date, municipality, group_type, group_name, count, avg_value, min_value, max_value)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(snapshot_date, municipality, group_type, group_name)
    DO UPDATE SET count = excluded.count, avg_value = excluded.avg_value,
                  min_value = excluded.min_value, max_value = excluded.max_value
  `).run(snapshotDate, municipality, groupType, groupName, count, avgValue, minValue, maxValue);
}

export function upsertMunicipalityPermit(
  snapshotDate: string, municipality: string, groupName: string,
  count: number, totalValue: number
) {
  const db = getDb();
  db.prepare(`
    INSERT INTO municipality_permits (snapshot_date, municipality, group_name, count, total_value)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(snapshot_date, municipality, group_name)
    DO UPDATE SET count = excluded.count, total_value = excluded.total_value
  `).run(snapshotDate, municipality, groupName, count, totalValue);
}

export function getMunicipalityAssessmentHistory(
  municipality: string,
  groupType: string = "zoning",
  limit: number = 90
): { snapshot_date: string; group_name: string; count: number; avg_value: number }[] {
  const db = getDb();
  return db.prepare(`
    SELECT snapshot_date, group_name, count, avg_value
    FROM municipality_assessments
    WHERE municipality = ? AND group_type = ?
    ORDER BY snapshot_date DESC
    LIMIT ?
  `).all(municipality, groupType, limit) as { snapshot_date: string; group_name: string; count: number; avg_value: number }[];
}

export function getMunicipalityPermitHistory(
  municipality: string,
  limit: number = 90
): { snapshot_date: string; group_name: string; count: number; total_value: number }[] {
  const db = getDb();
  return db.prepare(`
    SELECT snapshot_date, group_name, count, total_value
    FROM municipality_permits
    WHERE municipality = ?
    ORDER BY snapshot_date DESC
    LIMIT ?
  `).all(municipality, limit) as { snapshot_date: string; group_name: string; count: number; total_value: number }[];
}

// ============================================================
// Well licences
// ============================================================

export function upsertWellLicence(
  filingDate: string, licenceNumber: string, wellName: string, uniqueId: string,
  surfaceLocation: string, projectedDepth: number, classification: string,
  substance: string, licensee: string
) {
  const db = getDb();
  db.prepare(`
    INSERT INTO well_licences (filing_date, licence_number, well_name, unique_id, surface_location, projected_depth, classification, substance, licensee)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(licence_number)
    DO UPDATE SET well_name = excluded.well_name, collected_at = datetime('now')
  `).run(filingDate, licenceNumber, wellName, uniqueId, surfaceLocation, projectedDepth, classification, substance, licensee);
}

export function upsertWellLicenceDaily(
  filingDate: string, totalCount: number, bySubstance: string, byClassification: string
) {
  const db = getDb();
  db.prepare(`
    INSERT INTO well_licence_daily (filing_date, total_count, by_substance, by_classification)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(filing_date)
    DO UPDATE SET total_count = excluded.total_count, by_substance = excluded.by_substance,
                  by_classification = excluded.by_classification
  `).run(filingDate, totalCount, bySubstance, byClassification);
}

// ============================================================
// Immigration
// ============================================================

export function upsertImmigrationRecord(
  year: number, month: number, province: string, category: string, cma: string, count: number
) {
  const db = getDb();
  db.prepare(`
    INSERT INTO immigration_records (year, month, province, category, cma, count)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(year, month, province, category, cma)
    DO UPDATE SET count = excluded.count, collected_at = datetime('now')
  `).run(year, month, province, category, cma, count);
}

export function getImmigrationTimeSeries(
  province: string = "Alberta"
): { year: number; total: number }[] {
  const db = getDb();
  return db.prepare(`
    SELECT year, SUM(count) as total
    FROM immigration_records
    WHERE LOWER(province) = LOWER(?) AND cma = ''
    GROUP BY year
    ORDER BY year ASC
  `).all(province) as { year: number; total: number }[];
}

// ============================================================
// Major projects
// ============================================================

export function upsertMajorProject(
  snapshotDate: string, source: string, name: string, sector: string,
  type: string, stage: string, cost: number, location: string, municipality: string
) {
  const db = getDb();
  db.prepare(`
    INSERT INTO major_projects (snapshot_date, source, name, sector, type, stage, cost, location, municipality)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(snapshot_date, source, name)
    DO UPDATE SET sector = excluded.sector, type = excluded.type, stage = excluded.stage,
                  cost = excluded.cost, location = excluded.location, municipality = excluded.municipality
  `).run(snapshotDate, source, name, sector, type, stage, cost, location, municipality);
}

// ============================================================
// Collection stats
// ============================================================

export function getCollectionStats(): {
  regional_municipalities: number;
  regional_indicators: number;
  regional_rows: number;
  energy_throughput_rows: number;
  energy_production_rows: number;
  municipality_assessment_snapshots: number;
  municipality_permit_snapshots: number;
  well_licence_count: number;
  immigration_rows: number;
  major_project_rows: number;
} {
  const db = getDb();
  const q = (sql: string) => (db.prepare(sql).get() as { cnt: number })?.cnt ?? 0;
  return {
    regional_municipalities: q(`SELECT COUNT(DISTINCT municipality) as cnt FROM regional_indicators`),
    regional_indicators: q(`SELECT COUNT(DISTINCT indicator) as cnt FROM regional_indicators`),
    regional_rows: q(`SELECT COUNT(*) as cnt FROM regional_indicators`),
    energy_throughput_rows: q(`SELECT COUNT(*) as cnt FROM energy_throughput`),
    energy_production_rows: q(`SELECT COUNT(*) as cnt FROM energy_production`),
    municipality_assessment_snapshots: q(`SELECT COUNT(DISTINCT snapshot_date || municipality) as cnt FROM municipality_assessments`),
    municipality_permit_snapshots: q(`SELECT COUNT(DISTINCT snapshot_date || municipality) as cnt FROM municipality_permits`),
    well_licence_count: q(`SELECT COUNT(*) as cnt FROM well_licences`),
    immigration_rows: q(`SELECT COUNT(*) as cnt FROM immigration_records`),
    major_project_rows: q(`SELECT COUNT(*) as cnt FROM major_projects`),
  };
}
