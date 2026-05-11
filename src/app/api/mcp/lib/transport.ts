import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "../server";

/**
 * Dispatch one MCP request to a fresh per-request server + transport, and
 * return the Response the SDK produces.
 *
 * The SDK's `WebStandardStreamableHTTPServerTransport` already speaks Web
 * Fetch `Request`/`Response`, so no adapter shim is needed (see
 * `DECISIONS.md`). We run in stateless mode (no `sessionIdGenerator`) for
 * v1 — agents can reconnect freely, and per-request servers eliminate
 * cross-request state altogether.
 *
 * The transport's built-in `Origin` allowlist would return 403 on mismatch;
 * v1 spec compliance wants 400 for a missing/invalid Origin, so we keep that
 * check in the route handler and leave the transport's DNS-rebinding
 * protection disabled.
 */
export async function dispatchMcpRequest(req: Request): Promise<Response> {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
  });
  const server = createMcpServer();

  await server.connect(transport);
  try {
    return await transport.handleRequest(req);
  } finally {
    // Best-effort cleanup; ignore close errors so they don't mask the response.
    void server.close().catch(() => {});
  }
}
