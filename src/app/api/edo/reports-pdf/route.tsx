import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateReport } from "@/lib/edo/reports";
import { getTemplate } from "@/lib/edo/reports-shared";
import type {
  ReportConfig,
  ReportTemplateId,
  DateRange,
  ReportData,
  ReportSectionData,
  ReportMetric,
  ReportComparisonRow,
  ReportAlertData,
} from "@/lib/edo/reports-shared";
import { getMunicipality } from "@/lib/municipality-registry";

export const dynamic = "force-dynamic";

const CHART_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"];

async function renderReportPdf(report: ReportData): Promise<Buffer> {
  const ReactPDF = await import("@react-pdf/renderer");
  const { Document, Page, Text, View, StyleSheet, renderToBuffer } = ReactPDF;

  const styles = StyleSheet.create({
    page: {
      padding: 40,
      fontFamily: "Helvetica",
      fontSize: 9,
      color: "#1a1a2e",
    },
    header: {
      marginBottom: 20,
      borderBottom: "2px solid #6366f1",
      paddingBottom: 12,
    },
    brand: {
      fontSize: 8,
      color: "#6366f1",
      letterSpacing: 2,
      textTransform: "uppercase" as const,
      marginBottom: 4,
    },
    title: {
      fontSize: 20,
      fontFamily: "Helvetica-Bold",
      color: "#1a1a2e",
    },
    subtitle: {
      fontSize: 10,
      color: "#6b7280",
      marginTop: 4,
    },
    sectionTitle: {
      fontSize: 11,
      fontFamily: "Helvetica-Bold",
      color: "#6366f1",
      marginBottom: 8,
      borderBottom: "1px solid #e2e8f0",
      paddingBottom: 4,
    },
    section: {
      marginBottom: 16,
    },
    headlineRow: {
      flexDirection: "row" as const,
      gap: 8,
      marginBottom: 4,
    },
    headlineCard: {
      flex: 1,
      backgroundColor: "#f8fafc",
      borderRadius: 6,
      padding: 10,
      border: "1px solid #e2e8f0",
    },
    headlineLabel: {
      fontSize: 7,
      color: "#6b7280",
      textTransform: "uppercase" as const,
      letterSpacing: 0.5,
    },
    headlineValue: {
      fontSize: 14,
      fontFamily: "Helvetica-Bold",
      marginTop: 2,
    },
    headlineChange: {
      fontSize: 7,
      marginTop: 2,
    },
    metricsGrid: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      gap: 6,
    },
    metricCard: {
      width: "30%",
      backgroundColor: "#f8fafc",
      borderRadius: 4,
      padding: 8,
      border: "1px solid #e2e8f0",
    },
    metricLabel: { fontSize: 7, color: "#6b7280" },
    metricValue: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 2 },
    metricPeriod: { fontSize: 6, color: "#9ca3af", marginTop: 1 },
    metricChange: { fontSize: 7, marginTop: 1 },
    tableHeader: {
      flexDirection: "row" as const,
      borderBottom: "1.5px solid #e2e8f0",
      paddingBottom: 4,
      marginBottom: 4,
    },
    tableHeaderCell: {
      fontSize: 7,
      fontFamily: "Helvetica-Bold",
      color: "#6b7280",
      textTransform: "uppercase" as const,
      letterSpacing: 0.3,
    },
    tableRow: {
      flexDirection: "row" as const,
      borderBottom: "0.5px solid #f1f5f9",
      paddingVertical: 3,
    },
    alertRow: {
      flexDirection: "row" as const,
      paddingVertical: 3,
      gap: 6,
    },
    alertBadge: {
      fontSize: 7,
      fontFamily: "Helvetica-Bold",
      borderRadius: 2,
      paddingHorizontal: 4,
      paddingVertical: 1,
    },
    citationText: {
      fontSize: 8,
      color: "#6b7280",
      marginBottom: 3,
    },
    footer: {
      position: "absolute" as const,
      bottom: 30,
      left: 40,
      right: 40,
      borderTop: "1px solid #e2e8f0",
      paddingTop: 8,
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
    },
    footerText: { fontSize: 7, color: "#9ca3af" },
  });

  function changeColor(change?: string | null): string {
    if (!change) return "#6b7280";
    if (change.startsWith("+")) return "#059669";
    if (change.startsWith("-")) return "#dc2626";
    return "#6b7280";
  }

  function severityColor(s: string): { bg: string; text: string } {
    if (s === "critical") return { bg: "#fef2f2", text: "#dc2626" };
    if (s === "warning") return { bg: "#fffbeb", text: "#d97706" };
    return { bg: "#eff6ff", text: "#2563eb" };
  }

  function renderHeadlineSection(section: ReportSectionData) {
    if (!section.metrics?.length) return null;
    return (
      <View style={styles.section} wrap={false}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <View style={styles.headlineRow}>
          {section.metrics.map((m) => (
            <View key={m.label} style={styles.headlineCard}>
              <Text style={styles.headlineLabel}>{m.label}</Text>
              <Text style={styles.headlineValue}>{m.formatted}</Text>
              {m.change ? (
                <Text style={[styles.headlineChange, { color: changeColor(m.change) }]}>
                  {m.change} vs prev period
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      </View>
    );
  }

  function renderProfileSection(section: ReportSectionData) {
    if (!section.metrics?.length) return null;
    return (
      <View style={styles.section} wrap={false}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <View style={styles.metricsGrid}>
          {section.metrics.map((m) => (
            <View key={m.label} style={styles.metricCard}>
              <Text style={styles.metricLabel}>{m.label}</Text>
              <Text style={styles.metricValue}>{m.formatted}</Text>
              {m.period ? <Text style={styles.metricPeriod}>{m.period}</Text> : null}
              {m.change ? (
                <Text style={[styles.metricChange, { color: changeColor(m.change) }]}>
                  {m.change}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      </View>
    );
  }

  function renderComparisonSection(section: ReportSectionData) {
    const comp = section.comparison;
    if (!comp?.rows?.length) return null;
    const munis = comp.municipalities;
    const colWidth = `${Math.floor(70 / munis.length)}%`;

    return (
      <View style={styles.section} wrap={false}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        {/* Legend */}
        <View style={{ flexDirection: "row" as const, gap: 10, marginBottom: 8 }}>
          {munis.map((m, i) => (
            <View key={m.slug} style={{ flexDirection: "row" as const, alignItems: "center" as const, gap: 3 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
              <Text style={{ fontSize: 8, color: "#374151" }}>{m.name}</Text>
            </View>
          ))}
        </View>
        {/* Table */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, { width: "30%" }]}>Indicator</Text>
          {munis.map((m) => (
            <Text key={m.slug} style={[styles.tableHeaderCell, { width: colWidth, textAlign: "right" as const }]}>
              {m.name}
            </Text>
          ))}
        </View>
        {comp.rows.map((row) => (
          <View key={row.indicatorId} style={styles.tableRow}>
            <Text style={{ width: "30%", fontSize: 8, color: "#374151" }}>{row.indicatorLabel}</Text>
            {row.values.map((v) => (
              <View key={v.slug} style={{ width: colWidth }}>
                <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", textAlign: "right" as const }}>
                  {v.formatted}
                </Text>
                {v.change ? (
                  <Text style={{ fontSize: 7, textAlign: "right" as const, color: changeColor(v.change), marginTop: 1 }}>
                    {v.change}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  }

  function renderAlertsSection(section: ReportSectionData) {
    if (!section.alerts?.length) {
      return (
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Text style={{ fontSize: 9, color: "#059669" }}>No alerts triggered — all metrics within normal thresholds.</Text>
        </View>
      );
    }
    return (
      <View style={styles.section} wrap={false}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        {section.alerts.map((a, i) => {
          const sc = severityColor(a.severity);
          return (
            <View key={i} style={styles.alertRow}>
              <Text style={[styles.alertBadge, { backgroundColor: sc.bg, color: sc.text }]}>
                {a.severity.toUpperCase()}
              </Text>
              <Text style={{ fontSize: 8, color: "#374151", flex: 1 }}>{a.description}</Text>
            </View>
          );
        })}
      </View>
    );
  }

  function renderCitationsSection(section: ReportSectionData) {
    if (!section.citations?.length) return null;
    return (
      <View style={styles.section} wrap={false}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        {section.citations.map((c, i) => (
          <Text key={i} style={styles.citationText}>• {c}</Text>
        ))}
      </View>
    );
  }

  const doc = (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.brand}>Alberta Pulse — Council Report</Text>
          <Text style={styles.title}>
            {report.municipalityName} — {report.templateName}
          </Text>
          <Text style={styles.subtitle}>
            {report.dateRange.label} · Generated{" "}
            {new Date(report.generatedAt).toLocaleDateString("en-CA", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </Text>
        </View>

        {/* Sections */}
        {report.sections.map((section) => {
          switch (section.type) {
            case "headline-metrics":
              return renderHeadlineSection(section);
            case "profile-section":
              return renderProfileSection(section);
            case "peer-comparison":
              return renderComparisonSection(section);
            case "alerts-summary":
              return renderAlertsSection(section);
            case "data-citations":
              return renderCitationsSection(section);
            default:
              return null;
          }
        })}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Data: regionaldashboard.alberta.ca, StatsCan, municipal ArcGIS
          </Text>
          <Text style={styles.footerText}>albertapulsecheck.ca/edo</Text>
        </View>
      </Page>
    </Document>
  );

  const buffer = await renderToBuffer(doc);
  return Buffer.from(buffer);
}

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

  const muniConfig = getMunicipality(municipalitySlug);
  const municipalityName = muniConfig?.name ?? municipalitySlug
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
    const reportData = await generateReport(reportConfig);
    const pdfBuffer = await renderReportPdf(reportData);

    const templateName = getTemplate(templateId)?.name ?? templateId;
    const filename = `${municipalityName.replace(/\s+/g, "-")}-${templateName.replace(/\s+/g, "-")}-${rangeLabel.replace(/\s+/g, "")}.pdf`;

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[edo/reports-pdf] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 },
    );
  }
}
