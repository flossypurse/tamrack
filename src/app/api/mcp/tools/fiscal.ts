/**
 * `tamrack_fiscal` tool registration.
 *
 * Government spending flows into and within Alberta, accumulated daily
 * by the collector and read here (no live fetch at query time).
 *
 * Sources (all open government data, Open Government Licence — Canada):
 *   - Alberta Government Grant Disclosure  open.alberta.ca CKAN
 *   - Federal Major Transfers to provinces  open.canada.ca CKAN
 *   - Federal Proactive Disclosure — Contracts (AB subset)  open.canada.ca
 *
 * Datasets (3):
 *   - grants     → stored Alberta provincial grant disclosure rows: fiscal
 *                  year, ministry, recipient, program, amount, description.
 *                  Optional fiscalYear filter. Ordered by amount descending.
 *   - transfers  → stored federal major transfers to Alberta (CHT, CST,
 *                  Equalization, etc.) by year and transfer type.
 *                  Optional year filter.
 *   - contracts  → stored federal proactive-disclosure contracts where the
 *                  delivery province is Alberta: vendor, department,
 *                  description, contract date, value.
 *
 * Honest scope: data is as fresh as the last collector run (updated daily).
 * Large CKAN CSVs are ingested in batches; the full historical corpus
 * accumulates across runs.  served_from is "stored" when rows exist,
 * "empty" when the collector has not run yet.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  readGrants,
  readTransfers,
  readContracts,
  type GrantRow,
  type TransferRow,
  type ContractRow,
} from "@/lib/collect-fiscal";

import { SCHEMA_VERSION } from "../schemas";
import { updateToolEntry } from "../registry";
import { requireScopes } from "../lib/auth-context";

const TOOL_NAME = "tamrack_fiscal";
const REQUIRED_SCOPES = ["tamrack:macro:read"] as const;

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const FISCAL_DATASETS = ["grants", "transfers", "contracts"] as const;

const FiscalInputShape = {
  dataset: z
    .enum(FISCAL_DATASETS)
    .default("transfers")
    .describe(
      "Fiscal dataset. grants = Alberta provincial grant disclosure (by ministry, recipient, program); " +
        "transfers = federal major transfers to Alberta (CHT, CST, Equalization etc.); " +
        "contracts = federal proactive-disclosure contracts delivered in Alberta.",
    ),
  fiscal_year: z
    .string()
    .regex(/^\d{4}(-\d{2})?$/, "expected YYYY or YYYY-YY")
    .optional()
    .describe(
      "Filter grants to a specific fiscal year (e.g. '2023' or '2023-24'). " +
        "Ignored by transfers and contracts.",
    ),
  year: z
    .number()
    .int()
    .min(2000)
    .max(2100)
    .optional()
    .describe(
      "Filter transfers to a specific calendar year. Ignored by grants and contracts.",
    ),
  limit: z
    .number()
    .int()
    .positive()
    .max(500)
    .optional()
    .describe("Maximum rows to return (1–500; default 200). Applies to grants and contracts."),
};

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

const GrantRowSchema = z.object({
  fiscalYear: z.string(),
  ministry: z.string(),
  recipient: z.string(),
  program: z.string(),
  amount: z.number(),
  description: z.string(),
});

const TransferRowSchema = z.object({
  year: z.number(),
  province: z.string(),
  transferType: z.string(),
  amount: z.number(),
});

const ContractRowSchema = z.object({
  vendor: z.string(),
  department: z.string(),
  description: z.string(),
  contractDate: z.string(),
  value: z.number(),
  province: z.string(),
});

const FiscalPayloadSchema = z.union([
  z.object({ dataset: z.literal("grants"),    rows: z.array(GrantRowSchema) }),
  z.object({ dataset: z.literal("transfers"), rows: z.array(TransferRowSchema) }),
  z.object({ dataset: z.literal("contracts"), rows: z.array(ContractRowSchema) }),
]);

const FiscalDataSchema = z.object({
  dataset: z.enum(FISCAL_DATASETS),
  source: z.string(),
  unit: z.string(),
  served_from: z.enum(["stored", "empty"]),
  notes: z.string().optional(),
  payload: FiscalPayloadSchema,
});

const FiscalEnvelopeSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  tool: z.literal(TOOL_NAME),
  source: z.string(),
  data: FiscalDataSchema,
});
type FiscalEnvelope = z.infer<typeof FiscalEnvelopeSchema>;

// ---------------------------------------------------------------------------
// Registry entry
// ---------------------------------------------------------------------------

updateToolEntry(TOOL_NAME, {
  status: "live",
  parameters_summary:
    "dataset (enum: grants | transfers | contracts; default transfers); " +
    "optional fiscal_year (YYYY or YYYY-YY, grants only); " +
    "optional year (int, transfers only); " +
    "optional limit (1–500, default 200; grants + contracts).",
  response_summary:
    "Envelope with data.payload.rows. grants → { fiscalYear, ministry, recipient, program, amount, description }[]; " +
    "transfers → { year, province, transferType, amount }[]; " +
    "contracts → { vendor, department, description, contractDate, value, province }[]. " +
    "rows is [] when nothing has been collected yet.",
  indicators: [...FISCAL_DATASETS],
  example_invocations: [
    {
      description: "Federal transfers to Alberta (all years).",
      arguments: { dataset: "transfers" },
    },
    {
      description: "Federal transfers to Alberta for a specific year.",
      arguments: { dataset: "transfers", year: 2024 },
    },
    {
      description: "Alberta provincial grant disclosure (top recipients by amount).",
      arguments: { dataset: "grants", limit: 50 },
    },
    {
      description: "Alberta grants for fiscal year 2023-24.",
      arguments: { dataset: "grants", fiscal_year: "2023-24", limit: 100 },
    },
    {
      description: "Federal contracts delivered in Alberta (most recent).",
      arguments: { dataset: "contracts", limit: 100 },
    },
  ],
});

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

const TOOL_DESCRIPTION =
  "Government spending flows into and within Alberta, accumulated daily and " +
  "served from Tamrack's store (no live fetch at query time). " +
  "Sources: Alberta Government Grant Disclosure (open.alberta.ca), " +
  "Federal Major Transfers (open.canada.ca), and Federal Proactive Disclosure " +
  "contracts where delivery province is Alberta. " +
  "Dataset `transfers` returns federal program payments to Alberta (CHT, CST, " +
  "Equalization, etc.) by year and transfer type — use optional `year` to pin " +
  "to a specific year. " +
  "Dataset `grants` returns Alberta provincial grant disclosure rows by ministry, " +
  "recipient, and program (ordered by amount descending) — use optional " +
  "`fiscal_year` (e.g. '2023-24') to filter and `limit` to cap the result. " +
  "Dataset `contracts` returns federal proactive-disclosure contract rows for " +
  "Alberta — vendor, department, description, date, and value. " +
  "Honest scope: data is as fresh as the last daily collector run; large " +
  "CKAN CSVs are ingested in batches, so the full historical corpus " +
  "accumulates across runs. " +
  "Scope required: tamrack:macro:read.";

export function registerFiscalTool(server: McpServer): void {
  server.registerTool(
    TOOL_NAME,
    {
      title: "Tamrack — Fiscal (grants, transfers, contracts)",
      description: TOOL_DESCRIPTION,
      inputSchema: FiscalInputShape,
      annotations: {
        title: "Tamrack — Fiscal (grants, transfers, contracts)",
        readOnlyHint: true,
        openWorldHint: false,
        idempotentHint: true,
      },
    },
    async (args) => {
      requireScopes(REQUIRED_SCOPES);

      const dataset = args.dataset ?? "transfers";
      const notesParts: string[] = [];

      let payload: z.infer<typeof FiscalPayloadSchema>;
      let rowCount = 0;

      try {
        if (dataset === "grants") {
          const rows: GrantRow[] = await readGrants({
            fiscalYear: args.fiscal_year,
            limit: args.limit,
          });
          rowCount = rows.length;
          payload = { dataset: "grants", rows };
        } else if (dataset === "transfers") {
          const rows: TransferRow[] = await readTransfers({ year: args.year });
          rowCount = rows.length;
          payload = { dataset: "transfers", rows };
        } else {
          const rows: ContractRow[] = await readContracts({ limit: args.limit });
          rowCount = rows.length;
          payload = { dataset: "contracts", rows };
        }
      } catch (err) {
        console.warn(`[mcp:${TOOL_NAME}] read failed:`, err);
        notesParts.push(
          `fiscal read threw: ${err instanceof Error ? err.message : String(err)}`,
        );
        payload =
          dataset === "grants"
            ? { dataset: "grants", rows: [] }
            : dataset === "transfers"
              ? { dataset: "transfers", rows: [] }
              : { dataset: "contracts", rows: [] };
        rowCount = 0;
      }

      if (rowCount === 0) {
        notesParts.push(
          "no fiscal rows stored yet (the daily collector populates this)",
        );
      }

      const sourceLabel =
        dataset === "grants"
          ? "Alberta Government Grant Disclosure (open.alberta.ca, OGL-Canada)"
          : dataset === "transfers"
            ? "Federal Major Transfers (open.canada.ca, OGL-Canada)"
            : "Federal Proactive Disclosure — Contracts (open.canada.ca, OGL-Canada)";

      const unitLabel =
        dataset === "grants"
          ? "CAD grant dollars"
          : dataset === "transfers"
            ? "CAD transfer dollars"
            : "CAD contract value";

      const envelope: FiscalEnvelope = {
        schema_version: SCHEMA_VERSION,
        tool: TOOL_NAME,
        source: "Government of Alberta / Government of Canada open data",
        data: {
          dataset,
          source: sourceLabel,
          unit: unitLabel,
          served_from: rowCount > 0 ? "stored" : "empty",
          notes: notesParts.length > 0 ? notesParts.join("; ") : undefined,
          payload,
        },
      };

      const parsed = FiscalEnvelopeSchema.parse(envelope);

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(parsed, null, 2) },
        ],
        structuredContent: parsed as unknown as Record<string, unknown>,
      };
    },
  );
}
