import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import {
  REGIONAL_INDICATORS,
  fetchRegionalIndicator,
  fetchRegionalIndicatorForMunicipality,
  fetchRegionalTimeSeries,
} from "@/lib/data-sources-regional";

// GET /api/regional?indicator=Crime+Severity+Index&municipality=Edmonton
// If no indicator, list all available
// If no municipality, return all municipalities for that indicator

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request);
  if (!authResult.authorized) return authResult.response;

  const indicator = request.nextUrl.searchParams.get("indicator");
  const municipality = request.nextUrl.searchParams.get("municipality");

  try {
    if (!indicator) {
      return NextResponse.json({
        available: Object.keys(REGIONAL_INDICATORS),
        usage: "GET /api/regional?indicator=Crime Severity Index&municipality=Edmonton",
      });
    }

    if (municipality) {
      const data = await fetchRegionalTimeSeries(indicator, municipality);
      return NextResponse.json({ indicator, municipality, periods: data.length, data });
    }

    const data = await fetchRegionalIndicator(indicator);
    return NextResponse.json({ indicator, records: data.length, data });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch regional data" }, { status: 500 });
  }
}
