/**
 * GET  /api/intel/research-queue
 *   Query: ?status=pending|running|done|failed|all (default 'all')
 *          ?limit=1..500 (default 100), ?offset=int
 *   Plus a stats={pending,running,done,failed} block.
 *
 * POST /api/intel/research-queue
 *   Body: { operator_id: uuid, priority?: int }
 *   Requires scope `intel:research:write`. Enqueues or bumps priority on an
 *   existing row (always takes the lower priority value via LEAST).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/api-auth";
import {
  enqueueOperator,
  getQueueStats,
  listQueueRows,
  type QueueStatus,
} from "@/lib/data-sources-intel-queue";

export const runtime = "nodejs";

const VALID_STATUSES: ReadonlyArray<QueueStatus | "all"> = [
  "pending",
  "running",
  "done",
  "failed",
  "all",
];

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request);
  if (!authResult.authorized) return authResult.response;

  const params = request.nextUrl.searchParams;
  const statusParam = params.get("status") ?? "all";
  if (!VALID_STATUSES.includes(statusParam as QueueStatus | "all")) {
    return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
  }
  const limit = Math.min(Math.max(parseInt(params.get("limit") ?? "100", 10) || 100, 1), 500);
  const offset = Math.max(parseInt(params.get("offset") ?? "0", 10) || 0, 0);

  try {
    const [stats, rows] = await Promise.all([
      getQueueStats(),
      listQueueRows({ status: statusParam as QueueStatus | "all", limit, offset }),
    ]);
    return NextResponse.json({ stats, returned: rows.length, limit, offset, rows });
  } catch (err) {
    console.error("[GET /api/intel/research-queue]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

const EnqueueSchema = z.object({
  operator_id: z.string().uuid(),
  priority: z.number().int().min(0).max(1000).optional(),
});

export async function POST(request: NextRequest) {
  const authResult = await authenticateApiRequest(request, {
    requiredScopes: ["intel:research:write"],
  });
  if (!authResult.authorized) return authResult.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = EnqueueSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid enqueue payload", details: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const row = await enqueueOperator(parsed.data);
    return NextResponse.json({ row }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("foreign key")) {
      return NextResponse.json({ error: "Operator not found" }, { status: 404 });
    }
    console.error("[POST /api/intel/research-queue]", err);
    return NextResponse.json({ error: "Internal error", detail: msg }, { status: 500 });
  }
}
