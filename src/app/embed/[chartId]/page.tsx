import { notFound } from "next/navigation";
import { resolveChart } from "@/lib/chart-resolver";

export const revalidate = 3600; // ISR: refresh embed data hourly

// ============================================================
// Page
// ============================================================

export async function generateMetadata({ params }: { params: Promise<{ chartId: string }> }) {
  const { chartId } = await params;
  const chart = resolveChart(chartId);
  const title = chart?.title || "Chart — Tamrack";
  return {
    title,
    description: `Embeddable chart: ${title}. Live Alberta economic data powered by Tamrack.`,
    robots: { index: true, follow: true },
  };
}

export default async function EmbedPage({ params }: { params: Promise<{ chartId: string }> }) {
  const { chartId } = await params;
  const chart = resolveChart(chartId);
  if (!chart) notFound();

  const rendered = await chart.render();

  return (
    <div className="bg-card text-foreground p-4" style={{ fontFamily: "system-ui, sans-serif" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-foreground">{chart.title}</h2>
        <span className="text-[9px] font-mono bg-accent/10 text-accent px-2 py-0.5 rounded-full">
          LIVE
        </span>
      </div>

      {/* Chart */}
      {rendered}

      {/* Watermark */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-card-border">
        <span className="text-[9px] text-muted/60">{chart.source}</span>
        <a
          href="https://tamrack.ca"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[9px] text-accent/60 hover:text-accent transition-colors"
        >
          Powered by Tamrack
        </a>
      </div>
    </div>
  );
}
