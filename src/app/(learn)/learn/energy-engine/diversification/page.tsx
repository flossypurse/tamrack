import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader } from "@/components/card";
import {
  MultiSeriesLineChart,
  type MultiSeriesPoint,
  type SeriesConfig,
} from "@/components/chart";
import { ChartCard } from "@/components/chart-card";
import { computeTimeRange } from "@/lib/time-range";
import {
  fetchBoCTimeSeries,
  fetchStatCanTimeSeries,
  BOC_SERIES,
  STATSCAN_SERIES,
  type TimeSeriesPoint,
} from "@/lib/data-sources";
import {
  Prose,
  LiveDataPoint,
  DataGrid,
  Insight,
  LessonSection,
  SoWhat,
} from "@/components/learn-lesson";
import { LessonCompleteButton } from "@/components/learn-lesson-complete";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The Diversification Question — The Energy Engine — Pulse Learn",
  description:
    "Is Alberta actually diversifying? Sector GDP shares over time, traced with live data.",
};

// ============================================================
// Helper: compute direction from recent data
// ============================================================

function computeDirection(
  data: TimeSeriesPoint[],
  months = 3
): { direction: "up" | "down" | "flat"; latest: number; change: string } {
  if (data.length < months * 2)
    return { direction: "flat", latest: data.at(-1)?.value ?? 0, change: "" };
  const recent =
    data.slice(-months).reduce((s, p) => s + p.value, 0) / months;
  const prior =
    data.slice(-months * 2, -months).reduce((s, p) => s + p.value, 0) / months;
  if (prior === 0)
    return { direction: "flat", latest: data.at(-1)?.value ?? 0, change: "" };
  const pct = ((recent - prior) / Math.abs(prior)) * 100;
  return {
    direction: pct > 2 ? "up" : pct < -2 ? "down" : "flat",
    latest: data.at(-1)?.value ?? 0,
    change: `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`,
  };
}

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
// Diversification Section
// ============================================================

async function DiversificationSection() {
  const [gdpTotal, gdpOilGas, gdpTech, gdpRealEstate] = await Promise.all([
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_GDP.tableId,
      STATSCAN_SERIES.AB_GDP.coordinate,
      120
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_GDP_MINING_OIL_GAS.tableId,
      STATSCAN_SERIES.AB_GDP_MINING_OIL_GAS.coordinate,
      120
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_GDP_TECH.tableId,
      STATSCAN_SERIES.AB_GDP_TECH.coordinate,
      120
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_GDP_REAL_ESTATE.tableId,
      STATSCAN_SERIES.AB_GDP_REAL_ESTATE.coordinate,
      120
    ).catch(() => []),
  ]);

  // Compute share of total GDP for each sector over time
  const dateMap = new Map<
    string,
    { total?: number; oilGas?: number; tech?: number; realEstate?: number }
  >();

  for (const p of gdpTotal) {
    const key = p.date.slice(0, 7);
    const existing = dateMap.get(key) || {};
    existing.total = p.value;
    dateMap.set(key, existing);
  }
  for (const p of gdpOilGas) {
    const key = p.date.slice(0, 7);
    const existing = dateMap.get(key) || {};
    existing.oilGas = p.value;
    dateMap.set(key, existing);
  }
  for (const p of gdpTech) {
    const key = p.date.slice(0, 7);
    const existing = dateMap.get(key) || {};
    existing.tech = p.value;
    dateMap.set(key, existing);
  }
  for (const p of gdpRealEstate) {
    const key = p.date.slice(0, 7);
    const existing = dateMap.get(key) || {};
    existing.realEstate = p.value;
    dateMap.set(key, existing);
  }

  const shareData: MultiSeriesPoint[] = [...dateMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([, v]) => v.total && v.total > 0)
    .map(([date, v]) => ({
      date: `${date}-01`,
      oilGasShare: v.total ? ((v.oilGas ?? 0) / v.total) * 100 : 0,
      techShare: v.total ? ((v.tech ?? 0) / v.total) * 100 : 0,
      realEstateShare: v.total ? ((v.realEstate ?? 0) / v.total) * 100 : 0,
    }));

  const shareSeries: SeriesConfig[] = [
    {
      key: "oilGasShare",
      label: "Mining, Oil & Gas %",
      color: "#f97316",
      suffix: "%",
    },
    {
      key: "realEstateShare",
      label: "Real Estate %",
      color: "#3b82f6",
      suffix: "%",
    },
    {
      key: "techShare",
      label: "Tech & Information %",
      color: "#10b981",
      suffix: "%",
    },
  ];

  const timeRange = computeTimeRange(gdpTotal);
  const techTrend = computeDirection(gdpTech);

  // Fetch latest energy for the closing SoWhat
  const energyIndex = await fetchBoCTimeSeries(BOC_SERIES.BCPI_ENERGY, 12).catch(
    () => []
  );
  const trend = computeDirection(energyIndex, 3);
  const trendDescription =
    trend.direction === "up"
      ? "energy prices are trending UP — expect employment strength, migration inflows, and housing pressure in the coming months"
      : trend.direction === "down"
      ? "energy prices are trending DOWN — watch for slowing capital investment, potential layoffs in the oil patch, and housing market softening 6-12 months out"
      : "energy prices are relatively flat — the economy is in a holding pattern, but watch for the next move";

  return (
    <div className="space-y-4">
      <Prose>
        <p>
          &ldquo;Alberta needs to diversify.&rdquo; You&apos;ve heard it a
          thousand times. But is it actually happening? The data says: yes, but
          slowly. Diversification is a decades-long process, not a policy
          announcement.
        </p>
        <p>
          The chart below shows each sector&apos;s share of total Alberta GDP
          over time. Oil and gas still dominates, but watch the green line —
          tech and information services have been growing steadily, even during
          energy downturns. During the brutal 2015-2016 oil crash, when
          oil and gas GDP contracted sharply, tech GDP actually kept growing.
          That&apos;s the definition of diversification: sectors that move
          independently of energy.
        </p>
      </Prose>

      <Card>
        <CardHeader
          title="Sector Share of Alberta GDP"
          subtitle="How the economic pie is shifting over time"
          badge="LIVE"
          freshness="daily"
        />
        <ChartCard
          chartId="learn-energy-diversification"
          title="AB GDP Sector Shares"
          timeRange={timeRange}
          source="StatsCan 36-10-0402"
        >
          <MultiSeriesLineChart
            data={shareData}
            series={shareSeries}
            height={280}
          />
        </ChartCard>
      </Card>

      <DataGrid>
        <LiveDataPoint
          label="Tech GDP Trend"
          value={`$${(techTrend.latest / 1000).toFixed(1)}B`}
          change={techTrend.change}
          direction={techTrend.direction}
          source="StatsCan"
        />
      </DataGrid>

      <Prose>
        <p>
          Real estate&apos;s growing share is partly organic and partly a
          reflection of urbanization — more people living in Edmonton and
          Calgary means more housing transactions, more construction, more
          property management. Tech&apos;s growth reflects deliberate policy
          choices (incentives for AI, gaming, fintech companies to locate in
          Alberta) and market forces (lower cost of living than Vancouver or
          Toronto attracting talent).
        </p>
      </Prose>

      <Insight variant="lever">
        <strong>Policy lever:</strong> Government incentives for tech companies
        to locate in Alberta — tax credits, innovation grants, streamlined
        immigration for tech workers.{" "}
        <strong>Community lever:</strong> Entrepreneurship and retraining
        programs that help displaced energy workers transition into growing
        sectors. Both take years to show up in GDP — but the compounding
        is real.
      </Insight>

      {/* Closing SoWhat for the entire Energy Engine module */}
      <SoWhat>
        <p>
          The energy-jobs-migration-housing chain takes 6 to 18 months to
          play out fully. Right now, {trendDescription}.
        </p>
        <p className="mt-2">
          Watch the BCPI Energy chart — it is 6 months ahead of everything
          else on this dashboard. When it moves, start watching the downstream
          indicators: unemployment, migration, building permits, housing prices.
          They will follow. They always do.
        </p>
      </SoWhat>
    </div>
  );
}

// ============================================================
// Page
// ============================================================

export default function DiversificationLessonPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
      <LessonSection title="The Diversification Question">
        <Suspense fallback={<LoadingCard />}>
          <DiversificationSection />
        </Suspense>
      </LessonSection>

      <LessonCompleteButton moduleSlug="energy-engine" lessonSlug="diversification" />
    </main>
  );
}
