import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import {
  fetchEdmontonFireRecent,
  fetchEdmontonFireByType,
  fetchEdmontonFireByNeighbourhood,
  fetchEdmontonFireMonthlyTrend,
  fetchCWFISActiveFires,
  fetch511Alerts,
} from "@/lib/data-sources-fire";

// GET /api/fire?type=edmonton-recent
// GET /api/fire?type=edmonton-by-type
// GET /api/fire?type=edmonton-by-neighbourhood
// GET /api/fire?type=edmonton-trend
// GET /api/fire?type=active-fires
// GET /api/fire?type=alerts

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request, { requiredScopes: ["tamrack:economy:read"] });
  if (!authResult.authorized) return authResult.response;

  const type = request.nextUrl.searchParams.get("type");

  try {
    if (type === "edmonton-recent") {
      const limit = parseInt(request.nextUrl.searchParams.get("limit") || "1000", 10);
      const data = await fetchEdmontonFireRecent(limit);
      return NextResponse.json({ records: data.length, data });
    }

    if (type === "edmonton-by-type") {
      const data = await fetchEdmontonFireByType();
      return NextResponse.json({ records: data.length, data });
    }

    if (type === "edmonton-by-neighbourhood") {
      const limit = parseInt(request.nextUrl.searchParams.get("limit") || "25", 10);
      const data = await fetchEdmontonFireByNeighbourhood(limit);
      return NextResponse.json({ records: data.length, data });
    }

    if (type === "edmonton-trend") {
      const years = parseInt(request.nextUrl.searchParams.get("years") || "3", 10);
      const data = await fetchEdmontonFireMonthlyTrend(years);
      return NextResponse.json({ records: data.length, data });
    }

    if (type === "active-fires") {
      const data = await fetchCWFISActiveFires();
      return NextResponse.json({ records: data.length, data });
    }

    if (type === "alerts") {
      const data = await fetch511Alerts();
      return NextResponse.json({ records: data.length, data });
    }

    return NextResponse.json({
      available_types: [
        "edmonton-recent",
        "edmonton-by-type",
        "edmonton-by-neighbourhood",
        "edmonton-trend",
        "active-fires",
        "alerts",
      ],
      usage: "GET /api/fire?type=edmonton-recent",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch fire data" },
      { status: 500 }
    );
  }
}
