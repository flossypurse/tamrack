import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import {
  fetchRoadConditions,
  fetchTrafficEvents,
  fetchTrafficAlerts,
  fetchEdmontonTrafficDisruptions,
  fetchCalgaryTrafficIncidents,
} from "@/lib/data-sources";

// GET /api/traffic?type=roads|events|alerts|edmonton|calgary|all
export async function GET(request: NextRequest) {
  const authError = await authenticateApiRequest(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "all";

  try {
    switch (type) {
      case "roads": {
        const data = await fetchRoadConditions();
        return NextResponse.json({ type: "road_conditions", count: data.length, data });
      }
      case "events": {
        const data = await fetchTrafficEvents();
        return NextResponse.json({ type: "traffic_events", count: data.length, data });
      }
      case "alerts": {
        const data = await fetchTrafficAlerts();
        return NextResponse.json({ type: "traffic_alerts", count: data.length, data });
      }
      case "edmonton": {
        const data = await fetchEdmontonTrafficDisruptions();
        return NextResponse.json({ type: "edmonton_disruptions", count: data.length, data });
      }
      case "calgary": {
        const data = await fetchCalgaryTrafficIncidents();
        return NextResponse.json({ type: "calgary_incidents", count: data.length, data });
      }
      case "all": {
        const [roads, events, alerts] = await Promise.all([
          fetchRoadConditions(),
          fetchTrafficEvents(),
          fetchTrafficAlerts(),
        ]);
        return NextResponse.json({
          type: "all_traffic",
          roads: { count: roads.length, data: roads },
          events: { count: events.length, data: events },
          alerts: { count: alerts.length, data: alerts },
        });
      }
      default:
        return NextResponse.json({ error: `Unknown type: ${type}. Use roads, events, alerts, edmonton, calgary, or all` }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch traffic data" }, { status: 500 });
  }
}
