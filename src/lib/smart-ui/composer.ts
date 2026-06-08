/**
 * Smart UI composer — Sonnet call #2.
 *
 * Takes the original query + planner output + MCP tool results and emits
 * a typed `DashboardConfig`. v1 generates `line`, `scorecard`, and (v1.2)
 * `table` cards; the composer is responsible for picking sensible titles,
 * captions, units, source citations, and (for table cards) which columns
 * and rows to surface from the tool envelope.
 *
 * The composer does NOT see the raw time-series points — the route
 * passes a compact summary (last_observation + length + first/last
 * dates) so token cost stays small. The actual points[] are passed
 * through unchanged to the renderer; the model only decides metadata.
 *
 * For list tools (tamrack_opportunities, tamrack_hiring), the composer
 * receives a compact row summary (first N rows, column names) and emits
 * a table card with the selected columns and pre-formatted cell values.
 * The renderer gets the full payload and re-builds the rows from it, so
 * the composer only needs to specify columns (not every cell value).
 */

import Anthropic from "@anthropic-ai/sdk";

import type {
  DashboardConfig,
  QueryPlan,
  ToolCallResult,
} from "./types";

const MODEL = "claude-sonnet-4-6";

const STORY_TEMPLATE_SLOT_RULES = `
STORY CARD RULES (applies only when plan.story_template is non-null):

When the plan includes a story_template, emit a card with "type": "story"
alongside (or instead of) the standard scorecard/line pair.

You MAY populate these fields on a story card:
  - title       (active-voice conclusion, not dimension labels)
  - data_ref    (key into the data payload; use the card_id as the ref)
  - body        (optional prose body; null is fine for chart-only stories)
  - generated_prose_spans  ([] if body is null)
  - human_review_approved  (always false — admin sets this via PATCH)

You MUST NOT populate these fields — the renderer assembles them:
  - spec        (always null in composer output; assembleStorySpec fills it)
  - template_slug / template_id (copied verbatim from plan; don't modify)

Trust block: populate trust.sources from envelope source labels (same
anti-fabrication rule as sources[]). Estimate trust.sample_n from
envelope point_count. Leave trust.derived_signals, trust.signal_period,
trust.normalization_note, trust.whole_definition at safe defaults:
  derived_signals: []
  signal_period: the envelope's last_date or today's date
  normalization_note: null
  whole_definition: null
  requires_human_review: false (true only on "comparison" template)
`.trim();

const TABLE_CARD_RULES = `
TABLE CARD RULES (applies when the planner chose tamrack_opportunities or tamrack_hiring):

Emit a card with "type": "table". Never emit a line or scorecard for these tools.

Required fields:
  - "columns": array of human-readable column header strings (3–6 columns recommended).
  - "rows": array of row objects. Each row: { "cells": ["v1","v2",...], "link_url"?: "..." }
    Cells must match columns by index.
  - "empty_message": set to a useful "no results" note if row_count is 0.
  - "data": { "tool": "<tool name>", "args": { ...from envelope } }

FOR tamrack_opportunities (tenders):
  Recommended columns: ["Title", "Buyer", "Closes", "Category", "Method"]
  - Title: tender title (truncate to ~60 chars if long).
  - Buyer: the buyer field.
  - Closes: closingDate (format as YYYY-MM-DD; use "open" if blank).
  - Category: category field.
  - Method: procurementMethod field.
  Set link_url on each row to the noticeUrl field.
  Populate rows from the summary's rows[] — use ALL rows provided in the summary.

FOR tamrack_hiring (signals):
  The summary contains byNoc[], bySector[], byCity[]. Choose the most relevant
  breakdown for the user's question:
  - "which roles" / "what roles"  → byNoc rows: columns ["NOC", "Role", "Postings", "Vacancies"]
  - "which sectors" / "industries" → bySector rows: columns ["Sector", "Postings"]
  - "which cities" / "where"       → byCity rows: columns ["City", "Postings"]
  - default (no specific breakdown asked) → byNoc rows.
  Also prepend a summary row using totalAlbertaPostings + tierBPostings when available.
  Momentum (month-over-month change) should appear in the card caption, not a separate row.

ANTI-FABRICATION applies to table cards too:
  - Never invent row values not present in the envelope summary.
  - If row_count is 0, emit an empty rows array and set empty_message.
`.trim();

const COMPOSER_SYSTEM = `
You are the Tamrack Smart UI composer.

You take a user question, a query plan, and a compact summary of MCP
tool results, and you emit a typed JSON DashboardConfig. The renderer
already has the raw data — your job is ONLY to pick titles, captions,
units, source citations, and the card layout.

CARD TYPES (v1.2):
- "scorecard": big-number + sparkline + YoY delta. Use for the latest
  value of an indicator.
- "line": time-series line chart.
- "table": row/column list. Use ONLY for tamrack_opportunities and
  tamrack_hiring. See TABLE CARD RULES below.
- "story": Vega-Lite story card with trust disclosure. Only emit when
  plan.story_template is non-null. See STORY CARD RULES below.

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

${TABLE_CARD_RULES}

${STORY_TEMPLATE_SLOT_RULES}

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
    },
    {
      "id": "<table card_id>",
      "type": "table",
      "title": "<short table title>",
      "caption": "<optional scope/filter note>",
      "columns": ["Col A", "Col B", "Col C"],
      "rows": [
        { "cells": ["val1", "val2", "val3"], "link_url": "https://..." }
      ],
      "empty_message": "no results found",
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

// List tools that return payload.rows / payload.summary rather than data.points.
const LIST_TOOLS = new Set(["tamrack_opportunities", "tamrack_hiring"]);

/**
 * Compact summary of a tool result for the composer. We strip the raw
 * points[] so the model isn't paying for 1,800 daily observations of
 * the policy rate; the renderer gets the full payload separately.
 *
 * For list tools (tamrack_opportunities, tamrack_hiring), we send the
 * first few rows and key summary fields instead — enough for the
 * composer to select columns and write a meaningful title/caption.
 */
export function summariseToolResult(r: ToolCallResult): Record<string, unknown> {
  if (r.status === "error") {
    return {
      card_id: r.card_id,
      tool: r.tool,
      args: r.args,
      status: "error",
      error: r.error,
    };
  }

  if (LIST_TOOLS.has(r.tool)) {
    return summariseListResult(r);
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

/**
 * Compact summary for list-shape tools (tamrack_opportunities, tamrack_hiring).
 * Sends enough for the composer to choose columns + write a caption, without
 * dumping the full row set.
 */
function summariseListResult(r: ToolCallResult): Record<string, unknown> {
  const env = r.data as
    | {
        source?: string;
        data?: {
          source?: string;
          unit?: string;
          served_from?: string;
          payload?: {
            // tamrack_opportunities
            rows?: unknown[];
            // tamrack_hiring
            summary?: {
              month?: string;
              totalAlbertaPostings?: number;
              tierBPostings?: number;
              byNoc?: unknown[];
              bySector?: unknown[];
              byCity?: unknown[];
              momentum?: { prevMonth?: string; deltaPct?: number } | null;
              sampleRows?: unknown[];
            } | null;
          };
        };
      }
    | null
    | undefined;

  const payload = env?.data?.payload;
  const base = {
    card_id: r.card_id,
    tool: r.tool,
    args: r.args,
    status: "ok",
    envelope: {
      source: env?.source,
      data: {
        source: env?.data?.source,
        unit: env?.data?.unit,
        served_from: env?.data?.served_from,
      },
    },
  };

  if (r.tool === "tamrack_opportunities") {
    const rows = Array.isArray(payload?.rows) ? payload.rows : [];
    // Send first 5 rows so the composer can see the field shapes.
    const sample = rows.slice(0, 5);
    return {
      ...base,
      list_summary: {
        row_count: rows.length,
        sample_rows: sample,
      },
    };
  }

  if (r.tool === "tamrack_hiring") {
    const s = payload?.summary ?? null;
    if (!s) {
      return {
        ...base,
        list_summary: { available: false },
      };
    }
    return {
      ...base,
      list_summary: {
        available: true,
        month: s.month,
        totalAlbertaPostings: s.totalAlbertaPostings,
        tierBPostings: s.tierBPostings,
        momentum: s.momentum,
        byNoc_count: Array.isArray(s.byNoc) ? s.byNoc.length : 0,
        byNoc_sample: Array.isArray(s.byNoc) ? s.byNoc.slice(0, 5) : [],
        bySector_count: Array.isArray(s.bySector) ? s.bySector.length : 0,
        bySector_sample: Array.isArray(s.bySector) ? s.bySector.slice(0, 5) : [],
        byCity_count: Array.isArray(s.byCity) ? s.byCity.length : 0,
        byCity_sample: Array.isArray(s.byCity) ? s.byCity.slice(0, 5) : [],
      },
    };
  }

  return base;
}

export async function composeDashboard(
  query: string,
  plan: QueryPlan,
  toolResults: ToolCallResult[],
  options: ComposerOptions = {},
): Promise<ComposerResult> {
  const apiKey =
    options.apiKey ?? process.env.ANTHROPIC_TAMRACK_API_TOKEN ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_TAMRACK_API_TOKEN is not set");
  }
  const client = new Anthropic({ apiKey });

  const summaries = toolResults.map(summariseToolResult);

  const userMessage = JSON.stringify(
    {
      query,
      plan: {
        intent: plan.intent,
        card_titles: plan.card_titles,
        // Passed through so the composer knows which story template to emit.
        story_template: plan.story_template ?? null,
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
