/**
 * `tamrack_real_estate` tool registration.
 *
 * Per-municipality real estate datasets — assessments, permits, dev_permits —
 * keyed off the registry capability flags. v1 surfaces three datasets:
 *
 *   - dataset=assessments  → requires capability "assessments". Backed by
 *                            the generic `fetchTopProperties` /
 *                            `fetchAssessmentsByGroup` substrate fetchers,
 *                            which read endpoints + field maps from the
 *                            registry. Works for every muni whose registry
 *                            entry has either an `assessments` endpoint or a
 *                            `parcels` endpoint with `assessmentValue`
 *                            mapped.
 *
 *   - dataset=permits      → requires capability "permits". Backed by the
 *                            generic `fetchRecentPermits` substrate fetcher.
 *                            Returns the most recent `limit` permits.
 *
 *   - dataset=dev_permits  → requires capability "dev_permits". Backed by
 *                            city-specific substrate fetchers where they
 *                            exist (`fetchRecentResidentialDevPermits`,
 *                            `fetchStAlbertDevPermits`,
 *                            `fetchStrathconaResidentialPermits`), otherwise
 *                            falls back to the generic `fetchRecentPermits`
 *                            against the registry's `devPermits` endpoint.
 *
 * Availability contract:
 *   The brief is explicit: when the registry doesn't expose a given
 *   capability for the requested slug, the tool MUST return
 *   `{ available: false, reason: "..." }` instead of throwing. The MCP SDK
 *   turns thrown errors into JSON-RPC errors, which agents have to handle
 *   out-of-band; a structured `available: false` lets the agent decide what
 *   to do without leaving the envelope shape.
 *
 *   Note: registry status "planned" is a separate axis from capabilities. A
 *   "live" muni with no assessments capability still gets `available: false`.
 *   The MunicipalitySlugSchema gate already excludes non-live munis.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  getMunicipality,
  REGION_LABELS,
  type DataCapability,
  type MunicipalityConfig,
} from "@/lib/municipality-registry";
import {
  fetchAssessmentsByGroup,
  fetchPermitsByGroup,
  fetchRecentPermits,
  fetchTopProperties,
  type AssessmentByGroup,
  type PermitSummary,
  type RecentPermit,
  type TopProperty,
} from "@/lib/municipality-data";
import {
  fetchRecentResidentialDevPermits,
  fetchStAlbertDevPermits,
  fetchStrathconaResidentialPermits,
  type ResidentialDevPermit,
  type StAlbertDevPermit,
  type StrathconaPermit,
} from "@/lib/data-sources";

import {
  LimitSchema,
  MunicipalitySlugSchema,
  SCHEMA_VERSION,
  TimeRangeSchema,
  type TimeRange,
} from "../schemas";
import { clipByRange } from "../lib/time-range";
import { updateToolEntry } from "../registry";
import { requireScopes } from "../lib/auth-context";

const REQUIRED_SCOPES = ["tamrack:real-estate:read"] as const;

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const REAL_ESTATE_DATASETS = [
  "assessments",
  "permits",
  "dev_permits",
] as const;

type RealEstateDataset = (typeof REAL_ESTATE_DATASETS)[number];

const RealEstateDatasetSchema = z
  .enum(REAL_ESTATE_DATASETS)
  .describe(
    "Real estate dataset. 'assessments' (property assessments grouped + top-N), " +
      "'permits' (recent building permits), 'dev_permits' (recent development permits).",
  );

const RealEstateInputShape = {
  municipality: MunicipalitySlugSchema,
  dataset: RealEstateDatasetSchema,
  limit: LimitSchema.optional(),
  time_range: TimeRangeSchema.optional(),
};

// ── Row shapes per dataset (pass-through from the substrate where possible) ──

const TopPropertySchema = z.object({
  address: z.string(),
  assessment: z.number(),
  zoning: z.string(),
  neighbourhood: z.string(),
  yearBuilt: z.number(),
  salePrice: z.number(),
});

const AssessmentGroupSchema = z.object({
  group: z.string(),
  count: z.number().int().nonnegative(),
  avgAssessment: z.number(),
  minAssessment: z.number(),
  maxAssessment: z.number(),
});

const AssessmentsPayloadSchema = z.object({
  dataset: z.literal("assessments"),
  by_group: z.array(AssessmentGroupSchema),
  top_properties: z.array(TopPropertySchema),
});

const RecentPermitSchema = z.object({
  type: z.string(),
  address: z.string(),
  date: z.string(),
  value: z.number(),
  description: z.string(),
  municipality: z.string(),
});

const PermitGroupSchema = z.object({
  group: z.string(),
  count: z.number().int().nonnegative(),
  totalValue: z.number(),
});

const PermitsPayloadSchema = z.object({
  dataset: z.literal("permits"),
  recent: z.array(RecentPermitSchema),
  by_group: z.array(PermitGroupSchema),
});

// dev_permits rows are city-shaped: each city's substrate fetcher returns a
// different schema. Rather than coercing into a lossy common shape we keep a
// discriminated union and let the agent branch on `shape`.
const EdmontonDevPermitSchema = z.object({
  shape: z.literal("edmonton"),
  address: z.string(),
  neighbourhood: z.string(),
  neighbourhoodClass: z.string(),
  description: z.string(),
  date: z.string(),
  status: z.string(),
  zoning: z.string(),
});

const StAlbertDevPermitSchema = z.object({
  shape: z.literal("st-albert"),
  address: z.string(),
  type: z.string(),
  subject: z.string(),
  status: z.string(),
  date: z.string(),
});

const StrathconaDevPermitSchema = z.object({
  shape: z.literal("strathcona"),
  fileNum: z.string(),
  description: z.string(),
  subdivision: z.string(),
  address: z.string(),
  status: z.string(),
  value: z.number(),
  units: z.string(),
  date: z.string(),
});

const GenericDevPermitSchema = z.object({
  shape: z.literal("generic"),
  type: z.string(),
  address: z.string(),
  date: z.string(),
  value: z.number(),
  description: z.string(),
  municipality: z.string(),
});

const DevPermitRowSchema = z.discriminatedUnion("shape", [
  EdmontonDevPermitSchema,
  StAlbertDevPermitSchema,
  StrathconaDevPermitSchema,
  GenericDevPermitSchema,
]);

const DevPermitsPayloadSchema = z.object({
  dataset: z.literal("dev_permits"),
  shape: z.enum(["edmonton", "st-albert", "strathcona", "generic"]),
  rows: z.array(DevPermitRowSchema),
});

// ── Envelope ────────────────────────────────────────────────────────────────

const UnavailablePayloadSchema = z.object({
  available: z.literal(false),
  reason: z.string(),
});

const AvailablePayloadSchema = z.object({
  available: z.literal(true),
  municipality: z.object({
    slug: z.string(),
    name: z.string(),
    region: z.string(),
    region_label: z.string(),
  }),
  dataset: RealEstateDatasetSchema,
  source: z.string(),
  payload: z.union([
    AssessmentsPayloadSchema,
    PermitsPayloadSchema,
    DevPermitsPayloadSchema,
  ]),
});

const RealEstateDataSchema = z.union([
  AvailablePayloadSchema,
  UnavailablePayloadSchema,
]);

const RealEstateEnvelopeSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  tool: z.literal("tamrack_real_estate"),
  source: z.literal("tamrack-substrate"),
  data: RealEstateDataSchema,
});
type RealEstateEnvelope = z.infer<typeof RealEstateEnvelopeSchema>;

// ---------------------------------------------------------------------------
// Capability gating
// ---------------------------------------------------------------------------

const DATASET_CAPABILITY: Record<RealEstateDataset, DataCapability> = {
  assessments: "assessments",
  permits: "permits",
  dev_permits: "dev_permits",
};

interface CapabilityCheck {
  available: boolean;
  reason: string;
}

function checkCapability(
  config: MunicipalityConfig,
  dataset: RealEstateDataset,
): CapabilityCheck {
  const required = DATASET_CAPABILITY[dataset];
  if (!config.capabilities.includes(required)) {
    return {
      available: false,
      reason: `municipality "${config.slug}" does not expose capability "${required}" — registry capabilities=[${config.capabilities.join(", ") || "none"}]`,
    };
  }
  // Capability is asserted; confirm the corresponding endpoint(s) are
  // wired up too. A registry entry with a capability flag but no matching
  // endpoint is a bug in the registry, but we still surface it cleanly.
  switch (dataset) {
    case "assessments": {
      const ep = config.endpoints.assessments ?? config.endpoints.parcels;
      if (!ep || !config.fields.assessmentValue) {
        return {
          available: false,
          reason: `municipality "${config.slug}" lists assessments capability but has no assessments/parcels endpoint or assessmentValue field`,
        };
      }
      return { available: true, reason: "" };
    }
    case "permits": {
      if (!config.endpoints.permits) {
        return {
          available: false,
          reason: `municipality "${config.slug}" lists permits capability but has no permits endpoint`,
        };
      }
      return { available: true, reason: "" };
    }
    case "dev_permits": {
      if (!config.endpoints.devPermits) {
        return {
          available: false,
          reason: `municipality "${config.slug}" lists dev_permits capability but has no devPermits endpoint`,
        };
      }
      return { available: true, reason: "" };
    }
  }
}

// ---------------------------------------------------------------------------
// Per-dataset fetchers
// ---------------------------------------------------------------------------

interface AssessmentsResult {
  by_group: AssessmentByGroup[];
  top_properties: TopProperty[];
}

async function fetchAssessmentsPayload(
  config: MunicipalityConfig,
  limit: number,
): Promise<AssessmentsResult> {
  const [byGroup, top] = await Promise.all([
    fetchAssessmentsByGroup(config, "zoning").catch(() => [] as AssessmentByGroup[]),
    fetchTopProperties(config, limit).catch(() => [] as TopProperty[]),
  ]);
  return { by_group: byGroup, top_properties: top };
}

interface PermitsResult {
  recent: RecentPermit[];
  by_group: PermitSummary[];
}

async function fetchPermitsPayload(
  config: MunicipalityConfig,
  limit: number,
  range: TimeRange | undefined,
): Promise<PermitsResult> {
  const [recent, byGroup] = await Promise.all([
    fetchRecentPermits(config, limit).catch(() => [] as RecentPermit[]),
    fetchPermitsByGroup(config).catch(() => [] as PermitSummary[]),
  ]);
  return {
    recent: clipByRange(recent, range),
    by_group: byGroup,
  };
}

type DevPermitShape = "edmonton" | "st-albert" | "strathcona" | "generic";

type DevPermitRow = z.infer<typeof DevPermitRowSchema>;

interface DevPermitsResult {
  shape: DevPermitShape;
  rows: DevPermitRow[];
}

async function fetchDevPermitsPayload(
  config: MunicipalityConfig,
  limit: number,
  range: TimeRange | undefined,
): Promise<DevPermitsResult> {
  // City-specific shapes where the substrate has dedicated fetchers. These
  // expose richer fields than the generic ArcGIS query path does, so we
  // prefer them and tag the shape so the agent can branch.
  if (config.slug === "edmonton") {
    const rows = clipByRange(
      await fetchRecentResidentialDevPermits(limit).catch(
        () => [] as ResidentialDevPermit[],
      ),
      range,
    )
      .map(
        (r): DevPermitRow => ({
          shape: "edmonton",
          address: r.address,
          neighbourhood: r.neighbourhood,
          neighbourhoodClass: r.neighbourhoodClass,
          description: r.description,
          date: r.date,
          status: r.status,
          zoning: r.zoning,
        }),
      );
    return { shape: "edmonton", rows };
  }
  if (config.slug === "st-albert") {
    const rows = clipByRange(
      await fetchStAlbertDevPermits(limit).catch(
        () => [] as StAlbertDevPermit[],
      ),
      range,
    )
      .map(
        (r): DevPermitRow => ({
          shape: "st-albert",
          address: r.address,
          type: r.type,
          subject: r.subject,
          status: r.status,
          date: r.date,
        }),
      );
    return { shape: "st-albert", rows };
  }
  if (config.slug === "strathcona") {
    const rows = clipByRange(
      await fetchStrathconaResidentialPermits(limit).catch(
        () => [] as StrathconaPermit[],
      ),
      range,
    )
      .map(
        (r): DevPermitRow => ({
          shape: "strathcona",
          fileNum: r.fileNum,
          description: r.description,
          subdivision: r.subdivision,
          address: r.address,
          status: r.status,
          value: r.value,
          units: r.units,
          date: r.date,
        }),
      );
    return { shape: "strathcona", rows };
  }

  // Generic fallback: any muni whose registry entry has a devPermits
  // endpoint + the relevant field mappings gets a best-effort query via
  // `fetchRecentPermits` (which prefers `devPermits` over `permits` when
  // both exist — see municipality-data.ts).
  const rows = clipByRange(
    await fetchRecentPermits(config, limit).catch(() => [] as RecentPermit[]),
    range,
  )
    .map(
      (r): DevPermitRow => ({
        shape: "generic",
        type: r.type,
        address: r.address,
        date: r.date,
        value: r.value,
        description: r.description,
        municipality: r.municipality,
      }),
    );
  return { shape: "generic", rows };
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

const TOOL_NAME = "tamrack_real_estate";

const TOOL_DESCRIPTION =
  "Municipal real estate datasets — property assessments, building permits, " +
  "and development permits — for Alberta municipalities whose registry " +
  "entries wire up the relevant ArcGIS / Socrata endpoints. Coverage varies " +
  "by municipality. When a requested dataset isn't supported for the given " +
  "slug, the tool returns `{ available: false, reason }` rather than " +
  "throwing — agents can branch on that cleanly. Source: " +
  "src/lib/municipality-registry.ts + src/lib/municipality-data.ts + " +
  "city-specific fetchers in src/lib/data-sources.ts.";

updateToolEntry(TOOL_NAME, {
  status: "live",
  parameters_summary:
    "municipality (registry slug); dataset (one of: assessments, permits, dev_permits); optional limit (1..1000, default 25); optional time_range (named bucket or {from,to}; clipped to a real window relative to the latest dated row).",
  response_summary:
    "Envelope with schema_version, tool, source; data is either {available:false, reason} or {available:true, municipality{slug,name,region,region_label}, dataset, source, payload{...}}. Payload shape depends on dataset: assessments→{by_group[], top_properties[]}; permits→{recent[], by_group[]}; dev_permits→{shape, rows[]} where shape∈{edmonton,st-albert,strathcona,generic}.",
  indicators: [...REAL_ESTATE_DATASETS],
  example_invocations: [
    {
      description:
        "Top-25 residential assessments + by-zoning groups for Edmonton.",
      arguments: {
        municipality: "edmonton",
        dataset: "assessments",
        limit: 25,
      },
    },
    {
      description: "Recent building permits in Calgary.",
      arguments: {
        municipality: "calgary",
        dataset: "permits",
        limit: 25,
      },
    },
    {
      description: "Recent residential development permits in St. Albert.",
      arguments: {
        municipality: "st-albert",
        dataset: "dev_permits",
        limit: 25,
      },
    },
  ],
});

export function registerRealEstateTool(server: McpServer): void {
  server.registerTool(
    TOOL_NAME,
    {
      title: "Tamrack — Real Estate Datasets",
      description: TOOL_DESCRIPTION,
      inputSchema: RealEstateInputShape,
      annotations: {
        title: "Tamrack — Real Estate Datasets",
        readOnlyHint: true,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    async (args) => {
      requireScopes(REQUIRED_SCOPES);
      const slug = args.municipality;
      const dataset = args.dataset;
      const limit = args.limit ?? 25;
      const timeRange = args.time_range;

      const config = getMunicipality(slug);
      if (!config) {
        const envelope: RealEstateEnvelope = {
          schema_version: SCHEMA_VERSION,
          tool: TOOL_NAME,
          source: "tamrack-substrate",
          data: {
            available: false,
            reason: `unknown municipality slug "${slug}"`,
          },
        };
        const parsed = RealEstateEnvelopeSchema.parse(envelope);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(parsed, null, 2) },
          ],
          structuredContent: parsed as unknown as Record<string, unknown>,
        };
      }

      const cap = checkCapability(config, dataset);
      if (!cap.available) {
        const envelope: RealEstateEnvelope = {
          schema_version: SCHEMA_VERSION,
          tool: TOOL_NAME,
          source: "tamrack-substrate",
          data: {
            available: false,
            reason: cap.reason,
          },
        };
        const parsed = RealEstateEnvelopeSchema.parse(envelope);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(parsed, null, 2) },
          ],
          structuredContent: parsed as unknown as Record<string, unknown>,
        };
      }

      const muniBlock = {
        slug: config.slug,
        name: config.name,
        region: config.region,
        region_label: REGION_LABELS[config.region] ?? config.region,
      };

      let envelope: RealEstateEnvelope;

      try {
        if (dataset === "assessments") {
          const result = await fetchAssessmentsPayload(config, limit);
          envelope = {
            schema_version: SCHEMA_VERSION,
            tool: TOOL_NAME,
            source: "tamrack-substrate",
            data: {
              available: true,
              municipality: muniBlock,
              dataset,
              source: config.dataSource,
              payload: {
                dataset: "assessments",
                by_group: result.by_group,
                top_properties: result.top_properties,
              },
            },
          };
        } else if (dataset === "permits") {
          const result = await fetchPermitsPayload(config, limit, timeRange);
          envelope = {
            schema_version: SCHEMA_VERSION,
            tool: TOOL_NAME,
            source: "tamrack-substrate",
            data: {
              available: true,
              municipality: muniBlock,
              dataset,
              source: config.dataSource,
              payload: {
                dataset: "permits",
                recent: result.recent,
                by_group: result.by_group,
              },
            },
          };
        } else {
          const result = await fetchDevPermitsPayload(
            config,
            limit,
            timeRange,
          );
          envelope = {
            schema_version: SCHEMA_VERSION,
            tool: TOOL_NAME,
            source: "tamrack-substrate",
            data: {
              available: true,
              municipality: muniBlock,
              dataset,
              source: config.dataSource,
              payload: {
                dataset: "dev_permits",
                shape: result.shape,
                rows: result.rows,
              },
            },
          };
        }
      } catch (err) {
        // The substrate fetchers all swallow their own errors and return
        // empty arrays, so reaching here means something further upstream
        // threw (e.g., a registry mutation mid-request). Degrade to
        // available:false with the error string rather than letting the
        // SDK convert this into a JSON-RPC error.
        console.warn(
          `[mcp:${TOOL_NAME}] unexpected throw for ${slug}/${dataset}:`,
          err,
        );
        envelope = {
          schema_version: SCHEMA_VERSION,
          tool: TOOL_NAME,
          source: "tamrack-substrate",
          data: {
            available: false,
            reason: `substrate fetcher threw for ${slug}/${dataset}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          },
        };
      }

      const parsed = RealEstateEnvelopeSchema.parse(envelope);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(parsed, null, 2) },
        ],
        structuredContent: parsed as unknown as Record<string, unknown>,
      };
    },
  );
}
