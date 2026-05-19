import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import {
  fetchHousingStarts,
  fetchHousingCompletions,
  fetchUnderConstruction,
  fetchVacancyRates,
  fetchRentComparison,
  fetchAbsorptions,
  fetchMortgageRate,
} from "@/lib/data-sources-cmhc";
import {
  fetchCityAssessmentTrend,
  fetchTopNeighbourhoodsByAssessment,
} from "@/lib/data-sources-ualberta";

// GET /api/housing?type=starts|completions|construction|vacancy|rents|absorptions|mortgage|assessments|neighbourhoods
// Optional: &city=Edmonton|Calgary (for neighbourhoods)

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request, { requiredScopes: ["tamrack:real-estate:read"] });
  if (!authResult.authorized) return authResult.response;

  const type = request.nextUrl.searchParams.get("type");
  const city = request.nextUrl.searchParams.get("city") as "Edmonton" | "Calgary" | null;

  try {
    if (type === "starts") {
      const data = await fetchHousingStarts();
      return NextResponse.json({ type: "starts", records: data.length, data: data.slice(-60) });
    }
    if (type === "completions") {
      const data = await fetchHousingCompletions();
      return NextResponse.json({ type: "completions", records: data.length, data: data.slice(-60) });
    }
    if (type === "construction") {
      const data = await fetchUnderConstruction();
      return NextResponse.json({ type: "construction", records: data.length, data: data.slice(-60) });
    }
    if (type === "vacancy") {
      const data = await fetchVacancyRates();
      return NextResponse.json({ type: "vacancy", records: data.length, data });
    }
    if (type === "rents") {
      const data = await fetchRentComparison();
      return NextResponse.json({ type: "rents", records: data.length, data });
    }
    if (type === "absorptions") {
      const data = await fetchAbsorptions();
      return NextResponse.json({ type: "absorptions", data });
    }
    if (type === "mortgage") {
      const data = await fetchMortgageRate();
      return NextResponse.json({ type: "mortgage", records: data.length, data: data.slice(-60) });
    }
    if (type === "assessments") {
      const data = await fetchCityAssessmentTrend();
      return NextResponse.json({ type: "assessments", records: data.length, data });
    }
    if (type === "neighbourhoods") {
      const targetCity = city || "Edmonton";
      const data = await fetchTopNeighbourhoodsByAssessment(targetCity);
      return NextResponse.json({ type: "neighbourhoods", city: targetCity, records: data.length, data });
    }

    return NextResponse.json({
      available_types: [
        "starts", "completions", "construction", "vacancy", "rents",
        "absorptions", "mortgage", "assessments", "neighbourhoods",
      ],
      usage: "GET /api/housing?type=starts",
      sources: {
        "starts/completions/construction/vacancy/rents/absorptions/mortgage": "CMHC via StatsCan",
        "assessments/neighbourhoods": "UAlberta Open Data Centre",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch housing data" },
      { status: 500 }
    );
  }
}
