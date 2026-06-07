import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import { readHiringSummary } from "@/lib/data-sources-jobbank";

// GET /api/hiring?type=signals[&month=YYYY-MM]
//
// Latent-demand feed: Alberta hiring activity for manual-process/automatable
// roles (Canada Job Bank), accumulated by the daily collector and read here from
// Postgres. Aggregate sector/geo/role strain signal — ESDC strips employer names,
// so this is not a per-company lead. Scope: tamrack:economy:read.

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request, {
    requiredScopes: ["tamrack:economy:read"],
  });
  if (!authResult.authorized) return authResult.response;

  const type = request.nextUrl.searchParams.get("type");

  try {
    if (type === null || type === "signals") {
      const monthRaw = request.nextUrl.searchParams.get("month") ?? undefined;
      const month =
        monthRaw && /^\d{4}-\d{2}$/.test(monthRaw) ? monthRaw : undefined;
      const summary = await readHiringSummary(month);
      return NextResponse.json({
        type: "signals",
        source: "Canada Job Bank monthly open data (ESDC, OGL-Canada)",
        summary,
      });
    }

    return NextResponse.json({
      available_types: ["signals"],
      usage: "GET /api/hiring?type=signals&month=2026-05",
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch hiring signals" },
      { status: 500 },
    );
  }
}
