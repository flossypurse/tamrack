import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import {
  CER_ENDPOINTS,
  fetchPipelineThroughput,
  fetchCrudeOilProduction,
  fetchPipelineIncidents,
  fetchApportionment,
} from "@/lib/data-sources-cer";
import {
  fetchWellLicenceRecords,
  fetchWellLicenceDaily,
  fetchWellOperators,
} from "@/lib/data-sources-infrastructure";

// GET /api/energy?type=throughput&pipeline=NGTL_THROUGHPUT
// GET /api/energy?type=production
// GET /api/energy?type=incidents
// GET /api/energy?type=apportionment
// GET /api/energy?type=well_licences[&limit=100&from=YYYY-MM-DD&to=YYYY-MM-DD]
// GET /api/energy?type=well_licences_daily[&days=90]
// GET /api/energy?type=well_operators[&limit=100]

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request, { requiredScopes: ["tamrack:energy:read"] });
  if (!authResult.authorized) return authResult.response;

  const type = request.nextUrl.searchParams.get("type");
  const pipeline = request.nextUrl.searchParams.get("pipeline");

  try {
    if (type === "throughput" && pipeline) {
      const key = pipeline as keyof typeof CER_ENDPOINTS;
      if (!CER_ENDPOINTS[key]) {
        return NextResponse.json({ error: `Unknown pipeline: ${pipeline}`, available: Object.keys(CER_ENDPOINTS).filter(k => k.includes("THROUGHPUT")) }, { status: 400 });
      }
      const data = await fetchPipelineThroughput(key);
      return NextResponse.json({ pipeline, records: data.length, data: data.slice(-100) });
    }

    if (type === "production") {
      const province = request.nextUrl.searchParams.get("province") || "Alberta";
      const data = await fetchCrudeOilProduction(province);
      return NextResponse.json({ province, records: data.length, data: data.slice(-60) });
    }

    if (type === "incidents") {
      const data = await fetchPipelineIncidents();
      return NextResponse.json({ records: data.length, data: data.slice(-100) });
    }

    if (type === "apportionment") {
      const data = await fetchApportionment();
      return NextResponse.json({ records: data.length, data: data.slice(-60) });
    }

    if (type === "well_licences") {
      const limit = Math.min(
        parseInt(request.nextUrl.searchParams.get("limit") ?? "100", 10) || 100,
        500,
      );
      const from = request.nextUrl.searchParams.get("from") ?? undefined;
      const to = request.nextUrl.searchParams.get("to") ?? undefined;
      const range = from != null || to != null ? { from, to } : undefined;
      const data = await fetchWellLicenceRecords(limit, range);
      return NextResponse.json({ records: data.length, data });
    }

    if (type === "well_licences_daily") {
      const days = Math.min(
        parseInt(request.nextUrl.searchParams.get("days") ?? "90", 10) || 90,
        730,
      );
      const data = await fetchWellLicenceDaily(days);
      return NextResponse.json({ records: data.length, data });
    }

    if (type === "well_operators") {
      const limit = Math.min(
        parseInt(request.nextUrl.searchParams.get("limit") ?? "100", 10) || 100,
        500,
      );
      const data = await fetchWellOperators(limit);
      return NextResponse.json({ records: data.length, data });
    }

    return NextResponse.json({
      available_types: [
        "throughput",
        "production",
        "incidents",
        "apportionment",
        "well_licences",
        "well_licences_daily",
        "well_operators",
      ],
      pipelines: Object.keys(CER_ENDPOINTS).filter(k => k.includes("THROUGHPUT")),
      usage: "GET /api/energy?type=throughput&pipeline=NGTL_THROUGHPUT",
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch energy data" }, { status: 500 });
  }
}
