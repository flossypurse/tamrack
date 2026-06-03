/**
 * Smart UI persistence (v1.1).
 *
 * Saves the planner + composer output for every successful query, behind a
 * short base62 slug. /d/<slug> reads from `smart_dashboards`, replays the
 * tool calls (NOT a snapshot) and re-renders the composed config.
 *
 * Telemetry: every query (success or error) appends a row to
 * `smart_query_events` capturing planner + composer token usage and the
 * total monetary cost in cents.
 */
import { randomBytes, createHash, randomUUID } from "crypto";
import { getDb } from "../db";
import type {
  DashboardConfig,
  QueryPlan,
  ToolCallResult,
} from "./types";

const SLUG_ALPHABET =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

function generateSlug(): string {
  // 8 chars × 62^8 ≈ 2.18e14 — collision space far exceeds saved-dashboard
  // volume for the foreseeable future. UNIQUE constraint on `slug` catches
  // the (vanishingly rare) collision; caller retries.
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += SLUG_ALPHABET[bytes[i] % SLUG_ALPHABET.length];
  }
  return out;
}

export function hashQuery(query: string): string {
  return createHash("sha256")
    .update(query.trim().toLowerCase())
    .digest("hex")
    .slice(0, 32);
}

export interface SaveDashboardInput {
  userId: string | null;
  query: string;
  plan: QueryPlan;
  config: DashboardConfig;
  toolResults: ToolCallResult[];
  costCents: number;
  parentId?: string | null;
  // Visibility carve-out: default FALSE = shared into the query corpus. Set
  // TRUE to keep a genuinely sensitive question out of the shared feed and out
  // of promotion nomination (slug-by-link access is unaffected).
  private?: boolean;
}

export interface SavedDashboard {
  id: string;
  slug: string;
  url: string;
}

export async function saveDashboard(
  input: SaveDashboardInput,
): Promise<SavedDashboard> {
  const pool = await getDb();
  const id = randomUUID();
  const queryHash = hashQuery(input.query);

  // Tool args bundle — captured so /d/<slug> can replay the same tool
  // calls verbatim. We store the planner's tools_to_call shape rather
  // than the result envelopes (those are re-fetched).
  const toolArgs = input.toolResults.map((r) => ({
    card_id: r.card_id,
    tool: r.tool,
    args: r.args,
  }));

  // Slug collision retry: 3 attempts is plenty given 2.18e14 space.
  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = generateSlug();
    try {
      await pool.query(
        `INSERT INTO smart_dashboards
            (id, slug, user_id, query, query_hash, plan, config, tool_args,
             cost_cents, parent_id, private)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          id,
          slug,
          input.userId,
          input.query,
          queryHash,
          JSON.stringify(input.plan),
          JSON.stringify(input.config),
          JSON.stringify(toolArgs),
          input.costCents,
          input.parentId ?? null,
          input.private ?? false,
        ],
      );
      return { id, slug, url: `/d/${slug}` };
    } catch (err) {
      // Postgres unique_violation = 23505. Retry on collision; surface
      // anything else.
      if (
        attempt === 2 ||
        (err as { code?: string }).code !== "23505"
      ) {
        throw err;
      }
    }
  }
  throw new Error("saveDashboard: slug generation exhausted");
}

export interface LoadedDashboard {
  id: string;
  slug: string;
  query: string;
  plan: QueryPlan;
  config: DashboardConfig;
  toolArgs: Array<{ card_id: string; tool: string; args: Record<string, unknown> }>;
  created_at: string;
}

export async function loadDashboardBySlug(
  slug: string,
): Promise<LoadedDashboard | null> {
  const pool = await getDb();
  const { rows } = await pool.query(
    `SELECT id, slug, query, plan, config, tool_args, created_at
       FROM smart_dashboards
      WHERE slug = $1`,
    [slug],
  );
  const row = rows[0] as
    | {
        id: string;
        slug: string;
        query: string;
        plan: QueryPlan;
        config: DashboardConfig;
        tool_args: LoadedDashboard["toolArgs"];
        created_at: string;
      }
    | undefined;
  if (!row) return null;

  // Best-effort bump of view_count + last_viewed; don't fail the page if
  // the write fails.
  pool
    .query(
      `UPDATE smart_dashboards
          SET view_count = view_count + 1,
              last_viewed = NOW()
        WHERE id = $1`,
      [row.id],
    )
    .catch(() => {});

  return {
    id: row.id,
    slug: row.slug,
    query: row.query,
    plan: row.plan,
    config: row.config,
    toolArgs: row.tool_args,
    created_at: row.created_at,
  };
}

export async function updateDashboardTitle(
  id: string,
  title: string,
): Promise<void> {
  const pool = await getDb();
  await pool.query(
    `UPDATE smart_dashboards SET title = $1 WHERE id = $2`,
    [title, id],
  );
}

export interface DashboardListItem {
  id: string;
  slug: string;
  query: string;
  title: string | null;
  created_at: string;
}

export async function listDashboardsForUser(
  userId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<DashboardListItem[]> {
  const pool = await getDb();
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const { rows } = await pool.query(
    `SELECT id, slug, query, title, created_at
       FROM smart_dashboards
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3`,
    [userId, limit, offset],
  );
  return rows as DashboardListItem[];
}

export async function countDashboardsForUser(userId: string): Promise<number> {
  const pool = await getDb();
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM smart_dashboards WHERE user_id = $1`,
    [userId],
  );
  return (rows[0] as { n: number }).n;
}

export interface SharedQuestion {
  queryHash: string;
  query: string;
  title: string | null;
  slug: string;
  askers: number;
  views: number;
  lastAsked: string;
  // Phase C truthfulness verdict for the representative dashboard.
  // null = not yet scored (treated as neutral — no flag).
  truthScore: number | null;
  truthPass: boolean | null;
}

/**
 * "What Alberta is asking" — the de-silo read model. Aggregates non-private
 * dashboards by query_hash so the same question asked by N people collapses to
 * one row, ranked by how many distinct people asked it (then total views).
 *
 * Two CTEs because Postgres forbids COUNT(DISTINCT ...) as a window function:
 *   - `stats` does the GROUP BY aggregate (askers / views / last_asked). The
 *     HAVING drops questions whose askers are all NULL (user_id is ON DELETE SET
 *     NULL, so a deleted account leaves orphan rows) — "0 people asked" is not a
 *     meaningful feed entry.
 *   - `rep` picks ONE canonical dashboard per question to link to — most-viewed,
 *     tie-break most-recent (configs are LLM-composed and differ run-to-run, so
 *     we must point at a single representative, not all of them).
 * COUNT/SUM return bigint (returned as strings by node-postgres); we select them
 * raw and coerce with Number() in the map rather than ::int-casting in SQL, which
 * would throw "integer out of range" past 2^31. Read-time aggregation only; we
 * keep one row per ask (no ON CONFLICT dedupe) so per-user provenance survives.
 */
export async function listSharedQuestions(
  opts: { limit?: number } = {},
): Promise<SharedQuestion[]> {
  const pool = await getDb();
  const limit = Math.min(Math.max(opts.limit ?? 12, 1), 100);
  const { rows } = await pool.query(
    `WITH stats AS (
       SELECT query_hash,
              COUNT(DISTINCT user_id) AS askers,
              SUM(view_count)         AS views,
              MAX(created_at)         AS last_asked
         FROM smart_dashboards
        WHERE NOT private
        GROUP BY query_hash
        HAVING COUNT(DISTINCT user_id) >= 1
     ),
     rep AS (
       SELECT DISTINCT ON (query_hash)
              query_hash, query, title, slug,
              truthfulness_score, truthfulness_verdict
         FROM smart_dashboards
        WHERE NOT private
        ORDER BY query_hash, view_count DESC, created_at DESC
     )
     SELECT rep.query_hash, rep.query, rep.title, rep.slug,
            rep.truthfulness_score AS truth_score,
            (rep.truthfulness_verdict->>'pass')::boolean AS truth_pass,
            stats.askers     AS askers,
            stats.views      AS views,
            stats.last_asked AS last_asked
       FROM rep
       JOIN stats USING (query_hash)
      ORDER BY stats.askers DESC, stats.views DESC, stats.last_asked DESC
      LIMIT $1`,
    [limit],
  );
  return (rows as Array<{
    query_hash: string;
    query: string;
    title: string | null;
    slug: string;
    truth_score: string | null;
    truth_pass: boolean | null;
    askers: string;
    views: string;
    last_asked: string;
  }>).map((r) => ({
    queryHash: r.query_hash,
    query: r.query,
    title: r.title,
    slug: r.slug,
    askers: Number(r.askers),
    views: Number(r.views),
    lastAsked: r.last_asked,
    truthScore: r.truth_score === null ? null : Number(r.truth_score),
    truthPass: r.truth_pass,
  }));
}

// Minimum distinct askers for a question to be nominated for promotion. Kept
// low for invite-only scale, where most questions have a single asker; raise as
// usage grows so the queue surfaces genuinely repeated demand.
const NOMINATION_MIN_ASKERS = 1;

export interface PromotionNomination {
  queryHash: string;
  query: string;
  title: string | null;
  repSlug: string;
  repDashboardId: string;
  score: number | null;
  judgeReasons: string[];
  askers: number;
  views: number;
  lastAsked: string;
}

/**
 * Nomination read model for the curation queue (Phase B1). Same shared-corpus
 * aggregate as listSharedQuestions, narrowed to promotion candidates:
 *   - only questions that pass the HARD promotion gate (composite pass AND the
 *     judge affirms answers_question + right_series — mirrors passesPromotionGate
 *     in SQL so the queue only shows what the approve action will accept);
 *   - excluding questions already approved or dismissed (anti-join on the
 *     corpus.dashboard_promotions ledger);
 *   - with at least NOMINATION_MIN_ASKERS distinct askers.
 * The representative dashboard (most-viewed, tie-break most-recent) is what gets
 * captured on approval, so we return its id alongside its slug.
 */
export async function listPromotionNominations(
  opts: { limit?: number } = {},
): Promise<PromotionNomination[]> {
  const pool = await getDb();
  const limit = Math.min(Math.max(opts.limit ?? 25, 1), 100);
  const { rows } = await pool.query(
    `WITH stats AS (
       SELECT query_hash,
              COUNT(DISTINCT user_id) AS askers,
              SUM(view_count)         AS views,
              MAX(created_at)         AS last_asked
         FROM smart_dashboards
        WHERE NOT private
        GROUP BY query_hash
        HAVING COUNT(DISTINCT user_id) >= $2
     ),
     rep AS (
       SELECT DISTINCT ON (query_hash)
              query_hash, id, query, title, slug,
              truthfulness_score, truthfulness_verdict
         FROM smart_dashboards
        WHERE NOT private
        ORDER BY query_hash, view_count DESC, created_at DESC
     )
     SELECT rep.query_hash, rep.id AS rep_id, rep.query, rep.title, rep.slug,
            rep.truthfulness_score AS truth_score,
            rep.truthfulness_verdict->'judge'->'reasons' AS judge_reasons,
            stats.askers     AS askers,
            stats.views      AS views,
            stats.last_asked AS last_asked
       FROM rep
       JOIN stats USING (query_hash)
       LEFT JOIN corpus.dashboard_promotions p USING (query_hash)
      WHERE p.query_hash IS NULL
        AND (rep.truthfulness_verdict->>'pass')::boolean
        AND (rep.truthfulness_verdict->'judge'->>'answers_question')::boolean
        AND (rep.truthfulness_verdict->'judge'->>'right_series')::boolean
      ORDER BY stats.askers DESC, stats.views DESC, stats.last_asked DESC
      LIMIT $1`,
    [limit, NOMINATION_MIN_ASKERS],
  );
  return (rows as Array<{
    query_hash: string;
    rep_id: string;
    query: string;
    title: string | null;
    slug: string;
    truth_score: string | null;
    judge_reasons: string[] | null;
    askers: string;
    views: string;
    last_asked: string;
  }>).map((r) => ({
    queryHash: r.query_hash,
    query: r.query,
    title: r.title,
    repSlug: r.slug,
    repDashboardId: r.rep_id,
    score: r.truth_score === null ? null : Number(r.truth_score),
    judgeReasons: Array.isArray(r.judge_reasons) ? r.judge_reasons : [],
    askers: Number(r.askers),
    views: Number(r.views),
    lastAsked: r.last_asked,
  }));
}

export interface PromotionDecisionInput {
  status: "approved" | "dismissed";
  chartTemplateId?: string | null;
  sourceDashboardId?: string | null;
  decidedBy?: string | null;
  note?: string | null;
}

/**
 * Record (or update) a curation decision for a question cluster. Idempotent on
 * query_hash — re-deciding overwrites. Used by the dismiss path; the approve
 * path writes its ledger row inside the same transaction as the chart_templates
 * insert (see promoteDashboardToTemplate).
 */
export async function recordPromotionDecision(
  queryHash: string,
  input: PromotionDecisionInput,
): Promise<void> {
  const pool = await getDb();
  await pool.query(
    `INSERT INTO corpus.dashboard_promotions
       (query_hash, status, chart_template_id, source_dashboard_id, decided_by, note, decided_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (query_hash) DO UPDATE SET
       status              = EXCLUDED.status,
       chart_template_id   = EXCLUDED.chart_template_id,
       source_dashboard_id = EXCLUDED.source_dashboard_id,
       decided_by          = EXCLUDED.decided_by,
       note                = EXCLUDED.note,
       decided_at          = NOW()`,
    [
      queryHash,
      input.status,
      input.chartTemplateId ?? null,
      input.sourceDashboardId ?? null,
      input.decidedBy ?? null,
      input.note ?? null,
    ],
  );
}

export interface LogQueryEventInput {
  dashboardId: string | null;
  userId: string | null;
  queryText: string;
  plannerInputTokens: number;
  plannerOutputTokens: number;
  composerInputTokens: number;
  composerOutputTokens: number;
  totalCostCents: number;
  outcome: "ok" | "error" | "no_tool_results";
}

export async function logQueryEvent(input: LogQueryEventInput): Promise<void> {
  const pool = await getDb();
  await pool.query(
    `INSERT INTO smart_query_events
        (dashboard_id, user_id, query_text, query_hash,
         planner_input_tokens, planner_output_tokens,
         composer_input_tokens, composer_output_tokens,
         total_cost_cents, outcome)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      input.dashboardId,
      input.userId,
      input.queryText,
      hashQuery(input.queryText),
      input.plannerInputTokens,
      input.plannerOutputTokens,
      input.composerInputTokens,
      input.composerOutputTokens,
      input.totalCostCents,
      input.outcome,
    ],
  );
}
