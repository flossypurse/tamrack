/**
 * Smart UI streaming query endpoint.
 *
 * POST /api/smart/query
 *   body: { query: string }
 *   response: text/event-stream of SmartQueryEvent values
 *
 * Pipeline (v1.1):
 *   1. Plan (Sonnet)         → emit "plan" event (skeleton render)
 *   2. Call MCP tools        → emit "tool_result" per call
 *   3. Compose (Sonnet)      → emit "dashboard" event with full config + raw tool data
 *   4. Save dashboard        → emit "saved" event with slug + URL
 *   5. emit "done"
 *
 * Telemetry: console.log + persist row to smart_query_events on every
 * query (success or error).
 */

import { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { userHasTamrackAccess } from "@/lib/early-access";
import {
  composeDashboard,
  type ComposerUsage,
} from "@/lib/smart-ui/composer";
import { createInProcessMcpClient } from "@/lib/smart-ui/mcp-client";
import {
  logQueryEvent,
  saveDashboard,
  updateDashboardTitle,
} from "@/lib/smart-ui/persistence";
import { planQuery, type PlannerUsage } from "@/lib/smart-ui/planner";
import { generateTitle } from "@/lib/smart-ui/title";
import {
  scoreDashboardTruthfulness,
  saveTruthfulnessVerdict,
} from "@/lib/smart-ui/truthfulness";
import type { SmartQueryEvent, ToolCallResult } from "@/lib/smart-ui/types";

// Node runtime — needed for `pg`, `better-sqlite3`, and the MCP SDK's
// in-memory transport (uses Node streams under the hood).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Sonnet 4.6 pricing (USD per 1M tokens) — used for the console-log cost
// estimate. Adjust when Anthropic refreshes pricing.
const SONNET_INPUT_USD_PER_MTOK = 3.0;
const SONNET_OUTPUT_USD_PER_MTOK = 15.0;
const SONNET_CACHE_WRITE_USD_PER_MTOK = 3.75;
const SONNET_CACHE_READ_USD_PER_MTOK = 0.3;

interface UsageLike extends PlannerUsage, ComposerUsage {}

function usdCost(u: UsageLike | undefined): number {
  if (!u) return 0;
  const input = (u.input_tokens || 0) * SONNET_INPUT_USD_PER_MTOK;
  const output = (u.output_tokens || 0) * SONNET_OUTPUT_USD_PER_MTOK;
  const cacheW =
    (u.cache_creation_input_tokens || 0) * SONNET_CACHE_WRITE_USD_PER_MTOK;
  const cacheR =
    (u.cache_read_input_tokens || 0) * SONNET_CACHE_READ_USD_PER_MTOK;
  return (input + output + cacheW + cacheR) / 1_000_000;
}

function sseFrame(event: SmartQueryEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export async function POST(req: NextRequest): Promise<Response> {
  let body: { query?: string };
  try {
    body = (await req.json()) as { query?: string };
  } catch {
    return new Response(JSON.stringify({ error: "invalid JSON body" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query) {
    return new Response(JSON.stringify({ error: "query is required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const startedAt = Date.now();
  const encoder = new TextEncoder();
  // Resolve session up front so the streamed body doesn't carry a cookie
  // dependency. Tamrack gate: require auth + early_access/founder/tamrack
  // plan before burning any Sonnet tokens. Middleware lets this route
  // through without a subscription check (TAMRACK_SELF_GATED_PREFIXES),
  // so the authorization lives here.
  const session = await auth().catch(() => null);
  const sessionUserId = session?.user?.id ?? null;
  if (!sessionUserId) {
    return new Response(
      JSON.stringify({ error: "Authentication required" }),
      { status: 401, headers: { "content-type": "application/json" } },
    );
  }
  const access = await userHasTamrackAccess(sessionUserId);
  if (!access.authorized) {
    return new Response(
      JSON.stringify({ error: "Tamrack early access required" }),
      { status: 403, headers: { "content-type": "application/json" } },
    );
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function send(event: SmartQueryEvent): void {
        controller.enqueue(encoder.encode(sseFrame(event)));
      }

      let mcp: Awaited<ReturnType<typeof createInProcessMcpClient>> | null =
        null;
      let plannerUsage: PlannerUsage | undefined;
      let composerUsage: ComposerUsage | undefined;
      let dashboardId: string | null = null;
      let outcome: "ok" | "error" | "no_tool_results" = "ok";

      try {
        // ── 1. Plan ─────────────────────────────────────────────────────
        const planStartedAt = Date.now();
        const planResult = await planQuery(query);
        const plan = planResult.plan;
        plannerUsage = planResult.usage;
        const planMs = Date.now() - planStartedAt;
        send({
          type: "plan",
          intent: plan.intent,
          card_titles: plan.card_titles,
        });

        // ── 2. Tool calls (sequential — v1 keeps it simple) ─────────────
        mcp = await createInProcessMcpClient();
        const toolResults: ToolCallResult[] = [];
        const toolsStartedAt = Date.now();

        for (const planned of plan.tools_to_call) {
          const result = await mcp.callTool(planned.tool, {
            ...planned.args,
            __card_id: planned.card_id,
          });
          // Preserve the planner's card_id even if the client defaults it.
          result.card_id = planned.card_id;
          toolResults.push(result);
          send({
            type: "tool_result",
            card_id: result.card_id,
            status: result.status,
            data: result.status === "ok" ? result.data : undefined,
            error: result.status === "error" ? result.error : undefined,
          });
        }
        const toolsMs = Date.now() - toolsStartedAt;

        // ── 3. Compose ──────────────────────────────────────────────────
        const composeStartedAt = Date.now();
        const composeResult = await composeDashboard(
          query,
          plan,
          toolResults,
        );
        const dashboard = composeResult.dashboard;
        composerUsage = composeResult.usage;
        const composeMs = Date.now() - composeStartedAt;
        send({ type: "dashboard", dashboard, tool_results: toolResults });

        // ── 4. Persist (v1.1) ───────────────────────────────────────────
        const totalCostUsd =
          usdCost(plannerUsage as UsageLike) +
          usdCost(composerUsage as UsageLike);
        const totalCostCents = Math.round(totalCostUsd * 100);
        try {
          const saved = await saveDashboard({
            userId: sessionUserId,
            query,
            plan,
            config: dashboard,
            toolResults,
            costCents: totalCostCents,
          });
          dashboardId = saved.id;
          send({
            type: "saved",
            slug: saved.slug,
            url: saved.url,
          });
          // Fire-and-forget: one Haiku call to summarize the query into a
          // 4-6 word title for the history sidebar. Never blocks the
          // user's "done" event; failure leaves title NULL and the
          // sidebar falls back to truncated query text.
          const savedId = saved.id;
          void generateTitle(query)
            .then((title) => updateDashboardTitle(savedId, title))
            .catch((titleErr) => {
              console.warn(
                "smart_query_title_failed",
                titleErr instanceof Error ? titleErr.message : titleErr,
              );
            });
          // Fire-and-forget: score the dashboard's truthfulness (one Haiku
          // judge + deterministic checks) and store the verdict. Advisory in
          // the shared feed; never blocks the user's "done" event.
          void scoreDashboardTruthfulness({
            query,
            plan,
            config: dashboard,
            toolResults,
            dashboardId: savedId,
          })
            .then((verdict) =>
              // Distinct log key so a DB write failure is triagable apart from
              // a scoring failure (the row stays unscored and is re-queued by
              // the backfill either way).
              saveTruthfulnessVerdict(savedId, verdict).catch((saveErr) => {
                console.warn(
                  "smart_query_truthfulness_save_failed",
                  saveErr instanceof Error ? saveErr.message : saveErr,
                );
              }),
            )
            .catch((scoreErr) => {
              console.warn(
                "smart_query_truthfulness_failed",
                scoreErr instanceof Error ? scoreErr.message : scoreErr,
              );
            });
        } catch (persistErr) {
          // Persistence failure is non-fatal for the user — they still
          // see their dashboard, they just lose the shareable URL.
          console.warn(
            "smart_query_save_failed",
            persistErr instanceof Error ? persistErr.message : persistErr,
          );
        }

        // ── 5. Done ─────────────────────────────────────────────────────
        send({ type: "done" });

        const totalMs = Date.now() - startedAt;
        console.log(
          JSON.stringify({
            kind: "smart_query_event",
            query,
            intent: plan.intent,
            confidence: plan.confidence,
            tool_calls: plan.tools_to_call.length,
            plan_ms: planMs,
            tools_ms: toolsMs,
            compose_ms: composeMs,
            total_ms: totalMs,
            planner_usage: plannerUsage,
            composer_usage: composerUsage,
            total_cost_usd: totalCostUsd,
            cards: dashboard.cards.map((c) => ({ id: c.id, type: c.type })),
            dashboard_id: dashboardId,
          }),
        );
      } catch (err) {
        outcome = "error";
        const message = err instanceof Error ? err.message : String(err);
        console.error("smart_query_error", message);
        send({ type: "error", message });
      } finally {
        // Telemetry — write a smart_query_events row on every query
        // (success or error). Best-effort; failures are logged not thrown.
        try {
          const totalCostUsd =
            usdCost(plannerUsage as UsageLike) +
            usdCost(composerUsage as UsageLike);
          await logQueryEvent({
            dashboardId,
            userId: sessionUserId,
            queryText: query,
            plannerInputTokens: plannerUsage?.input_tokens ?? 0,
            plannerOutputTokens: plannerUsage?.output_tokens ?? 0,
            composerInputTokens: composerUsage?.input_tokens ?? 0,
            composerOutputTokens: composerUsage?.output_tokens ?? 0,
            totalCostCents: Math.round(totalCostUsd * 100),
            outcome,
          });
        } catch (logErr) {
          console.warn(
            "smart_query_event_log_failed",
            logErr instanceof Error ? logErr.message : logErr,
          );
        }
        if (mcp) {
          await mcp.close();
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
