import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import { ChartCard } from "@/components/chart-card";
import { computeTimeRange } from "@/lib/time-range";
import {
  MultiSeriesLineChart,
  NeighbourhoodBarChart,
  type MultiSeriesPoint,
} from "@/components/chart";
import { Building2, TrendingUp, MapPin, BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import {
  fetchCityAssessmentTrend,
  fetchTopNeighbourhoodsByAssessment,
  fetchNeighbourhoodAssessments,
} from "@/lib/data-sources-ualberta";

export const metadata: Metadata = {
  title: "Neighbourhood Assessments — Alberta Pulse",
  description:
    "Neighbourhood-level property assessment data for Edmonton and Calgary. City-wide trends, top neighbourhoods by value, and year-over-year comparisons.",
};

// ============================================================
// Server-side data fetching
// ============================================================

async function getAssessmentMetrics() {
  const trend = await fetchCityAssessmentTrend().catch(() => []);

  const latest = trend.at(-1);
  const prev = trend.at(-2);

  const edmChange =
    latest && prev && prev.edmonton > 0
      ? `${((latest.edmonton - prev.edmonton) / prev.edmonton * 100) >= 0 ? "+" : ""}${((latest.edmonton - prev.edmonton) / prev.edmonton * 100).toFixed(1)}%`
      : undefined;

  const calChange =
    latest && prev && prev.calgary > 0
      ? `${((latest.calgary - prev.calgary) / prev.calgary * 100) >= 0 ? "+" : ""}${((latest.calgary - prev.calgary) / prev.calgary * 100).toFixed(1)}%`
      : undefined;

  return {
    edmAvg: latest ? `$${latest.edmonton.toLocaleString()}` : "\u2014",
    calAvg: latest ? `$${latest.calgary.toLocaleString()}` : "\u2014",
    edmChange,
    calChange,
    edmYear: latest?.year,
    calYear: latest?.year,
  };
}

// ============================================================
// Dashboard sections
// ============================================================

async function AssessmentMetrics() {
  const m = await getAssessmentMetrics();
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Edmonton Avg Assessment"
        value={m.edmAvg}
        source={m.edmYear ? `UAlberta ${m.edmYear}` : "UAlberta"}
      />
      <MetricCard
        title="Calgary Avg Assessment"
        value={m.calAvg}
        source={m.calYear ? `UAlberta ${m.calYear}` : "UAlberta"}
      />
      <MetricCard
        title="Edmonton YoY Change"
        value={m.edmChange ?? "\u2014"}
        change={m.edmChange}
        changeLabel="vs prev year"
        source="UAlberta"
      />
      <MetricCard
        title="Calgary YoY Change"
        value={m.calChange ?? "\u2014"}
        change={m.calChange}
        changeLabel="vs prev year"
        source="UAlberta"
      />
    </div>
  );
}

async function CityTrendChart() {
  const trend = await fetchCityAssessmentTrend().catch(() => []);
  if (trend.length === 0) return null;

  const merged: MultiSeriesPoint[] = trend.map((d) => ({
    date: `${d.year}-01-01`,
    edmonton: d.edmonton,
    calgary: d.calgary,
  }));
  const timeRange = computeTimeRange(merged);

  return (
    <ChartCard
      chartId="re-assessment-city-trend"
      title="Average Property Assessment -- Edmonton vs Calgary"
      timeRange={timeRange}
      source="UAlberta Open Data Centre"
    >
      <Card>
        <CardHeader
          title="Average Property Assessment -- Edmonton vs Calgary"
          subtitle="Weighted city-wide average residential assessment value by year"
          badge="LIVE"
          freshness="daily"
        />
        <MultiSeriesLineChart
          data={merged}
          series={[
            { key: "edmonton", label: "Edmonton", color: "#3b82f6", prefix: "$" },
            { key: "calgary", label: "Calgary", color: "#ef4444", prefix: "$" },
          ]}
          height={300}
        />
        <p className="text-[10px] text-muted/60 mt-2">
          Assessment values reflect municipal property tax valuations, not market sale prices. Trends indicate relative neighbourhood investment and demand.
        </p>
      </Card>
    </ChartCard>
  );
}

async function EdmontonTopNeighbourhoods() {
  const data = await fetchTopNeighbourhoodsByAssessment("Edmonton").catch(() => []);
  if (data.length === 0) return null;

  const chartData = data.map((d) => ({
    name: d.neighbourhood,
    value: d.avgAssessment,
  }));

  return (
    <ChartCard
      chartId="re-assessment-edm-top"
      title="Top 20 Edmonton Neighbourhoods by Assessment"
      source="UAlberta Open Data Centre"
    >
      <Card>
        <CardHeader
          title="Top 20 Edmonton Neighbourhoods"
          subtitle={`Highest average property assessment (${data[0]?.year ?? "latest year"})`}
          badge="LIVE"
          freshness="daily"
        />
        <NeighbourhoodBarChart
          data={chartData}
          dataKey="value"
          labelKey="name"
          color="#3b82f6"
          valuePrefix="$"
          tooltipLabel="Avg Assessment"
          height={500}
        />
      </Card>
    </ChartCard>
  );
}

async function CalgaryTopNeighbourhoods() {
  const data = await fetchTopNeighbourhoodsByAssessment("Calgary").catch(() => []);
  if (data.length === 0) return null;

  const chartData = data.map((d) => ({
    name: d.neighbourhood,
    value: d.avgAssessment,
  }));

  return (
    <ChartCard
      chartId="re-assessment-cal-top"
      title="Top 20 Calgary Neighbourhoods by Assessment"
      source="UAlberta Open Data Centre"
    >
      <Card>
        <CardHeader
          title="Top 20 Calgary Neighbourhoods"
          subtitle={`Highest average property assessment (${data[0]?.year ?? "latest year"})`}
          badge="LIVE"
          freshness="daily"
        />
        <NeighbourhoodBarChart
          data={chartData}
          dataKey="value"
          labelKey="name"
          color="#ef4444"
          valuePrefix="$"
          tooltipLabel="Avg Assessment"
          height={500}
        />
      </Card>
    </ChartCard>
  );
}

async function EdmontonYoYTable() {
  const data = await fetchNeighbourhoodAssessments("Edmonton").catch(() => []);
  if (data.length === 0) return null;

  // Find latest two years
  const years = [...new Set(data.map((d) => d.year))].sort((a, b) => b - a);
  if (years.length < 2) return null;

  const currentYear = years[0];
  const prevYear = years[1];

  const currentMap = new Map(
    data
      .filter((d) => d.year === currentYear && d.avgAssessment > 0)
      .map((d) => [d.neighbourhood, d])
  );
  const prevMap = new Map(
    data
      .filter((d) => d.year === prevYear && d.avgAssessment > 0)
      .map((d) => [d.neighbourhood, d])
  );

  // Build comparison rows for neighbourhoods that appear in both years
  const rows: {
    neighbourhood: string;
    current: number;
    previous: number;
    change: number;
  }[] = [];

  for (const [name, curr] of currentMap) {
    const prev = prevMap.get(name);
    if (!prev) continue;
    const change = ((curr.avgAssessment - prev.avgAssessment) / prev.avgAssessment) * 100;
    rows.push({
      neighbourhood: name,
      current: curr.avgAssessment,
      previous: prev.avgAssessment,
      change,
    });
  }

  // Sort by current assessment descending, take top 15
  rows.sort((a, b) => b.current - a.current);
  const top = rows.slice(0, 15);

  return (
    <Card>
      <CardHeader
        title={`Edmonton Year-over-Year Comparison (${prevYear} vs ${currentYear})`}
        subtitle="Top 15 neighbourhoods by current assessment value"
        badge="LIVE"
        freshness="daily"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-card-border text-left text-xs text-muted uppercase tracking-wider">
              <th className="pb-2 pr-4">Neighbourhood</th>
              <th className="pb-2 pr-4 text-right">{prevYear}</th>
              <th className="pb-2 pr-4 text-right">{currentYear}</th>
              <th className="pb-2 text-right">Change</th>
            </tr>
          </thead>
          <tbody>
            {top.map((row) => (
              <tr key={row.neighbourhood} className="border-b border-card-border/50">
                <td className="py-2 pr-4 text-xs font-medium">
                  {row.neighbourhood}
                </td>
                <td className="py-2 pr-4 text-xs text-muted text-right">
                  ${row.previous.toLocaleString()}
                </td>
                <td className="py-2 pr-4 text-xs text-right">
                  ${row.current.toLocaleString()}
                </td>
                <td
                  className={`py-2 text-xs text-right font-medium ${
                    row.change >= 0 ? "text-accent-green" : "text-accent-red"
                  }`}
                >
                  {row.change >= 0 ? "+" : ""}
                  {row.change.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function LoadingCard() {
  return (
    <Card>
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-card-border rounded w-1/3" />
        <div className="h-[200px] bg-card-border/50 rounded" />
      </div>
    </Card>
  );
}

// ============================================================
// Page
// ============================================================

export default function AssessmentsPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Neighbourhood Assessments"
        description="Property assessment data at the neighbourhood level for Edmonton and Calgary. City-wide trends, top-valued neighbourhoods, and year-over-year comparisons from the University of Alberta Open Data Centre."
        category="realestate"
        icon={<Building2 size={20} />}
      >
        <div className="flex flex-wrap gap-2">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-mono">INVESTORS</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 font-mono">REALTORS</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-mono">RESEARCHERS</span>
        </div>
      </PageHeader>

      {/* Key Metrics */}
      <section>
        <Suspense
          fallback={
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i}>
                  <div className="animate-pulse space-y-2">
                    <div className="h-3 bg-card-border rounded w-1/2" />
                    <div className="h-7 bg-card-border rounded w-2/3" />
                  </div>
                </Card>
              ))}
            </div>
          }
        >
          <AssessmentMetrics />
        </Suspense>
      </section>

      {/* City-Level Trend */}
      <section>
        <SectionHeader title="City-Wide Trend" icon={<TrendingUp size={16} />} category="realestate" />
        <Suspense fallback={<LoadingCard />}>
          <CityTrendChart />
        </Suspense>
      </section>

      {/* Top Neighbourhoods */}
      <section>
        <SectionHeader title="Top Neighbourhoods by Value" icon={<MapPin size={16} />} category="realestate" />
        <div className="grid lg:grid-cols-2 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <EdmontonTopNeighbourhoods />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <CalgaryTopNeighbourhoods />
          </Suspense>
        </div>
      </section>

      {/* Year-over-Year Table */}
      <section>
        <SectionHeader title="Year-over-Year Comparison" icon={<BarChart3 size={16} />} category="realestate" />
        <Suspense fallback={<LoadingCard />}>
          <EdmontonYoYTable />
        </Suspense>
      </section>

      {/* Context */}
      <section>
        <Card>
          <h3 className="text-sm font-medium mb-2">Who Uses This</h3>
          <div className="grid sm:grid-cols-3 gap-3 text-xs text-muted">
            <div>
              <p className="font-medium text-foreground mb-1">Real Estate Investors</p>
              <p>Identify neighbourhoods with rising assessments as a leading indicator of market appreciation. Cross-city comparison reveals arbitrage opportunities.</p>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">Realtors</p>
              <p>Use assessment trends to support pricing conversations. Neighbourhoods with consistent YoY gains signal strong fundamentals for buyers.</p>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">Researchers</p>
              <p>Track neighbourhood-level property value distributions across Edmonton and Calgary. Useful for urban planning, tax policy analysis, and housing research.</p>
            </div>
          </div>
        </Card>
      </section>

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Alberta Pulse Check &mdash; Neighbourhood Assessments &mdash; UAlberta Open Data Centre
      </footer>
    </main>
  );
}
