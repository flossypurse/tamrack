import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import { fetchStatCanTimeSeries, STATSCAN_SERIES } from "@/lib/data-sources";

// GET /api/pipeline
// Returns housing starts, completions, and under construction for Edmonton CMA

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const [starts, completions, underConstruction] = await Promise.all([
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.tableId,
        STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.coordinate,
        24
      ).catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.EDMONTON_HOUSING_COMPLETIONS.tableId,
        STATSCAN_SERIES.EDMONTON_HOUSING_COMPLETIONS.coordinate,
        24
      ).catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.EDMONTON_UNDER_CONSTRUCTION.tableId,
        STATSCAN_SERIES.EDMONTON_UNDER_CONSTRUCTION.coordinate,
        24
      ).catch(() => []),
    ]);

    return NextResponse.json({
      pipeline: {
        starts,
        completions,
        underConstruction,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 }
    );
  }
}
