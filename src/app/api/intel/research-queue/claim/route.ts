/**
 * POST /api/intel/research-queue/claim
 *
 * Atomically claims up to `limit` pending (or stale-failed) rows for the
 * research worker. Marks them `running` with `started_at = NOW()` and bumps
 * `attempts`. Uses Postgres FOR UPDATE SKIP LOCKED so concurrent workers
 * don't collide.
 *
 * The response augments each claimed row with the full `intel_operators`
 * record so the worker doesn't need a second round trip.
 *
 * Scope required: intel:research:write
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/api-auth";
import { claimQueueBatch, reapStaleRunning } from "@/lib/data-sources-intel-queue";
import { getIntelOperator } from "@/lib/data-sources-intel";

export const runtime = "nodejs";

const ClaimSchema = z.object({
  limit: z.number().int().min(1).max(50).default(4),
  max_attempts: z.number().int().min(1).max(10).default(3),
  reap_stale_running_minutes: z.number().int().min(1).max(240).default(30),
});

export async function POST(request: NextRequest) {
  const authResult = await authenticateApiRequest(request, {
    requiredScopes: ["intel:research:write"],
  });
  if (!authResult.authorized) return authResult.response;

  let body: unknown;
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ClaimSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid claim payload", details: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    // Reap stuck-running rows first so a crashed worker doesn't starve the queue.
    const reaped = await reapStaleRunning(parsed.data.reap_stale_running_minutes);
    const rows = await claimQueueBatch(parsed.data.limit, parsed.data.max_attempts);

    // Hydrate each claimed row with its operator record. Done in parallel.
    const hydrated = await Promise.all(
      rows.map(async (r) => {
        const op = await getIntelOperator(r.operator_id);
        return {
          operator_id: r.operator_id,
          attempts: r.attempts,
          priority: r.priority,
          operator: op,
        };
      }),
    );

    return NextResponse.json({ reaped, claimed: hydrated });
  } catch (err) {
    console.error("[POST /api/intel/research-queue/claim]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
