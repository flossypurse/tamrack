/**
 * GET /api/intel/operators/:id/profile/history
 *
 * Returns all profile versions for this operator, newest first. The most
 * recent row also satisfies `current = true`.
 */
import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import { getProfileHistory } from "@/lib/data-sources-intel-profiles";

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
    const rows = await getProfileHistory(id);
    return NextResponse.json({ operator_id: id, count: rows.length, profiles: rows });
  } catch (err) {
    console.error("[GET /api/intel/operators/:id/profile/history]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
