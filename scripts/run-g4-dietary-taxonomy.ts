#!/usr/bin/env npx tsx
/**
 * G4 dietary-taxonomy classification pass over Edmonton business licences.
 *
 * Hybrid scope: every row in dataset qhi4-bdpu gets a row in
 * signals.licence_dietary_taxonomy. Food-service categories are classified
 * by Haiku 4.5 in batches of 200; all other categories are rule-tagged as
 * 'unknown' (no model call). Total dataset is ~43k rows; food-service
 * subset is ~3.3k. Rationale: cheap, complete coverage means downstream
 * signal queries can LEFT JOIN against the full licence universe without
 * worrying about NULL gaps.
 *
 * Idempotent: UPSERTs on licence_id PK. Safe to re-run.
 * Writes one row per run to snapshot_log under source
 * 'signals.licence_dietary_taxonomy.backfill'.
 *
 * Usage:
 *   DATABASE_URL=... ANTHROPIC_API_KEY=... npx tsx scripts/run-g4-dietary-taxonomy.ts
 *   DATABASE_URL=... ANTHROPIC_API_KEY=... npx tsx scripts/run-g4-dietary-taxonomy.ts --dry-run
 *   DATABASE_URL=... ANTHROPIC_API_KEY=... npx tsx scripts/run-g4-dietary-taxonomy.ts --dry-run --sample 200
 *   DATABASE_URL=... ANTHROPIC_API_KEY=... npx tsx scripts/run-g4-dietary-taxonomy.ts --limit 1000
 */
import Anthropic from "@anthropic-ai/sdk";

import { getDb } from "../src/lib/db";

const EDM_LICENCES_URL = "https://data.edmonton.ca/resource/qhi4-bdpu.json";
const MODEL = "claude-haiku-4-5-20251001";
const BATCH_SIZE = 200;
const DIETARY_VALUES = new Set(["gf_friendly", "allergen_friendly", "standard", "unknown"]);

interface RawLicence {
  externalid?: string;
  business_name?: string;
  business_licence_category?: string;
}

interface ClassifiedRow {
  licence_id: string;
  trade_name: string | null;
  raw_category: string | null;
  dietary_category: "gf_friendly" | "allergen_friendly" | "standard" | "unknown";
  dietary_confidence: number | null;
}

// Substring tokens that identify a row as food-service. Compound categories
// like "Restaurant or Food Service;Alcohol Sales (...)" match via "restaurant".
// Pure-alcohol categories (off-premises liquor, on-premises bar without food)
// are intentionally excluded — they get the rule-tagged 'unknown'.
const FOOD_SERVICE_TOKENS = [
  "restaurant",
  "food service",
  "food processing",
  "food truck",
  "food cart",
  "catering",
];

function isFoodService(rawCategory: string | null): boolean {
  if (!rawCategory) return false;
  const lower = rawCategory.toLowerCase();
  return FOOD_SERVICE_TOKENS.some((tok) => lower.includes(tok));
}

const SYSTEM_PROMPT = `You classify Edmonton food-service business licences into a dietary taxonomy for an analytics dashboard.

For each licence row you are given (id, name, raw_category), assign exactly ONE category:

- "gf_friendly": The business name or category strongly suggests gluten-free is a positioning choice (dedicated GF restaurants, GF bakeries, naturally GF cuisines like Mexican taquerias with corn tortillas, Vietnamese pho/banh-mi only when GF is in name, Indian, Ethiopian, Thai, Japanese sushi/ramen, Korean BBQ, juice/smoothie bars, salad bars, açaí/poke bowls). When in doubt between gf_friendly and standard, choose standard.
- "allergen_friendly": Name or category signals vegan/vegetarian/plant-based/allergen-conscious positioning (vegan cafes, plant-based restaurants, raw food, juice bars marketed as allergy-aware, dedicated allergen-free bakeries).
- "standard": Mainstream restaurants, fast food, pizza, burgers, sandwiches, bakeries, cafes, catering, food trucks, food processing — anything where the business is genuinely food-service but has no special dietary positioning. This is the default for most food-service licences.
- "unknown": You cannot tell from the name and category alone (vague holding-company names, single-letter business names, ambiguous foreign words).

Also return a "confidence" in [0.0, 1.0] reflecting how certain you are. Use 0.5-0.7 for default "standard" picks based on cuisine type, 0.8+ when the name explicitly states the positioning, 0.3 or lower for guesses.

Output ONLY a valid JSON array, one entry per input row, in the same order. No prose, no markdown fences. Schema:
[
  {"id": "<string>", "dietary_category": "gf_friendly"|"allergen_friendly"|"standard"|"unknown", "confidence": 0.0-1.0},
  ...
]

If a row's name is empty, missing, or only a number, output {"id": "...", "dietary_category": "unknown", "confidence": 0.0}.`;

interface BatchResult {
  rows: ClassifiedRow[];
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
}

async function classifyBatch(
  client: Anthropic,
  inputs: { id: string; name: string; raw_category: string }[],
  attempt = 1,
): Promise<BatchResult> {
  const userMessage = JSON.stringify(
    inputs.map((r) => ({ id: r.id, name: r.name, raw_category: r.raw_category })),
  );

  let response;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userMessage }],
    });
  } catch (err) {
    if (attempt < 3) {
      const waitMs = 1500 * attempt;
      console.warn(`        [retry ${attempt}] ${err instanceof Error ? err.message : String(err)} — waiting ${waitMs}ms`);
      await new Promise((r) => setTimeout(r, waitMs));
      return classifyBatch(client, inputs, attempt + 1);
    }
    throw err;
  }

  const block = response.content.find((c): c is Anthropic.TextBlock => c.type === "text");
  if (!block) throw new Error("classifyBatch: no text block in Haiku response");

  let text = block.text.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    if (attempt < 3) {
      console.warn(`        [retry ${attempt}] JSON parse failed — retrying`);
      await new Promise((r) => setTimeout(r, 1500 * attempt));
      return classifyBatch(client, inputs, attempt + 1);
    }
    throw new Error(`classifyBatch: JSON parse failed after retries: ${err instanceof Error ? err.message : String(err)}\n---\n${text.slice(0, 400)}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error(`classifyBatch: response was not a JSON array (got ${typeof parsed})`);
  }

  const byId = new Map<string, { dietary_category: string; confidence: number }>();
  for (const raw of parsed) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : null;
    const cat = typeof o.dietary_category === "string" ? o.dietary_category : null;
    if (!id || !cat || !DIETARY_VALUES.has(cat)) continue;
    const conf = typeof o.confidence === "number" ? Math.max(0, Math.min(1, o.confidence)) : 0;
    byId.set(id, { dietary_category: cat, confidence: conf });
  }

  const rows: ClassifiedRow[] = inputs.map((inp) => {
    const hit = byId.get(inp.id);
    if (!hit) {
      return {
        licence_id: inp.id,
        trade_name: inp.name || null,
        raw_category: inp.raw_category || null,
        dietary_category: "unknown",
        dietary_confidence: 0,
      };
    }
    return {
      licence_id: inp.id,
      trade_name: inp.name || null,
      raw_category: inp.raw_category || null,
      dietary_category: hit.dietary_category as ClassifiedRow["dietary_category"],
      dietary_confidence: hit.confidence,
    };
  });

  const usage = response.usage as unknown as Record<string, number | undefined>;
  return {
    rows,
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    cachedInputTokens: usage.cache_read_input_tokens ?? 0,
  };
}

async function fetchAllLicences(): Promise<RawLicence[]> {
  // Socrata default cap is 1000 rows per request; bump to a safe high limit.
  // 43k rows fits well under the 50k single-page cap.
  const url = `${EDM_LICENCES_URL}?$select=externalid,business_name,business_licence_category&$limit=100000`;
  console.log(`[fetch] ${url}`);
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 tamrack-g4-dietary-taxonomy" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching Edmonton licences`);
  const data = (await res.json()) as RawLicence[];
  if (!Array.isArray(data)) throw new Error("Edmonton response was not an array");
  console.log(`        ${data.length} rows`);
  return data;
}

function parseArgs() {
  const dryRun = process.argv.includes("--dry-run");
  let sample: number | null = null;
  let limit: number | null = null;
  const sampleIdx = process.argv.indexOf("--sample");
  if (sampleIdx > 0) sample = parseInt(process.argv[sampleIdx + 1] || "0", 10) || null;
  const limitIdx = process.argv.indexOf("--limit");
  if (limitIdx > 0) limit = parseInt(process.argv[limitIdx + 1] || "0", 10) || null;
  return { dryRun, sample, limit };
}

async function main() {
  const { dryRun, sample, limit } = parseArgs();
  const apiKey =
    process.env.TAMRACK_ANTHROPIC_API_TOKEN ??
    process.env.ANTHROPIC_TAMRACK_API_TOKEN ??
    process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("TAMRACK_ANTHROPIC_API_TOKEN / ANTHROPIC_TAMRACK_API_TOKEN / ANTHROPIC_API_KEY required");

  const startedAt = new Date();
  const raw = await fetchAllLicences();

  // Dataset has ~3.4k duplicate externalid rows — usually the same business
  // licensed across multiple category combinations (e.g., a Restaurant +
  // Alcohol combo where Edmonton emits two rows). For our PK we keep one
  // row per externalid, but prefer the row whose category is food-service
  // if any so the LLM gets the dietary-relevant variant.
  const byId = new Map<string, RawLicence>();
  for (const r of raw) {
    const id = r.externalid?.trim();
    if (!id) continue;
    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, r);
      continue;
    }
    const existingFood = isFoodService(existing.business_licence_category ?? null);
    const incomingFood = isFoodService(r.business_licence_category ?? null);
    if (incomingFood && !existingFood) byId.set(id, r);
  }
  const deduped = Array.from(byId.values());
  if (deduped.length !== raw.length) {
    console.log(`        deduped ${raw.length - deduped.length} duplicate externalid rows (kept food-service variant when present)`);
  }

  let working = deduped;
  if (limit !== null) {
    working = working.slice(0, limit);
    console.log(`[limit] truncated to ${working.length} rows`);
  }

  const food: RawLicence[] = [];
  const nonFood: RawLicence[] = [];
  for (const r of working) {
    if (isFoodService(r.business_licence_category ?? null)) food.push(r);
    else nonFood.push(r);
  }
  console.log(`[split] food-service: ${food.length}   non-food: ${nonFood.length}`);

  const foodForLLM = sample !== null ? food.slice(0, sample) : food;
  if (sample !== null) {
    console.log(`[sample] LLM-classifying first ${foodForLLM.length} food-service rows only`);
  }

  const client = new Anthropic({ apiKey });
  const classified: ClassifiedRow[] = [];

  let totalIn = 0;
  let totalOut = 0;
  let totalCachedIn = 0;
  const t0 = Date.now();
  for (let i = 0; i < foodForLLM.length; i += BATCH_SIZE) {
    const slice = foodForLLM.slice(i, i + BATCH_SIZE);
    const inputs = slice.map((r) => ({
      id: r.externalid?.trim() ?? "",
      name: (r.business_name ?? "").trim(),
      raw_category: (r.business_licence_category ?? "").trim(),
    }));
    process.stdout.write(`[llm] batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(foodForLLM.length / BATCH_SIZE)} (${inputs.length} rows)…`);
    const result = await classifyBatch(client, inputs);
    classified.push(...result.rows);
    totalIn += result.inputTokens;
    totalOut += result.outputTokens;
    totalCachedIn += result.cachedInputTokens;
    process.stdout.write(` ok (${result.rows.length})\n`);
  }
  const llmSeconds = Math.round((Date.now() - t0) / 1000);
  console.log(`[llm] done in ${llmSeconds}s. tokens: in=${totalIn} (cached=${totalCachedIn}) out=${totalOut}`);

  // Rule-tag non-food rows and any food rows not in the LLM sample.
  const llmClassifiedIds = new Set(classified.map((c) => c.licence_id));
  for (const r of nonFood) {
    const id = r.externalid?.trim();
    if (!id) continue;
    classified.push({
      licence_id: id,
      trade_name: (r.business_name ?? "").trim() || null,
      raw_category: (r.business_licence_category ?? "").trim() || null,
      dietary_category: "unknown",
      dietary_confidence: null,
    });
  }
  for (const r of food) {
    const id = r.externalid?.trim();
    if (!id || llmClassifiedIds.has(id)) continue;
    classified.push({
      licence_id: id,
      trade_name: (r.business_name ?? "").trim() || null,
      raw_category: (r.business_licence_category ?? "").trim() || null,
      dietary_category: "unknown",
      dietary_confidence: null,
    });
  }

  const dist = new Map<string, number>();
  for (const c of classified) {
    dist.set(c.dietary_category, (dist.get(c.dietary_category) ?? 0) + 1);
  }
  console.log("[dist]", Object.fromEntries(dist));

  if (dryRun) {
    console.log("[dry-run] skipping DB write");
    console.log("[dry-run] sample classified rows:");
    for (const c of classified.filter((r) => r.dietary_category !== "unknown").slice(0, 20)) {
      console.log(`  ${c.dietary_category.padEnd(18)} ${c.dietary_confidence?.toFixed(2)} ${c.trade_name}`);
    }
    return;
  }

  const pool = await getDb();
  const client_db = await pool.connect();
  let inserted = 0;
  try {
    await client_db.query("BEGIN");
    for (const c of classified) {
      const result = await client_db.query(
        `INSERT INTO signals.licence_dietary_taxonomy
           (licence_id, trade_name, raw_category, dietary_category, dietary_confidence, classified_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (licence_id) DO UPDATE SET
           trade_name         = EXCLUDED.trade_name,
           raw_category       = EXCLUDED.raw_category,
           dietary_category   = EXCLUDED.dietary_category,
           dietary_confidence = EXCLUDED.dietary_confidence,
           classified_at      = EXCLUDED.classified_at`,
        [c.licence_id, c.trade_name, c.raw_category, c.dietary_category, c.dietary_confidence],
      );
      inserted += result.rowCount ?? 0;
    }
    await client_db.query(
      `INSERT INTO snapshot_log (taken_at, source, status, records_inserted, error)
       VALUES ($1, $2, $3, $4, NULL)`,
      [startedAt, "signals.licence_dietary_taxonomy.backfill", "success", inserted],
    );
    await client_db.query("COMMIT");
  } catch (e) {
    await client_db.query("ROLLBACK");
    throw e;
  } finally {
    client_db.release();
  }

  console.log(`[upsert] ${inserted} rows touched in signals.licence_dietary_taxonomy`);
  console.log(`[done] llm seconds=${llmSeconds} tokens=in:${totalIn}/cached:${totalCachedIn}/out:${totalOut}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FATAL:", e);
    process.exit(1);
  });
