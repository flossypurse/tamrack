import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import {
  fetchVacancyRates,
  fetchRentComparison,
} from "@/lib/data-sources-cmhc";

// GET /api/rental
// Returns rental market data for Edmonton and Calgary CMAs

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const [vacancyRates, rents] = await Promise.all([
      fetchVacancyRates(10).catch(() => []),
      fetchRentComparison(10).catch(() => []),
    ]);

    return NextResponse.json({
      rental: {
        vacancyRates,
        rents,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 }
    );
  }
}
