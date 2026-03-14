import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import { ChartCard } from "@/components/chart-card";
import { computeTimeRange } from "@/lib/time-range";
import {
  TimeSeriesAreaChart,
  TimeSeriesBarChart,
  MultiSeriesLineChart,
  type MultiSeriesPoint,
} from "@/components/chart";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import {
  Cannabis,
  TrendingUp,
  BarChart3,
  DollarSign,
  Store,
  Package,
} from "lucide-react";
import {
  fetchStatCanTimeSeries,
  STATSCAN_SERIES,
  type TimeSeriesPoint,
} from "@/lib/data-sources";
import {
  fetchCannabisProductQuarterly,
  fetchAglcRetailerCount,
} from "@/lib/data-sources-cannabis";

export const metadata: Metadata = {
  title: "Alberta Cannabis Industry — Retail Sales & Market Data",
  description:
    "Live cannabis retail sales data for Alberta — monthly revenue, year-over-year growth, market share of total retail. Data from Statistics Canada.",
};

// ============================================================
// Data fetching
// ============================================================

async function getCannabisMetrics() {
  const [cannabisSales, totalRetail, aglcCount] = await Promise.all([
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_CANNABIS_RETAIL_SALES.tableId,
      STATSCAN_SERIES.AB_CANNABIS_RETAIL_SALES.coordinate,
      14
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_RETAIL_SALES.tableId,
      STATSCAN_SERIES.AB_RETAIL_SALES.coordinate,
      14
    ).catch(() => []),
    fetchAglcRetailerCount().catch(() => 0),
  ]);

  const latest = cannabisSales.at(-1);
  const prev = cannabisSales.at(-2);

  // YoY: compare latest to 12 months prior
  const yoyIndex = cannabisSales.length >= 13 ? cannabisSales.length - 13 : -1;
  const yoyPrev = yoyIndex >= 0 ? cannabisSales[yoyIndex] : null;

  const momChange =
    latest && prev
      ? ((latest.value - prev.value) / prev.value * 100).toFixed(1)
      : null;

  const yoyChange =
    latest && yoyPrev
      ? ((latest.value - yoyPrev.value) / yoyPrev.value * 100).toFixed(1)
      : null;

  // Cannabis as % of total retail
  const latestRetail = totalRetail.at(-1);
  const retailShare =
    latest && latestRetail && latestRetail.value > 0
      ? ((latest.value / latestRetail.value) * 100).toFixed(2)
      : null;

  return {
    // StatsCan 20-10-0056 reports in $thousands (scalarFactorCode=3)
    monthlySales: latest
      ? `$${(latest.value / 1_000).toFixed(0)}M`
      : "—",
    monthlySalesDate: latest?.date ?? "",
    momChange: momChange
      ? `${parseFloat(momChange) >= 0 ? "+" : ""}${momChange}%`
      : undefined,
    yoyChange: yoyChange
      ? `${parseFloat(yoyChange) >= 0 ? "+" : ""}${yoyChange}%`
      : undefined,
    retailShare: retailShare ? `${retailShare}%` : "—",
    retailerCount: aglcCount > 0 ? `${aglcCount.toLocaleString()}` : "944+",
  };
}

// ============================================================
// Sections
// ============================================================

async function CannabisMetrics() {
  const m = await getCannabisMetrics();
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Monthly Retail Sales"
        value={m.monthlySales}
        change={m.momChange}
        changeLabel="vs prev month"
        source="StatsCan 20-10-0056"
      />
      <MetricCard
        title="Year-over-Year"
        value={m.yoyChange ?? "—"}
        changeLabel="vs same month last year"
        source="StatsCan 20-10-0056"
      />
      <MetricCard
        title="% of Total Retail"
        value={m.retailShare}
        changeLabel="cannabis share of AB retail"
        source="StatsCan 20-10-0056"
      />
      <MetricCard
        title="AGLC Retailers"
        value={m.retailerCount}
        changeLabel="licensed cannabis stores"
        source="AGLC Licensee Registry"
      />
    </div>
  );
}

async function MonthlySalesChart() {
  const data = await fetchStatCanTimeSeries(
    STATSCAN_SERIES.AB_CANNABIS_RETAIL_SALES.tableId,
    STATSCAN_SERIES.AB_CANNABIS_RETAIL_SALES.coordinate,
    84 // ~7 years — cannabis legalized Oct 2018
  );
  // Convert from $thousands to $millions for readability
  const millions = data.map((p) => ({ ...p, value: p.value / 1_000 }));
  const timeRange = computeTimeRange(millions);
  return (
    <ChartCard
      chartId="economy-cannabis-monthly-sales"
      title="Monthly Cannabis Retail Sales — Alberta"
      timeRange={timeRange}
      source="StatsCan 20-10-0056"
    >
      <Card>
        <CardHeader
          title="Monthly Cannabis Retail Sales — Alberta"
          subtitle="Total retail sales from licensed cannabis retailers ($M, unadjusted)"
          badge="LIVE"
        />
        <TimeSeriesBarChart data={millions} color="#22c55e" compact height={280} valueSuffix="M" />
        <p className="text-[10px] text-muted/60 mt-2">
          Cannabis was legalized federally on October 17, 2018. Alberta was among the first
          provinces with private retail — the market ramped quickly and now generates ~$1B+/year in retail sales.
        </p>
      </Card>
    </ChartCard>
  );
}

async function SalesTrendChart() {
  const data = await fetchStatCanTimeSeries(
    STATSCAN_SERIES.AB_CANNABIS_RETAIL_SALES.tableId,
    STATSCAN_SERIES.AB_CANNABIS_RETAIL_SALES.coordinate,
    84
  );
  const millions = data.map((p) => ({ ...p, value: p.value / 1_000 }));
  const timeRange = computeTimeRange(millions);
  return (
    <ChartCard
      chartId="economy-cannabis-sales-trend"
      title="Cannabis Sales Trend — Alberta"
      timeRange={timeRange}
      source="StatsCan 20-10-0056"
    >
      <Card>
        <CardHeader
          title="Cannabis Sales Trend — Alberta"
          subtitle="Area chart showing cumulative growth trajectory since legalization"
          badge="LIVE"
        />
        <TimeSeriesAreaChart data={millions} color="#22c55e" height={250} valueSuffix="M" />
      </Card>
    </ChartCard>
  );
}

async function CannabisVsRetailChart() {
  const [cannabis, total] = await Promise.all([
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_CANNABIS_RETAIL_SALES.tableId,
      STATSCAN_SERIES.AB_CANNABIS_RETAIL_SALES.coordinate,
      84
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_RETAIL_SALES.tableId,
      STATSCAN_SERIES.AB_RETAIL_SALES.coordinate,
      84
    ).catch(() => []),
  ]);

  // Compute cannabis as % of total retail over time
  const totalMap = new Map(total.map((p) => [p.date, p.value]));
  const shareData: TimeSeriesPoint[] = [];
  for (const p of cannabis) {
    const totalVal = totalMap.get(p.date);
    if (totalVal && totalVal > 0) {
      shareData.push({ date: p.date, value: (p.value / totalVal) * 100 });
    }
  }

  const timeRange = computeTimeRange(shareData);
  return (
    <ChartCard
      chartId="economy-cannabis-retail-share"
      title="Cannabis as % of Total Retail Sales"
      timeRange={timeRange}
      source="StatsCan 20-10-0056"
    >
      <Card>
        <CardHeader
          title="Cannabis Share of Alberta Retail"
          subtitle="Cannabis retail sales as a percentage of total provincial retail trade"
          badge="LIVE"
        />
        <TimeSeriesAreaChart data={shareData} color="#a855f7" height={250} valueSuffix="%" />
        <p className="text-[10px] text-muted/60 mt-2">
          Cannabis has grown from 0% to a consistent ~1% of Alberta&apos;s total retail trade
          within a few years of legalization — a new billion-dollar sector created from scratch.
        </p>
      </Card>
    </ChartCard>
  );
}

async function ProductTypeChart() {
  const data = await fetchCannabisProductQuarterly();
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader
          title="Sales by Product Type — Canada"
          subtitle="Health Canada data unavailable"
        />
        <p className="text-xs text-muted">Unable to load Health Canada cannabis market data.</p>
      </Card>
    );
  }
  const series = [
    { key: "driedFlower", label: "Dried Flower", color: "#22c55e" },
    { key: "edibles", label: "Edibles", color: "#f59e0b" },
    { key: "extracts", label: "Extracts", color: "#8b5cf6" },
    { key: "topicals", label: "Topicals", color: "#ec4899" },
  ];
  return (
    <ChartCard
      chartId="economy-cannabis-product-type"
      title="Cannabis Sales by Product Type — Canada"
      source="Health Canada Open Data"
    >
      <Card>
        <CardHeader
          title="Sales by Product Type — Canada"
          subtitle="Quarterly non-medical sales by category (millions of units, national)"
          badge="LIVE"
        />
        <MultiSeriesLineChart data={data} series={series} height={280} />
        <p className="text-[10px] text-muted/60 mt-2">
          National data from Health Canada. Dried flower dominates but edibles and extracts
          have grown steadily since their legal introduction in late 2019.
        </p>
      </Card>
    </ChartCard>
  );
}

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
// Context
// ============================================================

function CannabisContext() {
  return (
    <Card>
      <h3 className="text-sm font-medium mb-3">Alberta&apos;s Cannabis Market</h3>
      <div className="space-y-3 text-xs text-muted">
        <p>
          Alberta was the first province to allow fully private cannabis retail when legalization
          hit on October 17, 2018. That head start, combined with a libertarian regulatory approach,
          made Alberta the most competitive cannabis retail market in Canada with 944+ licensed stores.
        </p>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="border border-card-border rounded-lg p-3">
            <p className="font-medium text-foreground mb-1">Regulatory Model</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Private retail (AGLC-licensed)</li>
              <li>No store cap — market-driven</li>
              <li>Online sales permitted</li>
              <li>AGLC is sole wholesaler</li>
              <li>Municipal opt-out available</li>
            </ul>
          </div>
          <div className="border border-card-border rounded-lg p-3">
            <p className="font-medium text-foreground mb-1">Market Scale</p>
            <p>
              Alberta generates ~$1B+/year in cannabis retail sales from 944+ stores,
              making it one of Canada&apos;s largest provincial markets by store count.
              Per-capita cannabis spending is among the highest nationally. The sector
              employs thousands across retail, distribution, and cultivation.
            </p>
          </div>
          <div className="border border-card-border rounded-lg p-3">
            <p className="font-medium text-foreground mb-1">Key Dynamics</p>
            <p>
              Oversaturation of retail locations is the main challenge — many stores compete
              for thin margins. Consolidation is ongoing as smaller operators exit. The illicit
              market share continues to shrink as legal prices fall and product variety improves.
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ============================================================
// Page
// ============================================================

export default function CannabisPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Cannabis Industry"
        description="Alberta's cannabis retail market — $1B+/year from 944+ licensed stores. Live monthly sales data from Statistics Canada since legalization in October 2018."
        category="economy"
        icon={<Cannabis size={20} />}
      />

      {/* Metrics */}
      <section>
        <Suspense
          fallback={
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i}>
                  <div className="animate-pulse space-y-2">
                    <div className="h-3 bg-card-border rounded w-1/2" />
                    <div className="h-7 bg-card-border rounded w-2/3" />
                  </div>
                </Card>
              ))}
            </div>
          }
        >
          <CannabisMetrics />
        </Suspense>
      </section>

      {/* Hero: Monthly Sales */}
      <section>
        <SectionHeader
          title="Monthly Retail Sales"
          icon={<DollarSign size={16} />}
          category="economy"
        />
        <Suspense fallback={<LoadingCard />}>
          <MonthlySalesChart />
        </Suspense>
      </section>

      {/* Growth Trend */}
      <section>
        <SectionHeader
          title="Growth Trajectory"
          icon={<TrendingUp size={16} />}
          category="economy"
        />
        <div className="grid lg:grid-cols-2 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <SalesTrendChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <CannabisVsRetailChart />
          </Suspense>
        </div>
      </section>

      {/* Product Type Breakdown */}
      <section>
        <SectionHeader
          title="Sales by Product Type"
          icon={<Package size={16} />}
          category="economy"
        />
        <Suspense fallback={<LoadingCard />}>
          <ProductTypeChart />
        </Suspense>
      </section>

      {/* Context */}
      <section>
        <CannabisContext />
      </section>

      {/* Coming Soon */}
      <section>
        <Card>
          <h3 className="text-sm font-medium mb-2">Coming Soon</h3>
          <div className="text-xs text-muted">
            <div className="flex items-start gap-2">
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
                PLANNED
              </span>
              <div>
                <p className="font-medium text-foreground">Store Density Map</p>
                <p>
                  AGLC licensee data mapped by municipality — see which areas are
                  oversaturated and where gaps remain.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </section>

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Alberta Pulse Check &mdash; Cannabis Industry &mdash; All data from free
        public APIs
      </footer>
    </main>
  );
}
