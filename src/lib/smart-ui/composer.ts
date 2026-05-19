/**
 * Smart UI composer — Sonnet call #2.
 *
 * Takes the original query + planner output + MCP tool results and emits
 * a typed `DashboardConfig`. v1 only generates `line` and `scorecard`
 * cards; the composer is responsible for picking sensible titles,
 * captions, units, and source citations from the tool envelope's
 * `source` + `data.source` fields.
 *
 * The composer does NOT see the raw time-series points — the route
 * passes a compact summary (last_observation + length + first/last
 * dates) so token cost stays small. The actual points[] are passed
 * through unchanged to the renderer; the model only decides metadata.
 */

import Anthropic from "@anthropic-ai/sdk";

import type {
  DashboardConfig,
  QueryPlan,
  ToolCallResult,
} from "./types";

const MODEL = "claude-sonnet-4-6";

const COMPOSER_SYSTEM = `
You are the Tamrack Smart UI composer.

You take a user question, a query plan, and a compact summary of MCP
tool results, and you emit a typed JSON DashboardConfig. The renderer
already has the raw data — your job is ONLY to pick titles, captions,
units, source citations, and the card layout.

CARD TYPES (v1):
- "scorecard": big-number + sparkline + YoY delta. Use for the latest
  value of an indicator.
- "line": time-series line chart.

LAYOUT: "stack" only.

RULES:
- Always emit valid JSON matching the DashboardConfig schema below.
- For each tool result, decide which cards it backs. A single tool call
  can back BOTH a scorecard (last observation) and a line (full series).
  Re-use the same data.tool + data.args in both cards' data binding.
- Title: short, declarative, no "Here is" / "Showing you".
- Caption: optional one-liner that adds context (e.g. cadence, scope).
- Unit: pass through the envelope's data.unit VERBATIM when present.
- If a tool result is status=error, emit a placeholder scorecard with
  title containing the error so the user sees what failed.

ANTI-FABRICATION (CRITICAL):
- Source labels MUST come verbatim from the tool_result envelope's
  \`envelope.source\` or \`envelope.data.source\` field. Use those strings
  EXACTLY as provided — do NOT add table IDs, dataset numbers,
  publication names, URLs, or parenthetical descriptions that the
  envelope did not supply.
- If neither \`envelope.source\` nor \`envelope.data.source\` is present,
  OMIT the sources array. Never invent a source.
- Never invent indicators, units, or pretty names that aren't in the
  envelope. Pass through the envelope's \`data.indicator\` for naming
  when no better human label is available.

PLACE DEFAULT (anti-drift discipline):
- Every card caption should reference an Alberta place when one is
  named in the user query, tool args, or envelope.
- If no specific place is named anywhere upstream, default the place
  reference in any caption that mentions location to "Stony Plain".
- Never substitute a generic placeholder ("Alberta", "the region")
  when a specific place was named — pass the specific place through.

OUTPUT FORMAT — single JSON object, no prose, no markdown fences. The
example below uses placeholder source labels; YOUR output must replace
those with the literal strings from the envelopes you receive.

{
  "schema_version": "1",
  "title": "<short declarative title>",
  "subtitle": "<optional one-liner>",
  "intent": "<echo plan.intent>",
  "layout": "stack",
  "cards": [
    {
      "id": "<tool-result.card_id or a slug>",
      "type": "scorecard",
      "title": "<short scorecard title>",
      "unit": "<envelope.data.unit verbatim, or omit>",
      "data": { "tool": "<tool name from envelope>",
                "args": { /* args from envelope */ } },
      "delta": { "yoy": true }
    },
    {
      "id": "<another card_id>",
      "type": "line",
      "title": "<short line title>",
      "caption": "<optional cadence/scope>",
      "unit": "<envelope.data.unit verbatim, or omit>",
      "data": { "tool": "<tool name>", "args": { /* args */ } }
    }
  ],
  "sources": [
    { "label": "<envelope.source VERBATIM>" }
  ]
}
`.trim();

export interface ComposerOptions {
  apiKey?: string;
  model?: string;
}

export interface ComposerUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface ComposerResult {
  dashboard: DashboardConfig;
  usage: ComposerUsage;
  raw: string;
}

/**
 * Compact summary of a tool result for the composer. We strip the raw
 * points[] so the model isn't paying for 1,800 daily observations of
 * the policy rate; the renderer gets the full payload separately.
 */
function summariseToolResult(r: ToolCallResult): Record<string, unknown> {
  if (r.status === "error") {
    return {
      card_id: r.card_id,
      tool: r.tool,
      args: r.args,
      status: "error",
      error: r.error,
    };
  }
  const env = r.data as
    | {
        schema_version?: string;
        tool?: string;
        source?: string;
        data?: {
          indicator?: string;
          source?: string;
          unit?: string;
          last_observation?: { date: string; value: number } | null;
          served_from?: string;
          points?: { date: string; value: number }[];
        };
      }
    | null
    | undefined;
  const points = env?.data?.points ?? [];
  return {
    card_id: r.card_id,
    tool: r.tool,
    args: r.args,
    status: "ok",
    envelope: {
      source: env?.source,
      data: {
        indicator: env?.data?.indicator,
        source: env?.data?.source,
        unit: env?.data?.unit,
        last_observation: env?.data?.last_observation,
        served_from: env?.data?.served_from,
        point_count: points.length,
        first_date: points[0]?.date,
        last_date: points[points.length - 1]?.date,
      },
    },
  };
}

export async function composeDashboard(
  query: string,
  plan: QueryPlan,
  toolResults: ToolCallResult[],
  options: ComposerOptions = {},
): Promise<ComposerResult> {
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  const client = new Anthropic({ apiKey });

  const summaries = toolResults.map(summariseToolResult);

  const userMessage = JSON.stringify(
    {
      query,
      plan: {
        intent: plan.intent,
        card_titles: plan.card_titles,
      },
      tool_results: summaries,
    },
    null,
    2,
  );

  const response = await client.messages.create({
    model: options.model ?? MODEL,
    max_tokens: 2048,
    system: [
      {
        type: "text",
        text: COMPOSER_SYSTEM,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = response.content.find(
    (c): c is Anthropic.TextBlock => c.type === "text",
  );
  if (!textBlock) {
    throw new Error("Composer: no text block in Sonnet response");
  }
  const raw = textBlock.text.trim();
  const dashboard = parseDashboard(raw);

  return {
    dashboard,
    usage: response.usage as unknown as ComposerUsage,
    raw,
  };
}

export function parseDashboard(raw: string): DashboardConfig {
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(
      `Composer: failed to parse JSON: ${
        err instanceof Error ? err.message : String(err)
      }\n---\n${raw}`,
    );
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Composer: parsed output is not an object");
  }
  const obj = parsed as Record<string, unknown>;
  if (obj.schema_version !== "1") {
    throw new Error(
      `Composer: schema_version expected "1", got ${String(obj.schema_version)}`,
    );
  }
  if (typeof obj.title !== "string") {
    throw new Error("Composer: missing title");
  }
  if (!Array.isArray(obj.cards)) {
    throw new Error("Composer: missing cards[]");
  }
  // We trust Sonnet on the rest of the shape for v1; zod-validation
  // belongs in v1.1 alongside the typed Anthropic tool_use migration.
  return parsed as DashboardConfig;
}
