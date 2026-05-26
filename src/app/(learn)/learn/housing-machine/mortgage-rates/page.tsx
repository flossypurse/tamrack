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
  fetchBoCTimeSeries,
  BOC_SERIES,
} from "@/lib/data-sources";
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
  title: "Mortgage Rates Follow — The Housing Machine",
  description:
    "Fixed vs variable, and why they diverge. How mortgage rates drive buyer demand.",
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
// Mortgage Rate Section
// ============================================================

async function MortgageRateSection() {
  const [policyData, fixed5Data, variable5Data] = await Promise.all([
    fetchBoCTimeSeries(BOC_SERIES.POLICY_RATE, 240).catch(() => []),
    fetchBoCTimeSeries(BOC_SERIES.MORTGAGE_5Y_FIXED, 240).catch(() => []),
    fetchBoCTimeSeries(BOC_SERIES.MORTGAGE_5Y_VARIABLE, 240).catch(() => []),
  ]);

  // Merge into MultiSeriesPoint[]
  const dateMap = new Map<string, MultiSeriesPoint>();
  for (const p of policyData) {
    dateMap.set(p.date, { date: p.date, policy: p.value, fixed: 0, variable: 0 });
  }
  for (const p of fixed5Data) {
    const existing = dateMap.get(p.date);
    if (existing) {
      existing.fixed = p.value;
    } else {
      dateMap.set(p.date, { date: p.date, policy: 0, fixed: p.value, variable: 0 });
    }
  }
  for (const p of variable5Data) {
    const existing = dateMap.get(p.date);
    if (existing) {
      existing.variable = p.value;
    } else {
      dateMap.set(p.date, { date: p.date, policy: 0, fixed: 0, variable: p.value });
    }
  }
  const merged = Array.from(dateMap.values()).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const timeRange = computeTimeRange(merged);
  const latestFixed = fixed5Data.at(-1);
  const latestVariable = variable5Data.at(-1);

  return (
    <div className="space-y-4">
      <ChainStep
        number={2}
        title="Banks set mortgage rates"
        description="Commercial banks take the BoC policy rate and add their margin. The 5-year fixed rate also bakes in bond market expectations about where rates are headed. Your monthly payment is set here."
        timeLag="2–6 weeks"
      />

      <Prose>
        <p>
          There are two flavours of mortgage rate that matter. The variable rate
          moves almost in lockstep with the BoC — when the Bank cuts, your payment
          drops within weeks. The 5-year fixed rate is trickier: it follows the
          bond market, which prices in where traders think rates will be years from
          now.
        </p>
        <p>
          Watch how the blue policy rate line and the green fixed rate line move
          together over time, but the fixed rate often leads — it starts falling
          before the BoC actually cuts, because bond traders are forward-looking.
        </p>
      </Prose>

      <Card>
        <CardHeader title="Policy Rate vs Mortgage Rates" freshness="daily" />
        <ChartCard
          chartId="learn-housing-mortgage-rates"
          title="Policy Rate vs Mortgage Rates"
          timeRange={timeRange}
          source="Bank of Canada"
        >
          <MultiSeriesLineChart
            data={merged}
            series={[
              { key: "policy", label: "BoC Policy Rate", color: "#3b82f6", suffix: "%" },
              { key: "fixed", label: "5yr Fixed Mortgage", color: "#10b981", suffix: "%" },
              { key: "variable", label: "5yr Variable Mortgage", color: "#f97316", suffix: "%" },
            ]}
            height={250}
          />
        </ChartCard>
      </Card>

      <Insight variant="warning">
        Variable rates respond to BoC changes within weeks. Fixed rates can
        actually move in the opposite direction if bond markets disagree with the
        Bank. In late 2023, the BoC held rates steady while 5-year fixed rates
        drifted lower — the bond market was betting on future cuts before the Bank
        made them.
      </Insight>

      <DataGrid>
        {latestFixed && (
          <LiveDataPoint
            label="5yr Fixed Rate"
            value={`${latestFixed.value.toFixed(2)}%`}
            source="Bank of Canada"
          />
        )}
        {latestVariable && (
          <LiveDataPoint
            label="5yr Variable Rate"
            value={`${latestVariable.value.toFixed(2)}%`}
            source="Bank of Canada"
          />
        )}
      </DataGrid>
    </div>
  );
}

// ============================================================
// Buyer Reaction Section (no async data)
// ============================================================

function BuyerReactionSection() {
  return (
    <div className="space-y-4">
      <ChainStep
        number={3}
        title="Mortgage rates drive buyer demand"
        description="When rates drop, buyers can afford more house for the same monthly payment. When rates rise, the opposite happens — budgets shrink, demand cools, and some buyers are priced out entirely."
        timeLag="1–3 months"
      />

      <Prose>
        <p>
          Here is the core affordability equation that every buyer faces, whether
          they know it or not:
        </p>
        <p className="font-mono text-xs bg-foreground/[0.03] border border-card-border rounded-lg p-3 text-center">
          Monthly income &divide; Mortgage rate = Maximum purchase price
        </p>
        <p>
          Your income does not change when the BoC announces a rate cut. But the
          amount a bank will lend you absolutely does. A family earning $120K/year
          might qualify for a $480K mortgage at 6%, but $530K at 5%. Same family,
          same paycheque — $50K more purchasing power from a single percentage point.
        </p>
        <p>
          Multiply that across thousands of buyers in Edmonton and Calgary, and you
          get a wave of demand that hits the market all at once. That is what
          drives bidding wars when rates drop and what causes listings to sit for
          months when rates spike.
        </p>
      </Prose>

      <Insight>
        A rough rule of thumb: every 1% drop in mortgage rates gives buyers about
        10% more purchasing power. That means a move from 6% to 5% does not just
        add a little room — it can push someone from a condo budget into a
        townhouse budget. Small rate moves, big market effects.
      </Insight>

      <Expandable title="Why does buyer demand lag by 1-3 months?">
        <Prose>
          <p>
            People do not check mortgage rates daily. Most buyers start their
            search, get pre-approved, and only then discover what rates look like.
            After a rate cut, it takes a few weeks for media coverage to shift
            sentiment, another few weeks for new pre-approvals to come through, and
            then those buyers need to actually find and close on a property. The
            whole cycle from rate announcement to a spike in sales typically runs
            4-12 weeks.
          </p>
        </Prose>
      </Expandable>
    </div>
  );
}

// ============================================================
// Page
// ============================================================

export default function MortgageRatesLessonPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
      <LessonSection title="Step 2 — Mortgage Rates Follow">
        <Suspense fallback={<LoadingCard />}>
          <MortgageRateSection />
        </Suspense>
      </LessonSection>

      <LessonSection title="Step 3 — Buyers React">
        <BuyerReactionSection />
      </LessonSection>

      <LessonCompleteButton moduleSlug="housing-machine" lessonSlug="mortgage-rates" />
    </main>
  );
}
