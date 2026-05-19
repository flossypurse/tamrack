import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader } from "@/components/card";
import {
  TimeSeriesAreaChart,
} from "@/components/chart";
import { ChartCard } from "@/components/chart-card";
import { computeTimeRange } from "@/lib/time-range";
import {
  fetchBoCTimeSeries,
  fetchStatCanTimeSeries,
  fetchEdmontonBusinessLicences,
  BOC_SERIES,
  STATSCAN_SERIES,
  type TimeSeriesPoint,
} from "@/lib/data-sources";
import {
  Prose,
  BigQuestion,
  LiveDataPoint,
  DataGrid,
  Insight,
  Expandable,
  LessonSection,
  SoWhat,
} from "@/components/learn-lesson";
import {
  TrendingUp,
  Eye,
  Activity,
  Timer,
} from "lucide-react";
import { LessonCompleteButton } from "@/components/learn-lesson-complete";

// ============================================================
// Metadata
// ============================================================

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leading vs Lagging — Reading the Signals — Pulse Learn",
  description:
    "Learn the difference between leading, coincident, and lagging indicators. The three speeds of economic data and why knowing which is which changes everything.",
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
// Live data section: examples of each speed
// ============================================================

async function ThreeSpeedsLiveData() {
  const [policyRate, unemployment, licences] = await Promise.all([
    fetchBoCTimeSeries(BOC_SERIES.POLICY_RATE, 24).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.tableId,
      STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.coordinate,
      24
    ).catch(() => []),
    fetchEdmontonBusinessLicences().catch(() => []),
  ]);

  return (
    <DataGrid>
      <LiveDataPoint
        label="BoC Rate (Leading)"
        value={`${latest(policyRate).toFixed(2)}%`}
        direction={direction(policyRate)}
        change={pctChange(policyRate)}
        source="Bank of Canada"
      />
      <LiveDataPoint
        label="Biz Licences (Leading)"
        value={latest(licences).toLocaleString()}
        direction={direction(licences)}
        change={pctChange(licences)}
        source="Edmonton Open Data"
      />
      <LiveDataPoint
        label="Unemployment (Lagging)"
        value={`${latest(unemployment).toFixed(1)}%`}
        direction={direction(unemployment)}
        change={pctChange(unemployment)}
        source="StatsCan"
      />
    </DataGrid>
  );
}

// ============================================================
// Page
// ============================================================

export default function LeadingLaggingPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
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
      {/* The Three Speeds */}
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
      {/* Live data comparison */}
      {/* ============================================================ */}

      <LessonSection title="See It in the Live Data">
        <Prose>
          <p>
            Here are three indicators right now — one leading, one leading, and
            one lagging. Notice how they can point in different directions at the
            same time. That divergence is information. When leading indicators
            turn but lagging indicators have not caught up, you are seeing the
            future before it arrives.
          </p>
        </Prose>

        <Suspense fallback={<LoadingCard />}>
          <ThreeSpeedsLiveData />
        </Suspense>
      </LessonSection>

      {/* ============================================================ */}
      {/* Why this matters */}
      {/* ============================================================ */}

      <LessonSection title="Why This Matters for You">
        <Prose>
          <p>
            If you are buying a house, leading indicators (permits, starts,
            interest rates) tell you whether supply is growing or shrinking —
            and whether prices are likely to rise or fall 12-18 months from now.
            If you are starting a business, business licence trends and energy
            prices tell you whether the economy is heading into a boom or a
            bust. If you are job hunting, permits and business formation are the
            earliest signals of future hiring.
          </p>
          <p>
            In every case, the value is the same: you see the turn before the
            lagging indicators confirm it. By the time the news reports the
            trend, the leading indicators moved months ago.
          </p>
        </Prose>

        <Expandable title="What about 'coincident' indicators — are they useful?">
          <Prose>
            <p>
              Coincident indicators like employment level and retail sales tell
              you exactly where the economy is right now. They are useful as a
              baseline — a reality check. If leading indicators say the economy
              is turning but coincident indicators have not budged, the turn may
              be early-stage. If coincident indicators are already moving in the
              same direction as leading indicators, the shift is accelerating.
              Coincident indicators are your &ldquo;ground truth&rdquo; while
              leading indicators are your forecast.
            </p>
          </Prose>
        </Expandable>
      </LessonSection>

      <SoWhat>
        Every indicator on this dashboard is either leading, coincident, or
        lagging. Now that you know the difference, you will never read economic
        data the same way again. Always ask: &ldquo;Is this telling me where
        we have been, where we are, or where we are going?&rdquo;
      </SoWhat>

      <LessonCompleteButton moduleSlug="reading-signals" lessonSlug="leading-lagging" />

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Tamrack &mdash; Reading the Signals &mdash; All data from
        free public APIs
      </footer>
    </main>
  );
}
