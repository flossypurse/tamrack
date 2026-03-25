import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getLiveMunicipalities } from "@/lib/municipality-registry";

// POST /api/realtor — bind operating area to Realtor subscription
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { action, municipalityIds } = await req.json();

  if (action === "bind-operating-area") {
    if (!Array.isArray(municipalityIds) || municipalityIds.length === 0) {
      return NextResponse.json({ error: "At least one municipalityId required" }, { status: 400 });
    }

    // Validate all municipalities exist
    const live = getLiveMunicipalities();
    const liveSlugs = new Set(live.map((m) => m.slug));
    const invalid = municipalityIds.filter((id: string) => !liveSlugs.has(id));
    if (invalid.length > 0) {
      return NextResponse.json({ error: `Invalid municipalities: ${invalid.join(", ")}` }, { status: 400 });
    }

    const pool = await getDb();
    // Store operating area as JSON array in operating_area column
    await pool.query(
      `UPDATE subscriptions SET operating_area = $1, updated_at = NOW() WHERE user_id = $2`,
      [JSON.stringify(municipalityIds), session.user.id]
    );

    return NextResponse.json({ ok: true, operatingArea: municipalityIds });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
