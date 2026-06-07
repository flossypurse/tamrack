import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerBusinessTool } from "./tools/business";
import { registerCatalogTool } from "./tools/catalog";
import { registerEnergyTool } from "./tools/energy";
import { registerEntitiesTool } from "./tools/entities";
import { registerHiringTool } from "./tools/hiring";
import { registerHousingTool } from "./tools/housing";
import { registerMacroTool } from "./tools/macro";
import { registerMunicipalityTool } from "./tools/municipality";
import { registerRealEstateTool } from "./tools/real-estate";
import { registerRegionalTool } from "./tools/regional";
import { registerSearchTool } from "./tools/search";

/**
 * Server identity advertised in `InitializeResult.serverInfo`.
 * Bumped manually with breaking schema changes (e.g. tool surface changes).
 *
 * Tamrack rebrand: name flipped from "alberta-pulse" to "tamrack" alongside
 * the `alberta_*` → `tamrack_*` tool rename. Version bumped to 1.0.0 to mark
 * the breaking surface change (tool-name rename + scope enforcement). Old
 * agents that pinned `alberta-pulse` in their MCP client config need to
 * update — the dual-accept api-key window covers transport-level auth, not
 * MCP-server-name resolution.
 */
export const MCP_SERVER_INFO = {
  name: "tamrack",
  version: "1.0.0",
} as const;

/**
 * Build a fresh `McpServer` instance.
 *
 * Each request gets its own transport + server pair: the Web Standard
 * Streamable HTTP transport in stateless mode requires a new transport per
 * request, and pairing 1:1 keeps server state isolated too. Tool registration
 * is fast (no I/O) so per-request instantiation is cheap.
 *
 * Tamrack v1 ships 11 tools: tamrack_catalog (discovery) + 8 typed surfaces
 * + tamrack_entities (chamber-of-commerce operator directory)
 * + tamrack_hiring (latent-demand hiring signals). Per-tool
 * scope checks run inside each handler against the AsyncLocalStorage
 * auth context (`lib/auth-context.ts`).
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
  registerHiringTool(server);

  return server;
}
