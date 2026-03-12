import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import {
  fetchEdmontonCommercialAssessments,
  fetchEdmontonBusinessCategories,
  fetchEdmontonBusinessesByNeighbourhood,
  fetchEdmontonCommercialPermits,
} from "@/lib/data-sources";

// GET /api/commercial
// Returns commercial data for Edmonton

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const [assessments, businessCategories, businessesByNeighbourhood, permits] =
      await Promise.all([
        fetchEdmontonCommercialAssessments().catch(() => []),
        fetchEdmontonBusinessCategories().catch(() => []),
        fetchEdmontonBusinessesByNeighbourhood().catch(() => []),
        fetchEdmontonCommercialPermits().catch(() => []),
      ]);

    return NextResponse.json({
      commercial: {
        assessments,
        businessCategories,
        businessesByNeighbourhood,
        permits,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch data", detail: String(error) },
      { status: 500 }
    );
  }
}
