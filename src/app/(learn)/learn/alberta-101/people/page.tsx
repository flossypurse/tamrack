import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader } from "@/components/card";
import { TimeSeriesAreaChart } from "@/components/chart";
import { ChartCard } from "@/components/chart-card";
import { computeTimeRange } from "@/lib/time-range";
import {
  fetchStatCanTimeSeries,
  STATSCAN_SERIES,
  type TimeSeriesPoint,
} from "@/lib/data-sources";
import {
  Prose,
  BigQuestion,
  LessonSection,
  Insight,
  Expandable,
  LiveDataPoint,
  DataGrid,
  SoWhat,
  LessonNav,
} from "@/components/learn-lesson";
import { LessonCompleteButton } from "@/components/learn-lesson-complete";

export const metadata: Metadata = {
  title: "The People — Alberta 101 — Pulse Learn",
  description:
    "Who lives in Alberta? Population growth, immigration, interprovincial migration, and urbanization trends with live StatsCan data.",
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
// Helper: compute direction from recent data
// ============================================================

function computeDirection(
  data: TimeSeriesPoint[],
  periods = 4
): { direction: "up" | "down" | "flat"; latest: number; change: string } {
  if (data.length < periods * 2)
    return { direction: "flat", latest: data.at(-1)?.value ?? 0, change: "" };
  const recent =
    data.slice(-periods).reduce((s, p) => s + p.value, 0) / periods;
  const prior =
    data.slice(-periods * 2, -periods).reduce((s, p) => s + p.value, 0) /
    periods;
  if (prior === 0)
    return { direction: "flat", latest: data.at(-1)?.value ?? 0, change: "" };
  const pct = ((recent - prior) / Math.abs(prior)) * 100;
  return {
    direction: pct > 1 ? "up" : pct < -1 ? "down" : "flat",
    latest: data.at(-1)?.value ?? 0,
    change: `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`,
  };
}

// ============================================================
// Population Section (async server component)
// ============================================================

async function PopulationSection() {
  const population = await fetchStatCanTimeSeries(
    STATSCAN_SERIES.AB_POPULATION.tableId,
    STATSCAN_SERIES.AB_POPULATION.coordinate,
    80
  ).catch(() => []);

  const timeRange = computeTimeRange(population);
  const popTrend = computeDirection(population);

  // Format latest population
  const latestPop = population.at(-1)?.value ?? 0;
  const popFormatted =
    latestPop >= 1_000_000
      ? `${(latestPop / 1_000_000).toFixed(2)}M`
      : latestPop.toLocaleString();

  return (
    <div className="space-y-4">
      <Prose>
        <p>
          Alberta is one of Canada&apos;s fastest-growing provinces. The
          population has been climbing steadily for decades, driven by a
          combination of international immigration, interprovincial migration
          (people moving from other provinces), and natural increase (more
          births than deaths).
        </p>
        <p>
          The chart below shows quarterly population estimates from Statistics
          Canada. Notice the consistent upward trend — but also notice how the
          slope steepens and flattens. Those changes in slope correspond
          directly to economic cycles. When Alberta is booming, people pour
          in. When oil crashes, the growth slows or even reverses for
          interprovincial flows.
        </p>
      </Prose>

      <Card>
        <CardHeader
          title="Alberta Population"
          subtitle="Quarterly estimates, all persons"
          badge="LIVE"
          freshness="daily"
        />
        <ChartCard
          chartId="learn-alberta-101-population"
          title="Alberta Population"
          timeRange={timeRange}
          source="StatsCan 17-10-0005"
        >
          <TimeSeriesAreaChart
            data={population}
            color="#f59e0b"
            height={260}
            compact
          />
        </ChartCard>
      </Card>

      <DataGrid>
        <LiveDataPoint
          label="Current Population"
          value={popFormatted}
          change={popTrend.change}
          direction={popTrend.direction}
          source="StatsCan"
        />
      </DataGrid>

      <Prose>
        <p>
          As of the latest data, Alberta&apos;s population sits around{" "}
          <strong>4.8 million people</strong>. That makes it Canada&apos;s
          fourth-most-populous province, behind Ontario, Quebec, and British
          Columbia. But Alberta punches well above its weight economically —
          it contributes roughly 15-17% of national GDP with only about 12%
          of the national population.
        </p>
      </Prose>
    </div>
  );
}

// ============================================================
// Migration Section (async server component)
// ============================================================

async function MigrationSection() {
  const [immigration, netInterprovincial] = await Promise.all([
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_IMMIGRATION.tableId,
      STATSCAN_SERIES.AB_IMMIGRATION.coordinate,
      60
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_NET_INTERPROVINCIAL.tableId,
      STATSCAN_SERIES.AB_NET_INTERPROVINCIAL.coordinate,
      60
    ).catch(() => []),
  ]);

  const immigrationTimeRange = computeTimeRange(immigration);
  const interprovincialTimeRange = computeTimeRange(netInterprovincial);

  const immigrationTrend = computeDirection(immigration);
  const interprovincialTrend = computeDirection(netInterprovincial);

  const latestImmigration = immigration.at(-1)?.value ?? 0;
  const latestInterprovincial = netInterprovincial.at(-1)?.value ?? 0;

  return (
    <div className="space-y-4">
      <Prose>
        <p>
          Population growth in Alberta comes from two main channels:
          international immigration and interprovincial migration. They behave
          very differently.
        </p>
        <p>
          <strong>International immigration</strong> is relatively steady. It
          is driven by federal policy (immigration targets), not by
          Alberta&apos;s economy directly. People come from abroad for
          permanent residency, and the numbers have been rising as Canada
          increases its overall immigration targets.
        </p>
      </Prose>

      <Card>
        <CardHeader
          title="International Immigration to Alberta"
          subtitle="Quarterly immigrant arrivals"
          badge="LIVE"
          freshness="daily"
        />
        <ChartCard
          chartId="learn-alberta-101-immigration"
          title="Immigration to Alberta"
          timeRange={immigrationTimeRange}
          source="StatsCan 17-10-0008"
        >
          <TimeSeriesAreaChart
            data={immigration}
            color="#10b981"
            height={220}
            compact
          />
        </ChartCard>
      </Card>

      <DataGrid>
        <LiveDataPoint
          label="Immigration (latest Q)"
          value={latestImmigration.toLocaleString()}
          change={immigrationTrend.change}
          direction={immigrationTrend.direction}
          source="StatsCan"
        />
      </DataGrid>

      <Prose>
        <p>
          <strong>Interprovincial migration</strong> is the volatile one. This
          is Canadians moving between provinces, and it responds directly to
          economic conditions. When Alberta is booming — oil prices high, jobs
          plentiful — people flood in from Ontario, B.C., and Atlantic Canada.
          When oil crashes, the flow reverses. Net interprovincial migration
          actually went <em>negative</em> during the 2015-2016 oil price
          collapse, meaning more people left Alberta than arrived from other
          provinces.
        </p>
      </Prose>

      <Card>
        <CardHeader
          title="Net Interprovincial Migration"
          subtitle="Quarterly — positive means net inflow to Alberta"
          badge="LIVE"
          freshness="daily"
        />
        <ChartCard
          chartId="learn-alberta-101-interprovincial"
          title="Net Interprovincial Migration"
          timeRange={interprovincialTimeRange}
          source="StatsCan 17-10-0008"
        >
          <TimeSeriesAreaChart
            data={netInterprovincial}
            color="#3b82f6"
            height={220}
            compact
          />
        </ChartCard>
      </Card>

      <DataGrid>
        <LiveDataPoint
          label="Net Interprovincial (latest Q)"
          value={latestInterprovincial.toLocaleString()}
          change={interprovincialTrend.change}
          direction={interprovincialTrend.direction}
          source="StatsCan"
        />
      </DataGrid>

      <Insight>
        Population growth is the single strongest driver of housing demand.
        More people means more renters, more buyers, more construction needed.
        When you see net interprovincial migration surging, expect rental
        vacancy rates to tighten 6-12 months later. When it goes negative,
        expect vacancy to rise and rents to soften. This is the most reliable
        leading indicator for Alberta&apos;s housing market.
      </Insight>
    </div>
  );
}

// ============================================================
// Page
// ============================================================

export default function PeopleLessonPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
      <BigQuestion>Who lives in Alberta?</BigQuestion>

      <Prose>
        <p>
          Alberta&apos;s economy is a people story. Every oil boom, every bust,
          every housing crunch — they all start with people arriving or leaving.
          Understanding <em>who</em> lives here, <em>where</em> they come from,
          and <em>how fast</em> the population is changing gives you the
          foundation for reading every other economic indicator.
        </p>
      </Prose>

      {/* --------------------------------------------------------------- */}
      <LessonSection title="Population Growth">
        <Suspense fallback={<LoadingCard />}>
          <PopulationSection />
        </Suspense>
      </LessonSection>

      {/* --------------------------------------------------------------- */}
      <LessonSection title="Where the Growth Comes From">
        <Suspense fallback={<LoadingCard />}>
          <MigrationSection />
        </Suspense>
      </LessonSection>

      {/* --------------------------------------------------------------- */}
      <LessonSection title="Urban vs. Rural">
        <Prose>
          <p>
            More than <strong>82%</strong> of Albertans live in urban areas.
            The Edmonton and Calgary metropolitan areas alone account for
            roughly two-thirds of the province&apos;s population. This
            concentration has been increasing for decades as young people
            leave smaller communities for city jobs.
          </p>
          <p>
            The urbanization trend has major economic implications. Urban
            areas generate most of the tax base. Rural areas provide the
            resource extraction and agriculture that fund the province. This
            creates a persistent political and economic tension between
            the cities (which want transit, density, and social services) and
            rural Alberta (which wants infrastructure, resource development,
            and agricultural support).
          </p>
        </Prose>

        <Expandable title="The 'third Alberta' — small cities">
          <Prose>
            <p>
              Between the two major metros and rural Alberta, there is a third
              category that often gets overlooked: mid-sized cities like Red
              Deer (~110,000), Lethbridge (~105,000), Medicine Hat (~65,000),
              and Grande Prairie (~70,000). These communities have their own
              distinct economic profiles. Red Deer is a logistics and
              services hub for central Alberta. Lethbridge anchors southern
              agriculture. Grande Prairie serves the Peace Region&apos;s
              oil and gas sector.
            </p>
            <p>
              These mid-sized cities often have the most interesting data
              stories because they are small enough that a single factory
              opening or pipeline decision can visibly move the numbers.
            </p>
          </Prose>
        </Expandable>
      </LessonSection>

      {/* --------------------------------------------------------------- */}
      <LessonSection title="Key Takeaways">
        <SoWhat>
          <p>
            Alberta&apos;s population is growing fast, driven by both
            international immigration (steady, policy-driven) and
            interprovincial migration (volatile, economy-driven). Over 82%
            of the population is urban, concentrated in Edmonton and Calgary.
            Population flows are the most reliable leading indicator for
            housing demand, rental markets, and municipal revenue.
          </p>
          <p>
            When you see population data on this dashboard, remember: every
            new arrival needs a place to live, a job, and services. Every
            departure leaves a vacancy. The population chart is not just a
            number — it is the pulse of Alberta&apos;s economy.
          </p>
        </SoWhat>
      </LessonSection>

      <LessonNav
        prev={{ href: "/learn/alberta-101/geography", label: "The Land" }}
        next={{ href: "/learn/alberta-101/regions", label: "The Regions" }}
      />

      <LessonCompleteButton moduleSlug="alberta-101" lessonSlug="people" />
    </main>
  );
}
