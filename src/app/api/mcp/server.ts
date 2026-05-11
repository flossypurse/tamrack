import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerBusinessTool } from "./tools/business";
import { registerCatalogTool } from "./tools/catalog";
import { registerEnergyTool } from "./tools/energy";
import { registerEntitiesTool } from "./tools/entities";
import { registerHousingTool } from "./tools/housing";
import { registerMacroTool } from "./tools/macro";
import { registerMunicipalityTool } from "./tools/municipality";
import { registerRealEstateTool } from "./tools/real-estate";
import { registerRegionalTool } from "./tools/regional";
import { registerSearchTool } from "./tools/search";

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
 * Parcel 2 adds `alberta_catalog`; Parcels 3–5 register the eight typed
 * tools; v2 adds `alberta_entities` (chamber-of-commerce-backed operator
 * directory) — 10 tools total.
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
  registerMunicipalityTool(server);
  registerRealEstateTool(server);
  registerHousingTool(server);
  registerBusinessTool(server);
  registerEnergyTool(server);
  registerSearchTool(server);
  registerEntitiesTool(server);

  return server;
}
