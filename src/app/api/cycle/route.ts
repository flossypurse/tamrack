import { NextResponse } from "next/server";
import { computeCyclePosition } from "@/lib/cycle-engine";

export const revalidate = 3600; // Cache for 1 hour

export async function GET() {
  try {
    const result = await computeCyclePosition();

    return NextResponse.json({
      current: result.current,
      matches: result.matches.map((m) => ({
        period: m.period,
        similarity: m.similarity,
        distance: m.distance,
        periodFingerprint: m.periodFingerprint,
      })),
      bestMatch: {
        period: result.bestMatch.period,
        similarity: result.bestMatch.similarity,
      },
      whatHappenedNext: result.whatHappenedNext,
      indicators: result.indicators,
    });
  } catch (error) {
    console.error("Cycle position computation failed:", error);
    return NextResponse.json(
      { error: "Failed to compute cycle position" },
      { status: 500 }
    );
  }
}
