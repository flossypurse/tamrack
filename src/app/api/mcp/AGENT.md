# MCP Server — `/api/mcp`

A hosted Model Context Protocol server that exposes Alberta Pulse's data substrate to AI agents through one transport. Streamable HTTP, Bearer auth, runs in the same Next.js app on the same Railway service as the rest of the webui.

For the why and the full design rationale, read [`docs/MCP-SERVER-DESIGN.md`](../../../../docs/MCP-SERVER-DESIGN.md). This file is the operating manual.

## Substrate-first invariant

Every MCP tool reads from the same `src/lib/data-sources*.ts` modules and the same Postgres fallback that the public HTTP routes read from. If data isn't already in the substrate, it isn't in MCP either. New data lands in the substrate first; any consumer accesses it after that. The MCP route never reaches outside the substrate.

## Registration (client side)

Once Cully has issued a Bearer token (see below), an MCP client registers the server like any other remote MCP endpoint:

```
claude mcp add alberta-pulse \
  --transport http \
  --url https://albertapulsecheck.ca/api/mcp \
  --header "Authorization: Bearer ap_<key>"
```

Local development uses the same flow against `http://localhost:3000/api/mcp` with a dev token.

## Token issuance

The MCP server reuses the existing AP API key infrastructure. Tokens look like `ap_<random>` and are validated by `authenticateApiRequest()` in [`src/lib/api-auth.ts`](../../../lib/api-auth.ts).

To issue a token, hit the existing admin route while signed into the AP account:

```
POST /api/api-keys
Cookie: <session cookie>
Content-Type: application/json

{ "name": "claude-code-workspace" }
```

The response includes a one-time-visible `key` field. Store it; it can't be recovered. Per-agent tokens are preferred so usage shows up cleanly in the existing `logApiUsage` table and one agent's revocation doesn't affect others.

To revoke: `DELETE /api/api-keys` with `{ "keyId": "..." }`.

## Tools (v1)

Nine tools. The catalog tool advertises the live schemas; descriptions below are one-line summaries.

| Tool | What it returns |
|------|-----------------|
| `alberta_catalog` | Full discovery: tool list, domain index, indicator inventory, municipality list, example invocations. Static metadata generated from the in-process registry. |
| `alberta_municipality` | Registry-backed summary card for a slug — name, region, population, capabilities, best-effort metrics. |
| `alberta_regional` | regionaldashboard.alberta.ca — 54 indicators × ~340 municipalities. Workhorse for any regional time-series. |
| `alberta_real_estate` | ArcGIS assessments / permits / dev_permits per supported municipality. Returns `{ available: false, reason }` for slug+dataset combos the registry doesn't support. |
| `alberta_macro` | BoC Valet (policy rate, CAD/USD, mortgage 5y) + StatsCan (unemployment, CPI, GDP, housing starts) + Alberta Activity Index. 8 indicators. |
| `alberta_housing` | CMHC starts, completions, under-construction, snapshot, vacancy, rents, absorptions, mortgage rate. |
| `alberta_business` | Edmonton/Calgary business licences, StatsCan business counts, GHG facilities, top emitters, WCB, retail subsectors, ecommerce, food services, business dynamics. |
| `alberta_energy` | AESO pool price / supply-demand / forecast + CER pipeline throughput / incidents / apportionment / oil production. |
| `alberta_search` | Alberta CKAN dataset search — long-tail escape hatch when none of the above fit. |

Eight more tools (`alberta_entities`, `alberta_safety`, `alberta_immigration`, `alberta_politics`, `alberta_fiscal`, `alberta_environment`, `alberta_health`, `alberta_signals`) are advertised in the catalog with `status: "deferred"`. They land in v2 once the corresponding substrate work is done.

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
- `./tools/*.ts` — one file per tool. Each defines its zod input, wraps the substrate fetcher, falls back gracefully, and registers itself.
- [`lib/auth.ts`](./lib/auth.ts) — thin wrapper over `authenticateApiRequest`.
- [`lib/transport.ts`](./lib/transport.ts) — SDK's Web Standard transport in stateless mode.
- [`DECISIONS.md`](./DECISIONS.md) — load-bearing tactical decisions.

## Smoke test

```
npx tsx scripts/mcp-smoke-test.ts
```

Round-trips `initialize` → `tools/list` → one `tools/call` per tool against an in-memory transport pair (no HTTP, no DB, no token). Prints `PASS` when all assertions hold.

## Rate limit

Inherits AP's existing per-key rate limit (1000-per-window). Bump per token if a specific agent's traffic shape needs it. Anomaly review uses the same `api_usage` table the rest of `/api/*` writes to.

## Adding a new tool

1. Add or update the entry in [`registry.ts`](./registry.ts). New entries default to `status: "planned"`.
2. Create a new file under `./tools/` following the existing pattern: zod input shape, envelope output, defensive `.parse()`, module-load `updateToolEntry(name, { status: "live", ... })`.
3. Register it from [`server.ts`](./server.ts).
4. Extend [`scripts/mcp-smoke-test.ts`](../../../../scripts/mcp-smoke-test.ts) with at least one `tools/call` assertion.
5. `npm run build` and `npx tsx scripts/mcp-smoke-test.ts` both clean.

The catalog updates automatically — no edit to [`catalog.ts`](./catalog.ts) needed.
