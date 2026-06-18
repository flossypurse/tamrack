/**
 * `tamrack_environment` tool registration.
 *
 * Alberta environmental conditions — real-time feeds persisted as daily
 * snapshots and served from the stored copy.  Three datasets:
 *
 *   aqhi         — Air Quality Health Index readings by Alberta station.
 *                  Source: Environment and Climate Change Canada (ECCC)
 *                  api.weather.gc.ca real-time observations feed.
 *
 *   water_levels — Hydrometric (water level + discharge) readings by
 *                  Alberta station.  Source: ECCC hydrometric-realtime.
 *
 *   earthquakes  — Seismic events within the Alberta bounding box
 *                  (49–60°N, 120–110°W).  Source: USGS FDSN event API
 *                  (stable event IDs allow accumulation across runs).
 *
 * Honest scope: all three sources publish real-time point-in-time
 * readings.  The collector persists one daily snapshot so queries here
 * return the latest stored value — typically same-day — rather than a
 * live upstream call.  Wildfire counts are stored separately and exposed
 * only as a daily count summary (the upstream ArcGIS layer has no stable
 * per-fire identifier, so per-fire persistence would require synthetic
 * keys; a summary row is the honest representation of what can be stored
 * reliably).
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  readAQHI,
  readWaterLevels,
  readEarthquakes,
  readWildfireSummaries,
  type AQHIRow,
  type WaterRow,
  type EarthquakeRow,
  type WildfireDailyRow,
} from "@/lib/collect-environment";

import { SCHEMA_VERSION } from "../schemas";
import { updateToolEntry } from "../registry";
import { requireScopes } from "../lib/auth-context";

const TOOL_NAME = "tamrack_environment";
const REQUIRED_SCOPES = ["tamrack:regional:read"] as const;

const ENV_DATASETS = ["aqhi", "water_levels", "earthquakes"] as const;
type EnvDataset = (typeof ENV_DATASETS)[number];

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const EnvironmentInputShape = {
  dataset: z
    .enum(ENV_DATASETS)
    .default("aqhi")
    .describe(
      "Environment dataset. " +
        "aqhi = Air Quality Health Index by Alberta station (ECCC). " +
        "water_levels = hydrometric water-level and discharge readings by Alberta station (ECCC). " +
        "earthquakes = seismic events within the Alberta bounding box, from USGS (stable event IDs).",
    ),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD")
    .optional()
    .describe(
      "For aqhi and water_levels: specific snapshot date (YYYY-MM-DD). " +
        "Omit for the most recent stored snapshot.",
    ),
  days: z
    .number()
    .int()
    .min(1)
    .max(365)
    .optional()
    .describe(
      "For earthquakes: look-back window in days (default 30, max 365). " +
        "Ignored for aqhi and water_levels.",
    ),
  min_magnitude: z
    .number()
    .min(0)
    .max(10)
    .optional()
    .describe(
      "For earthquakes: minimum magnitude filter (e.g. 2.0). " +
        "Omit to return all stored events in the window.",
    ),
};

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

const AQHIRowSchema = z.object({
  snapshot_date: z.string(),
  location_id: z.string(),
  location_name: z.string(),
  aqhi: z.number(),
  observation_time: z.string(),
  latitude: z.number(),
  longitude: z.number(),
});

const WaterRowSchema = z.object({
  snapshot_date: z.string(),
  station_id: z.string(),
  station_name: z.string(),
  water_level: z.number().nullable(),
  discharge: z.number().nullable(),
  reading_time: z.string(),
  latitude: z.number(),
  longitude: z.number(),
});

const EarthquakeRowSchema = z.object({
  event_id: z.string(),
  snapshot_date: z.string(),
  magnitude: z.number(),
  location: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  depth_km: z.number(),
  event_time: z.string(),
  source: z.string(),
});

const WildfireDailyRowSchema = z.object({
  snapshot_date: z.string(),
  active_count: z.number(),
  total_size_ha: z.number(),
  out_of_control: z.number(),
  being_held: z.number(),
  under_control: z.number(),
});

// Payload union discriminated by dataset
const AQHIPayloadSchema = z.object({
  dataset: z.literal("aqhi"),
  rows: z.array(AQHIRowSchema),
  wildfire_summary: z.array(WildfireDailyRowSchema).optional(),
});
const WaterPayloadSchema = z.object({
  dataset: z.literal("water_levels"),
  rows: z.array(WaterRowSchema),
});
const EarthquakesPayloadSchema = z.object({
  dataset: z.literal("earthquakes"),
  rows: z.array(EarthquakeRowSchema),
});

const EnvironmentDataSchema = z.object({
  dataset: z.enum(ENV_DATASETS),
  source: z.string(),
  unit: z.string(),
  served_from: z.enum(["stored", "empty"]),
  notes: z.string().optional(),
  payload: z.discriminatedUnion("dataset", [
    AQHIPayloadSchema,
    WaterPayloadSchema,
    EarthquakesPayloadSchema,
  ]),
});

const EnvironmentEnvelopeSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  tool: z.literal(TOOL_NAME),
  source: z.string(),
  data: EnvironmentDataSchema,
});
type EnvironmentEnvelope = z.infer<typeof EnvironmentEnvelopeSchema>;

// ---------------------------------------------------------------------------
// Tool description + registry
// ---------------------------------------------------------------------------

const TOOL_DESCRIPTION =
  "Alberta environmental conditions — daily snapshots of real-time feeds. " +
  "Three datasets: " +
  "`aqhi` returns Air Quality Health Index readings by Alberta station (ECCC, latest stored snapshot); " +
  "`water_levels` returns hydrometric water-level and discharge by Alberta station (ECCC, latest stored snapshot); " +
  "`earthquakes` returns seismic events within the Alberta bounding box (USGS, accumulated by stable event ID). " +
  "Honest scope: these are daily snapshots of real-time feeds — the collector runs once per day so the " +
  "most recent reading is typically same-day. Wildfire data is not a separate dataset here because the " +
  "upstream ArcGIS layer has no stable per-fire identifier; the AQHI response includes a wildfire_summary " +
  "field (daily active-fire counts + area) as supplemental context.";

updateToolEntry(TOOL_NAME, {
  status: "live",
  parameters_summary:
    "dataset (enum: aqhi | water_levels | earthquakes; default aqhi); " +
    "date (YYYY-MM-DD, optional, for aqhi/water_levels); " +
    "days (int 1-365, optional, for earthquakes, default 30); " +
    "min_magnitude (float, optional, for earthquakes).",
  response_summary:
    "Envelope with data.payload. " +
    "aqhi: { rows: AQHIRow[], wildfire_summary?: WildfireDailyRow[] }. " +
    "water_levels: { rows: WaterRow[] }. " +
    "earthquakes: { rows: EarthquakeRow[] }. " +
    "served_from is 'stored' when rows exist, 'empty' when no snapshot has been collected yet.",
  indicators: [...ENV_DATASETS],
  example_invocations: [
    {
      description: "Current Alberta air quality by station.",
      arguments: { dataset: "aqhi" },
    },
    {
      description: "Alberta water levels for a specific date.",
      arguments: { dataset: "water_levels", date: "2026-06-10" },
    },
    {
      description: "Earthquakes in Alberta, last 90 days, magnitude 2.0+.",
      arguments: { dataset: "earthquakes", days: 90, min_magnitude: 2.0 },
    },
  ],
});

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerEnvironmentTool(server: McpServer): void {
  server.registerTool(
    TOOL_NAME,
    {
      title: "Tamrack — Environment (AQHI, water levels, earthquakes)",
      description: TOOL_DESCRIPTION,
      inputSchema: EnvironmentInputShape,
      annotations: {
        title: "Tamrack — Environment (AQHI, water levels, earthquakes)",
        readOnlyHint: true,
        openWorldHint: false,
        idempotentHint: true,
      },
    },
    async (args) => {
      requireScopes(REQUIRED_SCOPES);

      const dataset = args.dataset as EnvDataset;
      const notesParts: string[] = [];

      let aqhiRows: AQHIRow[] = [];
      let waterRows: WaterRow[] = [];
      let earthquakeRows: EarthquakeRow[] = [];
      let wildfireRows: WildfireDailyRow[] = [];

      if (dataset === "aqhi") {
        try {
          aqhiRows = await readAQHI(args.date);
        } catch (err) {
          notesParts.push(
            `aqhi read failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        try {
          wildfireRows = await readWildfireSummaries(30);
        } catch {
          // Non-fatal — wildfire is supplemental context
        }
      } else if (dataset === "water_levels") {
        try {
          waterRows = await readWaterLevels(args.date);
        } catch (err) {
          notesParts.push(
            `water_levels read failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      } else {
        // earthquakes
        try {
          earthquakeRows = await readEarthquakes(
            args.days ?? 30,
            args.min_magnitude,
          );
        } catch (err) {
          notesParts.push(
            `earthquakes read failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      const isEmpty =
        (dataset === "aqhi" && aqhiRows.length === 0) ||
        (dataset === "water_levels" && waterRows.length === 0) ||
        (dataset === "earthquakes" && earthquakeRows.length === 0);

      if (isEmpty) {
        notesParts.push(
          "no stored snapshot yet — the daily collector populates this feed",
        );
      }

      // Build payload
      type Payload =
        | { dataset: "aqhi"; rows: AQHIRow[]; wildfire_summary?: WildfireDailyRow[] }
        | { dataset: "water_levels"; rows: WaterRow[] }
        | { dataset: "earthquakes"; rows: EarthquakeRow[] };

      let payload: Payload;
      if (dataset === "aqhi") {
        payload = {
          dataset: "aqhi",
          rows: aqhiRows,
          ...(wildfireRows.length > 0 ? { wildfire_summary: wildfireRows } : {}),
        };
      } else if (dataset === "water_levels") {
        payload = { dataset: "water_levels", rows: waterRows };
      } else {
        payload = { dataset: "earthquakes", rows: earthquakeRows };
      }

      const sourceLabel =
        dataset === "earthquakes"
          ? "USGS FDSN Event API"
          : "Environment and Climate Change Canada (ECCC)";

      const unit =
        dataset === "aqhi"
          ? "AQHI index (1–10+)"
          : dataset === "water_levels"
            ? "metres / m³/s"
            : "Richter magnitude";

      const envelope: EnvironmentEnvelope = {
        schema_version: SCHEMA_VERSION,
        tool: TOOL_NAME,
        source: sourceLabel,
        data: {
          dataset,
          source: sourceLabel,
          unit,
          served_from: isEmpty ? "empty" : "stored",
          notes: notesParts.length > 0 ? notesParts.join("; ") : undefined,
          payload,
        },
      };

      const parsed = EnvironmentEnvelopeSchema.parse(envelope);

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(parsed, null, 2) },
        ],
        structuredContent: parsed as unknown as Record<string, unknown>,
      };
    },
  );
}
