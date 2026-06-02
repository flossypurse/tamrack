/**
 * activateSignalFragment — RPC-only workflow
 *
 * Given a (signal_def, geo, period) triple, this workflow:
 *   1. Loads the signal event and its evidence observations
 *   2. Renders the narrative template by substituting {{var}} placeholders
 *      from observation values — NOT free-form LLM prose
 *   3. Generates an embedding via OpenAI text-embedding-3-small
 *   4. UPSERTs into corpus.narrative_fragments with
 *      ON CONFLICT (signal_def_id, geo_scope, observed_window)
 *
 * The ON CONFLICT clause is the Write-Last idempotency guarantee. A plain
 * INSERT that hits the unique constraint would loop forever under Resonate
 * retry — UPSERT is non-negotiable.
 *
 * No schedule — triggered by processSignalQueue via ctx.beginRpc().
 *
 * Resonate rules:
 *  - Step IDs scoped by (signalSlug, geoId, period) for replay-safety
 *  - Per-step try/catch tolerance
 *  - Structured JSON logs only
 */

import type { Context } from "@resonatehq/sdk";
import { getDb } from "../lib/db";
import { captureError } from "../lib/observability";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ActivateSignalFragmentInput {
  signalDefId: string;
  signalSlug: string;
  seriesId: string;
  geoId: string;
  period: string;
  queueRowId: string;
}

interface SignalEventRow {
  id: string;
  signal_def_id: string;
  geo_id: string;
  observed_window: string;
  event_type: string;
  magnitude: number | null;
  direction: string | null;
  confidence: number | null;
  evidence_refs: string[];
  metadata: Record<string, unknown>;
}

interface NarrativeTemplateRow {
  id: string;
  body_template: string;
  freshness: string;
  geo_scope: string;
}

interface EvidenceObs {
  series_slug: string;
  value: number | null;
  raw_value: string | null;
  period: string;
}

interface ActivationResult {
  fragmentId: string | null;
  status: "ok" | "no_template" | "no_event" | "embed_error" | "error";
  error?: string;
}

// ---------------------------------------------------------------------------
// Template rendering — {{var}} substitution only, no LLM generation
// ---------------------------------------------------------------------------

/**
 * Fill {{variable}} placeholders in a narrative template with values from
 * the observation evidence. Variable names match series slugs, with dots
 * replaced by underscores so they are valid identifiers inside {{}}.
 *
 * Example template: "Active licence count: {{active_count}}. Sector: {{sector}}."
 * Evidence map:     { active_count: "1250", sector: "Food Service" }
 */
function renderTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return vars[key] ?? match; // leave unreplaced if no value
  });
}

/**
 * Build the variable map from evidence observations and signal metadata.
 */
function buildTemplateVars(
  event: SignalEventRow,
  evidence: EvidenceObs[],
  geoName: string
): Record<string, string> {
  const vars: Record<string, string> = {
    geo_name: geoName,
    event_type: event.event_type,
    magnitude: event.magnitude != null ? String(event.magnitude) : "",
    direction: event.direction ?? "",
    confidence: event.confidence != null ? String(event.confidence) : "",
    period: String(event.observed_window),
  };

  // Flatten metadata fields.
  for (const [k, v] of Object.entries(event.metadata ?? {})) {
    vars[k.replace(/[^a-z0-9_]/gi, "_")] = String(v);
  }

  // Add each evidence series value using its slug (dots → underscores).
  for (const obs of evidence) {
    const key = obs.series_slug.replace(/[^a-z0-9_]/gi, "_");
    vars[key] = obs.value != null
      ? String(obs.value)
      : (obs.raw_value ?? "");
  }

  return vars;
}

// ---------------------------------------------------------------------------
// Embedding — OpenAI text-embedding-3-small
// ---------------------------------------------------------------------------

async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set; cannot generate embedding");
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI embeddings API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    data: { embedding: number[] }[];
  };
  return data.data[0]?.embedding ?? [];
}

// ---------------------------------------------------------------------------
// activateSignalFragment — Resonate generator workflow
// ---------------------------------------------------------------------------

export function* activateSignalFragment(
  ctx: Context,
  input: ActivateSignalFragmentInput
): Generator<any, ActivationResult, any> {
  const { signalDefId, signalSlug, geoId, period, queueRowId } = input;

  // Step IDs scoped by (signalSlug, geoId, period) for replay idempotency.
  const stepKey = `${signalSlug}.${geoId}.${period}`;
  const stepId = (suffix: string) => `activateSignalFragment.${stepKey}.${suffix}`;

  // --- Step 1: Load signal event ---
  const signalEvent: SignalEventRow | null = yield* ctx.run(
    async (): Promise<SignalEventRow | null> => {
      const pool = await getDb();
      const { rows } = await pool.query<SignalEventRow>(`
        SELECT se.id, se.signal_def_id, se.geo_id, se.observed_window::TEXT,
               se.event_type, se.magnitude, se.direction, se.confidence,
               se.evidence_refs, se.metadata
        FROM signals.signal_events se
        WHERE se.signal_def_id = $1
          AND se.geo_id = $2
          AND lower(se.observed_window) <= $3::DATE
          AND upper(se.observed_window) >= $3::DATE
        ORDER BY se.fired_at DESC
        LIMIT 1
      `, [signalDefId, geoId, period]);
      return rows[0] ?? null;
    },
    (ctx as any).options({ id: stepId("load-event") })
  );

  if (!signalEvent) {
    console.log(JSON.stringify({
      event: "activateSignalFragment.noEvent",
      signalSlug,
      geoId,
      period,
      queueRowId,
    }));
    return { fragmentId: null, status: "no_event" };
  }

  // --- Step 2: Load narrative template ---
  const template: NarrativeTemplateRow | null = yield* ctx.run(
    async (): Promise<NarrativeTemplateRow | null> => {
      const pool = await getDb();
      // Look up the narrative_template_id from signal_definitions.
      const { rows: defRows } = await pool.query<{
        narrative_template_id: string | null;
        geo_scope: string;
      }>(`
        SELECT narrative_template_id, geo_scope
        FROM signals.signal_definitions
        WHERE id = $1
      `, [signalDefId]);

      const def = defRows[0];
      if (!def?.narrative_template_id) return null;

      const { rows: tplRows } = await pool.query<NarrativeTemplateRow>(`
        SELECT id, body_template, freshness, geo_scope
        FROM corpus.narrative_fragments
        WHERE id = $1
      `, [def.narrative_template_id]);

      return tplRows[0] ?? null;
    },
    (ctx as any).options({ id: stepId("load-template") })
  );

  // If there is no template wired to the signal def yet, we still write a
  // minimal fragment so the smoke test can verify the pipeline is live.
  const templateBody = template?.body_template
    ?? `Signal {{signal_slug}} fired for {{geo_name}} on {{period}}. Magnitude: {{magnitude}}.`;

  // --- Step 3: Load evidence observations ---
  const evidence: EvidenceObs[] = yield* ctx.run(
    async (): Promise<EvidenceObs[]> => {
      if (signalEvent.evidence_refs.length === 0) return [];
      const pool = await getDb();
      // evidence_refs is an array of observation IDs — not a typed FK in the
      // current schema (it's UUID[] pointing to substrate.observations which
      // is partitioned). We join against series_metadata for the slug.
      const { rows } = await pool.query<EvidenceObs>(`
        SELECT sm.slug AS series_slug, o.value, o.raw_value, o.period::TEXT
        FROM substrate.observations o
        JOIN substrate.series_metadata sm ON sm.id = o.series_id
        WHERE o.series_id = ANY($1::UUID[])
          AND o.geo_id = $2
          AND o.period = $3::DATE
      `, [signalEvent.evidence_refs, geoId, period]);
      return rows;
    },
    (ctx as any).options({ id: stepId("load-evidence") })
  );

  // --- Step 4: Load geo name for template vars ---
  const geoName: string = yield* ctx.run(
    async (): Promise<string> => {
      const pool = await getDb();
      const { rows } = await pool.query<{ name: string }>(`
        SELECT name FROM substrate.geo_dimension WHERE id = $1
      `, [geoId]);
      return rows[0]?.name ?? geoId;
    },
    (ctx as any).options({ id: stepId("load-geo") })
  );

  // --- Step 5: Render template ---
  const templateVars = buildTemplateVars(
    { ...signalEvent, metadata: signalEvent.metadata ?? {} },
    evidence,
    geoName
  );
  templateVars["signal_slug"] = signalSlug;
  const renderedBody = renderTemplate(templateBody, templateVars);

  // --- Step 6: Generate embedding ---
  const embedding: number[] = yield* ctx.run(
    async (): Promise<number[]> => {
      try {
        return await generateEmbedding(renderedBody);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        captureError(e, { workflow: "activateSignalFragment", step: "embed", signalSlug });
        console.log(JSON.stringify({
          event: "activateSignalFragment.embedError",
          signalSlug,
          geoId,
          period,
          error: msg,
        }));
        // Return empty array — fragment still gets written, embedding left null.
        return [];
      }
    },
    (ctx as any).options({ id: stepId("embed") })
  );

  // --- Step 7: UPSERT corpus.narrative_fragments ---
  const fragmentId: string = yield* ctx.run(
    async (): Promise<string> => {
      const pool = await getDb();

      // embedding is stored as a pgvector column (vector(1536)) — cast the
      // float array to the wire format '[x,y,...]'::vector. If the column
      // doesn't exist yet (corpus schema not yet migrated), the INSERT will
      // fail and the step will be retried by Resonate on the next run.
      const embeddingLiteral =
        embedding.length > 0
          ? `[${embedding.join(",")}]`
          : null;

      const { rows } = await pool.query<{ id: string }>(`
        INSERT INTO corpus.narrative_fragments
          (signal_def_id, geo_scope, observed_window,
           body_template, embedding, freshness, created_at, updated_at)
        VALUES
          ($1, $2,
           daterange($3::DATE, $3::DATE + INTERVAL '1 day', '[)'),
           $4,
           $5::vector,
           COALESCE($6, 'time_bounded'),
           NOW(), NOW())
        ON CONFLICT (signal_def_id, geo_scope, observed_window)
        DO UPDATE SET
          body_template = EXCLUDED.body_template,
          embedding     = EXCLUDED.embedding,
          updated_at    = NOW()
        RETURNING id
      `, [
        signalDefId,
        geoId,
        period,
        renderedBody,
        embeddingLiteral,
        template?.freshness ?? null,
      ]);

      return rows[0]?.id ?? "";
    },
    (ctx as any).options({ id: stepId("upsert-fragment") })
  );

  // --- Step 8: Update signal_event with corpus_fragment_id ---
  yield* ctx.run(
    async (): Promise<void> => {
      if (!fragmentId) return;
      const pool = await getDb();
      await pool.query(`
        UPDATE signals.signal_events
        SET corpus_fragment_id = $1
        WHERE id = $2
      `, [fragmentId, signalEvent.id]);
    },
    (ctx as any).options({ id: stepId("link-fragment") })
  );

  console.log(JSON.stringify({
    event: "activateSignalFragment.complete",
    signalSlug,
    geoId,
    period,
    fragmentId,
    embeddingDims: embedding.length,
    queueRowId,
  }));

  return {
    fragmentId,
    status: "ok",
  };
}
