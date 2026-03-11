import { NextResponse } from "next/server";
import {
  analyzeTransformationZones,
  analyzeTeardownZones,
  analyzeRenovationROI,
  analyzeBusinessResidentialConvergence,
} from "@/lib/analysis";

// GET /api/signals
// Returns cross-analysis signals for Edmonton neighbourhoods
// These are the "value-add" computations built on top of raw municipal APIs

export async function GET() {
  try {
    const [transformation, teardowns, renovationROI, convergence] =
      await Promise.all([
        analyzeTransformationZones().catch(() => []),
        analyzeTeardownZones().catch(() => []),
        analyzeRenovationROI().catch(() => []),
        analyzeBusinessResidentialConvergence().catch(() => []),
      ]);

    return NextResponse.json({
      description:
        "Cross-analysis signals combining multiple Edmonton data sources. " +
        "These signals are the computed intelligence layer on top of raw permit, " +
        "assessment, and business licence data.",
      signals: {
        transformation: {
          description:
            "Neighbourhoods showing signs of transformation — high permit activity " +
            "relative to current assessment values. Signals: hot, warming, stable, cooling.",
          count: transformation.length,
          data: transformation,
        },
        teardowns: {
          description:
            "Areas where teardowns and redevelopment are happening — dev permits " +
            "classified as 'Redeveloping' combined with new construction values.",
          count: teardowns.length,
          data: teardowns,
        },
        renovation_roi: {
          description:
            "Renovation activity relative to property values — where owners are " +
            "investing in improvements. High ratio suggests active upgrading.",
          count: renovationROI.length,
          data: renovationROI,
        },
        convergence: {
          description:
            "Business + residential convergence — areas where commercial activity " +
            "is growing alongside residential development. Complete communities signal.",
          count: convergence.length,
          data: convergence,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to compute signals", detail: String(error) },
      { status: 500 }
    );
  }
}
