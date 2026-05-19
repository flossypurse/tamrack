/**
 * Catalog payload generator for the Alberta Pulse MCP server.
 *
 * `buildCatalog()` is the single function `tamrack_catalog` calls — it
 * reads from `registry.ts` (tool entries + domain descriptors) and from
 * `src/lib/municipality-registry.ts` (live municipalities). Nothing
 * about tool inventory is duplicated here; adding an entry to
 * `registry.ts` automatically shows up in the catalog with no other
 * change.
 *
 * The catalog is static metadata, not a live probe. It tells callers
 * what should be there; callers use `/api/health?deep=1` if they need
 * to know whether a specific upstream is currently reachable.
 */

import {
  getLiveMunicipalities,
  REGION_LABELS,
  type DataCapability,
  type MunicipalityConfig,
  type MunicipalityRegion,
} from "@/lib/municipality-registry";

import {
  getToolEntries,
  TOOL_DOMAINS,
  type ToolDomain,
  type ToolEntry,
  type ToolExample,
  type ToolStatus,
} from "./registry";
import { SCHEMA_VERSION } from "./schemas";
import { MCP_SERVER_INFO } from "./server";

// ---------------------------------------------------------------------------
// Public payload types
// ---------------------------------------------------------------------------

export interface CatalogToolEntry {
  name: string;
  status: ToolStatus;
  domain: ToolDomain;
  description: string;
  parameters_summary: string;
  response_summary: string;
  example_invocations: ToolExample[];
}

export interface CatalogDomainEntry {
  name: ToolDomain;
  description: string;
}

export interface CatalogMunicipality {
  slug: string;
  name: string;
  region: MunicipalityRegion;
  region_label: string;
  population: number | null;
  capabilities: DataCapability[];
  data_source: string;
  description: string;
}

export type CatalogIndicatorsByDomain = Partial<
  Record<
    ToolDomain,
    | { tool: string; indicators: string[] }
    | {
        tool: string;
        count_indicative: number;
        note: string;
      }
  >
>;

export interface CatalogPayload {
  schema_version: typeof SCHEMA_VERSION;
  generated_at: string;
  server: { name: string; version: string };
  tools: CatalogToolEntry[];
  domains: CatalogDomainEntry[];
  municipalities: CatalogMunicipality[];
  indicators_by_domain: CatalogIndicatorsByDomain;
  example_invocations: ToolExample[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toCatalogTool(entry: ToolEntry): CatalogToolEntry {
  return {
    name: entry.name,
    status: entry.status,
    domain: entry.domain,
    description: entry.description,
    parameters_summary: entry.parameters_summary,
    response_summary: entry.response_summary,
    example_invocations: entry.example_invocations,
  };
}

function toCatalogMunicipality(m: MunicipalityConfig): CatalogMunicipality {
  return {
    slug: m.slug,
    name: m.name,
    region: m.region,
    region_label: REGION_LABELS[m.region] ?? m.region,
    population: m.population ?? null,
    capabilities: m.capabilities,
    data_source: m.dataSource,
    description: m.description,
  };
}

function buildIndicatorsByDomain(
  entries: ToolEntry[],
): CatalogIndicatorsByDomain {
  const out: CatalogIndicatorsByDomain = {};
  for (const entry of entries) {
    // Skip domains with no indicator inventory (discovery, search,
    // municipality, deferred placeholders).
    if (entry.indicators === null) continue;
    // Skip deferred entries entirely — their inventory is "TBD" and
    // listing it adds noise.
    if (entry.status === "deferred") continue;

    if (Array.isArray(entry.indicators)) {
      out[entry.domain] = {
        tool: entry.name,
        indicators: entry.indicators,
      };
    } else {
      out[entry.domain] = {
        tool: entry.name,
        count_indicative: entry.indicators.count_indicative,
        note: entry.indicators.note,
      };
    }
  }
  return out;
}

// Top-level cross-tool examples. Tool-specific examples live on each
// `ToolEntry.example_invocations`. These exist so an agent calling the
// catalog gets a quick mental model of how to chain tools without
// reading every entry.
const CROSS_TOOL_EXAMPLES: ToolExample[] = [
  {
    description: "BoC policy rate over the last year (single macro call).",
    arguments: {
      tool: "tamrack_macro",
      arguments: { indicator: "policy_rate", time_range: "last_year" },
    },
  },
  {
    description:
      "Edmonton population from the regional dashboard (regional indicator + municipality).",
    arguments: {
      tool: "tamrack_regional",
      arguments: { indicator: "Population", municipality: "edmonton" },
    },
  },
  {
    description: "CMHC housing starts in Calgary over the last 5 years.",
    arguments: {
      tool: "tamrack_housing",
      arguments: {
        indicator: "starts",
        municipality: "calgary",
        time_range: "last_5y",
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Build the catalog payload. Pure function — no I/O, no upstream fetches.
 * Reads only from in-process module state (`registry.ts` +
 * `municipality-registry.ts`).
 */
export function buildCatalog(): CatalogPayload {
  const entries = getToolEntries();
  const live = getLiveMunicipalities();

  return {
    schema_version: SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    server: { name: MCP_SERVER_INFO.name, version: MCP_SERVER_INFO.version },
    tools: entries.map(toCatalogTool),
    domains: TOOL_DOMAINS.map((d) => ({
      name: d.name,
      description: d.description,
    })),
    municipalities: live.map(toCatalogMunicipality),
    indicators_by_domain: buildIndicatorsByDomain(entries),
    example_invocations: CROSS_TOOL_EXAMPLES,
  };
}
