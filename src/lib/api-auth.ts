import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, checkRateLimit, logApiUsage } from "./api-keys";
import { auth } from "./auth";

export type ApiAuthResult =
  | { authorized: true; userId: string; keyId: string | null }
  | { authorized: false; response: NextResponse };

export async function authenticateApiRequest(req: NextRequest): Promise<ApiAuthResult> {
  const endpoint = req.nextUrl.pathname;
  const authHeader = req.headers.get("authorization");

  // API key auth
  if (authHeader?.startsWith("Bearer ap_")) {
    const key = authHeader.slice(7);
    const result = await validateApiKey(key);
    if (!result) {
      return { authorized: false, response: NextResponse.json({ error: "Invalid API key" }, { status: 401 }) };
    }

    const rateCheck = await checkRateLimit(result.keyId);
    if (!rateCheck.allowed) {
      await logApiUsage(result.keyId, result.userId, endpoint, 429);
      return {
        authorized: false,
        response: NextResponse.json(
          { error: "Rate limit exceeded", limit: 1000, remaining: 0 },
          { status: 429, headers: { "X-RateLimit-Limit": "1000", "X-RateLimit-Remaining": "0" } }
        ),
      };
    }

    await logApiUsage(result.keyId, result.userId, endpoint, 200);
    return { authorized: true, userId: result.userId, keyId: result.keyId };
  }

  // Session auth (already validated by middleware)
  const session = await auth();
  if (session?.user?.id) {
    await logApiUsage(null, session.user.id, endpoint, 200);
    return { authorized: true, userId: session.user.id, keyId: null };
  }

  return { authorized: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
}
