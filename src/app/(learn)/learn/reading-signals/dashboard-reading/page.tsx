import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader } from "@/components/card";
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
  title: "Reading the Dashboard — Reading the Signals — Pulse Learn",
  description:
    "Put it all together: live data organized by speed. Leading, coincident, and lagging indicators side by side. Common traps and how to avoid them.",
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

// ============================================================
// Live Dashboard Reading
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
    <LessonSection title="Your Personal Dashboard Reading">
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
// Page
// ============================================================

export default function DashboardReadingPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
      <BigQuestion>How do I read this dashboard like an economist?</BigQuestion>

      <Prose>
        <p>
          You now know the three speeds and the chain reactions. This lesson puts
          it all together with live data — and warns you about the three traps
          that trip up even experienced data readers.
        </p>
      </Prose>

      {/* Live Dashboard Reading */}
      <Suspense fallback={<LoadingCard />}>
        <DashboardReadingSection />
      </Suspense>

      {/* ============================================================ */}
      {/* Common Traps */}
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

      <SoWhat>
        The single most valuable skill on this dashboard: check leading
        indicators first, then ask &ldquo;has the lagging data caught up
        yet?&rdquo; The gap between them is where the opportunity lives. When
        leading indicators turn up but lagging indicators are still falling,
        most people panic. When leading indicators turn down but lagging
        indicators are still rising, most people are complacent. Now you know
        better.
      </SoWhat>

      <LessonCompleteButton moduleSlug="reading-signals" lessonSlug="dashboard-reading" />

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Alberta Pulse Check &mdash; Reading the Dashboard &mdash; All data from
        free public APIs
      </footer>
    </main>
  );
}
