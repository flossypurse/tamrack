import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import {
  fetchEdmontonBusinessLicenceDetails,
  fetchEdmontonBusinessDetailedCategories,
  fetchEdmontonBusinessCount,
  fetchCalgaryBusinessByType,
  fetchCalgaryBusinessByDistrict,
  fetchCalgaryBusinessCount,
  fetchCalgaryBusinessTrend,
  fetchStatCanBusinessCounts,
  fetchStatCanBusinessBySector,
  fetchGHGFacilities,
  fetchTopEmittersByCompany,
  fetchWCBByIndustry,
  fetchNonProfitsByCity,
  fetchNonProfitsByType,
  fetchCRAT2Stats,
} from "@/lib/data-sources-business";

// GET /api/business?type=edmonton-licences
// GET /api/business?type=edmonton-categories
// GET /api/business?type=calgary-types
// GET /api/business?type=calgary-districts
// GET /api/business?type=calgary-trend
// GET /api/business?type=counts
// GET /api/business?type=sectors
// GET /api/business?type=ghg-facilities
// GET /api/business?type=top-emitters
// GET /api/business?type=wcb-industries
// GET /api/business?type=nonprofits-by-city
// GET /api/business?type=nonprofits-by-type
// GET /api/business?type=cra-t2

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request);
  if (!authResult.authorized) return authResult.response;

  const type = request.nextUrl.searchParams.get("type");
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50");

  try {
    if (type === "edmonton-licences") {
      const data = await fetchEdmontonBusinessLicenceDetails(Math.min(limit, 2000));
      return NextResponse.json({ type, records: data.length, data });
    }

    if (type === "edmonton-categories") {
      const data = await fetchEdmontonBusinessDetailedCategories(limit);
      return NextResponse.json({ type, records: data.length, data });
    }

    if (type === "calgary-types") {
      const data = await fetchCalgaryBusinessByType(limit);
      return NextResponse.json({ type, records: data.length, data });
    }

    if (type === "calgary-districts") {
      const data = await fetchCalgaryBusinessByDistrict(limit);
      return NextResponse.json({ type, records: data.length, data });
    }

    if (type === "calgary-trend") {
      const data = await fetchCalgaryBusinessTrend();
      return NextResponse.json({ type, records: data.length, data });
    }

    if (type === "counts") {
      const [edmonton, calgary, statcan] = await Promise.all([
        fetchEdmontonBusinessCount(),
        fetchCalgaryBusinessCount(),
        fetchStatCanBusinessCounts(),
      ]);
      return NextResponse.json({
        type,
        edmonton: { activeBusinesses: edmonton },
        calgary: { activeBusinesses: calgary },
        statcan: { records: statcan.length, data: statcan },
      });
    }

    if (type === "sectors") {
      const data = await fetchStatCanBusinessBySector();
      return NextResponse.json({ type, records: data.length, data });
    }

    if (type === "ghg-facilities") {
      const data = await fetchGHGFacilities(Math.min(limit, 200));
      return NextResponse.json({ type, records: data.length, data });
    }

    if (type === "top-emitters") {
      const data = await fetchTopEmittersByCompany(Math.min(limit, 100));
      return NextResponse.json({ type, records: data.length, data });
    }

    if (type === "wcb-industries") {
      const data = await fetchWCBByIndustry();
      return NextResponse.json({ type, records: data.length, data });
    }

    if (type === "nonprofits-by-city") {
      const data = await fetchNonProfitsByCity(limit);
      return NextResponse.json({ type, records: data.length, data });
    }

    if (type === "nonprofits-by-type") {
      const data = await fetchNonProfitsByType();
      return NextResponse.json({ type, records: data.length, data });
    }

    if (type === "cra-t2") {
      const data = await fetchCRAT2Stats();
      return NextResponse.json({ type, records: data.length, data });
    }

    return NextResponse.json({
      available_types: [
        "edmonton-licences",
        "edmonton-categories",
        "calgary-types",
        "calgary-districts",
        "calgary-trend",
        "counts",
        "sectors",
        "ghg-facilities",
        "top-emitters",
        "wcb-industries",
        "nonprofits-by-city",
        "nonprofits-by-type",
        "cra-t2",
      ],
      usage: "GET /api/business?type=sectors",
      examples: [
        "/api/business?type=counts",
        "/api/business?type=sectors",
        "/api/business?type=edmonton-categories&limit=30",
        "/api/business?type=calgary-types",
        "/api/business?type=top-emitters&limit=20",
        "/api/business?type=wcb-industries",
        "/api/business?type=nonprofits-by-city",
      ],
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch business data", detail: String(error) },
      { status: 500 }
    );
  }
}
