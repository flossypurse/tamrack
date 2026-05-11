import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerCatalogTool } from "./tools/catalog";
import { registerMacroTool } from "./tools/macro";
import { registerRegionalTool } from "./tools/regional";

/**
 * Server identity advertised in `InitializeResult.serverInfo`.
 * Bumped manually with breaking schema changes (e.g. tool surface changes).
 */
export const MCP_SERVER_INFO = {
  name: "alberta-pulse",
  version: "0.1.0",
} as const;

/**
 * Build a fresh `McpServer` instance.
 *
 * Each request gets its own transport + server pair: the Web Standard
 * Streamable HTTP transport in stateless mode requires a new transport per
 * request, and pairing 1:1 keeps server state isolated too. Tool registration
 * is fast (no I/O) so per-request instantiation is cheap.
 *
 * Parcel 2 adds `alberta_catalog`. Parcels 3–5 add the eight typed tools.
 */
export function createMcpServer(): McpServer {
  const server = new McpServer(MCP_SERVER_INFO, {
    capabilities: {
      tools: {},
    },
  });

  registerCatalogTool(server);
  registerMacroTool(server);
  registerRegionalTool(server);

  return server;
}
