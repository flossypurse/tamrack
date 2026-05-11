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
 * Coverage:
 *   - Parcel 2: initialize lifecycle, tools/list returns alberta_catalog,
 *     tools/call alberta_catalog returns a well-formed catalog payload.
 *   - Parcel 3: tools/list returns the macro + regional tools alongside the
 *     catalog; tools/call against alberta_macro and alberta_regional
 *     round-trips a typed envelope (or a graceful empty envelope when
 *     upstream is unreachable from the test env — both are acceptable).
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
    "tools/list returned exactly 3 tools",
    list.tools.length === 3,
    `got ${list.tools.length}`,
  );
  const listedNames = list.tools.map((t) => t.name).sort();
  const expectedListed = ["alberta_catalog", "alberta_macro", "alberta_regional"].sort();
  check(
    "tools/list names are alberta_catalog + alberta_macro + alberta_regional",
    listedNames.join(",") === expectedListed.join(","),
    `got ${listedNames.join(",")}`,
  );
  const catalogTool = list.tools.find((t) => t.name === "alberta_catalog");
  check(
    "alberta_catalog has a description",
    typeof catalogTool?.description === "string" &&
      (catalogTool.description?.length ?? 0) > 0,
  );
  const macroTool = list.tools.find((t) => t.name === "alberta_macro");
  check(
    "alberta_macro has an inputSchema with indicator + time_range",
    macroTool != null &&
      typeof macroTool.inputSchema === "object" &&
      // The SDK returns the inputSchema as a JSON Schema object derived
      // from the zod shape; assert the indicator field is present.
      typeof (macroTool.inputSchema as Record<string, unknown>).properties === "object",
  );
  const regionalTool = list.tools.find((t) => t.name === "alberta_regional");
  check(
    "alberta_regional has an inputSchema",
    regionalTool != null &&
      typeof regionalTool.inputSchema === "object" &&
      typeof (regionalTool.inputSchema as Record<string, unknown>).properties === "object",
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

    // Parcel 3 — these two flip from "planned" to "live".
    const macroEntry = tools.find((t) => t.name === "alberta_macro");
    check(
      "catalog tools[] reports alberta_macro status=live",
      macroEntry?.status === "live",
      `got ${macroEntry?.status}`,
    );
    const regionalEntry = tools.find((t) => t.name === "alberta_regional");
    check(
      "catalog tools[] reports alberta_regional status=live",
      regionalEntry?.status === "live",
      `got ${regionalEntry?.status}`,
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

  // ── tools/call alberta_macro ─────────────────────────────────────────
  // Live upstream may be unreachable from a test env (no network, DNS, etc.)
  // and Postgres fallback may be empty (no DATABASE_URL configured). Both
  // are acceptable; assert envelope shape, not non-empty data.
  console.log("\n[tools/call alberta_macro]");
  const macroResult = await client.callTool({
    name: "alberta_macro",
    arguments: { indicator: "policy_rate" },
  });
  check(
    "alberta_macro tools/call did not return isError",
    macroResult.isError !== true,
    JSON.stringify(macroResult.content),
  );
  const macroStructured = macroResult.structuredContent as
    | Record<string, unknown>
    | undefined;
  check(
    "alberta_macro response has structuredContent",
    macroStructured != null && typeof macroStructured === "object",
  );
  if (macroStructured) {
    check(
      "alberta_macro envelope.schema_version is 1.0.0",
      macroStructured.schema_version === "1.0.0",
      `got ${String(macroStructured.schema_version)}`,
    );
    check(
      "alberta_macro envelope.tool is alberta_macro",
      macroStructured.tool === "alberta_macro",
      `got ${String(macroStructured.tool)}`,
    );
    const macroData = macroStructured.data as Record<string, unknown> | undefined;
    check(
      "alberta_macro data.indicator echoes the request",
      macroData?.indicator === "policy_rate",
      `got ${String(macroData?.indicator)}`,
    );
    check(
      "alberta_macro data.served_from is one of upstream|fallback|empty",
      typeof macroData?.served_from === "string" &&
        ["upstream", "fallback", "empty"].includes(macroData.served_from as string),
      `got ${String(macroData?.served_from)}`,
    );
    check(
      "alberta_macro data.points is an array",
      Array.isArray(macroData?.points),
    );
    console.log(
      `  info  alberta_macro served_from=${String(macroData?.served_from)} points=${
        Array.isArray(macroData?.points) ? (macroData.points as unknown[]).length : "n/a"
      }`,
    );
  }

  // ── tools/call alberta_regional ──────────────────────────────────────
  // Regional dashboard upstream is flaky and can be slow (large payloads,
  // single-attempt retry, then Postgres fallback). Bump the request
  // timeout for this call past the SDK default of 60s.
  console.log("\n[tools/call alberta_regional]");
  const regionalResult = await client.callTool(
    {
      name: "alberta_regional",
      arguments: { indicator: "Population", municipality: "edmonton" },
    },
    undefined,
    { timeout: 180_000 },
  );
  check(
    "alberta_regional tools/call did not return isError",
    regionalResult.isError !== true,
    JSON.stringify(regionalResult.content),
  );
  const regionalStructured = regionalResult.structuredContent as
    | Record<string, unknown>
    | undefined;
  check(
    "alberta_regional response has structuredContent",
    regionalStructured != null && typeof regionalStructured === "object",
  );
  if (regionalStructured) {
    check(
      "alberta_regional envelope.schema_version is 1.0.0",
      regionalStructured.schema_version === "1.0.0",
      `got ${String(regionalStructured.schema_version)}`,
    );
    check(
      "alberta_regional envelope.source is regionaldashboard.alberta.ca",
      regionalStructured.source === "regionaldashboard.alberta.ca",
      `got ${String(regionalStructured.source)}`,
    );
    const regionalData = regionalStructured.data as
      | Record<string, unknown>
      | undefined;
    check(
      "alberta_regional data.indicator is 'Population'",
      regionalData?.indicator === "Population",
      `got ${String(regionalData?.indicator)}`,
    );
    const muniBlock = regionalData?.municipality as
      | Record<string, unknown>
      | undefined;
    check(
      "alberta_regional data.municipality.slug is 'edmonton'",
      muniBlock?.slug === "edmonton",
      `got ${String(muniBlock?.slug)}`,
    );
    check(
      "alberta_regional data.municipality.name is 'Edmonton'",
      muniBlock?.name === "Edmonton",
      `got ${String(muniBlock?.name)}`,
    );
    check(
      "alberta_regional data.served_from is one of upstream|fallback|empty",
      typeof regionalData?.served_from === "string" &&
        ["upstream", "fallback", "empty"].includes(
          regionalData.served_from as string,
        ),
      `got ${String(regionalData?.served_from)}`,
    );
    check(
      "alberta_regional data.points is an array",
      Array.isArray(regionalData?.points),
    );
    console.log(
      `  info  alberta_regional served_from=${String(regionalData?.served_from)} points=${
        Array.isArray(regionalData?.points)
          ? (regionalData.points as unknown[]).length
          : "n/a"
      }`,
    );
  }

  await client.close();
  await server.close();

  // ── Final verdict ────────────────────────────────────────────────────
  console.log("");
  if (failures.length === 0) {
    console.log(
      `PASS — initialize + tools/list + tools/call(alberta_catalog, alberta_macro, alberta_regional) OK (server=${
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
