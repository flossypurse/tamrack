import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import { fetchStatCanTimeSeries, STATSCAN_SERIES } from "@/lib/data-sources";

// GET /api/rental
// Returns rental market data for Edmonton CMA

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const [vacancyRate, bachelor, oneBed, twoBed, threeBed] =
      await Promise.all([
        fetchStatCanTimeSeries(
          STATSCAN_SERIES.EDMONTON_VACANCY_RATE.tableId,
          STATSCAN_SERIES.EDMONTON_VACANCY_RATE.coordinate,
          10
        ).catch(() => []),
        fetchStatCanTimeSeries(
          STATSCAN_SERIES.EDMONTON_RENT_BACHELOR.tableId,
          STATSCAN_SERIES.EDMONTON_RENT_BACHELOR.coordinate,
          10
        ).catch(() => []),
        fetchStatCanTimeSeries(
          STATSCAN_SERIES.EDMONTON_RENT_1BED.tableId,
          STATSCAN_SERIES.EDMONTON_RENT_1BED.coordinate,
          10
        ).catch(() => []),
        fetchStatCanTimeSeries(
          STATSCAN_SERIES.EDMONTON_RENT_2BED.tableId,
          STATSCAN_SERIES.EDMONTON_RENT_2BED.coordinate,
          10
        ).catch(() => []),
        fetchStatCanTimeSeries(
          STATSCAN_SERIES.EDMONTON_RENT_3BED.tableId,
          STATSCAN_SERIES.EDMONTON_RENT_3BED.coordinate,
          10
        ).catch(() => []),
      ]);

    return NextResponse.json({
      rental: {
        vacancyRate,
        rents: {
          bachelor,
          oneBed,
          twoBed,
          threeBed,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch data", detail: String(error) },
      { status: 500 }
    );
  }
}
