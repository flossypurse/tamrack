import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import { fetchWildfireHistorical } from "@/lib/data-sources-infrastructure";

// GET /api/wildfire

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request, { requiredScopes: ["tamrack:economy:read"] });
  if (!authResult.authorized) return authResult.response;

  try {
    const data = await fetchWildfireHistorical();
    return NextResponse.json({
      source: "Alberta Open Data - Wildfire Historical",
      records: data.length,
      data: data.slice(-200),
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch wildfire data" }, { status: 500 });
  }
}
