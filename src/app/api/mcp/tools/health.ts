/**
 * `tamrack_health` tool registration.
 *
 * Alberta population health indicators accumulated daily into Tamrack's
 * store from two open-data sources:
 *   - Alberta Regional Dashboard — life expectancy and births/deaths at the
 *     municipality level (multiple periods, breakdowns by gender or vital type).
 *   - Alberta Open Data (CKAN) — leading causes of death province-wide,
 *     annual, top 30 causes (2001–2022).
 *
 * Datasets (3):
 *   - life_expectancy  → municipality × period × gender rows from the
 *                        Regional Dashboard "Life Expectancy" indicator.
 *   - births_deaths    → municipality × period × type (Births/Deaths) rows
 *                        from the Regional Dashboard "Births and Deaths"
 *                        indicator.
 *   - causes_of_death  → province-wide annual ranking of the top causes of
 *                        death; defaults to the latest stored year.
 *
 * Honest scope: life_expectancy and births_deaths coverage depends on which
 * municipalities are present in the Alberta Regional Dashboard feed — not all
 * Alberta municipalities will appear. Requires tamrack:economy:read scope.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  readLifeExpectancy,
  readBirthsDeaths,
  readCausesOfDeath,
  type LifeExpectancyRow,
  type BirthsDeathsRow,
  type CauseOfDeathRow,
} from "@/lib/collect-health";

import { SCHEMA_VERSION } from "../schemas";
import { updateToolEntry } from "../registry";
import { requireScopes } from "../lib/auth-context";

const REQUIRED_SCOPES = ["tamrack:economy:read"] as const;

const HEALTH_DATASETS = ["life_expectancy", "births_deaths", "causes_of_death"] as const;

const HealthInputShape = {
  dataset: z
    .enum(HEALTH_DATASETS)
    .default("causes_of_death")
    .describe(
      "Health dataset. " +
        "life_expectancy = municipality-level life expectancy by gender (Regional Dashboard); " +
        "births_deaths = municipality-level births and deaths by type (Regional Dashboard); " +
        "causes_of_death = province-wide annual top-30 causes of death (Alberta Open Data).",
    ),
  municipality: z
    .string()
    .optional()
    .describe(
      "Filter life_expectancy and births_deaths to a single municipality name (e.g. 'Edmonton'). " +
        "Ignored by causes_of_death.",
    ),
  year: z
    .number()
    .int()
    .min(2000)
    .max(2100)
    .optional()
    .describe(
      "Pin causes_of_death to a specific year. Defaults to the latest stored year. " +
        "Ignored by life_expectancy and births_deaths.",
    ),
};

const LifeExpectancyRowSchema = z.object({
  municipality: z.string(),
  period: z.string(),
  gender: z.string(),
  value: z.number(),
});

const BirthsDeathsRowSchema = z.object({
  municipality: z.string(),
  period: z.string(),
  type: z.string(),
  value: z.number(),
});

const CauseOfDeathRowSchema = z.object({
  year: z.number(),
  cause: z.string(),
  total_deaths: z.number(),
  ranking: z.number(),
});

const HealthPayloadSchema = z.union([
  z.object({
    dataset: z.literal("life_expectancy"),
    rows: z.array(LifeExpectancyRowSchema),
  }),
  z.object({
    dataset: z.literal("births_deaths"),
    rows: z.array(BirthsDeathsRowSchema),
  }),
  z.object({
    dataset: z.literal("causes_of_death"),
    rows: z.array(CauseOfDeathRowSchema),
  }),
]);

const HealthDataSchema = z.object({
  dataset: z.enum(HEALTH_DATASETS),
  source: z.string(),
  unit: z.string(),
  served_from: z.enum(["stored", "empty"]),
  notes: z.string().optional(),
  payload: HealthPayloadSchema,
});

const HealthEnvelopeSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  tool: z.literal("tamrack_health"),
  source: z.string(),
  data: HealthDataSchema,
});
type HealthEnvelope = z.infer<typeof HealthEnvelopeSchema>;

const TOOL_NAME = "tamrack_health";

const TOOL_DESCRIPTION =
  "Alberta population health indicators from two open-data sources, " +
  "accumulated daily into Tamrack's store. Dataset `life_expectancy` returns " +
  "municipality-level life-expectancy rows by gender from the Alberta Regional " +
  "Dashboard; `births_deaths` returns municipality-level births and deaths by " +
  "type (Births/Deaths); `causes_of_death` returns the province-wide annual " +
  "top-30 ranking of causes of death from Alberta Open Data (CKAN), defaulting " +
  "to the latest stored year. Optional `municipality` filters the Regional " +
  "Dashboard datasets. Optional `year` pins causes_of_death. Honest scope: " +
  "Regional Dashboard coverage varies by municipality — not all Alberta " +
  "municipalities appear. Requires tamrack:economy:read scope.";

updateToolEntry(TOOL_NAME, {
  status: "live",
  parameters_summary:
    "dataset (enum: life_expectancy | births_deaths | causes_of_death; default causes_of_death); " +
    "optional municipality (string, filters life_expectancy / births_deaths); " +
    "optional year (int, pins causes_of_death; defaults to latest stored).",
  response_summary:
    "Envelope with data.payload.rows[]. " +
    "life_expectancy → { municipality, period, gender, value }[]; " +
    "births_deaths → { municipality, period, type, value }[]; " +
    "causes_of_death → { year, cause, total_deaths, ranking }[]. " +
    "rows is [] when no data has been collected yet.",
  indicators: [...HEALTH_DATASETS],
  example_invocations: [
    {
      description: "Province-wide top causes of death for the latest stored year.",
      arguments: { dataset: "causes_of_death" },
    },
    {
      description: "Top causes of death for a specific year.",
      arguments: { dataset: "causes_of_death", year: 2021 },
    },
    {
      description: "Life expectancy for all municipalities.",
      arguments: { dataset: "life_expectancy" },
    },
    {
      description: "Births and deaths for Edmonton.",
      arguments: { dataset: "births_deaths", municipality: "Edmonton" },
    },
  ],
});

export function registerHealthTool(server: McpServer): void {
  server.registerTool(
    TOOL_NAME,
    {
      title: "Tamrack — Health indicators (Alberta)",
      description: TOOL_DESCRIPTION,
      inputSchema: HealthInputShape,
      annotations: {
        title: "Tamrack — Health indicators (Alberta)",
        readOnlyHint: true,
        openWorldHint: false,
        idempotentHint: true,
      },
    },
    async (args) => {
      requireScopes(REQUIRED_SCOPES);
      const dataset = args.dataset ?? "causes_of_death";
      const notesParts: string[] = [];

      let payload: z.infer<typeof HealthPayloadSchema>;
      let rowCount = 0;

      try {
        if (dataset === "life_expectancy") {
          const rows: LifeExpectancyRow[] = await readLifeExpectancy(
            args.municipality ? { municipality: args.municipality } : undefined,
          );
          rowCount = rows.length;
          payload = { dataset: "life_expectancy", rows };
        } else if (dataset === "births_deaths") {
          const rows: BirthsDeathsRow[] = await readBirthsDeaths(
            args.municipality ? { municipality: args.municipality } : undefined,
          );
          rowCount = rows.length;
          payload = { dataset: "births_deaths", rows };
        } else {
          const rows: CauseOfDeathRow[] = await readCausesOfDeath(
            args.year !== undefined ? { year: args.year } : undefined,
          );
          rowCount = rows.length;
          payload = { dataset: "causes_of_death", rows };
        }
      } catch (err) {
        console.warn(`[mcp:${TOOL_NAME}] read failed:`, err);
        notesParts.push(
          `health read threw: ${err instanceof Error ? err.message : String(err)}`,
        );
        payload =
          dataset === "life_expectancy"
            ? { dataset: "life_expectancy", rows: [] }
            : dataset === "births_deaths"
              ? { dataset: "births_deaths", rows: [] }
              : { dataset: "causes_of_death", rows: [] };
        rowCount = 0;
      }

      if (rowCount === 0) {
        notesParts.push("no health rows stored yet (the daily collector populates this)");
      }

      const envelope: HealthEnvelope = {
        schema_version: SCHEMA_VERSION,
        tool: TOOL_NAME,
        source: "Alberta Open Data / Alberta Regional Dashboard",
        data: {
          dataset,
          source:
            dataset === "causes_of_death"
              ? "Alberta Open Data — Leading Causes of Death (OGL-Alberta)"
              : "Alberta Regional Dashboard (Government of Alberta)",
          unit: dataset === "life_expectancy" ? "years" : "count",
          served_from: rowCount > 0 ? "stored" : "empty",
          notes: notesParts.length > 0 ? notesParts.join("; ") : undefined,
          payload,
        },
      };

      const parsed = HealthEnvelopeSchema.parse(envelope);

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(parsed, null, 2) },
        ],
        structuredContent: parsed as unknown as Record<string, unknown>,
      };
    },
  );
}
