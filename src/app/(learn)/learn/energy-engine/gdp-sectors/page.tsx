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
  fetchStatCanTimeSeries,
  STATSCAN_SERIES,
  type TimeSeriesPoint,
} from "@/lib/data-sources";
import {
  Prose,
  Insight,
  LessonSection,
} from "@/components/learn-lesson";
import { LessonCompleteButton } from "@/components/learn-lesson-complete";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "GDP by Sector — The Energy Engine",
  description:
    "How deep does energy go in Alberta's economy? Sector GDP data from StatsCan.",
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
// GDP Section
// ============================================================

async function GDPSection() {
  const [gdpTotal, gdpOilGas, gdpConstruction, gdpTech, gdpRealEstate, gdpAgriculture] =
    await Promise.all([
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
        STATSCAN_SERIES.AB_GDP_CONSTRUCTION.tableId,
        STATSCAN_SERIES.AB_GDP_CONSTRUCTION.coordinate,
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
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_GDP_AGRICULTURE.tableId,
        STATSCAN_SERIES.AB_GDP_AGRICULTURE.coordinate,
        120
      ).catch(() => []),
    ]);

  // Build multi-series data by aligning on date
  const dateMap = new Map<
    string,
    {
      total?: number;
      oilGas?: number;
      construction?: number;
      tech?: number;
      realEstate?: number;
      agriculture?: number;
    }
  >();

  const addSeries = (data: TimeSeriesPoint[], key: string) => {
    for (const p of data) {
      const d = p.date.slice(0, 7);
      const existing = dateMap.get(d) || {};
      (existing as Record<string, number>)[key] = p.value;
      dateMap.set(d, existing);
    }
  };

  addSeries(gdpOilGas, "oilGas");
  addSeries(gdpConstruction, "construction");
  addSeries(gdpTech, "tech");
  addSeries(gdpRealEstate, "realEstate");
  addSeries(gdpAgriculture, "agriculture");

  const gdpData: MultiSeriesPoint[] = [...dateMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date: `${date}-01`,
      oilGas: v.oilGas ?? 0,
      construction: v.construction ?? 0,
      tech: v.tech ?? 0,
      realEstate: v.realEstate ?? 0,
      agriculture: v.agriculture ?? 0,
    }));

  const gdpSeries: SeriesConfig[] = [
    { key: "oilGas", label: "Mining, Oil & Gas", color: "#f97316" },
    { key: "construction", label: "Construction", color: "#eab308" },
    { key: "realEstate", label: "Real Estate", color: "#3b82f6" },
    { key: "tech", label: "Tech & Information", color: "#10b981" },
    { key: "agriculture", label: "Agriculture", color: "#84cc16" },
  ];

  const timeRange = computeTimeRange(gdpTotal);

  // Calculate oil/gas share of total GDP
  const latestTotal = gdpTotal.at(-1)?.value ?? 0;
  const latestOilGas = gdpOilGas.at(-1)?.value ?? 0;
  const oilGasShare =
    latestTotal > 0 ? ((latestOilGas / latestTotal) * 100).toFixed(1) : "—";

  return (
    <div className="space-y-4">
      <Prose>
        <p>
          Mining, oil, and gas extraction is the single largest sector in
          Alberta&apos;s GDP — roughly {oilGasShare}% of provincial output
          in the most recent data. But the real story isn&apos;t the direct
          percentage. It&apos;s the <strong>multiplier effect</strong>.
        </p>
        <p>
          When an oil company invests $1 billion in a new project, that money
          cascades. Construction firms get contracts. Engineering companies hire.
          Restaurants near work camps fill up. Real estate agents sell houses to
          relocated workers. For every $1 of oil GDP, roughly $2.50 circulates
          through the broader Alberta economy.
        </p>
      </Prose>

      <Card>
        <CardHeader
          title="Alberta GDP by Sector"
          subtitle="Monthly GDP at basic prices ($M) — key sectors compared"
          badge="LIVE"
          freshness="daily"
        />
        <ChartCard
          chartId="learn-energy-gdp-sectors"
          title="Alberta GDP by Sector"
          timeRange={timeRange}
          source="StatsCan 36-10-0402"
        >
          <MultiSeriesLineChart
            data={gdpData}
            series={gdpSeries}
            height={300}
          />
        </ChartCard>
      </Card>

      <Prose>
        <p>
          Watch the sector lines carefully during downturns. When oil and gas
          GDP drops, construction follows within 6 to 12 months — because
          fewer projects mean fewer cranes. Then real estate softens 12 to 18
          months after that — because fewer jobs mean fewer buyers and more
          people leaving the province.
        </p>
        <p>
          The chart makes this cascade visible. Look at 2015-2016: oil GDP
          collapses, construction follows a few quarters later, then real estate
          flattens out. The same pattern played out in 2020. These aren&apos;t
          coincidences — they&apos;re the gears of Alberta&apos;s economic
          machine.
        </p>
      </Prose>

      <Insight>
        For every $1 of oil GDP, approximately $2.50 circulates through the
        Alberta economy. That multiplier is why an oil price drop
        doesn&apos;t just hurt oil companies — it ripples through construction,
        services, retail, and housing.
      </Insight>
    </div>
  );
}

// ============================================================
// Page
// ============================================================

export default function GDPSectorsLessonPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
      <LessonSection title="GDP — How Deep Does Energy Go?">
        <Suspense fallback={<LoadingCard />}>
          <GDPSection />
        </Suspense>
      </LessonSection>

      <LessonCompleteButton moduleSlug="energy-engine" lessonSlug="gdp-sectors" />
    </main>
  );
}
