import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runCollection, type SourceName } from "@/lib/collector";
import {
  getTableRowCounts,
  getCollectionHistory,
  getLastCollectionRun,
  getCollectionStats,
} from "@/lib/db";

const VALID_SOURCES: SourceName[] = [
  "regional", "energy", "municipalities", "wells",
  "immigration", "projects", "macro", "housing", "procurement", "jobbank",
  "spruce-grove-proxy", "stony-plain-entities", "all",
];

/**
 * POST /api/admin/collect — trigger a collection run
 *
 * Auth: admin session OR CRON_SECRET header (for Railway cron)
 * Body (optional): { "source": "all" | "regional" | ... }
 */
export async function POST(req: NextRequest) {
  // Auth: either admin session or cron secret
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    // Cron-triggered — allowed
  } else {
    const session = await auth();
    if (!session?.user || (session.user as { role?: string }).role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Parse source from body
  let source: SourceName = "all";
  try {
    const body = await req.json();
    if (body?.source && VALID_SOURCES.includes(body.source)) {
      source = body.source;
    }
  } catch {
    // No body or invalid JSON — default to "all"
  }

  const result = await runCollection(source);
  return NextResponse.json(result);
}

/**
 * GET /api/admin/collect — get collection status (stats, history, last run)
 *
 * Auth: admin session only
 */
export async function GET() {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stats = await getCollectionStats();
  const tables = await getTableRowCounts();
  const history = await getCollectionHistory(50);
  const lastRun = await getLastCollectionRun();

  return NextResponse.json({ stats, tables, history, lastRun });
}
