import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import {
  fetchRetailSubsectors,
  fetchEcommerceSales,
  fetchFoodServices,
  fetchBusinessDynamics,
  fetchRetailBusinessDynamics,
  fetchFoodBusinessDynamics,
  fetchEdmontonLicencesByCategory,
  fetchEdmontonLicencesByNeighbourhood,
  fetchEdmontonLicenceMonthlyTrend,
} from "@/lib/data-sources-retail";

// GET /api/retail?type=subsectors
// GET /api/retail?type=ecommerce
// GET /api/retail?type=food-services
// GET /api/retail?type=business-dynamics
// GET /api/retail?type=retail-dynamics
// GET /api/retail?type=food-dynamics
// GET /api/retail?type=edmonton-licences-category
// GET /api/retail?type=edmonton-licences-neighbourhood
// GET /api/retail?type=edmonton-licences-trend

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request);
  if (!authResult.authorized) return authResult.response;

  const type = request.nextUrl.searchParams.get("type");

  try {
    if (type === "subsectors") {
      const data = await fetchRetailSubsectors().catch(() => []);
      return NextResponse.json({ type, records: data.length, data });
    }

    if (type === "ecommerce") {
      const data = await fetchEcommerceSales().catch(() => []);
      return NextResponse.json({ type, records: data.length, data });
    }

    if (type === "food-services") {
      const data = await fetchFoodServices().catch(() => []);
      return NextResponse.json({ type, records: data.length, data });
    }

    if (type === "business-dynamics") {
      const data = await fetchBusinessDynamics().catch(() => []);
      return NextResponse.json({ type, records: data.length, data });
    }

    if (type === "retail-dynamics") {
      const data = await fetchRetailBusinessDynamics().catch(() => []);
      return NextResponse.json({ type, records: data.length, data });
    }

    if (type === "food-dynamics") {
      const data = await fetchFoodBusinessDynamics().catch(() => []);
      return NextResponse.json({ type, records: data.length, data });
    }

    if (type === "edmonton-licences-category") {
      const data = await fetchEdmontonLicencesByCategory().catch(() => []);
      return NextResponse.json({ type, records: data.length, data });
    }

    if (type === "edmonton-licences-neighbourhood") {
      const data = await fetchEdmontonLicencesByNeighbourhood().catch(() => []);
      return NextResponse.json({ type, records: data.length, data });
    }

    if (type === "edmonton-licences-trend") {
      const data = await fetchEdmontonLicenceMonthlyTrend().catch(() => []);
      return NextResponse.json({ type, records: data.length, data });
    }

    return NextResponse.json({
      available_types: [
        "subsectors",
        "ecommerce",
        "food-services",
        "business-dynamics",
        "retail-dynamics",
        "food-dynamics",
        "edmonton-licences-category",
        "edmonton-licences-neighbourhood",
        "edmonton-licences-trend",
      ],
      usage: "GET /api/retail?type=subsectors",
      sources: {
        subsectors: "StatsCan 20-10-0056",
        ecommerce: "StatsCan 20-10-0056",
        "food-services": "StatsCan 21-10-0019",
        "business-dynamics": "StatsCan 33-10-0270 (all industries)",
        "retail-dynamics": "StatsCan 33-10-0270 (NAICS 44-45)",
        "food-dynamics": "StatsCan 33-10-0270 (food services)",
        "edmonton-licences-*": "Edmonton Open Data (qhi4-bdpu)",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch retail data", detail: String(error) },
      { status: 500 }
    );
  }
}
