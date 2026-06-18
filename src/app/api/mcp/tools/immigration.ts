/**
 * `tamrack_immigration` tool registration.
 *
 * Permanent-resident landings in Alberta from IRCC open data (Immigration,
 * Refugees and Citizenship Canada — Open Government Licence). The daily
 * collector accumulates the IRCC tab-separated downloads into Postgres; this
 * tool reads the stored rows (no live download at query time).
 *
 * Datasets (3):
 *   - timeseries  → total Alberta PR landings per year (all categories).
 *   - by_category → the most recent stored year broken down by immigration
 *                   category/component (Economic, Family, Refugee, …).
 *   - by_cma      → the most recent stored year for the Edmonton and Calgary
 *                   Census Metropolitan Areas.
 *
 * Honest scope: IRCC suppresses cells below 5 for privacy (counted as 0), so
 * small categories under-report; the value is provincial and metro PR-inflow
 * trend and mix, a leading indicator of labour-supply and housing demand.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  getImmigrationTimeSeries,
  getImmigrationByCategory,
  getImmigrationByCMA,
} from "@/lib/db";

import { SCHEMA_VERSION } from "../schemas";
import { updateToolEntry } from "../registry";
import { requireScopes } from "../lib/auth-context";

const REQUIRED_SCOPES = ["tamrack:economy:read"] as const;

const IMMIGRATION_DATASETS = ["timeseries", "by_category", "by_cma"] as const;

const ImmigrationInputShape = {
  dataset: z
    .enum(IMMIGRATION_DATASETS)
    .default("timeseries")
    .describe(
      "Immigration dataset. timeseries = Alberta PR landings per year; by_category = latest-year breakdown by immigration category; by_cma = latest-year totals for Edmonton and Calgary CMAs.",
    ),
  year: z
    .number()
    .int()
    .min(2000)
    .max(2100)
    .optional()
    .describe(
      "Pin by_category / by_cma to a specific year. Defaults to the latest stored year. Ignored by timeseries.",
    ),
};

const TimeSeriesRowSchema = z.object({
  year: z.number(),
  total: z.number(),
});
const CategoryRowSchema = z.object({
  year: z.number(),
  category: z.string(),
  total: z.number(),
});
const CmaRowSchema = z.object({
  year: z.number(),
  cma: z.string(),
  total: z.number(),
});

const ImmigrationPayloadSchema = z.union([
  z.object({
    dataset: z.literal("timeseries"),
    rows: z.array(TimeSeriesRowSchema),
  }),
  z.object({
    dataset: z.literal("by_category"),
    rows: z.array(CategoryRowSchema),
  }),
  z.object({
    dataset: z.literal("by_cma"),
    rows: z.array(CmaRowSchema),
  }),
]);

const ImmigrationDataSchema = z.object({
  dataset: z.enum(IMMIGRATION_DATASETS),
  source: z.string(),
  unit: z.string(),
  served_from: z.enum(["stored", "empty"]),
  notes: z.string().optional(),
  payload: ImmigrationPayloadSchema,
});

const ImmigrationEnvelopeSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  tool: z.literal("tamrack_immigration"),
  source: z.string(),
  data: ImmigrationDataSchema,
});
type ImmigrationEnvelope = z.infer<typeof ImmigrationEnvelopeSchema>;

const TOOL_NAME = "tamrack_immigration";

const TOOL_DESCRIPTION =
  "Permanent-resident landings in Alberta from IRCC open data (Immigration, " +
  "Refugees and Citizenship Canada, Open Government Licence), accumulated daily " +
  "into Tamrack's store. Dataset `timeseries` returns total Alberta PR landings " +
  "per year; `by_category` returns the latest stored year by immigration " +
  "category (Economic, Family, Refugee, …); `by_cma` returns the latest year for " +
  "the Edmonton and Calgary Census Metropolitan Areas. Optional `year` pins " +
  "by_category/by_cma to a specific year. Honest scope: IRCC suppresses cells " +
  "below 5 for privacy (counted as 0), so small categories under-report — the " +
  "value is provincial and metro PR-inflow trend and mix, a leading indicator of " +
  "labour supply and housing demand.";

updateToolEntry(TOOL_NAME, {
  status: "live",
  parameters_summary:
    "dataset (enum: timeseries | by_category | by_cma; default timeseries); optional year (int, defaults to latest stored; ignored by timeseries).",
  response_summary:
    "Envelope with data.payload.rows: timeseries → { year, total }[]; by_category → { year, category, total }[]; by_cma → { year, cma, total }[]. rows is [] when nothing has been collected yet.",
  indicators: [...IMMIGRATION_DATASETS],
  example_invocations: [
    {
      description: "Alberta PR landings per year.",
      arguments: { dataset: "timeseries" },
    },
    {
      description: "Latest-year PR landings by immigration category.",
      arguments: { dataset: "by_category" },
    },
    {
      description: "Edmonton and Calgary PR landings for a specific year.",
      arguments: { dataset: "by_cma", year: 2024 },
    },
  ],
});

export function registerImmigrationTool(server: McpServer): void {
  server.registerTool(
    TOOL_NAME,
    {
      title: "Tamrack — Immigration (IRCC PR landings)",
      description: TOOL_DESCRIPTION,
      inputSchema: ImmigrationInputShape,
      annotations: {
        title: "Tamrack — Immigration (IRCC PR landings)",
        readOnlyHint: true,
        openWorldHint: false,
        idempotentHint: true,
      },
    },
    async (args) => {
      requireScopes(REQUIRED_SCOPES);
      const dataset = args.dataset ?? "timeseries";
      const notesParts: string[] = [];

      let payload: z.infer<typeof ImmigrationPayloadSchema>;
      let rowCount = 0;

      try {
        if (dataset === "timeseries") {
          const rows = await getImmigrationTimeSeries("Alberta");
          const mapped = rows.map((r) => ({
            year: Number(r.year),
            total: Number(r.total),
          }));
          rowCount = mapped.length;
          payload = { dataset: "timeseries", rows: mapped };
        } else if (dataset === "by_category") {
          const rows = await getImmigrationByCategory("Alberta", args.year);
          rowCount = rows.length;
          payload = { dataset: "by_category", rows };
        } else {
          const rows = await getImmigrationByCMA(args.year);
          rowCount = rows.length;
          payload = { dataset: "by_cma", rows };
        }
      } catch (err) {
        console.warn(`[mcp:${TOOL_NAME}] read failed:`, err);
        notesParts.push(
          `immigration read threw: ${err instanceof Error ? err.message : String(err)}`,
        );
        payload =
          dataset === "timeseries"
            ? { dataset: "timeseries", rows: [] }
            : dataset === "by_category"
              ? { dataset: "by_category", rows: [] }
              : { dataset: "by_cma", rows: [] };
        rowCount = 0;
      }

      if (rowCount === 0) {
        notesParts.push(
          "no immigration rows stored yet (the daily collector populates this)",
        );
      }

      const envelope: ImmigrationEnvelope = {
        schema_version: SCHEMA_VERSION,
        tool: TOOL_NAME,
        source: "IRCC (Immigration, Refugees and Citizenship Canada)",
        data: {
          dataset,
          source: "IRCC permanent-resident open data (OGL-Canada)",
          unit: "landings",
          served_from: rowCount > 0 ? "stored" : "empty",
          notes: notesParts.length > 0 ? notesParts.join("; ") : undefined,
          payload,
        },
      };

      const parsed = ImmigrationEnvelopeSchema.parse(envelope);

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(parsed, null, 2) },
        ],
        structuredContent: parsed as unknown as Record<string, unknown>,
      };
    },
  );
}
