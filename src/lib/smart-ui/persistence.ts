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
