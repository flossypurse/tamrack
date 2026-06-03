/**
 * Smart UI truthfulness gate (Phase C).
 *
 * Scores whether a saved dashboard faithfully answers the question that
 * produced it. Four checks, combined into a weighted verdict:
 *   1. sample_size — enough observations? (deterministic, time-series cards)
 *   2. recency     — fresh enough?        (deterministic, time-series cards)
 *   3. served_from — was the data live?   (deterministic; empty = vacuous)
 *   4. judge       — does the chart answer the question, with the right
 *                    series? (Haiku LLM-judge, forced tool_use)
 *
 * Invoked fire-and-forget at save time (see /api/smart/query/route.ts), when
 * query + plan + config + toolResults are all in-process — no re-fetch. The
 * verdict is stored on smart_dashboards and surfaced advisory in the shared
 * feed (failing reps get a flag; nothing is hidden).
 *
 * v1 grounding is self-contained: it judges the question against the series
 * the dashboard actually pulled. Corpus-chain grounding (series_id ->
 * signal evidence -> curated fragments) is deferred until Signals activation.
 *
 * Phase B (promotion) does not exist yet. When it does, this same function is
 * the hard gate:  const v = await scoreDashboardTruthfulness(input);
 *                 if (!v.pass) blockPromotion(v);
 */
import Anthropic from "@anthropic-ai/sdk";

import { getDb } from "../db";
import { summariseToolResult } from "./composer";
import type { DashboardConfig, QueryPlan, ToolCallResult } from "./types";

const JUDGE_MODEL = "claude-haiku-4-5-20251001";

// Tools whose results are time series (carry data.points). Municipality and
// catalog results have no series, so they're excluded from the sample-size and
// recency checks rather than failing them.
const TIME_SERIES_TOOLS = new Set([
  "tamrack_macro",
  "tamrack_regional",
  "tamrack_housing",
  "tamrack_energy",
  "tamrack_business",
]);

// Thresholds. Tunable; chosen for Tamrack's annual-cadence macro data.
const MIN_POINTS = 5; // full credit at >=5 observations
const MIN_POINTS_PASS = 2; // one point is not a series
const STALE_DAYS = 365; // macro indicators are commonly annual
const PASS_THRESHOLD = 0.5;

const WEIGHTS = { sample_size: 0.2, recency: 0.2, served_from: 0.3, judge: 0.3 };

export interface TruthfulnessCheck {
  name: string;
  score: number; // 0..1 for this sub-check
  pass: boolean;
  detail: Record<string, unknown>;
}

export interface TruthfulnessJudge {
  answers_question: boolean;
  right_series: boolean;
  score: number; // 0..1
  reasons: string[];
}

export interface TruthfulnessVerdict {
  score: number; // 0..1 weighted composite over active checks
  pass: boolean; // score >= PASS_THRESHOLD
  checks: TruthfulnessCheck[];
  judge: TruthfulnessJudge | null; // null if the LLM call failed
  scored_at: string; // ISO
  model: string; // judge model id, for auditability
}

export interface TruthfulnessInput {
  query: string;
  plan: QueryPlan;
  config: DashboardConfig;
  toolResults: ToolCallResult[];
  dashboardId?: string; // logging only
}

// Typed view of summariseToolResult()'s output.
interface ToolSummary {
  card_id?: string;
  tool?: string;
  args?: Record<string, unknown>;
  status?: string;
  error?: string;
  envelope?: {
    source?: string;
    data?: {
      indicator?: string;
      source?: string;
      unit?: string;
      last_observation?: { date: string; value: number } | null;
      served_from?: string;
      point_count?: number;
      first_date?: string;
      last_date?: string;
    };
  };
}

function isTimeSeriesCard(tool: string | undefined): boolean {
  return tool ? TIME_SERIES_TOOLS.has(tool) : false;
}

// ── Deterministic sub-checks ──────────────────────────────────────────────
// Each returns null when "not applicable" (no time-series cards), so it's
// dropped from the composite rather than scored as a failure.

function checkSampleSize(summaries: ToolSummary[]): TruthfulnessCheck | null {
  const counts = summaries
    .filter((s) => s.status === "ok" && isTimeSeriesCard(s.tool))
    .map((s) => s.envelope?.data?.point_count ?? 0);
  if (counts.length === 0) return null;
  const min = Math.min(...counts);
  const score = min >= MIN_POINTS ? 1 : min / MIN_POINTS;
  return {
    name: "sample_size",
    score,
    pass: min >= MIN_POINTS_PASS,
    detail: { min_points: min, time_series_cards: counts.length },
  };
}

function checkRecency(summaries: ToolSummary[]): TruthfulnessCheck | null {
  const dates = summaries
    .filter((s) => s.status === "ok" && isTimeSeriesCard(s.tool))
    .map((s) => s.envelope?.data?.last_date)
    .filter((d): d is string => typeof d === "string" && d.length > 0);
  if (dates.length === 0) return null;
  const newest = dates.reduce((a, b) => (a > b ? a : b));
  const ms = new Date(newest).getTime();
  // An unparseable date is n/a, not a failure — don't poison the score with NaN.
  if (Number.isNaN(ms)) return null;
  const days = (Date.now() - ms) / 86_400_000;
  const score = Math.max(0, 1 - days / STALE_DAYS);
  return {
    name: "recency",
    score,
    pass: days < STALE_DAYS,
    detail: { newest_last_date: newest, days_since: Math.round(days) },
  };
}

function checkServedFrom(summaries: ToolSummary[]): TruthfulnessCheck | null {
  // Time-series cards only — same exclusion as sample_size/recency. An errored
  // municipality/catalog lookup is normal data-absence, not a truthfulness
  // failure, so it must not drag a good time-series dashboard below the line.
  const series = summaries.filter((s) => isTimeSeriesCard(s.tool));
  if (series.length === 0) return null;
  // An errored time-series result means no data was fetched — treat as empty.
  const values = series.map((s) =>
    s.status === "error" ? "empty" : s.envelope?.data?.served_from ?? "unknown",
  );
  const anyEmpty = values.includes("empty");
  const anyFallback = values.includes("fallback");
  const score = anyEmpty ? 0 : anyFallback ? 0.5 : 1;
  return {
    name: "served_from",
    score,
    pass: !anyEmpty,
    detail: { served_from: values },
  };
}

// ── LLM judge ─────────────────────────────────────────────────────────────

const JUDGE_SYSTEM = `You are a strict data-quality judge for an Alberta data agent.

Given a user's question and the data series a dashboard actually pulled to answer it, decide:
- answers_question: does the assembled dashboard actually answer what was asked?
- right_series: are the chosen series/indicators the correct ones for the question (right metric, geography, and time framing)?
- score: 0..1 overall confidence that this is a faithful, sufficient answer.
- reasons: 1-3 short, concrete reasons (cite the mismatch or the match).

Be skeptical. If the series don't match the question's metric or geography, right_series is false. If the data is empty, stale, or off-topic, lower the score. Judge only what is shown — do not assume data you weren't given. You MUST call the truthfulness_judge tool.`;

const JUDGE_TOOL: Anthropic.Tool = {
  name: "truthfulness_judge",
  description:
    "Record the truthfulness verdict for a dashboard given its question and the series it pulled.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      answers_question: { type: "boolean" },
      right_series: { type: "boolean" },
      score: { type: "number", minimum: 0, maximum: 1 },
      reasons: { type: "array", items: { type: "string" } },
    },
    required: ["answers_question", "right_series", "score", "reasons"],
  },
};

interface JudgeOptions {
  apiKey?: string;
  model?: string;
}

async function callJudge(
  input: TruthfulnessInput,
  summaries: ToolSummary[],
  options: JudgeOptions = {},
): Promise<TruthfulnessJudge | null> {
  try {
    const apiKey =
      options.apiKey ??
      process.env.ANTHROPIC_TAMRACK_API_TOKEN ??
      process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;

    const cards = summaries.map((s) => ({
      tool: s.tool,
      args: s.args,
      status: s.status,
      source: s.envelope?.data?.source ?? s.envelope?.source,
      indicator: s.envelope?.data?.indicator,
      point_count: s.envelope?.data?.point_count,
      last_date: s.envelope?.data?.last_date,
      served_from: s.envelope?.data?.served_from,
    }));

    const payload = {
      query: input.query,
      intent: input.plan.intent,
      cards,
      sources: input.config.sources,
    };

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: options.model ?? JUDGE_MODEL,
      max_tokens: 512,
      // No cache_control: the system prompt is ~120 tokens, below the 1024-token
      // minimum cacheable block — the annotation would be a silent no-op.
      system: JUDGE_SYSTEM,
      tools: [JUDGE_TOOL],
      tool_choice: { type: "tool", name: "truthfulness_judge" },
      messages: [{ role: "user", content: JSON.stringify(payload) }],
    });

    const block = response.content.find(
      (c): c is Anthropic.ToolUseBlock => c.type === "tool_use",
    );
    if (!block || !block.input || typeof block.input !== "object") return null;
    const out = block.input as Partial<TruthfulnessJudge>;
    if (
      typeof out.answers_question !== "boolean" ||
      typeof out.right_series !== "boolean" ||
      typeof out.score !== "number"
    ) {
      return null;
    }
    return {
      answers_question: out.answers_question,
      right_series: out.right_series,
      score: Math.max(0, Math.min(1, out.score)),
      reasons: Array.isArray(out.reasons) ? out.reasons.slice(0, 3) : [],
    };
  } catch (err) {
    console.warn(
      "truthfulness_judge_failed",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

// ── Scorer ──────────────────────────────────────────────────────────────

export async function scoreDashboardTruthfulness(
  input: TruthfulnessInput,
  options: JudgeOptions = {},
): Promise<TruthfulnessVerdict> {
  const summaries = input.toolResults.map(
    (r) => summariseToolResult(r) as ToolSummary,
  );

  const checks: TruthfulnessCheck[] = [];
  const weighted: { score: number; weight: number }[] = [];

  const sample = checkSampleSize(summaries);
  if (sample) {
    checks.push(sample);
    weighted.push({ score: sample.score, weight: WEIGHTS.sample_size });
  }
  const recency = checkRecency(summaries);
  if (recency) {
    checks.push(recency);
    weighted.push({ score: recency.score, weight: WEIGHTS.recency });
  }
  const served = checkServedFrom(summaries);
  if (served) {
    checks.push(served);
    weighted.push({ score: served.score, weight: WEIGHTS.served_from });
  }

  const judge = await callJudge(input, summaries, options);
  // A judge outage scores neutral (0.5) and passes — never poison every
  // verdict because Haiku blipped.
  const judgeScore = judge ? judge.score : 0.5;
  const judgePass = judge
    ? judge.answers_question && judge.right_series && judge.score >= 0.5
    : true;
  checks.push({
    name: "judge",
    score: judgeScore,
    pass: judgePass,
    detail: judge
      ? { ...judge }
      : { unavailable: true, note: "LLM judge failed; scored neutral" },
  });
  weighted.push({ score: judgeScore, weight: WEIGHTS.judge });

  const totalWeight = weighted.reduce((a, w) => a + w.weight, 0);
  const composite =
    totalWeight > 0
      ? weighted.reduce((a, w) => a + w.score * w.weight, 0) / totalWeight
      : 0;
  const score = Math.round(composite * 1000) / 1000;

  return {
    score,
    pass: score >= PASS_THRESHOLD,
    checks,
    judge,
    scored_at: new Date().toISOString(),
    model: judge ? options.model ?? JUDGE_MODEL : "none",
  };
}

/**
 * Hard gate for the dashboard -> corpus promotion path (Phase B1).
 *
 * Stricter than the advisory feed flag (which only reads composite `pass`):
 * a dashboard becomes durable shared intelligence only if the composite passes
 * AND the LLM judge affirms it actually answers the question with the right
 * series. The composite alone weights deterministic data-hygiene checks
 * (served_from + sample_size + recency) at 0.7, so a clean-but-off-target
 * dashboard can pass the composite while the judge rejects it — that must not
 * enter the corpus.
 *
 * A judge OUTAGE (verdict.judge === null, scored neutral) is NOT promotable:
 * featuring is lenient on a Haiku blip, promotion is not.
 */
export function passesPromotionGate(v: TruthfulnessVerdict | null): boolean {
  if (!v || !v.pass) return false;
  const j = v.judge;
  return !!j && j.answers_question && j.right_series;
}

export async function saveTruthfulnessVerdict(
  dashboardId: string,
  verdict: TruthfulnessVerdict,
): Promise<void> {
  const pool = await getDb();
  await pool.query(
    `UPDATE smart_dashboards
        SET truthfulness_score = $1,
            truthfulness_verdict = $2,
            truthfulness_checked_at = NOW()
      WHERE id = $3`,
    [verdict.score, JSON.stringify(verdict), dashboardId],
  );
}
