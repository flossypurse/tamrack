import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import {
  getLiveMunicipalities,
  getMunicipalitiesByRegion,
  REGION_LABELS,
  type MunicipalityRegion,
} from "@/lib/municipality-registry";

// GET /api/corridors
// Returns growth corridor data — municipalities ranked by population and capabilities

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const byRegion = getMunicipalitiesByRegion();
    const liveSlugs = new Set(getLiveMunicipalities().map((m) => m.slug));

    const corridors = (Object.keys(byRegion) as MunicipalityRegion[]).map(
      (region) => ({
        region,
        label: REGION_LABELS[region],
        municipalities: byRegion[region]
          .filter((m) => liveSlugs.has(m.slug))
          .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
          .map((m) => ({
            slug: m.slug,
            name: m.name,
            population: m.population,
            capabilities: m.capabilities,
          })),
      })
    );

    return NextResponse.json({ corridors });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 }
    );
  }
}
