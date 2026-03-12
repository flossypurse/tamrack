import { notFound } from "next/navigation";
import { NeighbourhoodBarChart, TimeSeriesAreaChart } from "@/components/chart";
import { getMunicipality, getLiveMunicipalities } from "@/lib/municipality-registry";
import {
  fetchAssessmentsByGroup,
  fetchBusinessCategories,
  fetchVacantLots,
  fetchPermitsByGroup,
} from "@/lib/municipality-data";
import {
  fetchBoCTimeSeries,
  fetchStatCanTimeSeries,
  BOC_SERIES,
  STATSCAN_SERIES,
} from "@/lib/data-sources";

export const dynamic = "force-dynamic";

// ============================================================
// Chart registry — maps chartId to data fetcher + renderer
// ============================================================

interface ChartDef {
  title: string;
  source: string;
  render: () => Promise<React.ReactNode>;
}

function municipalityChart(slug: string, type: string): ChartDef | null {
  const config = getMunicipality(slug);
  if (!config) return null;

  switch (type) {
    case "assessment-by-zone":
      return {
        title: `${config.name} — Avg Assessment by Zone`,
        source: config.dataSource,
        render: async () => {
          const data = await fetchAssessmentsByGroup(config, "zoning");
          const chartData = data.slice(0, 15).map((d) => ({
            neighbourhood: d.group,
            avgValue: d.avgAssessment,
          }));
          return (
            <NeighbourhoodBarChart
              data={chartData}
              dataKey="avgValue"
              color={config.color}
              valuePrefix="$"
              tooltipLabel="Avg Assessment"
              height={350}
            />
          );
        },
      };

    case "properties-by-zone":
      return {
        title: `${config.name} — Properties by Zone`,
        source: config.dataSource,
        render: async () => {
          const data = await fetchAssessmentsByGroup(config, "zoning");
          const chartData = data.slice(0, 15).map((d) => ({
            neighbourhood: d.group,
            permits: d.count,
          }));
          return (
            <NeighbourhoodBarChart
              data={chartData}
              dataKey="permits"
              color="#3b82f6"
              tooltipLabel="Properties"
              height={350}
            />
          );
        },
      };

    case "assessment-by-neighbourhood":
    case "assessment-by-subdivision":
      return {
        title: `${config.name} — Avg Assessment by Area`,
        source: config.dataSource,
        render: async () => {
          const groupBy = config.fields.neighbourhood ? "neighbourhood" : "subdivision";
          const data = await fetchAssessmentsByGroup(config, groupBy);
          const chartData = data
            .sort((a, b) => b.avgAssessment - a.avgAssessment)
            .slice(0, 15)
            .map((d) => ({
              neighbourhood: d.group,
              avgValue: d.avgAssessment,
            }));
          return (
            <NeighbourhoodBarChart
              data={chartData}
              dataKey="avgValue"
              color="#10b981"
              valuePrefix="$"
              tooltipLabel="Avg Assessment"
              height={350}
            />
          );
        },
      };

    case "businesses":
      return {
        title: `${config.name} — Businesses by Category`,
        source: config.dataSource,
        render: async () => {
          const data = await fetchBusinessCategories(config);
          const chartData = data.slice(0, 15).map((d) => ({
            neighbourhood: d.category,
            permits: d.count,
          }));
          return (
            <NeighbourhoodBarChart
              data={chartData}
              dataKey="permits"
              color="#a855f7"
              tooltipLabel="Businesses"
              height={350}
            />
          );
        },
      };

    case "vacant":
      return {
        title: `${config.name} — Vacant Lots`,
        source: config.dataSource,
        render: async () => {
          const data = await fetchVacantLots(config);
          const chartData = data.map((d) => ({
            neighbourhood: d.group,
            permits: d.count,
          }));
          return (
            <NeighbourhoodBarChart
              data={chartData}
              dataKey="permits"
              color="#f59e0b"
              tooltipLabel="Vacant Lots"
              height={350}
            />
          );
        },
      };

    case "permits":
      return {
        title: `${config.name} — Permits`,
        source: config.dataSource,
        render: async () => {
          const data = await fetchPermitsByGroup(config);
          const chartData = data.slice(0, 15).map((d) => ({
            neighbourhood: d.group,
            permits: d.count,
          }));
          return (
            <NeighbourhoodBarChart
              data={chartData}
              dataKey="permits"
              color="#3b82f6"
              tooltipLabel="Permits"
              height={350}
            />
          );
        },
      };

    default:
      return null;
  }
}

// Macro charts (province-wide)
function macroChart(type: string): ChartDef | null {
  switch (type) {
    case "policy-rate":
      return {
        title: "BoC Policy Rate",
        source: "Bank of Canada Valet API",
        render: async () => {
          const data = await fetchBoCTimeSeries(BOC_SERIES.POLICY_RATE);
          return <TimeSeriesAreaChart data={data} color="#3b82f6" height={350} valueSuffix="%" />;
        },
      };

    case "cad-usd":
      return {
        title: "CAD/USD Exchange Rate",
        source: "Bank of Canada Valet API",
        render: async () => {
          const data = await fetchBoCTimeSeries(BOC_SERIES.CAD_USD);
          return <TimeSeriesAreaChart data={data} color="#10b981" height={350} valuePrefix="$" />;
        },
      };

    case "unemployment":
      return {
        title: "Alberta Unemployment Rate",
        source: "Statistics Canada 14-10-0287",
        render: async () => {
          const s = STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE;
          const data = await fetchStatCanTimeSeries(s.tableId, s.coordinate);
          return <TimeSeriesAreaChart data={data} color="#ef4444" height={350} valueSuffix="%" />;
        },
      };

    case "cpi":
      return {
        title: "Alberta CPI (All Items)",
        source: "Statistics Canada 18-10-0004",
        render: async () => {
          const s = STATSCAN_SERIES.AB_CPI;
          const data = await fetchStatCanTimeSeries(s.tableId, s.coordinate);
          return <TimeSeriesAreaChart data={data} color="#f59e0b" height={350} />;
        },
      };

    case "population":
      return {
        title: "Alberta Population",
        source: "Statistics Canada 17-10-0005",
        render: async () => {
          const s = STATSCAN_SERIES.AB_POPULATION;
          const data = await fetchStatCanTimeSeries(s.tableId, s.coordinate);
          return <TimeSeriesAreaChart data={data} color="#8b5cf6" height={350} compact />;
        },
      };

    default:
      return null;
  }
}

function resolveChart(chartId: string): ChartDef | null {
  // Macro charts: "macro-policy-rate", "macro-unemployment"
  if (chartId.startsWith("macro-")) {
    return macroChart(chartId.replace("macro-", ""));
  }

  // Municipality charts: "{slug}-{type}"
  // Find the longest matching slug
  const allSlugs = getLiveMunicipalities().map((m) => m.slug).sort((a, b) => b.length - a.length);
  for (const slug of allSlugs) {
    if (chartId.startsWith(`${slug}-`)) {
      const type = chartId.slice(slug.length + 1);
      return municipalityChart(slug, type);
    }
  }

  return null;
}

// ============================================================
// Page
// ============================================================

export async function generateMetadata({ params }: { params: Promise<{ chartId: string }> }) {
  const { chartId } = await params;
  const chart = resolveChart(chartId);
  return {
    title: chart?.title || "Chart — Alberta Pulse Check",
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
          href="https://albertapulse.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[9px] text-accent/60 hover:text-accent transition-colors"
        >
          Powered by Alberta Pulse Check
        </a>
      </div>
    </div>
  );
}
