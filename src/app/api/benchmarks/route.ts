import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import { getLiveMunicipalities } from "@/lib/municipality-registry";

// GET /api/benchmarks
// Returns comparative data for requested municipalities
// Query param: ?municipalities=slug1,slug2,slug3 (optional, defaults to all live)

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request, { requiredScopes: ["tamrack:macro:read"] });
  if (!authResult.authorized) return authResult.response;

  try {
    const allLive = getLiveMunicipalities();
    const municipalitiesParam = request.nextUrl.searchParams.get("municipalities");

    const filtered = municipalitiesParam
      ? allLive.filter((m) =>
          municipalitiesParam.split(",").includes(m.slug)
        )
      : allLive;

    const benchmarks = filtered.map((m) => ({
      slug: m.slug,
      name: m.name,
      region: m.region,
      population: m.population,
      capabilities: m.capabilities,
      dataUrls: Object.fromEntries(
        Object.entries(m.endpoints)
          .filter(([, v]) => v != null)
          .map(([k, v]) => [k, v!.url])
      ),
    }));

    return NextResponse.json({ benchmarks });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 }
    );
  }
}
