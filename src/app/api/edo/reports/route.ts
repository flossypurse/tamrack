import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateReport } from "@/lib/edo/reports";
import { getTemplate } from "@/lib/edo/reports-shared";
import type { ReportConfig, ReportTemplateId, DateRange } from "@/lib/edo/reports-shared";
import { getMunicipality } from "@/lib/municipality-registry";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.municipalityId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const templateId = params.get("template") as ReportTemplateId | null;
  const municipalitySlug = params.get("m") ?? session.user.municipalityId;
  const peerSlugs = params.getAll("peer");

  if (!templateId || !getTemplate(templateId)) {
    return NextResponse.json(
      { error: "Valid template required (monthly, quarterly, annual)" },
      { status: 400 },
    );
  }

  // Parse date range
  const startMonth = parseInt(params.get("sm") ?? "1", 10);
  const startYear = parseInt(params.get("sy") ?? String(new Date().getFullYear()), 10);
  const endMonth = parseInt(params.get("em") ?? "12", 10);
  const endYear = parseInt(params.get("ey") ?? String(new Date().getFullYear()), 10);
  const rangeLabel = params.get("label") ?? `${startMonth}/${startYear} – ${endMonth}/${endYear}`;

  const dateRange: DateRange = {
    label: rangeLabel,
    startMonth,
    startYear,
    endMonth,
    endYear,
  };

  const config = getMunicipality(municipalitySlug);
  const municipalityName = config?.name ?? municipalitySlug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const reportConfig: ReportConfig = {
    templateId,
    municipalitySlug,
    municipalityName,
    dateRange,
    peerSlugs,
  };

  try {
    const report = await generateReport(reportConfig);
    return NextResponse.json(report);
  } catch (error) {
    console.error("[edo/reports] Error:", error);
    return NextResponse.json(
      { error: "Report generation failed" },
      { status: 500 },
    );
  }
}
