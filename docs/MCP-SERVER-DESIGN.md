# Tamrack MCP Server — Design

(Historically "Alberta Pulse" / "Alberta Pulse Check". Rebrand in progress — public copy and live domain still use the old name until cutover.)

**Status:** Draft, awaiting owner approval before build (step 2).
**Author:** Step-1 design pass, 2026-05-10. Revised after owner pivot to hosted remote MCP.
**Scope:** Design only. No code yet. No substrate extensions.

## Purpose

Give AI agents a single, low-friction, discoverable, composable interface to all of the data Tamrack already exposes. Today an agent that needs Alberta data has three bad options: re-fetch from upstream (StatsCan/CKAN/Socrata/etc.), curl Tamrack's 19 HTTP endpoints (no discovery, no schemas), or read the private intel knowledge base directly (fragile, doesn't compose with live data). The MCP server collapses those into one transport.

It is **not** a new product, not a paid tier, and not a new data layer. It is the agent-facing surface of an internal data platform Cully has been building for his own use and for going fishing for domain expertise. The MCP server consolidates that work into something agents can reach. Productization is a separate, downstream conversation.

## Identity

Tamrack is **our internal Alberta-data platform.** It has been doing two things in parallel: (1) custom tools and dashboards for Cully's own benefit, and (2) going fishing for domain expertise across Alberta gov, economic, energy, real estate, and municipal data. The four product surfaces (Pulse Charts, Pulse EDO, Pulse Realtor, Pulse Learn) are artifacts of that work, not the goal of it. The MCP server is the consolidation move: **the tool our agents use to get Alberta-related data**, reading from the same substrate the products read from.

Practical consequence: every tool in the MCP server reads from the same `src/lib/` modules and the same Postgres fallback that the HTTP endpoints use. If data isn't already in the substrate, it isn't in MCP either. New data lands in the substrate first, then any consumer accesses it.

**Direction review pending.** After MCP ships, the overall direction of AP is up for re-evaluation. Treat v2 deferrals in this doc as genuinely uncertain — they're queued, not committed. The step-2 build should resist anything that bakes assumptions about a long-running AP-as-public-data-platform future. Ship the minimum-viable agent surface; let the direction review decide what comes next.

> Note: `tamrack/webui/AGENT.md` still describes AP as "Multi-product SaaS platform tracking Alberta's economy" — that copy is stale per the 2026-05-10 reframe. Updating it is out of scope for this design.

## Architecture

### Transport — Streamable HTTP, hosted

The current MCP spec (2025-06-18) defines two transports: stdio and **Streamable HTTP** (which replaces the deprecated HTTP+SSE). v1 is Streamable HTTP, hosted at AP's existing domain, so agents register a URL + token and never run a local subprocess.

Why hosted-from-v1:

- Cully's agents run in multiple places (workspace Claude Code sessions, Echo on Cloud Run, future Resonate workers, scheduled routines). A hosted endpoint serves all of them with one registration.
- AP already has Bearer auth, rate limiting, and usage logging in `src/lib/api-auth.ts` + `src/lib/api-keys.ts`. The MCP route inherits this — no new auth infra.
- AP is already deployed on Railway (`web` service, auto-deploy from `main`); adding the MCP surface is a route change, not a new service.
- The MCP server's *unique* value over a curl-able REST endpoint is client-side ergonomics inside an MCP-aware agent (discovery, typed schemas, composition). Streamable HTTP gives us that across every agent context.

stdio is **not** shipped. If a use case for stdio surfaces later (e.g., an air-gapped agent), the same tool definitions can be re-bound to a stdio transport — keep transport binding as a thin shim during build.

### Repo location — Next.js Route Handler at `src/app/api/mcp/route.ts`

Keep the MCP server inside the existing Next.js app, as one more route:

```
tamrack/webui/src/app/api/
├── mcp/
│   ├── route.ts            # POST/GET handler — Streamable HTTP per spec
│   ├── server.ts           # McpServer instance + tool registration
│   ├── tools/              # one file per typed tool
│   ├── catalog.ts          # static catalog generator (shared with /api/mcp tool registry)
│   └── schemas.ts          # zod schemas reused by tools + catalog
├── macro/route.ts          # existing — unchanged
├── ... (existing routes)
```

Why same Next.js app:

- The tools import directly from `src/lib/data-sources*.ts`, `municipality-registry.ts`, and `data-fallback.ts`. Same process means zero coupling friction.
- Same Railway service, same Postgres pool, same env vars (`DATABASE_URL`, `AUTH_SECRET`, etc.), same deploy lifecycle.
- Auth is one line: call `authenticateApiRequest(req)` at the top of the route, same as every other paid endpoint.
- The route runs in Next.js node runtime (`export const runtime = 'nodejs'`) and handles both POST (incoming JSON-RPC) and GET (server-initiated SSE per spec).

Why not a separate Railway service:

- Duplicate auth, duplicate DB pool, duplicate deploy story for no real benefit at v1 scale.
- Crosses a process boundary just to import the same modules.
- Can be split later if MCP traffic shape ever diverges from web traffic shape (it won't at v1 volumes).

Why not stdio + local-only:

- (See "Transport" above — hosted is the explicit owner pivot.)

### Relationship to existing HTTP routes

The MCP route **does not replace** the 19 HTTP routes. It wraps the same underlying fetchers. An MCP tool call and an `/api/macro?indicator=...` call both end up in the same `src/lib/data-sources*.ts` function. The HTTP layer continues to serve the public site, the products, and any non-MCP consumers (browsers, embeds, third-party REST clients).

The MCP tool surface is **not** a 1:1 mirror of `/api/*`. Several existing endpoints are `type=` multiplexers; MCP tools group them by domain with a more discoverable parameter shape (catalog + typed args). See "Tool taxonomy" below.

### Auth

Reuse the existing AP API key infrastructure verbatim:

- Token format: `ap_<random>` issued via the existing `/api/api-keys/` admin flow.
- Header: `Authorization: Bearer ap_<key>`, enforced by `authenticateApiRequest(req)` at the top of `route.ts`.
- Rate limiting: existing `checkRateLimit(keyId)` (currently 1000-per-window per key). The MCP route inherits this.
- Usage logging: existing `logApiUsage(keyId, userId, endpoint, status)`.

Additional MCP-spec-mandated checks in the route handler:

- Validate `Origin` header on every request (the spec calls this out explicitly to prevent DNS rebinding).
- Validate `MCP-Protocol-Version` header on non-initialize requests; reject unsupported versions with 400.
- Bind localhost-only in dev; Railway's domain handles prod.

Token issuance is a manual one-time step per agent (Cully issues, agents store in their settings). Per-agent tokens are preferred from day one so we can observe usage and revoke without affecting other agents.

### Relationship to the private intel knowledge base

**This is the hosted-pivot's hardest constraint.** the private intel knowledge base is private and lives outside the public webui repo. The hosted MCP server cannot read those files from Railway — they're not in the build artifact and Railway doesn't have the workspace mounted.

Three options, in order of preference:

1. **Defer `alberta_entities` to v2.** v1 ships only public-substrate tools. v2 introduces a one-way seed pipeline: a private workspace script (`scripts/seed-intel.ts`) reads `the private tri-region operators knowledge base` and writes structured rows into AP's existing Postgres (a new `intel_operators` table). The MCP server reads from Postgres like any other substrate consumer. The prose findings stay outside the substrate.
2. **Bake structured intel into the public repo.** Take only the structured JSON/CSV (operators directory, no prose), commit to a `public/intel/` folder in the webui repo. Quick but conflates private workspace state with the public repo; risks accidentally committing prose files; loses provenance back to cortex.
3. **Ship a private parallel deployment.** A second hosted MCP instance behind a private domain with intel mounted. Doubles the infra and the auth story for one tool.

**Recommendation: option 1.** Defer `alberta_entities` to v2. Treat the Postgres migration as a prerequisite, not a side quest — when v2 starts, write the migration + seeder + tool together. The cortex files remain canonical; the DB rows are a deploy artifact regenerated when the cortex changes. v1 ships nine public-substrate tools without intel.

This also resolves the long-flagged "should intel migrate to Postgres" question — yes, when v2 happens, and the MCP server is the forcing function.

### Deployment

No new infrastructure. The route ships with the existing `web` service on Railway, auto-deploys from `main`. Domain: `https://albertapulsecheck.ca/api/mcp`.

Client registration example (workspace Claude Code):

```
claude mcp add tamrack \
  --transport http \
  --url https://albertapulsecheck.ca/api/mcp \
  --header "Authorization: Bearer ap_<key>"
```

(Exact CLI flags resolved against the current `claude mcp` syntax during build.)

### Local development

A `pnpm dev` / `npm run dev` session exposes `http://localhost:3000/api/mcp` like any other AP route. Agents running on the same machine can register the localhost URL with a dev token. No separate "MCP dev server" process.

## Tool taxonomy

Two layers: **one catalog/discovery tool** + **typed domain tools**. No NL escape hatch in v1.

### Layer 1 — Catalog

One tool: `alberta_catalog`.

Returns a structured description of every domain, every indicator inside each domain, every municipality (with available data capabilities), date ranges where known, and example invocations. Lets an agent answer "what's available?" in a single tool call without bloating context with every tool schema.

The catalog is **static metadata** generated at build time from the same registry that drives the typed tools (municipality registry, regional indicator list, etc.). Not an LLM call. Not a live probe. The `/api/health?deep=1` endpoint already tracks upstream health and can be referenced from the catalog for "is this source up right now."

### Layer 2 — Typed domain tools (v1: 8 tools)

Each tool maps to a domain group that's already coherent in the codebase. Parameters mirror the existing HTTP endpoint shape so behaviour is auditable against a known surface, but rename `type` to a domain-specific noun for discoverability.

| Tool | What it returns | Backed by |
|------|-----------------|-----------|
| `alberta_catalog` | Full discovery: tool list, domain index, indicator inventory, municipality list, example calls | static metadata |
| `alberta_municipality` | Registry entry + summary card (population, region, capabilities, available datasets) for a municipality | `municipality-registry.ts`, `municipality-data.ts` |
| `alberta_regional` | regionaldashboard.alberta.ca — 54 indicators × ~340 munis. The workhorse. | `data-sources-regional.ts`, `data-fallback.ts` |
| `alberta_real_estate` | Assessments, permits, dev permits per municipality (Edmonton/Strathcona/St. Albert/Parkland/Stony Plain/Spruce Grove) | `data-sources-business.ts`, `data-sources-ualberta.ts`, `data-sources.ts` ArcGIS fetchers |
| `alberta_macro` | BoC policy rate, CAD/USD, mortgage 5y, unemployment, CPI, GDP, housing starts, AAX | `data-sources.ts` BoC + StatsCan |
| `alberta_housing` | CMHC starts, completions, under-construction, vacancy, rents, absorptions, mortgage rate | `data-sources-cmhc.ts` |
| `alberta_business` | Business licences (Edm/Cal), StatsCan business counts, GHG facilities, top emitters, WCB, non-profits, ISED corp count | `data-sources-business.ts`, `data-sources-retail.ts` |
| `alberta_energy` | CER pipeline throughput/incidents/apportionment, AESO pool price / supply-demand / forecast, oil production | `data-sources-aeso.ts`, `data-sources-cer.ts` |
| `alberta_search` | Alberta CKAN dataset search — long-tail escape hatch when none of the above fit | `searchAlbertaDatasets()` |

Each typed tool takes:

- a domain-specific selector (e.g., `indicator` for macro/regional, `category` for business, `type` for energy/housing where shapes diverge),
- optional `municipality` (slug from the registry),
- optional `time_range` (`{ from, to }` or named: `last_30d`, `last_year`, `ytd`),
- optional `limit` for paginated/large responses.

Tool descriptions emphasise the upstream provenance ("CMHC", "BoC", "AESO") so agents can cite sources. Response shapes are typed via zod and returned as JSON content blocks.

### Deferred to v2

- `alberta_entities` — tri-region operators + future named-entity data. **Requires Postgres migration of `the private tri-region operators knowledge base`** (see "Relationship to the private intel knowledge base" above). Build this together with v2.
- `alberta_safety` — crime + fire + wildfire + 511 alerts.
- `alberta_immigration` — IRCC by category/CMA/occupation/trend.
- `alberta_politics` — MLAs, MPs, districts, votes, debates, election results.
- `alberta_fiscal` — provincial grants, federal transfers, federal contracts/grants.
- `alberta_environment` — water levels, AQHI, earthquakes, climate.
- `alberta_health` — life expectancy, births/deaths, causes of death.
- `alberta_signals` — cross-domain signal mining; shape depends on what proves useful.

Add when a real agent task surfaces the need, or when the v2 entity migration ships (those move together).

### NL escape hatch — explicitly not in v1

Reasoning:

- Catalog + typed tools should cover ~95% of agent queries.
- `alberta_search` (CKAN) already covers the long tail for "I need a dataset I don't see listed."
- An NL hatch adds latency (500–3000ms), per-query LLM cost, non-determinism, and another API key on the server.
- The agent calling the MCP server is already an LLM — having it call out to another LLM to translate the query is double-LLM.

Revisit when there's evidence of recurring queries that catalog+typed can't satisfy. Even then, prefer enriching the catalog over adding LLM-in-the-middle.

## V1 scope

Ship 9 tools: `alberta_catalog` + 8 typed domain tools (`alberta_municipality`, `alberta_regional`, `alberta_real_estate`, `alberta_macro`, `alberta_housing`, `alberta_business`, `alberta_energy`, `alberta_search`).

Streamable HTTP transport, hosted at `https://albertapulsecheck.ca/api/mcp`. Bearer auth via existing `ap_<key>` infra. Reads from `src/lib/data-sources*.ts` + `municipality-registry.ts` + Postgres fallback. Health surfaced via the existing `/api/health?deep=1` endpoint.

**Done criteria for v1 build:**

- `POST /api/mcp` round-trips the MCP `initialize` → `tools/list` → `tools/call` lifecycle.
- `GET /api/mcp` accepts SSE per spec (even if v1 only returns synchronous responses, the spec lifecycle must work).
- Auth: requests without a valid `Bearer ap_<key>` get 401; rate-limited requests get 429; per-key usage rows land in the existing usage-log table.
- `alberta_catalog` returns a complete inventory matching the typed tool list.
- Each typed tool round-trips at least three representative invocations against live upstream + falls back to Postgres on upstream failure (same as HTTP endpoints).
- `Origin` header validated; unsupported `MCP-Protocol-Version` rejected with 400.
- `src/app/api/mcp/AGENT.md` documents the registration URL, token-issuance flow, tool list, and the substrate-first invariant.
- `npm run build` still passes; no new dependencies break the Next bundle.

## Tradeoffs and risks

**Public hosted MCP changes the threat model.** stdio v1 had zero attack surface beyond the OS process boundary. Hosted has:

- Token theft → arbitrary read access to AP data. Mitigation: per-agent tokens + revocation flow + usage anomaly review.
- DNS rebinding → spec-mandated `Origin` validation. Don't skip.
- DoS / abuse → existing rate limit (1000/window/key). Tune up or down per token as needed.
- Cost amplification → an agent in a loop hammers upstream APIs (StatsCan, CMHC, AESO, etc.). Mitigation: in-memory LRU per tool keyed by parameter signature, 60s TTL; also AP's existing Postgres fallback absorbs most upstream pressure.

**Streamable HTTP in a Next.js Route Handler is doable but not idiomatic.** The MCP TypeScript SDK ships `StreamableHTTPServerTransport` which expects Node-style req/res. Next Route Handlers expose Web Fetch `Request`/`Response`. Two paths during build:

- Adapter shim: convert `NextRequest` → Node-like req/res for the SDK's transport. Small amount of glue.
- Direct implementation: implement the Streamable HTTP transport against Web Fetch primitives. More code, fewer dependencies.

Flag this as the first decision point in the step-2 build handoff. Default to adapter shim unless it fights.

**Schema evolution.** Every typed tool's response shape is a contract with calling agents. Strict zod-typed responses with a versioned `schema_version` field per tool. Catalog advertises the version.

**Catalog drift.** The catalog must stay in sync with what the typed tools actually accept. Generate from a shared registry at build time, not hand-written. Test that catalog ⟷ tools agree.

**`alberta_entities` blocked behind a Postgres migration.** This is the explicit cost of the hosted pivot. Tri-region operator data is the most valuable named-entity content in the workspace; it doesn't ship in v1. If you want it sooner, accept a private parallel deployment (option 3 above) or do the Postgres migration as part of v1.

**Substrate gaps.** Audit revealed the existing API endpoints don't cover everything the data-source modules expose (e.g., `data-sources-cannabis.ts`, `data-sources-fire.ts` Edmonton-specific functions). MCP v1 follows the substrate, not the endpoints — but for tools where the substrate is richer than the endpoints, the MCP tool can expose more. Decide per-tool during build; default to "match endpoint surface" and expand only when a need surfaces.

## Open questions for Cully

1. **Confirm `src/app/api/mcp/route.ts` in the same Next app vs separate Railway service.** Recommendation is same app — same auth, same DB pool, same deploy. Push back if you specifically want MCP traffic isolated (independent scaling, blast-radius separation, eventual public-product surface). I'd argue both are premature at v1 volumes.

2. **Confirm `alberta_entities` is deferred to v2 (with Postgres migration as prerequisite).** Tri-region operators is your most valuable named-entity dataset and you may want it day-one. If yes, we either pull the migration into v1 (bigger scope) or ship a private parallel deployment for entities only (more infra). My recommendation is deferral, but flag if Grove/opportunity-scouting work needs it immediately.

3. **Token issuance — per-agent, single workspace token, or both?** Per-agent recommended: cleaner attribution in `logApiUsage`, independent revocation, no shared-secret blast radius. Confirm.

4. **V1 tool list (8 typed + catalog = 9 total).** Prioritised by your active project contexts (Grove, Alberta Athletics, InTheLoop, Signals/Finance, opportunity intel). Politics, fiscal, environment, health, retail, safety, immigration all deferred. Push back if any deferred tool is actively needed for a current agent task.

5. **Catalog as static metadata, not live.** The catalog tool doesn't hit upstreams to verify each indicator is alive; it lists what *should* be there. Agents that need liveness use `/api/health?deep=1`. Confirm this split.

6. **Naming convention `alberta_*`.** Workspace MCP tools usually use `<system>_<verb>` (`email_create_account`). I'm using `alberta_<domain>` because the verb is always "fetch" and the domain is the discriminator. Alternative: `pulse_<domain>`. Confirm preference.

7. **Public surface.** Per the handoff, this is agent infrastructure first, not a product feature. But the existence of "Alberta Pulse exposes its data via MCP" is a credibility marker for the data-platform identity. Do we mention it anywhere public (a `/developers` page, footer link, README), or stays internal until productisation?

8. **Rate-limit default per token.** Existing AP API keys are 1000/window. MCP tools may be chattier than the typical REST consumer (an agent fanning out across a catalog). Confirm 1000 is the right starting default, or raise specifically for MCP-issued tokens.

## Out of scope (do not bundle into the step-2 build)

- Modifying any existing `/api/*` route or `src/lib/data-sources*` file (beyond importing them from the MCP route).
- Adding new upstream data sources.
- Migrating the private intel knowledge base to Postgres (v2 prerequisite, deliberately deferred).
- Building `alberta_entities` and the other v2-deferred tools.
- Updating `tamrack/webui/AGENT.md` identity copy (separate task).
- NL escape hatch.
- Public-facing developer documentation page (decision pending Open Question 7).

Any of these surfacing during the build means stop and write a separate follow-up handoff.
