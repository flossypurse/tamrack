/**
 * GET /api/intel/operators
 *
 * Search + filter + paginate the tri-region operator directory. Reads the
 * `intel_operators` Postgres table via `searchIntelOperators`. Same data the
 * `alberta_entities` MCP tool serves, exposed as REST for HTTP consumers.
 *
 * Query params:
 *   - name_query   (substring, case-insensitive)
 *   - category     (exact category-string match, GIN-indexed)
 *   - city         (case-insensitive equals)
 *   - source       'aba' | 'gprc' | 'all'   (default 'all')
 *   - has_email    'true' | 'false'
 *   - has_website  'true' | 'false'
 *   - limit        1..200   (default 50)
 *   - offset       int      (default 0)
 *
 * Auth: Bearer ap_<key> or session.
 */
import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import { searchIntelOperators, type IntelOperatorFilters } from "@/lib/data-sources-intel";

export const runtime = "nodejs";

function parseBool(v: string | null): boolean | undefined {
  if (v === null) return undefined;
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return undefined;
}

function parseSource(v: string | null): IntelOperatorFilters["source"] {
  if (v === "aba" || v === "gprc" || v === "all") return v;
  return undefined;
}

function parseInt0(v: string | null, fallback: number): number {
  if (v === null) return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request);
  if (!authResult.authorized) return authResult.response;

  const params = request.nextUrl.searchParams;
  const filters: IntelOperatorFilters = {
    name_query: params.get("name_query") ?? undefined,
    category: params.get("category") ?? undefined,
    city: params.get("city") ?? undefined,
    source: parseSource(params.get("source")),
    has_email: parseBool(params.get("has_email")),
    has_website: parseBool(params.get("has_website")),
    // 2000 max because the dashboard does a single full-table fetch for
    // jurisdiction/NAICS rollups; smaller consumers paginate via limit+offset.
    limit: Math.min(Math.max(parseInt0(params.get("limit"), 50), 1), 2000),
    offset: Math.max(parseInt0(params.get("offset"), 0), 0),
  };

  try {
    const { rows, total } = await searchIntelOperators(filters);
    return NextResponse.json({
      total,
      returned: rows.length,
      offset: filters.offset ?? 0,
      limit: filters.limit ?? 50,
      operators: rows,
    });
  } catch (err) {
    console.error("[GET /api/intel/operators]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
