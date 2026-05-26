import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader } from "@/components/card";
import { ChartCard } from "@/components/chart-card";
import { MultiSeriesLineChart, type MultiSeriesPoint } from "@/components/chart";
import { computeTimeRange } from "@/lib/time-range";
import {
  fetchStatCanTimeSeries,
  STATSCAN_SERIES,
  type TimeSeriesPoint,
} from "@/lib/data-sources";
import { fetchHousingStarts } from "@/lib/data-sources-cmhc";
import {
  fetchRegionalIndicatorForMunicipality,
  REGIONAL_INDICATORS,
  type RegionalDataPoint,
} from "@/lib/data-sources-regional";
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
  title: "Demographics & Housing — People & Growth",
  description:
    "How population growth drives housing demand, what new Albertans need, and whether communities are building fast enough to keep up.",
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
// Helpers
// ============================================================

const MUNICIPALITIES = [
  "Edmonton",
  "Calgary",
  "Spruce Grove",
  "Airdrie",
  "Leduc",
  "Beaumont",
];

function latestRegional(data: RegionalDataPoint[]): number {
  if (data.length === 0) return 0;
  const sorted = [...data].sort((a, b) => a.period.localeCompare(b.period));
  return sorted.at(-1)?.value ?? 0;
}

function latestPeriod(data: RegionalDataPoint[]): string {
  if (data.length === 0) return "";
  const sorted = [...data].sort((a, b) => a.period.localeCompare(b.period));
  return sorted.at(-1)?.period ?? "";
}

function fmt(n: number, opts?: { prefix?: string; suffix?: string; decimals?: number }): string {
  const { prefix = "", suffix = "", decimals } = opts ?? {};
  const formatted =
    decimals !== undefined
      ? n.toLocaleString("en-CA", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      : n.toLocaleString("en-CA");
  return `${prefix}${formatted}${suffix}`;
}

async function fetchForAll(
  indicator: string
): Promise<Map<string, RegionalDataPoint[]>> {
  const results = new Map<string, RegionalDataPoint[]>();
  const fetches = MUNICIPALITIES.map(async (muni) => {
    const data = await fetchRegionalIndicatorForMunicipality(indicator, muni).catch(() => []);
    results.set(muni, data);
  });
  await Promise.all(fetches);
  return results;
}

// ============================================================
// Section 1: Can We Build Fast Enough?
// ============================================================

async function BuildingGapSection() {
  const [popData, startsData] = await Promise.all([
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_POPULATION.tableId,
      STATSCAN_SERIES.AB_POPULATION.coordinate,
      80
    ).catch(() => []),
    fetchHousingStarts(60).catch(() => []),
  ]);

  const startsMulti: MultiSeriesPoint[] = startsData.map((p) => ({
    date: p.date,
    edmonton: p.edmonton,
    calgary: p.calgary,
  }));
  const startsTimeRange = computeTimeRange(startsData);

  // Compute annual population change
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
          the scale of construction to the population growth numbers from the
          previous lesson. The gap is real.
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
        Alberta&apos;s housing supply has chronically underbuilt relative to
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

// ============================================================
// Section 2: Growth in the Satellites
// ============================================================

async function SatelliteGrowthSection() {
  const populationMap = await fetchForAll(REGIONAL_INDICATORS["Population"]);
  const enrollmentMap = await fetchForAll(REGIONAL_INDICATORS["K - 9 Enrollments"]);

  return (
    <LessonSection title="Growth in the Satellite Communities">
      <Prose>
        <p>
          Alberta&apos;s fastest-growing communities are not Edmonton and
          Calgary themselves — they are the satellite municipalities surrounding
          them. Young families priced out of the core cities move to Spruce
          Grove, Airdrie, Leduc, and Beaumont where housing is more affordable.
          These communities then face enormous pressure to build schools, expand
          water treatment, widen roads, and hire emergency services — all funded
          primarily through property tax.
        </p>
      </Prose>

      <DataGrid>
        {MUNICIPALITIES.map((muni) => {
          const data = populationMap.get(muni) ?? [];
          const val = latestRegional(data);
          const period = latestPeriod(data);
          return (
            <LiveDataPoint
              key={muni}
              label={`${muni} Population${period ? ` (${period})` : ""}`}
              value={val > 0 ? fmt(val) : "N/A"}
              source="AB Regional Dashboard"
            />
          );
        })}
      </DataGrid>

      <Prose>
        <p>
          School enrollment is one of the most tangible indicators of family
          growth. When K-9 enrollment surges, it means families have arrived —
          and they need not just schools, but parks, recreation, and family
          services.
        </p>
      </Prose>

      <DataGrid>
        {MUNICIPALITIES.map((muni) => {
          const data = enrollmentMap.get(muni) ?? [];
          const val = latestRegional(data);
          const period = latestPeriod(data);
          return val > 0 ? (
            <LiveDataPoint
              key={muni}
              label={`${muni} K-9 Enrollment${period ? ` (${period})` : ""}`}
              value={fmt(val)}
              source="AB Regional Dashboard"
            />
          ) : null;
        })}
      </DataGrid>

      <Insight variant="watch">
        K-9 enrollment is a lagging indicator of family migration. It shows up
        1-3 years after families arrive, because settling in takes time. If you
        see enrollment surging in a satellite community, the population growth
        happened years ago — and the community is now playing catch-up on
        infrastructure.
      </Insight>
    </LessonSection>
  );
}

// ============================================================
// Section 3: What New Albertans Need
// ============================================================

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

// ============================================================
// Page Component
// ============================================================

export default function DemographicsPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
      <BigQuestion>Is Alberta building fast enough for all these new people?</BigQuestion>

      <Prose>
        <p>
          Population growth creates demand. Housing starts create supply. When
          demand outpaces supply, rents rise, vacancy drops, and communities
          strain. This lesson examines the gap between Alberta&apos;s population
          growth and its construction response — and what new Albertans actually
          need when they arrive.
        </p>
      </Prose>

      <Suspense fallback={<LoadingCard />}>
        <BuildingGapSection />
      </Suspense>

      <Suspense fallback={<LoadingCard />}>
        <SatelliteGrowthSection />
      </Suspense>

      <NewAlbertansSection />

      <SoWhat>
        <p>
          Population growth is the most fundamental force in real estate,
          municipal budgets, and service demand. Alberta is growing fast — adding
          tens of thousands of people every year through immigration,
          interprovincial migration, and natural increase combined.
        </p>
        <p className="mt-2">
          The question is not WHETHER to grow — that is driven by federal
          immigration policy, global economics, and Alberta&apos;s relative
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

      <LessonCompleteButton moduleSlug="people-growth" lessonSlug="demographics" />

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Tamrack &mdash; Demographics &amp; Housing &mdash; All data
        from free public APIs
      </footer>
    </main>
  );
}
