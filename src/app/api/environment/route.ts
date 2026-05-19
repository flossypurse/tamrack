import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import {
  fetchAlbertaWaterLevels,
  fetchActiveWildfires,
  fetchNonActiveWildfires,
  fetchAlbertaEarthquakes,
} from "@/lib/data-sources";

// GET /api/environment?type=water|wildfires|earthquakes
export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request, { requiredScopes: ["tamrack:economy:read"] });
  if (!authResult.authorized) return authResult.response;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "water";

  try {
    switch (type) {
      case "water": {
        const data = await fetchAlbertaWaterLevels();
        return NextResponse.json({ type: "water_levels", count: data.length, data });
      }
      case "wildfires": {
        const [active, nonActive] = await Promise.all([
          fetchActiveWildfires(),
          fetchNonActiveWildfires(),
        ]);
        return NextResponse.json({
          type: "wildfires",
          active: { count: active.length, data: active },
          season: { count: nonActive.length, data: nonActive },
        });
      }
      case "earthquakes": {
        const days = parseInt(searchParams.get("days") || "365");
        const data = await fetchAlbertaEarthquakes(days);
        return NextResponse.json({ type: "earthquakes", days, count: data.length, data });
      }
      default:
        return NextResponse.json({ error: `Unknown type: ${type}. Use water, wildfires, or earthquakes` }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch environment data" }, { status: 500 });
  }
}
