/**
 * GET /api/intel/categories
 *
 * Full category taxonomy with member counts, derived from `intel_operators`
 * via UNNEST. Cached at the substrate layer; cheap to hit.
 */
import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import { listOperatorCategories } from "@/lib/data-sources-intel";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request);
  if (!authResult.authorized) return authResult.response;

  try {
    const categories = await listOperatorCategories();
    return NextResponse.json({ total_categories: categories.length, categories });
  } catch (err) {
    console.error("[GET /api/intel/categories]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
