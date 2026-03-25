import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader } from "@/components/card";
import { TimeSeriesAreaChart } from "@/components/chart";
import { ChartCard } from "@/components/chart-card";
import { computeTimeRange } from "@/lib/time-range";
import {
  fetchBoCTimeSeries,
  BOC_SERIES,
} from "@/lib/data-sources";
import {
  Prose,
  BigQuestion,
  ChainStep,
  LiveDataPoint,
  DataGrid,
  Insight,
  LessonSection,
} from "@/components/learn-lesson";
import { LessonCompleteButton } from "@/components/learn-lesson-complete";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The Price of Money — The Housing Machine — Pulse Learn",
  description:
    "How the BoC policy rate sets everything in motion. Live data from Bank of Canada.",
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
// Policy Rate Section
// ============================================================

async function PolicyRateSection() {
  const data = await fetchBoCTimeSeries(BOC_SERIES.POLICY_RATE, 240).catch(() => []);
  const latest = data.at(-1);
  const timeRange = computeTimeRange(data);

  const prevYear = data.length > 12 ? data[data.length - 13] : null;
  const direction =
    latest && prevYear
      ? latest.value > prevYear.value
        ? "up" as const
        : latest.value < prevYear.value
        ? "down" as const
        : "flat" as const
      : undefined;
  const change =
    latest && prevYear
      ? `${(latest.value - prevYear.value) > 0 ? "+" : ""}${(latest.value - prevYear.value).toFixed(2)}% vs 1yr ago`
      : undefined;

  return (
    <div className="space-y-4">
      <ChainStep
        number={1}
        title="The overnight rate"
        description="Eight times a year, the Bank of Canada announces its policy interest rate — the rate at which big banks lend to each other overnight. This single number is the starting domino for the entire housing machine."
      />

      <Prose>
        <p>
          Think of the policy rate as the wholesale price of money. When the BoC
          raises it, borrowing gets more expensive for everyone — banks, businesses,
          and you. When they cut it, money gets cheaper, and people borrow more.
        </p>
        <p>
          The chart below shows 20 years of this rate. Notice the dramatic swings:
          near-zero during COVID, then the fastest hiking cycle in a generation.
          Every peak and valley here ripples through the entire housing market — it
          just takes time to show up.
        </p>
      </Prose>

      <Card>
        <CardHeader title="BoC Policy Rate — 20 Year History" freshness="daily" />
        <ChartCard
          chartId="learn-housing-policy-rate"
          title="BoC Policy Rate"
          timeRange={timeRange}
          source="Bank of Canada"
        >
          <TimeSeriesAreaChart data={data} color="#3b82f6" height={220} valueSuffix="%" />
        </ChartCard>
      </Card>

      <Insight>
        This one number affects every single mortgage in Canada. When it moves by
        even a quarter point, billions of dollars shift between borrowers and
        lenders. It is the most powerful lever in Canadian housing.
      </Insight>

      {latest && (
        <DataGrid>
          <LiveDataPoint
            label="Current Policy Rate"
            value={`${latest.value.toFixed(2)}%`}
            direction={direction}
            change={change}
            source="Bank of Canada"
          />
        </DataGrid>
      )}
    </div>
  );
}

// ============================================================
// Page
// ============================================================

export default function PolicyRateLessonPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
      <BigQuestion>Why did my rent go up?</BigQuestion>

      <Prose>
        <p>
          It is one of the most common questions in Alberta — and the answer is
          not &quot;because landlords are greedy&quot; (though some are). The real
          answer involves a chain of cause and effect that starts in Ottawa, runs
          through bond markets and bank boardrooms, flows into construction sites
          and permitting offices, and takes 2-3 years to fully play out before
          landing on your kitchen table as a rent increase notice.
        </p>
        <p>
          This lesson traces that chain, starting with the most powerful lever in
          Canadian housing: the Bank of Canada&apos;s policy rate.
        </p>
      </Prose>

      <LessonSection title="Step 1 — The Bank of Canada Sets the Price of Money">
        <Suspense fallback={<LoadingCard />}>
          <PolicyRateSection />
        </Suspense>
      </LessonSection>

      <LessonCompleteButton moduleSlug="housing-machine" lessonSlug="policy-rate" />
    </main>
  );
}
