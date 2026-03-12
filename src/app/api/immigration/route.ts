import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import {
  fetchImmigrationByCategory,
  fetchImmigrationByCMA,
  fetchImmigrationByOccupation,
  fetchImmigrationTimeSeries,
} from "@/lib/data-sources-ircc";

// GET /api/immigration?type=category|cma|occupation|trend&province=Alberta&cma=Edmonton

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request);
  if (!authResult.authorized) return authResult.response;

  const type = request.nextUrl.searchParams.get("type");
  const province = request.nextUrl.searchParams.get("province") || "Alberta";
  const cma = request.nextUrl.searchParams.get("cma") || "Edmonton";

  try {
    if (type === "category") {
      const data = await fetchImmigrationByCategory(province);
      return NextResponse.json({ type: "category", province, records: data.length, data });
    }

    if (type === "cma") {
      const data = await fetchImmigrationByCMA(cma);
      return NextResponse.json({ type: "cma", cma, records: data.length, data });
    }

    if (type === "occupation") {
      const data = await fetchImmigrationByOccupation(province);
      return NextResponse.json({ type: "occupation", province, records: data.length, data });
    }

    if (type === "trend") {
      const data = await fetchImmigrationTimeSeries(province);
      return NextResponse.json({ type: "trend", province, records: data.length, data });
    }

    return NextResponse.json({
      available_types: ["category", "cma", "occupation", "trend"],
      usage: "GET /api/immigration?type=trend&province=Alberta",
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch immigration data", detail: String(error) }, { status: 500 });
  }
}
