/**
 * POST /api/intel/research-queue/:operator_id/fail
 *
 * Marks a queue row as failed (with the error message). Successful runs
 * close the queue automatically when the PUT profile endpoint writes; this
 * endpoint is the failure path.
 *
 * Scope required: intel:research:write
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/api-auth";
import { markQueueFailed } from "@/lib/data-sources-intel-queue";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FailSchema = z.object({
  error: z.string().min(1).max(4000),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ operator_id: string }> },
) {
  const authResult = await authenticateApiRequest(request, {
    requiredScopes: ["intel:research:write"],
  });
  if (!authResult.authorized) return authResult.response;

  const { operator_id } = await params;
  if (!UUID_RE.test(operator_id)) {
    return NextResponse.json({ error: "Invalid operator id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = FailSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid fail payload", details: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    await markQueueFailed(operator_id, parsed.data.error);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/intel/research-queue/:operator_id/fail]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
