import type { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";

export type McpAuthResult =
  | { ok: true; userId: string; keyId: string | null }
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
 */
export async function authenticateMcpRequest(
  req: NextRequest,
): Promise<McpAuthResult> {
  const result = await authenticateApiRequest(req);
  if (result.authorized) {
    return { ok: true, userId: result.userId, keyId: result.keyId };
  }
  return { ok: false, response: result.response };
}
