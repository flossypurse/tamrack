import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name") || "Learner";
  const date = req.nextUrl.searchParams.get("date") || new Date().toLocaleDateString("en-CA");

  try {
    const pdfBuffer = await renderCertificatePdf(name, date);
    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="alberta-economic-literacy-certificate.pdf"`,
      },
    });
  } catch (error) {
    console.error("Certificate PDF generation failed:", error);
    return NextResponse.json({ error: "Failed to generate certificate" }, { status: 500 });
  }
}

async function renderCertificatePdf(name: string, date: string): Promise<Buffer> {
  const ReactPDF = await import("@react-pdf/renderer");
  const { Document, Page, Text, View, StyleSheet, renderToBuffer } = ReactPDF;

  const styles = StyleSheet.create({
    page: {
      padding: 0,
      fontFamily: "Helvetica",
      backgroundColor: "#fffbeb",
    },
    border: {
      margin: 30,
      padding: 40,
      border: "3px solid #f59e0b",
      borderRadius: 4,
      flex: 1,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    brandLine: {
      fontSize: 8,
      color: "#f59e0b",
      letterSpacing: 4,
      textTransform: "uppercase" as const,
      marginBottom: 8,
    },
    certTitle: {
      fontSize: 28,
      fontFamily: "Helvetica-Bold",
      color: "#1a1a2e",
      marginBottom: 6,
      textAlign: "center" as const,
    },
    certSubtitle: {
      fontSize: 14,
      color: "#6b7280",
      marginBottom: 30,
      textAlign: "center" as const,
    },
    presented: {
      fontSize: 10,
      color: "#6b7280",
      marginBottom: 8,
      textAlign: "center" as const,
    },
    recipientName: {
      fontSize: 24,
      fontFamily: "Helvetica-Bold",
      color: "#1a1a2e",
      marginBottom: 20,
      textAlign: "center" as const,
      borderBottom: "2px solid #f59e0b",
      paddingBottom: 8,
      paddingHorizontal: 40,
    },
    description: {
      fontSize: 10,
      color: "#374151",
      textAlign: "center" as const,
      lineHeight: 1.6,
      maxWidth: 400,
      marginBottom: 30,
    },
    completionDate: {
      fontSize: 9,
      color: "#6b7280",
      marginBottom: 30,
      textAlign: "center" as const,
    },
    footer: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      width: "100%",
      paddingHorizontal: 40,
      marginTop: 20,
    },
    footerCol: {
      alignItems: "center" as const,
    },
    footerLine: {
      width: 120,
      borderBottom: "1px solid #d1d5db",
      marginBottom: 4,
    },
    footerLabel: {
      fontSize: 7,
      color: "#9ca3af",
      textTransform: "uppercase" as const,
      letterSpacing: 1,
    },
    footerValue: {
      fontSize: 8,
      color: "#374151",
      marginBottom: 2,
    },
    modules: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      justifyContent: "center" as const,
      gap: 4,
      marginBottom: 20,
      maxWidth: 400,
    },
    moduleBadge: {
      fontSize: 6,
      color: "#f59e0b",
      backgroundColor: "#fef3c7",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 3,
    },
  });

  const moduleNames = [
    "Alberta 101",
    "The Energy Engine",
    "The Housing Machine",
    "Your Tax Dollars",
    "People & Growth",
    "Reading the Signals",
    "Community Levers",
    "Safety & Prosperity",
  ];

  const buffer = await renderToBuffer(
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.border}>
          <Text style={styles.brandLine}>Alberta Pulse Check</Text>
          <Text style={styles.certTitle}>Certificate of Completion</Text>
          <Text style={styles.certSubtitle}>Alberta Economic Literacy</Text>

          <Text style={styles.presented}>This is to certify that</Text>
          <Text style={styles.recipientName}>{name}</Text>

          <Text style={styles.description}>
            has successfully completed the Pulse Learn curriculum — an 8-module
            course covering Alberta&apos;s economy, energy systems, housing markets,
            fiscal policy, demographics, economic indicators, community governance,
            and the intersection of safety and prosperity. All quizzes passed with
            a score of 70% or higher.
          </Text>

          <View style={styles.modules}>
            {moduleNames.map((mod) => (
              <Text key={mod} style={styles.moduleBadge}>
                {mod}
              </Text>
            ))}
          </View>

          <Text style={styles.completionDate}>Completed on {date}</Text>

          <View style={styles.footer}>
            <View style={styles.footerCol}>
              <View style={styles.footerLine} />
              <Text style={styles.footerLabel}>Issued by</Text>
              <Text style={styles.footerValue}>Alberta Pulse Check</Text>
            </View>
            <View style={styles.footerCol}>
              <View style={styles.footerLine} />
              <Text style={styles.footerLabel}>Certificate ID</Text>
              <Text style={styles.footerValue}>
                LEARN-{date.replace(/-/g, "")}-{name.slice(0, 3).toUpperCase()}
              </Text>
            </View>
            <View style={styles.footerCol}>
              <View style={styles.footerLine} />
              <Text style={styles.footerLabel}>Verify at</Text>
              <Text style={styles.footerValue}>albertapulsecheck.ca/learn</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );

  return Buffer.from(buffer);
}
