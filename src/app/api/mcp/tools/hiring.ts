/**
 * `tamrack_hiring` tool registration.
 *
 * Latent-demand feed: Alberta hiring activity for manual-process roles
 * (dispatchers, admin assistants, bookkeepers, inventory/logistics clerks) that
 * signal automatable back-office work — a leading indicator of demand for
 * operations software. Sourced from Canada Job Bank monthly open data (ESDC,
 * Open Government Licence), accumulated in Postgres by the daily collector and
 * read here (no live CSV fetch).
 *
 * Honest scope (surfaced in the description): ESDC strips the employer name, so
 * this is an aggregate sector/geo/role hiring-strain signal — NOT a per-company
 * lead. Its value is momentum (month-over-month change) and which roles/sectors/
 * cities are heating up, which a buyer can pair with other signals to target.
 *
 * Dataset (1):
 *   - signals → the latest stored monthly summary: total Alberta postings, the
 *              Tier-B (automatable-role) count, breakdowns by NOC / NAICS sector
 *              / city, month-over-month momentum, and a sample of rows.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  readHiringSummary,
  type HiringSummaryDb,
} from "@/lib/data-sources-jobbank";

import { SCHEMA_VERSION } from "../schemas";
import { updateToolEntry } from "../registry";
import { requireScopes } from "../lib/auth-context";

const REQUIRED_SCOPES = ["tamrack:economy:read"] as const;

const HIRING_DATASETS = ["signals"] as const;

const HiringInputShape = {
  dataset: z
    .enum(HIRING_DATASETS)
    .default("signals")
    .describe(
      "Hiring dataset. signals = monthly Alberta hiring-strain summary (Tier-B automatable roles) from Canada Job Bank.",
    ),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "expected YYYY-MM")
    .optional()
    .describe("Data month (YYYY-MM). Defaults to the latest stored month."),
};

const NocRowSchema = z.object({
  code: z.string(),
  name: z.string(),
  count: z.number(),
  vacancies: z.number(),
});
const SectorRowSchema = z.object({ sector: z.string(), count: z.number() });
const CityRowSchema = z.object({ city: z.string(), count: z.number() });
const SampleRowSchema = z.object({
  jobTitle: z.string(),
  nocCode: z.string(),
  nocName: z.string(),
  city: z.string(),
  naicsSector: z.string(),
  firstPostingDate: z.string(),
  vacancyCount: z.number(),
});
const MomentumSchema = z
  .object({
    prevMonth: z.string(),
    prevTierB: z.number(),
    deltaPct: z.number(),
  })
  .nullable();

const HiringSummarySchema = z.object({
  month: z.string(),
  totalAlbertaPostings: z.number(),
  tierBPostings: z.number(),
  byNoc: z.array(NocRowSchema),
  bySector: z.array(SectorRowSchema),
  byCity: z.array(CityRowSchema),
  sampleRows: z.array(SampleRowSchema),
  momentum: MomentumSchema,
});

const HiringDataSchema = z.object({
  dataset: z.enum(HIRING_DATASETS),
  source: z.string(),
  unit: z.string(),
  served_from: z.enum(["upstream", "empty"]),
  notes: z.string().optional(),
  payload: z.object({
    dataset: z.literal("signals"),
    summary: HiringSummarySchema.nullable(),
  }),
});

const HiringEnvelopeSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  tool: z.literal("tamrack_hiring"),
  source: z.string(),
  data: HiringDataSchema,
});
type HiringEnvelope = z.infer<typeof HiringEnvelopeSchema>;

const TOOL_NAME = "tamrack_hiring";

const TOOL_DESCRIPTION =
  "Latent-demand feed — Alberta hiring activity for manual-process / automatable " +
  "back-office roles (dispatchers, admin assistants, bookkeepers, inventory and " +
  "logistics clerks), a leading indicator of demand for operations software. " +
  "Source: Canada Job Bank monthly open data (ESDC, Open Government Licence). " +
  "Dataset `signals` returns the latest stored month: total Alberta postings, " +
  "the Tier-B (automatable-role) count, breakdowns by NOC occupation, NAICS " +
  "sector, and city, month-over-month momentum, and a sample of rows. Honest " +
  "scope: ESDC strips the employer name, so this is an aggregate sector/geo/role " +
  "strain signal, not a per-company lead — the value is momentum and which " +
  "roles/sectors/cities are heating up.";

updateToolEntry(TOOL_NAME, {
  status: "live",
  parameters_summary:
    "dataset (enum: signals; default signals); optional month (YYYY-MM, defaults to latest stored).",
  response_summary:
    "Envelope with data.payload.summary: { month, totalAlbertaPostings, tierBPostings, byNoc[], bySector[], byCity[], momentum, sampleRows[] }. summary is null when no month has been collected yet.",
  indicators: [...HIRING_DATASETS],
  example_invocations: [
    {
      description: "Latest Alberta hiring-strain summary (automatable roles).",
      arguments: { dataset: "signals" },
    },
    {
      description: "Hiring summary for a specific month.",
      arguments: { dataset: "signals", month: "2026-05" },
    },
  ],
});

export function registerHiringTool(server: McpServer): void {
  server.registerTool(
    TOOL_NAME,
    {
      title: "Tamrack — Hiring signals (Job Bank)",
      description: TOOL_DESCRIPTION,
      inputSchema: HiringInputShape,
      annotations: {
        title: "Tamrack — Hiring signals (Job Bank)",
        readOnlyHint: true,
        openWorldHint: false,
        idempotentHint: true,
      },
    },
    async (args) => {
      requireScopes(REQUIRED_SCOPES);
      const notesParts: string[] = [];
      let summary: HiringSummaryDb | null = null;

      try {
        summary = await readHiringSummary(args.month);
      } catch (err) {
        console.warn(`[mcp:${TOOL_NAME}] read failed:`, err);
        notesParts.push(
          `hiring read threw: ${err instanceof Error ? err.message : String(err)}`,
        );
        summary = null;
      }

      if (summary == null) {
        notesParts.push(
          "no hiring month collected yet (the daily collector populates this)",
        );
      }

      const envelope: HiringEnvelope = {
        schema_version: SCHEMA_VERSION,
        tool: TOOL_NAME,
        source: "Canada Job Bank",
        data: {
          dataset: "signals",
          source: "Canada Job Bank monthly open data (ESDC, OGL-Canada)",
          unit: "postings",
          served_from: summary != null ? "upstream" : "empty",
          notes: notesParts.length > 0 ? notesParts.join("; ") : undefined,
          payload: { dataset: "signals", summary },
        },
      };

      const parsed = HiringEnvelopeSchema.parse(envelope);

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(parsed, null, 2) },
        ],
        structuredContent: parsed as unknown as Record<string, unknown>,
      };
    },
  );
}
