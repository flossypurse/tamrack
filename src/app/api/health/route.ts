import { NextResponse } from "next/server";

/**
 * Comprehensive health check — pings each upstream data source
 * and reports status, response time, and sample record count.
 *
 * GET /api/health          → quick check (just status: ok)
 * GET /api/health?deep=1   → full upstream probe
 */

interface ProbeResult {
  source: string;
  status: "ok" | "error" | "timeout";
  responseMs: number;
  records?: number;
  error?: string;
}

async function probe(
  source: string,
  url: string,
  headers?: Record<string, string>,
  timeoutMs = 10000,
): Promise<ProbeResult> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: headers || {},
    });
    clearTimeout(timer);
    const elapsed = Date.now() - start;

    if (!res.ok) {
      return { source, status: "error", responseMs: elapsed, error: `HTTP ${res.status}` };
    }

    // Try to determine record count from response
    let records: number | undefined;
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("json")) {
      const body = await res.json();
      if (Array.isArray(body)) records = body.length;
      else if (body.features) records = body.features.length;
      else if (body.observations) records = Object.keys(body.observations).length;
    }

    return { source, status: "ok", responseMs: elapsed, records };
  } catch (err) {
    const elapsed = Date.now() - start;
    const isTimeout = (err as Error).name === "AbortError";
    return {
      source,
      status: isTimeout ? "timeout" : "error",
      responseMs: elapsed,
      error: isTimeout ? "Timed out" : (err as Error).message,
    };
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const deep = searchParams.get("deep") === "1";

  if (!deep) {
    return NextResponse.json({ status: "ok", timestamp: new Date().toISOString() });
  }

  const probes: { source: string; url: string; headers?: Record<string, string> }[] = [
    {
      source: "Bank of Canada Valet",
      url: "https://www.bankofcanada.ca/valet/observations/FXCADUSD/json?recent=1",
    },
    {
      source: "Statistics Canada WDS",
      url: "https://www150.statcan.gc.ca/t1/tbl1/en/dtl!downloadTbl/en/TV.csv?pid=1410028701&pickMembers%5B0%5D=1.10&pickMembers%5B1%5D=3.1&pickMembers%5B2%5D=4.1&pickMembers%5B3%5D=5.1",
    },
    {
      source: "Edmonton Open Data (SODA)",
      url: "https://data.edmonton.ca/resource/q7d6-ambg.json?$limit=1",
    },
    {
      source: "Alberta Regional Dashboard",
      url: "https://regionaldashboard.alberta.ca/export/opendata/Population/jsons",
    },
    {
      source: "Calgary Open Data (Socrata)",
      url: "https://data.calgary.ca/resource/4bsw-nn7w.json?$limit=1",
    },
    {
      source: "CER Pipeline Data",
      url: "https://www.cer-rec.gc.ca/open/energy/throughput-and-capacity-ngtl.csv",
    },
    {
      source: "IRCC Immigration",
      url: "https://www.ircc.canada.ca/opendata-donneesouvertes/data/IRCC_PRadmissions_0002_E.csv",
    },
    {
      source: "Infrastructure Canada",
      url: "https://www.infrastructure.gc.ca/alt-format/opendata/icp-pic-en.json",
    },
    {
      source: "Represent API (Politics)",
      url: "https://represent.opennorth.ca/representatives/alberta-legislature/?format=json&limit=1",
    },
    {
      source: "OpenParliament",
      url: "https://api.openparliament.ca/votes/?format=json&limit=1",
    },
    {
      source: "Alberta CKAN (Fiscal)",
      url: "https://open.alberta.ca/api/3/action/package_show?id=grant-disclosure",
    },
  ];

  const results = await Promise.all(
    probes.map((p) => probe(p.source, p.url, p.headers)),
  );

  const allOk = results.every((r) => r.status === "ok");

  return NextResponse.json({
    status: allOk ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    sources: results,
    summary: {
      total: results.length,
      ok: results.filter((r) => r.status === "ok").length,
      error: results.filter((r) => r.status === "error").length,
      timeout: results.filter((r) => r.status === "timeout").length,
      avgResponseMs: Math.round(results.reduce((s, r) => s + r.responseMs, 0) / results.length),
    },
  });
}
