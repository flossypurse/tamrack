/**
 * Tamrack Smart UI — typed dashboard config schema.
 *
 * The Smart UI uses LLM-to-config (Option A): Sonnet emits a typed JSON
 * dashboard spec that the React renderer consumes. No freeform JSX is
 * generated. v1 supports two cards (line + scorecard) and one layout
 * (single-column stack). Adding card types is additive: extend the `Card`
 * union here, add a renderer under `src/components/smart-ui/card-*.tsx`,
 * register it in `dashboard.tsx`'s card switch, and update the composer
 * prompt so the model knows about it.
 */

/** Plan emitted by the planner pass (Sonnet call #1). */
export interface QueryPlan {
  /** One-line restatement of what the user is asking for. */
  intent: string;
  /** Skeleton card titles — render before tool calls land. */
  card_titles: string[];
  /** MCP tools to invoke, in order, with arguments. */
  tools_to_call: PlannedToolCall[];
  /** 0–1 self-rated confidence; v1 just logs it. */
  confidence: number;
  /**
   * Story template selected by the planner's keyword decision tree.
   * null = narrative-only fallback (safe default; uncertainty favors null).
   *
   * Decision tree:
   *   "which X" / "top N" / "rank" / "best" / "recommend N" → "ranking"
   *   "where" / "which area" / "hotspot" / "cluster"         → "geo_distribution"
   *   "what share" / "breakdown" / "composition" / "%"       → "part_to_whole"
   *   anything else / uncertain                              → null
   */
  story_template: StoryTemplateSlug | null;
}

export interface PlannedToolCall {
  /** Stable id used to correlate the result back to a card. */
  card_id: string;
  /** MCP tool name (e.g. `tamrack_macro`). */
  tool: string;
  /** Tool arguments as the MCP schema expects them. */
  args: Record<string, unknown>;
}

/** Result of one MCP tool call — passed to the composer + streamed to UI. */
export interface ToolCallResult {
  card_id: string;
  tool: string;
  args: Record<string, unknown>;
  status: "ok" | "error";
  /** Parsed `structuredContent` from the MCP response when status=ok. */
  data?: unknown;
  /** Error string when status=error. */
  error?: string;
}

/** Final dashboard spec emitted by the composer pass (Sonnet call #2). */
export interface DashboardConfig {
  schema_version: "1";
  title: string;
  subtitle?: string;
  /** Restatement of the user's question. */
  intent: string;
  /** v1: stack only. */
  layout: "stack";
  cards: Card[];
  sources: SourceCitation[];
}

export type Card = LineCard | ScorecardCard | StoryCard | TableCard;

export interface LineCard {
  id: string;
  type: "line";
  title: string;
  caption?: string;
  /** y-axis unit label, e.g. "percent", "CAD per USD". */
  unit?: string;
  data: DataBinding;
}

export interface ScorecardCard {
  id: string;
  type: "scorecard";
  title: string;
  caption?: string;
  unit?: string;
  data: DataBinding;
  delta?: { yoy?: boolean };
}

/**
 * One row in a TableCard. Column values are always strings for render
 * simplicity; numeric values should be pre-formatted by the composer
 * (e.g. "2026-06-30", "147 postings").
 */
export interface TableRow {
  /** Ordered cell values matching `columns`. */
  cells: string[];
  /** Optional URL for the first-column link (e.g. a tender notice URL). */
  link_url?: string;
}

/**
 * Table card — a labelled column set plus an array of data rows.
 * Sourced from list-shape tool payloads (opportunities rows, hiring
 * breakdowns) rather than time-series points.
 *
 * The composer picks which columns to surface and which payload array
 * to use; the renderer handles truncation and mobile collapse.
 *
 * `empty_message` is shown when `rows` is empty — the composer should
 * set this to a meaningful "no results" note (e.g. "no open tenders
 * found for this filter").
 */
export interface TableCard {
  id: string;
  type: "table";
  title: string;
  caption?: string;
  /** Column header labels, matching `rows[].cells` by index. */
  columns: string[];
  rows: TableRow[];
  empty_message?: string;
  data: DataBinding;
}

/**
 * Story template slugs — closed list matching corpus.chart_templates.
 * The planner selects one via keyword matching; null triggers narrative-only fallback.
 */
export type StoryTemplateSlug =
  | "ranking"
  | "geo_distribution"
  | "part_to_whole"
  | "outlier_reveal"
  | "trend_reveal"
  | "comparison";

/**
 * Trust provenance block attached to every story card.
 * All elements are mandatory — none may be omitted in the renderer.
 */
export interface StoryTrust {
  /** Source dataset labels (verbatim from corpus.narrative_fragments.source_ids). */
  sources: string[];
  /** Number of observations underlying the chart or narrative claim. */
  sample_n: number;
  /** Human-readable labels for each derived signal that contributed. */
  derived_signals: string[];
  /** ISO date of the most recent observation window start. */
  signal_period: string;
  /** Non-null when the chart uses a per-capita or rate normalization. */
  normalization_note: string | null;
  /** Definition of the "whole" for part-to-whole templates; null otherwise. */
  whole_definition: string | null;
  /** True on Tier-3 comparison blocks — gates render on human_review_approved. */
  requires_human_review: boolean;
}

/**
 * Story card — a Vega-Lite chart assembled from a named template plus
 * trust-disclosure metadata. The `spec` field is assembled by
 * `assembleStorySpec`; the composer never writes to it directly.
 */
export interface StoryCard {
  id: string;
  type: "story";
  /** Canonical slug matching corpus.chart_templates. */
  template_slug: StoryTemplateSlug;
  /** UUID of the chart_templates row. */
  template_id: string;
  /** Active-voice title stating the conclusion, not the dimensions. */
  title: string;
  /** Named reference key into the dashboard's data payload. */
  data_ref: string;
  /** Narrative prose body; may be null for chart-only blocks. */
  body: string | null;
  /**
   * [start, end] character offsets within `body` that were LLM-generated.
   * Renderer italicises + dims these spans. Empty array if body is null.
   */
  generated_prose_spans: [number, number][];
  /**
   * Tier-3 comparison blocks start false; admin flips to true via PATCH.
   * All other templates: always false, renderer ignores this field.
   */
  human_review_approved: boolean;
  /** Assembled Vega-Lite spec — null when narrative-only fallback is active. */
  spec: Record<string, unknown> | null;
  trust: StoryTrust;
}

export interface DataBinding {
  /** MCP tool name that produced the data. */
  tool: string;
  /** Args the tool was called with — kept for provenance + future re-runs. */
  args: Record<string, unknown>;
}

export interface SourceCitation {
  /** Human-readable provenance, e.g. "Statistics Canada — Table 14-10-0287". */
  label: string;
  /** Optional deep link. */
  url?: string;
}

/**
 * SSE event payloads streamed from `/api/smart/query` to the page.
 * The endpoint emits these in order: plan → tool_result(×N) → dashboard → done.
 */
export type SmartQueryEvent =
  | { type: "plan"; intent: string; card_titles: string[] }
  | {
      type: "tool_result";
      card_id: string;
      status: "ok" | "error";
      data?: unknown;
      error?: string;
    }
  | { type: "dashboard"; dashboard: DashboardConfig; tool_results: ToolCallResult[] }
  // v1.1: emitted after the dashboard is persisted. Client can replace its
  // URL via history.replaceState to /d/<slug>.
  | { type: "saved"; slug: string; url: string }
  | { type: "error"; message: string }
  | { type: "done" };

/**
 * Series point shape we ask the composer to extract from tool envelopes.
 * Every MCP tool we call in v1 produces something convertible to this.
 */
export interface SeriesPoint {
  date: string;
  value: number;
}
