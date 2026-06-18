/**
 * `tamrack_safety` tool registration.
 *
 * Public safety signals for Alberta: Crime Severity Index (CSI) per
 * municipality from the Alberta Regional Dashboard, and Edmonton Fire
 * Rescue Services incident summaries by event type (Socrata SODA).
 * Both datasets are accumulated daily by the collector and read from
 * Postgres here (no live upstream fetch for stored datasets).
 *
 * Datasets (2 stored + 1 live):
 *   - crime_severity  → stored; CSI per municipality / period. Optional
 *                       `municipality` filter returns a time series for
 *                       that municipality; without it returns all ~340
 *                       municipalities (latest period per muni).
 *   - fire_incidents  → stored; Edmonton Fire Rescue summary by event
 *                       type for the most recent snapshot date.
 *   - alerts          → live; 511 Alberta road/emergency alerts fetched
 *                       at query time (ephemeral — not persisted).
 *
 * Honest scope: CSI values come from Alberta's Regional Dashboard which
 * publishes yearly snapshots; the most recent year may lag by 12–18 months.
 * Fire data covers Edmonton only (not province-wide). 511 alerts cover
 * Alberta provincial highways, not all roads.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  readCrimeSeverity,
  readFireByType,
  type CrimeSeverityRow,
  type FireByTypeRow,
} from "@/lib/collect-safety";
import { fetch511Alerts, type AlbertaAlert } from "@/lib/data-sources-fire";

import { SCHEMA_VERSION } from "../schemas";
import { updateToolEntry } from "../registry";
import { requireScopes } from "../lib/auth-context";

const REQUIRED_SCOPES = ["tamrack:regional:read"] as const;

const SAFETY_DATASETS = ["crime_severity", "fire_incidents", "alerts"] as const;

const SafetyInputShape = {
  dataset: z
    .enum(SAFETY_DATASETS)
    .default("crime_severity")
    .describe(
      "Safety dataset. crime_severity = Alberta municipal Crime Severity Index (stored, daily collect); fire_incidents = Edmonton Fire Rescue incident summary by event type (stored, daily collect); alerts = 511 Alberta road/emergency alerts (live fetch, ephemeral).",
    ),
  municipality: z
    .string()
    .optional()
    .describe(
      "For crime_severity: filter to a single municipality name (case-insensitive). Returns the full time series for that municipality. Omit to get the full provincial dataset.",
    ),
};

// ── Payload schemas ──────────────────────────────────────────────────────────

const CrimeSeverityRowSchema = z.object({
  municipality: z.string(),
  period: z.string(),
  csi: z.number(),
  unit: z.string(),
});

const FireByTypeRowSchema = z.object({
  snapshot_date: z.string(),
  event_type: z.string(),
  incident_count: z.number(),
  avg_duration_mins: z.number(),
});

const AlertRowSchema = z.object({
  id: z.string(),
  message: z.string(),
  notes: z.string(),
  startTime: z.number(),
  endTime: z.number(),
  regions: z.array(z.string()),
  highImportance: z.boolean(),
});

const SafetyPayloadSchema = z.union([
  z.object({
    dataset: z.literal("crime_severity"),
    rows: z.array(CrimeSeverityRowSchema),
  }),
  z.object({
    dataset: z.literal("fire_incidents"),
    rows: z.array(FireByTypeRowSchema),
  }),
  z.object({
    dataset: z.literal("alerts"),
    rows: z.array(AlertRowSchema),
  }),
]);

const SafetyDataSchema = z.object({
  dataset: z.enum(SAFETY_DATASETS),
  source: z.string(),
  unit: z.string(),
  served_from: z.enum(["stored", "live", "empty"]),
  notes: z.string().optional(),
  payload: SafetyPayloadSchema,
});

const SafetyEnvelopeSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  tool: z.literal("tamrack_safety"),
  source: z.string(),
  data: SafetyDataSchema,
});
type SafetyEnvelope = z.infer<typeof SafetyEnvelopeSchema>;

const TOOL_NAME = "tamrack_safety";

const TOOL_DESCRIPTION =
  "Public safety signals for Alberta: Crime Severity Index per municipality " +
  "(Alberta Regional Dashboard, accumulated daily) and Edmonton Fire Rescue " +
  "Services incident summaries by event type (City of Edmonton Socrata SODA, " +
  "accumulated daily). Dataset `crime_severity` returns stored CSI rows — " +
  "optionally filtered to a single municipality time series. Dataset " +
  "`fire_incidents` returns the latest stored snapshot of Edmonton Fire " +
  "incident counts and average duration by event type. Dataset `alerts` " +
  "returns live 511 Alberta road/emergency alerts fetched at query time " +
  "(ephemeral — not stored). Honest scope: CSI is yearly, may lag 12–18 " +
  "months; fire data covers Edmonton only; 511 alerts cover provincial " +
  "highways, not all roads.";

updateToolEntry(TOOL_NAME, {
  status: "live",
  parameters_summary:
    "dataset (enum: crime_severity | fire_incidents | alerts; default crime_severity); optional municipality (string, for crime_severity only — case-insensitive name filter).",
  response_summary:
    "Envelope with data.payload.rows. crime_severity → { municipality, period, csi, unit }[]; fire_incidents → { snapshot_date, event_type, incident_count, avg_duration_mins }[]; alerts → { id, message, notes, startTime, endTime, regions, highImportance }[]. rows is [] when nothing has been collected yet.",
  indicators: [...SAFETY_DATASETS],
  example_invocations: [
    {
      description: "All Alberta municipal Crime Severity Index (latest periods).",
      arguments: { dataset: "crime_severity" },
    },
    {
      description: "Crime Severity Index time series for Calgary.",
      arguments: { dataset: "crime_severity", municipality: "Calgary" },
    },
    {
      description: "Edmonton Fire Rescue incident summary by event type.",
      arguments: { dataset: "fire_incidents" },
    },
    {
      description: "Live 511 Alberta road/emergency alerts.",
      arguments: { dataset: "alerts" },
    },
  ],
});

export function registerSafetyTool(server: McpServer): void {
  server.registerTool(
    TOOL_NAME,
    {
      title: "Tamrack — Public Safety (crime + fire + alerts)",
      description: TOOL_DESCRIPTION,
      inputSchema: SafetyInputShape,
      annotations: {
        title: "Tamrack — Public Safety (crime + fire + alerts)",
        readOnlyHint: true,
        openWorldHint: false,
        idempotentHint: true,
      },
    },
    async (args) => {
      requireScopes(REQUIRED_SCOPES);
      const dataset = args.dataset ?? "crime_severity";
      const notesParts: string[] = [];

      let payload: z.infer<typeof SafetyPayloadSchema>;
      let rowCount = 0;
      let servedFrom: "stored" | "live" | "empty" = "stored";
      let sourceLabel: string;
      let unit: string;

      if (dataset === "crime_severity") {
        sourceLabel = "Alberta Regional Dashboard (Crime Severity Index, OGL-AB)";
        unit = "index";
        let rows: CrimeSeverityRow[] = [];
        try {
          rows = await readCrimeSeverity(args.municipality);
          rowCount = rows.length;
        } catch (err) {
          console.warn(`[mcp:${TOOL_NAME}] crime_severity read failed:`, err);
          notesParts.push(
            `crime_severity read threw: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        servedFrom = rowCount > 0 ? "stored" : "empty";
        if (rowCount === 0) {
          notesParts.push(
            "no crime severity rows stored yet (the daily collector populates this)",
          );
        }
        payload = { dataset: "crime_severity", rows };

      } else if (dataset === "fire_incidents") {
        sourceLabel =
          "City of Edmonton — Fire Rescue Services (Socrata SODA, OGL-Edmonton)";
        unit = "incidents";
        let rows: FireByTypeRow[] = [];
        try {
          rows = await readFireByType();
          rowCount = rows.length;
        } catch (err) {
          console.warn(`[mcp:${TOOL_NAME}] fire_incidents read failed:`, err);
          notesParts.push(
            `fire_incidents read threw: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        servedFrom = rowCount > 0 ? "stored" : "empty";
        if (rowCount === 0) {
          notesParts.push(
            "no fire incident rows stored yet (the daily collector populates this)",
          );
        }
        payload = { dataset: "fire_incidents", rows };

      } else {
        // alerts — live fetch, not stored
        sourceLabel = "511 Alberta (Alberta Transportation, live)";
        unit = "alerts";
        servedFrom = "live";
        let rows: AlbertaAlert[] = [];
        try {
          rows = await fetch511Alerts();
          rowCount = rows.length;
        } catch (err) {
          console.warn(`[mcp:${TOOL_NAME}] alerts live fetch failed:`, err);
          notesParts.push(
            `alerts fetch threw: ${err instanceof Error ? err.message : String(err)}`,
          );
          servedFrom = "empty";
        }
        if (rowCount === 0 && servedFrom === "live") {
          notesParts.push("no active 511 alerts at this time");
          servedFrom = "empty";
        }
        payload = { dataset: "alerts", rows };
      }

      const envelope: SafetyEnvelope = {
        schema_version: SCHEMA_VERSION,
        tool: TOOL_NAME,
        source: sourceLabel,
        data: {
          dataset,
          source: sourceLabel,
          unit,
          served_from: servedFrom,
          notes: notesParts.length > 0 ? notesParts.join("; ") : undefined,
          payload,
        },
      };

      const parsed = SafetyEnvelopeSchema.parse(envelope);

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(parsed, null, 2) },
        ],
        structuredContent: parsed as unknown as Record<string, unknown>,
      };
    },
  );
}
