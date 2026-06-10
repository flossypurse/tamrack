# MCP Server — `/api/mcp`

A hosted Model Context Protocol server that exposes Tamrack's data substrate to AI agents through one transport. Streamable HTTP, Bearer auth, runs in the same Next.js app on the same Railway service as the rest of the webui.

For the why and the full design rationale, read [`docs/MCP-SERVER-DESIGN.md`](../../../../docs/MCP-SERVER-DESIGN.md). This file is the operating manual.

## Substrate-first invariant

Every MCP tool reads from the same `src/lib/data-sources*.ts` modules and the same Postgres fallback that the public HTTP routes read from. If data isn't already in the substrate, it isn't in MCP either. New data lands in the substrate first; any consumer accesses it after that. The MCP route never reaches outside the substrate.

## Registration (client side)

Once Cully has issued a Bearer token (see below), an MCP client registers the server like any other remote MCP endpoint:

```
claude mcp add tamrack \
  --transport http \
  --url https://tamrack.ca/api/mcp \
  --header "Authorization: Bearer tk_<key>"
```

Local development uses the same flow against `http://localhost:3000/api/mcp` with a dev token. Legacy `ap_*` keys are accepted through 2026-08-16 (the dual-accept window — see `src/lib/api-keys.ts`).

## Token issuance

The MCP server reuses the existing API key infrastructure. New tokens look like `tk_<random>`; legacy `ap_<random>` is accepted through the cutover window. Both are validated by `authenticateApiRequest()` in [`src/lib/api-auth.ts`](../../../lib/api-auth.ts), which also enforces the Tamrack 5-scope taxonomy.

To issue a token, hit the existing route while signed into the account:

```
POST /api/api-keys
Cookie: <session cookie>
Content-Type: application/json

{ "name": "claude-code-workspace", "scopes": ["tamrack:macro:read"] }
```

The response includes a one-time-visible `key` field. Store it; it can't be recovered. Per-agent tokens are preferred so usage shows up cleanly in the existing `logApiUsage` table and one agent's revocation doesn't affect others.

To revoke: `DELETE /api/api-keys` with `{ "keyId": "..." }`.

## Tools

Thirteen tools live. The catalog tool advertises the live schemas; descriptions below are one-line summaries. All tool names use the `tamrack_*` prefix (renamed from `alberta_*` on 2026-05-14 — this IS a breaking change for any agent that hard-codes the old names; the dual-accept window is on the API key prefix, not on tool names).

| Tool | Scope | What it returns |
|------|-------|-----------------|
| `tamrack_catalog` | none | Full discovery: tool list, domain index, indicator inventory, municipality list, example invocations. Static metadata generated from the in-process registry. |
| `tamrack_municipality` | `tamrack:regional:read` | Registry-backed summary card for a slug — name, region, population, capabilities, best-effort metrics. |
| `tamrack_regional` | `tamrack:regional:read` | regionaldashboard.alberta.ca — 54 indicators × ~340 municipalities. Workhorse for any regional time-series. |
| `tamrack_real_estate` | `tamrack:real-estate:read` | ArcGIS assessments / permits / dev_permits per supported municipality. Returns `{ available: false, reason }` for slug+dataset combos the registry doesn't support. |
| `tamrack_macro` | `tamrack:macro:read` | BoC Valet (policy rate, CAD/USD, mortgage 5y) + StatsCan (unemployment, CPI, GDP, housing starts) + Alberta Activity Index. 8 indicators. |
| `tamrack_housing` | `tamrack:real-estate:read` | CMHC starts, completions, under-construction, snapshot, vacancy, rents, absorptions, mortgage rate. |
| `tamrack_business` | `tamrack:economy:read` | Edmonton/Calgary business licences, StatsCan business counts, GHG facilities, top emitters, WCB, retail subsectors, ecommerce, food services, business dynamics. |
| `tamrack_energy` | `tamrack:energy:read` | AESO pool price / supply-demand / forecast + CER pipeline throughput / incidents / apportionment / oil production. |
| `tamrack_search` | `tamrack:economy:read` | Alberta CKAN dataset search — long-tail escape hatch when none of the above fit. |
| `tamrack_entities` | `tamrack:economy:read` | Tri-region operator directory (~1,100 businesses from Acheson Business Association + Greater Parkland Regional Chamber). action='search' (name/category/city/source filters) \| action='get' (by id) \| action='list_categories' (taxonomy + counts). Backed by the `intel_operators` Postgres table, seeded out-of-band. Base directory only — enrichment data lives in a downstream workflow. |
| `tamrack_opportunities` | `tamrack:economy:read` | Demand-side feed — CanadaBuys federal open tenders (IT/software/AI/data, nationally deliverable), soonest-closing first. Reads the `opportunities` table. |
| `tamrack_hiring` | `tamrack:economy:read` | Latent-demand hiring signals — Alberta postings for automatable back-office roles (Canada Job Bank), NOC/sector/city breakdowns + month-over-month momentum. Aggregate strain signal, not per-company leads. |
| `tamrack_leads` | `tamrack:economy:read` | Per-geo demand-heat composite — ranks registry municipalities by hiring momentum + permit expansion + business formation + a provincial procurement backdrop. Compute-on-read; aggregate directional ranking with per-row coverage flags, not guaranteed per-company leads. |

Seven more tools (`tamrack_safety`, `tamrack_immigration`, `tamrack_politics`, `tamrack_fiscal`, `tamrack_environment`, `tamrack_health`, `tamrack_signals`) are advertised in the catalog with `status: "deferred"`. They land when the corresponding substrate work is done.

## Seeding the entities table

`intel_operators` is populated by a private workspace script that reads chamber-of-commerce JSON files:

```
DATABASE_URL=postgresql://... \
  npx tsx scripts/seed-intel-operators.ts \
    aba:/path/to/aba-raw.json \
    gprc:/path/to/gprc-raw.json
```

Idempotent — `ON CONFLICT (source, source_member_id)` upserts on re-seed.

## Spec compliance

- Transport: Streamable HTTP per MCP spec 2025-06-18+ (SDK ships forward-compat versions through 2025-11-25).
- Lifecycle: `initialize` → `InitializeResult` → `InitializedNotification` is handled by the SDK; the route delegates after auth + header checks pass.
- `Origin` validated on every request (DNS-rebinding prevention). Allowlist in [`route.ts`](./route.ts).
- `MCP-Protocol-Version` validated on all non-initialize POST/GET/DELETE. Missing or unsupported → 400.
- `runtime = "nodejs"` (the SDK requires Node Web Standard APIs).
- Stateless mode — each request gets a fresh server + transport pair.

## Code layout

- [`route.ts`](./route.ts) — Next.js Route Handler: POST/GET/DELETE/OPTIONS, Origin + version + auth gates.
- [`server.ts`](./server.ts) — `createMcpServer()` factory; registers every tool.
- [`registry.ts`](./registry.ts) — single source of truth for tool entries (planned / live / deferred). `updateToolEntry()` mutates entries at module load when each tool registers itself.
- [`schemas.ts`](./schemas.ts) — shared zod schemas: `MunicipalitySlugSchema`, `TimeRangeSchema`, `LimitSchema`, `SCHEMA_VERSION`.
- [`catalog.ts`](./catalog.ts) — `buildCatalog()` reads from the registry; no hand-written duplication.
- `./tools/*.ts` — one file per tool. Each defines its zod input, wraps the substrate fetcher, falls back gracefully, and registers itself. Each calls `requireScopes([...])` to enforce the Tamrack 5-scope taxonomy on a per-tool basis.
- [`lib/auth.ts`](./lib/auth.ts) — thin wrapper over `authenticateApiRequest`. The MCP route does NOT pass `requiredScopes` here; per-tool scopes are enforced inside each tool via `requireScopes()` using an AsyncLocalStorage-backed auth context.
- [`lib/auth-context.ts`](./lib/auth-context.ts) — AsyncLocalStorage that carries `{ userId, scopes }` from the route handler down into tool handlers, so tools can check scope without re-deriving from the Bearer header.
- [`lib/transport.ts`](./lib/transport.ts) — SDK's Web Standard transport in stateless mode.
- [`DECISIONS.md`](./DECISIONS.md) — load-bearing tactical decisions.

## Smoke test

```
npx tsx scripts/mcp-smoke-test.ts
```

Round-trips `initialize` → `tools/list` → one `tools/call` per tool against an in-memory transport pair (no HTTP, no DB, no token). Prints `PASS` when all assertions hold.

## Rate limit

Inherits the existing per-key rate limit (1000-per-day-per-key). Bump per token if a specific agent's traffic shape needs it. Anomaly review uses the same `api_usage` table the rest of `/api/*` writes to.

## Adding a new tool

1. Add or update the entry in [`registry.ts`](./registry.ts). New entries default to `status: "planned"`.
2. Create a new file under `./tools/` following the existing pattern: zod input shape, envelope output, defensive `.parse()`, module-load `updateToolEntry(name, { status: "live", ... })`, and a `requireScopes([...])` call at the top of the handler.
3. Register it from [`server.ts`](./server.ts).
4. Extend [`scripts/mcp-smoke-test.ts`](../../../../scripts/mcp-smoke-test.ts) with at least one `tools/call` assertion.
5. `npm run build` and `npx tsx scripts/mcp-smoke-test.ts` both clean.

The catalog updates automatically — no edit to [`catalog.ts`](./catalog.ts) needed.
