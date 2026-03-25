import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildPitchKit } from "@/lib/edo/pitch";
import { getMunicipality } from "@/lib/municipality-registry";
import type { PitchKitConfig, PitchKit, PitchMetric, PitchBenchmarkRow, PitchAmenity } from "@/lib/edo/pitch-shared";

export const dynamic = "force-dynamic";

async function renderPitchPdf(pitch: PitchKit): Promise<Buffer> {
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
    section: {
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 12,
      fontFamily: "Helvetica-Bold",
      color: "#6366f1",
      marginBottom: 6,
      borderBottom: "1px solid #e2e8f0",
      paddingBottom: 4,
    },
    narrative: {
      fontSize: 9,
      color: "#374151",
      marginBottom: 8,
      lineHeight: 1.4,
    },
    metricsRow: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      gap: 6,
      marginBottom: 4,
    },
    metricCard: {
      width: "30%",
      backgroundColor: "#f8fafc",
      borderRadius: 4,
      padding: 8,
      border: "1px solid #e2e8f0",
    },
    metricLabel: { fontSize: 7, color: "#6b7280" },
    metricValue: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 2 },
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

  function changeColor(change?: string): string {
    if (!change) return "#6b7280";
    if (change.startsWith("+")) return "#059669";
    if (change.startsWith("-")) return "#dc2626";
    return "#6b7280";
  }

  function renderMetric(m: PitchMetric) {
    return (
      <View key={m.label} style={styles.metricCard}>
        <Text style={styles.metricLabel}>{m.label}</Text>
        <Text style={styles.metricValue}>{m.formatted}</Text>
        {m.change ? (
          <Text style={[styles.metricChange, { color: changeColor(m.change) }]}>
            {m.change} vs prev period
          </Text>
        ) : null}
      </View>
    );
  }

  const s = pitch.sections;

  const doc = (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.brand}>Alberta Pulse — Investment Pitch Kit</Text>
          <Text style={styles.title}>{pitch.municipalityName}</Text>
          <Text style={styles.subtitle}>
            Investment Profile · Generated{" "}
            {new Date(pitch.generatedAt).toLocaleDateString("en-CA", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </Text>
        </View>

        {/* Community Overview */}
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Community Overview</Text>
          <Text style={styles.narrative}>{s.overview.narrative}</Text>
          <View style={styles.metricsRow}>
            {renderMetric(s.overview.population)}
            {renderMetric(s.overview.medianIncome)}
            {renderMetric(s.overview.assessmentBase)}
            {renderMetric(s.overview.businessCount)}
          </View>
        </View>

        {/* Workforce */}
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Workforce & Talent</Text>
          <Text style={styles.narrative}>{s.workforce.narrative}</Text>
          <View style={styles.metricsRow}>
            {renderMetric(s.workforce.labourForce)}
            {renderMetric(s.workforce.unemploymentRate)}
            {renderMetric(s.workforce.avgWeeklyEarnings)}
          </View>
        </View>

        {/* Real Estate */}
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Real Estate & Land</Text>
          <Text style={styles.narrative}>{s.realEstate.narrative}</Text>
          <View style={styles.metricsRow}>
            {renderMetric(s.realEstate.avgSalePrice)}
            {renderMetric(s.realEstate.housingStarts)}
            {renderMetric(s.realEstate.vacancyRate)}
            {renderMetric(s.realEstate.avgRent)}
            {renderMetric(s.realEstate.municipalTaxRate)}
          </View>
        </View>

        {/* Growth Story */}
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Growth Story</Text>
          <Text style={styles.narrative}>{s.growth.narrative}</Text>
          <View style={styles.metricsRow}>
            {renderMetric(s.growth.populationTrend)}
            {renderMetric(s.growth.buildingPermits)}
            {renderMetric(s.growth.incorporations)}
            {renderMetric(s.growth.netMigration)}
          </View>
        </View>

        {/* Competitive Position */}
        {s.competitive.benchmarks.length > 0 && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>Competitive Position</Text>
            <Text style={styles.narrative}>{s.competitive.narrative}</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { width: "40%" }]}>Indicator</Text>
              <Text style={[styles.tableHeaderCell, { width: "30%", textAlign: "right" as const }]}>
                {pitch.municipalityName}
              </Text>
              <Text style={[styles.tableHeaderCell, { width: "30%", textAlign: "right" as const }]}>
                Peer Average
              </Text>
            </View>
            {s.competitive.benchmarks.map((b) => (
              <View key={b.indicator} style={styles.tableRow}>
                <Text style={{ width: "40%", fontSize: 8, color: "#374151" }}>{b.indicator}</Text>
                <Text style={{ width: "30%", fontSize: 9, fontFamily: "Helvetica-Bold", textAlign: "right" as const }}>
                  {b.municipalityValue}
                </Text>
                <Text style={{ width: "30%", fontSize: 9, color: "#6b7280", textAlign: "right" as const }}>
                  {b.peerAvg}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Amenities */}
        {s.amenities.amenities.some((a) => a.count > 0) && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>Nearby Amenities</Text>
            <Text style={styles.narrative}>{s.amenities.narrative}</Text>
            <View style={styles.metricsRow}>
              {s.amenities.amenities
                .filter((a) => a.count > 0)
                .slice(0, 6)
                .map((a) => (
                  <View key={a.type} style={styles.metricCard}>
                    <Text style={styles.metricLabel}>{a.label}</Text>
                    <Text style={styles.metricValue}>{a.count}</Text>
                    {a.topPlaces[0] ? (
                      <Text style={{ fontSize: 7, color: "#6b7280", marginTop: 2 }}>
                        Top: {a.topPlaces[0].name}
                      </Text>
                    ) : null}
                  </View>
                ))}
            </View>
          </View>
        )}

        {/* Citations */}
        <View style={styles.section} wrap={false}>
          <Text style={styles.sectionTitle}>Data Sources</Text>
          <Text style={{ fontSize: 8, color: "#6b7280", marginBottom: 2 }}>
            • regionaldashboard.alberta.ca — 54 indicators for Alberta municipalities
          </Text>
          <Text style={{ fontSize: 8, color: "#6b7280", marginBottom: 2 }}>
            • Google Maps Platform — nearby amenities search
          </Text>
          <Text style={{ fontSize: 8, color: "#6b7280", marginBottom: 2 }}>
            • Municipal ArcGIS services — parcel and business data
          </Text>
          <Text style={{ fontSize: 8, color: "#6b7280" }}>
            • Generated{" "}
            {new Date(pitch.generatedAt).toLocaleDateString("en-CA", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Data: regionaldashboard.alberta.ca, Google Maps, municipal ArcGIS
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
  const municipalitySlug = params.get("m") ?? session.user.municipalityId;
  const peerSlugs = params.getAll("peer");

  const muniConfig = getMunicipality(municipalitySlug);
  const municipalityName = muniConfig?.name ?? municipalitySlug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const config: PitchKitConfig = {
    municipalitySlug,
    municipalityName,
    peerSlugs,
  };

  try {
    const pitchKit = await buildPitchKit(config);
    const pdfBuffer = await renderPitchPdf(pitchKit);

    const filename = `${municipalityName.replace(/\s+/g, "-")}-Investment-Pitch-Kit.pdf`;

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[edo/pitch-pdf] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF", detail: String(error) },
      { status: 500 },
    );
  }
}
