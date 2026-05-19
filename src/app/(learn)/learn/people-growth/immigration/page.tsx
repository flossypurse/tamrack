import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader } from "@/components/card";
import { ChartCard } from "@/components/chart-card";
import { TimeSeriesAreaChart, MultiSeriesLineChart, type MultiSeriesPoint } from "@/components/chart";
import { computeTimeRange } from "@/lib/time-range";
import {
  fetchStatCanTimeSeries,
  STATSCAN_SERIES,
  type TimeSeriesPoint,
} from "@/lib/data-sources";
import {
  Prose,
  BigQuestion,
  ChainStep,
  LiveDataPoint,
  DataGrid,
  Insight,
  Expandable,
  LessonSection,
  SoWhat,
} from "@/components/learn-lesson";
import { LessonCompleteButton } from "@/components/learn-lesson-complete";

// ============================================================
// Metadata
// ============================================================

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Immigration Drivers — People & Growth — Pulse Learn",
  description:
    "International immigration, interprovincial migration, and natural increase — the three engines driving Alberta's population growth, traced with live data.",
};

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
// Section 1: Alberta's Population Engine
// ============================================================

async function PopulationEngineSection() {
  const data = await fetchStatCanTimeSeries(
    STATSCAN_SERIES.AB_POPULATION.tableId,
    STATSCAN_SERIES.AB_POPULATION.coordinate,
    240
  ).catch(() => []);

  const latest = data.at(-1);
  const oldest = data.at(0);
  const timeRange = computeTimeRange(data);

  const prevYear = data.length > 4 ? data[data.length - 5] : null;
  const yoyGrowth =
    latest && prevYear && prevYear.value > 0
      ? ((latest.value - prevYear.value) / prevYear.value) * 100
      : null;

  return (
    <LessonSection title="Alberta's Population Engine">
      <Prose>
        <p>
          Alberta is not just growing — it is growing faster than almost every
          other province in Canada. In roughly 20 years, the population has
          climbed from about 3 million to nearly 4.8 million. That is not
          gradual drift. That is a province being reshaped in real time.
        </p>
        <p>
          The chart below shows the trajectory. Notice how the line steepens
          after 2021 — that is when post-pandemic migration accelerated and
          federal immigration targets ramped up. Alberta was absorbing people at
          a pace not seen since the oil boom years of 2006-2008.
        </p>
      </Prose>

      <Card>
        <CardHeader title="Alberta Population — Long-Term Trend" freshness="daily" />
        <ChartCard
          chartId="learn-people-ab-population"
          title="Alberta Population"
          timeRange={timeRange}
          source="StatsCan 17-10-0005"
        >
          <TimeSeriesAreaChart data={data} color="#ec4899" height={240} />
        </ChartCard>
      </Card>

      <DataGrid>
        {latest && (
          <LiveDataPoint
            label="Current Population"
            value={`${(latest.value / 1000).toFixed(1)}K`}
            direction={yoyGrowth && yoyGrowth > 0 ? "up" : "flat"}
            change={yoyGrowth ? `+${yoyGrowth.toFixed(1)}% YoY` : undefined}
            source="StatsCan"
          />
        )}
        {oldest && latest && (
          <LiveDataPoint
            label={`Growth Since ${oldest.date.slice(0, 4)}`}
            value={`+${((latest.value - oldest.value) / 1000).toFixed(0)}K`}
            source="StatsCan"
          />
        )}
      </DataGrid>

      <Insight>
        Every new person needs housing, healthcare, school seats, and road
        capacity. Population growth IS demand growth. When you see this line
        steepen, every municipal budget in Alberta is under pressure — and every
        housing market is getting tighter.
      </Insight>
    </LessonSection>
  );
}

// ============================================================
// Section 2: The Three Sources of Growth
// ============================================================

async function ThreeSourcesSection() {
  const [birthsRaw, deathsRaw, immigrationRaw, interprovRaw] =
    await Promise.all([
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_BIRTHS.tableId,
        STATSCAN_SERIES.AB_BIRTHS.coordinate,
        80
      ).catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_DEATHS.tableId,
        STATSCAN_SERIES.AB_DEATHS.coordinate,
        80
      ).catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_IMMIGRATION.tableId,
        STATSCAN_SERIES.AB_IMMIGRATION.coordinate,
        80
      ).catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_NET_INTERPROVINCIAL.tableId,
        STATSCAN_SERIES.AB_NET_INTERPROVINCIAL.coordinate,
        80
      ).catch(() => []),
    ]);

  const latestBirths = birthsRaw.at(-1);
  const latestDeaths = deathsRaw.at(-1);
  const latestImmigration = immigrationRaw.at(-1);
  const latestInterprov = interprovRaw.at(-1);
  const naturalIncrease =
    latestBirths && latestDeaths
      ? latestBirths.value - latestDeaths.value
      : null;

  // Build multi-series: immigration + interprovincial migration
  const dateMap = new Map<string, MultiSeriesPoint>();
  for (const p of immigrationRaw) {
    dateMap.set(p.date, {
      date: p.date,
      immigration: p.value,
      interprovincial: 0,
    });
  }
  for (const p of interprovRaw) {
    const existing = dateMap.get(p.date);
    if (existing) {
      existing.interprovincial = p.value;
    } else {
      dateMap.set(p.date, {
        date: p.date,
        immigration: 0,
        interprovincial: p.value,
      });
    }
  }
  const merged = Array.from(dateMap.values()).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const timeRange = computeTimeRange(merged);

  return (
    <LessonSection title="The Three Sources of Growth">
      <Prose>
        <p>
          Alberta&apos;s population does not grow by magic. There are exactly three
          sources, and each has a different character:
        </p>
      </Prose>

      <ChainStep
        number={1}
        title="Natural increase (births minus deaths)"
        description="Alberta has a young population, so births consistently exceed deaths by about 20,000-30,000 per year. This is the slow, steady baseline — it does not swing with the economy."
      />

      <ChainStep
        number={2}
        title="International immigration"
        description="Around 50,000-80,000 newcomers arrive in Alberta each year from outside Canada. This flow has been accelerating since 2015 and is largely driven by federal policy — IRCC targets, Express Entry, study permits, and temporary workers."
      />

      <ChainStep
        number={3}
        title="Interprovincial migration"
        description="The wild card. Canadians moving between provinces follow the jobs. In oil booms, Alberta pulls tens of thousands from Ontario, BC, and the Maritimes. In busts, they leave. This is the most volatile component."
      />

      <Card>
        <CardHeader
          title="Immigration vs Interprovincial Migration"
          freshness="daily"
        />
        <ChartCard
          chartId="learn-people-migration-sources"
          title="Immigration vs Interprovincial Migration"
          timeRange={timeRange}
          source="StatsCan 17-10-0008"
        >
          <MultiSeriesLineChart
            data={merged}
            series={[
              {
                key: "immigration",
                label: "International Immigration",
                color: "#ec4899",
                suffix: "",
              },
              {
                key: "interprovincial",
                label: "Net Interprovincial",
                color: "#3b82f6",
                suffix: "",
              },
            ]}
            height={260}
          />
        </ChartCard>
      </Card>

      <DataGrid>
        {naturalIncrease !== null && (
          <LiveDataPoint
            label="Natural Increase (latest)"
            value={naturalIncrease.toLocaleString()}
            direction={naturalIncrease > 0 ? "up" : "down"}
            source="StatsCan"
          />
        )}
        {latestImmigration && (
          <LiveDataPoint
            label="Immigration (latest)"
            value={latestImmigration.value.toLocaleString()}
            direction="up"
            source="StatsCan"
          />
        )}
        {latestInterprov && (
          <LiveDataPoint
            label="Interprovincial (latest)"
            value={latestInterprov.value.toLocaleString()}
            direction={
              latestInterprov.value > 0
                ? "up"
                : latestInterprov.value < 0
                ? "down"
                : "flat"
            }
            source="StatsCan"
          />
        )}
      </DataGrid>

      <Insight>
        International immigration is relatively steady and policy-driven — it
        does not crash during recessions. Interprovincial migration is the wild
        card. It follows the boom-bust cycle. When you see the blue line surge,
        Alberta is in a growth phase. When it goes negative, the province is
        bleeding workers back to other provinces.
      </Insight>
    </LessonSection>
  );
}

// ============================================================
// Section 3: The Interprovincial Seesaw
// ============================================================

async function InterprovincialSeesawSection() {
  const interprovData = await fetchStatCanTimeSeries(
    STATSCAN_SERIES.AB_NET_INTERPROVINCIAL.tableId,
    STATSCAN_SERIES.AB_NET_INTERPROVINCIAL.coordinate,
    120
  ).catch(() => []);

  const timeRange = computeTimeRange(interprovData);

  return (
    <LessonSection title="The Interprovincial Seesaw">
      <Prose>
        <p>
          This chart deserves its own section because it tells the story of
          Alberta&apos;s economy more clearly than almost any other single data
          series. When net interprovincial migration is positive, Alberta is
          pulling people in. When it goes negative, people are leaving.
        </p>
        <p>
          Watch for the pattern: oil booms in the mid-2000s and 2012-2014 pulled
          massive numbers. The 2015-2016 oil crash reversed the flow entirely.
          COVID disrupted everything. And then the post-2021 recovery —
          amplified by Alberta&apos;s relative affordability — brought the
          strongest influx in a decade.
        </p>
      </Prose>

      <Card>
        <CardHeader
          title="Net Interprovincial Migration — Alberta"
          freshness="daily"
        />
        <ChartCard
          chartId="learn-people-interprov-seesaw"
          title="Net Interprovincial Migration"
          timeRange={timeRange}
          source="StatsCan 17-10-0008"
        >
          <TimeSeriesAreaChart
            data={interprovData}
            color="#3b82f6"
            height={240}
          />
        </ChartCard>
      </Card>

      <ChainStep
        number={1}
        title="The boom cycle"
        description="Oil prices rise, energy companies hire, Alberta wages climb above other provinces. Workers in Ontario, BC, and the Maritimes hear about $100K rig jobs and move west. Housing demand spikes. Rents climb. Services get strained."
      />

      <ChainStep
        number={2}
        title="The bust cycle"
        description="Oil crashes, layoffs hit, the wage premium vanishes. Workers who moved west head back home — or on to BC. Housing vacancies rise, rents drop, and restaurants close. The seesaw tips the other way."
      />

      <Insight variant="watch">
        When interprovincial migration turns positive after a bust, it is a
        leading indicator of recovery. It means workers across Canada see
        opportunity in Alberta again. They are voting with their feet — and that
        signal appears months before GDP data confirms the turnaround. Watch the
        chart: the moment the line crosses from negative to positive, the
        recovery is underway.
      </Insight>

      <Expandable title="Why does interprovincial migration matter more than immigration for housing?">
        <Prose>
          <p>
            International immigrants typically arrive with settlement services,
            temporary housing arrangements, and a slower ramp into the housing
            market. Interprovincial migrants are different — they are Canadians
            who already know the system. They arrive with jobs lined up, credit
            scores established, and the ability to sign leases or buy houses
            immediately. When 30,000 interprovincial migrants arrive in a single
            year, that is 30,000 people who need housing NOW, not in 6 months.
            The demand shock is sharper and more immediate.
          </p>
        </Prose>
      </Expandable>
    </LessonSection>
  );
}

// ============================================================
// Page Component
// ============================================================

export default function ImmigrationPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
      <BigQuestion>Where are all these new Albertans coming from?</BigQuestion>

      <Prose>
        <p>
          The short answer is: everywhere. International immigrants from India,
          the Philippines, Nigeria, and China. Interprovincial migrants from
          Ontario, BC, and the Maritimes chasing jobs and affordability. And a
          steady stream of babies — Alberta has one of the youngest populations
          in Canada.
        </p>
        <p>
          This lesson breaks down Alberta&apos;s three population engines using
          live StatsCan data. You will see how each source operates on different
          timelines, responds to different signals, and creates different kinds
          of demand on housing, services, and municipal budgets.
        </p>
      </Prose>

      <Suspense fallback={<LoadingCard />}>
        <PopulationEngineSection />
      </Suspense>

      <Suspense fallback={<LoadingCard />}>
        <ThreeSourcesSection />
      </Suspense>

      <Suspense fallback={<LoadingCard />}>
        <InterprovincialSeesawSection />
      </Suspense>

      <SoWhat>
        Alberta&apos;s population growth comes from three distinct channels.
        Natural increase is steady and predictable. International immigration is
        policy-driven and accelerating. Interprovincial migration is the wild
        card — it follows the energy cycle and creates the sharpest demand
        shocks. Understanding which channel is driving growth at any given moment
        tells you what kind of pressure to expect on housing, schools, and
        services.
      </SoWhat>

      <LessonCompleteButton moduleSlug="people-growth" lessonSlug="immigration" />

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Tamrack &mdash; Immigration Drivers &mdash; All data from
        free public APIs
      </footer>
    </main>
  );
}
