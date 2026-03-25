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
  LiveDataPoint,
  DataGrid,
  Insight,
  LessonSection,
} from "@/components/learn-lesson";
import { LessonCompleteButton } from "@/components/learn-lesson-complete";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The Migration Effect — The Energy Engine — Pulse Learn",
  description:
    "People follow the money — in and out. How energy prices drive Alberta's population swings.",
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
// Migration Effect section
// ============================================================

async function MigrationEffect() {
  const [migration, population, energyIndex] = await Promise.all([
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_NET_INTERPROVINCIAL.tableId,
      STATSCAN_SERIES.AB_NET_INTERPROVINCIAL.coordinate,
      80
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_POPULATION.tableId,
      STATSCAN_SERIES.AB_POPULATION.coordinate,
      80
    ).catch(() => []),
    fetchBoCTimeSeries(BOC_SERIES.BCPI_ENERGY, 80).catch(() => []),
  ]);

  const migrationTimeRange = computeTimeRange(migration);

  // Dual-axis: migration + energy
  const dateMap = new Map<string, { migration?: number; energy?: number }>();
  for (const p of migration) {
    const key = p.date.slice(0, 7);
    const existing = dateMap.get(key) || {};
    existing.migration = p.value;
    dateMap.set(key, existing);
  }
  for (const p of energyIndex) {
    const key = p.date.slice(0, 7);
    const existing = dateMap.get(key) || {};
    existing.energy = p.value;
    dateMap.set(key, existing);
  }

  const migrationData: MultiSeriesPoint[] = [...dateMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([, v]) => v.migration !== undefined)
    .map(([date, v]) => ({
      date: `${date}-01`,
      migration: v.migration!,
      ...(v.energy !== undefined ? { energy: v.energy } : {}),
    }));

  const migrationSeries: SeriesConfig[] = [
    {
      key: "migration",
      label: "Net Interprovincial Migration",
      color: "#ec4899",
      yAxisId: "left",
    },
    {
      key: "energy",
      label: "BCPI Energy",
      color: "#f97316",
      yAxisId: "right",
    },
  ];

  const migTrend = computeDirection(migration, 2);
  const popTrend = computeDirection(population, 2);

  return (
    <div className="space-y-4">
      <Prose>
        <p>
          Alberta isn&apos;t like Ontario or BC, where population growth is
          steady and predictable. Alberta&apos;s population swings with the
          energy cycle — dramatically.
        </p>
        <p>
          When oil booms, workers flood in from Ontario, BC, the Maritimes, and
          Saskatchewan. They need housing, so rents spike and house prices
          climb. When oil busts, many of those same workers leave. Apartments
          empty out, house prices soften, and vacancies climb.
        </p>
        <p>
          This creates a <strong>secondary wave</strong> that amplifies the
          original energy shock. Boom means shortage means prices up. Bust means
          vacancy means prices down. It&apos;s the same dollars, moving through
          the system.
        </p>
      </Prose>

      <Card>
        <CardHeader
          title="Interprovincial Migration vs. Energy Prices"
          subtitle="Net people moving to/from Alberta from other provinces"
          badge="LIVE"
          freshness="daily"
        />
        <ChartCard
          chartId="learn-energy-migration"
          title="AB Net Interprovincial Migration vs Energy"
          timeRange={migrationTimeRange}
          source="StatsCan 17-10-0008, Bank of Canada"
        >
          <MultiSeriesLineChart
            data={migrationData}
            series={migrationSeries}
            height={280}
            dualAxis
          />
        </ChartCard>
      </Card>

      <DataGrid>
        <LiveDataPoint
          label="Net Interprovincial Migration"
          value={migTrend.latest.toLocaleString()}
          change={migTrend.change}
          direction={migTrend.direction}
          source="StatsCan"
        />
        <LiveDataPoint
          label="AB Population"
          value={`${(popTrend.latest / 1_000_000).toFixed(2)}M`}
          change={popTrend.change}
          direction={popTrend.direction}
          source="StatsCan"
        />
      </DataGrid>

      <Insight>
        Alberta&apos;s population swings are more volatile than any other
        province because of energy. When you see the BCPI Energy index rising,
        expect housing pressure 12 to 18 months later as workers arrive. When
        it falls, expect the opposite.
      </Insight>
    </div>
  );
}

// ============================================================
// Page
// ============================================================

export default function MigrationLessonPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
      <LessonSection title="The Migration Effect">
        <Suspense fallback={<LoadingCard />}>
          <MigrationEffect />
        </Suspense>
      </LessonSection>

      <LessonCompleteButton moduleSlug="energy-engine" lessonSlug="migration" />
    </main>
  );
}
