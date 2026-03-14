import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import { fetchAlbertaEmergencyAlerts } from "@/lib/data-sources";
import {
  fetchAlbertaMLAs,
  fetchAlbertaElectoralDistricts,
} from "@/lib/data-sources-politics";

// GET /api/safety?type=alerts|mlas|districts
export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request);
  if (!authResult.authorized) return authResult.response;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "alerts";

  try {
    switch (type) {
      case "alerts": {
        const data = await fetchAlbertaEmergencyAlerts();
        return NextResponse.json({ type: "emergency_alerts", count: data.length, data });
      }
      case "mlas": {
        const data = await fetchAlbertaMLAs();
        return NextResponse.json({ type: "mlas", count: data.length, data });
      }
      case "districts": {
        const data = await fetchAlbertaElectoralDistricts();
        return NextResponse.json({ type: "electoral_districts", count: data.length, data });
      }
      default:
        return NextResponse.json({ error: `Unknown type: ${type}. Use alerts, mlas, or districts` }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch safety data" }, { status: 500 });
  }
}
