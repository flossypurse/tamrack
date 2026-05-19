import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import {
  fetchHotNeighbourhoods,
  fetchRecentResidentialDevPermits,
  fetchEdmontonPermitsSummary,
  fetchStrathconaResidentialPermits,
  fetchStrathconaHotSubdivisions,
  fetchStAlbertDevPermits,
  fetchStAlbertDevPermitsSummary,
  fetchParklandRecentParcels,
  fetchStonyPlainConstructionProjects,
} from "@/lib/data-sources";

// GET /api/permits?municipality=edmonton|strathcona|st-albert|parkland|stony-plain
// Optional: ?type=summary|recent (default: summary)

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request, { requiredScopes: ["tamrack:real-estate:read"] });
  if (!authResult.authorized) return authResult.response;

  const municipality = request.nextUrl.searchParams.get("municipality");
  const type = request.nextUrl.searchParams.get("type") || "summary";

  try {
    if (municipality === "edmonton") {
      if (type === "recent") {
        const data = await fetchRecentResidentialDevPermits(25);
        return NextResponse.json({
          municipality: "edmonton",
          source: "Edmonton SODA API",
          type: "dev_permits",
          data,
        });
      }
      const [hotZones, trend] = await Promise.all([
        fetchHotNeighbourhoods(15),
        fetchEdmontonPermitsSummary(),
      ]);
      return NextResponse.json({
        municipality: "edmonton",
        source: "Edmonton SODA API",
        hotZones: hotZones.map((d) => ({
          neighbourhood: d.neighbourhood,
          permits: d.permits,
          units: d.units,
          totalValue: d.totalValue,
          avgValue: d.avgValue,
        })),
        monthlyTrend: trend,
      });
    }

    if (municipality === "strathcona") {
      if (type === "recent") {
        const data = await fetchStrathconaResidentialPermits(25);
        return NextResponse.json({
          municipality: "strathcona",
          source: "Strathcona County ArcGIS",
          type: "building_permits",
          data,
        });
      }
      const data = await fetchStrathconaHotSubdivisions();
      return NextResponse.json({
        municipality: "strathcona",
        source: "Strathcona County ArcGIS",
        type: "subdivisions",
        data: data.map((d) => ({
          subdivision: d.subdivision,
          permits: d.permits,
          totalValue: d.totalValue,
        })),
      });
    }

    if (municipality === "st-albert") {
      if (type === "recent") {
        const data = await fetchStAlbertDevPermits(25);
        return NextResponse.json({
          municipality: "st-albert",
          source: "St. Albert ArcGIS",
          type: "dev_permits",
          data,
        });
      }
      const data = await fetchStAlbertDevPermitsSummary();
      return NextResponse.json({
        municipality: "st-albert",
        source: "St. Albert ArcGIS",
        type: "monthly_trend",
        data,
      });
    }

    if (municipality === "parkland") {
      // Parkland County doesn't have permit data — return parcels as proxy
      const data = await fetchParklandRecentParcels(25);
      return NextResponse.json({
        municipality: "parkland-county",
        source: "Parkland County ArcGIS MapServer",
        type: "parcels",
        note: "No building/dev permit API available — returning assessed parcels as proxy",
        data,
      });
    }

    if (municipality === "stony-plain") {
      const data = await fetchStonyPlainConstructionProjects();
      return NextResponse.json({
        municipality: "stony-plain",
        source: "Stony Plain ArcGIS FeatureServer",
        type: "construction_projects",
        data,
      });
    }

    // All municipalities summary
    const [edmontonHot, strathconaSubs, stAlbertTrend] = await Promise.all([
      fetchHotNeighbourhoods(10).catch(() => []),
      fetchStrathconaHotSubdivisions().catch(() => []),
      fetchStAlbertDevPermitsSummary().catch(() => []),
    ]);

    return NextResponse.json({
      municipalities: {
        edmonton: {
          source: "Edmonton SODA API",
          type: "hot_zones",
          count: edmontonHot.length,
          data: edmontonHot,
        },
        strathcona: {
          source: "Strathcona County ArcGIS",
          type: "subdivisions",
          count: strathconaSubs.length,
          data: strathconaSubs,
        },
        "st-albert": {
          source: "St. Albert ArcGIS",
          type: "monthly_trend",
          count: stAlbertTrend.length,
          data: stAlbertTrend,
        },
        "parkland-county": {
          source: "Parkland County ArcGIS MapServer",
          note: "No permit API — parcel data available via /api/assessments?municipality=parkland",
        },
        "stony-plain": {
          source: "Stony Plain ArcGIS FeatureServer",
          note: "Construction projects available via ?municipality=stony-plain",
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch permit data" },
      { status: 500 }
    );
  }
}
