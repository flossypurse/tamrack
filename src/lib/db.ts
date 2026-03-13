import pg from "pg";

// Return timestamps as strings (not Date objects) for frontend compatibility
pg.types.setTypeParser(1114, (val: string) => val); // TIMESTAMP
pg.types.setTypeParser(1184, (val: string) => val); // TIMESTAMPTZ

let _pool: pg.Pool | null = null;
let _migrated = false;

function getPool(): pg.Pool {
  if (!_pool) {
    _pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes("railway.internal")
        ? { rejectUnauthorized: false }
        : undefined,
    });
  }
  return _pool;
}

const MIGRATION_SQL = `
    -- Neighbourhood-level metrics over time
    CREATE TABLE IF NOT EXISTS neighbourhood_metrics (
      id SERIAL PRIMARY KEY,
      snapshot_date TEXT NOT NULL,
      neighbourhood TEXT NOT NULL,
      metric TEXT NOT NULL,
      value DOUBLE PRECISION NOT NULL,
      count INTEGER DEFAULT 0,
      UNIQUE(snapshot_date, neighbourhood, metric)
    );

    -- Macro indicators over time (BoC rate, unemployment, etc.)
    CREATE TABLE IF NOT EXISTS macro_metrics (
      id SERIAL PRIMARY KEY,
      snapshot_date TEXT NOT NULL,
      indicator TEXT NOT NULL,
      value DOUBLE PRECISION NOT NULL,
      UNIQUE(snapshot_date, indicator)
    );

    -- Snapshot log
    CREATE TABLE IF NOT EXISTS snapshot_log (
      id SERIAL PRIMARY KEY,
      taken_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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
      email_verified TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
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
      expires TIMESTAMPTZ NOT NULL,
      UNIQUE(identifier, token)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      session_token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL REFERENCES users(id),
      stripe_customer_id TEXT UNIQUE,
      status TEXT NOT NULL DEFAULT 'trialing',
      plan TEXT DEFAULT 'pro',
      trial_start TIMESTAMPTZ,
      trial_end TIMESTAMPTZ,
      current_period_start TIMESTAMPTZ,
      current_period_end TIMESTAMPTZ,
      cancel_at_period_end INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key_hash TEXT UNIQUE NOT NULL,
      key_prefix TEXT NOT NULL,
      name TEXT DEFAULT 'Default',
      last_used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      revoked_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS api_usage (
      id SERIAL PRIMARY KEY,
      api_key_id TEXT REFERENCES api_keys(id),
      user_id TEXT REFERENCES users(id),
      endpoint TEXT NOT NULL,
      timestamp TIMESTAMPTZ DEFAULT NOW(),
      response_status INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_api_usage_key ON api_usage(api_key_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_api_usage_user ON api_usage(user_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe ON subscriptions(stripe_customer_id);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

    -- ============================================================
    -- Data collection tables
    -- ============================================================

    CREATE TABLE IF NOT EXISTS regional_indicators (
      id SERIAL PRIMARY KEY,
      csduid TEXT NOT NULL,
      municipality TEXT NOT NULL,
      indicator TEXT NOT NULL,
      period TEXT NOT NULL,
      value DOUBLE PRECISION NOT NULL,
      unit TEXT DEFAULT '',
      collected_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(csduid, indicator, period)
    );

    CREATE TABLE IF NOT EXISTS energy_throughput (
      id SERIAL PRIMARY KEY,
      date TEXT NOT NULL,
      pipeline TEXT NOT NULL,
      key_point TEXT DEFAULT '',
      product TEXT DEFAULT '',
      throughput DOUBLE PRECISION NOT NULL,
      capacity DOUBLE PRECISION DEFAULT 0,
      utilization DOUBLE PRECISION DEFAULT 0,
      unit TEXT DEFAULT '1000 b/d',
      collected_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(date, pipeline, key_point, product)
    );

    CREATE TABLE IF NOT EXISTS energy_production (
      id SERIAL PRIMARY KEY,
      date TEXT NOT NULL,
      province TEXT NOT NULL,
      product TEXT DEFAULT '',
      volume DOUBLE PRECISION NOT NULL,
      unit TEXT DEFAULT '',
      collected_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(date, province, product)
    );

    CREATE TABLE IF NOT EXISTS energy_apportionment (
      id SERIAL PRIMARY KEY,
      date TEXT NOT NULL,
      pipeline TEXT NOT NULL,
      original_nominations DOUBLE PRECISION DEFAULT 0,
      accepted_nominations DOUBLE PRECISION DEFAULT 0,
      apportionment_pct DOUBLE PRECISION DEFAULT 0,
      collected_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(date, pipeline)
    );

    CREATE TABLE IF NOT EXISTS municipality_assessments (
      id SERIAL PRIMARY KEY,
      snapshot_date TEXT NOT NULL,
      municipality TEXT NOT NULL,
      group_type TEXT NOT NULL,
      group_name TEXT NOT NULL,
      count INTEGER DEFAULT 0,
      avg_value DOUBLE PRECISION DEFAULT 0,
      min_value DOUBLE PRECISION DEFAULT 0,
      max_value DOUBLE PRECISION DEFAULT 0,
      UNIQUE(snapshot_date, municipality, group_type, group_name)
    );

    CREATE TABLE IF NOT EXISTS municipality_permits (
      id SERIAL PRIMARY KEY,
      snapshot_date TEXT NOT NULL,
      municipality TEXT NOT NULL,
      group_name TEXT NOT NULL,
      count INTEGER DEFAULT 0,
      total_value DOUBLE PRECISION DEFAULT 0,
      UNIQUE(snapshot_date, municipality, group_name)
    );

    CREATE TABLE IF NOT EXISTS well_licences (
      id SERIAL PRIMARY KEY,
      filing_date TEXT NOT NULL,
      licence_number TEXT NOT NULL,
      well_name TEXT DEFAULT '',
      unique_id TEXT DEFAULT '',
      surface_location TEXT DEFAULT '',
      projected_depth INTEGER DEFAULT 0,
      classification TEXT DEFAULT '',
      substance TEXT DEFAULT '',
      licensee TEXT DEFAULT '',
      collected_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(licence_number)
    );

    CREATE TABLE IF NOT EXISTS well_licence_daily (
      id SERIAL PRIMARY KEY,
      filing_date TEXT NOT NULL,
      total_count INTEGER DEFAULT 0,
      by_substance TEXT DEFAULT '{}',
      by_classification TEXT DEFAULT '{}',
      UNIQUE(filing_date)
    );

    CREATE TABLE IF NOT EXISTS immigration_records (
      id SERIAL PRIMARY KEY,
      year INTEGER NOT NULL,
      month INTEGER DEFAULT 0,
      province TEXT NOT NULL,
      category TEXT DEFAULT '',
      cma TEXT DEFAULT '',
      count INTEGER DEFAULT 0,
      collected_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(year, month, province, category, cma)
    );

    CREATE TABLE IF NOT EXISTS major_projects (
      id SERIAL PRIMARY KEY,
      snapshot_date TEXT NOT NULL,
      source TEXT NOT NULL,
      name TEXT NOT NULL,
      sector TEXT DEFAULT '',
      type TEXT DEFAULT '',
      stage TEXT DEFAULT '',
      cost DOUBLE PRECISION DEFAULT 0,
      location TEXT DEFAULT '',
      municipality TEXT DEFAULT '',
      UNIQUE(snapshot_date, source, name)
    );

    -- Indexes for collection tables
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
`;

/**
 * Get the Postgres pool, running migrations on first call.
 * All consumers should use this instead of accessing the pool directly.
 */
export async function getDb(): Promise<pg.Pool> {
  const pool = getPool();
  if (!_migrated) {
    await pool.query(MIGRATION_SQL);
    _migrated = true;
  }
  return pool;
}

/**
 * Run a function inside a transaction.
 */
export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const pool = await getDb();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// ============================================================
// Insert helpers
// ============================================================

export async function upsertNeighbourhoodMetric(
  snapshotDate: string,
  neighbourhood: string,
  metric: string,
  value: number,
  count: number = 0
) {
  const pool = await getDb();
  await pool.query(
    `INSERT INTO neighbourhood_metrics (snapshot_date, neighbourhood, metric, value, count)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT(snapshot_date, neighbourhood, metric)
     DO UPDATE SET value = EXCLUDED.value, count = EXCLUDED.count`,
    [snapshotDate, neighbourhood, metric, value, count]
  );
}

export async function upsertMacroMetric(
  snapshotDate: string,
  indicator: string,
  value: number
) {
  const pool = await getDb();
  await pool.query(
    `INSERT INTO macro_metrics (snapshot_date, indicator, value)
     VALUES ($1, $2, $3)
     ON CONFLICT(snapshot_date, indicator)
     DO UPDATE SET value = EXCLUDED.value`,
    [snapshotDate, indicator, value]
  );
}

export async function logSnapshot(
  source: string,
  recordsInserted: number,
  status = "ok",
  error?: string
) {
  const pool = await getDb();
  await pool.query(
    `INSERT INTO snapshot_log (taken_at, source, records_inserted, status, error)
     VALUES (NOW(), $1, $2, $3, $4)`,
    [source, recordsInserted, status, error ?? null]
  );
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

export async function getNeighbourhoodHistory(
  neighbourhood: string,
  metric: string,
  limit: number = 52
): Promise<NeighbourhoodMetricRow[]> {
  const pool = await getDb();
  const { rows } = await pool.query(
    `SELECT * FROM neighbourhood_metrics
     WHERE neighbourhood = $1 AND metric = $2
     ORDER BY snapshot_date DESC
     LIMIT $3`,
    [neighbourhood, metric, limit]
  );
  return rows;
}

export async function getLatestNeighbourhoodMetrics(
  metric: string
): Promise<NeighbourhoodMetricRow[]> {
  const pool = await getDb();
  const { rows } = await pool.query(
    `SELECT nm.* FROM neighbourhood_metrics nm
     INNER JOIN (
       SELECT MAX(snapshot_date) as max_date FROM neighbourhood_metrics WHERE metric = $1
     ) latest ON nm.snapshot_date = latest.max_date
     WHERE nm.metric = $1
     ORDER BY nm.value DESC`,
    [metric]
  );
  return rows;
}

export async function getMetricChange(
  metric: string,
  daysBack: number = 30
): Promise<
  {
    neighbourhood: string;
    current: number;
    previous: number;
    change: number;
    pct_change: number;
  }[]
> {
  const pool = await getDb();
  const { rows } = await pool.query(
    `WITH latest AS (
       SELECT neighbourhood, value as current_val
       FROM neighbourhood_metrics
       WHERE metric = $1 AND snapshot_date = (SELECT MAX(snapshot_date) FROM neighbourhood_metrics WHERE metric = $1)
     ),
     previous AS (
       SELECT neighbourhood, value as prev_val
       FROM neighbourhood_metrics
       WHERE metric = $1 AND snapshot_date <= (CURRENT_DATE - $2 * INTERVAL '1 day')::TEXT
       AND snapshot_date = (
         SELECT MAX(snapshot_date) FROM neighbourhood_metrics
         WHERE metric = $1 AND snapshot_date <= (CURRENT_DATE - $2 * INTERVAL '1 day')::TEXT
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
     ORDER BY change DESC`,
    [metric, daysBack]
  );
  return rows;
}

export async function getSnapshotLog(
  limit: number = 20
): Promise<
  {
    taken_at: string;
    source: string;
    records_inserted: number;
    status: string;
    error: string | null;
  }[]
> {
  const pool = await getDb();
  const { rows } = await pool.query(
    `SELECT * FROM snapshot_log ORDER BY taken_at DESC LIMIT $1`,
    [limit]
  );
  return rows;
}

export async function getSnapshotCount(): Promise<number> {
  const pool = await getDb();
  const { rows } = await pool.query(
    `SELECT COUNT(DISTINCT snapshot_date) as cnt FROM neighbourhood_metrics`
  );
  return rows[0]?.cnt ?? 0;
}

// ============================================================
// Regional indicators
// ============================================================

export async function upsertRegionalIndicator(
  csduid: string,
  municipality: string,
  indicator: string,
  period: string,
  value: number,
  unit: string = ""
) {
  const pool = await getDb();
  await pool.query(
    `INSERT INTO regional_indicators (csduid, municipality, indicator, period, value, unit)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT(csduid, indicator, period)
     DO UPDATE SET value = EXCLUDED.value, unit = EXCLUDED.unit, collected_at = NOW()`,
    [csduid, municipality, indicator, period, value, unit]
  );
}

export interface RegionalIndicatorRow {
  csduid: string;
  municipality: string;
  indicator: string;
  period: string;
  value: number;
  unit: string;
}

export async function getRegionalTimeSeries(
  municipality: string,
  indicator: string,
  limit: number = 50
): Promise<RegionalIndicatorRow[]> {
  const pool = await getDb();
  const { rows } = await pool.query(
    `SELECT * FROM regional_indicators
     WHERE LOWER(municipality) = LOWER($1) AND indicator = $2
     ORDER BY period ASC
     LIMIT $3`,
    [municipality, indicator, limit]
  );
  return rows;
}

export async function getRegionalLatest(
  indicator: string
): Promise<RegionalIndicatorRow[]> {
  const pool = await getDb();
  const { rows } = await pool.query(
    `SELECT ri.* FROM regional_indicators ri
     INNER JOIN (
       SELECT csduid, MAX(period) as max_period
       FROM regional_indicators
       WHERE indicator = $1
       GROUP BY csduid
     ) latest ON ri.csduid = latest.csduid AND ri.period = latest.max_period
     WHERE ri.indicator = $1
     ORDER BY ri.value DESC`,
    [indicator]
  );
  return rows;
}

export async function getRegionalMunicipalityCount(): Promise<number> {
  const pool = await getDb();
  const { rows } = await pool.query(
    `SELECT COUNT(DISTINCT municipality) as cnt FROM regional_indicators`
  );
  return rows[0]?.cnt ?? 0;
}

export async function getRegionalIndicatorCount(): Promise<number> {
  const pool = await getDb();
  const { rows } = await pool.query(
    `SELECT COUNT(DISTINCT indicator) as cnt FROM regional_indicators`
  );
  return rows[0]?.cnt ?? 0;
}

// ============================================================
// Energy data
// ============================================================

export async function upsertEnergyThroughput(
  date: string,
  pipeline: string,
  keyPoint: string,
  product: string,
  throughput: number,
  capacity: number,
  utilization: number,
  unit: string
) {
  const pool = await getDb();
  await pool.query(
    `INSERT INTO energy_throughput (date, pipeline, key_point, product, throughput, capacity, utilization, unit)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT(date, pipeline, key_point, product)
     DO UPDATE SET throughput = EXCLUDED.throughput, capacity = EXCLUDED.capacity,
                   utilization = EXCLUDED.utilization, collected_at = NOW()`,
    [date, pipeline, keyPoint, product, throughput, capacity, utilization, unit]
  );
}

export async function upsertEnergyProduction(
  date: string,
  province: string,
  product: string,
  volume: number,
  unit: string
) {
  const pool = await getDb();
  await pool.query(
    `INSERT INTO energy_production (date, province, product, volume, unit)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT(date, province, product)
     DO UPDATE SET volume = EXCLUDED.volume, collected_at = NOW()`,
    [date, province, product, volume, unit]
  );
}

export async function upsertEnergyApportionment(
  date: string,
  pipeline: string,
  original: number,
  accepted: number,
  pct: number
) {
  const pool = await getDb();
  await pool.query(
    `INSERT INTO energy_apportionment (date, pipeline, original_nominations, accepted_nominations, apportionment_pct)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT(date, pipeline)
     DO UPDATE SET original_nominations = EXCLUDED.original_nominations,
                   accepted_nominations = EXCLUDED.accepted_nominations,
                   apportionment_pct = EXCLUDED.apportionment_pct, collected_at = NOW()`,
    [date, pipeline, original, accepted, pct]
  );
}

// ============================================================
// Municipality assessments & permits
// ============================================================

export async function upsertMunicipalityAssessment(
  snapshotDate: string,
  municipality: string,
  groupType: string,
  groupName: string,
  count: number,
  avgValue: number,
  minValue: number,
  maxValue: number
) {
  const pool = await getDb();
  await pool.query(
    `INSERT INTO municipality_assessments (snapshot_date, municipality, group_type, group_name, count, avg_value, min_value, max_value)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT(snapshot_date, municipality, group_type, group_name)
     DO UPDATE SET count = EXCLUDED.count, avg_value = EXCLUDED.avg_value,
                   min_value = EXCLUDED.min_value, max_value = EXCLUDED.max_value`,
    [snapshotDate, municipality, groupType, groupName, count, avgValue, minValue, maxValue]
  );
}

export async function upsertMunicipalityPermit(
  snapshotDate: string,
  municipality: string,
  groupName: string,
  count: number,
  totalValue: number
) {
  const pool = await getDb();
  await pool.query(
    `INSERT INTO municipality_permits (snapshot_date, municipality, group_name, count, total_value)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT(snapshot_date, municipality, group_name)
     DO UPDATE SET count = EXCLUDED.count, total_value = EXCLUDED.total_value`,
    [snapshotDate, municipality, groupName, count, totalValue]
  );
}

export async function getMunicipalityAssessmentHistory(
  municipality: string,
  groupType: string = "zoning",
  limit: number = 90
): Promise<
  { snapshot_date: string; group_name: string; count: number; avg_value: number }[]
> {
  const pool = await getDb();
  const { rows } = await pool.query(
    `SELECT snapshot_date, group_name, count, avg_value
     FROM municipality_assessments
     WHERE municipality = $1 AND group_type = $2
     ORDER BY snapshot_date DESC
     LIMIT $3`,
    [municipality, groupType, limit]
  );
  return rows;
}

export async function getMunicipalityPermitHistory(
  municipality: string,
  limit: number = 90
): Promise<
  { snapshot_date: string; group_name: string; count: number; total_value: number }[]
> {
  const pool = await getDb();
  const { rows } = await pool.query(
    `SELECT snapshot_date, group_name, count, total_value
     FROM municipality_permits
     WHERE municipality = $1
     ORDER BY snapshot_date DESC
     LIMIT $2`,
    [municipality, limit]
  );
  return rows;
}

// ============================================================
// Well licences
// ============================================================

export async function upsertWellLicence(
  filingDate: string,
  licenceNumber: string,
  wellName: string,
  uniqueId: string,
  surfaceLocation: string,
  projectedDepth: number,
  classification: string,
  substance: string,
  licensee: string
) {
  const pool = await getDb();
  await pool.query(
    `INSERT INTO well_licences (filing_date, licence_number, well_name, unique_id, surface_location, projected_depth, classification, substance, licensee)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT(licence_number)
     DO UPDATE SET well_name = EXCLUDED.well_name, collected_at = NOW()`,
    [filingDate, licenceNumber, wellName, uniqueId, surfaceLocation, projectedDepth, classification, substance, licensee]
  );
}

export async function upsertWellLicenceDaily(
  filingDate: string,
  totalCount: number,
  bySubstance: string,
  byClassification: string
) {
  const pool = await getDb();
  await pool.query(
    `INSERT INTO well_licence_daily (filing_date, total_count, by_substance, by_classification)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT(filing_date)
     DO UPDATE SET total_count = EXCLUDED.total_count, by_substance = EXCLUDED.by_substance,
                   by_classification = EXCLUDED.by_classification`,
    [filingDate, totalCount, bySubstance, byClassification]
  );
}

// ============================================================
// Immigration
// ============================================================

export async function upsertImmigrationRecord(
  year: number,
  month: number,
  province: string,
  category: string,
  cma: string,
  count: number
) {
  const pool = await getDb();
  await pool.query(
    `INSERT INTO immigration_records (year, month, province, category, cma, count)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT(year, month, province, category, cma)
     DO UPDATE SET count = EXCLUDED.count, collected_at = NOW()`,
    [year, month, province, category, cma, count]
  );
}

export async function getImmigrationTimeSeries(
  province: string = "Alberta"
): Promise<{ year: number; total: number }[]> {
  const pool = await getDb();
  const { rows } = await pool.query(
    `SELECT year, SUM(count) as total
     FROM immigration_records
     WHERE LOWER(province) = LOWER($1) AND cma = ''
     GROUP BY year
     ORDER BY year ASC`,
    [province]
  );
  return rows;
}

// ============================================================
// Major projects
// ============================================================

export async function upsertMajorProject(
  snapshotDate: string,
  source: string,
  name: string,
  sector: string,
  type: string,
  stage: string,
  cost: number,
  location: string,
  municipality: string
) {
  const pool = await getDb();
  await pool.query(
    `INSERT INTO major_projects (snapshot_date, source, name, sector, type, stage, cost, location, municipality)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT(snapshot_date, source, name)
     DO UPDATE SET sector = EXCLUDED.sector, type = EXCLUDED.type, stage = EXCLUDED.stage,
                   cost = EXCLUDED.cost, location = EXCLUDED.location, municipality = EXCLUDED.municipality`,
    [snapshotDate, source, name, sector, type, stage, cost, location, municipality]
  );
}

// ============================================================
// Collection stats
// ============================================================

export async function getCollectionStats(): Promise<{
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
}> {
  const pool = await getDb();
  const q = async (sql: string) => {
    const { rows } = await pool.query(sql);
    return rows[0]?.cnt ?? 0;
  };
  return {
    regional_municipalities: await q(`SELECT COUNT(DISTINCT municipality) as cnt FROM regional_indicators`),
    regional_indicators: await q(`SELECT COUNT(DISTINCT indicator) as cnt FROM regional_indicators`),
    regional_rows: await q(`SELECT COUNT(*) as cnt FROM regional_indicators`),
    energy_throughput_rows: await q(`SELECT COUNT(*) as cnt FROM energy_throughput`),
    energy_production_rows: await q(`SELECT COUNT(*) as cnt FROM energy_production`),
    municipality_assessment_snapshots: await q(`SELECT COUNT(DISTINCT snapshot_date || municipality) as cnt FROM municipality_assessments`),
    municipality_permit_snapshots: await q(`SELECT COUNT(DISTINCT snapshot_date || municipality) as cnt FROM municipality_permits`),
    well_licence_count: await q(`SELECT COUNT(*) as cnt FROM well_licences`),
    immigration_rows: await q(`SELECT COUNT(*) as cnt FROM immigration_records`),
    major_project_rows: await q(`SELECT COUNT(*) as cnt FROM major_projects`),
  };
}

// ============================================================
// Table row counts (for admin dashboard)
// ============================================================

export interface TableRowCount {
  table_name: string;
  row_count: number;
}

const COLLECTION_TABLES = [
  "regional_indicators",
  "energy_throughput",
  "energy_production",
  "energy_apportionment",
  "municipality_assessments",
  "municipality_permits",
  "well_licences",
  "well_licence_daily",
  "immigration_records",
  "major_projects",
  "macro_metrics",
  "neighbourhood_metrics",
] as const;

export async function getTableRowCounts(): Promise<TableRowCount[]> {
  const pool = await getDb();
  const results: TableRowCount[] = [];
  for (const t of COLLECTION_TABLES) {
    try {
      const { rows } = await pool.query(`SELECT COUNT(*) as cnt FROM ${t}`);
      results.push({ table_name: t, row_count: Number(rows[0]?.cnt ?? 0) });
    } catch {
      results.push({ table_name: t, row_count: 0 });
    }
  }
  return results;
}

// ============================================================
// Collection history (for admin dashboard)
// ============================================================

export interface CollectionLogEntry {
  taken_at: string;
  source: string;
  records_inserted: number;
  status: string;
  error: string | null;
}

export async function getCollectionHistory(
  limit: number = 100
): Promise<CollectionLogEntry[]> {
  const pool = await getDb();
  const { rows } = await pool.query(
    `SELECT taken_at, source, records_inserted, status, error
     FROM snapshot_log
     ORDER BY taken_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

export async function getLastCollectionRun(): Promise<{
  taken_at: string;
  total_rows: number;
  sources: number;
  errors: number;
} | null> {
  const pool = await getDb();

  const latestResult = await pool.query(
    `SELECT taken_at FROM snapshot_log ORDER BY taken_at DESC LIMIT 1`
  );
  const latest = latestResult.rows[0];
  if (!latest) return null;

  const clusterResult = await pool.query(
    `SELECT
       MIN(taken_at) as taken_at,
       SUM(records_inserted) as total_rows,
       COUNT(*) as sources,
       SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors
     FROM snapshot_log
     WHERE taken_at >= $1::TIMESTAMPTZ - INTERVAL '10 minutes'`,
    [latest.taken_at]
  );

  const cluster = clusterResult.rows[0];
  if (!cluster) return null;

  return {
    taken_at: cluster.taken_at,
    total_rows: Number(cluster.total_rows),
    sources: Number(cluster.sources),
    errors: Number(cluster.errors),
  };
}

export async function getCollectionGrowth(): Promise<
  { date: string; source: string; rows: number }[]
> {
  const pool = await getDb();
  const { rows } = await pool.query(
    `SELECT DATE(taken_at)::TEXT as date, source, SUM(records_inserted) as rows
     FROM snapshot_log
     WHERE status = 'ok'
     GROUP BY DATE(taken_at), source
     ORDER BY date ASC`
  );
  return rows.map((r) => ({ ...r, rows: Number(r.rows) }));
}
