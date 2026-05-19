import type { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";

export type McpAuthResult =
  | { ok: true; userId: string; keyId: string | null; scopes: string[] }
  | { ok: false; response: NextResponse };

/**
 * Thin wrapper over `authenticateApiRequest` for the MCP route.
 *
 * Reshapes the return type so callers in `route.ts` can write
 *   const auth = await authenticateMcpRequest(req);
 *   if (!auth.ok) return auth.response;
 *
 * Auth itself (token validation, rate limiting, usage logging) is unchanged —
 * we reuse the existing AP API key infra verbatim.
 *
 * IMPORTANT: this auth call does NOT enforce scopes. Per-tool scope
 * enforcement happens inside each tool handler via `requireScopes()`
 * because the JSON-RPC handshake doesn't yet know which tool will be
 * called. The MCP route passes the authenticated scopes into
 * `dispatchMcpRequest()` so tools can fetch them via AsyncLocalStorage.
 */
export async function authenticateMcpRequest(
  req: NextRequest,
): Promise<McpAuthResult> {
  const result = await authenticateApiRequest(req);
  if (result.authorized) {
    return {
      ok: true,
      userId: result.userId,
      keyId: result.keyId,
      scopes: result.scopes,
    };
  }
  return { ok: false, response: result.response };
}
