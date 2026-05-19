import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import { ChartCard } from "@/components/chart-card";
import { computeTimeRange } from "@/lib/time-range";
import { SITE_URL } from "@/lib/constants/site";

export const metadata: Metadata = {
  title: "Alberta Housing Development Pipeline",
  description: "CMHC housing starts, completions, and units under construction for Edmonton CMA. Track the residential development pipeline and absorption rates.",
  alternates: {
    canonical: `${SITE_URL}/real-estate/pipeline`,
  },
};
import {
  TimeSeriesAreaChart,
  TimeSeriesBarChart,
  MultiSeriesLineChart,
  type MultiSeriesPoint,
} from "@/components/chart";
import {
  Building,
  HardHat,
  Layers,
  BarChart3,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import {
  fetchStatCanTimeSeries,
  STATSCAN_SERIES,
  type TimeSeriesPoint,
} from "@/lib/data-sources";

// ============================================================
// Server-side data fetching
// ============================================================

async function getPipelineMetrics() {
  const [starts, completions, underConstruction] = await Promise.all([
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.tableId,
      STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.coordinate,
      2
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.EDMONTON_HOUSING_COMPLETIONS.tableId,
      STATSCAN_SERIES.EDMONTON_HOUSING_COMPLETIONS.coordinate,
      2
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.EDMONTON_UNDER_CONSTRUCTION.tableId,
      STATSCAN_SERIES.EDMONTON_UNDER_CONSTRUCTION.coordinate,
      2
    ).catch(() => []),
  ]);

  const fmt = (pts: TimeSeriesPoint[]) => {
    const latest = pts.at(-1);
    const prev = pts.at(-2);
    const change =
      latest && prev
        ? ((latest.value - prev.value) / prev.value * 100).toFixed(1)
        : null;
    return {
      value: latest ? latest.value.toLocaleString() : "—",
      change: change
        ? `${parseFloat(change) >= 0 ? "+" : ""}${change}%`
        : undefined,
    };
  };

  return {
    starts: fmt(starts),
    completions: fmt(completions),
    underConstruction: fmt(underConstruction),
    // Pipeline ratio: under construction / completions = months of backlog proxy
    backlogRatio:
      underConstruction.at(-1) && completions.at(-1) && completions.at(-1)!.value > 0
        ? (underConstruction.at(-1)!.value / completions.at(-1)!.value).toFixed(1)
        : "—",
  };
}

// ============================================================
// Dashboard sections
// ============================================================

async function PipelineMetrics() {
  const m = await getPipelineMetrics();
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Housing Starts"
        value={m.starts.value}
        change={m.starts.change}
        changeLabel="vs prev period"
        source="StatsCan 34-10-0154"
      />
      <MetricCard
        title="Completions"
        value={m.completions.value}
        change={m.completions.change}
        changeLabel="vs prev period"
        source="StatsCan 34-10-0154"
      />
      <MetricCard
        title="Under Construction"
        value={m.underConstruction.value}
        change={m.underConstruction.change}
        changeLabel="vs prev period"
        source="StatsCan 34-10-0154"
      />
      <MetricCard
        title="Pipeline Ratio"
        value={`${m.backlogRatio}x`}
        source="Under construction / completions"
      />
    </div>
  );
}

async function StartsChart() {
  const data = await fetchStatCanTimeSeries(
    STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.tableId,
    STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.coordinate,
    60
  );
  const timeRange = computeTimeRange(data);
  return (
    <ChartCard chartId="re-housing-starts" title="Housing Starts — Edmonton CMA" timeRange={timeRange} source="StatsCan">
      <Card>
        <CardHeader
          title="Housing Starts — Edmonton CMA"
          subtitle="New housing units started each month. The leading indicator of future supply."
          badge="LIVE"
        />
        <TimeSeriesBarChart data={data} color="#3b82f6" height={280} />
        <p className="text-[10px] text-muted/60 mt-2">
          Rising starts signal developer confidence. A surge followed by a drop often precedes oversupply.
        </p>
      </Card>
    </ChartCard>
  );
}

async function CompletionsChart() {
  const data = await fetchStatCanTimeSeries(
    STATSCAN_SERIES.EDMONTON_HOUSING_COMPLETIONS.tableId,
    STATSCAN_SERIES.EDMONTON_HOUSING_COMPLETIONS.coordinate,
    60
  );
  const timeRange = computeTimeRange(data);
  return (
    <ChartCard chartId="re-housing-completions" title="Housing Completions — Edmonton CMA" timeRange={timeRange} source="StatsCan">
      <Card>
        <CardHeader
          title="Housing Completions — Edmonton CMA"
          subtitle="Units completed and ready for occupancy each month."
          badge="LIVE"
        />
        <TimeSeriesBarChart data={data} color="#10b981" height={250} />
      </Card>
    </ChartCard>
  );
}

async function UnderConstructionChart() {
  const data = await fetchStatCanTimeSeries(
    STATSCAN_SERIES.EDMONTON_UNDER_CONSTRUCTION.tableId,
    STATSCAN_SERIES.EDMONTON_UNDER_CONSTRUCTION.coordinate,
    60
  );
  const timeRange = computeTimeRange(data);
  return (
    <ChartCard chartId="re-under-construction" title="Units Under Construction — Edmonton CMA" timeRange={timeRange} source="StatsCan">
      <Card>
        <CardHeader
          title="Units Under Construction — Edmonton CMA"
          subtitle="Total units currently being built. The supply pipeline."
          badge="LIVE"
        />
        <TimeSeriesAreaChart data={data} color="#8b5cf6" height={250} />
        <p className="text-[10px] text-muted/60 mt-2">
          When this number grows faster than completions, expect delivery delays and potential cost overruns.
        </p>
      </Card>
    </ChartCard>
  );
}

async function PipelineOverlayChart() {
  const [starts, completions, underConstruction] = await Promise.all([
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.tableId,
      STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.coordinate,
      60
    ),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.EDMONTON_HOUSING_COMPLETIONS.tableId,
      STATSCAN_SERIES.EDMONTON_HOUSING_COMPLETIONS.coordinate,
      60
    ),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.EDMONTON_UNDER_CONSTRUCTION.tableId,
      STATSCAN_SERIES.EDMONTON_UNDER_CONSTRUCTION.coordinate,
      60
    ),
  ]);

  const dateMap = new Map<string, MultiSeriesPoint>();
  for (const p of starts) {
    dateMap.set(p.date, { date: p.date, starts: p.value, completions: 0, underConstruction: 0 });
  }
  for (const p of completions) {
    const existing = dateMap.get(p.date);
    if (existing) existing.completions = p.value;
    else dateMap.set(p.date, { date: p.date, starts: 0, completions: p.value, underConstruction: 0 });
  }
  for (const p of underConstruction) {
    const existing = dateMap.get(p.date);
    if (existing) existing.underConstruction = p.value;
  }
  const merged = Array.from(dateMap.values()).sort((a, b) =>
    String(a.date).localeCompare(String(b.date))
  );
  const timeRange = computeTimeRange(merged);

  return (
    <ChartCard chartId="re-pipeline-overlay" title="Full Pipeline Overlay" timeRange={timeRange} source="StatsCan">
      <Card>
        <CardHeader
          title="Full Pipeline Overlay"
          subtitle="Starts → Under Construction → Completions. Watch for divergences."
          badge="LIVE"
        />
        <MultiSeriesLineChart
          data={merged}
          series={[
            { key: "starts", label: "Starts", color: "#3b82f6", yAxisId: "left" },
            { key: "completions", label: "Completions", color: "#10b981", yAxisId: "left" },
            { key: "underConstruction", label: "Under Construction", color: "#8b5cf6", yAxisId: "right" },
          ]}
          height={300}
          dualAxis
        />
        <p className="text-[10px] text-muted/60 mt-2">
          When starts exceed completions for months, the &quot;under construction&quot; backlog grows — signaling either strong demand or impending oversupply.
        </p>
      </Card>
    </ChartCard>
  );
}

async function StartsVsPermitsChart() {
  const [starts, permitValue] = await Promise.all([
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.tableId,
      STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.coordinate,
      40
    ),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.EDMONTON_CMA_RES_PERMIT_VALUE.tableId,
      STATSCAN_SERIES.EDMONTON_CMA_RES_PERMIT_VALUE.coordinate,
      40
    ),
  ]);

  const dateMap = new Map<string, MultiSeriesPoint>();
  for (const p of starts) {
    dateMap.set(p.date, { date: p.date, starts: p.value, permitValue: 0 });
  }
  for (const p of permitValue) {
    const existing = dateMap.get(p.date);
    if (existing) existing.permitValue = p.value;
  }
  const merged = Array.from(dateMap.values())
    .filter((p) => p.starts && p.permitValue)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const timeRange = computeTimeRange(merged);

  return (
    <ChartCard chartId="re-starts-vs-permits" title="Housing Starts vs Permit Value" timeRange={timeRange} source="StatsCan">
      <Card>
        <CardHeader
          title="Housing Starts vs Permit Value"
          subtitle="Permits lead starts by 3-6 months — watch for divergences"
          badge="LIVE"
        />
        <MultiSeriesLineChart
          data={merged}
          series={[
            { key: "starts", label: "Housing Starts", color: "#3b82f6", yAxisId: "left" },
            { key: "permitValue", label: "Permit Value ($)", color: "#f59e0b", prefix: "$", yAxisId: "right" },
          ]}
          height={280}
          dualAxis
        />
      </Card>
    </ChartCard>
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

export default function PipelinePage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Development Pipeline"
        description="Housing starts, completions, and the construction backlog for Edmonton CMA. This is the supply side of the equation — are we building enough, too much, or too little?"
        category="realestate"
        icon={<Building size={20} />}
      >
        <div className="flex flex-wrap gap-2">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-mono">DEVELOPERS</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono">LENDERS</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 font-mono">INVESTORS</span>
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
          <PipelineMetrics />
        </Suspense>
      </section>

      {/* Pipeline Overlay */}
      <section>
        <SectionHeader title="The Full Pipeline" icon={<Layers size={16} />} category="realestate" />
        <Suspense fallback={<LoadingCard />}>
          <PipelineOverlayChart />
        </Suspense>
      </section>

      {/* Individual charts */}
      <section>
        <SectionHeader title="Pipeline Stages" icon={<HardHat size={16} />} category="realestate" />
        <div className="grid md:grid-cols-2 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <StartsChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <CompletionsChart />
          </Suspense>
        </div>
      </section>

      <section>
        <Suspense fallback={<LoadingCard />}>
          <UnderConstructionChart />
        </Suspense>
      </section>

      {/* Starts vs Permits */}
      <section>
        <SectionHeader title="Leading Indicators" icon={<BarChart3 size={16} />} category="realestate" />
        <Suspense fallback={<LoadingCard />}>
          <StartsVsPermitsChart />
        </Suspense>
      </section>

      {/* Context */}
      <section>
        <Card>
          <h3 className="text-sm font-medium mb-2">Who Uses This</h3>
          <div className="grid sm:grid-cols-3 gap-3 text-xs text-muted">
            <div>
              <p className="font-medium text-foreground mb-1">Developers & Builders</p>
              <p>Track starts vs completions to time land purchases. When completions lag starts, expect delivery bottlenecks.</p>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">Mortgage Lenders</p>
              <p>Monitor pipeline ratio for oversupply risk. A ratio above 3x signals extended delivery timelines.</p>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">Investors</p>
              <p>Permits lead starts by 3-6 months. When permits spike but starts don&apos;t follow, developers may be losing confidence.</p>
            </div>
          </div>
        </Card>
      </section>
    </main>
  );
}
