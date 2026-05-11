/**
 * `alberta_municipality` tool registration.
 *
 * Returns a registry-backed summary card for a single Alberta municipality:
 * the registry entry's identifying fields (slug, name, region, population),
 * the list of wired-up data capabilities, and a cheap metrics snapshot when
 * the substrate can produce one. The metrics block is best-effort — any
 * individual fetcher that throws or returns empty downgrades that field to
 * null without taking the whole envelope down with it.
 *
 * Substrate provenance:
 *   - Registry: `src/lib/municipality-registry.ts` (`getMunicipality`).
 *   - Metrics:  `src/lib/municipality-data.ts`
 *                 (`fetchParcelCount`, `fetchVacantCount`, `fetchRecentPermits`).
 *
 * Tool input is the registry slug. The shared `MunicipalitySlugSchema` is
 * built once from `getLiveMunicipalities()` so invalid slugs never reach the
 * tool body — same pattern Parcel 3's `alberta_regional` follows.
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
  fetchParcelCount,
  fetchRecentPermits,
  fetchVacantCount,
} from "@/lib/municipality-data";

import {
  MunicipalitySlugSchema,
  SCHEMA_VERSION,
} from "../schemas";
import { updateToolEntry } from "../registry";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const MunicipalityInputShape = {
  slug: MunicipalitySlugSchema,
};

const CapabilitySchema = z.enum([
  "assessments",
  "permits",
  "businesses",
  "vacant_lots",
  "construction",
  "zoning",
  "development_stages",
  "dev_permits",
]);

const MunicipalityMetricsSchema = z.object({
  parcel_count: z.number().int().nonnegative().nullable(),
  vacant_count: z.number().int().nonnegative().nullable(),
  recent_permits_count: z.number().int().nonnegative().nullable(),
});
type MunicipalityMetrics = z.infer<typeof MunicipalityMetricsSchema>;

const AvailableDatasetSchema = z.object({
  capability: CapabilitySchema,
  endpoint_present: z.boolean(),
  endpoint_kind: z.enum(["FeatureServer", "MapServer"]).nullable(),
  endpoint_url: z.string().nullable(),
});

const MunicipalityDataSchema = z.object({
  slug: z.string(),
  name: z.string(),
  region: z.string(),
  region_label: z.string(),
  population: z.number().int().positive().nullable(),
  status: z.enum(["live", "planned"]),
  data_source: z.string(),
  description: z.string(),
  capabilities: z.array(CapabilitySchema),
  metrics: MunicipalityMetricsSchema,
  available_datasets: z.array(AvailableDatasetSchema),
});

const MunicipalityEnvelopeSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  tool: z.literal("alberta_municipality"),
  source: z.literal("alberta-pulse-registry"),
  data: MunicipalityDataSchema,
});
type MunicipalityEnvelope = z.infer<typeof MunicipalityEnvelopeSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map a capability flag onto the endpoint key that wires it up in the
 * registry. Mirrors the resolution logic in `municipality-data.ts` so the
 * `available_datasets[]` block reflects what the substrate would actually
 * try to fetch from.
 *
 * Returns the matching `ArcGISEndpoint` (or undefined) along with the key
 * for transparency.
 */
function endpointForCapability(
  config: MunicipalityConfig,
  capability: DataCapability,
): { kind: "FeatureServer" | "MapServer"; url: string } | null {
  const eps = config.endpoints;
  switch (capability) {
    case "assessments": {
      const ep = eps.assessments ?? eps.parcels;
      return ep ? { kind: ep.type, url: ep.url } : null;
    }
    case "permits": {
      const ep = eps.permits;
      return ep ? { kind: ep.type, url: ep.url } : null;
    }
    case "dev_permits": {
      const ep = eps.devPermits;
      return ep ? { kind: ep.type, url: ep.url } : null;
    }
    case "businesses": {
      const ep = eps.businesses;
      return ep ? { kind: ep.type, url: ep.url } : null;
    }
    case "vacant_lots": {
      const ep = eps.vacantLots;
      return ep ? { kind: ep.type, url: ep.url } : null;
    }
    case "construction": {
      const ep = eps.construction;
      return ep ? { kind: ep.type, url: ep.url } : null;
    }
    case "zoning": {
      const ep = eps.zoning ?? eps.landUse;
      return ep ? { kind: ep.type, url: ep.url } : null;
    }
    case "development_stages": {
      const ep = eps.developmentStages;
      return ep ? { kind: ep.type, url: ep.url } : null;
    }
  }
}

/**
 * Pull a small metrics snapshot. Each metric is independent — one failure
 * does not cascade. Network/HTTP errors are absorbed into `null`. This is
 * a discovery tool, not a primary data path: agents looking for canonical
 * counts should hit the typed real-estate / regional tools.
 */
async function buildMetrics(
  config: MunicipalityConfig,
): Promise<MunicipalityMetrics> {
  const hasAssessmentsOrParcels =
    config.capabilities.includes("assessments") ||
    Boolean(config.endpoints.parcels);
  const hasVacantLots = config.capabilities.includes("vacant_lots");
  const hasPermits =
    config.capabilities.includes("permits") ||
    config.capabilities.includes("dev_permits");

  const [parcelCountRaw, vacantCountRaw, recentPermitsRaw] = await Promise.all([
    hasAssessmentsOrParcels
      ? fetchParcelCount(config).catch(() => null)
      : Promise.resolve(null),
    hasVacantLots
      ? fetchVacantCount(config).catch(() => null)
      : Promise.resolve(null),
    hasPermits
      ? fetchRecentPermits(config, 25)
          .then((rows) => rows.length)
          .catch(() => null)
      : Promise.resolve(null),
  ]);

  return {
    parcel_count:
      typeof parcelCountRaw === "number" && Number.isFinite(parcelCountRaw)
        ? parcelCountRaw
        : null,
    vacant_count:
      typeof vacantCountRaw === "number" && Number.isFinite(vacantCountRaw)
        ? vacantCountRaw
        : null,
    recent_permits_count:
      typeof recentPermitsRaw === "number" && Number.isFinite(recentPermitsRaw)
        ? recentPermitsRaw
        : null,
  };
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

const TOOL_NAME = "alberta_municipality";

const TOOL_DESCRIPTION =
  "Registry-backed summary card for a single Alberta municipality. " +
  "Returns the registry entry (slug, name, region, population, capabilities) " +
  "plus a cheap snapshot of available datasets and best-effort metric counts " +
  "(parcel_count, vacant_count, recent_permits_count). Source: " +
  "src/lib/municipality-registry.ts. Use this when you need to know what a " +
  "municipality exposes before fanning out across alberta_real_estate or " +
  "alberta_regional.";

updateToolEntry(TOOL_NAME, {
  status: "live",
  parameters_summary:
    "slug (registry slug; same value space as MunicipalitySlugSchema in every other tool).",
  response_summary:
    "Envelope with schema_version, tool, source; data.{slug, name, region, region_label, population, status, data_source, description, capabilities[], metrics{parcel_count,vacant_count,recent_permits_count}, available_datasets[{capability, endpoint_present, endpoint_kind, endpoint_url}]}.",
  indicators: null,
  example_invocations: [
    {
      description: "Inspect what data is available for Edmonton.",
      arguments: { slug: "edmonton" },
    },
    {
      description: "Inspect what data is available for Strathcona County.",
      arguments: { slug: "strathcona" },
    },
  ],
});

export function registerMunicipalityTool(server: McpServer): void {
  server.registerTool(
    TOOL_NAME,
    {
      title: "Alberta Pulse — Municipality Summary",
      description: TOOL_DESCRIPTION,
      inputSchema: MunicipalityInputShape,
      annotations: {
        title: "Alberta Pulse — Municipality Summary",
        readOnlyHint: true,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    async (args) => {
      const slug = args.slug;
      const config = getMunicipality(slug);
      if (!config) {
        // Unreachable in practice: MunicipalitySlugSchema validates slugs at
        // the SDK layer against the live registry. If we ever do hit it,
        // throw — the SDK turns this into a clean JSON-RPC error.
        throw new Error(
          `alberta_municipality: registry has no entry for "${slug}"`,
        );
      }

      const metrics = await buildMetrics(config);

      const availableDatasets = config.capabilities.map((capability) => {
        const ep = endpointForCapability(config, capability);
        return {
          capability,
          endpoint_present: ep != null,
          endpoint_kind: ep?.kind ?? null,
          endpoint_url: ep?.url ?? null,
        };
      });

      const envelope: MunicipalityEnvelope = {
        schema_version: SCHEMA_VERSION,
        tool: TOOL_NAME,
        source: "alberta-pulse-registry",
        data: {
          slug: config.slug,
          name: config.name,
          region: config.region,
          region_label: REGION_LABELS[config.region] ?? config.region,
          population:
            typeof config.population === "number" && config.population > 0
              ? config.population
              : null,
          status: config.status,
          data_source: config.dataSource,
          description: config.description,
          capabilities: config.capabilities,
          metrics,
          available_datasets: availableDatasets,
        },
      };

      const parsed = MunicipalityEnvelopeSchema.parse(envelope);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(parsed, null, 2),
          },
        ],
        structuredContent: parsed as unknown as Record<string, unknown>,
      };
    },
  );
}
