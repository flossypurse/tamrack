import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/api-auth";
import {
  CER_ENDPOINTS,
  fetchPipelineThroughput,
  fetchCrudeOilProduction,
  fetchPipelineIncidents,
  fetchApportionment,
} from "@/lib/data-sources-cer";

// GET /api/energy?type=throughput&pipeline=NGTL_THROUGHPUT
// GET /api/energy?type=production
// GET /api/energy?type=incidents
// GET /api/energy?type=apportionment

export async function GET(request: NextRequest) {
  const authResult = await authenticateApiRequest(request);
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

    return NextResponse.json({
      available_types: ["throughput", "production", "incidents", "apportionment"],
      pipelines: Object.keys(CER_ENDPOINTS).filter(k => k.includes("THROUGHPUT")),
      usage: "GET /api/energy?type=throughput&pipeline=NGTL_THROUGHPUT",
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch energy data" }, { status: 500 });
  }
}
