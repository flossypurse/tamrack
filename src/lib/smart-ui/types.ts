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

export type Card = LineCard | ScorecardCard;

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
