/**
 * Backfill Phase C truthfulness verdicts for dashboards saved before the gate
 * shipped (or any row still missing a verdict).
 *
 * Re-executes each dashboard's stored tool_args in-process (the same replay the
 * /d/<slug> page does) to reconstruct the tool results, then scores and stores
 * the verdict. Sequential with a 1s pause between rows to keep MCP concurrency
 * at 1 and stay well under the Haiku rate limit. Upstream failures are NOT
 * retried — an empty/fallback result is scored honestly.
 *
 * Scope is intentionally bounded: only unscored rows from the last 30 days,
 * most-viewed first, capped at 100. Re-run to walk further back if needed.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... ANTHROPIC_TAMRACK_API_TOKEN=sk-ant-... \
 *     npx tsx scripts/backfill-truthfulness.ts
 */
import { getDb } from "@/lib/db";
import { createInProcessMcpClient } from "@/lib/smart-ui/mcp-client";
import {
  saveTruthfulnessVerdict,
  scoreDashboardTruthfulness,
} from "@/lib/smart-ui/truthfulness";
import type {
  DashboardConfig,
  QueryPlan,
  ToolCallResult,
} from "@/lib/smart-ui/types";

const LIMIT = 100;
const WINDOW_DAYS = 30;

interface Row {
  id: string;
  query: string;
  plan: QueryPlan;
  config: DashboardConfig;
  tool_args: Array<{ card_id: string; tool: string; args: Record<string, unknown> }>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const pool = await getDb();
  const { rows } = await pool.query(
    `SELECT id, query, plan, config, tool_args
       FROM smart_dashboards
      WHERE truthfulness_checked_at IS NULL
        AND created_at > NOW() - INTERVAL '${WINDOW_DAYS} days'
      ORDER BY view_count DESC
      LIMIT ${LIMIT}`,
  );
  const dashboards = rows as Row[];
  console.log(`backfill: ${dashboards.length} unscored dashboard(s) to process`);

  let scored = 0;
  let failed = 0;
  for (const row of dashboards) {
    try {
      const mcp = await createInProcessMcpClient();
      const toolResults: ToolCallResult[] = [];
      try {
        for (const planned of row.tool_args ?? []) {
          const result = await mcp.callTool(planned.tool, {
            ...planned.args,
            __card_id: planned.card_id,
          });
          result.card_id = planned.card_id;
          toolResults.push(result);
        }
      } finally {
        await mcp.close();
      }

      const verdict = await scoreDashboardTruthfulness({
        query: row.query,
        plan: row.plan,
        config: row.config,
        toolResults,
        dashboardId: row.id,
      });
      await saveTruthfulnessVerdict(row.id, verdict);
      scored++;
      console.log(
        `  ${row.id}  score=${verdict.score.toFixed(3)} pass=${verdict.pass}  "${row.query.slice(0, 60)}"`,
      );
    } catch (err) {
      failed++;
      console.warn(
        `  ${row.id}  FAILED: ${err instanceof Error ? err.message : err}`,
      );
    }
    await sleep(1000);
  }

  console.log(`backfill done: ${scored} scored, ${failed} failed`);
  process.exit(0);
}

main().catch((err) => {
  console.error("backfill fatal:", err);
  process.exit(1);
});
