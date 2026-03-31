import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { fetchComparison } from "@/lib/edo/compare";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.municipalityId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const municipalitySlugs = params.getAll("m");
  const indicatorIds = params.getAll("i");

  if (municipalitySlugs.length < 2 || municipalitySlugs.length > 5) {
    return NextResponse.json(
      { error: "Select 2-5 municipalities" },
      { status: 400 },
    );
  }

  if (indicatorIds.length < 1) {
    return NextResponse.json(
      { error: "Select at least 1 indicator" },
      { status: 400 },
    );
  }

  try {
    const result = await fetchComparison(municipalitySlugs, indicatorIds);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[edo/compare] Error:", error);
    return NextResponse.json(
      { error: "Comparison failed" },
      { status: 500 },
    );
  }
}
