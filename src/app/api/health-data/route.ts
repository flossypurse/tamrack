import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import {
  fetchLifeExpectancy,
  fetchBirthsAndDeaths,
  fetchLeadingCausesOfDeath,
} from "@/lib/data-sources-health";

// GET /api/health-data?type=life-expectancy
// GET /api/health-data?type=life-expectancy&municipality=Edmonton
// GET /api/health-data?type=births-deaths
// GET /api/health-data?type=births-deaths&municipality=Edmonton
// GET /api/health-data?type=leading-causes

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request);
  if (!authResult.authorized) return authResult.response;

  const type = request.nextUrl.searchParams.get("type");
  const municipality = request.nextUrl.searchParams.get("municipality") || undefined;

  try {
    if (type === "life-expectancy") {
      const data = await fetchLifeExpectancy(municipality);
      return NextResponse.json({
        type: "life-expectancy",
        municipality: municipality || "all",
        records: data.length,
        data,
      });
    }

    if (type === "births-deaths") {
      const data = await fetchBirthsAndDeaths(municipality);
      return NextResponse.json({
        type: "births-deaths",
        municipality: municipality || "all",
        records: data.length,
        data,
      });
    }

    if (type === "leading-causes") {
      const data = await fetchLeadingCausesOfDeath();
      return NextResponse.json({
        type: "leading-causes",
        scope: "Alberta (province-wide)",
        records: data.length,
        data,
      });
    }

    return NextResponse.json({
      available_types: ["life-expectancy", "births-deaths", "leading-causes"],
      usage: "GET /api/health-data?type=life-expectancy&municipality=Edmonton",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch health data" },
      { status: 500 }
    );
  }
}
