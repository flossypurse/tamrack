/**
 * `alberta_entities` MCP tool.
 *
 * Reads the `intel_operators` directory built from chamber-of-commerce
 * membership data (Acheson Business Association, Greater Parkland Regional
 * Chamber, etc.). Seeded out-of-band by scripts/seed-intel-operators.ts.
 *
 * v1 scope is search + by-id lookup; deeper per-operator profile data
 * (financial signals, ownership, news mentions, reviews) is a downstream
 * enrichment workflow that writes into a separate table.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  searchIntelOperators,
  getIntelOperator,
  listOperatorCategories,
  type IntelOperator,
} from "@/lib/data-sources-intel";
import { getCurrentProfile } from "@/lib/data-sources-intel-profiles";

import { SCHEMA_VERSION, LimitSchema } from "../schemas";
import { updateToolEntry } from "../registry";

const TOOL_NAME = "alberta_entities";

const ActionSchema = z
  .enum(["search", "get", "list_categories", "get_profile"])
  .default("search");

const SourceSchema = z.enum(["aba", "gprc", "all"]).default("all");

const SearchInputShape = {
  action: ActionSchema.optional(),
  id: z.string().uuid().optional(),
  name_query: z.string().min(1).max(120).optional(),
  category: z.string().min(1).max(120).optional(),
  city: z.string().min(1).max(120).optional(),
  source: SourceSchema.optional(),
  has_email: z.boolean().optional(),
  has_website: z.boolean().optional(),
  limit: LimitSchema.optional(),
  offset: z.number().int().min(0).max(10_000).optional(),
} as const;

const OperatorOutSchema = z.object({
  id: z.string(),
  source: z.string(),
  source_member_id: z.string().nullable(),
  source_url: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  categories: z.array(z.string()),
  city: z.string().nullable(),
  street_address: z.string().nullable(),
  postal_code: z.string().nullable(),
  region: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  website: z.string().nullable(),
  hours: z.string().nullable(),
  social: z.record(z.string(), z.string()).nullable(),
});

const SearchEnvelopeSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  tool: z.literal(TOOL_NAME),
  source: z.literal("alberta-pulse-intel-operators"),
  data: z.object({
    action: z.literal("search"),
    total: z.number().int().min(0),
    returned: z.number().int().min(0),
    offset: z.number().int().min(0),
    limit: z.number().int().min(1),
    operators: z.array(OperatorOutSchema),
  }),
});

const GetEnvelopeSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  tool: z.literal(TOOL_NAME),
  source: z.literal("alberta-pulse-intel-operators"),
  data: z.object({
    action: z.literal("get"),
    operator: OperatorOutSchema.nullable(),
  }),
});

const CategoriesEnvelopeSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  tool: z.literal(TOOL_NAME),
  source: z.literal("alberta-pulse-intel-operators"),
  data: z.object({
    action: z.literal("list_categories"),
    total_categories: z.number().int().min(0),
    categories: z.array(z.object({ category: z.string(), count: z.number().int().min(0) })),
  }),
});

const ProfileEnvelopeSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  tool: z.literal(TOOL_NAME),
  source: z.literal("alberta-pulse-intel-operators"),
  data: z.object({
    action: z.literal("get_profile"),
    operator_id: z.string(),
    profile: z
      .object({
        profile_schema: z.string(),
        researcher: z.string(),
        researched_at: z.string(),
        confidence: z.number(),
        raw_profile_md: z.string(),
        structured: z.record(z.string(), z.unknown()),
        sources: z.array(z.object({ url: z.string() }).passthrough()),
        data_gaps: z.array(z.string()),
      })
      .nullable(),
  }),
});

function shapeOperator(op: IntelOperator): z.infer<typeof OperatorOutSchema> {
  return {
    id: op.id,
    source: op.source,
    source_member_id: op.source_member_id,
    source_url: op.source_url,
    name: op.name,
    description: op.description,
    categories: op.categories ?? [],
    city: op.city,
    street_address: op.street_address,
    postal_code: op.postal_code,
    region: op.region,
    phone: op.phone,
    email: op.email,
    website: op.website,
    hours: op.hours,
    social: op.social,
  };
}

const TOOL_DESCRIPTION =
  "Search the tri-region operator directory (~1,100 businesses from Acheson " +
  "Business Association + Greater Parkland Regional Chamber). action='search' " +
  "filters by name, category, city, source. action='get' fetches one operator " +
  "by id. action='list_categories' returns the full category taxonomy with " +
  "counts. Records carry name, description, categories, contact, address, " +
  "website, social links. v1 — no enrichment data (revenue, headcount, etc.) " +
  "yet; that's a separate workflow.";

// Flip registry to live at module load. Source entry was authored when the
// tool was v2-deferred; overwrite description here too so the catalog stops
// advertising the stale "(v2)" prefix.
updateToolEntry(TOOL_NAME, {
  status: "live",
  domain: "entities",
  description:
    "Tri-region operator directory (~1,100 businesses from Acheson " +
    "Business Association + Greater Parkland Regional Chamber). Search " +
    "by name/category/city/source, fetch one operator by id, or " +
    "enumerate the category taxonomy. Records carry contact, address, " +
    "website, and social links — base directory only; enrichment data " +
    "lives in a downstream workflow.",
  parameters_summary:
    "action ('search' default | 'get' | 'list_categories' | 'get_profile'); for search: optional name_query, category, city, source (aba|gprc|all), has_email, has_website, limit (1-200, default 50), offset; for get + get_profile: id (uuid).",
  response_summary:
    "Envelope with schema_version, tool, source; data shape depends on action — search returns {total, returned, offset, limit, operators[]}; get returns {operator}; list_categories returns {categories[{category, count}]}; get_profile returns {operator_id, profile: {raw_profile_md, structured, sources[], data_gaps, confidence, researched_at, …} | null}.",
  indicators: ["search", "get", "list_categories", "get_profile"],
  example_invocations: [
    {
      description: "Find all trucking and transportation operators.",
      arguments: { action: "search", category: "Trucking & Transportation Services", limit: 20 },
    },
    {
      description: "Search by name fragment in Spruce Grove.",
      arguments: { action: "search", name_query: "safety", city: "Spruce Grove" },
    },
    {
      description: "Enumerate every operator category with member counts.",
      arguments: { action: "list_categories" },
    },
  ],
});

export function registerEntitiesTool(server: McpServer): void {
  server.registerTool(
    TOOL_NAME,
    {
      title: "Alberta Pulse — Tri-Region Operators",
      description: TOOL_DESCRIPTION,
      inputSchema: SearchInputShape,
      annotations: {
        title: "Alberta Pulse — Tri-Region Operators",
        readOnlyHint: true,
        openWorldHint: false,
        idempotentHint: true,
      },
    },
    async (args) => {
      const action = args.action ?? "search";

      if (action === "get") {
        if (!args.id) {
          throw new Error("alberta_entities: action='get' requires id");
        }
        const op = await getIntelOperator(args.id);
        const envelope = {
          schema_version: SCHEMA_VERSION,
          tool: TOOL_NAME,
          source: "alberta-pulse-intel-operators" as const,
          data: {
            action: "get" as const,
            operator: op ? shapeOperator(op) : null,
          },
        };
        const parsed = GetEnvelopeSchema.parse(envelope);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(parsed, null, 2) }],
          structuredContent: parsed as unknown as Record<string, unknown>,
        };
      }

      if (action === "get_profile") {
        if (!args.id) {
          throw new Error("alberta_entities: action='get_profile' requires id");
        }
        const profile = await getCurrentProfile(args.id);
        const envelope = {
          schema_version: SCHEMA_VERSION,
          tool: TOOL_NAME,
          source: "alberta-pulse-intel-operators" as const,
          data: {
            action: "get_profile" as const,
            operator_id: args.id,
            profile: profile
              ? {
                  profile_schema: profile.profile_schema,
                  researcher: profile.researcher,
                  researched_at: profile.researched_at,
                  confidence: Number(profile.confidence),
                  raw_profile_md: profile.raw_profile_md,
                  structured: profile.structured,
                  sources: profile.sources,
                  data_gaps: profile.data_gaps,
                }
              : null,
          },
        };
        const parsed = ProfileEnvelopeSchema.parse(envelope);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(parsed, null, 2) }],
          structuredContent: parsed as unknown as Record<string, unknown>,
        };
      }

      if (action === "list_categories") {
        const cats = await listOperatorCategories();
        const envelope = {
          schema_version: SCHEMA_VERSION,
          tool: TOOL_NAME,
          source: "alberta-pulse-intel-operators" as const,
          data: {
            action: "list_categories" as const,
            total_categories: cats.length,
            categories: cats,
          },
        };
        const parsed = CategoriesEnvelopeSchema.parse(envelope);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(parsed, null, 2) }],
          structuredContent: parsed as unknown as Record<string, unknown>,
        };
      }

      // Default: search.
      const limit = args.limit ?? 50;
      const offset = args.offset ?? 0;
      const result = await searchIntelOperators({
        name_query: args.name_query,
        category: args.category,
        city: args.city,
        source: args.source,
        has_email: args.has_email,
        has_website: args.has_website,
        limit,
        offset,
      });

      const envelope = {
        schema_version: SCHEMA_VERSION,
        tool: TOOL_NAME,
        source: "alberta-pulse-intel-operators" as const,
        data: {
          action: "search" as const,
          total: result.total,
          returned: result.rows.length,
          offset,
          limit,
          operators: result.rows.map(shapeOperator),
        },
      };
      const parsed = SearchEnvelopeSchema.parse(envelope);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(parsed, null, 2) }],
        structuredContent: parsed as unknown as Record<string, unknown>,
      };
    },
  );
}
