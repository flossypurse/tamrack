import pg from "pg";

// Return timestamps as strings (not Date objects) for frontend compatibility
pg.types.setTypeParser(1114, (val: string) => val); // TIMESTAMP
pg.types.setTypeParser(1184, (val: string) => val); // TIMESTAMPTZ

let _pool: pg.Pool | null = null;
let _migrated = false;

function getPool(): pg.Pool {
  if (!_pool) {
    const dbUrl = process.env.DATABASE_URL ?? "";
    // Disable cert verification for private/internal Postgres hosts (Railway
    // 6PN and Crunchy Bridge). Both use self-signed / private CA certificates
    // that Node's default TLS store won't trust.
    //
    // Use URL + searchParams.delete to strip driver-specific params cleanly.
    // The old regex approach left a leading & when sslmode was the first query
    // param (e.g. ?sslmode=require&statement_cache_mode=disable → &statement_cache_mode=disable).
    if (!dbUrl.trim()) {
      _pool = new pg.Pool({ ssl: undefined });
      return _pool;
    }
    let hasSslMode = false;
    let cleanUrl = dbUrl;
    try {
      const u = new URL(dbUrl);
      const sslmode = u.searchParams.get("sslmode") ?? "";
      hasSslMode = ["require", "verify-full", "verify-ca", "prefer"].includes(sslmode);
      // Strip params that pg-connection-string would misinterpret or that are
      // intended for other Postgres clients (asyncpg, libpq, node-postgres
      // statement_cache_mode is not a libpq param and causes warnings).
      for (const p of ["sslmode", "uselibpqcompat", "statement_cache_mode"]) {
        u.searchParams.delete(p);
      }
      cleanUrl = u.toString();
    } catch (parseErr) {
      // Malformed URL — cannot safely strip statement_cache_mode/uselibpqcompat.
      // Proceeding with the raw URL would leave those params in the connection
      // string and re-introduce the pg-connection-string bug this refactor fixed.
      // Crunchy passwords with special chars (# ? & etc.) must be %-encoded.
      console.error("[db] DATABASE_URL parse failed; statement_cache_mode/uselibpqcompat NOT stripped — fix URL encoding");
      throw parseErr;
    }
    // Pool sizing tuned for Crunchy Bridge hobby-0 (max ~20 connections).
    // Each Fly machine creates its own pool; with 2 webui machines + 1 worker
    // machine that's 3 × max = aggregate cap. Set max=5 so the aggregate stays
    // under 20 with headroom for psql admin sessions.
    //
    // rejectUnauthorized:false is a migration-era shortcut for Crunchy's
    // self-signed CA chain. Tighten to verify-full + bundled CA in a follow-up
    // (requires shipping the Crunchy root CA cert with the build).
    _pool = new pg.Pool({
      connectionString: hasSslMode ? cleanUrl : dbUrl,
      ssl: hasSslMode ? { rejectUnauthorized: false } : undefined,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
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

    -- ─── Tamrack rebrand additions ───────────────────────────────
    -- Plan tier lives on users (per Tamrack charter), not on api_keys.
    -- One user → many keys → one quota. Charter values:
    --   "free"     — no paid plan, free static dashboards only
    --   "tamrack"  — $9/mo flat, 50k included units
    --   "founder"  — grandfathered Pulse customers (no metering disruption)
    ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_units_used INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_units_resets_at TIMESTAMPTZ;

    -- Early-access charter additions (2026-05-18).
    -- comp = hand-picked free comp (Cully grants this; bypasses Stripe).
    -- early_access = account was created via invite-redemption flow
    --   (informational; not used for any gating today).
    ALTER TABLE users ADD COLUMN IF NOT EXISTS comp BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS early_access BOOLEAN NOT NULL DEFAULT FALSE;

    -- Invite tokens issued by admins. token_hash is sha256 of the
    -- plaintext token (plaintext is shown ONCE at creation). Atomic
    -- conditional UPDATE on (redeemed_at IS NULL) prevents double-redeem.
    CREATE TABLE IF NOT EXISTS invites (
      id TEXT PRIMARY KEY,
      token_hash TEXT UNIQUE NOT NULL,
      created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      email_hint TEXT,
      redeemed_at TIMESTAMPTZ,
      redeemed_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_invites_created_by ON invites(created_by, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_invites_pending ON invites(expires_at) WHERE redeemed_at IS NULL;

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
      -- Default 'free' as of 2026-05-18. 'pro' was a phantom plan that never
      -- shipped (no Stripe product, no checkout flow, no Pulse Pro tier exists
      -- as a paying surface). Real plans assigned via Stripe webhook are
      -- 'edo' (sunset to new signups) or 'realtor' (sunset to new signups).
      plan TEXT DEFAULT 'free',
      trial_start TIMESTAMPTZ,
      trial_end TIMESTAMPTZ,
      current_period_start TIMESTAMPTZ,
      current_period_end TIMESTAMPTZ,
      cancel_at_period_end INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Idempotent migration: subscriptions.plan default flipped from 'pro' to
    -- 'free' 2026-05-18 (Pulse Pro dead-code cleanup). The column default
    -- only affects new INSERTs; for existing rows that fell into 'pro' under
    -- the old default, normalize to 'free'. Safe to run repeatedly.
    ALTER TABLE subscriptions ALTER COLUMN plan SET DEFAULT 'free';
    UPDATE subscriptions SET plan = 'free' WHERE plan = 'pro';

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

    -- Scope tags grant write access to specific surfaces. Read endpoints are
    -- open; write endpoints require the matching scope on the key.
    -- Examples: 'intel:profile:write', 'intel:research:write'.
    ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS scopes TEXT[] NOT NULL DEFAULT '{}';

    CREATE TABLE IF NOT EXISTS api_usage (
      id SERIAL PRIMARY KEY,
      api_key_id TEXT REFERENCES api_keys(id),
      user_id TEXT REFERENCES users(id),
      endpoint TEXT NOT NULL,
      timestamp TIMESTAMPTZ DEFAULT NOW(),
      response_status INTEGER
    );

    -- Tamrack metering columns. cost_units defaults to 1 (1 endpoint or 1
    -- MCP tool call = 1 unit per charter); Smart UI dashboard generation
    -- writes 25 when that surface ships. counted_toward_plan is FALSE when
    -- the request was inside the plan's included quota; TRUE when it
    -- overflowed and got billed via Stripe Meters.
    ALTER TABLE api_usage ADD COLUMN IF NOT EXISTS cost_units INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE api_usage ADD COLUMN IF NOT EXISTS counted_toward_plan BOOLEAN NOT NULL DEFAULT TRUE;

    CREATE INDEX IF NOT EXISTS idx_api_usage_key ON api_usage(api_key_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_api_usage_user ON api_usage(user_id, timestamp);
    -- EDO: municipality binding (slug from municipality-registry)
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS municipality_id TEXT;
    -- Realtor: operating area (JSON array of municipality slugs)
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS operating_area TEXT;

    -- Backfill: every existing user (anyone with an api_key, an active
    -- subscription, or otherwise pre-Tamrack) gets the founder plan so
    -- the rebrand doesn't blow up paying customers' quotas. New rows
    -- default to free via the column default above.
    -- NOTE: must run AFTER both api_keys and subscriptions are created.
    UPDATE users
       SET plan = 'founder'
     WHERE plan = 'free'
       AND id IN (
         SELECT DISTINCT user_id FROM api_keys
         UNION
         SELECT DISTINCT user_id FROM subscriptions WHERE status IN ('active','trialing','past_due')
       );

    CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe ON subscriptions(stripe_customer_id);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON subscriptions(plan);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_municipality ON subscriptions(municipality_id);
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

    -- ============================================================
    -- CRM tables
    -- ============================================================

    CREATE TABLE IF NOT EXISTS crm_contacts (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      organization TEXT DEFAULT '',
      role TEXT DEFAULT '',
      municipality TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'lead',
      source TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS crm_activities (
      id SERIAL PRIMARY KEY,
      contact_id INTEGER NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'note',
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_crm_contacts_status ON crm_contacts(status);
    CREATE INDEX IF NOT EXISTS idx_crm_contacts_municipality ON crm_contacts(municipality);
    CREATE INDEX IF NOT EXISTS idx_crm_activities_contact ON crm_activities(contact_id, created_at DESC);

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

    -- Named-entity directory: tri-region operators and (later) other entity sets.
    -- Seeded out-of-band by scripts/seed-intel-operators.ts from a private
    -- workspace source. Read via src/lib/data-sources-intel.ts.
    CREATE TABLE IF NOT EXISTS intel_operators (
      id                UUID PRIMARY KEY,
      source            TEXT NOT NULL,
      source_member_id  TEXT,
      source_url        TEXT,
      name              TEXT NOT NULL,
      description       TEXT,
      categories        TEXT[] NOT NULL DEFAULT '{}',
      street_address    TEXT,
      address_line2     TEXT,
      city              TEXT,
      postal_code       TEXT,
      country           TEXT,
      region            TEXT,
      phone             TEXT,
      fax               TEXT,
      email             TEXT,
      website           TEXT,
      hours             TEXT,
      social            JSONB,
      raw               JSONB,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (source, source_member_id)
    );
    CREATE INDEX IF NOT EXISTS idx_intel_operators_source ON intel_operators(source);
    CREATE INDEX IF NOT EXISTS idx_intel_operators_city ON intel_operators(city);
    CREATE INDEX IF NOT EXISTS idx_intel_operators_categories ON intel_operators USING GIN (categories);
    CREATE INDEX IF NOT EXISTS idx_intel_operators_name ON intel_operators(LOWER(name));

    -- detail_page_valid carries the upstream chamber's "detail page reachable"
    -- flag from the raw scrape; surfaced in the dashboard as a "stale-slug"
    -- badge. Populated by scripts/seed-intel-operators.ts.
    ALTER TABLE intel_operators ADD COLUMN IF NOT EXISTS detail_page_valid BOOLEAN;

    -- Per-operator research profiles. Append-only with current = TRUE flag;
    -- exactly one current row per operator at any moment (partial unique idx).
    -- Written by the research worker via PUT /api/intel/operators/:id/profile;
    -- read by the dashboard detail page and the MCP get_profile action.
    CREATE TABLE IF NOT EXISTS intel_operator_profiles (
      id                   UUID PRIMARY KEY,
      operator_id          UUID NOT NULL REFERENCES intel_operators(id) ON DELETE CASCADE,
      profile_schema       TEXT NOT NULL,
      researcher           TEXT NOT NULL,
      researched_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      current              BOOLEAN NOT NULL DEFAULT TRUE,
      raw_profile_md       TEXT NOT NULL,
      structured           JSONB NOT NULL DEFAULT '{}'::jsonb,
      sources              JSONB NOT NULL DEFAULT '[]'::jsonb,
      data_gaps            TEXT[] NOT NULL DEFAULT '{}',
      confidence           NUMERIC(4,3) NOT NULL,
      confidence_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
      cost_usd             NUMERIC(8,4),
      tokens_in            INT,
      tokens_out           INT,
      duration_ms          INT,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_profiles_operator_at
      ON intel_operator_profiles(operator_id, researched_at DESC);
    CREATE INDEX IF NOT EXISTS idx_profiles_researcher
      ON intel_operator_profiles(researcher, researched_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_profile_operator_current
      ON intel_operator_profiles(operator_id) WHERE current = TRUE;

    -- intelligence_researched_at tracks when the underlying WEB RESEARCH was
    -- last performed. For fresh-research rows this equals researched_at; for
    -- patched-from-v1 rows (src/patch-structured-fields.ts) it preserves the
    -- v1 ancestor's researched_at so freshness queries don't get fooled by
    -- the patch path's "now" row-write timestamp. Nullable to keep existing
    -- rows valid; backfilled separately. Adding a nullable column with no
    -- default is a metadata-only change (no table rewrite, no long lock),
    -- safe to apply while inserts are in flight.
    ALTER TABLE intel_operator_profiles
      ADD COLUMN IF NOT EXISTS intelligence_researched_at TIMESTAMPTZ NULL;
    CREATE INDEX IF NOT EXISTS idx_intel_profiles_intelligence_researched_at
      ON intel_operator_profiles (intelligence_researched_at DESC);

    -- Research control plane. The worker (tools/intel-research) claims pending
    -- rows with FOR UPDATE SKIP LOCKED, runs research, writes a profile, marks
    -- done. Priority bucket determines order; lower = higher priority.
    CREATE TABLE IF NOT EXISTS intel_research_queue (
      operator_id        UUID PRIMARY KEY REFERENCES intel_operators(id) ON DELETE CASCADE,
      priority           INT NOT NULL DEFAULT 100,
      status             TEXT NOT NULL DEFAULT 'pending',
      attempts           INT NOT NULL DEFAULT 0,
      last_error         TEXT,
      enqueued_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      started_at         TIMESTAMPTZ,
      completed_at       TIMESTAMPTZ,
      CONSTRAINT chk_research_status CHECK (status IN ('pending','running','done','failed'))
    );
    CREATE INDEX IF NOT EXISTS idx_research_queue_pending
      ON intel_research_queue(priority, enqueued_at) WHERE status = 'pending';
    CREATE INDEX IF NOT EXISTS idx_research_queue_status
      ON intel_research_queue(status);

    -- ============================================================
    -- Smart UI v1.1 persistence (2026-05-18)
    -- ============================================================

    -- A saved Smart UI dashboard. The slug is a short base62 id used in
    -- shareable /d/<slug> URLs. We store the planner output (plan + tool
    -- args) and the composer output (config) so a /d/<slug> render can
    -- re-execute the tool calls (replay-not-snapshot) and re-render the
    -- composed config. query_hash lets us dedupe identical questions.
    CREATE TABLE IF NOT EXISTS smart_dashboards (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      query TEXT NOT NULL,
      query_hash TEXT NOT NULL,
      title TEXT,
      plan JSONB NOT NULL,
      config JSONB NOT NULL,
      tool_args JSONB NOT NULL,
      cost_cents INTEGER NOT NULL DEFAULT 0,
      view_count INTEGER NOT NULL DEFAULT 0,
      parent_id TEXT REFERENCES smart_dashboards(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_viewed TIMESTAMPTZ
    );
    ALTER TABLE smart_dashboards ADD COLUMN IF NOT EXISTS title TEXT;
    CREATE INDEX IF NOT EXISTS idx_smart_dashboards_user
      ON smart_dashboards(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_smart_dashboards_query_hash
      ON smart_dashboards(query_hash);

    -- Telemetry. One row per Smart UI query, regardless of outcome. The
    -- query goes through planner → tool calls → composer; we record token
    -- usage on both LLM passes and the final monetary cost in cents.
    CREATE TABLE IF NOT EXISTS smart_query_events (
      id SERIAL PRIMARY KEY,
      dashboard_id TEXT REFERENCES smart_dashboards(id) ON DELETE SET NULL,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      query_text TEXT NOT NULL,
      query_hash TEXT NOT NULL,
      planner_input_tokens INTEGER DEFAULT 0,
      planner_output_tokens INTEGER DEFAULT 0,
      composer_input_tokens INTEGER DEFAULT 0,
      composer_output_tokens INTEGER DEFAULT 0,
      total_cost_cents INTEGER DEFAULT 0,
      outcome TEXT NOT NULL DEFAULT 'ok'
    );
    CREATE INDEX IF NOT EXISTS idx_smart_query_events_user
      ON smart_query_events(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_smart_query_events_dashboard
      ON smart_query_events(dashboard_id);

    -- ============================================================
    -- Access requests (charter: tamrack/handoffs/2026-05-19-access-request-resonate-charter.md §5)
    -- ============================================================
    -- One row per (lower-cased) email that ever requested access. The
    -- Resonate workflow attaches via id-hash idempotency; UNIQUE(email_lower)
    -- is the row-level idempotency anchor. invite_id / existing_user_id /
    -- decided_by FKs go to TEXT-PK tables (invites.id, users.id) — types
    -- agree. ON DELETE SET NULL so admin tooling that nukes an invite/user
    -- doesn't cascade-delete audit history.
    CREATE TABLE IF NOT EXISTS access_requests (
      id              TEXT PRIMARY KEY,
      email_lower     TEXT NOT NULL,
      name            TEXT NOT NULL,
      intent          TEXT,
      source_ip       TEXT,
      status          TEXT NOT NULL DEFAULT 'pending',
      invite_id       TEXT REFERENCES invites(id) ON DELETE SET NULL,
      existing_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      decided_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
      decided_at      TIMESTAMPTZ,
      resonate_workflow_id TEXT,
      admin_mail_message_id TEXT,
      invite_mail_message_id TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (email_lower)
    );
    CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_access_requests_pending ON access_requests(created_at) WHERE status = 'pending';
    CREATE INDEX IF NOT EXISTS idx_access_requests_source_ip ON access_requests(source_ip, created_at DESC);

    -- ============================================================
    -- substrate schema — unified data layer scaffolding
    -- ============================================================
    --
    -- Three orthogonal axes:
    --
    --   geo_dimension  — political / administrative geography:
    --                    province, municipality, neighbourhood. Rarely
    --                    changes; finite cardinality (~1K rows).
    --
    --   entities       — slow-changing dimensions located within a geo:
    --                    businesses, parcels, projects, wells, etc.
    --                    Higher cardinality (~440K parcels alone).
    --                    first_seen / last_seen track presence over time
    --                    without forcing presence into observations.
    --
    --   observations   — time-series facts: a value at a (series, period,
    --                    geo, [entity]) tuple. High-cardinality fact
    --                    table; partitioned by period.
    --
    -- Slug-naming convention (all schemas):
    --   geo:        ARD-derived (alberta, edmonton, edm-nbhd-2010)
    --   entities:   <source-abbrev>-<kind>-<natural-key>
    --                 (stony-plain-biz-<FID>, edm-parcel-<account_number>)
    --   series:     <scope>-<metric>  OR
    --               <geo>-<source>-<metric>  for derived/proxy series
    --                 (edm-parcel-assessed-value,
    --                  spruce-grove-licence-proxy-dev-permits)
    --   sources:    human-readable name (UNIQUE on name)
    --
    -- The application role on Crunchy can't CREATE EXTENSION, so
    -- anything that needs one (pgvector for corpus, pg_partman for
    -- partman.run_maintenance()) is deferred to an admin-run migration.
    CREATE SCHEMA IF NOT EXISTS substrate;

    CREATE TABLE IF NOT EXISTS substrate.sources (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name        TEXT NOT NULL UNIQUE,
      base_url    TEXT,
      auth_type   TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS substrate.geo_dimension (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slug          TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL,
      geo_type      TEXT NOT NULL,
      csduid        TEXT,
      parent_id     UUID REFERENCES substrate.geo_dimension(id),
      centroid_lat  NUMERIC(9, 6),
      centroid_lon  NUMERIC(9, 6),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_substrate_geo_parent
      ON substrate.geo_dimension(parent_id);
    CREATE INDEX IF NOT EXISTS idx_substrate_geo_type
      ON substrate.geo_dimension(geo_type);

    CREATE TABLE IF NOT EXISTS substrate.series_metadata (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slug                TEXT NOT NULL UNIQUE,
      domain              TEXT NOT NULL,
      name                TEXT NOT NULL,
      source_id           UUID REFERENCES substrate.sources(id),
      unit                TEXT,
      unit_type           TEXT,
      cadence             TEXT,
      geo_id              UUID REFERENCES substrate.geo_dimension(id),
      description         TEXT,
      tags                TEXT[],
      upstream_key        JSONB,
      is_derived          BOOLEAN NOT NULL DEFAULT FALSE,
      derivation_lineage  JSONB,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    -- is_derived + derivation_lineage are the typed signal the composer
    -- uses to credit proxy series differently from direct-fetch series.
    -- derivation_lineage shape (when is_derived=TRUE):
    --   { "kind": "proxy" | "rollup" | "join",
    --     "upstream": [{ "table": "...", "filter": {...} }, ...] }
    -- Backwards-compat for rows that predate the column: the default
    -- FALSE keeps non-derived series unaffected.
    CREATE INDEX IF NOT EXISTS idx_substrate_series_upstream_key
      ON substrate.series_metadata USING GIN (upstream_key);
    CREATE INDEX IF NOT EXISTS idx_substrate_series_tags
      ON substrate.series_metadata USING GIN (tags);
    CREATE INDEX IF NOT EXISTS idx_substrate_series_domain
      ON substrate.series_metadata(domain);
    CREATE INDEX IF NOT EXISTS idx_substrate_series_is_derived
      ON substrate.series_metadata(is_derived) WHERE is_derived = TRUE;
    -- Idempotent ALTER for any deploy where the table already exists
    -- without the new columns (covers a future where this DDL is
    -- relocated from boot-block to a versioned migration).
    ALTER TABLE substrate.series_metadata
      ADD COLUMN IF NOT EXISTS is_derived BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS derivation_lineage JSONB;

    -- Slow-changing dimension: entities are "things that live at a geo"
    -- (businesses, parcels, projects, wells). Distinct from geo_dimension,
    -- which is administrative geography. first_seen / last_seen capture
    -- presence over time without writing N obs/day into the fact table.
    --
    -- Diff queries:
    --   new openings:   WHERE first_seen = CURRENT_DATE AND kind = 'business'
    --   recent closures: WHERE last_seen < CURRENT_DATE - INTERVAL '1 day'
    --                      AND last_seen >= CURRENT_DATE - INTERVAL '7 days'
    -- Historical presence:
    --   "was X open on D?"  WHERE first_seen <= D AND last_seen >= D
    CREATE TABLE IF NOT EXISTS substrate.entities (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slug          TEXT NOT NULL UNIQUE,
      kind          TEXT NOT NULL,
      name          TEXT,
      geo_id        UUID REFERENCES substrate.geo_dimension(id),
      attrs         JSONB NOT NULL DEFAULT '{}'::jsonb,
      centroid_lat  NUMERIC(9, 6),
      centroid_lon  NUMERIC(9, 6),
      source_id     UUID REFERENCES substrate.sources(id),
      first_seen    DATE NOT NULL DEFAULT CURRENT_DATE,
      last_seen     DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_substrate_entities_kind
      ON substrate.entities(kind);
    CREATE INDEX IF NOT EXISTS idx_substrate_entities_geo
      ON substrate.entities(geo_id);
    CREATE INDEX IF NOT EXISTS idx_substrate_entities_last_seen
      ON substrate.entities(last_seen);
    CREATE INDEX IF NOT EXISTS idx_substrate_entities_attrs
      ON substrate.entities USING GIN (attrs);

    -- Time-series fact table. Native PG range partitioning on period
    -- (monthly children). entity_id is nullable: when set, the
    -- observation is keyed on a specific entity (e.g. a parcel's
    -- assessed_value); when NULL, the observation is at geo-level
    -- (e.g. Spruce Grove dev-permit count for a snapshot_date). The
    -- UNIQUE uses NULLS NOT DISTINCT (PG 15+) so two NULL entity_ids
    -- for the same (series, period, geo) are treated as a collision
    -- rather than two distinct rows.
    CREATE TABLE IF NOT EXISTS substrate.observations (
      series_id     UUID NOT NULL REFERENCES substrate.series_metadata(id),
      period        DATE NOT NULL,
      geo_id        UUID NOT NULL REFERENCES substrate.geo_dimension(id),
      entity_id     UUID REFERENCES substrate.entities(id),
      value         DOUBLE PRECISION,
      raw_value     TEXT,
      qualifier     TEXT,
      collected_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE NULLS NOT DISTINCT (series_id, period, geo_id, entity_id)
    ) PARTITION BY RANGE (period);
    -- Partitioned index — PG cascades it onto every child partition.
    CREATE INDEX IF NOT EXISTS idx_substrate_obs_series_geo_period
      ON substrate.observations (series_id, geo_id, period DESC);
    CREATE INDEX IF NOT EXISTS idx_substrate_obs_entity_period
      ON substrate.observations (entity_id, period DESC)
      WHERE entity_id IS NOT NULL;

    -- Pre-create monthly partitions: 12 back + current + 12 forward
    -- (25 children). Loop is idempotent (IF NOT EXISTS). A monthly
    -- Resonate cron will top up the leading edge — until then, fresh
    -- partitions get added by re-running the boot DDL after a deploy.
    DO $obs_part$
    DECLARE
      v_start DATE;
      v_end   DATE;
      v_name  TEXT;
      i       INT;
    BEGIN
      FOR i IN -12..12 LOOP
        v_start := (date_trunc('month', CURRENT_DATE)::date + make_interval(months => i))::date;
        v_end   := (v_start + INTERVAL '1 month')::date;
        v_name  := format('observations_%s', to_char(v_start, 'YYYY_MM'));
        EXECUTE format(
          'CREATE TABLE IF NOT EXISTS substrate.%I PARTITION OF substrate.observations
             FOR VALUES FROM (%L) TO (%L)',
          v_name, v_start, v_end
        );
      END LOOP;
    END $obs_part$;
    -- Default partition catches any out-of-range period (typo'd date,
    -- forgotten rollover). Without it the INSERT would error with
    -- "no partition of relation found for row" and the collector run aborts.
    CREATE TABLE IF NOT EXISTS substrate.observations_default
      PARTITION OF substrate.observations DEFAULT;

    -- Latest observation per (series, geo, entity). Collectors call
    -- REFRESH MATERIALIZED VIEW CONCURRENTLY at end-of-run so scorecards
    -- never block on a writer. The first refresh after creation MUST be
    -- non-concurrent (matview is unpopulated until then), so seed it here
    -- once if pg_class.relispopulated says it hasn't been refreshed yet.
    -- High-cardinality writers (e.g. the parcel fetcher, 440K rows) should
    -- NOT trigger a per-run refresh — pin that to a nightly cron instead;
    -- see substrate.refresh_latest_observations() below for the wrapped
    -- entry point that takes an advisory lock to serialize concurrent
    -- refresh attempts.
    CREATE MATERIALIZED VIEW IF NOT EXISTS substrate.latest_observations AS
      SELECT DISTINCT ON (series_id, geo_id, entity_id)
        series_id, geo_id, entity_id, period, value, collected_at
      FROM substrate.observations
      ORDER BY series_id, geo_id, entity_id, period DESC
    WITH NO DATA;
    -- UNIQUE INDEX needs NULLS NOT DISTINCT so geo-only observations
    -- (entity_id IS NULL) get a single matview row instead of one per NULL.
    CREATE UNIQUE INDEX IF NOT EXISTS idx_substrate_latest_obs_series_geo_entity
      ON substrate.latest_observations (series_id, geo_id, entity_id)
      NULLS NOT DISTINCT;
    DO $matview_seed$
    BEGIN
      IF NOT (
        SELECT relispopulated
        FROM pg_class
        WHERE relnamespace = 'substrate'::regnamespace
          AND relname = 'latest_observations'
      ) THEN
        REFRESH MATERIALIZED VIEW substrate.latest_observations;
      END IF;
    END $matview_seed$;

    -- Advisory-locked refresh entry point. Two concurrent collectors that
    -- both want to refresh end up queued in PG's matview lock chain (~2-5 min
    -- on a 440K-row matview); the advisory lock short-circuits the second
    -- caller cleanly with a warning. Callers handle the FALSE return by
    -- logging and continuing — the matview will be refreshed by whoever
    -- holds the lock.
    CREATE OR REPLACE FUNCTION substrate.refresh_latest_observations()
    RETURNS BOOLEAN LANGUAGE plpgsql AS $refresh$
    DECLARE
      v_got_lock BOOLEAN;
    BEGIN
      SELECT pg_try_advisory_lock(hashtext('substrate.latest_observations')::bigint)
        INTO v_got_lock;
      IF NOT v_got_lock THEN
        RAISE NOTICE 'substrate.latest_observations refresh skipped — already running';
        RETURN FALSE;
      END IF;
      BEGIN
        REFRESH MATERIALIZED VIEW CONCURRENTLY substrate.latest_observations;
        PERFORM pg_advisory_unlock(hashtext('substrate.latest_observations')::bigint);
        RETURN TRUE;
      EXCEPTION WHEN OTHERS THEN
        PERFORM pg_advisory_unlock(hashtext('substrate.latest_observations')::bigint);
        RAISE;
      END;
    END $refresh$;

    -- Major projects, versioned. Each stage change retires the prior row
    -- (is_current=FALSE, keeps last-seen snapshot_date) and inserts a new
    -- v_n+1 with today's snapshot_date. No-stage-change days only update
    -- snapshot_date on the current row, so 'when did this project last
    -- advance in stage' is answerable from version > 1 rows alone.
    CREATE TABLE IF NOT EXISTS substrate.major_projects_versioned (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_name     TEXT NOT NULL,
      developer        TEXT,
      municipality     TEXT,
      csduid           TEXT,
      estimated_cost   NUMERIC(14,2),
      stage            TEXT NOT NULL,
      stage_changed_at DATE,
      version          INTEGER NOT NULL DEFAULT 1,
      snapshot_date    DATE NOT NULL DEFAULT CURRENT_DATE,
      is_current       BOOLEAN NOT NULL DEFAULT TRUE,
      geo_id           UUID REFERENCES substrate.geo_dimension(id),
      UNIQUE (project_name, municipality, snapshot_date)
    );
    CREATE INDEX IF NOT EXISTS idx_substrate_mpv_muni_snapshot
      ON substrate.major_projects_versioned (municipality, snapshot_date DESC);
    CREATE INDEX IF NOT EXISTS idx_substrate_mpv_stage_current
      ON substrate.major_projects_versioned (stage, is_current) WHERE is_current = TRUE;
    -- Belt-and-suspenders: enforce at most one current row per (project, municipality).
    -- The procedure already serializes via SELECT … FOR UPDATE, but a partial unique
    -- index catches any out-of-band write (manual SQL, future bulk insert).
    CREATE UNIQUE INDEX IF NOT EXISTS idx_substrate_mpv_one_current
      ON substrate.major_projects_versioned (project_name, municipality)
      WHERE is_current = TRUE;

    CREATE OR REPLACE PROCEDURE substrate.upsert_major_project(
      p_project_name   TEXT,
      p_developer      TEXT,
      p_municipality   TEXT,
      p_csduid         TEXT,
      p_estimated_cost NUMERIC,
      p_stage          TEXT,
      p_snapshot_date  DATE
    ) LANGUAGE plpgsql AS $proc$
    DECLARE
      v_current_id      UUID;
      v_current_stage   TEXT;
      v_current_version INTEGER;
    BEGIN
      SELECT id, stage, version
        INTO v_current_id, v_current_stage, v_current_version
        FROM substrate.major_projects_versioned
        WHERE project_name = p_project_name
          AND municipality IS NOT DISTINCT FROM p_municipality
          AND is_current = TRUE
        FOR UPDATE;

      IF v_current_id IS NULL THEN
        -- ON CONFLICT closes the race where two concurrent callers both see
        -- v_current_id = NULL and both try to insert v1. SELECT FOR UPDATE
        -- only locks rows that exist; it doesn't prevent inserts of new rows.
        -- The partial unique index idx_substrate_mpv_one_current catches the
        -- collision; DO NOTHING absorbs it. The loser's params match the
        -- winner's (same upstream fetch), so no data is lost.
        INSERT INTO substrate.major_projects_versioned
          (project_name, developer, municipality, csduid, estimated_cost,
           stage, stage_changed_at, version, snapshot_date, is_current)
        VALUES
          (p_project_name, p_developer, p_municipality, p_csduid, p_estimated_cost,
           p_stage, p_snapshot_date, 1, p_snapshot_date, TRUE)
        ON CONFLICT (project_name, municipality) WHERE is_current = TRUE DO NOTHING;
      ELSIF v_current_stage IS DISTINCT FROM p_stage THEN
        UPDATE substrate.major_projects_versioned
          SET is_current = FALSE
          WHERE id = v_current_id;
        INSERT INTO substrate.major_projects_versioned
          (project_name, developer, municipality, csduid, estimated_cost,
           stage, stage_changed_at, version, snapshot_date, is_current)
        VALUES
          (p_project_name, p_developer, p_municipality, p_csduid, p_estimated_cost,
           p_stage, p_snapshot_date, v_current_version + 1, p_snapshot_date, TRUE);
      ELSE
        -- Same stage as last seen: refresh snapshot_date + non-stage fields
        -- (developer, cost, csduid may drift over time without a stage change).
        UPDATE substrate.major_projects_versioned
          SET snapshot_date   = p_snapshot_date,
              developer       = p_developer,
              csduid          = p_csduid,
              estimated_cost  = p_estimated_cost
          WHERE id = v_current_id;
      END IF;
    END;
    $proc$;

    -- ============================================================
    -- signals schema — derived analytic tables and classification caches.
    -- ============================================================
    CREATE SCHEMA IF NOT EXISTS signals;

    -- G4 dietary-taxonomy cache: one row per Edmonton business licence.
    -- Food-service rows are LLM-classified; all other categories carry
    -- dietary_category='unknown' (rule-tagged, no model call) so downstream
    -- signal queries can LEFT JOIN against the full licence universe.
    CREATE TABLE IF NOT EXISTS signals.licence_dietary_taxonomy (
      licence_id         TEXT PRIMARY KEY,
      trade_name         TEXT,
      raw_category       TEXT,
      dietary_category   TEXT NOT NULL,
      dietary_confidence NUMERIC(3, 2),
      classified_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_signals_ldt_category
      ON signals.licence_dietary_taxonomy(dietary_category);
    -- Enum guard. ADD CONSTRAINT isn't idempotent, so gate on pg_constraint.
    DO $cnstr$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'licence_dietary_taxonomy_category_check'
      ) THEN
        ALTER TABLE signals.licence_dietary_taxonomy
          ADD CONSTRAINT licence_dietary_taxonomy_category_check
          CHECK (dietary_category IN ('gf_friendly','allergen_friendly','standard','unknown'));
      END IF;
    END $cnstr$;
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
