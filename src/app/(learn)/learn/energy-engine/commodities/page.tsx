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
  BOC_SERIES,
  type TimeSeriesPoint,
} from "@/lib/data-sources";
import {
  Prose,
  BigQuestion,
  LiveDataPoint,
  DataGrid,
  Insight,
  Expandable,
  LessonSection,
} from "@/components/learn-lesson";
import { LessonCompleteButton } from "@/components/learn-lesson-complete";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Energy Commodities — The Energy Engine — Pulse Learn",
  description:
    "BCPI Energy, WCS, and what drives prices. Live data from Bank of Canada.",
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
    <Card>
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-card-border rounded w-1/3" />
        <div className="h-[200px] bg-card-border/50 rounded" />
      </div>
    </Card>
  );
}

// ============================================================
// Energy Commodities section
// ============================================================

async function EnergyEngine() {
  const [energyIndex, allCommodities, cadUsd] = await Promise.all([
    fetchBoCTimeSeries(BOC_SERIES.BCPI_ENERGY, 240).catch(() => []),
    fetchBoCTimeSeries(BOC_SERIES.BCPI_ALL, 240).catch(() => []),
    fetchBoCTimeSeries(BOC_SERIES.CAD_USD, 240).catch(() => []),
  ]);

  const energyTimeRange = computeTimeRange(energyIndex);

  // Build dual-axis multi-series data: energy index + CAD/USD
  const dateMap = new Map<string, { energy?: number; cad?: number }>();
  for (const p of energyIndex) {
    const key = p.date.slice(0, 7); // YYYY-MM
    const existing = dateMap.get(key) || {};
    existing.energy = p.value;
    dateMap.set(key, existing);
  }
  for (const p of cadUsd) {
    const key = p.date.slice(0, 7);
    const existing = dateMap.get(key) || {};
    existing.cad = p.value;
    dateMap.set(key, existing);
  }

  const combinedData: MultiSeriesPoint[] = [...dateMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([, v]) => v.energy !== undefined && v.cad !== undefined)
    .map(([date, v]) => ({
      date: `${date}-01`,
      energy: v.energy!,
      cad: v.cad!,
    }));

  const combinedSeries: SeriesConfig[] = [
    { key: "energy", label: "BCPI Energy", color: "#f97316", yAxisId: "left" },
    {
      key: "cad",
      label: "CAD/USD",
      color: "#3b82f6",
      prefix: "$",
      yAxisId: "right",
    },
  ];

  const energyTrend = computeDirection(energyIndex);

  return (
    <div className="space-y-4">
      <Prose>
        <p>
          The Bank of Canada publishes an Energy Commodity Price Index (BCPI
          Energy) that tracks the prices of Canadian energy exports — crude oil,
          natural gas, and refined products — all in a single number. When this
          number moves, Alberta feels it first.
        </p>
        <p>
          Look at the chart below. You can see the major energy cycles of the
          last two decades: the 2008 super-spike before the financial crisis, the
          2014 oil price collapse that gutted Alberta&apos;s provincial budget,
          the 2020 pandemic crash when oil briefly went negative, and the 2022
          energy spike from the Ukraine war. Every one of those events reshaped
          Alberta&apos;s economy for years afterward.
        </p>
      </Prose>

      <Card>
        <CardHeader
          title="Energy Commodities vs. Canadian Dollar"
          subtitle="BCPI Energy Index (left axis) and CAD/USD exchange rate (right axis)"
          badge="LIVE"
          freshness="daily"
        />
        <ChartCard
          chartId="learn-energy-bcpi-cad"
          title="Energy Commodities vs CAD/USD"
          timeRange={energyTimeRange}
          source="Bank of Canada Valet API"
        >
          <MultiSeriesLineChart
            data={combinedData}
            series={combinedSeries}
            height={280}
            dualAxis
          />
        </ChartCard>
      </Card>

      <DataGrid>
        <LiveDataPoint
          label="BCPI Energy Index"
          value={energyTrend.latest.toFixed(1)}
          change={energyTrend.change}
          direction={energyTrend.direction}
          source="Bank of Canada"
        />
      </DataGrid>

      <Prose>
        <p>
          Notice how the Canadian dollar (blue line) tends to follow energy
          prices? That&apos;s because Canada is a net energy exporter. When oil
          is expensive, global demand for Canadian dollars goes up. But
          here&apos;s the twist that most people miss: when the Canadian dollar is{" "}
          <em>weak</em>, Alberta&apos;s oil revenue actually gets a boost.
          Oil is priced in US dollars, so a weaker loonie means more Canadian
          dollars per barrel. A drop from $0.80 to $0.72 USD/CAD gives
          Alberta&apos;s producers an automatic ~11% raise in Canadian-dollar
          terms.
        </p>
      </Prose>

      <Insight>
        Alberta&apos;s economy doesn&apos;t follow the S&amp;P 500 — it follows
        the BCPI Energy chart. This single index is the best leading indicator
        for what happens next in the province.
      </Insight>

      <Expandable title="What's in the BCPI Energy Index?">
        <Prose>
          <p>
            The BCPI Energy index tracks a weighted basket of Canadian energy
            commodity export prices: Western Canadian Select (WCS) crude oil,
            Brent crude, natural gas (AECO hub price), and refined petroleum
            products. The index is set to 100 at a base year, so a reading of
            200 means energy prices have doubled relative to the base. The Bank
            of Canada updates this weekly.
          </p>
        </Prose>
      </Expandable>
    </div>
  );
}

// ============================================================
// Page
// ============================================================

export default function CommoditiesLessonPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
      <BigQuestion>What happens when oil prices drop?</BigQuestion>

      <Prose>
        <p>
          In Alberta, oil isn&apos;t just an industry — it&apos;s THE industry.
          When energy moves, everything moves with it. But <em>how</em> it
          moves, and how <em>fast</em>, is what most people get wrong.
        </p>
        <p>
          This lesson traces how energy commodity prices drive the Canadian
          dollar and set the tone for Alberta&apos;s entire economy. Every chart
          uses live data. Every connection is backed by the numbers.
        </p>
      </Prose>

      <LessonSection title="The Engine — Energy Commodities">
        <Suspense fallback={<LoadingCard />}>
          <EnergyEngine />
        </Suspense>
      </LessonSection>

      <LessonCompleteButton moduleSlug="energy-engine" lessonSlug="commodities" />
    </main>
  );
}
