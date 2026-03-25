import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildPitchKit } from "@/lib/edo/pitch";
import { getMunicipality } from "@/lib/municipality-registry";
import type { PitchKitConfig } from "@/lib/edo/pitch-shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.municipalityId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const municipalitySlug = params.get("m") ?? session.user.municipalityId;
  const peerSlugs = params.getAll("peer");

  const muniConfig = getMunicipality(municipalitySlug);
  const municipalityName = muniConfig?.name ?? municipalitySlug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const config: PitchKitConfig = {
    municipalitySlug,
    municipalityName,
    peerSlugs,
  };

  try {
    const pitchKit = await buildPitchKit(config);
    return NextResponse.json(pitchKit);
  } catch (error) {
    console.error("[edo/pitch] Error:", error);
    return NextResponse.json(
      { error: "Pitch kit generation failed", detail: String(error) },
      { status: 500 },
    );
  }
}
