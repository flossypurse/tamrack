/**
 * researchOperator — durable per-operator research workflow
 *
 * Turns a queued operator into a researched, schema-shaped profile by:
 *   1. load    — fetch the operator record from intel_operators
 *   2. research — gather facts (web search via Anthropic + optional Google Places)
 *   3. compose  — structure raw facts into the v1 ProfileWriteInput
 *   4. write    — persist via writeProfile (also marks the queue row done)
 *
 * Cost guard:
 *   mode='dry-run' (default when ANTHROPIC env var is absent) — skips
 *   all paid API calls and uses deterministic stubs so the full plumbing
 *   can be exercised free. The verify script and CI use this path.
 *
 *   mode='live' — makes real Anthropic messages.create calls (web_search
 *   server tool on call #1, structured-text response on call #2) and an
 *   optional Google Places geocode/text-search. NEVER call live mode
 *   during tests or without explicit operator sign-off.
 *
 * Resonate rules (mirrors process-signal-queue.ts):
 *   - Generator function — yield* ctx.run() / yield* ctx.beginRpc()
 *   - ctx.beginRpc() MUST be called from the generator, never inside ctx.run()
 *   - Step IDs scoped by (operatorId, attempt bucket) for replay-safety
 *   - UPSERT / append-only writes — writeProfile is already idempotent per-operator
 *   - Per-step try/catch, structured JSON logs
 */

import type { Context } from "@resonatehq/sdk";
import Anthropic from "@anthropic-ai/sdk";
import { getIntelOperator, type IntelOperator } from "../lib/data-sources-intel";
import {
  writeProfile,
  type ProfileWriteInput,
} from "../lib/data-sources-intel-profiles";
import { markQueueFailed } from "../lib/data-sources-intel-queue";
import { geocodeMunicipality, searchPlaces, type PlaceSummary } from "../lib/data-sources-google";
import { getOperatorSignals, type OperatorSignals } from "../lib/entity-resolution";
import { captureError } from "../lib/observability";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ResearchMode = "dry-run" | "live";

export interface ResearchOperatorInput {
  operatorId: string;
  mode?: ResearchMode;
  /**
   * Queue attempt number for this operator (from claimQueueBatch). Folded into
   * the ctx.run step IDs so a re-queued/retried operator does NOT replay the
   * previous attempt's cached step results (which would silently re-write the
   * stale profile instead of doing fresh research). Defaults to 1.
   */
  attempt?: number;
}

/**
 * Coerce a model-supplied confidence into a finite number in [0,1].
 * The model may return a string ("0.75"), a number out of range, or nothing;
 * writeProfile throws on anything not finite-in-[0,1], which would fail the
 * queue row permanently. Defaults to 0.5 when unparseable.
 */
function clampConfidence(raw: unknown): number {
  const n = typeof raw === "number" ? raw : parseFloat(String(raw ?? ""));
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

export interface ResearchResult {
  rawMd: string;
  sources: Array<{ url: string; accessed_at?: string; kind?: string }>;
  placesData: PlaceSummary | null;
  /** ISO 8601 string when research was performed */
  researchedAt: string;
  /** Present in live mode */
  usage?: {
    tokens_in: number;
    tokens_out: number;
    cost_usd: number;
    duration_ms: number;
  };
}

/** v1 structured shape (the agreed schema). Unknown fields are omitted and
 *  listed in data_gaps rather than fabricated. */
export interface V1Structured {
  identity: {
    canonical_name: string;
    also_known_as: string[];
    website: string | null;
    socials: {
      linkedin?: string;
      facebook?: string;
      instagram?: string;
      x?: string;
      youtube?: string;
    };
    year_established: number | null;
  };
  location: {
    street_address: string | null;
    city: string | null;
    region: "AB";
    postal_code: string | null;
    is_headquarters: boolean | null;
    other_locations_count: number | null;
  };
  classification: {
    sector: string;
    naics: string[];
    services: string[];
    b2b_or_b2c: "b2b" | "b2c" | "both" | null;
  };
  scale: {
    employee_band:
      | "1-4"
      | "5-9"
      | "10-19"
      | "20-49"
      | "50-99"
      | "100-249"
      | "250+"
      | null;
    revenue_band: string | null;
    ownership: "independent" | "franchise" | "subsidiary" | "public" | null;
  };
  contacts: Array<{
    name: string;
    role: string;
    email: string | null;
    phone: string | null;
    source_idx: number;
  }>;
  signals: {
    hiring: string | null;
    permits: string | null;
    procurement: string | null;
    growth_notes: string | null;
  };
  summary: string;
}

export interface OperatorResearchResult {
  operatorId: string;
  status: "ok" | "no_operator" | "research_error" | "compose_error" | "write_error";
  profileId?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Anthropic client factory — matches composer.ts pattern exactly
// ---------------------------------------------------------------------------

const MODEL = "claude-sonnet-4-6";

function getAnthropicClient(): Anthropic {
  const apiKey =
    process.env.ANTHROPIC_TAMRACK_API_TOKEN ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_TAMRACK_API_TOKEN (or ANTHROPIC_API_KEY) is not set"
    );
  }
  return new Anthropic({ apiKey });
}

// ---------------------------------------------------------------------------
// Step helpers — pure async functions the generator calls via ctx.run.
// These are also called directly by the verify harness (no Resonate context).
// ---------------------------------------------------------------------------

/**
 * Step 1 — load operator record.
 * Returns null if the operator does not exist (caller should mark fail + return).
 */
export async function loadOperator(
  operatorId: string
): Promise<IntelOperator | null> {
  return getIntelOperator(operatorId);
}

/**
 * Optional Google Places enrichment — returns the best-matching PlaceSummary
 * or null if GOOGLE_MAPS_API_KEY is unset or the search returns no results.
 * Always safe to call; all error paths return null (non-fatal).
 */
async function fetchPlacesData(
  operator: IntelOperator
): Promise<PlaceSummary | null> {
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    return null;
  }
  try {
    const city = operator.city ?? "";
    const geo = city ? await geocodeMunicipality(city) : null;
    const query = `${operator.name} ${city}`.trim();
    const results = await searchPlaces(
      query,
      geo?.lat,
      geo?.lng,
      10000
    );
    // Pick the top result; require the name to be a reasonable match.
    const top = results[0] ?? null;
    if (!top) return null;
    const nameLower = operator.name.toLowerCase();
    const resultLower = top.name.toLowerCase();
    if (!resultLower.includes(nameLower.split(" ")[0])) return null;
    return top;
  } catch {
    return null;
  }
}

/**
 * Step 2 — gather research facts.
 *
 * live mode: calls Anthropic with the web_search server tool so Claude can
 *   look up the business. Captures cited sources from the response.
 *
 * dry-run mode: returns a deterministic stub so the full pipeline runs free.
 */
export async function researchFacts(
  operator: IntelOperator,
  mode: ResearchMode
): Promise<ResearchResult> {
  const researchedAt = new Date().toISOString();

  if (mode === "dry-run") {
    return buildDryRunResearchResult(operator, researchedAt);
  }

  // --- live mode ---
  const client = getAnthropicClient();
  const t0 = Date.now();

  // Build a rich context prompt from the operator's known fields.
  const knownFields = [
    `Name: ${operator.name}`,
    operator.city ? `City: ${operator.city}, Alberta` : null,
    operator.website ? `Website: ${operator.website}` : null,
    operator.categories.length > 0
      ? `Categories: ${operator.categories.join(", ")}`
      : null,
    operator.street_address ? `Address: ${operator.street_address}` : null,
    operator.phone ? `Phone: ${operator.phone}` : null,
    operator.description ? `Description: ${operator.description}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  // Fetch optional Places enrichment in parallel while we wait for nothing yet.
  const placesData = await fetchPlacesData(operator);
  const placesNote = placesData
    ? `\nGoogle Places match: ${placesData.name} at ${placesData.address} (${placesData.businessStatus ?? "unknown status"})`
    : "";

  const systemPrompt = `You are a business intelligence researcher. Research the business described below using web search.
Find factual, publicly available information only. Do not fabricate any details.
If you cannot find information about a field, say so explicitly — do not guess.
Focus on: official website, contact details the business publishes itself,
year founded, employee count, ownership structure, services offered, sector/NAICS,
and any recent signals (hiring, permits, procurement activity, growth news).
Write a concise research markdown summary with source citations.`;

  const userPrompt = `Research this Alberta business and provide factual findings:\n\n${knownFields}${placesNote}\n\nProvide a thorough markdown research summary with all sources cited.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    tools: [
      {
        type: "web_search_20250305" as const,
        name: "web_search",
        max_uses: 5,
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
  });

  const duration_ms = Date.now() - t0;

  // Collect the final text block.
  const textBlocks = response.content.filter(
    (c): c is Anthropic.TextBlock => c.type === "text"
  );
  const rawMd = textBlocks.map((b) => b.text).join("\n\n").trim();

  // Extract source URLs from web_search_result blocks.
  // The web_search_20250305 server tool returns blocks of type
  // "web_search_tool_result"; each block has a content array of
  // { type: "web_search_result", url: string, ... } items.
  const sources: Array<{ url: string; accessed_at?: string; kind?: string }> = [];
  for (const block of response.content as unknown as Array<Record<string, unknown>>) {
    if (block.type === "web_search_tool_result") {
      const content = block.content;
      if (Array.isArray(content)) {
        for (const item of content as Array<Record<string, unknown>>) {
          if (item && item.type === "web_search_result") {
            const url = item.url;
            if (typeof url === "string" && url.startsWith("http")) {
              if (!sources.find((s) => s.url === url)) {
                sources.push({
                  url,
                  accessed_at: researchedAt,
                  kind: "web",
                });
              }
            }
          }
        }
      } else if (content && typeof content === "object") {
        // An error block ({ type: "web_search_tool_result_error", error_code }).
        // Without this the failed search is silently dropped and the profile is
        // composed from an empty result set — log it so it's observable.
        const errCode = (content as Record<string, unknown>).error_code;
        console.warn(
          JSON.stringify({
            event: "researchOperator.web_search_error",
            operatorId: operator.id,
            error_code: errCode ?? "unknown",
          }),
        );
      }
    }
  }

  // Guarantee at least one source entry (the operator's own URL if known).
  if (sources.length === 0) {
    const fallbackUrl = operator.website ?? operator.source_url ?? `https://www.google.com/search?q=${encodeURIComponent(operator.name)}`;
    sources.push({ url: fallbackUrl, accessed_at: researchedAt, kind: "web" });
  }

  // Token + cost accounting (Sonnet pricing: $3/1M in, $15/1M out as of June 2026).
  const tokens_in = response.usage.input_tokens;
  const tokens_out = response.usage.output_tokens;
  const cost_usd =
    (tokens_in / 1_000_000) * 3.0 + (tokens_out / 1_000_000) * 15.0;

  return {
    rawMd: rawMd || `Research completed for ${operator.name}.`,
    sources,
    placesData,
    researchedAt,
    usage: { tokens_in, tokens_out, cost_usd, duration_ms },
  };
}

/**
 * Step 3 — compose a valid v1 ProfileWriteInput from research results.
 *
 * live mode: calls Anthropic to structure the raw markdown into the v1 schema.
 *   Uses a strict JSON-only prompt — no fabrication allowed.
 *
 * dry-run mode: composes from the stub research result deterministically.
 */
export async function composeProfile(
  operator: IntelOperator,
  research: ResearchResult,
  mode: ResearchMode
): Promise<ProfileWriteInput> {
  if (mode === "dry-run") {
    return buildDryRunProfile(operator, research);
  }

  // --- live mode ---
  const client = getAnthropicClient();
  const t0 = Date.now();

  const schemaDescription = `
Produce ONLY valid JSON matching this exact shape (no prose, no markdown fences):
{
  "structured": {
    "identity": {
      "canonical_name": string,
      "also_known_as": string[],
      "website": string | null,
      "socials": { "linkedin"?: string, "facebook"?: string, "instagram"?: string, "x"?: string, "youtube"?: string },
      "year_established": number | null
    },
    "location": {
      "street_address": string | null,
      "city": string | null,
      "region": "AB",
      "postal_code": string | null,
      "is_headquarters": boolean | null,
      "other_locations_count": number | null
    },
    "classification": {
      "sector": string,
      "naics": string[],
      "services": string[],
      "b2b_or_b2c": "b2b" | "b2c" | "both" | null
    },
    "scale": {
      "employee_band": "1-4" | "5-9" | "10-19" | "20-49" | "50-99" | "100-249" | "250+" | null,
      "revenue_band": string | null,
      "ownership": "independent" | "franchise" | "subsidiary" | "public" | null
    },
    "contacts": [{ "name": string, "role": string, "email": string | null, "phone": string | null, "source_idx": number }],
    "signals": { "hiring": string | null, "permits": string | null, "procurement": string | null, "growth_notes": string | null },
    "summary": string
  },
  "data_gaps": string[],
  "confidence": number,
  "confidence_breakdown": {
    "<dotted.field.path>": { "confidence": number, "source_idx": number, "note"?: string }
  }
}

RULES:
- ONLY include fields you have evidence for in structured. Omit unknown fields.
- List ALL unknown fields in data_gaps (e.g. "scale.employee_band", "identity.year_established").
- contacts: ONLY include people the business itself has published (staff pages, press releases). Never infer from LinkedIn scrapes.
- confidence: overall 0.0–1.0 float reflecting your certainty across the profile.
- confidence_breakdown: per dotted path for every populated field.
- source_idx: zero-based index into the sources array provided to you.
- ANTI-FABRICATION: if unsure, omit the field and add to data_gaps.
- Neutral, factual register only. No marketing language.
`.trim();

  const sourcesContext = research.sources
    .map((s, i) => `[${i}] ${s.url}`)
    .join("\n");

  const userPrompt = `Operator: ${operator.name} (${operator.city ?? "Alberta"})

Research findings:
${research.rawMd}

Sources (use source_idx to reference):
${sourcesContext}

${schemaDescription}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system:
      "You are a structured data extractor. Output only valid JSON matching the schema — no prose, no markdown, no code fences.",
    messages: [{ role: "user", content: userPrompt }],
  });

  const composeDuration_ms = Date.now() - t0;

  const textBlock = response.content.find(
    (c): c is Anthropic.TextBlock => c.type === "text"
  );
  if (!textBlock) {
    throw new Error("composeProfile: no text block in response");
  }

  let raw = textBlock.text.trim();
  if (raw.startsWith("```")) {
    raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }

  let parsed: {
    structured: V1Structured;
    data_gaps: string[];
    confidence: number;
    confidence_breakdown: Record<string, unknown>;
  };

  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(
      `composeProfile: failed to parse JSON from model: ${
        e instanceof Error ? e.message : String(e)
      }\n---\n${raw}`
    );
  }

  // Accumulate token costs across both calls.
  const totalTokensIn =
    (research.usage?.tokens_in ?? 0) + response.usage.input_tokens;
  const totalTokensOut =
    (research.usage?.tokens_out ?? 0) + response.usage.output_tokens;
  const totalCostUsd =
    (research.usage?.cost_usd ?? 0) +
    (response.usage.input_tokens / 1_000_000) * 3.0 +
    (response.usage.output_tokens / 1_000_000) * 15.0;
  const totalDuration_ms =
    (research.usage?.duration_ms ?? 0) + composeDuration_ms;

  // Entity resolution: attach OUR-substrate signals (resolved from named feeds
  // — municipal licences, well licences, federal contracts) as a distinct,
  // provenance-tagged block. This is the differential over open-web research:
  // `signals` (above) is web-derived; `tamrack_signals` is resolved from our
  // own data. Read-only here (no alias writes during a research run).
  let ourSignals: OperatorSignals | null = null;
  try {
    ourSignals = await getOperatorSignals(
      { id: operator.id, name: operator.name, city: operator.city },
      { persist: false },
    );
  } catch (e) {
    console.warn(`[research] getOperatorSignals failed for ${operator.id}:`, e);
  }
  const structured = {
    ...(parsed.structured as unknown as Record<string, unknown>),
    ...(ourSignals && ourSignals.resolved_sources.length > 0
      ? { tamrack_signals: ourSignals }
      : {}),
  };

  return {
    profile_schema: "v1",
    researcher: "agent-research-loop",
    raw_profile_md: research.rawMd,
    structured,
    sources: research.sources,
    data_gaps: parsed.data_gaps ?? [],
    // Coerce + clamp: the model may emit confidence as a string ("0.75") or
    // out of range. writeProfile rejects anything not finite-in-[0,1], which
    // would throw at the write step and fail the queue row permanently.
    confidence: clampConfidence(parsed.confidence),
    confidence_breakdown: parsed.confidence_breakdown ?? {},
    cost_usd: totalCostUsd,
    tokens_in: totalTokensIn,
    tokens_out: totalTokensOut,
    duration_ms: totalDuration_ms,
    intelligence_researched_at: research.researchedAt,
  };
}

/**
 * Step 4 — persist the profile and let writeProfile mark the queue row done.
 */
export async function persistProfile(
  operatorId: string,
  payload: ProfileWriteInput
): Promise<string> {
  const result = await writeProfile(operatorId, payload);
  return result.profile_id;
}

// ---------------------------------------------------------------------------
// Dry-run stubs — deterministic, free, exercises full plumbing
// ---------------------------------------------------------------------------

function buildDryRunResearchResult(
  operator: IntelOperator,
  researchedAt: string
): ResearchResult {
  const website =
    operator.website ??
    `https://www.${operator.name.toLowerCase().replace(/[^a-z0-9]+/g, "")}.ca`;
  const city = operator.city ?? "Alberta";

  const rawMd = `# ${operator.name} — Research Summary (dry-run stub)

**Location:** ${operator.street_address ? operator.street_address + ", " : ""}${city}, Alberta${operator.postal_code ? " " + operator.postal_code : ""}

**Categories:** ${operator.categories.join(", ") || "General Business"}

**Website:** ${operator.website ?? "(not listed)"}

This is a dry-run stub produced by the research workflow to validate the pipeline
without making paid API calls. In live mode this section would contain findings
from web search and structured analysis.

No fabricated data — only information present in the operator's directory record
is reflected here.

Sources:
- [0] ${website}
`.trim();

  return {
    rawMd,
    sources: [
      {
        url: website,
        accessed_at: researchedAt,
        kind: "web",
      },
    ],
    placesData: null,
    researchedAt,
  };
}

function buildDryRunProfile(
  operator: IntelOperator,
  research: ResearchResult
): ProfileWriteInput {
  const structured: V1Structured = {
    identity: {
      canonical_name: operator.name,
      also_known_as: [],
      website: operator.website ?? null,
      socials: operator.social
        ? {
            facebook: (operator.social as Record<string, string>).facebook,
            instagram: (operator.social as Record<string, string>).instagram,
            x: (operator.social as Record<string, string>).x,
            linkedin: (operator.social as Record<string, string>).linkedin,
            youtube: (operator.social as Record<string, string>).youtube,
          }
        : {},
      year_established: null,
    },
    location: {
      street_address: operator.street_address ?? null,
      city: operator.city ?? null,
      region: "AB",
      postal_code: operator.postal_code ?? null,
      is_headquarters: null,
      other_locations_count: null,
    },
    classification: {
      sector: operator.categories[0] ?? "General Business",
      naics: [],
      services: operator.categories,
      b2b_or_b2c: null,
    },
    scale: {
      employee_band: null,
      revenue_band: null,
      ownership: null,
    },
    contacts: [],
    signals: {
      hiring: null,
      permits: null,
      procurement: null,
      growth_notes: null,
    },
    summary: `${operator.name} is a business located in ${operator.city ?? "Alberta"}. ` +
      `Profile generated from directory record in dry-run mode; live research will enrich all fields.`,
  };

  // Confidence breakdown reflects that we only have directory data.
  const confidence_breakdown: Record<
    string,
    { confidence: number; source_idx: number; note?: string }
  > = {
    "identity.canonical_name": {
      confidence: 0.95,
      source_idx: 0,
      note: "from directory record",
    },
    "location.city": { confidence: 0.9, source_idx: 0, note: "from directory record" },
    "location.region": { confidence: 1.0, source_idx: 0 },
  };
  if (operator.website) {
    confidence_breakdown["identity.website"] = {
      confidence: 0.85,
      source_idx: 0,
      note: "from directory record",
    };
  }

  const data_gaps = [
    "identity.year_established",
    "identity.also_known_as",
    "classification.naics",
    "classification.b2b_or_b2c",
    "scale.employee_band",
    "scale.revenue_band",
    "scale.ownership",
    "contacts",
    "signals.hiring",
    "signals.permits",
    "signals.procurement",
    "signals.growth_notes",
  ];

  return {
    profile_schema: "v1",
    researcher: "agent-research-loop",
    raw_profile_md: research.rawMd,
    structured: structured as unknown as Record<string, unknown>,
    sources: research.sources,
    data_gaps,
    confidence: 0.35,
    confidence_breakdown,
    cost_usd: null,
    tokens_in: null,
    tokens_out: null,
    duration_ms: null,
    intelligence_researched_at: research.researchedAt,
  };
}

// ---------------------------------------------------------------------------
// researchOperator — Resonate generator workflow
// ---------------------------------------------------------------------------

export function* researchOperator(
  ctx: Context,
  input: ResearchOperatorInput
): Generator<any, OperatorResearchResult, any> {
  const { operatorId, mode = "dry-run", attempt = 1 } = input;

  // Step IDs scoped by (operatorId + ISO-date + attempt). The attempt number
  // ensures a re-queued/retried operator does NOT replay the previous run's
  // cached step results (Resonate promises created with an explicit id are
  // global-scoped); a mid-run crash on the SAME attempt still reuses the id.
  const today = new Date().toISOString().split("T")[0];
  const stepId = (suffix: string) =>
    `researchOperator.${operatorId}.${today}.a${attempt}.${suffix}`;

  // --- Step 1: Load operator ---
  const operator: IntelOperator | null = yield* ctx.run(
    async (): Promise<IntelOperator | null> => {
      return loadOperator(operatorId);
    },
    (ctx as any).options({ id: stepId("load") })
  );

  if (!operator) {
    // No operator row — mark fail so the queue row gets the error.
    // Fire-and-forget: generators cannot use await directly; we don't need
    // to block on the queue update here.
    markQueueFailed(
      operatorId,
      `operator ${operatorId} not found in intel_operators`
    ).catch(() => {
      // best-effort
    });
    console.log(
      JSON.stringify({
        event: "researchOperator.noOperator",
        operatorId,
        mode,
      })
    );
    return { operatorId, status: "no_operator" };
  }

  // --- Step 2: Research facts ---
  let research: ResearchResult;
  try {
    research = yield* ctx.run(
      async (): Promise<ResearchResult> => {
        return researchFacts(operator, mode);
      },
      (ctx as any).options({ id: stepId("research") })
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    captureError(e, {
      workflow: "researchOperator",
      step: "research",
      operatorId,
    });
    console.log(
      JSON.stringify({
        event: "researchOperator.researchFailed",
        operatorId,
        error: msg,
        mode,
      })
    );
    markQueueFailed(operatorId, `research step failed: ${msg}`).catch(() => {
      // best-effort
    });
    return { operatorId, status: "research_error", error: msg };
  }

  // --- Step 3: Compose profile ---
  let payload: ProfileWriteInput;
  try {
    payload = yield* ctx.run(
      async (): Promise<ProfileWriteInput> => {
        return composeProfile(operator, research, mode);
      },
      (ctx as any).options({ id: stepId("compose") })
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    captureError(e, {
      workflow: "researchOperator",
      step: "compose",
      operatorId,
    });
    console.log(
      JSON.stringify({
        event: "researchOperator.composeFailed",
        operatorId,
        error: msg,
        mode,
      })
    );
    markQueueFailed(operatorId, `compose step failed: ${msg}`).catch(() => {
      // best-effort
    });
    return { operatorId, status: "compose_error", error: msg };
  }

  // --- Step 4: Persist profile (writeProfile also marks queue done) ---
  let profileId: string;
  try {
    profileId = yield* ctx.run(
      async (): Promise<string> => {
        return persistProfile(operatorId, payload);
      },
      (ctx as any).options({ id: stepId("write") })
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    captureError(e, {
      workflow: "researchOperator",
      step: "write",
      operatorId,
    });
    console.log(
      JSON.stringify({
        event: "researchOperator.writeFailed",
        operatorId,
        error: msg,
        mode,
      })
    );
    markQueueFailed(operatorId, `write step failed: ${msg}`).catch(() => {
      // best-effort
    });
    return { operatorId, status: "write_error", error: msg };
  }

  console.log(
    JSON.stringify({
      event: "researchOperator.complete",
      operatorId,
      operatorName: operator.name,
      profileId,
      mode,
      cost_usd: payload.cost_usd ?? null,
      tokens_in: payload.tokens_in ?? null,
      tokens_out: payload.tokens_out ?? null,
      duration_ms: payload.duration_ms ?? null,
    })
  );

  return { operatorId, status: "ok", profileId };
}
