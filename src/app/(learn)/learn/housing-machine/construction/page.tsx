import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader } from "@/components/card";
import {
  MultiSeriesLineChart,
  type MultiSeriesPoint,
} from "@/components/chart";
import { ChartCard } from "@/components/chart-card";
import { computeTimeRange } from "@/lib/time-range";
import {
  fetchStatCanTimeSeries,
  STATSCAN_SERIES,
} from "@/lib/data-sources";
import { fetchHousingStarts } from "@/lib/data-sources-cmhc";
import {
  Prose,
  ChainStep,
  LiveDataPoint,
  DataGrid,
  Insight,
  Expandable,
  LessonSection,
} from "@/components/learn-lesson";
import { LessonCompleteButton } from "@/components/learn-lesson-complete";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Building the Supply — The Housing Machine — Pulse Learn",
  description:
    "Starts, completions, and the 12-24 month construction pipeline. Live data from CMHC and StatsCan.",
};

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
// Developer Section — Housing Starts
// ============================================================

async function DeveloperSection() {
  const startsData = await fetchHousingStarts(60).catch(() => []);
  const timeRange = computeTimeRange(startsData);

  const multiData: MultiSeriesPoint[] = startsData.map((p) => ({
    date: p.date,
    edmonton: p.edmonton,
    calgary: p.calgary,
  }));

  const latestStarts = startsData.at(-1);

  return (
    <div className="space-y-4">
      <ChainStep
        number={4}
        title="New construction responds to demand signals"
        description="Developers watch sales volumes, price trends, and — crucially — financing costs. When rates drop and demand heats up, they pull permits and break ground. When rates spike, projects get shelved."
        timeLag="3–12 months after rate changes"
      />

      <Prose>
        <p>
          A developer deciding to build a 200-unit apartment building is making a
          bet that will not pay off for 2-3 years. They borrow millions at today's
          rates, build for 18+ months, and then sell or lease into whatever market
          exists when they finish. So they are incredibly sensitive to interest rates
          — not just today's rates, but where they think rates are headed.
        </p>
        <p>
          Housing starts — the number of new units where construction has actually
          begun — are the clearest signal of what supply will look like in 1-2
          years. Watch how Edmonton and Calgary track each other but are not
          identical: Calgary's boom-bust cycles are sharper because of its heavier
          tilt toward the energy sector.
        </p>
      </Prose>

      <Card>
        <CardHeader title="Housing Starts — Edmonton vs Calgary" freshness="daily" />
        <ChartCard
          chartId="learn-housing-starts-cma"
          title="Housing Starts — Edmonton vs Calgary"
          timeRange={timeRange}
          source="StatsCan / CMHC"
        >
          <MultiSeriesLineChart
            data={multiData}
            series={[
              { key: "edmonton", label: "Edmonton", color: "#3b82f6", suffix: " units" },
              { key: "calgary", label: "Calgary", color: "#f97316", suffix: " units" },
            ]}
            height={250}
          />
        </ChartCard>
      </Card>

      {latestStarts && (
        <DataGrid>
          <LiveDataPoint
            label="Edmonton Starts (latest)"
            value={latestStarts.edmonton.toLocaleString()}
            source="CMHC"
          />
          <LiveDataPoint
            label="Calgary Starts (latest)"
            value={latestStarts.calgary.toLocaleString()}
            source="CMHC"
          />
        </DataGrid>
      )}

      <Expandable title="What about zoning and approvals?">
        <Prose>
          <p>
            Interest rates are only half the story. Municipal zoning, permitting
            timelines, NIMBYism, and construction labour shortages all slow down
            the pipeline. Edmonton recently upzoned the entire city to allow mid-rise
            housing everywhere — that is a structural change that should increase
            supply response over time. But even with perfect zoning, you cannot
            build faster than trades workers can pour concrete.
          </p>
        </Prose>
      </Expandable>
    </div>
  );
}

// ============================================================
// Pipeline Section — Starts vs Completions
// ============================================================

async function PipelineSection() {
  const [startsRaw, completionsRaw] = await Promise.all([
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.tableId,
      STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.coordinate,
      60
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.EDMONTON_HOUSING_COMPLETIONS.tableId,
      STATSCAN_SERIES.EDMONTON_HOUSING_COMPLETIONS.coordinate,
      60
    ).catch(() => []),
  ]);

  const dateMap = new Map<string, MultiSeriesPoint>();
  for (const p of startsRaw) {
    dateMap.set(p.date, { date: p.date, starts: p.value, completions: 0 });
  }
  for (const p of completionsRaw) {
    const existing = dateMap.get(p.date);
    if (existing) {
      existing.completions = p.value;
    } else {
      dateMap.set(p.date, { date: p.date, starts: 0, completions: p.value });
    }
  }
  const merged = Array.from(dateMap.values()).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const timeRange = computeTimeRange(merged);

  return (
    <div className="space-y-4">
      <ChainStep
        number={5}
        title="Construction takes 12-24 months"
        description="Once ground is broken, it takes 1-2 years before units are ready to occupy. The gap between starts and completions today tells you what supply will look like in 12-18 months."
        timeLag="12–24 months"
      />

      <Prose>
        <p>
          This is the part that most people miss. When starts spike today, those
          units will not hit the market for over a year. If completions are low
          right now, that means we are living with decisions developers made 18
          months ago — before the most recent rate cuts.
        </p>
        <p>
          The chart below shows Edmonton's construction pipeline. When the orange
          completions line is well below the blue starts line, that means a wave of
          new supply is coming. When they converge, the pipeline is draining and
          future supply is thinning out.
        </p>
      </Prose>

      <Card>
        <CardHeader title="Edmonton — Starts vs Completions" freshness="daily" />
        <ChartCard
          chartId="learn-housing-pipeline"
          title="Edmonton Starts vs Completions"
          timeRange={timeRange}
          source="StatsCan / CMHC"
        >
          <MultiSeriesLineChart
            data={merged}
            series={[
              { key: "starts", label: "Housing Starts", color: "#3b82f6", suffix: " units" },
              { key: "completions", label: "Completions", color: "#f97316", suffix: " units" },
            ]}
            height={250}
          />
        </ChartCard>
      </Card>

      <Insight variant="watch">
        The gap between the starts line and the completions line is your crystal
        ball. When starts are running well above completions, that means a flood of
        new supply is in the pipeline and will arrive in 12-18 months. When starts
        collapse, expect tighter supply — and upward pressure on rents — roughly
        18 months later.
      </Insight>
    </div>
  );
}

// ============================================================
// Page
// ============================================================

export default function ConstructionLessonPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
      <LessonSection title="Step 4 — Developers Read the Tea Leaves">
        <Suspense fallback={<LoadingCard />}>
          <DeveloperSection />
        </Suspense>
      </LessonSection>

      <LessonSection title="Step 5 — The Pipeline: Starts to Completions">
        <Suspense fallback={<LoadingCard />}>
          <PipelineSection />
        </Suspense>
      </LessonSection>

      <LessonCompleteButton moduleSlug="housing-machine" lessonSlug="construction" />
    </main>
  );
}
