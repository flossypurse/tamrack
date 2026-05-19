import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import {
  fetchStatCanTimeSeries,
  fetchBoCTimeSeries,
  STATSCAN_SERIES,
  BOC_SERIES,
} from "@/lib/data-sources";

// GET /api/risk
// Returns risk indicators: unemployment, vacancy, housing starts, policy rate, energy index

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request, { requiredScopes: ["tamrack:macro:read"] });
  if (!authResult.authorized) return authResult.response;

  try {
    const [unemployment, vacancy, housingStarts, policyRate, energyIndex] =
      await Promise.all([
        fetchStatCanTimeSeries(
          STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.tableId,
          STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.coordinate,
          24
        ).catch(() => []),
        fetchStatCanTimeSeries(
          STATSCAN_SERIES.EDMONTON_VACANCY_RATE.tableId,
          STATSCAN_SERIES.EDMONTON_VACANCY_RATE.coordinate,
          10
        ).catch(() => []),
        fetchStatCanTimeSeries(
          STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.tableId,
          STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.coordinate,
          24
        ).catch(() => []),
        fetchBoCTimeSeries(BOC_SERIES.POLICY_RATE, 24).catch(() => []),
        fetchBoCTimeSeries(BOC_SERIES.BCPI_ENERGY, 24).catch(() => []),
      ]);

    return NextResponse.json({
      risk: {
        unemployment,
        vacancy,
        housingStarts,
        policyRate,
        energyIndex,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 }
    );
  }
}
