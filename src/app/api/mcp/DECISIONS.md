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
