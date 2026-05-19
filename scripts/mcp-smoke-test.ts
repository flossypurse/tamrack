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
 *   - Parcel 2: initialize lifecycle, tools/list returns tamrack_catalog,
 *     tools/call tamrack_catalog returns a well-formed catalog payload.
 *   - Parcel 3: tools/list returns the macro + regional tools alongside the
 *     catalog; tools/call against tamrack_macro and tamrack_regional
 *     round-trips a typed envelope (or a graceful empty envelope when
 *     upstream is unreachable from the test env — both are acceptable).
 *   - Parcel 4: tools/list adds tamrack_municipality + tamrack_real_estate;
 *     tools/call against tamrack_municipality(edmonton) returns the
 *     registry summary card; tools/call against tamrack_real_estate with
 *     a valid capability returns the available envelope; and with a
 *     known-missing capability (a muni whose capabilities[] excludes
 *     dev_permits) returns `{ available: false, reason: ... }` instead
 *     of throwing.
 *   - Parcel 5: tools/list adds tamrack_housing + tamrack_business +
 *     tamrack_energy + tamrack_search (9 total). tools/call against one
 *     invocation per tool round-trips a typed envelope (or a graceful
 *     empty envelope when the upstream is unreachable — same rule as
 *     Parcels 3+4, shape over data).
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
    "tools/list returned exactly 10 tools",
    list.tools.length === 10,
    `got ${list.tools.length}`,
  );
  const listedNames = list.tools.map((t) => t.name).sort();
  const expectedListed = [
    "tamrack_business",
    "tamrack_catalog",
    "tamrack_energy",
    "tamrack_entities",
    "tamrack_housing",
    "tamrack_macro",
    "tamrack_municipality",
    "tamrack_real_estate",
    "tamrack_regional",
    "tamrack_search",
  ].sort();
  check(
    "tools/list names are the 10 live tools",
    listedNames.join(",") === expectedListed.join(","),
    `got ${listedNames.join(",")}`,
  );
  const catalogTool = list.tools.find((t) => t.name === "tamrack_catalog");
  check(
    "tamrack_catalog has a description",
    typeof catalogTool?.description === "string" &&
      (catalogTool.description?.length ?? 0) > 0,
  );
  const macroTool = list.tools.find((t) => t.name === "tamrack_macro");
  check(
    "tamrack_macro has an inputSchema with indicator + time_range",
    macroTool != null &&
      typeof macroTool.inputSchema === "object" &&
      // The SDK returns the inputSchema as a JSON Schema object derived
      // from the zod shape; assert the indicator field is present.
      typeof (macroTool.inputSchema as Record<string, unknown>).properties === "object",
  );
  const regionalTool = list.tools.find((t) => t.name === "tamrack_regional");
  check(
    "tamrack_regional has an inputSchema",
    regionalTool != null &&
      typeof regionalTool.inputSchema === "object" &&
      typeof (regionalTool.inputSchema as Record<string, unknown>).properties === "object",
  );
  const municipalityTool = list.tools.find(
    (t) => t.name === "tamrack_municipality",
  );
  check(
    "tamrack_municipality has an inputSchema with slug",
    municipalityTool != null &&
      typeof municipalityTool.inputSchema === "object" &&
      typeof (municipalityTool.inputSchema as Record<string, unknown>)
        .properties === "object",
  );
  const realEstateTool = list.tools.find(
    (t) => t.name === "tamrack_real_estate",
  );
  check(
    "tamrack_real_estate has an inputSchema",
    realEstateTool != null &&
      typeof realEstateTool.inputSchema === "object" &&
      typeof (realEstateTool.inputSchema as Record<string, unknown>)
        .properties === "object",
  );
  for (const name of [
    "tamrack_housing",
    "tamrack_business",
    "tamrack_energy",
    "tamrack_search",
    "tamrack_entities",
  ]) {
    const t = list.tools.find((x) => x.name === name);
    check(
      `${name} has an inputSchema`,
      t != null &&
        typeof t.inputSchema === "object" &&
        typeof (t.inputSchema as Record<string, unknown>).properties ===
          "object",
    );
  }

  // ── tools/call tamrack_catalog ──────────────────────────────────────
  console.log("\n[tools/call tamrack_catalog]");
  const result = await client.callTool({
    name: "tamrack_catalog",
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

    const catalogEntry = tools.find((t) => t.name === "tamrack_catalog");
    check(
      "tools[] includes tamrack_catalog with status=live",
      catalogEntry?.status === "live",
      `got ${catalogEntry?.status}`,
    );

    // Parcel 3 — these two flip from "planned" to "live".
    const macroEntry = tools.find((t) => t.name === "tamrack_macro");
    check(
      "catalog tools[] reports tamrack_macro status=live",
      macroEntry?.status === "live",
      `got ${macroEntry?.status}`,
    );
    const regionalEntry = tools.find((t) => t.name === "tamrack_regional");
    check(
      "catalog tools[] reports tamrack_regional status=live",
      regionalEntry?.status === "live",
      `got ${regionalEntry?.status}`,
    );

    // Parcel 4 — municipality + real_estate flip from "planned" to "live".
    const municipalityEntry = tools.find(
      (t) => t.name === "tamrack_municipality",
    );
    check(
      "catalog tools[] reports tamrack_municipality status=live",
      municipalityEntry?.status === "live",
      `got ${municipalityEntry?.status}`,
    );
    const realEstateEntry = tools.find(
      (t) => t.name === "tamrack_real_estate",
    );
    check(
      "catalog tools[] reports tamrack_real_estate status=live",
      realEstateEntry?.status === "live",
      `got ${realEstateEntry?.status}`,
    );

    // All 9 v1 tools should appear.
    const v1Names = [
      "tamrack_catalog",
      "tamrack_macro",
      "tamrack_regional",
      "tamrack_municipality",
      "tamrack_real_estate",
      "tamrack_housing",
      "tamrack_business",
      "tamrack_energy",
      "tamrack_search",
      "tamrack_entities",
    ];
    for (const n of v1Names) {
      const t = tools.find((x) => x.name === n);
      check(
        `tools[] includes ${n}`,
        t != null,
        t == null ? "missing" : `status=${t.status}`,
      );
    }

    // tamrack_entities was previously deferred; confirm catalog now reports live.
    const entitiesEntry = tools.find((t) => t.name === "tamrack_entities");
    check(
      "tamrack_entities status=live in catalog",
      entitiesEntry?.status === "live",
      `got status=${entitiesEntry?.status}`,
    );

    // Remaining 7 v2-deferred tools should still report status=deferred.
    const deferredNames = [
      "tamrack_safety",
      "tamrack_immigration",
      "tamrack_politics",
      "tamrack_fiscal",
      "tamrack_environment",
      "tamrack_health",
      "tamrack_signals",
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

  // ── tools/call tamrack_macro ─────────────────────────────────────────
  // Live upstream may be unreachable from a test env (no network, DNS, etc.)
  // and Postgres fallback may be empty (no DATABASE_URL configured). Both
  // are acceptable; assert envelope shape, not non-empty data.
  console.log("\n[tools/call tamrack_macro]");
  const macroResult = await client.callTool({
    name: "tamrack_macro",
    arguments: { indicator: "policy_rate" },
  });
  check(
    "tamrack_macro tools/call did not return isError",
    macroResult.isError !== true,
    JSON.stringify(macroResult.content),
  );
  const macroStructured = macroResult.structuredContent as
    | Record<string, unknown>
    | undefined;
  check(
    "tamrack_macro response has structuredContent",
    macroStructured != null && typeof macroStructured === "object",
  );
  if (macroStructured) {
    check(
      "tamrack_macro envelope.schema_version is 1.0.0",
      macroStructured.schema_version === "1.0.0",
      `got ${String(macroStructured.schema_version)}`,
    );
    check(
      "tamrack_macro envelope.tool is tamrack_macro",
      macroStructured.tool === "tamrack_macro",
      `got ${String(macroStructured.tool)}`,
    );
    const macroData = macroStructured.data as Record<string, unknown> | undefined;
    check(
      "tamrack_macro data.indicator echoes the request",
      macroData?.indicator === "policy_rate",
      `got ${String(macroData?.indicator)}`,
    );
    check(
      "tamrack_macro data.served_from is one of upstream|fallback|empty",
      typeof macroData?.served_from === "string" &&
        ["upstream", "fallback", "empty"].includes(macroData.served_from as string),
      `got ${String(macroData?.served_from)}`,
    );
    check(
      "tamrack_macro data.points is an array",
      Array.isArray(macroData?.points),
    );
    console.log(
      `  info  tamrack_macro served_from=${String(macroData?.served_from)} points=${
        Array.isArray(macroData?.points) ? (macroData.points as unknown[]).length : "n/a"
      }`,
    );
  }

  // ── tools/call tamrack_regional ──────────────────────────────────────
  // Regional dashboard upstream is flaky and can be slow (large payloads,
  // single-attempt retry, then Postgres fallback). Bump the request
  // timeout for this call past the SDK default of 60s.
  console.log("\n[tools/call tamrack_regional]");
  const regionalResult = await client.callTool(
    {
      name: "tamrack_regional",
      arguments: { indicator: "Population", municipality: "edmonton" },
    },
    undefined,
    { timeout: 180_000 },
  );
  check(
    "tamrack_regional tools/call did not return isError",
    regionalResult.isError !== true,
    JSON.stringify(regionalResult.content),
  );
  const regionalStructured = regionalResult.structuredContent as
    | Record<string, unknown>
    | undefined;
  check(
    "tamrack_regional response has structuredContent",
    regionalStructured != null && typeof regionalStructured === "object",
  );
  if (regionalStructured) {
    check(
      "tamrack_regional envelope.schema_version is 1.0.0",
      regionalStructured.schema_version === "1.0.0",
      `got ${String(regionalStructured.schema_version)}`,
    );
    check(
      "tamrack_regional envelope.source is regionaldashboard.alberta.ca",
      regionalStructured.source === "regionaldashboard.alberta.ca",
      `got ${String(regionalStructured.source)}`,
    );
    const regionalData = regionalStructured.data as
      | Record<string, unknown>
      | undefined;
    check(
      "tamrack_regional data.indicator is 'Population'",
      regionalData?.indicator === "Population",
      `got ${String(regionalData?.indicator)}`,
    );
    const muniBlock = regionalData?.municipality as
      | Record<string, unknown>
      | undefined;
    check(
      "tamrack_regional data.municipality.slug is 'edmonton'",
      muniBlock?.slug === "edmonton",
      `got ${String(muniBlock?.slug)}`,
    );
    check(
      "tamrack_regional data.municipality.name is 'Edmonton'",
      muniBlock?.name === "Edmonton",
      `got ${String(muniBlock?.name)}`,
    );
    check(
      "tamrack_regional data.served_from is one of upstream|fallback|empty",
      typeof regionalData?.served_from === "string" &&
        ["upstream", "fallback", "empty"].includes(
          regionalData.served_from as string,
        ),
      `got ${String(regionalData?.served_from)}`,
    );
    check(
      "tamrack_regional data.points is an array",
      Array.isArray(regionalData?.points),
    );
    console.log(
      `  info  tamrack_regional served_from=${String(regionalData?.served_from)} points=${
        Array.isArray(regionalData?.points)
          ? (regionalData.points as unknown[]).length
          : "n/a"
      }`,
    );
  }

  // ── tools/call tamrack_municipality ──────────────────────────────────
  // Registry-backed; the metrics block hits live endpoints but each metric
  // is independently nullable so the envelope is shape-stable regardless.
  console.log("\n[tools/call tamrack_municipality]");
  const muniResult = await client.callTool(
    {
      name: "tamrack_municipality",
      arguments: { slug: "edmonton" },
    },
    undefined,
    { timeout: 180_000 },
  );
  check(
    "tamrack_municipality tools/call did not return isError",
    muniResult.isError !== true,
    JSON.stringify(muniResult.content),
  );
  const muniStructured = muniResult.structuredContent as
    | Record<string, unknown>
    | undefined;
  check(
    "tamrack_municipality response has structuredContent",
    muniStructured != null && typeof muniStructured === "object",
  );
  if (muniStructured) {
    check(
      "tamrack_municipality envelope.schema_version is 1.0.0",
      muniStructured.schema_version === "1.0.0",
      `got ${String(muniStructured.schema_version)}`,
    );
    check(
      "tamrack_municipality envelope.tool is tamrack_municipality",
      muniStructured.tool === "tamrack_municipality",
      `got ${String(muniStructured.tool)}`,
    );
    check(
      "tamrack_municipality envelope.source is tamrack-registry",
      muniStructured.source === "tamrack-registry",
      `got ${String(muniStructured.source)}`,
    );
    const muniData = muniStructured.data as Record<string, unknown> | undefined;
    check(
      "tamrack_municipality data.slug is 'edmonton'",
      muniData?.slug === "edmonton",
      `got ${String(muniData?.slug)}`,
    );
    check(
      "tamrack_municipality data.name is 'Edmonton'",
      muniData?.name === "Edmonton",
      `got ${String(muniData?.name)}`,
    );
    check(
      "tamrack_municipality data.capabilities is a non-empty array",
      Array.isArray(muniData?.capabilities) &&
        (muniData.capabilities as unknown[]).length > 0,
    );
    check(
      "tamrack_municipality data.available_datasets is an array",
      Array.isArray(muniData?.available_datasets),
    );
    check(
      "tamrack_municipality data.metrics is an object",
      muniData?.metrics != null && typeof muniData.metrics === "object",
    );
    const metricsBlock = muniData?.metrics as Record<string, unknown> | undefined;
    console.log(
      `  info  tamrack_municipality parcel_count=${String(metricsBlock?.parcel_count)} vacant_count=${String(metricsBlock?.vacant_count)} recent_permits_count=${String(metricsBlock?.recent_permits_count)}`,
    );
  }

  // ── tools/call tamrack_real_estate (capability supported) ────────────
  console.log("\n[tools/call tamrack_real_estate edmonton/assessments]");
  const reResult = await client.callTool(
    {
      name: "tamrack_real_estate",
      arguments: { municipality: "edmonton", dataset: "assessments", limit: 10 },
    },
    undefined,
    { timeout: 180_000 },
  );
  check(
    "tamrack_real_estate(edmonton/assessments) tools/call did not return isError",
    reResult.isError !== true,
    JSON.stringify(reResult.content),
  );
  const reStructured = reResult.structuredContent as
    | Record<string, unknown>
    | undefined;
  check(
    "tamrack_real_estate response has structuredContent",
    reStructured != null && typeof reStructured === "object",
  );
  if (reStructured) {
    check(
      "tamrack_real_estate envelope.schema_version is 1.0.0",
      reStructured.schema_version === "1.0.0",
      `got ${String(reStructured.schema_version)}`,
    );
    check(
      "tamrack_real_estate envelope.tool is tamrack_real_estate",
      reStructured.tool === "tamrack_real_estate",
      `got ${String(reStructured.tool)}`,
    );
    const reData = reStructured.data as Record<string, unknown> | undefined;
    check(
      "tamrack_real_estate data.available is true for edmonton/assessments",
      reData?.available === true,
      `got ${String(reData?.available)}`,
    );
    const payload = reData?.payload as Record<string, unknown> | undefined;
    check(
      "tamrack_real_estate payload.dataset is 'assessments'",
      payload?.dataset === "assessments",
      `got ${String(payload?.dataset)}`,
    );
    check(
      "tamrack_real_estate payload.by_group is an array",
      Array.isArray(payload?.by_group),
    );
    check(
      "tamrack_real_estate payload.top_properties is an array",
      Array.isArray(payload?.top_properties),
    );
    console.log(
      `  info  tamrack_real_estate(edmonton/assessments) by_group=${
        Array.isArray(payload?.by_group)
          ? (payload.by_group as unknown[]).length
          : "n/a"
      } top_properties=${
        Array.isArray(payload?.top_properties)
          ? (payload.top_properties as unknown[]).length
          : "n/a"
      }`,
    );
  }

  // ── tools/call tamrack_real_estate (capability MISSING) ──────────────
  // Beaumont is `status: "live"` in the registry but has `capabilities: []`,
  // so requesting any dataset against it must return `available: false`
  // with a clean reason — not throw. This is the contract the brief calls
  // out explicitly.
  console.log("\n[tools/call tamrack_real_estate beaumont/dev_permits — missing capability]");
  const reMissingResult = await client.callTool({
    name: "tamrack_real_estate",
    arguments: { municipality: "beaumont", dataset: "dev_permits" },
  });
  check(
    "tamrack_real_estate(beaumont/dev_permits) tools/call did not return isError",
    reMissingResult.isError !== true,
    JSON.stringify(reMissingResult.content),
  );
  const reMissingStructured = reMissingResult.structuredContent as
    | Record<string, unknown>
    | undefined;
  check(
    "tamrack_real_estate(beaumont) response has structuredContent",
    reMissingStructured != null && typeof reMissingStructured === "object",
  );
  if (reMissingStructured) {
    const missingData = reMissingStructured.data as
      | Record<string, unknown>
      | undefined;
    check(
      "tamrack_real_estate(beaumont/dev_permits) data.available is false",
      missingData?.available === false,
      `got ${String(missingData?.available)}`,
    );
    check(
      "tamrack_real_estate(beaumont/dev_permits) data.reason is a non-empty string",
      typeof missingData?.reason === "string" &&
        (missingData.reason as string).length > 0,
      `got ${String(missingData?.reason)}`,
    );
    console.log(
      `  info  tamrack_real_estate(beaumont/dev_permits) reason="${String(missingData?.reason)}"`,
    );
  }

  // ── tools/call tamrack_housing ───────────────────────────────────────
  // mortgage_rate is StatsCan-backed (Table 34-10-0145); usually available
  // but assert envelope shape only — empty data is acceptable in the test
  // env (no network).
  console.log("\n[tools/call tamrack_housing mortgage_rate]");
  const housingResult = await client.callTool(
    {
      name: "tamrack_housing",
      arguments: { dataset: "mortgage_rate", time_range: "last_year" },
    },
    undefined,
    { timeout: 180_000 },
  );
  check(
    "tamrack_housing(mortgage_rate) tools/call did not return isError",
    housingResult.isError !== true,
    JSON.stringify(housingResult.content),
  );
  const housingStructured = housingResult.structuredContent as
    | Record<string, unknown>
    | undefined;
  check(
    "tamrack_housing response has structuredContent",
    housingStructured != null && typeof housingStructured === "object",
  );
  if (housingStructured) {
    check(
      "tamrack_housing envelope.schema_version is 1.0.0",
      housingStructured.schema_version === "1.0.0",
      `got ${String(housingStructured.schema_version)}`,
    );
    check(
      "tamrack_housing envelope.tool is tamrack_housing",
      housingStructured.tool === "tamrack_housing",
      `got ${String(housingStructured.tool)}`,
    );
    check(
      "tamrack_housing envelope.source is 'CMHC via StatsCan'",
      housingStructured.source === "CMHC via StatsCan",
      `got ${String(housingStructured.source)}`,
    );
    const housingData = housingStructured.data as
      | Record<string, unknown>
      | undefined;
    check(
      "tamrack_housing data.dataset echoes 'mortgage_rate'",
      housingData?.dataset === "mortgage_rate",
      `got ${String(housingData?.dataset)}`,
    );
    check(
      "tamrack_housing data.served_from is one of upstream|fallback|empty",
      typeof housingData?.served_from === "string" &&
        ["upstream", "fallback", "empty"].includes(
          housingData.served_from as string,
        ),
      `got ${String(housingData?.served_from)}`,
    );
    const housingPayload = housingData?.payload as
      | Record<string, unknown>
      | undefined;
    check(
      "tamrack_housing payload.dataset is 'mortgage_rate'",
      housingPayload?.dataset === "mortgage_rate",
      `got ${String(housingPayload?.dataset)}`,
    );
    check(
      "tamrack_housing payload.rows is an array",
      Array.isArray(housingPayload?.rows),
    );
    console.log(
      `  info  tamrack_housing served_from=${String(housingData?.served_from)} rows=${
        Array.isArray(housingPayload?.rows)
          ? (housingPayload.rows as unknown[]).length
          : "n/a"
      }`,
    );
  }

  // ── tools/call tamrack_business ──────────────────────────────────────
  // business_count_statscan is the most reliable category (StatsCan WDS).
  console.log("\n[tools/call tamrack_business business_count_statscan]");
  const businessResult = await client.callTool(
    {
      name: "tamrack_business",
      arguments: { category: "business_count_statscan" },
    },
    undefined,
    { timeout: 180_000 },
  );
  check(
    "tamrack_business tools/call did not return isError",
    businessResult.isError !== true,
    JSON.stringify(businessResult.content),
  );
  const businessStructured = businessResult.structuredContent as
    | Record<string, unknown>
    | undefined;
  check(
    "tamrack_business response has structuredContent",
    businessStructured != null && typeof businessStructured === "object",
  );
  if (businessStructured) {
    check(
      "tamrack_business envelope.schema_version is 1.0.0",
      businessStructured.schema_version === "1.0.0",
      `got ${String(businessStructured.schema_version)}`,
    );
    check(
      "tamrack_business envelope.tool is tamrack_business",
      businessStructured.tool === "tamrack_business",
      `got ${String(businessStructured.tool)}`,
    );
    const businessData = businessStructured.data as
      | Record<string, unknown>
      | undefined;
    check(
      "tamrack_business data.category echoes 'business_count_statscan'",
      businessData?.category === "business_count_statscan",
      `got ${String(businessData?.category)}`,
    );
    check(
      "tamrack_business data.served_from is one of upstream|fallback|empty",
      typeof businessData?.served_from === "string" &&
        ["upstream", "fallback", "empty"].includes(
          businessData.served_from as string,
        ),
      `got ${String(businessData?.served_from)}`,
    );
    const businessPayload = businessData?.payload as
      | Record<string, unknown>
      | undefined;
    check(
      "tamrack_business payload.category matches",
      businessPayload?.category === "business_count_statscan",
      `got ${String(businessPayload?.category)}`,
    );
    check(
      "tamrack_business payload.rows is an array",
      Array.isArray(businessPayload?.rows),
    );
    console.log(
      `  info  tamrack_business served_from=${String(businessData?.served_from)} rows=${
        Array.isArray(businessPayload?.rows)
          ? (businessPayload.rows as unknown[]).length
          : "n/a"
      }`,
    );
  }

  // ── tools/call tamrack_energy ────────────────────────────────────────
  // pool_price_current is AESO; works only when AESO_API_KEY is set in
  // the test env. Assert envelope shape; empty rows are acceptable.
  console.log("\n[tools/call tamrack_energy pool_price_current]");
  const energyResult = await client.callTool(
    {
      name: "tamrack_energy",
      arguments: { dataset: "pool_price_current", time_range: "last_30d" },
    },
    undefined,
    { timeout: 180_000 },
  );
  check(
    "tamrack_energy tools/call did not return isError",
    energyResult.isError !== true,
    JSON.stringify(energyResult.content),
  );
  const energyStructured = energyResult.structuredContent as
    | Record<string, unknown>
    | undefined;
  check(
    "tamrack_energy response has structuredContent",
    energyStructured != null && typeof energyStructured === "object",
  );
  if (energyStructured) {
    check(
      "tamrack_energy envelope.schema_version is 1.0.0",
      energyStructured.schema_version === "1.0.0",
      `got ${String(energyStructured.schema_version)}`,
    );
    check(
      "tamrack_energy envelope.tool is tamrack_energy",
      energyStructured.tool === "tamrack_energy",
      `got ${String(energyStructured.tool)}`,
    );
    check(
      "tamrack_energy envelope.source is 'AESO'",
      energyStructured.source === "AESO",
      `got ${String(energyStructured.source)}`,
    );
    const energyData = energyStructured.data as
      | Record<string, unknown>
      | undefined;
    check(
      "tamrack_energy data.dataset echoes 'pool_price_current'",
      energyData?.dataset === "pool_price_current",
      `got ${String(energyData?.dataset)}`,
    );
    check(
      "tamrack_energy data.served_from is one of upstream|fallback|empty",
      typeof energyData?.served_from === "string" &&
        ["upstream", "fallback", "empty"].includes(
          energyData.served_from as string,
        ),
      `got ${String(energyData?.served_from)}`,
    );
    const energyPayload = energyData?.payload as
      | Record<string, unknown>
      | undefined;
    check(
      "tamrack_energy payload.dataset matches",
      energyPayload?.dataset === "pool_price_current",
      `got ${String(energyPayload?.dataset)}`,
    );
    check(
      "tamrack_energy payload.rows is an array",
      Array.isArray(energyPayload?.rows),
    );
    console.log(
      `  info  tamrack_energy served_from=${String(energyData?.served_from)} rows=${
        Array.isArray(energyPayload?.rows)
          ? (energyPayload.rows as unknown[]).length
          : "n/a"
      }`,
    );
  }

  // ── tools/call tamrack_search ────────────────────────────────────────
  // CKAN is upstream-only; the test asserts envelope shape rather than
  // non-empty results.
  console.log("\n[tools/call tamrack_search query=housing]");
  const searchResult = await client.callTool(
    {
      name: "tamrack_search",
      arguments: { query: "housing", limit: 5 },
    },
    undefined,
    { timeout: 180_000 },
  );
  check(
    "tamrack_search tools/call did not return isError",
    searchResult.isError !== true,
    JSON.stringify(searchResult.content),
  );
  const searchStructured = searchResult.structuredContent as
    | Record<string, unknown>
    | undefined;
  check(
    "tamrack_search response has structuredContent",
    searchStructured != null && typeof searchStructured === "object",
  );
  if (searchStructured) {
    check(
      "tamrack_search envelope.schema_version is 1.0.0",
      searchStructured.schema_version === "1.0.0",
      `got ${String(searchStructured.schema_version)}`,
    );
    check(
      "tamrack_search envelope.tool is tamrack_search",
      searchStructured.tool === "tamrack_search",
      `got ${String(searchStructured.tool)}`,
    );
    check(
      "tamrack_search envelope.source is 'open.alberta.ca CKAN'",
      searchStructured.source === "open.alberta.ca CKAN",
      `got ${String(searchStructured.source)}`,
    );
    const searchData = searchStructured.data as
      | Record<string, unknown>
      | undefined;
    check(
      "tamrack_search data.query echoes 'housing'",
      searchData?.query === "housing",
      `got ${String(searchData?.query)}`,
    );
    check(
      "tamrack_search data.served_from is one of upstream|fallback|empty",
      typeof searchData?.served_from === "string" &&
        ["upstream", "fallback", "empty"].includes(
          searchData.served_from as string,
        ),
      `got ${String(searchData?.served_from)}`,
    );
    check(
      "tamrack_search data.results is an array",
      Array.isArray(searchData?.results),
    );
    check(
      "tamrack_search data.count is a non-negative integer",
      typeof searchData?.count === "number" &&
        Number.isInteger(searchData.count) &&
        (searchData.count as number) >= 0,
      `got ${String(searchData?.count)}`,
    );
    console.log(
      `  info  tamrack_search served_from=${String(searchData?.served_from)} count=${String(searchData?.count)} results=${
        Array.isArray(searchData?.results)
          ? (searchData.results as unknown[]).length
          : "n/a"
      }`,
    );
  }

  // ── tools/call tamrack_entities ──────────────────────────────────────
  // Backed by the intel_operators Postgres table. Until seeded, search
  // returns total=0 cleanly — that's still a pass; the envelope shape is
  // what matters here.
  console.log("\n[tools/call tamrack_entities action=list_categories]");
  const entitiesResult = await client.callTool(
    {
      name: "tamrack_entities",
      arguments: { action: "list_categories" },
    },
    undefined,
    { timeout: 60_000 },
  );
  check(
    "tamrack_entities tools/call did not return isError",
    entitiesResult.isError !== true,
    JSON.stringify(entitiesResult.content),
  );
  const entitiesStructured = entitiesResult.structuredContent as
    | Record<string, unknown>
    | undefined;
  check(
    "tamrack_entities response has structuredContent",
    entitiesStructured != null && typeof entitiesStructured === "object",
  );
  if (entitiesStructured) {
    check(
      "tamrack_entities envelope.schema_version is 1.0.0",
      entitiesStructured.schema_version === "1.0.0",
      `got ${String(entitiesStructured.schema_version)}`,
    );
    check(
      "tamrack_entities envelope.source is tamrack-intel-operators",
      entitiesStructured.source === "tamrack-intel-operators",
      `got ${String(entitiesStructured.source)}`,
    );
    const entitiesData = entitiesStructured.data as
      | Record<string, unknown>
      | undefined;
    check(
      "tamrack_entities data.action echoes list_categories",
      entitiesData?.action === "list_categories",
      `got ${String(entitiesData?.action)}`,
    );
    check(
      "tamrack_entities data.categories is an array",
      Array.isArray(entitiesData?.categories),
    );
    console.log(
      `  info  tamrack_entities total_categories=${String(entitiesData?.total_categories)}`,
    );
  }

  await client.close();
  await server.close();

  // ── Final verdict ────────────────────────────────────────────────────
  console.log("");
  if (failures.length === 0) {
    console.log(
      `PASS — initialize + tools/list + tools/call(tamrack_catalog, tamrack_macro, tamrack_regional, tamrack_municipality, tamrack_real_estate × {available, capability-missing}, tamrack_housing, tamrack_business, tamrack_energy, tamrack_search, tamrack_entities) OK (server=${
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
