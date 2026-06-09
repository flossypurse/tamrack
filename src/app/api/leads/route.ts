import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import { readLeadScores } from "@/lib/data-sources-leads";

// GET /api/leads?limit=N
//
// Per-geo demand-heat composite ranking across Alberta municipalities.
// Compute-on-read — no DB writes. Four sub-scores (hiring momentum,
// permit expansion, business formation, procurement backdrop) are
// min-max normalized across the geo set and weighted into a 0-100 composite.
//
// Honest scope: this is an aggregate directional demand-heat signal.
// Job Bank strips employer names so hiring signals are not per-company leads.
// The procurement sub-score is a provincial backdrop (same for all geos in v1).
//
// Scope: tamrack:economy:read.

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request, {
    requiredScopes: ["tamrack:economy:read"],
  });
  if (!authResult.authorized) return authResult.response;

  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit =
    limitParam != null && /^\d+$/.test(limitParam)
      ? Math.min(Math.max(parseInt(limitParam, 10), 1), 100)
      : undefined;

  try {
    const result = await readLeadScores();

    // Apply limit post-scoring so normalization is over the full geo set
    const rankings =
      limit != null ? result.rankings.slice(0, limit) : result.rankings;

    return NextResponse.json({
      type: "ranking",
      source: "Tamrack composite (Job Bank + municipality_permits + regional_indicators + opportunities)",
      ...result,
      rankings,
    });
  } catch (err) {
    console.error("[api/leads] error:", err);
    return NextResponse.json(
      { error: "Failed to compute lead scores" },
      { status: 500 },
    );
  }
}
