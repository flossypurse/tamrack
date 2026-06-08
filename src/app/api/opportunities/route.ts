import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import { readOpportunities } from "@/lib/data-sources-procurement";

// GET /api/opportunities?type=tenders[&open=1&closing_before=YYYY-MM-DD&limit=100]
//
// Demand-side feed: CanadaBuys federal open tender notices (IT/software/AI/data),
// accumulated by the daily collector and read here from Postgres. Soonest-closing
// first. Scope: tamrack:economy:read.

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request, {
    requiredScopes: ["tamrack:economy:read"],
  });
  if (!authResult.authorized) return authResult.response;

  const type = request.nextUrl.searchParams.get("type");

  try {
    if (type === null || type === "tenders") {
      const openOnly = request.nextUrl.searchParams.get("open") === "1";
      const closingBeforeRaw =
        request.nextUrl.searchParams.get("closing_before") ?? undefined;
      const closingBefore =
        closingBeforeRaw && /^\d{4}-\d{2}-\d{2}$/.test(closingBeforeRaw)
          ? closingBeforeRaw
          : undefined;
      const limit = Math.min(
        parseInt(request.nextUrl.searchParams.get("limit") ?? "100", 10) || 100,
        500,
      );
      const data = await readOpportunities({ openOnly, closingBefore, limit });
      return NextResponse.json({
        type: "tenders",
        source: "CanadaBuys open tender notices (PSPC open data)",
        records: data.length,
        data,
      });
    }

    return NextResponse.json({
      available_types: ["tenders"],
      usage: "GET /api/opportunities?type=tenders&open=1&limit=20",
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch opportunities" },
      { status: 500 },
    );
  }
}
