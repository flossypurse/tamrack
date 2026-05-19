import { NextRequest, NextResponse } from "next/server";
import {
  validateApiKey,
  checkRateLimit,
  logApiUsage,
  hasAcceptedKeyPrefix,
  incrementUserUnits,
  PLAN_LIMITS,
} from "./api-keys";
import { auth } from "./auth";
import { emitMeterEventAsync } from "./stripe-meters";

export type ApiAuthResult =
  | { authorized: true; userId: string; keyId: string | null; scopes: string[] }
  | { authorized: false; response: NextResponse };

export interface ApiAuthOptions {
  /**
   * When set, the key must carry at least one of the listed scopes or the
   * request gets 403. Multiple scopes are treated as ANY-of (the request
   * is permitted if the key has any one of them). Single-scope routes —
   * the common case for Tamrack's 5-scope taxonomy — pass `[scope]` and
   * the semantics collapse to "must have this exact scope".
   *
   * Empty / unset = no scope requirement (legacy behaviour).
   */
  requiredScopes?: string[];
  /**
   * Cost in "Tamrack units" for this request. Default 1 (1 endpoint call
   * = 1 unit per charter). Smart UI dashboard generation will pass 25.
   * Set explicitly when a route has a different cost profile.
   */
  costUnits?: number;
}

/**
 * Extract the bearer token from the Authorization header, accepting both
 * the new `tk_*` and legacy `ap_*` prefixes (90-day dual-accept window per
 * Tamrack charter). Returns null if no header or wrong prefix.
 */
function extractBearerKey(authHeader: string | null): string | null {
  if (!authHeader) return null;
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!hasAcceptedKeyPrefix(token)) return null;
  return token;
}

export async function authenticateApiRequest(
  req: NextRequest,
  options: ApiAuthOptions = {},
): Promise<ApiAuthResult> {
  const endpoint = req.nextUrl.pathname;
  const authHeader = req.headers.get("authorization");
  const requiredScopes = options.requiredScopes ?? [];
  const costUnits = options.costUnits ?? 1;

  const bearerKey = extractBearerKey(authHeader);

  // API key auth (tk_* or ap_* during dual-accept window)
  if (bearerKey) {
    const result = await validateApiKey(bearerKey);
    if (!result) {
      return { authorized: false, response: NextResponse.json({ error: "Invalid API key" }, { status: 401 }) };
    }

    const rateCheck = await checkRateLimit(result.keyId);
    if (!rateCheck.allowed) {
      await logApiUsage(result.keyId, result.userId, endpoint, 429, costUnits, false);
      return {
        authorized: false,
        response: NextResponse.json(
          { error: "Rate limit exceeded", limit: 1000, remaining: 0 },
          { status: 429, headers: { "X-RateLimit-Limit": "1000", "X-RateLimit-Remaining": "0" } }
        ),
      };
    }

    // Scope enforcement — any-of semantics. The 5-scope Tamrack taxonomy
    // uses single-scope routes so this collapses to a presence check.
    if (requiredScopes.length > 0) {
      const hasAny = requiredScopes.some((s) => result.scopes.includes(s));
      if (!hasAny) {
        await logApiUsage(result.keyId, result.userId, endpoint, 403, costUnits, false);
        return {
          authorized: false,
          response: NextResponse.json(
            { error: "Forbidden", required_scopes: requiredScopes, key_scopes: result.scopes },
            { status: 403 },
          ),
        };
      }
    }

    // Increment quota counter + decide whether this call was inside or
    // outside the plan's included units. `overage_units` > 0 means we
    // crossed the threshold during THIS call (partially or fully).
    const { plan, overage_units } = await incrementUserUnits(result.userId, costUnits);
    const countedTowardPlan = overage_units < costUnits;

    await logApiUsage(result.keyId, result.userId, endpoint, 200, costUnits, countedTowardPlan);

    // Non-blocking meter emit. Only fires when overage_units > 0 AND
    // the plan has meters_overage = true.
    if (overage_units > 0 && PLAN_LIMITS[plan]?.meters_overage) {
      emitMeterEventAsync({
        userId: result.userId,
        plan,
        overageUnits: overage_units,
        endpoint,
      });
    }

    return { authorized: true, userId: result.userId, keyId: result.keyId, scopes: result.scopes };
  }

  // Session auth (already validated by middleware). Session-auth requests
  // cannot satisfy scoped endpoints — scopes are an API-key concept.
  if (requiredScopes.length === 0) {
    const session = await auth();
    if (session?.user?.id) {
      // Session usage is logged at cost 0 — Tamrack billing is metered on
      // API/MCP/SmartUI traffic, not first-party web sessions.
      await logApiUsage(null, session.user.id, endpoint, 200, 0, true);
      return { authorized: true, userId: session.user.id, keyId: null, scopes: [] };
    }
  }

  return { authorized: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
}
