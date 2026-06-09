/**
 * `tamrack_leads` tool registration.
 *
 * Per-geo demand-heat composite: ranks Alberta municipalities by a weighted
 * aggregate of four signals — hiring momentum (Job Bank Tier-B postings +
 * month-over-month growth), permit expansion (municipality_permits volume +
 * growth), business formation (regional_indicators Incorporations), and
 * provincial procurement backdrop (open CanadaBuys tenders). Compute-on-read
 * only; no DB writes.
 *
 * Honest scope (surfaced in the description):
 *   - This is a directional demand-heat ranking, NOT a list of per-company
 *     leads (Job Bank strips employer names; procurement is provincial).
 *   - The procurement sub-score (weight 0.20) is identical for all geos in
 *     v1 — it is a provincial backdrop, not a per-geo differentiator.
 *   - City-to-geo matching is name-based; some Job Bank city spellings may
 *     not match the registry, leaving coverage.hasHiring = false for those
 *     geos. Check the coverage field on each row.
 *
 * Dataset (1):
 *   - ranking → municipalities ranked descending by composite score (0-100).
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { readLeadScores } from "@/lib/data-sources-leads";
import type { LeadScoreResult } from "@/lib/leads-score";

import { SCHEMA_VERSION } from "../schemas";
import { updateToolEntry } from "../registry";
import { requireScopes } from "../lib/auth-context";

const REQUIRED_SCOPES = ["tamrack:economy:read"] as const;

const LEADS_DATASETS = ["ranking"] as const;

const LeadsInputShape = {
  dataset: z
    .enum(LEADS_DATASETS)
    .default("ranking")
    .describe(
      "Dataset to return. ranking = municipalities ranked by composite demand-heat score (0-100), descending.",
    ),
  limit: z
    .number()
    .int()
    .positive()
    .max(100)
    .optional()
    .describe(
      "Cap the number of returned municipalities (1-100). Normalization always runs over the full geo set; this only trims the output list. Omit to return all geos.",
    ),
};

// ---------------------------------------------------------------------------
// Output schemas (mirrors leads-score.ts types for Zod validation)
// ---------------------------------------------------------------------------

const SubScoresSchema = z.object({
  hiringMomentum: z.number(),
  permitExpansion: z.number(),
  businessFormation: z.number(),
  procurementBackdrop: z.number(),
});

const RawSignalsSchema = z.object({
  hiringAdjustedCount: z.number(),
  tierBCount: z.number(),
  momDeltaPct: z.number().nullable(),
  permitCount: z.number(),
  permitPriorCount: z.number().nullable(),
  permitAdjustedCount: z.number(),
  incorporations: z.number(),
  openTenderCount: z.number(),
});

const DataCoverageSchema = z.object({
  hasHiring: z.boolean(),
  hasPermits: z.boolean(),
  hasFormation: z.boolean(),
  hasProcurement: z.boolean(),
});

const GeoLeadScoreSchema = z.object({
  geo: z.string(),
  slug: z.string(),
  csduid: z.string(),
  rank: z.number(),
  score: z.number(),
  subScores: SubScoresSchema,
  raw: RawSignalsSchema,
  coverage: DataCoverageSchema,
});

const LeadScoreMetaSchema = z.object({
  computedAt: z.string(),
  hiringMonth: z.string().nullable(),
  permitSnapshotDate: z.string().nullable(),
  formationPeriod: z.string().nullable(),
  openTenderCount: z.number(),
  geoCount: z.number(),
  caveats: z.array(z.string()),
});

const LeadsPayloadSchema = z.object({
  dataset: z.literal("ranking"),
  rankings: z.array(GeoLeadScoreSchema),
  meta: LeadScoreMetaSchema,
});

const LeadsDataSchema = z.object({
  dataset: z.enum(LEADS_DATASETS),
  source: z.string(),
  unit: z.string(),
  served_from: z.enum(["upstream", "empty"]),
  notes: z.string().optional(),
  payload: LeadsPayloadSchema,
});

const LeadsEnvelopeSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  tool: z.literal("tamrack_leads"),
  source: z.string(),
  data: LeadsDataSchema,
});

type LeadsEnvelope = z.infer<typeof LeadsEnvelopeSchema>;

// ---------------------------------------------------------------------------
// Registry entry
// ---------------------------------------------------------------------------

const TOOL_NAME = "tamrack_leads";

const TOOL_DESCRIPTION =
  "Per-geo demand-heat composite — ranks Alberta municipalities by a weighted " +
  "aggregate of hiring momentum (Canada Job Bank Tier-B postings + month-over-month " +
  "growth), permit expansion (municipality_permits volume + growth), business " +
  "formation (regional_indicators Incorporations), and provincial procurement " +
  "backdrop (open CanadaBuys tenders). Compute-on-read, no DB writes. " +
  "dataset `ranking` returns all geos ranked 1-N by composite score (0-100) " +
  "with sub-scores, raw signals, and data-coverage flags per geo. " +
  "Honest scope: this is a directional demand-heat ranking, NOT a per-company " +
  "lead list — Job Bank strips employer names and the procurement sub-score is " +
  "provincial (identical for all geos in v1). Check coverage flags and caveats " +
  "in meta before acting on a specific geo's rank.";

updateToolEntry(TOOL_NAME, {
  status: "live",
  parameters_summary:
    "dataset (enum: ranking; default ranking); optional limit (1-100, trims output after scoring).",
  response_summary:
    "Envelope with data.payload.rankings[] — each geo has { geo, slug, csduid, rank, score, subScores, raw, coverage } — plus meta { computedAt, hiringMonth, permitSnapshotDate, formationPeriod, openTenderCount, geoCount, caveats[] }.",
  indicators: [...LEADS_DATASETS],
  example_invocations: [
    {
      description: "Top 10 Alberta municipalities by demand-heat composite score.",
      arguments: { dataset: "ranking", limit: 10 },
    },
    {
      description: "Full geo ranking for all 30 registry municipalities.",
      arguments: { dataset: "ranking" },
    },
  ],
});

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerLeadsTool(server: McpServer): void {
  server.registerTool(
    TOOL_NAME,
    {
      title: "Tamrack — Per-geo demand-heat ranking",
      description: TOOL_DESCRIPTION,
      inputSchema: LeadsInputShape,
      annotations: {
        title: "Tamrack — Per-geo demand-heat ranking",
        readOnlyHint: true,
        openWorldHint: false,
        idempotentHint: true,
      },
    },
    async (args) => {
      requireScopes(REQUIRED_SCOPES);
      const notesParts: string[] = [];
      let result: LeadScoreResult | null = null;

      try {
        result = await readLeadScores();
      } catch (err) {
        console.warn(`[mcp:${TOOL_NAME}] read failed:`, err);
        notesParts.push(
          `lead score read threw: ${err instanceof Error ? err.message : String(err)}`,
        );
        result = null;
      }

      const isEmpty = result == null || result.rankings.length === 0;

      if (isEmpty) {
        notesParts.push(
          "no geo scores available (hiring and permit data may not be collected yet)",
        );
      }

      // Apply optional limit — normalization already ran over the full set
      const rankings =
        result != null
          ? args.limit != null
            ? result.rankings.slice(0, args.limit)
            : result.rankings
          : [];

      const meta = result?.meta ?? {
        computedAt: new Date().toISOString(),
        hiringMonth: null,
        permitSnapshotDate: null,
        formationPeriod: null,
        openTenderCount: 0,
        geoCount: 0,
        caveats: [],
      };

      const envelope: LeadsEnvelope = {
        schema_version: SCHEMA_VERSION,
        tool: TOOL_NAME,
        source:
          "Tamrack composite (Job Bank + municipality_permits + regional_indicators + opportunities)",
        data: {
          dataset: "ranking",
          source:
            "Canada Job Bank (ESDC OGL), municipality permit snapshots, " +
            "Alberta Regional Dashboard (Incorporations), CanadaBuys open data",
          unit: "composite score 0-100",
          served_from: isEmpty ? "empty" : "upstream",
          notes: notesParts.length > 0 ? notesParts.join("; ") : undefined,
          payload: {
            dataset: "ranking",
            rankings,
            meta,
          },
        },
      };

      const parsed = LeadsEnvelopeSchema.parse(envelope);

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(parsed, null, 2) },
        ],
        structuredContent: parsed as unknown as Record<string, unknown>,
      };
    },
  );
}
