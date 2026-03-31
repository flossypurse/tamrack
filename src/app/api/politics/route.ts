import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import {
  fetchAlbertaMLAs,
  fetchAlbertaElectoralDistricts,
  fetchAlbertaFederalMPs,
  fetchParliamentVotes,
  fetchAlbertaDebates,
  fetchFederalElectionResultsAB,
  fetchElectionsCanadaContributions,
} from "@/lib/data-sources-politics";

// GET /api/politics?type=mlas|federal-mps|districts|votes|debates|election-results|contributions

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request);
  if (!authResult.authorized) return authResult.response;

  const type = request.nextUrl.searchParams.get("type");
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50", 10);

  try {
    if (type === "mlas") {
      const data = await fetchAlbertaMLAs();
      return NextResponse.json({ type: "mlas", records: data.length, data });
    }

    if (type === "federal-mps") {
      const data = await fetchAlbertaFederalMPs();
      return NextResponse.json({ type: "federal-mps", records: data.length, data });
    }

    if (type === "districts") {
      const data = await fetchAlbertaElectoralDistricts();
      return NextResponse.json({ type: "districts", records: data.length, data });
    }

    if (type === "votes") {
      const data = await fetchParliamentVotes(limit);
      return NextResponse.json({ type: "votes", records: data.length, data });
    }

    if (type === "debates") {
      const data = await fetchAlbertaDebates(limit);
      return NextResponse.json({ type: "debates", records: data.length, data });
    }

    if (type === "election-results") {
      const data = await fetchFederalElectionResultsAB();
      return NextResponse.json({ type: "election-results", records: data.length, data });
    }

    if (type === "contributions") {
      const data = await fetchElectionsCanadaContributions();
      return NextResponse.json({ type: "contributions", records: data.length, data: data.slice(0, 500) });
    }

    return NextResponse.json({
      available_types: [
        "mlas",
        "federal-mps",
        "districts",
        "votes",
        "debates",
        "election-results",
        "contributions",
      ],
      usage: "GET /api/politics?type=mlas",
      examples: [
        "/api/politics?type=mlas",
        "/api/politics?type=federal-mps",
        "/api/politics?type=districts",
        "/api/politics?type=votes&limit=20",
        "/api/politics?type=debates&limit=30",
        "/api/politics?type=election-results",
        "/api/politics?type=contributions",
      ],
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch politics data" },
      { status: 500 }
    );
  }
}
