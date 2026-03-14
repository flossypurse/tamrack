import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import {
  fetchAlbertaGrants,
  fetchFederalTransfers,
  fetchFederalContractsAB,
  fetchFederalGrantsAB,
} from "@/lib/data-sources-fiscal";

// GET /api/fiscal?type=grants|transfers|contracts|federal-grants

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request);
  if (!authResult.authorized) return authResult.response;

  const type = request.nextUrl.searchParams.get("type");
  const fiscalYear = request.nextUrl.searchParams.get("fiscal_year") || undefined;
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "500", 10);

  try {
    if (type === "grants") {
      const data = await fetchAlbertaGrants(fiscalYear);
      return NextResponse.json({ type: "grants", records: data.length, data: data.slice(0, limit) });
    }

    if (type === "transfers") {
      const data = await fetchFederalTransfers();
      return NextResponse.json({ type: "transfers", records: data.length, data });
    }

    if (type === "contracts") {
      const data = await fetchFederalContractsAB(limit);
      return NextResponse.json({ type: "contracts", records: data.length, data });
    }

    if (type === "federal-grants") {
      const data = await fetchFederalGrantsAB(limit);
      return NextResponse.json({ type: "federal-grants", records: data.length, data });
    }

    return NextResponse.json({
      available_types: ["grants", "transfers", "contracts", "federal-grants"],
      usage: "GET /api/fiscal?type=grants",
      examples: [
        "/api/fiscal?type=grants",
        "/api/fiscal?type=grants&fiscal_year=2024-25",
        "/api/fiscal?type=transfers",
        "/api/fiscal?type=contracts&limit=200",
        "/api/fiscal?type=federal-grants&limit=200",
      ],
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch fiscal data", detail: String(error) },
      { status: 500 }
    );
  }
}
