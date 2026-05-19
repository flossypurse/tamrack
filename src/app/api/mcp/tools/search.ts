/**
 * `tamrack_search` tool registration.
 *
 * Long-tail escape hatch over the Alberta CKAN catalogue at
 * open.alberta.ca. Wraps `searchAlbertaDatasets(query, rows)` from
 * `src/lib/data-sources.ts`, which proxies to CKAN's
 * `/api/3/action/package_search` endpoint.
 *
 * CKAN payload shape:
 *   The CKAN action wire format is `{ success, help, result: { count,
 *   results: [...] } }`. Individual dataset records carry dozens of
 *   fields with varying presence (`id`, `name`, `title`, `notes`,
 *   `organization`, `metadata_modified`, `tags`, `resources`, etc.).
 *   Rather than over-constraining to a normalised subset, we pass
 *   through a curated set of the high-signal fields per result while
 *   keeping the raw `count` from CKAN for paging context.
 *
 * Fallback policy:
 *   CKAN is upstream-only; there's no `data-fallback.ts` entry for
 *   search. If the CKAN response is missing the expected shape or the
 *   fetch throws, the tool returns an envelope with `served_from:
 *   "empty"` and zero results, plus a note describing the failure mode.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { searchAlbertaDatasets } from "@/lib/data-sources";

import { SCHEMA_VERSION } from "../schemas";
import { updateToolEntry } from "../registry";
import { requireScopes } from "../lib/auth-context";

// Search is a long-tail discovery surface over Alberta CKAN. Treated as
// economy-domain because the bulk of CKAN packages are economy/fiscal
// datasets; revisit if/when CKAN coverage skews elsewhere.
const REQUIRED_SCOPES = ["tamrack:economy:read"] as const;

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const QuerySchema = z
  .string()
  .min(1, "query must be non-empty")
  .max(200, "query is capped at 200 characters")
  .describe(
    "Free-text search query forwarded to CKAN package_search. Non-empty; max 200 characters.",
  );

const SearchLimitSchema = z
  .number()
  .int()
  .positive()
  .max(50)
  .describe("Maximum results to return (1..50). Default 10.");

const SearchInputShape = {
  query: QuerySchema,
  limit: SearchLimitSchema.optional(),
};

const ResourceSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  format: z.string().optional(),
  url: z.string().optional(),
  description: z.string().optional(),
});

const TagSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  display_name: z.string().optional(),
});

const OrganizationSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  title: z.string().optional(),
});

const SearchHitSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string(),
  notes: z.string(),
  metadata_created: z.string().optional(),
  metadata_modified: z.string().optional(),
  organization: OrganizationSchema.nullable(),
  tags: z.array(TagSchema),
  resources: z.array(ResourceSchema),
  num_resources: z.number().optional(),
  license_title: z.string().optional(),
});

const SearchDataSchema = z.object({
  query: z.string(),
  source: z.literal("open.alberta.ca CKAN"),
  served_from: z.enum(["upstream", "fallback", "empty"]),
  notes: z.string().optional(),
  count: z.number().int().nonnegative(),
  results: z.array(SearchHitSchema),
});

const SearchEnvelopeSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  tool: z.literal("tamrack_search"),
  source: z.literal("open.alberta.ca CKAN"),
  data: SearchDataSchema,
});
type SearchEnvelope = z.infer<typeof SearchEnvelopeSchema>;

// ---------------------------------------------------------------------------
// Coercion from raw CKAN payload to our typed envelope
// ---------------------------------------------------------------------------

type RawCkanResult = Record<string, unknown>;

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asOptString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function normaliseResource(raw: unknown): z.infer<typeof ResourceSchema> {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: asOptString(r.id),
    name: asOptString(r.name),
    format: asOptString(r.format),
    url: asOptString(r.url),
    description: asOptString(r.description),
  };
}

function normaliseTag(raw: unknown): z.infer<typeof TagSchema> {
  const t = (raw ?? {}) as Record<string, unknown>;
  return {
    id: asOptString(t.id),
    name: asOptString(t.name),
    display_name: asOptString(t.display_name),
  };
}

function normaliseOrg(
  raw: unknown,
): z.infer<typeof OrganizationSchema> | null {
  if (raw == null) return null;
  const o = raw as Record<string, unknown>;
  return {
    id: asOptString(o.id),
    name: asOptString(o.name),
    title: asOptString(o.title),
  };
}

function normaliseHit(raw: RawCkanResult): z.infer<typeof SearchHitSchema> {
  const resources = Array.isArray(raw.resources)
    ? raw.resources.map(normaliseResource)
    : [];
  const tags = Array.isArray(raw.tags) ? raw.tags.map(normaliseTag) : [];
  return {
    id: asString(raw.id),
    name: asString(raw.name),
    title: asString(raw.title),
    notes: asString(raw.notes),
    metadata_created: asOptString(raw.metadata_created),
    metadata_modified: asOptString(raw.metadata_modified),
    organization: normaliseOrg(raw.organization),
    tags,
    resources,
    num_resources:
      typeof raw.num_resources === "number" ? raw.num_resources : undefined,
    license_title: asOptString(raw.license_title),
  };
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

const TOOL_NAME = "tamrack_search";

const TOOL_DESCRIPTION =
  "Long-tail escape hatch — searches the Alberta CKAN catalogue " +
  "(open.alberta.ca) for datasets the typed Tamrack tools don't " +
  "expose. Use when none of the tamrack_macro / tamrack_regional / " +
  "tamrack_real_estate / tamrack_housing / tamrack_business / " +
  "tamrack_energy surfaces fit your need. Returns ranked dataset records " +
  "(id, name, title, notes, organisation, tags, resources, dates). The " +
  "raw CKAN payload is normalised into a stable typed envelope; agents " +
  "follow up by hitting the resource URLs directly. Source: " +
  "open.alberta.ca CKAN action API.";

updateToolEntry(TOOL_NAME, {
  status: "live",
  parameters_summary:
    "query (free-text string, 1..200 chars); optional limit (1..50, default 10).",
  response_summary:
    "Envelope with schema_version, tool, source='open.alberta.ca CKAN'; data.{query, source, served_from, count, results[]}. Each result carries {id, name, title, notes, metadata_created, metadata_modified, organization{id,name,title}, tags[{id,name,display_name}], resources[{id,name,format,url,description}], num_resources, license_title}.",
  indicators: null,
  example_invocations: [
    {
      description: "Find Alberta open datasets about wildfire suppression.",
      arguments: { query: "wildfire suppression" },
    },
    {
      description: "Search for Edmonton housing-related datasets.",
      arguments: { query: "housing", limit: 25 },
    },
  ],
});

export function registerSearchTool(server: McpServer): void {
  server.registerTool(
    TOOL_NAME,
    {
      title: "Tamrack — CKAN Dataset Search",
      description: TOOL_DESCRIPTION,
      inputSchema: SearchInputShape,
      annotations: {
        title: "Tamrack — CKAN Dataset Search",
        readOnlyHint: true,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    async (args) => {
      requireScopes(REQUIRED_SCOPES);
      const query = args.query;
      const limit = args.limit ?? 10;

      let results: z.infer<typeof SearchHitSchema>[] = [];
      let count = 0;
      let servedFrom: "upstream" | "fallback" | "empty" = "empty";
      let notes: string | undefined;

      try {
        const raw = (await searchAlbertaDatasets(query, limit)) as
          | {
              success?: boolean;
              result?: { count?: number; results?: RawCkanResult[] };
            }
          | null
          | undefined;

        if (raw && raw.success !== false && raw.result) {
          const rawResults = Array.isArray(raw.result.results)
            ? raw.result.results
            : [];
          results = rawResults.map(normaliseHit);
          count =
            typeof raw.result.count === "number"
              ? raw.result.count
              : results.length;
          servedFrom = results.length > 0 ? "upstream" : "empty";
          if (results.length === 0) {
            notes = `CKAN returned 0 results for query "${query}"`;
          }
        } else {
          notes = "CKAN response missing expected `result` block";
        }
      } catch (err) {
        console.warn(`[mcp:${TOOL_NAME}] CKAN fetch threw:`, err);
        servedFrom = "empty";
        notes = `CKAN fetch threw: ${
          err instanceof Error ? err.message : String(err)
        }`;
      }

      const envelope: SearchEnvelope = {
        schema_version: SCHEMA_VERSION,
        tool: TOOL_NAME,
        source: "open.alberta.ca CKAN",
        data: {
          query,
          source: "open.alberta.ca CKAN",
          served_from: servedFrom,
          notes,
          count,
          results,
        },
      };

      const parsed = SearchEnvelopeSchema.parse(envelope);

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(parsed, null, 2) },
        ],
        structuredContent: parsed as unknown as Record<string, unknown>,
      };
    },
  );
}
