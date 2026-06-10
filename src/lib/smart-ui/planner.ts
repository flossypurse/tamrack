/**
 * Smart UI planner — Sonnet call #1.
 *
 * Translates a natural-language question into a typed `QueryPlan`:
 * intent restatement, card_titles (for the skeleton render), and an
 * ordered list of MCP tool calls. We give the model the catalog inline
 * and ask for JSON-only output; the system prompt is cached with
 * `cache_control: { type: "ephemeral" }` so subsequent queries reuse it.
 *
 * v1.1: catalog widened from 2 tools to 7. `tamrack_regional`,
 * `tamrack_housing`, `tamrack_energy`, `tamrack_business`, and
 * `tamrack_municipality` join the original `tamrack_macro` + `tamrack_catalog`.
 * The composer + renderer already handle the line + scorecard envelope
 * shape across all these tools (they share a `data.points` time-series
 * shape for the time-series tools).
 *
 * v1.2: adds `tamrack_opportunities` (CanadaBuys tender rows) and
 * `tamrack_hiring` (Job Bank monthly hiring signals). Both return list
 * payloads rendered as `table` cards, not time-series.
 */

import Anthropic from "@anthropic-ai/sdk";

import type { QueryPlan, StoryTemplateSlug } from "./types";

const MODEL = "claude-sonnet-4-6";

/**
 * Inline tool catalog the planner sees. Hardcoded for v1.2 — v2 should
 * fetch this from tamrack_catalog at boot and cache it. Tools 1–7 use
 * line/scorecard card types (time-series); tools 8–9 use the table card
 * type (list payloads).
 */
const PLANNER_TOOL_CATALOG = `
Available MCP tools (v1.2):

TIME-SERIES TOOLS — plan "line" / "scorecard" cards for these:

1. tamrack_macro
   Description: Macro indicators for Canada / Alberta from Bank of Canada
     (policy rate, CAD/USD, 5y mortgage), Statistics Canada (Alberta
     unemployment, CPI, GDP, Edmonton housing starts), and Alberta open data
     (Alberta Activity Index).
   Input: { indicator: one of [policy_rate, cad_usd, mortgage_5y,
                                unemployment, cpi, gdp, housing_starts, aax],
            time_range?: "last_30d" | "last_year" | "last_5y" | "ytd"
                       | { from: "YYYY-MM-DD", to: "YYYY-MM-DD" } }
   Output: time-series envelope with data.points: [{date, value}].

2. tamrack_regional
   Description: Time-series for one of 54 regional indicators across ~340
     Alberta municipalities (population, labour force, dwelling starts,
     business counts, etc.) sourced from regionaldashboard.alberta.ca.
   Input: { municipality: <slug>, indicator: <name>,
            time_range?: same shape as tamrack_macro }
   Output: time-series envelope with data.points.

3. tamrack_housing
   Description: CMHC housing data for Edmonton + Calgary CMAs — starts,
     completions, under-construction, vacancy, rents, absorptions, plus the
     national 5y conventional mortgage rate.
   Input: { dataset: one of [starts, completions, under_construction,
                              vacancy, rents, absorptions, snapshot,
                              mortgage_rate],
            municipality?: "edmonton" | "calgary" }
   Note: the 'municipality' field selects which CMA's series the Smart UI
     surfaces. Always pass it for starts/completions/under_construction/
     vacancy/rents when the user mentions a city; default to "edmonton"
     otherwise. For 'snapshot' it picks the CMA returned. For absorptions
     / mortgage_rate the field has no effect (Alberta-wide / national).
   Output: time-series envelope with data.points (one card = one CMA).

4. tamrack_energy
   Description: AESO + CER data — Alberta pool price, supply/demand
     snapshot, load forecast, pipeline throughput, apportionment, pipeline
     incidents, oil production.
   Input: { dataset: one of [pool_price_current, pool_price_series,
                              supply_demand, system_marginal_price,
                              forecast, pipeline_throughput,
                              pipeline_incidents, apportionment,
                              oil_production],
            pipeline?: "NGTL"|"Trans-Mountain"|"Keystone"|
                       "Enbridge Mainline"|"Alliance"|"Foothills",
            province?: <name> }
   Note: 'pipeline' is REQUIRED-ish for pipeline_throughput (defaults NGTL).
     'province' only affects oil_production. supply_demand is a single
     snapshot (no time series — use it for a scorecard only).
   Output: time-series envelope with data.points (except supply_demand /
     pipeline_incidents).

5. tamrack_business
   Description: Business licences (Edmonton/Calgary), StatsCan business
     counts, retail subsectors, food services, GHG emitters.
   Input: { category: one of [edmonton_licences_by_neighbourhood,
                               edmonton_licences_by_type,
                               calgary_licences_by_community,
                               statscan_business_counts, retail_subsectors,
                               food_services, ghg_facilities,
                               top_emitters, ecommerce, business_dynamics,
                               non_profits_by_city, non_profits_by_type,
                               wcb_claims, edmonton_licences_by_status,
                               edmonton_licences_by_year, etc.] }
   Output: envelope; shape depends on category — most have data.points.

6. tamrack_municipality
   Description: Registry-backed summary card for one Alberta muni — name,
     region, population, capabilities, best-effort live metrics.
   Input: { municipality: <slug> }
   Output: envelope; no time-series, suitable for a scorecard or info card.

7. tamrack_catalog
   Description: Discovery — returns the full MCP inventory. Call only if
     you need to look something up; don't call it for direct data queries.
   Input: {} (no parameters)
   Output: discovery payload.

LIST/TABLE TOOLS — plan "table" cards for these (NOT line or scorecard):

8. tamrack_opportunities
   Description: Demand-side feed — CanadaBuys federal open tender notices
     filtered to IT/software/AI/data work an Alberta vendor can deliver,
     soonest-closing first. Each row: title, buyer, closingDate, gsin,
     category, procurementMethod, noticeUrl, matchedTerms.
     Value is completeness + deadline/recompete timing, not raw solo-work volume.
   Input: { dataset?: "tenders" (default),
            open_only?: boolean,
            closing_before?: "YYYY-MM-DD",
            limit?: number }
   Output: list envelope with data.payload.rows[]: tender row objects.
   Card type: ALWAYS plan a single "table" card. Do NOT plan line/scorecard.

9. tamrack_hiring
   Description: Latent-demand feed — Alberta hiring activity for manual-process
     and automatable back-office roles (dispatchers, admin assistants,
     bookkeepers, inventory/logistics clerks) from Canada Job Bank monthly open
     data. Returns one summary object per month: totalAlbertaPostings, tierBPostings,
     byNoc[], bySector[], byCity[], momentum, sampleRows[].
     Note: ESDC strips employer names — aggregate signal only, not per-company leads.
   Input: { dataset?: "signals" (default),
            month?: "YYYY-MM" (defaults to latest stored) }
   Output: list envelope with data.payload.summary: { month, totalAlbertaPostings,
     tierBPostings, byNoc[], bySector[], byCity[], momentum, sampleRows[] }.
   Card type: ALWAYS plan a single "table" card. Do NOT plan line/scorecard.
`.trim();

const STORY_TEMPLATE_DECISION_TREE = `
STORY TEMPLATE SELECTION — emit "story_template" in every plan:

Match the user's question against these patterns in order. First match wins.
When uncertain, emit null (narrative-only fallback is always safe).

  "which X" / "top N" / "rank" / "best" / "recommend N"   → "ranking"
  "where" / "which area" / "hotspot" / "cluster"           → "geo_distribution"
  "what share" / "breakdown" / "composition" / "%"         → "part_to_whole"
  anything else / uncertain / time-series dominant          → null

Rules:
- null is the safe default. Emit null rather than guess.
- Do NOT emit "geo_distribution" for time-series questions, even if a
  place is named. Spatial templates only fire on "where" / concentration.
- Do NOT emit "ranking" for time-series questions like "trend over time".
- "story_template" is independent of card type. You may emit "ranking" and
  still plan a "line" card; the composer decides how to render.
`.trim();

const PLANNER_SYSTEM = `
You are the Tamrack Smart UI planner.

Tamrack turns natural-language questions about Alberta's economy into custom
dashboards. Your job is to translate one question into a plan: which MCP
tools to call, which cards to render, and which story template (if any) fits.

${PLANNER_TOOL_CATALOG}

${STORY_TEMPLATE_DECISION_TREE}

Card types you can plan for (v1.2):
- "line": time-series line chart. Use for anything with a date axis.
- "scorecard": big-number + sparkline + YoY delta. Use for "what's the
  current value of X" or "where does X stand today" questions.
- "table": row/column list. Use ONLY for tamrack_opportunities and
  tamrack_hiring. Never plan a "table" card for time-series tools.

Layout: single-column stack only.

PLANNING RULES:
- Always plan a "scorecard" + "line" pair for a single indicator unless
  the user explicitly asks for only one of them.
- Re-use the same MCP call for both cards when they share an indicator —
  the composer extracts last_observation for the scorecard and points[]
  for the line. Reflect this by giving both cards the same card_id so
  one tool call serves both. (If the user asks for two distinct things,
  use two card_ids and two tool calls.)
- For tamrack_opportunities and tamrack_hiring, plan exactly one "table"
  card per tool call. These tools return list payloads, not time series.
  Do NOT pair them with line or scorecard cards.
- Map natural-language time windows to the named ranges:
    "last 5 years" / "past 5 years" / "5y"          → "last_5y"
    "last year" / "past year" / "12 months"         → "last_year"
    "last 30 days" / "last month"                   → "last_30d"
    "this year" / "ytd"                             → "ytd"
  If the user names an indicator without a time window, default to "last_5y"
  for the line and the same call's last_observation for the scorecard.
- Confidence: 0.0–1.0, self-rated. Below 0.4 = guess. Above 0.8 = "this
  exact pattern is in the prompt examples".

OUTPUT FORMAT — return a single JSON object, no prose, no markdown fences:

{
  "intent": "one-line restatement",
  "card_titles": ["Scorecard title", "Line chart title"],
  "tools_to_call": [
    { "card_id": "shared-id-when-both-cards-share-data",
      "tool": "tamrack_macro",
      "args": { "indicator": "unemployment", "time_range": "last_5y" } }
  ],
  "confidence": 0.85,
  "story_template": null
}

EXAMPLES:

User: "alberta unemployment last 5 years"
{
  "intent": "Alberta unemployment rate over the last 5 years.",
  "card_titles": ["Alberta unemployment (latest)",
                  "Alberta unemployment — 5-year trend"],
  "tools_to_call": [
    { "card_id": "unemployment",
      "tool": "tamrack_macro",
      "args": { "indicator": "unemployment", "time_range": "last_5y" } }
  ],
  "confidence": 0.9,
  "story_template": null
}

User: "where is the policy rate right now"
{
  "intent": "Current Bank of Canada policy rate with 1-year context.",
  "card_titles": ["BoC policy rate (latest)",
                  "BoC policy rate — last year"],
  "tools_to_call": [
    { "card_id": "policy-rate",
      "tool": "tamrack_macro",
      "args": { "indicator": "policy_rate", "time_range": "last_year" } }
  ],
  "confidence": 0.88,
  "story_template": null
}

User: "top 5 Edmonton neighbourhoods by new business licences"
{
  "intent": "Top 5 Edmonton neighbourhoods ranked by new business licence issuance.",
  "card_titles": ["Top Edmonton neighbourhoods — new licences"],
  "tools_to_call": [
    { "card_id": "neighbourhood-licences",
      "tool": "tamrack_business",
      "args": { "category": "edmonton_licences_by_neighbourhood" } }
  ],
  "confidence": 0.82,
  "story_template": "ranking"
}

User: "where are food service businesses concentrated in Edmonton"
{
  "intent": "Spatial concentration of food-service businesses across Edmonton.",
  "card_titles": ["Food service concentration — Edmonton"],
  "tools_to_call": [
    { "card_id": "food-concentration",
      "tool": "tamrack_business",
      "args": { "category": "food_services" } }
  ],
  "confidence": 0.78,
  "story_template": "geo_distribution"
}

User: "show me open IT tenders closing this month"
{
  "intent": "Federal IT/software tenders still open and closing this month.",
  "card_titles": ["Open IT tenders closing this month"],
  "tools_to_call": [
    { "card_id": "tenders-closing",
      "tool": "tamrack_opportunities",
      "args": { "dataset": "tenders", "open_only": true, "closing_before": "2026-06-30" } }
  ],
  "confidence": 0.88,
  "story_template": null
}

User: "what automatable back-office roles are Alberta firms hiring for"
{
  "intent": "Alberta hiring activity for automatable back-office roles (latest month).",
  "card_titles": ["Alberta back-office hiring signals"],
  "tools_to_call": [
    { "card_id": "hiring-signals",
      "tool": "tamrack_hiring",
      "args": { "dataset": "signals" } }
  ],
  "confidence": 0.87,
  "story_template": null
}

User: "federal procurement opportunities in Alberta"
{
  "intent": "Open federal procurement tenders relevant to Alberta vendors.",
  "card_titles": ["Federal procurement — open tenders"],
  "tools_to_call": [
    { "card_id": "procurement",
      "tool": "tamrack_opportunities",
      "args": { "dataset": "tenders", "open_only": true, "limit": 25 } }
  ],
  "confidence": 0.85,
  "story_template": null
}
`.trim();

export interface PlannerOptions {
  apiKey?: string;
  /** Override model — default Sonnet 4.6. */
  model?: string;
}

export interface PlannerUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface PlannerResult {
  plan: QueryPlan;
  usage: PlannerUsage;
  raw: string;
}

export async function planQuery(
  query: string,
  options: PlannerOptions = {},
): Promise<PlannerResult> {
  const apiKey =
    options.apiKey ?? process.env.ANTHROPIC_TAMRACK_API_TOKEN ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_TAMRACK_API_TOKEN is not set");
  }
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: options.model ?? MODEL,
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: PLANNER_SYSTEM,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: query }],
  });

  const textBlock = response.content.find(
    (c): c is Anthropic.TextBlock => c.type === "text",
  );
  if (!textBlock) {
    throw new Error("Planner: no text block in Sonnet response");
  }
  const raw = textBlock.text.trim();
  const plan = parsePlan(raw);

  const usage = response.usage as unknown as PlannerUsage;
  return { plan, usage, raw };
}

/**
 * Parse the planner's JSON output. Tolerates incidental markdown fences in
 * case the model decides to wrap output despite the prompt; v1.1 should
 * switch this to streaming + tool_use for stricter parsing.
 */
export function parsePlan(raw: string): QueryPlan {
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(
      `Planner: failed to parse JSON: ${
        err instanceof Error ? err.message : String(err)
      }\n---\n${raw}`,
    );
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Planner: parsed output is not an object");
  }
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.intent !== "string") {
    throw new Error("Planner: missing intent");
  }
  if (!Array.isArray(obj.card_titles)) {
    throw new Error("Planner: missing card_titles[]");
  }
  if (!Array.isArray(obj.tools_to_call)) {
    throw new Error("Planner: missing tools_to_call[]");
  }
  const VALID_SLUGS: StoryTemplateSlug[] = [
    "ranking",
    "geo_distribution",
    "part_to_whole",
    "outlier_reveal",
    "trend_reveal",
    "comparison",
  ];
  const storyTemplate =
    typeof obj.story_template === "string" &&
    VALID_SLUGS.includes(obj.story_template as StoryTemplateSlug)
      ? (obj.story_template as StoryTemplateSlug)
      : null;

  // Gate story cards until the full story render path and corpus data land.
  // The composer only emits story cards when plan.story_template is non-null,
  // so gating here is sufficient to keep the live chat clean.
  const storyTemplatesEnabled = process.env.STORY_TEMPLATES_ENABLED === "true";

  return {
    intent: obj.intent,
    card_titles: obj.card_titles as string[],
    tools_to_call: obj.tools_to_call as QueryPlan["tools_to_call"],
    confidence: typeof obj.confidence === "number" ? obj.confidence : 0.5,
    story_template: storyTemplatesEnabled ? storyTemplate : null,
  };
}
