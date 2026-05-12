/**
 * GET /api/intel/operators/:id
 *
 * Fetch a single operator record by UUID. Returns 404 if no such operator.
 */
import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import { getIntelOperator } from "@/lib/data-sources-intel";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await authenticateApiRequest(request);
  if (!authResult.authorized) return authResult.response;

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid operator id" }, { status: 400 });
  }

  try {
    const op = await getIntelOperator(id);
    if (!op) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ operator: op });
  } catch (err) {
    console.error("[GET /api/intel/operators/:id]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
