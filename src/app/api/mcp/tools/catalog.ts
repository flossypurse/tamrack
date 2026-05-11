/**
 * `alberta_catalog` tool registration.
 *
 * The catalog is the discovery surface: agents call it first to learn
 * what tools, domains, indicators, and municipalities are available
 * without bloating context with every tool schema. No parameters, no
 * upstream fetches.
 *
 * Content type decision (recorded in DECISIONS.md):
 *   - Returns BOTH `structuredContent` (typed JSON object) AND a `text`
 *     content block containing the same payload serialized as JSON.
 *   - MCP-aware clients consume `structuredContent` directly; clients
 *     that only render text content still get the full payload via the
 *     stringified text block. Keeping both costs ~doubling the response
 *     bytes, which at v1 volumes is acceptable.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { buildCatalog } from "../catalog";

export function registerCatalogTool(server: McpServer): void {
  server.registerTool(
    "alberta_catalog",
    {
      title: "Alberta Pulse — Catalog",
      description:
        "Returns the full Alberta Pulse MCP inventory: tools, domains, indicators per domain, live municipalities, and example invocations. Call this first when you don't already know what's available — single call, no parameters, no upstream fetches.",
      // No input parameters in v1. The optional `domain?` filter discussed
      // in the build brief is deliberately not implemented — v1 catalog is
      // one payload, agents filter client-side if they want a subset.
      annotations: {
        title: "Alberta Pulse — Catalog",
        readOnlyHint: true,
        openWorldHint: false,
        idempotentHint: true,
      },
    },
    async () => {
      const payload = buildCatalog();
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(payload, null, 2),
          },
        ],
        structuredContent: payload as unknown as Record<string, unknown>,
      };
    },
  );
}
