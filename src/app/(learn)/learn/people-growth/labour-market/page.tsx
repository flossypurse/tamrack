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
  title: "The Labour Market — People & Growth — Pulse Learn",
  description:
    "Employment, unemployment, participation rates, and wage dynamics — how Alberta's labour market reflects the boom-bust cycle, traced with live data.",
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
  "Lethbridge",
  "Red Deer",
  "St. Albert",
  "Spruce Grove",
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
// Section 1: Employment and Unemployment
// ============================================================

async function EmploymentSection() {
  const [unemploymentData, employmentData] = await Promise.all([
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.tableId,
      STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.coordinate,
      120
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_EMPLOYMENT.tableId,
      STATSCAN_SERIES.AB_EMPLOYMENT.coordinate,
      120
    ).catch(() => []),
  ]);

  const unemploymentTimeRange = computeTimeRange(unemploymentData);
  const latestUnemp = unemploymentData.at(-1);
  const latestEmp = employmentData.at(-1);

  return (
    <LessonSection title="Employment and Unemployment — The Headline Numbers">
      <Prose>
        <p>
          Alberta&apos;s unemployment rate is one of the most watched economic
          indicators in the province. But it is also one of the most
          misunderstood. The unemployment rate does not measure how many people
          are not working — it measures how many people are actively looking for
          work and cannot find it.
        </p>
        <p>
          This distinction matters enormously. During a severe downturn, some
          workers stop looking for jobs entirely. They are not counted as
          &ldquo;unemployed&rdquo; — they drop out of the labour force
          altogether. This is called the &ldquo;discouraged worker&rdquo; effect,
          and it means the unemployment rate can actually understate the true
          severity of a downturn.
        </p>
      </Prose>

      {unemploymentData.length > 0 && (
        <Card>
          <CardHeader title="Alberta Unemployment Rate" freshness="daily" />
          <ChartCard
            chartId="learn-people-unemployment"
            title="Alberta Unemployment Rate"
            timeRange={unemploymentTimeRange}
            source="StatsCan 14-10-0287"
          >
            <TimeSeriesAreaChart data={unemploymentData} color="#ef4444" height={240} />
          </ChartCard>
        </Card>
      )}

      <DataGrid>
        {latestUnemp && (
          <LiveDataPoint
            label="Unemployment Rate"
            value={`${latestUnemp.value.toFixed(1)}%`}
            source="StatsCan"
          />
        )}
        {latestEmp && (
          <LiveDataPoint
            label="Total Employment"
            value={`${(latestEmp.value / 1000).toFixed(0)}K`}
            source="StatsCan"
          />
        )}
      </DataGrid>

      <Prose>
        <p>
          Look at the chart above and find the spikes. Every spike in
          unemployment corresponds to an energy downturn. The 2009 recession
          (global financial crisis), the 2015-2016 oil crash, and the 2020 COVID
          shock all left clear marks. But notice how quickly Alberta recovers
          compared to other provinces — the young, mobile workforce and
          resource-sector demand pull unemployment back down rapidly when
          conditions improve.
        </p>
      </Prose>

      <Insight variant="insight">
        Unemployment is a lagging indicator. By the time the unemployment rate
        spikes, the economic damage has already happened. The layoffs started
        months earlier, worked through the energy sector, then the service
        sector, and only then showed up in the monthly survey. If you want early
        warning, watch energy prices and rig counts — they lead unemployment by
        6-9 months.
      </Insight>
    </LessonSection>
  );
}

// ============================================================
// Section 2: Participation Rate
// ============================================================

async function ParticipationSection() {
  const participationData = await fetchStatCanTimeSeries(
    STATSCAN_SERIES.AB_PARTICIPATION_RATE.tableId,
    STATSCAN_SERIES.AB_PARTICIPATION_RATE.coordinate,
    120
  ).catch(() => []);

  const timeRange = computeTimeRange(participationData);
  const latest = participationData.at(-1);

  return (
    <LessonSection title="The Participation Rate — Alberta's Hidden Strength">
      <Prose>
        <p>
          Alberta consistently has one of the highest labour force participation
          rates in Canada. This is not an accident — it is a function of
          demographics and economics. Alberta&apos;s population skews younger
          than the national average (fewer retirees), and the province&apos;s
          high-wage resource sector draws people who come specifically to work.
        </p>
        <p>
          The participation rate measures what percentage of the working-age
          population (15+) is either employed or actively looking for work. A
          higher participation rate means more of the population is economically
          engaged — contributing to GDP, paying taxes, and consuming goods and
          services.
        </p>
      </Prose>

      {participationData.length > 0 && (
        <Card>
          <CardHeader title="Alberta Participation Rate" freshness="daily" />
          <ChartCard
            chartId="learn-people-participation"
            title="Alberta Participation Rate"
            timeRange={timeRange}
            source="StatsCan 14-10-0287"
          >
            <TimeSeriesAreaChart data={participationData} color="#8b5cf6" height={240} />
          </ChartCard>
        </Card>
      )}

      {latest && (
        <DataGrid>
          <LiveDataPoint
            label="Participation Rate"
            value={`${latest.value.toFixed(1)}%`}
            source="StatsCan"
          />
        </DataGrid>
      )}

      <Insight variant="lever">
        A high participation rate is Alberta&apos;s hidden economic advantage. It
        means more people are working per capita than in other provinces, which
        translates directly to higher GDP per capita and higher tax revenue per
        resident. This is part of why Alberta can fund public services without a
        sales tax — more people are earning and paying income tax.
      </Insight>

      <Expandable title="What drives the participation rate down?">
        <Prose>
          <p>
            Three forces push participation down: aging (retirees leave the
            labour force), prolonged economic weakness (discouraged workers stop
            looking), and education enrollment (students are not counted as
            participants). Alberta&apos;s participation advantage comes from
            attracting working-age migrants who arrive specifically for
            employment. When interprovincial migration reverses during a bust,
            the people who leave are disproportionately working-age — which
            paradoxically can maintain the participation rate even as total
            employment drops, because the denominator shrinks alongside the
            numerator.
          </p>
        </Prose>
      </Expandable>
    </LessonSection>
  );
}

// ============================================================
// Section 3: Wages and Earnings
// ============================================================

async function WagesSection() {
  const earningsMap = await fetchForAll(
    REGIONAL_INDICATORS["Average Weekly Earnings"]
  );

  return (
    <LessonSection title="Wages — Alberta's Competitive Edge">
      <Prose>
        <p>
          Alberta wages are consistently the highest in Canada. This is not just
          an oil patch phenomenon — high wages in the energy sector pull up
          wages across the entire economy through competition for labour. If a
          rig worker can earn $120,000 a year, a nurse or teacher in the same
          city needs to be paid comparably, or they will leave.
        </p>
        <p>
          This wage premium is the single biggest driver of interprovincial
          migration. When Alberta&apos;s wages are 20-30% above the national
          average, the pull effect is enormous. Here are the average weekly
          earnings across Alberta communities:
        </p>
      </Prose>

      <DataGrid>
        {MUNICIPALITIES.map((muni) => {
          const data = earningsMap.get(muni) ?? [];
          const val = latestRegional(data);
          const period = latestPeriod(data);
          return (
            <LiveDataPoint
              key={muni}
              label={`${muni}${period ? ` (${period})` : ""}`}
              value={val > 0 ? `$${fmt(val, { decimals: 0 })}` : "N/A"}
              source="AB Regional Dashboard"
            />
          );
        })}
      </DataGrid>

      <ChainStep
        number={1}
        title="Energy wages set the floor"
        description="Oil and gas companies pay premium wages to attract workers to demanding jobs in remote locations. These wages set a high floor for the entire labour market."
      />

      <ChainStep
        number={2}
        title="Competition ripples outward"
        description="Healthcare, construction, retail, and hospitality must compete with energy wages. Even a barista in Calgary earns more than a barista in Halifax — because the alternative options pay more."
      />

      <ChainStep
        number={3}
        title="Cost of living follows"
        description="Higher wages eventually push up housing costs, food prices, and service costs. The wage premium is real, but it is partially offset by the higher cost of living in Alberta's major cities."
      />

      <Insight variant="warning">
        Alberta&apos;s wage premium is real but cyclical. During oil busts,
        wages stagnate or decline while the cost of living (especially
        mortgages already locked in during boom times) stays elevated. The worst
        period for Alberta workers is not the bust itself — it is the 12-18
        months after, when wages have dropped but housing costs have not yet
        adjusted.
      </Insight>

      <Expandable title="Do Alberta wages account for cost of living?">
        <Prose>
          <p>
            Yes and no. Alberta has no provincial sales tax, which provides a
            permanent 5-8% advantage on purchases compared to most provinces.
            Income taxes are also lower (Alberta has a flat 10% provincial
            income tax on the first $142,292, compared to progressive rates
            elsewhere). However, housing costs in Edmonton and Calgary —
            especially during booms — can significantly narrow the gap. The net
            result: Alberta workers generally retain more disposable income than
            their counterparts in other provinces, but the advantage is smaller
            than the headline wage gap suggests.
          </p>
        </Prose>
      </Expandable>
    </LessonSection>
  );
}

// ============================================================
// Page Component
// ============================================================

export default function LabourMarketPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
      <BigQuestion>How strong is Alberta&apos;s job market — really?</BigQuestion>

      <Prose>
        <p>
          Alberta&apos;s labour market is unlike any other in Canada. Higher
          wages, higher participation, more volatility. The boom-bust cycle
          creates dramatic swings in employment that ripple through housing,
          migration, and municipal budgets. This lesson traces the key labour
          market indicators with live data so you can read the signals
          accurately.
        </p>
      </Prose>

      <Suspense fallback={<LoadingCard />}>
        <EmploymentSection />
      </Suspense>

      <Suspense fallback={<LoadingCard />}>
        <ParticipationSection />
      </Suspense>

      <Suspense fallback={<LoadingCard />}>
        <WagesSection />
      </Suspense>

      <SoWhat>
        Alberta&apos;s labour market tells three stories simultaneously.
        Unemployment reveals the cyclical pain — and it always lags. The
        participation rate reveals the structural advantage — more people
        working per capita means more economic output and tax revenue. And
        wages reveal the competitive pull — high wages attract workers from
        across Canada, which drives population growth, which drives housing
        demand. These three metrics are deeply interconnected, and reading them
        together gives you a much clearer picture than any single headline
        number.
      </SoWhat>

      <LessonCompleteButton moduleSlug="people-growth" lessonSlug="labour-market" />

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Tamrack &mdash; The Labour Market &mdash; All data from free
        public APIs
      </footer>
    </main>
  );
}
