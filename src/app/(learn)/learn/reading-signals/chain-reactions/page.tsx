import type { Metadata } from "next";
import { Suspense } from "react";
import { Card } from "@/components/card";
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
  SoWhat,
} from "@/components/learn-lesson";
import { LessonCompleteButton } from "@/components/learn-lesson-complete";

// ============================================================
// Metadata
// ============================================================

export const metadata: Metadata = {
  title: "Chain Reactions — Reading the Signals — Pulse Learn",
  description:
    "How the Bank of Canada rate decision cascades through mortgages, permits, construction, and rent — traced with live data. Plus building permits as a crystal ball and business licences as a confidence index.",
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
// Section: The Master Signal — BoC Policy Rate (20yr)
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
// Section: Building Permits — The Crystal Ball
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
    const key = p.date.slice(0, 7);
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
          years before a unit is available to rent. When you look at today&apos;s
          permit numbers, you are looking at 2027 and 2028&apos;s housing market.
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
          title="The Construction Pipeline: Permits -> Starts -> Completions"
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
        If permits are falling right now, that means 2027&apos;s housing supply is
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
// Section: Business Licences
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
// Page
// ============================================================

export default function ChainReactionsPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
      <BigQuestion>How does one number move everything else?</BigQuestion>

      <Prose>
        <p>
          Economic indicators do not move in isolation. They are connected in
          chains — one moves, then the next, then the next. Each link has a
          predictable time lag. Understanding the chain is how you turn a
          single data point into a forecast.
        </p>
      </Prose>

      <Suspense fallback={<LoadingCard />}>
        <MasterSignalSection />
      </Suspense>

      <Suspense fallback={<LoadingCard />}>
        <PermitsSection />
      </Suspense>

      <Suspense fallback={<LoadingCard />}>
        <BusinessLicencesSection />
      </Suspense>

      <SoWhat>
        Three chain reactions, one lesson: the BoC rate cascades through
        mortgages, construction, and rent over 2-3 years. Building permits
        cascade through starts and completions over 12-24 months. Business
        licences cascade through employment and spending over 6-12 months.
        Once you see the chains, you can follow any single indicator to its
        downstream effects — and you stop being surprised by &ldquo;sudden&rdquo;
        changes that were actually signalled months or years in advance.
      </SoWhat>

      <LessonCompleteButton moduleSlug="reading-signals" lessonSlug="chain-reactions" />

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Alberta Pulse Check &mdash; Chain Reactions &mdash; All data from
        free public APIs
      </footer>
    </main>
  );
}
