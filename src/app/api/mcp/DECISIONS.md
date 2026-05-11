# MCP route — load-bearing tactical decisions

## D1 — Web Standard transport, not an adapter shim

**Date:** 2026-05-11
**Parcel:** 1
**Status:** Locked

The brief defaulted to an adapter shim that converts `NextRequest` /
`NextResponse` into Node-style `req`/`res` for the SDK's
`StreamableHTTPServerTransport`.

`@modelcontextprotocol/sdk@1.29.0` ships a second transport,
`WebStandardStreamableHTTPServerTransport`, that takes a Web Fetch `Request`
and returns a Web Fetch `Response` directly. This is the transport the SDK
recommends for Cloudflare Workers, Deno, Bun, and **Node.js 18+ with
Web Standard APIs** — which is exactly what Next 16 Route Handlers expose.

Using the Web Standard transport avoids:

- Hand-rolling a `req`/`res` polyfill (and getting SSE/headers wrong).
- An extra layer that has to be kept in sync with SDK changes.
- Awkward dependencies (would have needed `node:http` types in code that
  runs in the Next runtime).

The "small glue layer" the brief anticipated turns out to be zero: the
adapter is one `transport.handleRequest(req)` call.

If the SDK ever drops the Web Standard transport, fall back to the adapter
shim against `StreamableHTTPServerTransport`. Until then, we're aligned
with the SDK's own recommended runtime story.

## D2 — Stateless mode

**Date:** 2026-05-11
**Parcel:** 1
**Status:** Locked

The transport is constructed with `sessionIdGenerator: undefined`, putting
it in stateless mode. Each MCP request gets a fresh transport + server
pair.

Rationale:

- AP is hosted behind Railway. Sticky sessions across instances are not
  guaranteed. Stateless lets any worker handle any request.
- v1 surface is purely RPC — no resources subscriptions, no long-lived
  server-initiated streams, no resumability. None of those need session
  state.
- Per-request servers are cheap: tool registration is just object
  construction, and Parcel 1 ships zero tools.

When a use case for stateful sessions surfaces (e.g., progress
notifications across a long-running tool call), we move to a session map
keyed by `Mcp-Session-Id` — but that's a v2 concern.

## D3 — `GET /api/mcp` delegates to the transport (not a fixed 405)

**Date:** 2026-05-11
**Parcel:** 1
**Status:** Locked

The brief allows either `405` or "opens an SSE stream per spec." We chose
the latter so behaviour stays in sync with the SDK as the spec evolves. In
stateless mode with no event store, the SDK's GET handler returns the
spec-appropriate response (currently `405 Method Not Allowed` because
there's no standalone SSE channel to stream from) — but we don't hardcode
the answer, the SDK does. If the spec gains a feature that GET handles
without sessions, we get it for free.

## D4 — `Origin` validation lives in the route, not the transport

**Date:** 2026-05-11
**Parcel:** 1
**Status:** Locked

The transport ships a built-in `allowedOrigins` check, but on a mismatch
it returns `403`. The MCP spec 2025-06-18 + the build brief both say
missing or invalid `Origin` should be `400`. To keep error codes aligned
with the spec and the brief, we do the check in `route.ts` before
delegating to the transport, and leave `enableDnsRebindingProtection`
off in the transport options.

Allowlist for v1:

- `https://albertapulsecheck.ca`
- `http://localhost:3000`
- `http://127.0.0.1:3000`

## D5 — Body re-serialization for the transport

**Date:** 2026-05-11
**Parcel:** 1
**Status:** Locked

To detect whether a POST is an `initialize` request (so we can correctly
skip the `MCP-Protocol-Version` header check), the route handler reads the
JSON body before handing the request to the SDK transport. The transport
also calls `req.json()`, so we reconstruct a fresh `Request` object with
the body re-serialized (the original `Request`'s body stream is consumed
by then).

This adds one JSON round-trip per request. At v1 volumes it's
negligible, and it lets us keep header validation logic in the route
where it can return the spec-mandated `400` codes without reaching into
the transport.

If profiling ever shows this matters, the transport accepts an optional
`parsedBody` in its `HandleRequestOptions`, and we can hand it the already
parsed object instead of re-serializing.

## D6 — Smoke test bypasses the HTTP route, exercises `McpServer` directly

**Date:** 2026-05-11
**Parcel:** 1
**Status:** Locked

`scripts/mcp-smoke-test.ts` instantiates `createMcpServer()` and connects
it to an in-memory transport pair (using the SDK's `InMemoryTransport`),
then drives the `initialize` lifecycle from the client side. This avoids
needing a database, an API key, or a running Next server, and tests the
exact same `McpServer` instance the route uses.

When tool registration lands in later parcels, the smoke test extends
naturally to `tools/list` and `tools/call` against the same in-process
pair.

## D7 — Tool registry is one Record keyed by name, statuses inline

**Date:** 2026-05-11
**Parcel:** 2
**Status:** Locked

The registry holds every v1 + v2 tool in a single `Record<string, ToolEntry>`
with an inline `status: "live" | "planned" | "deferred"` field, rather than
two separate maps (one for live + planned v1 tools, one for deferred v2
tools).

Rationale:

- The catalog payload lists all 17 tools regardless of status. Two maps
  would mean either two iterations or merging them on every catalog build —
  pointless for a static metadata function.
- Parcels 3–5 flip status fields from `"planned"` to `"live"` via
  `updateToolEntry()`. Same callsite, same field, regardless of which
  parcel ships the change.
- A v2 tool moving to v1 is exactly the same operation as a v1 planned tool
  going live — flip `status`, fill `indicators`/`parameters_summary`. The
  two-map design would force a cross-map move for what is conceptually a
  status change.

If the v2 list grows past ~20 entries and the inline approach starts to
read poorly, split then.

## D8 — Catalog tool returns BOTH `text` and `structuredContent`

**Date:** 2026-05-11
**Parcel:** 2
**Status:** Locked

`alberta_catalog` emits its payload twice on each call:

- `content: [{ type: "text", text: JSON.stringify(payload, null, 2) }]` —
  for clients that only render text content blocks.
- `structuredContent: payload` — typed JSON the MCP spec carries
  alongside the text content for callers that want the parsed object.

Rationale:

- MCP spec 2025-06-18 supports both fields on `CallToolResult`. Clients
  vary in which they consume.
- Doubling the payload bytes is fine at catalog volumes (one call per
  agent session, payload measured in low KB).
- All typed tools in Parcels 3–5 will follow the same pattern, so
  callers can rely on it as a contract.

If response size becomes a concern for a chatty tool, drop the text block
on that tool only — keeping the typed structured form is the higher-value
half.

## D9 — Optional `domain?` filter on `alberta_catalog` deliberately not implemented

**Date:** 2026-05-11
**Parcel:** 2
**Status:** Locked

The build brief allowed an optional `domain?: string` filter on the
catalog tool, with a default of "do not implement." We took the default.

Rationale:

- The full catalog is small (~17 tools, ~30 live municipalities, a few
  hundred indicators worth of names). Agents can filter client-side.
- Adding the filter would mean an enum that has to stay in sync with
  `ToolDomain` and a partial-payload code path — added surface area for
  no real ergonomic win at v1.
- We can add it later without breaking callers (purely additive
  parameter).

## D10 — `MunicipalitySlugSchema` derived at module load, not lazy

**Date:** 2026-05-11
**Parcel:** 2
**Status:** Locked

`MunicipalitySlugSchema` is a `z.enum(...)` built once when
`schemas.ts` is imported, from `getLiveMunicipalities()`. Not a function,
not lazy.

Rationale:

- The municipality registry is in-process module state; reading it is
  free.
- Tools register at server-build time; the schema is referenced in their
  zod input shape. Lazy evaluation buys nothing.
- A module-load failure (empty registry) is now loud and immediate
  rather than surfacing on the first tool call.

If the registry ever becomes async-loaded (DB-backed, etc.), revisit —
the schema would need to be regenerated when the registry changes.

## D11 — Catalog ships the full 54-name regional indicator list inline

**Date:** 2026-05-11
**Parcel:** 3
**Status:** Locked

The brief left this as a judgment call: ship all 54 regional indicator
names in the catalog payload, or surface a count plus a representative
sample. We ship the full list.

Rationale:

- The catalog is one call per agent session. The full 54 names add
  roughly 1KB to the payload — negligible against the municipalities
  array (~30 entries with rich metadata) already in there.
- The indicator names are the agent's input enum. Showing only a sample
  forces a second discovery call (or, worse, guessing) to find the
  right name. The catalog's whole purpose is to make that round trip
  unnecessary.
- The registry's `updateToolEntry()` accepts `indicators: string[]`
  directly, and the regional tool already has `Object.keys(REGIONAL_INDICATORS)`
  in hand — listing the full array adds zero maintenance cost
  versus a curated sample (which would drift).

If a future regional indicator explosion pushes the inventory past
~200 names, revisit; until then, the full list stays inline.

## D12 — Macro tool fetches a LATEST-N window and filters explicit ranges client-side

**Date:** 2026-05-11
**Parcel:** 3
**Status:** Locked

For `alberta_macro`, named `time_range` values map to a periods count
that's passed to the substrate's LATEST-N fetcher. Explicit `{from, to}`
ranges are NOT translated into upstream date-range queries — we ask for
a wide-enough LATEST-N window (5y equivalent) and then filter the result
client-side.

Rationale:

- BoC Valet supports date-range queries but `fetchBoCTimeSeries` only
  exposes the LATEST-N path. Adding date-range support would mean
  editing `src/lib/data-sources.ts`, which is explicitly out of scope
  for Parcel 3.
- StatsCan's vector API has even less ergonomic date-range support; the
  substrate uses `getDataFromCubePidCoordAndLatestNPeriods` exclusively.
- The substrate's revalidate cache is keyed on the URL, so over-asking
  is essentially free after the first hit — and the in-flight dedup
  cache in `fetchStatCanTimeSeries` makes concurrent requests share
  a single fetch.

If a use case surfaces where this matters (e.g., backfilling pre-2020
data for an indicator with weekly cadence), extend the substrate fetcher
and update this decision.

## D13 — Regional tool reports served_from via csduid heuristic

**Date:** 2026-05-11
**Parcel:** 3
**Status:** Locked

`data-sources-regional.ts` already falls back to Postgres internally
when the regional dashboard API fails. Its `dbFallback()` returns
`RegionalDataPoint[]` with `csduid: ""` — the upstream always
populates a real CSDUID.

The regional tool uses that as a heuristic to set
`data.served_from`:

- empty result + non-empty after our second fallback try → `"fallback"`
- non-empty result, every csduid blank → `"fallback"` (substrate fell back)
- non-empty result, csduids populated → `"upstream"`
- empty result + empty fallback → `"empty"`

This avoids editing the substrate to expose its internal served-from
state, while still giving the calling agent a reliable signal of
freshness. If the substrate is ever refactored to populate CSDUID on
fallback rows, the heuristic breaks — leave a comment at the call site
pointing back here.

## D14 — Smoke test asserts shape, not non-empty data

**Date:** 2026-05-11
**Parcel:** 3
**Status:** Locked

The Parcel 3 smoke test exercises `tools/call alberta_macro` and
`tools/call alberta_regional` for real. But the test environment may
have no network (CI sandbox) or no `DATABASE_URL` (no Postgres
fallback), so the response can legitimately be empty.

The smoke test therefore asserts:

- The call did not error (no exception thrown, `isError !== true`).
- The envelope shape is correct (`schema_version`, `tool`, `source`).
- `data.served_from` is one of the three valid values.
- `data.points` is an array (possibly empty).

It does NOT assert `points.length > 0`. That assertion would belong in
an end-to-end test run against a live deployment with a known-up
upstream, not the in-process smoke test.
