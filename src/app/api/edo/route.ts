import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getLiveMunicipalities } from "@/lib/municipality-registry";

// POST /api/edo — bind municipality to EDO subscription
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { action, municipalityId } = await req.json();

  if (action === "bind-municipality") {
    if (!municipalityId || typeof municipalityId !== "string") {
      return NextResponse.json({ error: "municipalityId required" }, { status: 400 });
    }

    // Validate municipality exists
    const live = getLiveMunicipalities();
    const valid = live.some((m) => m.slug === municipalityId);
    if (!valid) {
      return NextResponse.json({ error: "Invalid municipality" }, { status: 400 });
    }

    const pool = await getDb();
    await pool.query(
      `UPDATE subscriptions SET municipality_id = $1, updated_at = NOW() WHERE user_id = $2`,
      [municipalityId, session.user.id]
    );

    return NextResponse.json({ ok: true, municipalityId });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
