import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import {
  fetchInfrastructureProjects,
  fetchAlbertaMajorProjects,
  fetchAERWellLicences,
} from "@/lib/data-sources-infrastructure";

// GET /api/projects?type=federal|provincial|wells

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request);
  if (!authResult.authorized) return authResult.response;

  const type = request.nextUrl.searchParams.get("type");

  try {
    if (type === "federal") {
      const data = await fetchInfrastructureProjects("Alberta");
      return NextResponse.json({ type: "federal", source: "Infrastructure Canada", records: data.length, data: data.slice(0, 100) });
    }

    if (type === "provincial") {
      const data = await fetchAlbertaMajorProjects();
      return NextResponse.json({ type: "provincial", source: "Alberta Major Projects Inventory", records: data.length, data: data.slice(0, 100) });
    }

    if (type === "wells") {
      const data = await fetchAERWellLicences();
      return NextResponse.json({ type: "wells", source: "AER Daily Well Licences", records: data.length, data });
    }

    return NextResponse.json({
      available_types: ["federal", "provincial", "wells"],
      usage: "GET /api/projects?type=federal",
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch project data", detail: String(error) }, { status: 500 });
  }
}
