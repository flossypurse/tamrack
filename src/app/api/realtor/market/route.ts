import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getMunicipality } from "@/lib/municipality-registry";
import { buildMarketSnapshot } from "@/lib/realtor/market-data";

// GET /api/realtor/market?areas=slug1,slug2
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check realtor plan
  const plan = (session.user as Record<string, unknown>).plan as string | undefined;
  if (plan !== "realtor") {
    return NextResponse.json({ error: "Realtor subscription required" }, { status: 403 });
  }

  // Parse area slugs from query param
  const areasParam = req.nextUrl.searchParams.get("areas");
  if (!areasParam) {
    return NextResponse.json({ error: "areas parameter required" }, { status: 400 });
  }

  const areas = areasParam.split(",").map((s) => s.trim()).filter(Boolean);
  if (areas.length === 0) {
    return NextResponse.json({ error: "At least one area slug required" }, { status: 400 });
  }

  // Validate slugs against registry
  const invalid = areas.filter((slug) => !getMunicipality(slug));
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: `Invalid municipality slugs: ${invalid.join(", ")}` },
      { status: 400 },
    );
  }

  const snapshot = await buildMarketSnapshot(areas);
  return NextResponse.json(snapshot);
}
