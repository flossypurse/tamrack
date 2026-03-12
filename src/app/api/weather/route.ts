import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import {
  fetchAlbertaWeather,
  fetchAlbertaAQHI,
  fetchClimateMonthly,
} from "@/lib/data-sources";

// GET /api/weather?type=current|aqhi|climate&station=3012216
export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request);
  if (!authResult.authorized) return authResult.response;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "current";

  try {
    switch (type) {
      case "current": {
        const data = await fetchAlbertaWeather();
        return NextResponse.json({ type: "current_weather", count: data.length, data });
      }
      case "aqhi": {
        const data = await fetchAlbertaAQHI();
        return NextResponse.json({ type: "aqhi", count: data.length, data });
      }
      case "climate": {
        const station = searchParams.get("station") || "3012216";
        const limit = parseInt(searchParams.get("limit") || "60");
        const data = await fetchClimateMonthly(station, limit);
        return NextResponse.json({ type: "climate_monthly", station, count: data.length, data });
      }
      default:
        return NextResponse.json({ error: `Unknown type: ${type}. Use current, aqhi, or climate` }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch weather data" }, { status: 500 });
  }
}
