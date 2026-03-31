import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import {
  fetchBoCTimeSeries,
  fetchStatCanTimeSeries,
  fetchAlbertaActivityIndex,
  BOC_SERIES,
  STATSCAN_SERIES,
} from "@/lib/data-sources";

// GET /api/macro?indicator=policy_rate|cad_usd|mortgage_5y|unemployment|cpi|gdp|housing_starts|aax|...
// Returns normalized time series data for macro economic indicators

const INDICATOR_MAP: Record<
  string,
  { type: "boc" | "statscan" | "custom"; key?: string; tableId?: number; coordinate?: string; label: string }
> = {
  policy_rate: { type: "boc", key: "V39079", label: "BoC Policy Rate" },
  prime_rate: { type: "boc", key: "V80691311", label: "Prime Rate" },
  cad_usd: { type: "boc", key: "FXCADUSD", label: "CAD/USD Exchange Rate" },
  mortgage_5y_fixed: { type: "boc", key: "V80691335", label: "5Y Fixed Mortgage Rate" },
  mortgage_5y_variable: { type: "boc", key: "V80691336", label: "5Y Variable Mortgage Rate" },
  bcpi: { type: "boc", key: "M.BCPI", label: "BoC Commodity Price Index" },
  bcpi_energy: { type: "boc", key: "M.ENER", label: "BCPI Energy" },
  bcpi_agriculture: { type: "boc", key: "M.AGRI", label: "BCPI Agriculture" },
  unemployment: {
    type: "statscan",
    tableId: STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.tableId,
    coordinate: STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.coordinate,
    label: "Alberta Unemployment Rate",
  },
  employment: {
    type: "statscan",
    tableId: STATSCAN_SERIES.AB_EMPLOYMENT.tableId,
    coordinate: STATSCAN_SERIES.AB_EMPLOYMENT.coordinate,
    label: "Alberta Employment (thousands)",
  },
  cpi: {
    type: "statscan",
    tableId: STATSCAN_SERIES.AB_CPI.tableId,
    coordinate: STATSCAN_SERIES.AB_CPI.coordinate,
    label: "Alberta CPI",
  },
  population: {
    type: "statscan",
    tableId: STATSCAN_SERIES.AB_POPULATION.tableId,
    coordinate: STATSCAN_SERIES.AB_POPULATION.coordinate,
    label: "Alberta Population",
  },
  gdp: {
    type: "statscan",
    tableId: STATSCAN_SERIES.AB_GDP.tableId,
    coordinate: STATSCAN_SERIES.AB_GDP.coordinate,
    label: "Alberta GDP (chained 2017$)",
  },
  housing_starts: {
    type: "statscan",
    tableId: STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.tableId,
    coordinate: STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.coordinate,
    label: "Edmonton CMA Housing Starts",
  },
  housing_completions: {
    type: "statscan",
    tableId: STATSCAN_SERIES.EDMONTON_HOUSING_COMPLETIONS.tableId,
    coordinate: STATSCAN_SERIES.EDMONTON_HOUSING_COMPLETIONS.coordinate,
    label: "Edmonton CMA Housing Completions",
  },
  weekly_earnings: {
    type: "statscan",
    tableId: STATSCAN_SERIES.AB_WEEKLY_EARNINGS.tableId,
    coordinate: STATSCAN_SERIES.AB_WEEKLY_EARNINGS.coordinate,
    label: "Alberta Average Weekly Earnings",
  },
  retail_sales: {
    type: "statscan",
    tableId: STATSCAN_SERIES.AB_RETAIL_SALES.tableId,
    coordinate: STATSCAN_SERIES.AB_RETAIL_SALES.coordinate,
    label: "Alberta Retail Sales",
  },
  aax: { type: "custom", label: "Alberta Activity Index" },
};

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request);
  if (!authResult.authorized) return authResult.response;

  const indicator = request.nextUrl.searchParams.get("indicator");
  const periods = parseInt(request.nextUrl.searchParams.get("periods") || "24");

  try {
    // Single indicator
    if (indicator && INDICATOR_MAP[indicator]) {
      const spec = INDICATOR_MAP[indicator];
      let data: { date: string; value: number }[] = [];

      if (spec.type === "boc" && spec.key) {
        data = await fetchBoCTimeSeries(spec.key, periods);
      } else if (spec.type === "statscan" && spec.tableId && spec.coordinate) {
        data = await fetchStatCanTimeSeries(spec.tableId, spec.coordinate, periods);
      } else if (spec.type === "custom" && indicator === "aax") {
        const all = await fetchAlbertaActivityIndex();
        data = all.slice(-periods);
      }

      return NextResponse.json({
        indicator: indicator,
        label: spec.label,
        source: spec.type === "boc" ? "Bank of Canada Valet API" : spec.type === "statscan" ? "Statistics Canada WDS" : "Alberta Open Data",
        periods: data.length,
        data,
      });
    }

    // List available indicators
    if (!indicator) {
      return NextResponse.json({
        available: Object.entries(INDICATOR_MAP).map(([key, spec]) => ({
          indicator: key,
          label: spec.label,
          source: spec.type,
        })),
        usage: "GET /api/macro?indicator=policy_rate&periods=24",
      });
    }

    return NextResponse.json(
      { error: `Unknown indicator: ${indicator}`, available: Object.keys(INDICATOR_MAP) },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch macro data" },
      { status: 500 }
    );
  }
}
