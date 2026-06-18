import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { recordPromotionDecision } from "@/lib/smart-ui/persistence";
import {
  promoteDashboardToTemplate,
  PromotionBlockedError,
} from "@/lib/smart-ui/promotion";

// POST /api/admin/curation — approve (promote into the corpus) or dismiss a
// nominated question. Both are idempotent on query_hash.
export async function POST(req: NextRequest) {
  const check = await requireAdmin();
  if (!check.authorized) return check.response;
  const adminId = check.session.user.id;

  let body: {
    action?: string;
    query_hash?: string;
    rep_dashboard_id?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, query_hash: queryHash, rep_dashboard_id: repId } = body;
  if (!queryHash || (action !== "approve" && action !== "dismiss")) {
    return NextResponse.json(
      { error: "action must be 'approve' or 'dismiss' and query_hash is required" },
      { status: 400 },
    );
  }

  if (action === "dismiss") {
    await recordPromotionDecision(queryHash, {
      status: "dismissed",
      sourceDashboardId: repId ?? null,
      decidedBy: adminId,
    });
    return NextResponse.json({ ok: true, status: "dismissed" });
  }

  // approve
  if (!repId) {
    return NextResponse.json(
      { error: "rep_dashboard_id is required to approve" },
      { status: 400 },
    );
  }
  try {
    const result = await promoteDashboardToTemplate(repId, queryHash, adminId);
    return NextResponse.json({ ok: true, status: "approved", ...result });
  } catch (err) {
    if (err instanceof PromotionBlockedError) {
      return NextResponse.json(
        { error: err.message, reason: err.reason },
        { status: 409 },
      );
    }
    throw err;
  }
}
