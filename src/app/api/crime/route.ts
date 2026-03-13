import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import {
  fetchCrimeSeverityIndex,
  fetchCrimeSeverityForMunicipality,
  fetchCalgaryCrimeStats,
  fetchCalgaryDisorderStats,
  fetchCrimeByCategory,
} from "@/lib/data-sources-crime";

// GET /api/crime?type=severity
// GET /api/crime?type=severity&municipality=Edmonton
// GET /api/crime?type=calgary-crime
// GET /api/crime?type=calgary-crime&category=Assault
// GET /api/crime?type=calgary-disorder

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request);
  if (!authResult.authorized) return authResult.response;

  const type = request.nextUrl.searchParams.get("type");
  const municipality = request.nextUrl.searchParams.get("municipality");
  const category = request.nextUrl.searchParams.get("category");

  try {
    if (type === "severity") {
      if (municipality) {
        const data = await fetchCrimeSeverityForMunicipality(municipality);
        return NextResponse.json({ municipality, records: data.length, data });
      }
      const data = await fetchCrimeSeverityIndex();
      return NextResponse.json({ records: data.length, data });
    }

    if (type === "calgary-crime") {
      if (category) {
        const data = await fetchCalgaryCrimeStats({
          "$where": `category='${category}'`,
          "$limit": "5000",
        });
        return NextResponse.json({ category, records: data.length, data: data.slice(0, 500) });
      }
      const data = await fetchCrimeByCategory();
      return NextResponse.json({ records: data.length, data });
    }

    if (type === "calgary-disorder") {
      const data = await fetchCalgaryDisorderStats();
      return NextResponse.json({ records: data.length, data: data.slice(0, 500) });
    }

    return NextResponse.json({
      available_types: ["severity", "calgary-crime", "calgary-disorder"],
      usage: "GET /api/crime?type=severity&municipality=Edmonton",
      examples: [
        "/api/crime?type=severity",
        "/api/crime?type=severity&municipality=Calgary",
        "/api/crime?type=calgary-crime",
        "/api/crime?type=calgary-crime&category=Assault",
        "/api/crime?type=calgary-disorder",
      ],
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch crime data", detail: String(error) },
      { status: 500 },
    );
  }
}
