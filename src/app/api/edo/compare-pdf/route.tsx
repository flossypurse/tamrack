import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  fetchComparison,
  formatComparisonValue,
  type ComparisonResult,
  type ComparisonIndicator,
} from "@/lib/edo/compare";

export const dynamic = "force-dynamic";

const CHART_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"];

async function renderComparisonPdf(result: ComparisonResult): Promise<Buffer> {
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
      fontSize: 18,
      fontFamily: "Helvetica-Bold",
      color: "#1a1a2e",
    },
    subtitle: {
      fontSize: 10,
      color: "#6b7280",
      marginTop: 4,
    },
    legendRow: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      gap: 12,
      marginBottom: 16,
    },
    legendItem: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 4,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendText: {
      fontSize: 9,
      color: "#374151",
    },
    table: {
      marginBottom: 16,
    },
    tableHeader: {
      flexDirection: "row" as const,
      borderBottom: "1.5px solid #e2e8f0",
      paddingBottom: 6,
      marginBottom: 4,
    },
    tableHeaderCell: {
      fontSize: 8,
      fontFamily: "Helvetica-Bold",
      color: "#6b7280",
      textTransform: "uppercase" as const,
      letterSpacing: 0.3,
    },
    tableRow: {
      flexDirection: "row" as const,
      borderBottom: "0.5px solid #f1f5f9",
      paddingVertical: 4,
    },
    indicatorCell: {
      width: "25%",
      fontSize: 8,
      color: "#374151",
    },
    valueCell: {
      fontSize: 9,
      fontFamily: "Helvetica-Bold",
      color: "#1a1a2e",
      textAlign: "right" as const,
    },
    changeText: {
      fontSize: 7,
      marginTop: 1,
      textAlign: "right" as const,
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

  function changeColor(change: string | null): string {
    if (!change) return "#6b7280";
    if (change.startsWith("+")) return "#059669";
    if (change.startsWith("-")) return "#dc2626";
    return "#6b7280";
  }

  const munis = result.municipalities;
  const colWidth = `${Math.floor(75 / munis.length)}%`;

  // Group indicators by category
  const grouped = new Map<string, ComparisonIndicator[]>();
  for (const ind of result.indicators) {
    const list = grouped.get(ind.category) || [];
    list.push(ind);
    grouped.set(ind.category, list);
  }

  const doc = (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.brand}>Alberta Pulse — Peer Comparison</Text>
          <Text style={styles.title}>
            Municipality Comparison
          </Text>
          <Text style={styles.subtitle}>
            {munis.map((m) => m.name).join(" vs ")} ·{" "}
            {new Date(result.generatedAt).toLocaleDateString("en-CA", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </Text>
        </View>

        {/* Legend */}
        <View style={styles.legendRow}>
          {munis.map((m, i) => (
            <View key={m.slug} style={styles.legendItem}>
              <View
                style={[
                  styles.legendDot,
                  { backgroundColor: CHART_COLORS[i % CHART_COLORS.length] },
                ]}
              />
              <Text style={styles.legendText}>{m.name}</Text>
            </View>
          ))}
        </View>

        {/* Tables by category */}
        {Array.from(grouped.entries()).map(([category, indicators]) => (
          <View key={category} style={styles.table} wrap={false}>
            <Text
              style={{
                fontSize: 11,
                fontFamily: "Helvetica-Bold",
                color: "#6366f1",
                marginBottom: 8,
                borderBottom: "1px solid #e2e8f0",
                paddingBottom: 4,
              }}
            >
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </Text>

            {/* Table header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { width: "25%" }]}>
                Indicator
              </Text>
              {munis.map((m) => (
                <Text
                  key={m.slug}
                  style={[
                    styles.tableHeaderCell,
                    { width: colWidth, textAlign: "right" as const },
                  ]}
                >
                  {m.name}
                </Text>
              ))}
            </View>

            {/* Rows */}
            {indicators.map((ind) => (
              <View key={ind.id} style={styles.tableRow}>
                <Text style={styles.indicatorCell}>{ind.label}</Text>
                {munis.map((m) => {
                  const dp = result.data.find(
                    (d) =>
                      d.municipalitySlug === m.slug &&
                      d.indicatorId === ind.id,
                  );
                  return (
                    <View key={m.slug} style={{ width: colWidth }}>
                      <Text style={styles.valueCell}>
                        {formatComparisonValue(
                          dp?.latestValue ?? null,
                          ind.format,
                        )}
                      </Text>
                      {dp?.change ? (
                        <Text
                          style={[
                            styles.changeText,
                            { color: changeColor(dp.change) },
                          ]}
                        >
                          {dp.change}
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        ))}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Data: regionaldashboard.alberta.ca
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
  const municipalitySlugs = params.getAll("m");
  const indicatorIds = params.getAll("i");

  if (municipalitySlugs.length < 2 || municipalitySlugs.length > 5) {
    return NextResponse.json(
      { error: "Select 2-5 municipalities" },
      { status: 400 },
    );
  }

  if (indicatorIds.length < 1) {
    return NextResponse.json(
      { error: "Select at least 1 indicator" },
      { status: 400 },
    );
  }

  try {
    const result = await fetchComparison(municipalitySlugs, indicatorIds);
    const pdfBuffer = await renderComparisonPdf(result);

    const names = result.municipalities.map((m) => m.name.replace(/\s+/g, "-"));
    const filename = `Comparison-${names.join("-vs-")}.pdf`;

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[edo/compare-pdf] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF", detail: String(error) },
      { status: 500 },
    );
  }
}
