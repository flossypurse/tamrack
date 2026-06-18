/**
 * One-shot scaffold for Tamrack /docs MDX placeholders.
 *
 * Generates the API + MCP tool MDX skeletons from a single manifest so
 * scope assignments, cost units, and section structure stay consistent.
 * Hand-written files (index.mdx, start/overview.mdx, mcp/overview.mdx,
 * llms.txt) are NOT touched by this script.
 *
 * Run once: `npx tsx scripts/scaffold-tamrack-docs.ts`
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..");
const DOCS = path.join(ROOT, "content/docs");

type Endpoint = {
  /** filesystem path under content/docs */
  file: string;
  /** route name in the URL (`/api/<name>`) */
  name: string;
  /** human title — frontmatter `title` */
  title: string;
  /** one-sentence frontmatter description */
  description: string;
  /** scope key like `macro`, `regional`, `real-estate`, etc. */
  scopeArea: string;
};

type McpTool = {
  file: string;
  toolName: string;
  title: string;
  description: string;
  scopeArea: string;
};

// ─── HTTP API endpoints ─────────────────────────────────────────────
const apiEndpoints: Endpoint[] = [
  // macro family
  { file: "api/macro.mdx",       name: "macro",       title: "GET /api/macro",       description: "Province-level macro indicators (GDP, CPI, employment, terms of trade).", scopeArea: "macro" },
  { file: "api/risk.mdx",        name: "risk",        title: "GET /api/risk",        description: "Composite Alberta risk score and component contributions.", scopeArea: "macro" },
  { file: "api/cycle.mdx",       name: "cycle",       title: "GET /api/cycle",       description: "Boom-bust cycle phase, position, and lookback comparison.", scopeArea: "macro" },
  { file: "api/benchmarks.mdx",  name: "benchmarks",  title: "GET /api/benchmarks",  description: "Alberta vs. peer-province benchmark series.", scopeArea: "macro" },
  { file: "api/corridors.mdx",   name: "corridors",   title: "GET /api/corridors",   description: "Inter-provincial trade corridor flows and rankings.", scopeArea: "macro" },

  // regional
  { file: "api/regional.mdx",    name: "regional",    title: "GET /api/regional",    description: "Regional and municipality-level economic rollups.", scopeArea: "regional" },

  // real-estate family
  { file: "api/real-estate/permits.mdx",     name: "permits",     title: "GET /api/permits",     description: "Issued building permits with value, type, and municipality.", scopeArea: "real-estate" },
  { file: "api/real-estate/assessments.mdx", name: "assessments", title: "GET /api/assessments", description: "Municipal property assessment values and year-over-year deltas.", scopeArea: "real-estate" },
  { file: "api/real-estate/housing.mdx",     name: "housing",     title: "GET /api/housing",     description: "Housing market indicators (starts, completions, prices).", scopeArea: "real-estate" },
  { file: "api/real-estate/rental.mdx",      name: "rental",      title: "GET /api/rental",      description: "Rental market vacancy and average rent by municipality.", scopeArea: "real-estate" },
  { file: "api/real-estate/commercial.mdx",  name: "commercial",  title: "GET /api/commercial",  description: "Commercial real estate inventory and lease signals.", scopeArea: "real-estate" },
  { file: "api/real-estate/signals.mdx",     name: "signals",     title: "GET /api/signals",     description: "Real-estate momentum and prospect signals per neighbourhood.", scopeArea: "real-estate" },
  { file: "api/real-estate/pipeline.mdx",    name: "pipeline",    title: "GET /api/pipeline",    description: "Development pipeline — applications, approvals, under construction.", scopeArea: "real-estate" },

  // energy
  { file: "api/energy.mdx",       name: "energy",      title: "GET /api/energy",      description: "Upstream energy data — wells, drilling, prices, royalty inputs.", scopeArea: "energy" },
  { file: "api/electricity.mdx",  name: "electricity", title: "GET /api/electricity", description: "AESO grid load, generation mix, and wholesale pricing.", scopeArea: "energy" },

  // economy family
  { file: "api/economy/business.mdx",     name: "business",     title: "GET /api/business",     description: "Business formation, openings, and closures by sector.", scopeArea: "economy" },
  { file: "api/economy/retail.mdx",       name: "retail",       title: "GET /api/retail",       description: "Retail sales, e-commerce share, and category mix.", scopeArea: "economy" },
  { file: "api/economy/projects.mdx",     name: "projects",     title: "GET /api/projects",     description: "Major capital projects — value, status, and lifecycle phase.", scopeArea: "economy" },
  { file: "api/economy/immigration.mdx",  name: "immigration",  title: "GET /api/immigration",  description: "Permanent and temporary resident flows into Alberta.", scopeArea: "economy" },
  { file: "api/economy/fiscal.mdx",       name: "fiscal",       title: "GET /api/fiscal",       description: "Provincial fiscal indicators — revenue, expense, surplus/deficit.", scopeArea: "economy" },
  { file: "api/economy/politics.mdx",     name: "politics",     title: "GET /api/politics",     description: "Provincial and federal political signal — polls, votes, mandates.", scopeArea: "economy" },
  { file: "api/economy/health-data.mdx",  name: "health-data",  title: "GET /api/health-data",  description: "Public health indicators relevant to economic capacity.", scopeArea: "economy" },
  { file: "api/economy/crime.mdx",        name: "crime",        title: "GET /api/crime",        description: "Reported crime by municipality and category.", scopeArea: "economy" },
  { file: "api/economy/fire.mdx",         name: "fire",         title: "GET /api/fire",         description: "Structure-fire incidents and response stats.", scopeArea: "economy" },
  { file: "api/economy/wildfire.mdx",     name: "wildfire",     title: "GET /api/wildfire",     description: "Active wildfire perimeters, hectares burned, and risk class.", scopeArea: "economy" },
  { file: "api/economy/environment.mdx",  name: "environment",  title: "GET /api/environment",  description: "Air, water, and emissions indicators.", scopeArea: "economy" },
  { file: "api/economy/safety.mdx",       name: "safety",       title: "GET /api/safety",       description: "Composite community safety indicators.", scopeArea: "economy" },
  { file: "api/economy/traffic.mdx",      name: "traffic",      title: "GET /api/traffic",      description: "Road traffic volumes and incident counts.", scopeArea: "economy" },
  { file: "api/economy/weather.mdx",      name: "weather",      title: "GET /api/weather",      description: "Daily weather observations and short-term outlook.", scopeArea: "economy" },
];

// ─── MCP tools ─────────────────────────────────────────────────────
const MCP_TOOLS_DIR = `mcp/${"tools"}`;
const mcpTools: McpTool[] = [
  { file: `${MCP_TOOLS_DIR}/catalog.mdx`,      toolName: "tamrack_catalog",      title: "tamrack_catalog",      description: "List available Tamrack MCP tools and their cost.", scopeArea: "unscoped" },
  { file: `${MCP_TOOLS_DIR}/macro.mdx`,        toolName: "tamrack_macro",        title: "tamrack_macro",        description: "Province-level macro indicators (matches GET /api/macro).", scopeArea: "macro" },
  { file: `${MCP_TOOLS_DIR}/regional.mdx`,     toolName: "tamrack_regional",     title: "tamrack_regional",     description: "Regional rollups (matches GET /api/regional).", scopeArea: "regional" },
  { file: `${MCP_TOOLS_DIR}/municipality.mdx`, toolName: "tamrack_municipality", title: "tamrack_municipality", description: "Municipality-level slice (matches GET /api/regional with filters).", scopeArea: "regional" },
  { file: `${MCP_TOOLS_DIR}/real-estate.mdx`,  toolName: "tamrack_real_estate",  title: "tamrack_real_estate",  description: "Real-estate signals across permits/assessments/pipeline.", scopeArea: "real-estate" },
  { file: `${MCP_TOOLS_DIR}/housing.mdx`,      toolName: "tamrack_housing",      title: "tamrack_housing",      description: "Housing market detail (matches GET /api/housing).", scopeArea: "real-estate" },
  { file: `${MCP_TOOLS_DIR}/business.mdx`,     toolName: "tamrack_business",     title: "tamrack_business",     description: "Business formation and economy slice.", scopeArea: "economy" },
  { file: `${MCP_TOOLS_DIR}/energy.mdx`,       toolName: "tamrack_energy",       title: "tamrack_energy",       description: "Upstream + electricity (matches /api/energy + /api/electricity).", scopeArea: "energy" },
  { file: `${MCP_TOOLS_DIR}/search.mdx`,       toolName: "tamrack_search",       title: "tamrack_search",       description: "Free-text search across the Tamrack corpus.", scopeArea: "economy" },
  { file: `${MCP_TOOLS_DIR}/entities.mdx`,     toolName: "tamrack_entities",     title: "tamrack_entities",     description: "Resolve and look up entities (municipalities, projects, operators).", scopeArea: "economy" },
];

// ─── Start section (small handful, generated) ───────────────────────
const startPages: { file: string; title: string; description: string }[] = [
  { file: "start/quickstart-curl.mdx",        title: "Quickstart — cURL",        description: "Make your first authenticated Tamrack request from a terminal." },
  { file: "start/quickstart-typescript.mdx",  title: "Quickstart — TypeScript",  description: "Use the Tamrack TypeScript SDK from a Node or edge runtime." },
  { file: "start/quickstart-python.mdx",      title: "Quickstart — Python",      description: "Use Tamrack from Python with the official SDK." },
  { file: "start/quickstart-mcp.mdx",         title: "Quickstart — MCP",         description: "Connect Tamrack as an MCP server in Claude / Cursor / Windsurf." },
  { file: "start/auth.mdx",                   title: "Authentication",           description: "API keys, request signing, and rotating credentials." },
  { file: "start/scopes.mdx",                 title: "Scopes",                   description: "Per-area scopes that gate which endpoints a key can call." },
  { file: "start/pricing-and-metering.mdx",   title: "Pricing & metering",       description: "How Tamrack charges cost units and bills usage." },
  { file: "start/rate-limits.mdx",            title: "Rate limits",              description: "Per-key request limits, burst allowance, and 429 handling." },
  { file: "start/errors.mdx",                 title: "Errors",                   description: "Tamrack error shape, common codes, and retry guidance." },
];

const smartUiPages: { file: string; title: string; description: string }[] = [
  { file: "smart-ui/overview.mdx",                 title: "Smart UI — overview",          description: "How Tamrack data renders as agent-friendly UI surfaces." },
  { file: "smart-ui/conversation-patterns.mdx",    title: "Conversation patterns",        description: "Common multi-turn patterns when agents drive Tamrack queries." },
  { file: "smart-ui/dashboard-spec.mdx",           title: "Dashboard spec",               description: "Reference layout for embedding Tamrack views in a dashboard." },
];

const changelogPage = {
  file: "changelog.mdx",
  title: "Changelog",
  description: "Tamrack API and SDK release notes.",
};

// ─── Templates ─────────────────────────────────────────────────────
function endpointTemplate(e: Endpoint): string {
  return `---
title: ${e.title}
description: ${e.description}
scope: tamrack:${e.scopeArea}:read
cost_units: 1
status: live
---

_TODO: one-paragraph purpose._

## Request

_TODO: method + path + params table._

## Auth & scope

Requires the \`tamrack:${e.scopeArea}:read\` scope. See [Scopes](/docs/start/scopes).

## Cost

Charged **1 unit** per successful 200.

## Examples

_TODO: cURL / TypeScript / Python tabs._

## Response

_TODO: realistic sample + TypeScript type._

## Upstream sources

_TODO: list from auth-agent inventory._

## Errors

_TODO: non-generic errors only._

## See also

_TODO: sibling endpoints + matching MCP tool._
`;
}

function mcpToolTemplate(t: McpTool): string {
  const scopeLine =
    t.scopeArea === "unscoped"
      ? "_Unscoped — available to all keys._"
      : `Requires the \`tamrack:${t.scopeArea}:read\` scope. See [Scopes](/docs/start/scopes).`;
  const scopeFm =
    t.scopeArea === "unscoped" ? "" : `scope: tamrack:${t.scopeArea}:read\n`;
  return `---
title: ${t.title}
description: ${t.description}
${scopeFm}cost_units: 1
status: live
---

_TODO: one-paragraph purpose._

## Request

_TODO: tool name + arg table._

## Auth & scope

${scopeLine}

## Cost

Charged **1 unit** per successful tool call.

## Examples

_TODO: cURL / TypeScript / Python tabs._

## Response

_TODO: realistic sample + TypeScript type._

## Upstream sources

_TODO: list from auth-agent inventory._

## Errors

_TODO: non-generic errors only._

## See also

_TODO: sibling tools + matching HTTP endpoint._

## Example prompts

_TODO: 3-5 natural-language prompts that should trigger this tool._

## Schema (as advertised)

_TODO: zod-derived JSON schema literal._
`;
}

function placeholderTemplate(title: string, description: string): string {
  return `---
title: ${title}
description: ${description}
---

_TODO: section body._
`;
}

// ─── Write files ───────────────────────────────────────────────────
function writeIfMissing(rel: string, content: string) {
  const full = path.join(DOCS, rel);
  if (fs.existsSync(full)) {
    console.log(`  skip (exists)  ${rel}`);
    return;
  }
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  console.log(`  write          ${rel}`);
}

console.log("Scaffolding Tamrack docs into content/docs/ ...");

for (const e of apiEndpoints) writeIfMissing(e.file, endpointTemplate(e));
for (const t of mcpTools) writeIfMissing(t.file, mcpToolTemplate(t));
for (const p of startPages) writeIfMissing(p.file, placeholderTemplate(p.title, p.description));
for (const p of smartUiPages) writeIfMissing(p.file, placeholderTemplate(p.title, p.description));
writeIfMissing(changelogPage.file, placeholderTemplate(changelogPage.title, changelogPage.description));

// recipes — empty section anchor only
writeIfMissing("recipes/.gitkeep", "");

console.log("\nDone. Hand-written pages (index.mdx, start/overview.mdx, mcp/overview.mdx, mcp/connect.mdx, llms.txt) are managed separately.");
