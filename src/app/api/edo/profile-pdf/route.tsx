import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildCommunityProfile, type CommunityProfile, type ProfileMetric } from "@/lib/edo/profile-data";

export const dynamic = "force-dynamic";

// We use @react-pdf/renderer for server-side PDF generation
// This is imported dynamically to avoid bundling issues with Next.js
async function renderPdf(profile: CommunityProfile): Promise<Buffer> {
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
      fontSize: 22,
      fontFamily: "Helvetica-Bold",
      color: "#1a1a2e",
    },
    subtitle: {
      fontSize: 10,
      color: "#6b7280",
      marginTop: 4,
    },
    headlineRow: {
      flexDirection: "row" as const,
      marginBottom: 20,
      gap: 10,
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
      fontSize: 16,
      fontFamily: "Helvetica-Bold",
      marginTop: 2,
    },
    headlineChange: {
      fontSize: 7,
      marginTop: 2,
    },
    section: {
      marginBottom: 14,
    },
    sectionTitle: {
      fontSize: 11,
      fontFamily: "Helvetica-Bold",
      color: "#6366f1",
      marginBottom: 8,
      borderBottom: "1px solid #e2e8f0",
      paddingBottom: 4,
    },
    metricsGrid: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      gap: 8,
    },
    metricCard: {
      width: "30%",
      backgroundColor: "#f8fafc",
      borderRadius: 4,
      padding: 8,
      border: "1px solid #e2e8f0",
    },
    metricLabel: {
      fontSize: 7,
      color: "#6b7280",
    },
    metricValue: {
      fontSize: 12,
      fontFamily: "Helvetica-Bold",
      marginTop: 2,
    },
    metricPeriod: {
      fontSize: 6,
      color: "#9ca3af",
      marginTop: 1,
    },
    metricChange: {
      fontSize: 7,
      marginTop: 1,
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
    footerText: {
      fontSize: 7,
      color: "#9ca3af",
    },
  });

  function changeColor(change?: string): string {
    if (!change) return "#6b7280";
    if (change.startsWith("+")) return "#059669";
    if (change.startsWith("-")) return "#dc2626";
    return "#6b7280";
  }

  function MetricCardPdf({ metric }: { metric: ProfileMetric }) {
    return (
      <View style={styles.metricCard}>
        <Text style={styles.metricLabel}>{metric.label}</Text>
        <Text style={styles.metricValue}>{metric.formatted}</Text>
        {metric.period ? <Text style={styles.metricPeriod}>{metric.period}</Text> : null}
        {metric.change ? (
          <Text style={[styles.metricChange, { color: changeColor(metric.change) }]}>
            {metric.change}
          </Text>
        ) : null}
      </View>
    );
  }

  const headlineMetrics = [
    profile.sections.overview.metrics.find((m) => m.label === "Population"),
    profile.sections.overview.metrics.find((m) => m.label === "Assessment Base"),
    profile.sections.overview.metrics.find((m) => m.label === "Building Permits"),
    profile.sections.overview.metrics.find((m) => m.label === "Business Counts"),
  ].filter(Boolean) as ProfileMetric[];

  const sections = [
    profile.sections.overview,
    profile.sections.economy,
    profile.sections.demographics,
    profile.sections.housing,
    profile.sections.labour,
    profile.sections.infrastructure,
  ];

  const doc = (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.brand}>Alberta Pulse — Community Profile</Text>
          <Text style={styles.title}>{profile.municipalityName}</Text>
          <Text style={styles.subtitle}>
            Generated {new Date(profile.generatedAt).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })}
          </Text>
        </View>

        {/* Headline metrics */}
        <View style={styles.headlineRow}>
          {headlineMetrics.map((m) => (
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

        {/* Data sections */}
        {sections.map((section) => {
          const withData = section.metrics.filter((m) => m.formatted !== "—");
          if (withData.length === 0) return null;
          return (
            <View key={section.title} style={styles.section} wrap={false}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <View style={styles.metricsGrid}>
                {withData.map((m) => (
                  <MetricCardPdf key={m.label} metric={m} />
                ))}
              </View>
            </View>
          );
        })}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Data: regionaldashboard.alberta.ca, StatsCan, municipal ArcGIS
          </Text>
          <Text style={styles.footerText}>
            albertapulsecheck.ca/edo
          </Text>
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

  const slug =
    request.nextUrl.searchParams.get("municipality") || session.user.municipalityId;

  // Verify the user is requesting their own municipality (or is admin)
  if (slug !== session.user.municipalityId && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const profile = await buildCommunityProfile(slug);
    const pdfBuffer = await renderPdf(profile);

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${profile.municipalityName.replace(/\s+/g, "-")}-Community-Profile.pdf"`,
      },
    });
  } catch (error) {
    console.error("[edo/profile-pdf] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF", detail: String(error) },
      { status: 500 },
    );
  }
}
