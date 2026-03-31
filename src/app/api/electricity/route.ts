import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import {
  fetchPoolPrice,
  fetchCurrentSupplyDemand,
  fetchActualForecast,
  fetchPoolPriceTimeSeries,
} from "@/lib/data-sources-aeso";

// GET /api/electricity?type=pool_price|supply_demand|forecast|price_history

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request);
  if (!authResult.authorized) return authResult.response;

  const type = request.nextUrl.searchParams.get("type");
  const startDate = request.nextUrl.searchParams.get("start_date") || undefined;
  const endDate = request.nextUrl.searchParams.get("end_date") || undefined;

  try {
    if (type === "pool_price") {
      const data = await fetchPoolPrice(startDate, endDate);
      return NextResponse.json({ type: "pool_price", records: data.length, data: data.slice(-48) });
    }

    if (type === "supply_demand") {
      const data = await fetchCurrentSupplyDemand();
      return NextResponse.json({ type: "supply_demand", data });
    }

    if (type === "forecast") {
      const data = await fetchActualForecast(startDate);
      return NextResponse.json({ type: "forecast", records: data.length, data: data.slice(-48) });
    }

    if (type === "price_history") {
      const days = parseInt(request.nextUrl.searchParams.get("days") || "30");
      const data = await fetchPoolPriceTimeSeries(days);
      return NextResponse.json({ type: "price_history", records: data.length, data });
    }

    return NextResponse.json({
      available_types: ["pool_price", "supply_demand", "forecast", "price_history"],
      usage: "GET /api/electricity?type=pool_price",
      note: "Requires AESO_API_KEY environment variable",
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch electricity data" }, { status: 500 });
  }
}
