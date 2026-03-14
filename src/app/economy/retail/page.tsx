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
  ShoppingCart,
  TrendingUp,
  DollarSign,
  Utensils,
  BarChart3,
  Monitor,
} from "lucide-react";
import {
  fetchStatCanTimeSeries,
  STATSCAN_SERIES,
  type TimeSeriesPoint,
} from "@/lib/data-sources";
import {
  fetchRetailSubsectors,
  fetchEcommerceSales,
  fetchFoodServices,
} from "@/lib/data-sources-retail";

export const metadata: Metadata = {
  title: "Alberta Retail Trade — Sales, E-Commerce & Food Services",
  description:
    "Live retail trade data for Alberta — monthly sales by industry subsector, e-commerce trends, and food services receipts. Data from Statistics Canada.",
};

// ============================================================
// Data fetching
// ============================================================

async function getRetailMetrics() {
  const [totalSales, ecommerce, foodServices] = await Promise.all([
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_RETAIL_SALES.tableId,
      STATSCAN_SERIES.AB_RETAIL_SALES.coordinate,
      14
    ).catch(() => []),
    fetchEcommerceSales(14).catch(() => []),
    fetchFoodServices(14).catch(() => []),
  ]);

  const latest = totalSales.at(-1);
  const prev = totalSales.at(-2);
  const yoyIdx = totalSales.length >= 13 ? totalSales.length - 13 : -1;
  const yoyPrev = yoyIdx >= 0 ? totalSales[yoyIdx] : null;

  const momChange =
    latest && prev
      ? ((latest.value - prev.value) / prev.value * 100).toFixed(1)
      : null;
  const yoyChange =
    latest && yoyPrev
      ? ((latest.value - yoyPrev.value) / yoyPrev.value * 100).toFixed(1)
      : null;

  const latestEcom = ecommerce.at(-1);
  const ecomShare =
    latest && latestEcom && latest.value > 0
      ? ((latestEcom.value / latest.value) * 100).toFixed(1)
      : null;

  const latestFood = foodServices.at(-1);

  return {
    // StatsCan 20-10-0056 reports in $thousands
    monthlySales: latest
      ? `$${(latest.value / 1_000_000).toFixed(1)}B`
      : "—",
    monthlySalesDate: latest?.date ?? "",
    momChange: momChange
      ? `${parseFloat(momChange) >= 0 ? "+" : ""}${momChange}%`
      : undefined,
    yoyChange: yoyChange
      ? `${parseFloat(yoyChange) >= 0 ? "+" : ""}${yoyChange}%`
      : undefined,
    ecomShare: ecomShare ? `${ecomShare}%` : "—",
    ecomMonthlySales: latestEcom
      ? `$${(latestEcom.value / 1_000).toFixed(0)}M`
      : "—",
    foodServicesSales: latestFood
      ? `$${(latestFood.total / 1_000).toFixed(0)}M`
      : "—",
  };
}

// ============================================================
// Sections
// ============================================================

async function RetailMetrics() {
  const m = await getRetailMetrics();
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
        title="E-Commerce Share"
        value={m.ecomShare}
        changeLabel={`${m.ecomMonthlySales}/mo online`}
        source="StatsCan 20-10-0056"
      />
      <MetricCard
        title="Food Services"
        value={m.foodServicesSales}
        changeLabel="monthly receipts"
        source="StatsCan 21-10-0019"
      />
    </div>
  );
}

async function TotalRetailChart() {
  const data = await fetchStatCanTimeSeries(
    STATSCAN_SERIES.AB_RETAIL_SALES.tableId,
    STATSCAN_SERIES.AB_RETAIL_SALES.coordinate,
    84
  );
  // Convert from $thousands to $billions
  const billions = data.map((p) => ({ ...p, value: p.value / 1_000_000 }));
  const timeRange = computeTimeRange(billions);
  return (
    <ChartCard
      chartId="economy-retail-total-sales"
      title="Monthly Retail Sales — Alberta"
      timeRange={timeRange}
      source="StatsCan 20-10-0056"
    >
      <Card>
        <CardHeader
          title="Monthly Retail Sales — Alberta"
          subtitle="Total retail trade, seasonally adjusted ($B)"
          badge="LIVE"
        />
        <TimeSeriesBarChart data={billions} color="#3b82f6" compact height={280} valueSuffix="B" />
        <p className="text-[10px] text-muted/60 mt-2">
          Alberta&apos;s total retail trade across all store types. Seasonally adjusted
          to remove holiday and weather effects.
        </p>
      </Card>
    </ChartCard>
  );
}

async function SubsectorChart() {
  const data = await fetchRetailSubsectors(60);
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader title="Retail Sales by Subsector" subtitle="Data unavailable" />
        <p className="text-xs text-muted">Unable to load retail subsector data.</p>
      </Card>
    );
  }

  // Convert to multi-series format ($thousands → $millions)
  const multiData: MultiSeriesPoint[] = data.map((p) => ({
    date: p.date,
    motorVehicle: p.motorVehicle / 1_000,
    foodBeverage: p.foodBeverage / 1_000,
    gasoline: p.gasoline / 1_000,
    generalMerch: p.generalMerch / 1_000,
    buildingMaterials: p.buildingMaterials / 1_000,
    clothing: p.clothing / 1_000,
  }));

  const series = [
    { key: "motorVehicle", label: "Motor Vehicle & Parts", color: "#3b82f6" },
    { key: "foodBeverage", label: "Food & Beverage", color: "#22c55e" },
    { key: "gasoline", label: "Gasoline Stations", color: "#f59e0b" },
    { key: "generalMerch", label: "General Merchandise", color: "#8b5cf6" },
    { key: "buildingMaterials", label: "Building Materials", color: "#ef4444" },
    { key: "clothing", label: "Clothing & Accessories", color: "#ec4899" },
  ];

  const timeRange = computeTimeRange(data.map((p) => ({ date: p.date, value: p.total })));
  return (
    <ChartCard
      chartId="economy-retail-subsectors"
      title="Retail Sales by Subsector — Alberta"
      timeRange={timeRange}
      source="StatsCan 20-10-0056"
    >
      <Card>
        <CardHeader
          title="Retail Sales by Subsector"
          subtitle="Monthly sales by top retail categories ($M, seasonally adjusted)"
          badge="LIVE"
        />
        <MultiSeriesLineChart data={multiData} series={series} height={320} />
        <p className="text-[10px] text-muted/60 mt-2">
          Motor vehicle dealers typically dominate Alberta retail. Food &amp; beverage and
          gasoline are the other major categories. Building materials track housing construction cycles.
        </p>
      </Card>
    </ChartCard>
  );
}

async function EcommerceChart() {
  const [ecom, total] = await Promise.all([
    fetchEcommerceSales(60).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_RETAIL_SALES.tableId,
      STATSCAN_SERIES.AB_RETAIL_SALES.coordinate,
      60
    ).catch(() => []),
  ]);

  if (ecom.length === 0) {
    return (
      <Card>
        <CardHeader title="E-Commerce Sales" subtitle="Data unavailable" />
        <p className="text-xs text-muted">Unable to load e-commerce data.</p>
      </Card>
    );
  }

  // E-commerce as % of total retail
  const totalMap = new Map(total.map((p) => [p.date, p.value]));
  const shareData: TimeSeriesPoint[] = [];
  for (const p of ecom) {
    const totalVal = totalMap.get(p.date);
    if (totalVal && totalVal > 0) {
      shareData.push({ date: p.date, value: (p.value / totalVal) * 100 });
    }
  }

  const timeRange = computeTimeRange(shareData);
  return (
    <ChartCard
      chartId="economy-retail-ecommerce-share"
      title="E-Commerce as % of Total Retail — Alberta"
      timeRange={timeRange}
      source="StatsCan 20-10-0056"
    >
      <Card>
        <CardHeader
          title="E-Commerce Share of Retail"
          subtitle="Online sales as a percentage of total retail trade (SA)"
          badge="LIVE"
        />
        <TimeSeriesAreaChart data={shareData} color="#8b5cf6" height={250} valueSuffix="%" />
        <p className="text-[10px] text-muted/60 mt-2">
          E-commerce penetration spiked during COVID-19 lockdowns and has settled at a new
          baseline above pre-pandemic levels.
        </p>
      </Card>
    </ChartCard>
  );
}

async function EcommerceSalesChart() {
  const ecom = await fetchEcommerceSales(60).catch(() => []);
  if (ecom.length === 0) return null;

  // $thousands → $millions
  const millions = ecom.map((p) => ({ ...p, value: p.value / 1_000 }));
  const timeRange = computeTimeRange(millions);
  return (
    <ChartCard
      chartId="economy-retail-ecommerce-sales"
      title="Monthly E-Commerce Sales — Alberta"
      timeRange={timeRange}
      source="StatsCan 20-10-0056"
    >
      <Card>
        <CardHeader
          title="Monthly E-Commerce Sales"
          subtitle="Online retail sales ($M, seasonally adjusted)"
          badge="LIVE"
        />
        <TimeSeriesBarChart data={millions} color="#8b5cf6" compact height={250} valueSuffix="M" />
      </Card>
    </ChartCard>
  );
}

async function FoodServicesChart() {
  const data = await fetchFoodServices(60);
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader title="Food Services Receipts" subtitle="Data unavailable" />
        <p className="text-xs text-muted">Unable to load food services data.</p>
      </Card>
    );
  }

  // Convert to multi-series ($thousands → $millions)
  const multiData: MultiSeriesPoint[] = data.map((p) => ({
    date: p.date,
    fullService: p.fullService / 1_000,
    limitedService: p.limitedService / 1_000,
    drinking: p.drinking / 1_000,
  }));

  const series = [
    { key: "fullService", label: "Full-Service Restaurants", color: "#22c55e" },
    { key: "limitedService", label: "Fast Food / Limited-Service", color: "#f59e0b" },
    { key: "drinking", label: "Drinking Places", color: "#ef4444" },
  ];

  const timeRange = computeTimeRange(data.map((p) => ({ date: p.date, value: p.total })));
  return (
    <ChartCard
      chartId="economy-retail-food-services"
      title="Food Services Receipts by Type — Alberta"
      timeRange={timeRange}
      source="StatsCan 21-10-0019"
    >
      <Card>
        <CardHeader
          title="Food Services & Drinking Places"
          subtitle="Monthly receipts by restaurant type ($M)"
          badge="LIVE"
        />
        <MultiSeriesLineChart data={multiData} series={series} height={280} />
        <p className="text-[10px] text-muted/60 mt-2">
          Full-service restaurants lead Alberta food services revenue, with fast food / limited-service
          close behind. Drinking places (bars, pubs) are a smaller but culturally significant segment.
        </p>
      </Card>
    </ChartCard>
  );
}

async function FoodServicesTotalChart() {
  const data = await fetchFoodServices(60);
  if (data.length === 0) return null;

  const totalSeries = data.map((p) => ({ date: p.date, value: p.total / 1_000 }));
  const timeRange = computeTimeRange(totalSeries);
  return (
    <ChartCard
      chartId="economy-retail-food-services-total"
      title="Total Food Services Revenue — Alberta"
      timeRange={timeRange}
      source="StatsCan 21-10-0019"
    >
      <Card>
        <CardHeader
          title="Total Food Services Revenue"
          subtitle="All food services & drinking places ($M/month)"
          badge="LIVE"
        />
        <TimeSeriesAreaChart data={totalSeries} color="#22c55e" height={250} valueSuffix="M" />
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

function RetailContext() {
  return (
    <Card>
      <h3 className="text-sm font-medium mb-3">Alberta Retail Landscape</h3>
      <div className="space-y-3 text-xs text-muted">
        <p>
          Alberta&apos;s retail sector generates over $8B/month in sales, driven by a young,
          high-income population and strong consumer spending. The province&apos;s retail mix
          reflects its resource economy — motor vehicle dealers and gasoline stations punch above
          national averages, while e-commerce penetration trails major urban centers like Ontario and BC.
        </p>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="border border-card-border rounded-lg p-3">
            <p className="font-medium text-foreground mb-1">Data Sources</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>StatsCan Table 20-10-0056 (retail trade)</li>
              <li>StatsCan Table 21-10-0019 (food services)</li>
              <li>Monthly, seasonally adjusted</li>
              <li>~6 week lag from reference period</li>
            </ul>
          </div>
          <div className="border border-card-border rounded-lg p-3">
            <p className="font-medium text-foreground mb-1">Key Subsectors</p>
            <p>
              Motor vehicles &amp; parts dealers are the largest retail category by sales volume.
              Food &amp; beverage stores and gasoline stations round out the top three.
              General merchandise (Walmart, Costco) is a close fourth.
            </p>
          </div>
          <div className="border border-card-border rounded-lg p-3">
            <p className="font-medium text-foreground mb-1">What to Watch</p>
            <p>
              Retail sales are a leading indicator of consumer confidence. Spikes in gasoline
              spending can signal oil price pass-through. E-commerce share trends reveal
              structural shifts in how Albertans shop.
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

export default function RetailPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Retail Trade"
        description="Alberta's retail economy — $8B+/month across all store types. Monthly sales by subsector, e-commerce trends, and food services receipts from Statistics Canada."
        category="economy"
        icon={<ShoppingCart size={20} />}
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
          <RetailMetrics />
        </Suspense>
      </section>

      {/* Total Retail Sales */}
      <section>
        <SectionHeader
          title="Total Retail Sales"
          icon={<DollarSign size={16} />}
          category="economy"
        />
        <Suspense fallback={<LoadingCard />}>
          <TotalRetailChart />
        </Suspense>
      </section>

      {/* Sales by Subsector */}
      <section>
        <SectionHeader
          title="Sales by Subsector"
          icon={<BarChart3 size={16} />}
          category="economy"
        />
        <Suspense fallback={<LoadingCard />}>
          <SubsectorChart />
        </Suspense>
      </section>

      {/* E-Commerce */}
      <section>
        <SectionHeader
          title="E-Commerce"
          icon={<Monitor size={16} />}
          category="economy"
        />
        <div className="grid lg:grid-cols-2 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <EcommerceChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <EcommerceSalesChart />
          </Suspense>
        </div>
      </section>

      {/* Food Services */}
      <section>
        <SectionHeader
          title="Food Services & Drinking Places"
          icon={<Utensils size={16} />}
          category="economy"
        />
        <div className="grid lg:grid-cols-2 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <FoodServicesTotalChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <FoodServicesChart />
          </Suspense>
        </div>
      </section>

      {/* Context */}
      <section>
        <RetailContext />
      </section>

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Alberta Pulse Check &mdash; Retail Trade &mdash; All data from free public APIs
      </footer>
    </main>
  );
}
