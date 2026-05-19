import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader, MetricCard } from "@/components/card";

export const metadata: Metadata = {
  title: "Alberta Economic Dashboard",
  description: "Live macro economic indicators for Alberta — GDP, unemployment, inflation, interest rates, and retail sales updated daily from government sources.",
  alternates: {
    canonical: `${SITE_URL}/home/dashboard`,
  },
};
import { TimeSeriesAreaChart, TimeSeriesBarChart } from "@/components/chart";
import { DataSourceStatus } from "@/components/data-status";
import {
  fetchBoCTimeSeries,
  fetchBoCObservations,
  fetchStatCanTimeSeries,
  BOC_SERIES,
  STATSCAN_SERIES,
} from "@/lib/data-sources";
import { SectionHeader } from "@/components/section-header";
import { TrendingUp, Briefcase, BarChart3, Activity } from "lucide-react";
import { SITE_URL } from "@/lib/constants/site";

// ============================================================
// Server-side data fetching
// ============================================================

async function getKeyMetrics() {
  const [policyRateData, cadUsdData, mortgageData, unemploymentData, populationData, cpiData] = await Promise.all([
    fetchBoCObservations(BOC_SERIES.POLICY_RATE, 1).catch(() => null),
    fetchBoCObservations(BOC_SERIES.CAD_USD, 2).catch(() => null),
    fetchBoCObservations(BOC_SERIES.MORTGAGE_5Y_FIXED, 1).catch(() => null),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.tableId,
      STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.coordinate,
      2
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_POPULATION.tableId,
      STATSCAN_SERIES.AB_POPULATION.coordinate,
      2
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_CPI.tableId,
      STATSCAN_SERIES.AB_CPI.coordinate,
      2
    ).catch(() => []),
  ]);

  const policyRate =
    policyRateData?.observations?.[0]?.[BOC_SERIES.POLICY_RATE]?.v;
  const cadUsdCurrent =
    cadUsdData?.observations?.at(-1)?.[BOC_SERIES.CAD_USD]?.v;
  const cadUsdPrev =
    cadUsdData?.observations?.at(-2)?.[BOC_SERIES.CAD_USD]?.v;
  const mortgage5y =
    mortgageData?.observations?.[0]?.[BOC_SERIES.MORTGAGE_5Y_FIXED]?.v;

  const cadChange =
    cadUsdCurrent && cadUsdPrev
      ? (
          (parseFloat(cadUsdCurrent) - parseFloat(cadUsdPrev)) *
          100
        ).toFixed(2)
      : null;

  const latestUnemployment = unemploymentData.at(-1);
  const prevUnemployment = unemploymentData.at(-2);
  const unemploymentChange = latestUnemployment && prevUnemployment
    ? (latestUnemployment.value - prevUnemployment.value).toFixed(1)
    : null;

  const latestPop = populationData.at(-1);
  const prevPop = populationData.at(-2);
  const popChange = latestPop && prevPop
    ? ((latestPop.value - prevPop.value) / prevPop.value * 100).toFixed(1)
    : null;

  const latestCpi = cpiData.at(-1);
  const prevCpi = cpiData.at(-2);
  const cpiChange = latestCpi && prevCpi
    ? (latestCpi.value - prevCpi.value).toFixed(1)
    : null;

  return {
    policyRate: policyRate ? `${policyRate}%` : "—",
    cadUsd: cadUsdCurrent
      ? `$${parseFloat(cadUsdCurrent).toFixed(4)}`
      : "—",
    cadChange: cadChange
      ? `${parseFloat(cadChange) >= 0 ? "+" : ""}${cadChange}¢`
      : undefined,
    mortgage5y: mortgage5y ? `${mortgage5y}%` : "—",
    unemployment: latestUnemployment ? `${latestUnemployment.value}%` : "—",
    unemploymentChange: unemploymentChange
      ? `${parseFloat(unemploymentChange) >= 0 ? "+" : ""}${unemploymentChange}pp`
      : undefined,
    population: latestPop
      ? `${(latestPop.value / 1_000_000).toFixed(2)}M`
      : "—",
    popChange: popChange
      ? `+${popChange}%`
      : undefined,
    cpi: latestCpi ? `${latestCpi.value}` : "—",
    cpiChange: cpiChange
      ? `${parseFloat(cpiChange) >= 0 ? "+" : ""}${cpiChange}`
      : undefined,
  };
}

// ============================================================
// Dashboard sections
// ============================================================

async function KeyMetrics() {
  const metrics = await getKeyMetrics();

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <MetricCard
        title="BoC Policy Rate"
        value={metrics.policyRate}
        source="Bank of Canada Valet API"
      />
      <MetricCard
        title="CAD/USD"
        value={metrics.cadUsd}
        change={metrics.cadChange}
        changeLabel="vs prev day"
        source="Bank of Canada Valet API"
      />
      <MetricCard
        title="5Y Fixed Mortgage"
        value={metrics.mortgage5y}
        source="Bank of Canada Valet API"
      />
      <MetricCard
        title="AB Unemployment"
        value={metrics.unemployment}
        change={metrics.unemploymentChange}
        changeLabel="vs prev month"
        source="StatsCan 14-10-0287"
      />
      <MetricCard
        title="Alberta Population"
        value={metrics.population}
        change={metrics.popChange}
        changeLabel="YoY"
        source="StatsCan 17-10-0005"
      />
      <MetricCard
        title="Alberta CPI"
        value={metrics.cpi}
        change={metrics.cpiChange}
        changeLabel="vs prev month"
        source="StatsCan 18-10-0004"
      />
    </div>
  );
}

async function InterestRateChart() {
  const data = await fetchBoCTimeSeries(BOC_SERIES.POLICY_RATE, 120);
  return (
    <Card>
      <CardHeader
        title="BoC Policy Interest Rate"
        subtitle="Last 120 observations"
        badge="LIVE"
      />
      <TimeSeriesAreaChart data={data} color="#3b82f6" valueSuffix="%" />
    </Card>
  );
}

async function ExchangeRateChart() {
  const data = await fetchBoCTimeSeries(BOC_SERIES.CAD_USD, 120);
  return (
    <Card>
      <CardHeader
        title="CAD/USD Exchange Rate"
        subtitle="Last 120 observations"
        badge="LIVE"
      />
      <TimeSeriesAreaChart data={data} color="#10b981" valuePrefix="$" />
    </Card>
  );
}

async function MortgageRateChart() {
  const data = await fetchBoCTimeSeries(BOC_SERIES.MORTGAGE_5Y_FIXED, 120);
  return (
    <Card>
      <CardHeader
        title="5-Year Fixed Mortgage Rate"
        subtitle="Posted rate, last 120 observations"
        badge="LIVE"
      />
      <TimeSeriesAreaChart data={data} color="#ef4444" valueSuffix="%" />
    </Card>
  );
}

async function UnemploymentChart() {
  const { tableId, coordinate } = STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE;
  const data = await fetchStatCanTimeSeries(tableId, coordinate, 36);
  return (
    <Card>
      <CardHeader
        title="Alberta Unemployment Rate"
        subtitle="Seasonally adjusted, last 3 years"
        badge="LIVE"
      />
      <TimeSeriesAreaChart data={data} color="#f97316" valueSuffix="%" />
    </Card>
  );
}

async function CpiChart() {
  const { tableId, coordinate } = STATSCAN_SERIES.AB_CPI;
  const data = await fetchStatCanTimeSeries(tableId, coordinate, 36);
  return (
    <Card>
      <CardHeader
        title="Alberta CPI (All Items)"
        subtitle="Index (2002=100), last 3 years"
        badge="LIVE"
      />
      <TimeSeriesAreaChart data={data} color="#a855f7" />
    </Card>
  );
}

async function PopulationChart() {
  const { tableId, coordinate } = STATSCAN_SERIES.AB_POPULATION;
  const data = await fetchStatCanTimeSeries(tableId, coordinate, 20);
  return (
    <Card>
      <CardHeader
        title="Alberta Population"
        subtitle="Annual estimates, last 20 years"
        badge="LIVE"
      />
      <TimeSeriesAreaChart data={data} color="#3b8fdb" compact />
    </Card>
  );
}

async function GdpChart() {
  const { tableId, coordinate } = STATSCAN_SERIES.AB_GDP;
  const data = await fetchStatCanTimeSeries(tableId, coordinate, 24);
  return (
    <Card>
      <CardHeader
        title="Alberta GDP"
        subtitle="Real GDP by province (Table 36-10-0402)"
        badge="LIVE"
      />
      <TimeSeriesAreaChart data={data} color="#10b981" compact />
    </Card>
  );
}

async function RetailSalesChart() {
  const { tableId, coordinate } = STATSCAN_SERIES.AB_RETAIL_SALES;
  const data = await fetchStatCanTimeSeries(tableId, coordinate, 24);
  return (
    <Card>
      <CardHeader
        title="Alberta Retail Sales"
        subtitle="Monthly retail trade (Table 20-10-0008)"
        badge="LIVE"
      />
      <TimeSeriesBarChart data={data} color="#3b82f6" compact />
    </Card>
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
// Page
// ============================================================

export default function Dashboard() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <p className="text-sm text-muted">
          Province-wide Alberta economic intelligence
        </p>
        <DataSourceStatus />
      </header>

      {/* Key Metrics */}
      <section>
        <Suspense
          fallback={
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {[...Array(6)].map((_, i) => (
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
          <KeyMetrics />
        </Suspense>
      </section>

      {/* Section: Monetary & Financial */}
      <section>
        <SectionHeader title="Monetary & Financial" icon={<TrendingUp size={16} />} category="economy" />
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <InterestRateChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <ExchangeRateChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <MortgageRateChart />
          </Suspense>
        </div>
      </section>

      {/* Section: Provincial Economy (StatsCan) */}
      <section>
        <SectionHeader title="Provincial Economy (Alberta)" icon={<BarChart3 size={16} />} category="economy" />
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <UnemploymentChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <CpiChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <PopulationChart />
          </Suspense>
        </div>
      </section>

      {/* Section: Provincial Economy — Deep Dive */}
      <section>
        <SectionHeader title="Provincial Economy — Deep Dive" icon={<Activity size={16} />} category="economy" />
        <div className="grid md:grid-cols-2 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <GdpChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <RetailSalesChart />
          </Suspense>
        </div>
      </section>

      {/* Section: Data Catalog */}
      <section>
        <SectionHeader title="Data Sources Connected" icon={<Briefcase size={16} />} category="economy" />
        <Card>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <DataSourceItem
              name="Bank of Canada Valet API"
              datasets={[
                "Policy rate",
                "CAD/USD",
                "Mortgage rates",
                "CPI measures",
              ]}
              status="live"
            />
            <DataSourceItem
              name="Statistics Canada WDS"
              datasets={[
                "Population",
                "Unemployment rate",
                "CPI",
                "GDP",
                "Retail sales",
              ]}
              status="live"
            />
            <DataSourceItem
              name="Alberta Open Data (CKAN)"
              datasets={[
                "Economic indicators",
                "Energy data",
                "Agriculture",
                "Labour market",
              ]}
              status="live"
            />
            <DataSourceItem
              name="AER / Petrinex"
              datasets={[
                "Well licences",
                "Production volumes",
                "Pipeline data",
              ]}
              status="planned"
            />
            <DataSourceItem
              name="CMHC Housing"
              datasets={[
                "Housing starts",
                "Completions",
                "Under construction",
              ]}
              status="live"
            />
          </div>
        </Card>
      </section>
    </main>
  );
}

function DataSourceItem({
  name,
  datasets,
  status,
}: {
  name: string;
  datasets: string[];
  status: "live" | "ready" | "planned";
}) {
  const statusColors = {
    live: "bg-accent-green",
    ready: "bg-accent",
    planned: "bg-accent-amber",
  };
  const statusLabels = {
    live: "Live",
    ready: "Ready",
    planned: "Planned",
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span
          className={`w-1.5 h-1.5 rounded-full ${statusColors[status]}`}
        />
        <span className="font-medium text-foreground">{name}</span>
        <span className="text-[10px] text-muted font-mono">
          {statusLabels[status]}
        </span>
      </div>
      <div className="flex flex-wrap gap-1 pl-3.5">
        {datasets.map((d) => (
          <span
            key={d}
            className="text-[10px] bg-card-border/50 text-muted px-1.5 py-0.5 rounded"
          >
            {d}
          </span>
        ))}
      </div>
    </div>
  );
}
