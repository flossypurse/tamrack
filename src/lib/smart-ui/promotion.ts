/**
 * Dashboard -> corpus promotion (Phase B1).
 *
 * When an admin approves a nominated question, the representative dashboard is
 * captured into corpus.chart_templates as a GATED CANDIDATE
 * (requires_human_review = TRUE, template_available = FALSE). We capture a real,
 * truthfulness-validated example — we do not fabricate a polished reusable
 * template; a human authors the final Vega-Lite spec during review. This is the
 * "AI curates, doesn't generate" thesis: the corpus accrues vetted real queries,
 * gated until blessed.
 *
 * The promotion gate is hard (passesPromotionGate): a dashboard the LLM judge
 * deems off-target never enters the corpus even if its data hygiene is strong.
 * The gate is re-checked here from the stored verdict, defending against the
 * queue going stale between render and click.
 */
import { getDb } from "../db";
import { passesPromotionGate } from "./truthfulness";
import type { TruthfulnessVerdict } from "./truthfulness";
import type { DashboardConfig, QueryPlan } from "./types";

export class PromotionBlockedError extends Error {
  constructor(
    message: string,
    readonly reason:
      | "not_found"
      | "gate_failed"
      | "no_template_id" = "gate_failed",
  ) {
    super(message);
    this.name = "PromotionBlockedError";
  }
}

export interface PromotionResult {
  chartTemplateId: string;
  slug: string;
  seriesShape: string;
  /** True when the template row already existed (idempotent re-approve). */
  reused: boolean;
}

// series_shape values are a spec-locked enum (see corpus.chart_templates DDL).
// Derived honestly from the representative dashboard's actual cards: a single
// line card is a single_line shape, multiple are multi_line, otherwise the
// dashboard is scorecard-led. StoryCards carry their own template shape but are
// unreachable while STORY_TEMPLATES_ENABLED is off.
function deriveSeriesShape(config: DashboardConfig): string {
  const lineCount = (config.cards ?? []).filter(
    (c) => c.type === "line",
  ).length;
  if (lineCount >= 2) return "multi_line";
  if (lineCount === 1) return "single_line";
  return "scorecard";
}

interface RepRow {
  id: string;
  query: string;
  plan: QueryPlan;
  config: DashboardConfig;
  truthfulness_verdict: TruthfulnessVerdict | null;
}

export async function promoteDashboardToTemplate(
  repDashboardId: string,
  queryHash: string,
  adminId: string,
): Promise<PromotionResult> {
  const pool = await getDb();

  // `AND NOT private` is a hard backstop: the nomination read model already
  // excludes private dashboards, but the rep id arrives in the request body, so
  // never capture a private dashboard's query/config into the shared corpus even
  // if a crafted request supplies its id.
  const { rows } = await pool.query(
    `SELECT id, query, plan, config, truthfulness_verdict
       FROM smart_dashboards
      WHERE id = $1 AND NOT private`,
    [repDashboardId],
  );
  const rep = rows[0] as RepRow | undefined;
  if (!rep) {
    throw new PromotionBlockedError(
      "Representative dashboard no longer exists or is private",
      "not_found",
    );
  }

  // Re-check the hard gate at click time — the stored verdict is the source of
  // truth (it was computed at save against the in-process tool results).
  if (!passesPromotionGate(rep.truthfulness_verdict)) {
    throw new PromotionBlockedError(
      "Dashboard does not pass the promotion truthfulness gate",
      "gate_failed",
    );
  }

  const seriesShape = deriveSeriesShape(rep.config);
  // Namespaced away from the archetype slugs (e.g. 'ranking'); collision-free
  // because query_hash is unique per question.
  const slug = `q-${queryHash.slice(0, 12)}`;
  const spec = {
    captured_from: rep.id,
    query: rep.query,
    config: rep.config,
    plan_intent: rep.plan?.intent ?? null,
  };
  const tags = ["promoted-candidate", seriesShape];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const ins = await client.query(
      `INSERT INTO corpus.chart_templates
         (slug, series_shape, spec, tags, requires_human_review, template_available)
       VALUES ($1, $2, $3::jsonb, $4, TRUE, FALSE)
       ON CONFLICT (slug) DO NOTHING
       RETURNING id`,
      [slug, seriesShape, JSON.stringify(spec), tags],
    );

    let reused = false;
    let chartTemplateId: string | undefined = ins.rows[0]?.id;
    if (!chartTemplateId) {
      // Row already existed (idempotent re-approve) — fetch its id.
      const existing = await client.query(
        `SELECT id FROM corpus.chart_templates WHERE slug = $1`,
        [slug],
      );
      chartTemplateId = existing.rows[0]?.id;
      reused = true;
    }
    if (!chartTemplateId) {
      throw new PromotionBlockedError(
        "Failed to resolve chart template id after insert",
        "no_template_id",
      );
    }

    const ledger = await client.query(
      `INSERT INTO corpus.dashboard_promotions
         (query_hash, status, chart_template_id, source_dashboard_id, decided_by, decided_at)
       VALUES ($1, 'approved', $2, $3, $4, NOW())
       ON CONFLICT (query_hash) DO UPDATE SET
         status              = 'approved',
         chart_template_id   = EXCLUDED.chart_template_id,
         source_dashboard_id = EXCLUDED.source_dashboard_id,
         decided_by          = EXCLUDED.decided_by,
         decided_at          = NOW()
       WHERE corpus.dashboard_promotions.status <> 'dismissed'`,
      [queryHash, chartTemplateId, rep.id, adminId],
    );
    // A prior 'dismissed' decision is sticky: if the guarded UPDATE matched no
    // row, this question was dismissed (likely a stale queue render) — refuse
    // and let the transaction roll back the chart_templates insert too.
    if (ledger.rowCount === 0) {
      throw new PromotionBlockedError(
        "Question was already dismissed",
        "gate_failed",
      );
    }

    await client.query("COMMIT");
    return { chartTemplateId, slug, seriesShape, reused };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
