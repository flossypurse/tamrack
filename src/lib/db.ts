import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "pulse.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
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
