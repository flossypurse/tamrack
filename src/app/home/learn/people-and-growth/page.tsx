export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader } from "@/components/card";
import { PageHeader } from "@/components/page-header";
import { TimeSeriesAreaChart, MultiSeriesLineChart, type MultiSeriesPoint } from "@/components/chart";
import { ChartCard } from "@/components/chart-card";
import { computeTimeRange } from "@/lib/time-range";
import {
  fetchStatCanTimeSeries,
  STATSCAN_SERIES,
  type TimeSeriesPoint,
} from "@/lib/data-sources";
import { fetchHousingStarts } from "@/lib/data-sources-cmhc";
import {
  Prose,
  BigQuestion,
  ChainStep,
  LiveDataPoint,
  DataGrid,
  Insight,
  Expandable,
  LessonSection,
  LessonNav,
  SoWhat,
} from "@/components/learn-lesson";
import { Users } from "lucide-react";

export const metadata: Metadata = {
  title: "People & Growth — Learn — Tamrack",
  description:
    "Immigration, migration, demographics, and whether Alberta's communities are building fast enough to keep up with one of Canada's fastest-growing populations.",
};

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Section 1 — Alberta's Population Engine                            */
/* ------------------------------------------------------------------ */

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
            label="Growth Since ${oldest.date.slice(0, 4)}"
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

/* ------------------------------------------------------------------ */
/*  Section 2 — The Three Sources of Growth                            */
/* ------------------------------------------------------------------ */

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

  // Natural increase = births - deaths
  const birthMap = new Map(birthsRaw.map((p) => [p.date, p.value]));
  const deathMap = new Map(deathsRaw.map((p) => [p.date, p.value]));

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
          Alberta's population does not grow by magic. There are exactly three
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

/* ------------------------------------------------------------------ */
/*  Section 3 — The Interprovincial Seesaw                             */
/* ------------------------------------------------------------------ */

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
          Alberta's economy more clearly than almost any other single data
          series. When net interprovincial migration is positive, Alberta is
          pulling people in. When it goes negative, people are leaving.
        </p>
        <p>
          Watch for the pattern: oil booms in the mid-2000s and 2012-2014 pulled
          massive numbers. The 2015-2016 oil crash reversed the flow entirely.
          COVID disrupted everything. And then the post-2021 recovery —
          amplified by Alberta's relative affordability — brought the strongest
          influx in a decade.
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

/* ------------------------------------------------------------------ */
/*  Section 4 — Can We Build Fast Enough?                              */
/* ------------------------------------------------------------------ */

async function BuildingGapSection() {
  const [popData, startsData] = await Promise.all([
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_POPULATION.tableId,
      STATSCAN_SERIES.AB_POPULATION.coordinate,
      80
    ).catch(() => []),
    fetchHousingStarts(60).catch(() => []),
  ]);

  // Build combined: population growth YoY vs total housing starts (edm + cal)
  const startsMulti: MultiSeriesPoint[] = startsData.map((p) => ({
    date: p.date,
    edmonton: p.edmonton,
    calgary: p.calgary,
  }));
  const startsTimeRange = computeTimeRange(startsData);

  // Compute annual population change for context
  const annualChanges: { year: string; growth: number }[] = [];
  for (let i = 4; i < popData.length; i++) {
    const growth = popData[i].value - popData[i - 4].value;
    annualChanges.push({ year: popData[i].date.slice(0, 4), growth });
  }
  const latestAnnualGrowth = annualChanges.at(-1);

  const latestStarts = startsData.at(-1);
  const totalLatestStarts = latestStarts
    ? latestStarts.edmonton + latestStarts.calgary
    : null;

  return (
    <LessonSection title="Can We Build Fast Enough?">
      <Prose>
        <p>
          Here is the core tension: if Alberta adds 50,000+ people per year
          (many of them working-age adults who need their own place), but
          Edmonton and Calgary combined start only 20,000-30,000 housing units
          per year, there is a structural gap. Not every new person needs a
          brand-new unit — some double up, some rent existing stock. But over
          time, if starts do not keep pace with population, vacancy falls, rent
          rises, and affordability erodes.
        </p>
        <p>
          The chart below shows housing starts in both major cities. Compare
          the scale of construction to the population growth numbers above. The
          gap is real.
        </p>
      </Prose>

      <Card>
        <CardHeader
          title="Housing Starts — Edmonton vs Calgary"
          freshness="daily"
        />
        <ChartCard
          chartId="learn-people-housing-starts"
          title="Housing Starts — Edmonton vs Calgary"
          timeRange={startsTimeRange}
          source="CMHC"
        >
          <MultiSeriesLineChart
            data={startsMulti}
            series={[
              {
                key: "edmonton",
                label: "Edmonton",
                color: "#ec4899",
                suffix: " units",
              },
              {
                key: "calgary",
                label: "Calgary",
                color: "#3b82f6",
                suffix: " units",
              },
            ]}
            height={250}
          />
        </ChartCard>
      </Card>

      <DataGrid>
        {latestAnnualGrowth && (
          <LiveDataPoint
            label="Annual Population Growth"
            value={`+${latestAnnualGrowth.growth.toLocaleString()}`}
            direction="up"
            source="StatsCan"
          />
        )}
        {totalLatestStarts !== null && (
          <LiveDataPoint
            label="Edmonton + Calgary Starts (latest)"
            value={totalLatestStarts.toLocaleString()}
            source="CMHC"
          />
        )}
      </DataGrid>

      <Insight variant="warning">
        Alberta's housing supply has chronically underbuilt relative to
        population growth since 2019. This is why vacancy rates are low and
        rents are rising — even though Alberta has relatively high housing
        supply compared to Vancouver or Toronto. The problem is not that Alberta
        builds too little in absolute terms. It is that population growth has
        outpaced construction by a widening margin.
      </Insight>

      <Expandable title="What about smaller cities and rural Alberta?">
        <Prose>
          <p>
            Edmonton and Calgary capture the headline numbers, but growth is
            happening in the surrounding municipalities too — Airdrie, Spruce
            Grove, Leduc, Beaumont, Chestermere. Many of these communities are
            growing even faster in percentage terms than the big cities. They
            face the same supply challenge but with smaller planning departments
            and less construction industry capacity. A town that grows from
            20,000 to 30,000 in five years has to build 50% more infrastructure.
            That is an enormous strain on municipal resources.
          </p>
        </Prose>
      </Expandable>
    </LessonSection>
  );
}

/* ------------------------------------------------------------------ */
/*  Section 5 — What New Albertans Need                                */
/* ------------------------------------------------------------------ */

function NewAlbertansSection() {
  return (
    <LessonSection title="What New Albertans Need">
      <Prose>
        <p>
          Growth is not just a number on a chart. Every new Albertan is a person
          who needs concrete things from their community. Understanding what
          those needs are — and how quickly they show up — is essential for
          anyone who cares about municipal planning, real estate, or public
          services.
        </p>
      </Prose>

      <ChainStep
        number={1}
        title="Housing — rental is the first stop"
        description="Most newcomers rent before they buy. International immigrants almost universally start in rental housing. The vacancy rate is the first pressure point — when it drops below 3%, rents spike and newcomers are competing for limited stock."
      />

      <ChainStep
        number={2}
        title="Schools — K-9 enrollment surges lag by 1-3 years"
        description="Families arrive, settle in, and then register their children. School boards feel population growth with a delay, which means they are always playing catch-up. Some Alberta communities are already running portable classrooms because brick-and-mortar capacity has not kept pace."
      />

      <ChainStep
        number={3}
        title="Jobs — immigrants arrive with skills"
        description="IRCC occupation data shows that Alberta's immigrants are not random — they are nurses, engineers, IT workers, tradespeople. Express Entry selects for high-demand skills. But credential recognition is slow, and many newcomers work below their qualification level for their first 2-3 years."
      />

      <ChainStep
        number={4}
        title="Services — healthcare, transit, language"
        description="Walk-in clinics, ESL programs, transit routes, recreation centres. Every new resident increases demand on services that municipalities fund through property taxes. Growth that outpaces service capacity is how communities start to feel 'overwhelmed' even when the economy is strong."
      />

      <Insight variant="lever">
        Community lever: support housing density near transit and employment
        centres. Advocate for faster credential recognition at the provincial
        level. The faster new Albertans are productive in their trained
        profession, the faster they contribute to the tax base — and the sooner
        municipalities can fund the services everyone needs. Integration speed
        is an economic multiplier.
      </Insight>

      <Expandable title="How credential recognition bottlenecks work">
        <Prose>
          <p>
            A doctor trained in India cannot practise medicine in Alberta without
            passing Canadian exams, completing supervised practice, and
            navigating a regulatory process that can take 3-5 years. During that
            time, they might drive a taxi or work retail. The same pattern
            applies to engineers, nurses, accountants, and other regulated
            professions. Alberta has made some improvements — alternative
            pathways, bridging programs — but the bottleneck remains one of the
            biggest drags on immigrant economic integration. Every month of
            delay is lost productivity and lost tax revenue.
          </p>
        </Prose>
      </Expandable>
    </LessonSection>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function PeopleAndGrowthPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <PageHeader
        title="People & Growth"
        description="Immigration, migration, demographics — and whether Alberta's communities are building fast enough to keep up."
        category="learn"
        icon={<Users size={20} />}
      />

      {/* Opening question */}
      <BigQuestion>Is Alberta actually growing?</BigQuestion>

      <Prose>
        <p>
          The short answer is: yes, faster than almost anywhere in Canada. But
          WHERE those people are coming from, WHERE they are going within the
          province, and whether communities are building fast enough to absorb
          them — that is the story that matters.
        </p>
        <p>
          This lesson breaks down Alberta's demographic engine into its
          components, using live data. You will see how natural growth,
          international immigration, and interprovincial migration combine to
          create the fastest-growing population in the country — and what that
          means for housing, schools, healthcare, and your municipal tax bill.
        </p>
      </Prose>

      {/* Section 1: Population */}
      <Suspense fallback={<LoadingCard />}>
        <PopulationEngineSection />
      </Suspense>

      {/* Section 2: Three Sources */}
      <Suspense fallback={<LoadingCard />}>
        <ThreeSourcesSection />
      </Suspense>

      {/* Section 3: Interprovincial Seesaw */}
      <Suspense fallback={<LoadingCard />}>
        <InterprovincialSeesawSection />
      </Suspense>

      {/* Section 4: Building Gap */}
      <Suspense fallback={<LoadingCard />}>
        <BuildingGapSection />
      </Suspense>

      {/* Section 5: What New Albertans Need (no async data) */}
      <NewAlbertansSection />

      {/* Closing — So What */}
      <SoWhat>
        <p>
          Population growth is the most fundamental force in real estate,
          municipal budgets, and service demand. Alberta is growing fast — adding
          tens of thousands of people every year through immigration,
          interprovincial migration, and natural increase combined.
        </p>
        <p className="mt-2">
          The question is not WHETHER to grow — that is driven by federal
          immigration policy, global economics, and Alberta's relative
          affordability advantage. The question is whether communities are
          building the infrastructure to support growth. The data shows a
          widening gap between population growth and housing construction, and
          that gap is why vacancy is tight, rents are rising, and school
          portables are multiplying across the province.
        </p>
        <p className="mt-2">
          Watch the signals: interprovincial migration tells you the cycle.
          Housing starts tell you the supply response. The gap between them
          tells you where pressure will build next.
        </p>
      </SoWhat>

      {/* Navigation */}
      <LessonNav
        prev={{ href: "/home/learn/your-tax-dollars", label: "Your Tax Dollars" }}
        next={{
          href: "/home/learn/safety-and-prosperity",
          label: "Safety & Prosperity",
        }}
      />
    </div>
  );
}
