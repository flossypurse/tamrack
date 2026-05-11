/**
 * MCP server in-process smoke test.
 *
 * Round-trips MCP JSON-RPC against the same `McpServer` instance the
 * HTTP route uses, but over an `InMemoryTransport` pair so we don't need
 * a running Next server, a database, or an API key.
 *
 * Auth is intentionally skipped here — auth lives in `route.ts`, not in
 * `server.ts`. This test exercises the JSON-RPC + lifecycle + tool
 * surface; the HTTP/auth layer gets its own end-to-end test once Cully
 * has a dev token.
 *
 * Coverage (Parcel 2):
 *   - initialize lifecycle round-trip
 *   - tools/list returns alberta_catalog
 *   - tools/call alberta_catalog returns a well-formed catalog payload
 *
 * Run with:
 *   npx tsx scripts/mcp-smoke-test.ts
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types.js";

import { createMcpServer, MCP_SERVER_INFO } from "../src/app/api/mcp/server";

interface CheckFailure {
  check: string;
  detail: string;
}

const failures: CheckFailure[] = [];

function check(name: string, ok: boolean, detail: string = ""): void {
  if (ok) {
    console.log(`  PASS  ${name}`);
  } else {
    failures.push({ check: name, detail });
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

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

  // ── Lifecycle ────────────────────────────────────────────────────────
  console.log("\n[lifecycle]");
  const info = client.getServerVersion();
  const caps = client.getServerCapabilities();

  check("server returned serverInfo", info != null);
  check(
    "serverInfo.name matches",
    info?.name === MCP_SERVER_INFO.name,
    `expected ${MCP_SERVER_INFO.name}, got ${info?.name}`,
  );
  check(
    "serverInfo.version matches",
    info?.version === MCP_SERVER_INFO.version,
    `expected ${MCP_SERVER_INFO.version}, got ${info?.version}`,
  );
  check("server advertises tools capability", caps?.tools != null);

  // ── tools/list ───────────────────────────────────────────────────────
  console.log("\n[tools/list]");
  const list = await client.listTools();
  check(
    "tools/list returned exactly 1 tool",
    list.tools.length === 1,
    `got ${list.tools.length}`,
  );
  const catalogTool = list.tools[0];
  check(
    "tool is named alberta_catalog",
    catalogTool?.name === "alberta_catalog",
    `got ${catalogTool?.name}`,
  );
  check(
    "alberta_catalog has a description",
    typeof catalogTool?.description === "string" &&
      catalogTool.description.length > 0,
  );

  // ── tools/call alberta_catalog ──────────────────────────────────────
  console.log("\n[tools/call alberta_catalog]");
  const result = await client.callTool({
    name: "alberta_catalog",
    arguments: {},
  });

  check(
    "tools/call did not return isError",
    result.isError !== true,
    JSON.stringify(result.content),
  );

  // Both content paths are advertised by the design — verify both.
  const contentArr = Array.isArray(result.content) ? result.content : [];
  const textBlock = contentArr.find(
    (c) => (c as { type?: string }).type === "text",
  ) as { type: "text"; text: string } | undefined;
  check("response has a text content block", textBlock != null);

  let payload: Record<string, unknown> | null = null;
  if (textBlock) {
    try {
      payload = JSON.parse(textBlock.text) as Record<string, unknown>;
      check("text content block parses as JSON", true);
    } catch (err) {
      check(
        "text content block parses as JSON",
        false,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  const structured = result.structuredContent as
    | Record<string, unknown>
    | undefined;
  check(
    "response has structuredContent",
    structured != null && typeof structured === "object",
  );

  // Prefer structuredContent for assertions — text is a serialized mirror.
  const cat = structured ?? payload;
  if (!cat) {
    check("catalog payload available for inspection", false);
  } else {
    check("schema_version present", typeof cat.schema_version === "string");
    check(
      "schema_version is 1.0.0",
      cat.schema_version === "1.0.0",
      `got ${String(cat.schema_version)}`,
    );

    const tools = (cat.tools ?? []) as Array<{
      name: string;
      status: string;
    }>;
    check("tools[] is an array", Array.isArray(tools));

    const catalogEntry = tools.find((t) => t.name === "alberta_catalog");
    check(
      "tools[] includes alberta_catalog with status=live",
      catalogEntry?.status === "live",
      `got ${catalogEntry?.status}`,
    );

    // All 9 v1 tools should appear.
    const v1Names = [
      "alberta_catalog",
      "alberta_macro",
      "alberta_regional",
      "alberta_municipality",
      "alberta_real_estate",
      "alberta_housing",
      "alberta_business",
      "alberta_energy",
      "alberta_search",
    ];
    for (const n of v1Names) {
      const t = tools.find((x) => x.name === n);
      check(
        `tools[] includes ${n}`,
        t != null,
        t == null ? "missing" : `status=${t.status}`,
      );
    }

    // All 8 v2-deferred tools should be advertised with status=deferred.
    const deferredNames = [
      "alberta_entities",
      "alberta_safety",
      "alberta_immigration",
      "alberta_politics",
      "alberta_fiscal",
      "alberta_environment",
      "alberta_health",
      "alberta_signals",
    ];
    for (const n of deferredNames) {
      const t = tools.find((x) => x.name === n);
      check(
        `tools[] includes ${n} with status=deferred`,
        t?.status === "deferred",
        `got ${String(t?.status)}`,
      );
    }

    const municipalities = (cat.municipalities ?? []) as Array<{
      slug: string;
    }>;
    check(
      "municipalities[] is a non-empty array",
      Array.isArray(municipalities) && municipalities.length > 0,
      `got ${municipalities.length}`,
    );

    const examples = (cat.example_invocations ?? []) as unknown[];
    check(
      "example_invocations[] has at least 3 entries",
      Array.isArray(examples) && examples.length >= 3,
      `got ${examples.length}`,
    );

    const domains = (cat.domains ?? []) as Array<{ name: string }>;
    check(
      "domains[] is a non-empty array",
      Array.isArray(domains) && domains.length > 0,
      `got ${domains.length}`,
    );

    const indicatorsByDomain = cat.indicators_by_domain as
      | Record<string, unknown>
      | undefined;
    check(
      "indicators_by_domain present for macro",
      indicatorsByDomain != null &&
        typeof indicatorsByDomain.macro === "object",
    );
  }

  await client.close();
  await server.close();

  // ── Final verdict ────────────────────────────────────────────────────
  console.log("");
  if (failures.length === 0) {
    console.log(
      `PASS — initialize + tools/list + tools/call(alberta_catalog) OK (server=${
        info?.name
      }@${info?.version}, protocol=${LATEST_PROTOCOL_VERSION})`,
    );
    return;
  }

  console.log(`FAIL — ${failures.length} check(s) failed:`);
  for (const f of failures) {
    console.log(`  - ${f.check}${f.detail ? ` (${f.detail})` : ""}`);
  }
  process.exit(1);
}

main().catch((err) => {
  console.error("FAIL —", err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
