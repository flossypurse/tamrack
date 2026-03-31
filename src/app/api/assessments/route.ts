import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import {
  fetchTopNeighbourhoodAssessments,
  fetchStrathconaAssessmentsByArea,
  fetchStAlbertAssessmentsByNeighbourhood,
  fetchParklandAssessmentsBySubdivision,
  fetchParklandAssessmentsByZoning,
  fetchStonyPlainAssessmentsByZoning,
} from "@/lib/data-sources";

// GET /api/assessments?municipality=edmonton|strathcona|st-albert|parkland|stony-plain
// Returns normalized assessment data across all municipalities

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request);
  if (!authResult.authorized) return authResult.response;

  const municipality = request.nextUrl.searchParams.get("municipality");

  try {
    if (municipality === "edmonton") {
      const data = await fetchTopNeighbourhoodAssessments(25);
      return NextResponse.json({
        municipality: "edmonton",
        source: "Edmonton SODA API",
        type: "neighbourhood",
        data: data.map((d) => ({
          area: d.neighbourhood,
          count: d.count,
          avgAssessment: d.avgValue,
        })),
      });
    }

    if (municipality === "strathcona") {
      const data = await fetchStrathconaAssessmentsByArea();
      return NextResponse.json({
        municipality: "strathcona",
        source: "Strathcona County ArcGIS",
        type: "building_type",
        data: data.map((d) => ({
          area: d.neighbourhood,
          count: d.count,
          avgAssessment: d.avgValue,
        })),
      });
    }

    if (municipality === "st-albert") {
      const data = await fetchStAlbertAssessmentsByNeighbourhood();
      return NextResponse.json({
        municipality: "st-albert",
        source: "St. Albert ArcGIS",
        type: "neighbourhood",
        data: data.map((d) => ({
          area: d.neighbourhood,
          count: d.count,
          avgAssessment: d.avgValue,
        })),
      });
    }

    if (municipality === "parkland") {
      const [bySub, byZone] = await Promise.all([
        fetchParklandAssessmentsBySubdivision(),
        fetchParklandAssessmentsByZoning(),
      ]);
      return NextResponse.json({
        municipality: "parkland-county",
        source: "Parkland County ArcGIS MapServer",
        bySubdivision: bySub.map((d) => ({
          area: d.subdivision,
          count: d.count,
          avgAssessment: d.avgAssessment,
          minAssessment: d.minAssessment,
          maxAssessment: d.maxAssessment,
        })),
        byZoning: byZone.map((d) => ({
          zoning: d.zoning,
          count: d.count,
          avgAssessment: d.avgAssessment,
        })),
      });
    }

    if (municipality === "stony-plain") {
      const data = await fetchStonyPlainAssessmentsByZoning();
      return NextResponse.json({
        municipality: "stony-plain",
        source: "Stony Plain ArcGIS FeatureServer",
        type: "zoning",
        data: data.map((d) => ({
          area: d.zoning,
          count: d.count,
          avgAssessment: d.avgAssessment,
        })),
      });
    }

    // All municipalities
    const [edmonton, strathcona, stAlbert, parkland, stonyPlain] =
      await Promise.all([
        fetchTopNeighbourhoodAssessments(15).catch(() => []),
        fetchStrathconaAssessmentsByArea().catch(() => []),
        fetchStAlbertAssessmentsByNeighbourhood().catch(() => []),
        fetchParklandAssessmentsBySubdivision().catch(() => []),
        fetchStonyPlainAssessmentsByZoning().catch(() => []),
      ]);

    return NextResponse.json({
      municipalities: {
        edmonton: {
          source: "Edmonton SODA API",
          count: edmonton.length,
          data: edmonton.map((d) => ({
            area: d.neighbourhood,
            count: d.count,
            avgAssessment: d.avgValue,
          })),
        },
        strathcona: {
          source: "Strathcona County ArcGIS",
          count: strathcona.length,
          data: strathcona.map((d) => ({
            area: d.neighbourhood,
            count: d.count,
            avgAssessment: d.avgValue,
          })),
        },
        "st-albert": {
          source: "St. Albert ArcGIS",
          count: stAlbert.length,
          data: stAlbert.map((d) => ({
            area: d.neighbourhood,
            count: d.count,
            avgAssessment: d.avgValue,
          })),
        },
        "parkland-county": {
          source: "Parkland County ArcGIS MapServer",
          count: parkland.length,
          data: parkland.map((d) => ({
            area: d.subdivision,
            count: d.count,
            avgAssessment: d.avgAssessment,
          })),
        },
        "stony-plain": {
          source: "Stony Plain ArcGIS FeatureServer",
          count: stonyPlain.length,
          data: stonyPlain.map((d) => ({
            area: d.zoning,
            count: d.count,
            avgAssessment: d.avgAssessment,
          })),
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch assessment data" },
      { status: 500 }
    );
  }
}
