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
             cost_cents, parent_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
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
