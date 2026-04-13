import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import { ChartCard } from "@/components/chart-card";
import { computeTimeRange } from "@/lib/time-range";
import {
  TimeSeriesBarChart,
  TimeSeriesAreaChart,
  MultiSeriesLineChart,
  type MultiSeriesPoint,
} from "@/components/chart";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import {
  Building2,
  TrendingUp,
  TrendingDown,
  ArrowUpDown,
  MapPin,
  BarChart3,
  Store,
} from "lucide-react";
import {
  fetchBusinessDynamics,
  fetchRetailBusinessDynamics,
  fetchFoodBusinessDynamics,
  fetchEdmontonLicencesByCategory,
  fetchEdmontonLicencesByNeighbourhood,
  fetchEdmontonLicenceMonthlyTrend,
} from "@/lib/data-sources-retail";

export const metadata: Metadata = {
  title: "Alberta Business Dynamics — Openings, Closures & Licences",
  description:
    "Track business openings and closures across Alberta — monthly dynamics for all industries, retail trade, and food services. Plus Edmonton business licence data by category and neighbourhood.",
};

// ============================================================
// Data fetching
// ============================================================

async function getBusinessMetrics() {
  const [allBiz, retailBiz, foodBiz] = await Promise.all([
    fetchBusinessDynamics(14).catch(() => []),
    fetchRetailBusinessDynamics(14).catch(() => []),
    fetchFoodBusinessDynamics(14).catch(() => []),
  ]);

  const latest = allBiz.at(-1) ?? null;
  const prev = allBiz.at(-2) ?? null;

  const latestRetail = retailBiz.at(-1) ?? null;
  const latestFood = foodBiz.at(-1) ?? null;

  const netChange = latest
    ? (latest.openings ?? 0) - (latest.closures ?? 0)
    : null;
  const prevNet = prev
    ? (prev.openings ?? 0) - (prev.closures ?? 0)
    : null;

  return {
    activeBusinesses: latest?.active
      ? `${(latest.active / 1_000).toFixed(0)}K`
      : "—",
    monthlyOpenings: latest?.openings != null
      ? latest.openings.toLocaleString()
      : "—",
    monthlyClosures: latest?.closures != null
      ? latest.closures.toLocaleString()
      : "—",
    netChange: netChange !== null
      ? `${netChange >= 0 ? "+" : ""}${netChange.toLocaleString()}`
      : "—",
    netTrend: netChange !== null && prevNet !== null
      ? netChange > prevNet ? "improving" : netChange < prevNet ? "declining" : "stable"
      : undefined,
    retailActive: latestRetail?.active != null
      ? latestRetail.active.toLocaleString()
      : "—",
    foodActive: latestFood?.active != null
      ? latestFood.active.toLocaleString()
      : "—",
  };
}

// ============================================================
// Sections
// ============================================================

async function BusinessMetrics() {
  const m = await getBusinessMetrics();
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Active Businesses"
        value={m.activeBusinesses}
        changeLabel="all industries, Alberta"
        source="StatsCan 33-10-0270"
      />
      <MetricCard
        title="Monthly Openings"
        value={m.monthlyOpenings}
        changeLabel="new businesses"
        source="StatsCan 33-10-0270"
      />
      <MetricCard
        title="Monthly Closures"
        value={m.monthlyClosures}
        changeLabel="business exits"
        source="StatsCan 33-10-0270"
      />
      <MetricCard
        title="Net Change"
        value={m.netChange}
        changeLabel={m.netTrend ?? "openings minus closures"}
        source="StatsCan 33-10-0270"
      />
    </div>
  );
}

async function AllIndustryDynamicsChart() {
  const data = await fetchBusinessDynamics(60);
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader title="Business Dynamics" subtitle="Data unavailable" />
        <p className="text-xs text-muted">Unable to load business dynamics data.</p>
      </Card>
    );
  }

  const multiData: MultiSeriesPoint[] = data.map((p) => ({
    date: p.date,
    openings: p.openings,
    closures: p.closures,
  }));

  const series = [
    { key: "openings", label: "Openings", color: "#22c55e" },
    { key: "closures", label: "Closures", color: "#ef4444" },
  ];

  const timeRange = computeTimeRange(data.map((p) => ({ date: p.date, value: p.active })));
  return (
    <ChartCard
      chartId="economy-biz-all-dynamics"
      title="Business Openings & Closures — Alberta (All Industries)"
      timeRange={timeRange}
      source="StatsCan 33-10-0270"
    >
      <Card>
        <CardHeader
          title="Business Openings vs Closures"
          subtitle="Monthly business births and deaths, all industries"
          badge="LIVE"
        />
        <MultiSeriesLineChart data={multiData} series={series} height={280} />
        <p className="text-[10px] text-muted/60 mt-2">
          When the green line (openings) is above the red line (closures), the province is adding
          businesses faster than losing them — a sign of economic expansion.
        </p>
      </Card>
    </ChartCard>
  );
}

async function ActiveBusinessChart() {
  const data = await fetchBusinessDynamics(60);
  if (data.length === 0) return null;

  const activeData = data.map((p) => ({
    date: p.date,
    value: p.active / 1_000,
  }));

  const timeRange = computeTimeRange(activeData);
  return (
    <ChartCard
      chartId="economy-biz-active-count"
      title="Active Business Count — Alberta"
      timeRange={timeRange}
      source="StatsCan 33-10-0270"
    >
      <Card>
        <CardHeader
          title="Active Business Count"
          subtitle="Total active businesses across all industries (thousands)"
          badge="LIVE"
        />
        <TimeSeriesAreaChart data={activeData} color="#3b82f6" height={250} valueSuffix="K" />
      </Card>
    </ChartCard>
  );
}

async function RetailDynamicsChart() {
  const data = await fetchRetailBusinessDynamics(60);
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader title="Retail Business Dynamics" subtitle="Data unavailable" />
        <p className="text-xs text-muted">Unable to load retail business dynamics.</p>
      </Card>
    );
  }

  const multiData: MultiSeriesPoint[] = data.map((p) => ({
    date: p.date,
    openings: p.openings,
    closures: p.closures,
  }));

  const series = [
    { key: "openings", label: "Retail Openings", color: "#22c55e" },
    { key: "closures", label: "Retail Closures", color: "#ef4444" },
  ];

  const timeRange = computeTimeRange(data.map((p) => ({ date: p.date, value: p.active })));
  return (
    <ChartCard
      chartId="economy-biz-retail-dynamics"
      title="Retail Trade — Business Openings & Closures"
      timeRange={timeRange}
      source="StatsCan 33-10-0270"
    >
      <Card>
        <CardHeader
          title="Retail Trade Openings vs Closures"
          subtitle="Monthly retail business births and deaths (NAICS 44-45)"
          badge="LIVE"
        />
        <MultiSeriesLineChart data={multiData} series={series} height={280} />
        <p className="text-[10px] text-muted/60 mt-2">
          Retail trade (NAICS 44-45) includes everything from car dealerships and grocery stores
          to clothing shops and e-commerce sellers.
        </p>
      </Card>
    </ChartCard>
  );
}

async function FoodDynamicsChart() {
  const data = await fetchFoodBusinessDynamics(60);
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader title="Food Services Dynamics" subtitle="Data unavailable" />
        <p className="text-xs text-muted">Unable to load food services business dynamics.</p>
      </Card>
    );
  }

  const multiData: MultiSeriesPoint[] = data.map((p) => ({
    date: p.date,
    openings: p.openings,
    closures: p.closures,
  }));

  const series = [
    { key: "openings", label: "Food Svc Openings", color: "#22c55e" },
    { key: "closures", label: "Food Svc Closures", color: "#ef4444" },
  ];

  const timeRange = computeTimeRange(data.map((p) => ({ date: p.date, value: p.active })));
  return (
    <ChartCard
      chartId="economy-biz-food-dynamics"
      title="Food Services — Business Openings & Closures"
      timeRange={timeRange}
      source="StatsCan 33-10-0270"
    >
      <Card>
        <CardHeader
          title="Food Services Openings vs Closures"
          subtitle="Monthly food services & accommodation business births and deaths"
          badge="LIVE"
        />
        <MultiSeriesLineChart data={multiData} series={series} height={280} />
        <p className="text-[10px] text-muted/60 mt-2">
          Restaurant and food services businesses are among the most volatile sectors — high
          opening rates but also high closure rates, reflecting thin margins and competition.
        </p>
      </Card>
    </ChartCard>
  );
}

async function EdmontonLicenceCategoryChart() {
  const data = await fetchEdmontonLicencesByCategory();
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader title="Edmonton Business Licences by Category" subtitle="Data unavailable" />
        <p className="text-xs text-muted">Unable to load Edmonton licence data.</p>
      </Card>
    );
  }

  // Show top 15 categories as horizontal bar data
  const top15 = data.slice(0, 15);
  return (
    <Card>
      <CardHeader
        title="Edmonton Business Licences by Category"
        subtitle="Top 15 licence categories (active licences)"
        badge="LIVE"
      />
      <div className="space-y-1.5 mt-2">
        {top15.map((item, i) => {
          const maxCount = top15[0].count;
          const pct = (item.count / maxCount) * 100;
          return (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-44 truncate text-muted shrink-0" title={item.category}>
                {item.category}
              </span>
              <div className="flex-1 bg-card-border/30 rounded-full h-4 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500/70"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-14 text-right text-muted shrink-0">
                {item.count.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-muted/60 mt-3">
        Source: City of Edmonton Open Data — Business Licences (qhi4-bdpu)
      </p>
    </Card>
  );
}

async function EdmontonLicenceNeighbourhoodChart() {
  const data = await fetchEdmontonLicencesByNeighbourhood();
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader title="Licences by Neighbourhood" subtitle="Data unavailable" />
        <p className="text-xs text-muted">Unable to load neighbourhood data.</p>
      </Card>
    );
  }

  const top15 = data.slice(0, 15);
  return (
    <Card>
      <CardHeader
        title="Edmonton Licences by Neighbourhood"
        subtitle="Top 15 neighbourhoods by active business licences"
        badge="LIVE"
      />
      <div className="space-y-1.5 mt-2">
        {top15.map((item, i) => {
          const maxCount = top15[0].count;
          const pct = (item.count / maxCount) * 100;
          return (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-44 truncate text-muted shrink-0" title={item.neighbourhood}>
                {item.neighbourhood}
              </span>
              <div className="flex-1 bg-card-border/30 rounded-full h-4 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500/70"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-14 text-right text-muted shrink-0">
                {item.count.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-muted/60 mt-3">
        Source: City of Edmonton Open Data — Business Licences (qhi4-bdpu)
      </p>
    </Card>
  );
}

async function EdmontonLicenceTrendChart() {
  const data = await fetchEdmontonLicenceMonthlyTrend();
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader title="Licence Issuance Trend" subtitle="Data unavailable" />
        <p className="text-xs text-muted">Unable to load licence trend data.</p>
      </Card>
    );
  }

  const timeRange = computeTimeRange(data);
  return (
    <ChartCard
      chartId="economy-biz-edmonton-licence-trend"
      title="Edmonton Business Licence Issuance Trend"
      timeRange={timeRange}
      source="Edmonton Open Data (qhi4-bdpu)"
    >
      <Card>
        <CardHeader
          title="Monthly Business Licence Issuances — Edmonton"
          subtitle="New business licences issued per month (since 2020)"
          badge="LIVE"
        />
        <TimeSeriesBarChart data={data} color="#22c55e" compact height={250} />
        <p className="text-[10px] text-muted/60 mt-2">
          Monthly count of new business licences issued by the City of Edmonton. Seasonal
          patterns are common — spring and summer tend to see higher issuance.
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

function BusinessContext() {
  return (
    <Card>
      <h3 className="text-sm font-medium mb-3">Understanding Business Dynamics</h3>
      <div className="space-y-3 text-xs text-muted">
        <p>
          Business openings and closures are experimental data from Statistics Canada that
          track the &quot;birth&quot; and &quot;death&quot; of businesses monthly. Unlike GDP or employment
          data, this tells you whether the province is creating new enterprises faster than
          losing them — a direct measure of entrepreneurial health.
        </p>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="border border-card-border rounded-lg p-3">
            <p className="font-medium text-foreground mb-1">Data Sources</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>StatsCan 33-10-0270 (business dynamics)</li>
              <li>Edmonton Open Data (business licences)</li>
              <li>Monthly, seasonally adjusted</li>
              <li>Experimental series (subject to revision)</li>
            </ul>
          </div>
          <div className="border border-card-border rounded-lg p-3">
            <p className="font-medium text-foreground mb-1">What &quot;Openings&quot; Means</p>
            <p>
              A business &quot;opening&quot; in StatsCan data means a new payroll deductions account —
              a business that started paying employees. It does not count sole proprietors
              or contractors without employees. The bar is higher than business registration.
            </p>
          </div>
          <div className="border border-card-border rounded-lg p-3">
            <p className="font-medium text-foreground mb-1">Edmonton Licences</p>
            <p>
              Edmonton&apos;s business licence registry is a separate municipal dataset showing
              all active licences by category and neighbourhood. This is a broader measure
              than StatsCan — it includes sole proprietors, home-based businesses, and contractors.
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

export default function BusinessesPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Business Dynamics"
        description="Track business openings, closures, and net creation across Alberta — broken down by retail trade, food services, and all industries. Plus Edmonton business licence data."
        category="economy"
        icon={<Building2 size={20} />}
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
          <BusinessMetrics />
        </Suspense>
      </section>

      {/* All Industry Dynamics */}
      <section>
        <SectionHeader
          title="All Industries"
          icon={<ArrowUpDown size={16} />}
          category="economy"
        />
        <div className="grid lg:grid-cols-2 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <AllIndustryDynamicsChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <ActiveBusinessChart />
          </Suspense>
        </div>
      </section>

      {/* Sector Breakdown */}
      <section>
        <SectionHeader
          title="Sector Breakdown"
          icon={<Store size={16} />}
          category="economy"
        />
        <div className="grid lg:grid-cols-2 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <RetailDynamicsChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <FoodDynamicsChart />
          </Suspense>
        </div>
      </section>

      {/* Edmonton Business Licences */}
      <section>
        <SectionHeader
          title="Edmonton Business Licences"
          icon={<MapPin size={16} />}
          category="economy"
        />
        <div className="grid lg:grid-cols-2 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <EdmontonLicenceCategoryChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <EdmontonLicenceNeighbourhoodChart />
          </Suspense>
        </div>
        <div className="mt-4">
          <Suspense fallback={<LoadingCard />}>
            <EdmontonLicenceTrendChart />
          </Suspense>
        </div>
      </section>

      {/* Context */}
      <section>
        <BusinessContext />
      </section>
    </main>
  );
}
