/**
 * `tamrack_opportunities` tool registration.
 *
 * Demand-side feed: concrete contract opportunities with a buyer and a
 * deadline, as opposed to the macro time-series the other tools expose.
 *
 *   - `src/lib/data-sources-procurement.ts` — CanadaBuys federal open tender
 *     notices accumulated in Postgres (`opportunities` table), filtered to
 *     IT/software/AI/data work an Alberta vendor can deliver. The daily
 *     collector refreshes the table; this tool reads it (no live CDN call).
 *
 * Dataset (1):
 *   - tenders → IT/software/AI/data federal tenders, soonest-closing first.
 *              `open_only` keeps notices still accepting bids; `closing_before`
 *              bounds the deadline; `limit` caps the rows.
 *
 * Honest scope note (surfaced in the description): federal direct-bid IT work
 * skews to TBIPS staff-augmentation, licensing renewals, and NCR-based
 * contracts — thin for a solo product builder. The value is completeness and
 * deadline/recompete timing, not raw volume of takeable solo work.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  readOpportunities,
  type StoredOpportunity,
} from "@/lib/data-sources-procurement";

import { LimitSchema, SCHEMA_VERSION } from "../schemas";
import { updateToolEntry } from "../registry";
import { requireScopes } from "../lib/auth-context";

const REQUIRED_SCOPES = ["tamrack:economy:read"] as const;

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

const OPPORTUNITY_DATASETS = ["tenders"] as const;

const OpportunityInputShape = {
  dataset: z
    .enum(OPPORTUNITY_DATASETS)
    .default("tenders")
    .describe(
      "Opportunity dataset. tenders = CanadaBuys federal open tender notices (IT/software/AI/data), soonest-closing first.",
    ),
  open_only: z
    .boolean()
    .optional()
    .describe(
      "When true, only tenders still accepting bids (closing date today or later, plus standing notices with no closing date).",
    ),
  closing_before: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD")
    .optional()
    .describe("Only tenders closing on or before this YYYY-MM-DD date."),
  limit: LimitSchema.optional(),
};

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const TenderRowSchema = z.object({
  title: z.string(),
  referenceNumber: z.string(),
  solicitationNumber: z.string(),
  buyer: z.string(),
  category: z.string(),
  procurementMethod: z.string(),
  gsin: z.string(),
  gsinDescription: z.string(),
  unspsc: z.string(),
  unspscDescription: z.string(),
  regionsOfOpportunity: z.string(),
  regionsOfDelivery: z.string(),
  publicationDate: z.string(),
  closingDate: z.string(),
  expectedStartDate: z.string(),
  expectedEndDate: z.string(),
  status: z.string(),
  noticeUrl: z.string(),
  matchedTerms: z.array(z.string()),
  source: z.string(),
  collectedAt: z.string(),
});

const OpportunityDataSchema = z.object({
  dataset: z.enum(OPPORTUNITY_DATASETS),
  source: z.string(),
  unit: z.string(),
  served_from: z.enum(["upstream", "empty"]),
  notes: z.string().optional(),
  payload: z.object({
    dataset: z.literal("tenders"),
    rows: z.array(TenderRowSchema),
  }),
});

const OpportunityEnvelopeSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  tool: z.literal("tamrack_opportunities"),
  source: z.string(),
  data: OpportunityDataSchema,
});
type OpportunityEnvelope = z.infer<typeof OpportunityEnvelopeSchema>;

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

const TOOL_NAME = "tamrack_opportunities";

const TOOL_DESCRIPTION =
  "Demand-side feed — concrete contract opportunities with a buyer and a " +
  "deadline, not macro time-series. Dataset `tenders`: CanadaBuys federal " +
  "open tender notices (Public Services and Procurement Canada open data), " +
  "filtered to IT/software/AI/data work an Alberta-based vendor can deliver " +
  "(Alberta + nationally-deliverable), soonest-closing first. Each row carries " +
  "the buyer, closing date, GSIN/UNSPSC, the notice URL, and matchedTerms " +
  "(why it was kept). Filters: open_only (still accepting bids), closing_before " +
  "(deadline bound), limit. Honest scope: federal direct-bid IT work skews to " +
  "TBIPS staff-augmentation, licensing renewals, and NCR-based contracts — the " +
  "value is completeness and deadline/recompete timing, not volume of takeable " +
  "solo work.";

updateToolEntry(TOOL_NAME, {
  status: "live",
  parameters_summary:
    "dataset (enum: tenders; default tenders); optional open_only (boolean); optional closing_before (YYYY-MM-DD); optional limit.",
  response_summary:
    "Envelope with schema_version, tool, source (CanadaBuys); data.{dataset, source, unit, served_from, payload.rows[]}. Each row: title, referenceNumber, buyer, closingDate, gsin/unspsc, noticeUrl, matchedTerms, source, collectedAt.",
  indicators: [...OPPORTUNITY_DATASETS],
  example_invocations: [
    {
      description: "Federal IT/software tenders still open, soonest-closing first.",
      arguments: { dataset: "tenders", open_only: true, limit: 20 },
    },
    {
      description: "Tenders closing on or before the end of the month.",
      arguments: { dataset: "tenders", closing_before: "2026-06-30" },
    },
  ],
});

export function registerOpportunitiesTool(server: McpServer): void {
  server.registerTool(
    TOOL_NAME,
    {
      title: "Tamrack — Opportunities (CanadaBuys tenders)",
      description: TOOL_DESCRIPTION,
      inputSchema: OpportunityInputShape,
      annotations: {
        title: "Tamrack — Opportunities (CanadaBuys tenders)",
        readOnlyHint: true,
        openWorldHint: false,
        idempotentHint: true,
      },
    },
    async (args) => {
      requireScopes(REQUIRED_SCOPES);
      const notesParts: string[] = [];
      let rows: StoredOpportunity[] = [];

      try {
        rows = await readOpportunities({
          openOnly: args.open_only,
          closingBefore: args.closing_before,
          limit: args.limit,
        });
      } catch (err) {
        console.warn(`[mcp:${TOOL_NAME}] read failed:`, err);
        notesParts.push(
          `opportunities read threw: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        rows = [];
      }

      const envelope: OpportunityEnvelope = {
        schema_version: SCHEMA_VERSION,
        tool: TOOL_NAME,
        source: "CanadaBuys",
        data: {
          dataset: "tenders",
          source: "CanadaBuys open tender notices (PSPC open data)",
          unit: "tenders",
          served_from: rows.length > 0 ? "upstream" : "empty",
          notes: notesParts.length > 0 ? notesParts.join("; ") : undefined,
          payload: { dataset: "tenders", rows },
        },
      };

      const parsed = OpportunityEnvelopeSchema.parse(envelope);

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(parsed, null, 2) },
        ],
        structuredContent: parsed as unknown as Record<string, unknown>,
      };
    },
  );
}
