/**
 * MCP server in-process smoke test (Parcel 1).
 *
 * Round-trips an MCP `initialize` request against the same `McpServer`
 * instance the HTTP route uses, but over an `InMemoryTransport` pair so
 * we don't need a running Next server, a database, or an API key.
 *
 * Auth is intentionally skipped here — auth lives in `route.ts`, not in
 * `server.ts`. This test exercises the JSON-RPC + lifecycle layer; the
 * HTTP/auth layer gets its own end-to-end test once Cully has a dev token.
 *
 * Run with:
 *   npx tsx scripts/mcp-smoke-test.ts
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types.js";

import { createMcpServer, MCP_SERVER_INFO } from "../src/app/api/mcp/server";

async function main(): Promise<void> {
  const server = createMcpServer();
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  const client = new Client(
    { name: "mcp-smoke-test", version: "0.1.0" },
    { capabilities: {} },
  );

  // `client.connect()` performs the full lifecycle: it sends an
  // InitializeRequest, awaits the InitializeResult, and follows up with the
  // InitializedNotification. If any of that mis-sequences, this throws.
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  const info = client.getServerVersion();
  const negotiatedVersion = client.getServerCapabilities();

  if (!info) throw new Error("server did not return serverInfo");
  if (info.name !== MCP_SERVER_INFO.name) {
    throw new Error(
      `serverInfo.name mismatch: expected ${MCP_SERVER_INFO.name}, got ${info.name}`,
    );
  }
  if (info.version !== MCP_SERVER_INFO.version) {
    throw new Error(
      `serverInfo.version mismatch: expected ${MCP_SERVER_INFO.version}, got ${info.version}`,
    );
  }
  if (!negotiatedVersion?.tools) {
    throw new Error("server did not advertise tools capability");
  }

  await client.close();
  await server.close();

  console.log(
    `PASS — initialize round-trip OK (server=${info.name}@${info.version}, client default=${LATEST_PROTOCOL_VERSION})`,
  );
}

main().catch((err) => {
  console.error("FAIL —", err instanceof Error ? err.message : err);
  process.exit(1);
});
