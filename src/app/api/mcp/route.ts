import { NextRequest, NextResponse } from "next/server";
import { SUPPORTED_PROTOCOL_VERSIONS } from "@modelcontextprotocol/sdk/types.js";
import { authenticateMcpRequest } from "./lib/auth";
import { dispatchMcpRequest } from "./lib/transport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Origin allowlist for DNS-rebinding prevention (MCP spec 2025-06-18).
 * Anything outside this list — including a missing Origin header — gets a 400.
 *
 * Extend here when a new first-party agent surface needs to reach the
 * hosted MCP endpoint from a browser context. Server-to-server callers
 * that don't set an Origin header are expected to use the in-process path
 * or set an allowlisted Origin explicitly.
 *
 * Tamrack-rebrand note: `tamrack.ca` is added below alongside the legacy
 * `albertapulsecheck.ca` host. Both stay valid through the dual-accept
 * window so external agents that still target the AP origin keep working
 * until cutover comms land.
 */
const ALLOWED_ORIGINS = new Set<string>([
  "https://tamrack.ca",
  "https://albertapulsecheck.ca",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

function jsonError(status: number, error: string): NextResponse {
  return NextResponse.json({ error }, { status });
}

function validateOrigin(req: NextRequest): NextResponse | null {
  const origin = req.headers.get("origin");
  if (!origin) return jsonError(400, "Missing Origin header");
  if (!ALLOWED_ORIGINS.has(origin)) return jsonError(400, "Invalid Origin header");
  return null;
}

/**
 * Always-required check for `MCP-Protocol-Version` (GET, DELETE — never initialize).
 */
function requireProtocolVersionHeader(req: NextRequest): NextResponse | null {
  const header = req.headers.get("mcp-protocol-version");
  if (!header) return jsonError(400, "Missing MCP-Protocol-Version header");
  if (!SUPPORTED_PROTOCOL_VERSIONS.includes(header)) {
    return jsonError(400, `Unsupported MCP-Protocol-Version: ${header}`);
  }
  return null;
}

/**
 * Validate `MCP-Protocol-Version` for POST. Initialize requests negotiate the
 * version inside the JSON-RPC body, so the header is optional there per spec.
 */
function validatePostProtocolVersion(
  req: NextRequest,
  body: unknown,
): NextResponse | null {
  if (isInitializeRequest(body)) return null;
  return requireProtocolVersionHeader(req);
}

function isInitializeRequest(body: unknown): boolean {
  if (Array.isArray(body)) return body.some(isInitializeRequest);
  if (!body || typeof body !== "object") return false;
  const method = (body as { method?: unknown }).method;
  return method === "initialize";
}

export async function POST(req: NextRequest): Promise<Response> {
  const originError = validateOrigin(req);
  if (originError) return originError;

  // Read the body once so we can both check `initialize` for the protocol
  // header rule and hand the parsed payload to the SDK transport.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }

  const versionError = validatePostProtocolVersion(req, body);
  if (versionError) return versionError;

  const auth = await authenticateMcpRequest(req);
  if (!auth.ok) return auth.response;

  // Rebuild the Request with the parsed body re-serialized so the transport
  // can `req.json()` it. We keep all original headers.
  const forwarded = new Request(req.url, {
    method: "POST",
    headers: req.headers,
    body: JSON.stringify(body),
  });
  return dispatchMcpRequest(forwarded, {
    userId: auth.userId,
    keyId: auth.keyId,
    scopes: auth.scopes,
  });
}

export async function GET(req: NextRequest): Promise<Response> {
  const originError = validateOrigin(req);
  if (originError) return originError;

  const versionError = requireProtocolVersionHeader(req);
  if (versionError) return versionError;

  const auth = await authenticateMcpRequest(req);
  if (!auth.ok) return auth.response;

  // GET opens the spec-defined server-initiated SSE stream. We delegate to
  // the transport so behaviour stays in sync with the SDK as the spec evolves.
  return dispatchMcpRequest(req, {
    userId: auth.userId,
    keyId: auth.keyId,
    scopes: auth.scopes,
  });
}

export async function DELETE(req: NextRequest): Promise<Response> {
  const originError = validateOrigin(req);
  if (originError) return originError;

  const versionError = requireProtocolVersionHeader(req);
  if (versionError) return versionError;

  const auth = await authenticateMcpRequest(req);
  if (!auth.ok) return auth.response;

  return dispatchMcpRequest(req, {
    userId: auth.userId,
    keyId: auth.keyId,
    scopes: auth.scopes,
  });
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204 });
}
