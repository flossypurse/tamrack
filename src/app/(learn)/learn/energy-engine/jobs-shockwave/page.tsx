import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader } from "@/components/card";
import {
  MultiSeriesLineChart,
  type MultiSeriesPoint,
  type SeriesConfig,
} from "@/components/chart";
import { ChartCard } from "@/components/chart-card";
import { computeTimeRange } from "@/lib/time-range";
import {
  fetchBoCTimeSeries,
  fetchStatCanTimeSeries,
  BOC_SERIES,
  STATSCAN_SERIES,
  type TimeSeriesPoint,
} from "@/lib/data-sources";
import {
  Prose,
  ChainStep,
  LiveDataPoint,
  DataGrid,
  Insight,
  LessonSection,
} from "@/components/learn-lesson";
import { LessonCompleteButton } from "@/components/learn-lesson-complete";

export const metadata: Metadata = {
  title: "The Jobs Shockwave — The Energy Engine — Pulse Learn",
  description:
    "From oil price drop to unemployment spike — trace the shockwave through Alberta's labour market.",
};

// ============================================================
// Helper: compute direction from recent data
// ============================================================

function computeDirection(
  data: TimeSeriesPoint[],
  months = 3
): { direction: "up" | "down" | "flat"; latest: number; change: string } {
  if (data.length < months * 2)
    return { direction: "flat", latest: data.at(-1)?.value ?? 0, change: "" };
  const recent =
    data.slice(-months).reduce((s, p) => s + p.value, 0) / months;
  const prior =
    data.slice(-months * 2, -months).reduce((s, p) => s + p.value, 0) / months;
  if (prior === 0)
    return { direction: "flat", latest: data.at(-1)?.value ?? 0, change: "" };
  const pct = ((recent - prior) / Math.abs(prior)) * 100;
  return {
    direction: pct > 2 ? "up" : pct < -2 ? "down" : "flat",
    latest: data.at(-1)?.value ?? 0,
    change: `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`,
  };
}

// ============================================================
// Loading fallback
// ============================================================

function LoadingCard() {
  return (
    <div className="animate-pulse space-y-3 border border-card-border rounded-xl p-4">
      <div className="h-4 bg-card-border rounded w-1/3" />
      <div className="h-[200px] bg-card-border/50 rounded" />
    </div>
  );
}

// ============================================================
// Jobs Shockwave section
// ============================================================

async function JobsShockwave() {
  const [unemployment, weeklyEarnings, energyIndex] = await Promise.all([
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.tableId,
      STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.coordinate,
      120
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_WEEKLY_EARNINGS.tableId,
      STATSCAN_SERIES.AB_WEEKLY_EARNINGS.coordinate,
      120
    ).catch(() => []),
    fetchBoCTimeSeries(BOC_SERIES.BCPI_ENERGY, 120).catch(() => []),
  ]);

  // Dual-axis: unemployment + energy index
  const dateMap = new Map<string, { unemployment?: number; energy?: number }>();
  for (const p of unemployment) {
    const key = p.date.slice(0, 7);
    const existing = dateMap.get(key) || {};
    existing.unemployment = p.value;
    dateMap.set(key, existing);
  }
  for (const p of energyIndex) {
    const key = p.date.slice(0, 7);
    const existing = dateMap.get(key) || {};
    existing.energy = p.value;
    dateMap.set(key, existing);
  }

  const jobsData: MultiSeriesPoint[] = [...dateMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([, v]) => v.unemployment !== undefined && v.energy !== undefined)
    .map(([date, v]) => ({
      date: `${date}-01`,
      unemployment: v.unemployment!,
      energy: v.energy!,
    }));

  const jobsSeries: SeriesConfig[] = [
    {
      key: "unemployment",
      label: "Unemployment Rate",
      color: "#ef4444",
      suffix: "%",
      yAxisId: "left",
    },
    {
      key: "energy",
      label: "BCPI Energy",
      color: "#f97316",
      yAxisId: "right",
    },
  ];

  const timeRange = computeTimeRange(unemployment);
  const unempTrend = computeDirection(unemployment);
  const earningsTrend = computeDirection(weeklyEarnings);

  return (
    <div className="space-y-4">
      <Prose>
        <p>
          When energy prices crash, the pain doesn&apos;t show up in the
          unemployment numbers right away. That&apos;s the trap — by the time
          unemployment spikes, the economic damage has been building for months.
          Here&apos;s how the shockwave travels:
        </p>
      </Prose>

      <div className="space-y-0">
        <ChainStep
          number={1}
          title="Oil prices drop"
          description="Global energy prices fall due to oversupply, demand collapse, or geopolitical shifts. Alberta's benchmark (WCS) follows."
          timeLag="Immediate"
        />
        <ChainStep
          number={2}
          title="Drilling stops"
          description="Oil companies slash capital spending. Rig counts plunge. Exploration budgets get shelved. Service companies lose contracts overnight."
          timeLag="1 month"
        />
        <ChainStep
          number={3}
          title="Oil workers laid off"
          description="Field workers, rig crews, pipeline contractors — the direct energy workforce starts getting layoff notices. Camps empty out."
          timeLag="2–3 months"
        />
        <ChainStep
          number={4}
          title="Service sector loses customers"
          description="The workers who used to eat out, buy trucks, and rent apartments are now cutting back or leaving town. Local businesses feel the squeeze."
          timeLag="3–6 months"
        />
        <ChainStep
          number={5}
          title="Restaurants and retail cut hours"
          description="Reduced foot traffic hits the service economy. Part-time workers lose shifts. Small businesses start closing. THIS is when unemployment peaks."
          timeLag="6–9 months"
        />
      </div>

      <Card>
        <CardHeader
          title="Unemployment vs. Energy Prices"
          subtitle="Notice how unemployment LAGS energy price drops by several months"
          badge="LIVE"
          freshness="daily"
        />
        <ChartCard
          chartId="learn-energy-unemployment"
          title="AB Unemployment vs Energy Prices"
          timeRange={timeRange}
          source="StatsCan 14-10-0287, Bank of Canada"
        >
          <MultiSeriesLineChart
            data={jobsData}
            series={jobsSeries}
            height={280}
            dualAxis
          />
        </ChartCard>
      </Card>

      <DataGrid>
        <LiveDataPoint
          label="AB Unemployment Rate"
          value={`${unempTrend.latest.toFixed(1)}%`}
          change={unempTrend.change}
          direction={unempTrend.direction}
          source="StatsCan"
        />
        <LiveDataPoint
          label="Avg Weekly Earnings"
          value={`$${earningsTrend.latest.toFixed(0)}`}
          change={earningsTrend.change}
          direction={earningsTrend.direction}
          source="StatsCan"
        />
      </DataGrid>

      <Insight variant="watch">
        Unemployment is a <strong>lagging</strong> indicator. By the time it
        spikes, the economic shock started months ago. If you want early
        warning, watch the BCPI Energy chart and rig counts instead — they
        move 3 to 6 months before the job losses show up in the data.
      </Insight>
    </div>
  );
}

// ============================================================
// Page
// ============================================================

export default function JobsShockwaveLessonPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
      <LessonSection title="The Jobs Shockwave">
        <Suspense fallback={<LoadingCard />}>
          <JobsShockwave />
        </Suspense>
      </LessonSection>

      <LessonCompleteButton moduleSlug="energy-engine" lessonSlug="jobs-shockwave" />
    </main>
  );
}
