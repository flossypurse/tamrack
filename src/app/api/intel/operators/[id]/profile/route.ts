/**
 * GET  /api/intel/operators/:id/profile  — read current profile (or null)
 * PUT  /api/intel/operators/:id/profile  — write a new profile version
 *
 * Reads are open (consistent with other AP read endpoints).
 * Writes require an API key carrying the `intel:profile:write` scope. The
 * write path is append-only: each PUT bumps the previous current row to
 * `current = FALSE` inside one transaction and inserts a fresh one.
 *
 * Body schema for PUT — validated server-side via zod. Sources must be
 * non-empty (the "every claim has a source URL" invariant); confidence is
 * required in [0,1]; raw_profile_md is required and non-empty.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiRequest } from "@/lib/api-auth";
import { getIntelOperator } from "@/lib/data-sources-intel";
import {
  countProfileHistory,
  getCurrentProfile,
  writeProfile,
} from "@/lib/data-sources-intel-profiles";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SourceSchema = z.object({
  url: z.string().url(),
  accessed_at: z.string().datetime().optional(),
  kind: z.string().min(1).max(64).optional(),
});

const ProfileWriteSchema = z.object({
  profile_schema: z.string().min(1).max(64),
  researcher: z.string().min(1).max(128),
  raw_profile_md: z.string().min(1),
  structured: z.record(z.string(), z.unknown()).default({}),
  sources: z.array(SourceSchema).min(1, "at least one source is required"),
  data_gaps: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  confidence_breakdown: z.record(z.string(), z.unknown()).default({}),
  cost_usd: z.number().nonnegative().nullable().optional(),
  tokens_in: z.number().int().nonnegative().nullable().optional(),
  tokens_out: z.number().int().nonnegative().nullable().optional(),
  duration_ms: z.number().int().nonnegative().nullable().optional(),
});

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
    if (!op) return NextResponse.json({ error: "Operator not found" }, { status: 404 });

    const [profile, historyCount] = await Promise.all([
      getCurrentProfile(id),
      countProfileHistory(id),
    ]);

    return NextResponse.json({
      operator_id: id,
      profile,
      history_available: historyCount,
    });
  } catch (err) {
    console.error("[GET /api/intel/operators/:id/profile]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authResult = await authenticateApiRequest(request, {
    requiredScopes: ["intel:profile:write"],
  });
  if (!authResult.authorized) return authResult.response;

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid operator id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ProfileWriteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid profile payload", details: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const result = await writeProfile(id, parsed.data);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("does not exist")) {
      return NextResponse.json({ error: "Operator not found" }, { status: 404 });
    }
    console.error("[PUT /api/intel/operators/:id/profile]", err);
    return NextResponse.json({ error: "Internal error", detail: msg }, { status: 500 });
  }
}
