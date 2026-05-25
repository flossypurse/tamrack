export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader } from "@/components/card";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import {
  TimeSeriesAreaChart,
  MultiSeriesLineChart,
  type MultiSeriesPoint,
} from "@/components/chart";
import { ChartCard } from "@/components/chart-card";
import { computeTimeRange } from "@/lib/time-range";
import {
  fetchBoCTimeSeries,
  fetchStatCanTimeSeries,
  fetchEdmontonPermitsSummary,
  fetchEdmontonBusinessLicences,
  BOC_SERIES,
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
  LessonNav,
  SoWhat,
} from "@/components/learn-lesson";
import {
  TrendingUp,
  Eye,
  Activity,
  Timer,
  ArrowRight,
  BarChart3,
} from "lucide-react";

// ============================================================
// Metadata
// ============================================================

export const metadata: Metadata = {
  title: "Reading the Signals — Learn — Tamrack",
  description:
    "Learn the difference between leading and lagging indicators. Read the dashboard like an economist — permits predict construction, construction predicts supply, supply predicts rent.",
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

function latest(data: TimeSeriesPoint[]): number {
  return data.at(-1)?.value ?? 0;
}

function direction(
  data: TimeSeriesPoint[],
  months = 3
): "up" | "down" | "flat" {
  if (data.length < months * 2) return "flat";
  const recent =
    data.slice(-months).reduce((s, p) => s + p.value, 0) / months;
  const prior =
    data.slice(-months * 2, -months).reduce((s, p) => s + p.value, 0) / months;
  if (prior === 0) return "flat";
  const pct = ((recent - prior) / Math.abs(prior)) * 100;
  return pct > 2 ? "up" : pct < -2 ? "down" : "flat";
}

function pctChange(data: TimeSeriesPoint[], months = 3): string {
  if (data.length < months * 2) return "n/a";
  const recent =
    data.slice(-months).reduce((s, p) => s + p.value, 0) / months;
  const prior =
    data.slice(-months * 2, -months).reduce((s, p) => s + p.value, 0) / months;
  if (prior === 0) return "n/a";
  const pct = ((recent - prior) / Math.abs(prior)) * 100;
  return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

// ============================================================
// Section 2: The Master Signal — BoC Policy Rate (20yr)
// ============================================================

async function MasterSignalSection() {
  const policyRate = await fetchBoCTimeSeries(BOC_SERIES.POLICY_RATE, 240).catch(
    () => []
  );

  const timeRange = computeTimeRange(policyRate);
  const currentRate = latest(policyRate);
  const dir = direction(policyRate, 6);

  return (
    <LessonSection title="The Master Signal: The Bank of Canada Rate">
      <Prose>
        <p>
          If you only watch one number on this entire dashboard, make it the
          Bank of Canada policy interest rate. This is the rate the central bank
          charges commercial banks to borrow overnight. When it moves, it sends
          a shockwave through the entire economy — but different parts of the
          economy feel it at different speeds.
        </p>
        <p>
          Think of it as dropping a stone into a pond. The splash is immediate
          (bond markets reprice within hours). The first ripple takes weeks
          (mortgage rates adjust). The outer ripples take years (vacancy rates,
          rent prices). Understanding those time lags is the whole game.
        </p>
      </Prose>

      <DataGrid>
        <LiveDataPoint
          label="BoC Policy Rate"
          value={`${currentRate.toFixed(2)}%`}
          direction={dir}
          change={pctChange(policyRate, 6)}
          source="Bank of Canada"
        />
      </DataGrid>

      {policyRate.length > 0 && (
        <ChartCard
          chartId="learn-boc-policy-rate-20yr"
          title="BoC Policy Interest Rate"
          timeRange={timeRange}
          source="Bank of Canada Valet API"
        >
          <TimeSeriesAreaChart
            data={policyRate}
            color="#8b5cf6"
            valueSuffix="%"
            height={280}
          />
        </ChartCard>
      )}

      <Prose>
        <p>
          When the BoC cuts rates, it starts a chain reaction. Every link in the
          chain has a predictable time lag. Here is the full sequence from a rate
          decision to your rent cheque:
        </p>
      </Prose>

      <div className="space-y-0">
        <ChainStep
          number={1}
          title="Rate Decision"
          description="The Bank of Canada raises or lowers the policy rate. Bond markets reprice within hours."
          timeLag="Day 0"
        />
        <ChainStep
          number={2}
          title="Mortgage Rates Adjust"
          description="Variable rates move immediately. Fixed rates follow as bond yields shift."
          timeLag="2-6 weeks"
        />
        <ChainStep
          number={3}
          title="Buyer Demand Shifts"
          description="Lower rates = more purchasing power = more buyers enter the market. Higher rates = fewer buyers."
          timeLag="2-3 months"
        />
        <ChainStep
          number={4}
          title="Building Permits Increase"
          description="Developers see rising demand and apply for permits. This is the first hard signal of future supply."
          timeLag="3-6 months"
        />
        <ChainStep
          number={5}
          title="Housing Starts Rise"
          description="Permits get approved, shovels go in the ground. Construction begins."
          timeLag="6-9 months"
        />
        <ChainStep
          number={6}
          title="Completions Arrive"
          description="Buildings finish. New units hit the market. This is actual new supply."
          timeLag="18-24 months"
        />
        <ChainStep
          number={7}
          title="Vacancy Rates Change"
          description="More supply + same demand = higher vacancy. Less supply + more demand = lower vacancy."
          timeLag="24-30 months"
        />
        <ChainStep
          number={8}
          title="Rent Adjusts"
          description="Landlords respond to vacancy: high vacancy = competitive pricing, low vacancy = rent increases."
          timeLag="24-36 months"
        />
      </div>

      <Insight variant="insight">
        A rate cut today will not show up in your rent for two to three years.
        That is not a guess — it is the structural time lag of the construction
        pipeline. When someone says &ldquo;rates dropped, rent should be
        cheaper&rdquo; — they are skipping six links in the chain.
      </Insight>
    </LessonSection>
  );
}

// ============================================================
// Section 3: Building Permits — The Crystal Ball
// ============================================================

async function PermitsSection() {
  const [permits, housingStarts, housingCompletions] = await Promise.all([
    fetchEdmontonPermitsSummary().catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.tableId,
      STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.coordinate,
      120
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.EDMONTON_HOUSING_COMPLETIONS.tableId,
      STATSCAN_SERIES.EDMONTON_HOUSING_COMPLETIONS.coordinate,
      120
    ).catch(() => []),
  ]);

  // Build multi-series data: align by date
  const dateMap = new Map<string, MultiSeriesPoint>();

  for (const p of permits) {
    const key = p.date.slice(0, 7); // YYYY-MM
    if (!dateMap.has(key)) dateMap.set(key, { date: p.date });
    dateMap.get(key)!.permits = p.value;
  }
  for (const p of housingStarts) {
    const key = p.date.slice(0, 7);
    if (!dateMap.has(key)) dateMap.set(key, { date: p.date });
    dateMap.get(key)!.starts = p.value;
  }
  for (const p of housingCompletions) {
    const key = p.date.slice(0, 7);
    if (!dateMap.has(key)) dateMap.set(key, { date: p.date });
    dateMap.get(key)!.completions = p.value;
  }

  const multiData = Array.from(dateMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  const permitsDir = direction(permits);
  const startsDir = direction(housingStarts);
  const completionsDir = direction(housingCompletions);

  return (
    <LessonSection title="Building Permits — The Construction Crystal Ball">
      <Prose>
        <p>
          Building permits are the single best leading indicator for housing
          supply. A permit is filed months before a shovel hits the ground and
          years before a unit is available to rent. When you look at today's
          permit numbers, you are looking at 2027 and 2028's housing market.
        </p>
        <p>
          The chain is simple: permits lead starts by 3-6 months. Starts lead
          completions by 12-18 months. Completions determine whether supply
          keeps up with demand. Watch all three together and you can see the
          pipeline filling — or draining.
        </p>
      </Prose>

      <DataGrid>
        <LiveDataPoint
          label="Permits (Edmonton)"
          value={latest(permits).toLocaleString()}
          direction={permitsDir}
          change={pctChange(permits)}
          source="Edmonton Open Data"
        />
        <LiveDataPoint
          label="Housing Starts"
          value={latest(housingStarts).toLocaleString()}
          direction={startsDir}
          change={pctChange(housingStarts)}
          source="StatsCan"
        />
        <LiveDataPoint
          label="Housing Completions"
          value={latest(housingCompletions).toLocaleString()}
          direction={completionsDir}
          change={pctChange(housingCompletions)}
          source="StatsCan"
        />
      </DataGrid>

      {multiData.length > 0 && (
        <ChartCard
          chartId="learn-permits-starts-completions"
          title="The Construction Pipeline: Permits → Starts → Completions"
          timeRange={computeTimeRange(multiData)}
          source="Edmonton Open Data, StatsCan"
        >
          <MultiSeriesLineChart
            data={multiData}
            series={[
              {
                key: "permits",
                label: "Building Permits",
                color: "#8b5cf6",
              },
              {
                key: "starts",
                label: "Housing Starts",
                color: "#3b82f6",
              },
              {
                key: "completions",
                label: "Completions",
                color: "#6b7280",
              },
            ]}
            height={280}
          />
        </ChartCard>
      )}

      <Insight variant="watch">
        If permits are falling right now, that means 2027's housing supply is
        being decided today. By the time completions drop and rent rises, the
        decision was already made — two years ago — in the permits data.
      </Insight>

      <Expandable title="Why permits, not starts?">
        <Prose>
          <p>
            Starts get more headlines, but permits come first. A developer can
            pull a permit and never break ground (market conditions change,
            financing falls through). But a developer cannot break ground without
            a permit. So permits capture intent at the earliest measurable stage.
            Starts confirm that intent turned into action.
          </p>
        </Prose>
      </Expandable>
    </LessonSection>
  );
}

// ============================================================
// Section 4: Business Licences
// ============================================================

async function BusinessLicencesSection() {
  const licences = await fetchEdmontonBusinessLicences().catch(() => []);

  const dir = direction(licences);
  const timeRange = computeTimeRange(licences);

  return (
    <LessonSection title="Business Licences — The Entrepreneurial Confidence Index">
      <Prose>
        <p>
          When people see opportunity, they start businesses. When they are
          scared, they do not. New business licence applications are a leading
          indicator of economic confidence — not lagging GDP reports or
          unemployment headlines.
        </p>
        <p>
          A person filing for a business licence is making a bet on the next 1-3
          years. They are saying: &ldquo;I believe there is enough demand, enough
          customers, enough growth in this city to justify the risk.&rdquo; Aggregate
          thousands of those individual bets and you have one of the most honest
          signals in economics — because people vote with their money.
        </p>
      </Prose>

      <DataGrid>
        <LiveDataPoint
          label="New Business Licences"
          value={latest(licences).toLocaleString()}
          direction={dir}
          change={pctChange(licences)}
          source="Edmonton Open Data"
        />
      </DataGrid>

      {licences.length > 0 && (
        <ChartCard
          chartId="learn-business-licences"
          title="Edmonton Business Licence Applications"
          timeRange={timeRange}
          source="Edmonton Open Data (Socrata)"
        >
          <TimeSeriesAreaChart
            data={licences}
            color="#8b5cf6"
            height={240}
          />
        </ChartCard>
      )}

      <Insight variant="insight">
        Compare this chart to unemployment. Business licences often turn before
        unemployment does. Licences start climbing while unemployment is still
        high — that is the recovery signal the headlines miss. Licences start
        falling while unemployment is still low — that is the early warning.
      </Insight>
    </LessonSection>
  );
}

// ============================================================
// Section 5: Putting It Together — Live Dashboard Reading
// ============================================================

async function DashboardReadingSection() {
  const [
    policyRate,
    mortgage5y,
    energyPrices,
    permits,
    licences,
    unemployment,
    cpi,
    gdp,
    retailSales,
    employment,
  ] = await Promise.all([
    fetchBoCTimeSeries(BOC_SERIES.POLICY_RATE, 24).catch(() => []),
    fetchBoCTimeSeries(BOC_SERIES.MORTGAGE_5Y_FIXED, 24).catch(() => []),
    fetchBoCTimeSeries(BOC_SERIES.BCPI_ENERGY, 24).catch(() => []),
    fetchEdmontonPermitsSummary().catch(() => []),
    fetchEdmontonBusinessLicences().catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.tableId,
      STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.coordinate,
      24
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_CPI.tableId,
      STATSCAN_SERIES.AB_CPI.coordinate,
      24
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_GDP.tableId,
      STATSCAN_SERIES.AB_GDP.coordinate,
      24
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_RETAIL_SALES.tableId,
      STATSCAN_SERIES.AB_RETAIL_SALES.coordinate,
      24
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_EMPLOYMENT.tableId,
      STATSCAN_SERIES.AB_EMPLOYMENT.coordinate,
      24
    ).catch(() => []),
  ]);

  const leadingDir = {
    rate: direction(policyRate),
    mortgage: direction(mortgage5y),
    energy: direction(energyPrices),
    permits: direction(permits),
    licences: direction(licences),
  };

  const coincidentDir = {
    employment: direction(employment),
    retail: direction(retailSales),
  };

  const laggingDir = {
    unemployment: direction(unemployment),
    cpi: direction(cpi),
    gdp: direction(gdp),
  };

  return (
    <LessonSection title="Putting It Together — Your Personal Dashboard Reading">
      <Prose>
        <p>
          Here is the live data, organized by speed. Leading indicators on the
          left, coincident in the middle, lagging on the right. This is how an
          economist reads the dashboard — and now you can too.
        </p>
      </Prose>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Leading */}
        <Card>
          <CardHeader
            title="Leading"
            subtitle="6-18 months ahead"
            badge="EARLY"
          />
          <div className="space-y-2">
            <LiveDataPoint
              label="BoC Rate"
              value={`${latest(policyRate).toFixed(2)}%`}
              direction={leadingDir.rate}
              source="BoC"
            />
            <LiveDataPoint
              label="5yr Mortgage"
              value={`${latest(mortgage5y).toFixed(2)}%`}
              direction={leadingDir.mortgage}
              source="BoC"
            />
            <LiveDataPoint
              label="Energy BCPI"
              value={latest(energyPrices).toFixed(1)}
              direction={leadingDir.energy}
              source="BoC"
            />
            <LiveDataPoint
              label="Permits"
              value={latest(permits).toLocaleString()}
              direction={leadingDir.permits}
              source="Edmonton"
            />
            <LiveDataPoint
              label="Biz Licences"
              value={latest(licences).toLocaleString()}
              direction={leadingDir.licences}
              source="Edmonton"
            />
          </div>
          <p className="text-[10px] text-purple-400 mt-3 font-medium">
            These tell you where you are GOING
          </p>
        </Card>

        {/* Coincident */}
        <Card>
          <CardHeader
            title="Coincident"
            subtitle="Real-time pulse"
            badge="NOW"
          />
          <div className="space-y-2">
            <LiveDataPoint
              label="Employment"
              value={`${(latest(employment) / 1000).toFixed(0)}K`}
              direction={coincidentDir.employment}
              source="StatsCan"
            />
            <LiveDataPoint
              label="Retail Sales"
              value={`$${(latest(retailSales) / 1_000_000).toFixed(1)}M`}
              direction={coincidentDir.retail}
              source="StatsCan"
            />
          </div>
          <p className="text-[10px] text-blue-400 mt-3 font-medium">
            These tell you where you ARE
          </p>
        </Card>

        {/* Lagging */}
        <Card>
          <CardHeader
            title="Lagging"
            subtitle="3-12 months behind"
            badge="LATE"
          />
          <div className="space-y-2">
            <LiveDataPoint
              label="Unemployment"
              value={`${latest(unemployment).toFixed(1)}%`}
              direction={laggingDir.unemployment}
              source="StatsCan"
            />
            <LiveDataPoint
              label="CPI (Inflation)"
              value={latest(cpi).toFixed(1)}
              direction={laggingDir.cpi}
              source="StatsCan"
            />
            <LiveDataPoint
              label="GDP"
              value={`$${(latest(gdp) / 1_000_000).toFixed(1)}M`}
              direction={laggingDir.gdp}
              source="StatsCan"
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-3 font-medium">
            These tell you where you have BEEN
          </p>
        </Card>
      </div>

      <Prose>
        <p>
          Here is how to read this: Look at the leading indicators first. Are
          they pointing up or down? Now compare to the lagging indicators. If
          leading is up but lagging is still down — the recovery is starting but
          has not shown up in the headlines yet. If leading is turning down but
          lagging is still up — the slowdown is coming but has not hit yet.
        </p>
        <p>
          The gap between leading and lagging is information. Most people only
          see the lagging side. You now see both.
        </p>
      </Prose>

      <Insight variant="insight">
        This is why the dashboard matters. News tells you what happened. Leading
        indicators tell you what is about to happen. The gap between leading and
        lagging indicators is where the opportunity lives — whether you are
        buying a house, starting a business, or choosing where to live.
      </Insight>
    </LessonSection>
  );
}

// ============================================================
// Page Component
// ============================================================

export default function ReadingTheSignalsPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
      <PageHeader
        title="Reading the Signals"
        description="The difference between leading and lagging indicators — and how to use them to see what's coming before it arrives."
        category="learn"
        icon={<TrendingUp size={20} />}
      />

      {/* Opening */}
      <BigQuestion>How do I know what&apos;s coming next?</BigQuestion>

      <Prose>
        <p>
          The dashboard has 50+ indicators. Some tell you where you have been
          (lagging). Some tell you where you are (coincident). And some tell you
          where you are going (leading). This lesson teaches you the
          difference — because it is the superpower of anyone who actually uses
          data.
        </p>
        <p>
          Most people consume data backwards. They see unemployment numbers on
          the news and think &ldquo;the economy is bad.&rdquo; But unemployment
          is a lagging indicator — by the time it makes the news, the downturn
          started six months ago. And by the time it drops, the recovery started
          six months ago. If you wait for lagging indicators to move, you are
          always six months late.
        </p>
      </Prose>

      {/* ============================================================ */}
      {/* Section 1: The Three Speeds */}
      {/* ============================================================ */}

      <LessonSection title="Leading, Coincident, and Lagging — The Three Speeds">
        <Prose>
          <p>
            Think of driving. A leading indicator is the traffic light turning
            yellow — something is about to change. A coincident indicator is your
            foot on the brake — it is happening right now. A lagging indicator is
            the insurance claim — it tells you what already happened.
          </p>
          <p>
            Every indicator on this dashboard falls into one of three categories.
            Knowing which is which changes everything about how you read the
            data.
          </p>
        </Prose>

        {/* Visual classification grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Leading */}
          <div className="border border-purple-500/20 bg-purple-500/5 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Eye size={14} className="text-purple-400" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-purple-400">
                Leading
              </h4>
              <span className="text-[9px] text-purple-400/60 ml-auto">
                6-18 months ahead
              </span>
            </div>
            <ul className="space-y-1.5">
              {[
                "BoC policy rate",
                "Building permits",
                "Development permits",
                "Business licences",
                "Energy commodity prices",
                "Housing starts",
              ].map((item) => (
                <li
                  key={item}
                  className="text-xs text-foreground/80 flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Coincident */}
          <div className="border border-blue-500/20 bg-blue-500/5 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Activity size={14} className="text-blue-400" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                Coincident
              </h4>
              <span className="text-[9px] text-blue-400/60 ml-auto">
                Real-time
              </span>
            </div>
            <ul className="space-y-1.5">
              {[
                "Employment level",
                "Retail sales",
                "Electricity demand",
              ].map((item) => (
                <li
                  key={item}
                  className="text-xs text-foreground/80 flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Lagging */}
          <div className="border border-gray-500/20 bg-gray-500/5 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Timer size={14} className="text-gray-400" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Lagging
              </h4>
              <span className="text-[9px] text-gray-400/60 ml-auto">
                3-12 months behind
              </span>
            </div>
            <ul className="space-y-1.5">
              {[
                "Unemployment rate",
                "CPI / inflation",
                "GDP",
                "Housing completions",
                "Vacancy rates",
                "Rent prices",
              ].map((item) => (
                <li
                  key={item}
                  className="text-xs text-foreground/80 flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-500 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Insight variant="insight">
          Most news reports use lagging indicators. By the time unemployment
          makes the news, the downturn started 6 months ago. By the time GDP
          growth is announced, the boom started a year ago. The news is not
          wrong — it is just late.
        </Insight>
      </LessonSection>

      {/* ============================================================ */}
      {/* Section 2: The Master Signal (async + Suspense) */}
      {/* ============================================================ */}

      <Suspense fallback={<LoadingCard />}>
        <MasterSignalSection />
      </Suspense>

      {/* ============================================================ */}
      {/* Section 3: Building Permits (async + Suspense) */}
      {/* ============================================================ */}

      <Suspense fallback={<LoadingCard />}>
        <PermitsSection />
      </Suspense>

      {/* ============================================================ */}
      {/* Section 4: Business Licences (async + Suspense) */}
      {/* ============================================================ */}

      <Suspense fallback={<LoadingCard />}>
        <BusinessLicencesSection />
      </Suspense>

      {/* ============================================================ */}
      {/* Section 5: Putting It Together (async + Suspense) */}
      {/* ============================================================ */}

      <Suspense fallback={<LoadingCard />}>
        <DashboardReadingSection />
      </Suspense>

      {/* ============================================================ */}
      {/* Section 6: Common Traps */}
      {/* ============================================================ */}

      <LessonSection title="Common Traps">
        <Prose>
          <p>
            Understanding the three speeds is the foundation. But there are
            three common mistakes that trip up even experienced data readers.
            Recognizing them will save you from drawing exactly the wrong
            conclusion.
          </p>
        </Prose>

        <Insight variant="warning" title="Trap #1: Mistaking a Lag for a Trend">
          Unemployment is high but permits are rising? The economy is
          recovering, not declining. The lagging indicator has not caught up to
          the leading indicator yet. If you act on the unemployment number alone
          — selling property, pulling out of investments, leaving Alberta — you
          are reacting to old information. Always check what the leading
          indicators are doing before interpreting a lagging number.
        </Insight>

        <Insight variant="warning" title="Trap #2: Assuming National = Local">
          Canada&apos;s unemployment rate and Alberta&apos;s can diverge
          dramatically. In a national recession, Alberta may hold steady because
          energy prices are high. In a national boom, Alberta may lag because oil
          prices crashed. The province runs on a different engine than the rest
          of the country. Always use Alberta-specific data — which is exactly
          what this dashboard provides.
        </Insight>

        <Insight variant="warning" title="Trap #3: Ignoring the Time Lags">
          A rate cut today will not show up in rent for 2+ years. A permit surge
          today will not show up in housing supply for 18 months. A business
          licence boom today will not show up in employment for 6-12 months. The
          lags are real, they are structural, and they do not speed up because
          you want them to. Patience is a data skill.
        </Insight>

        <Expandable title="Bonus trap: Confusing correlation with sequence">
          <Prose>
            <p>
              Two indicators moving in the same direction does not mean one
              caused the other. But if one consistently moves first, and the
              other consistently follows 6 months later, you have something more
              useful than correlation — you have a predictive sequence. That is
              what leading indicators give you. Not certainty, but a reliable
              heads-up.
            </p>
          </Prose>
        </Expandable>
      </LessonSection>

      {/* ============================================================ */}
      {/* Closing */}
      {/* ============================================================ */}

      <SoWhat>
        The single most valuable skill on this dashboard: check leading
        indicators first, then ask &ldquo;has the lagging data caught up
        yet?&rdquo; The gap between them is where the opportunity lives. When
        leading indicators turn up but lagging indicators are still falling,
        most people panic. When leading indicators turn down but lagging
        indicators are still rising, most people are complacent. Now you know
        better.
      </SoWhat>

      <LessonNav
        prev={{ href: "/home/learn/energy-economy", label: "Energy Economy" }}
        next={{ href: "/home/learn/your-tax-dollars", label: "Your Tax Dollars" }}
      />
    </main>
  );
}
