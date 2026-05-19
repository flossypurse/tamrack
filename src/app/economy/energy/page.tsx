import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import { ChartCard } from "@/components/chart-card";
import { computeTimeRange } from "@/lib/time-range";
import { SITE_URL } from "@/lib/constants/site";

export const metadata: Metadata = {
  title: "Alberta Energy Data — Oil, Gas & Commodities",
  description: "Real-time Alberta energy data including BCPI energy index, oil prices, CAD/USD exchange rate, and natural gas commodity trends.",
  alternates: {
    canonical: `${SITE_URL}/economy/energy`,
  },
};
import {
  TimeSeriesAreaChart,
  TimeSeriesBarChart,
  MultiSeriesLineChart,
  type MultiSeriesPoint,
} from "@/components/chart";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import {
  Flame,
  TrendingUp,
  BarChart3,
  Droplets,
  Factory,
  DollarSign,
} from "lucide-react";
import {
  fetchBoCTimeSeries,
  fetchBoCObservations,
  fetchStatCanTimeSeries,
  BOC_SERIES,
  STATSCAN_SERIES,
  type TimeSeriesPoint,
} from "@/lib/data-sources";

// ============================================================
// Server-side data fetching
// ============================================================

async function getEnergyMetrics() {
  const [energyIndex, allCommodities, cadUsd, oilGasGdp] = await Promise.all([
    fetchBoCObservations(BOC_SERIES.BCPI_ENERGY, 2).catch(() => null),
    fetchBoCObservations(BOC_SERIES.BCPI_ALL, 2).catch(() => null),
    fetchBoCObservations(BOC_SERIES.CAD_USD, 2).catch(() => null),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_GDP_MINING_OIL_GAS.tableId,
      STATSCAN_SERIES.AB_GDP_MINING_OIL_GAS.coordinate,
      2
    ).catch(() => []),
  ]);

  const energyLatest =
    energyIndex?.observations?.at(-1)?.[BOC_SERIES.BCPI_ENERGY]?.v;
  const energyPrev =
    energyIndex?.observations?.at(-2)?.[BOC_SERIES.BCPI_ENERGY]?.v;
  const energyChange =
    energyLatest && energyPrev
      ? ((parseFloat(energyLatest) - parseFloat(energyPrev)) / parseFloat(energyPrev) * 100).toFixed(1)
      : null;

  const allLatest =
    allCommodities?.observations?.at(-1)?.[BOC_SERIES.BCPI_ALL]?.v;

  const cadLatest =
    cadUsd?.observations?.at(-1)?.[BOC_SERIES.CAD_USD]?.v;
  const cadPrev =
    cadUsd?.observations?.at(-2)?.[BOC_SERIES.CAD_USD]?.v;
  const cadChange =
    cadLatest && cadPrev
      ? ((parseFloat(cadLatest) - parseFloat(cadPrev)) * 100).toFixed(2)
      : null;

  const gdpLatest = oilGasGdp.at(-1);
  const gdpPrev = oilGasGdp.at(-2);
  const gdpChange =
    gdpLatest && gdpPrev
      ? ((gdpLatest.value - gdpPrev.value) / gdpPrev.value * 100).toFixed(1)
      : null;

  return {
    energyIndex: energyLatest ? parseFloat(energyLatest).toFixed(1) : "—",
    energyChange: energyChange
      ? `${parseFloat(energyChange) >= 0 ? "+" : ""}${energyChange}%`
      : undefined,
    allCommodities: allLatest ? parseFloat(allLatest).toFixed(1) : "—",
    cadUsd: cadLatest ? `$${parseFloat(cadLatest).toFixed(4)}` : "—",
    cadChange: cadChange
      ? `${parseFloat(cadChange) >= 0 ? "+" : ""}${cadChange}¢`
      : undefined,
    oilGasGdp: gdpLatest
      ? `$${(gdpLatest.value / 1_000).toFixed(1)}B`
      : "—",
    gdpChange: gdpChange
      ? `${parseFloat(gdpChange) >= 0 ? "+" : ""}${gdpChange}%`
      : undefined,
  };
}

// ============================================================
// Dashboard sections
// ============================================================

async function EnergyMetrics() {
  const m = await getEnergyMetrics();
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Energy Commodity Index"
        value={m.energyIndex}
        change={m.energyChange}
        changeLabel="vs prev"
        source="BoC BCPI Energy"
      />
      <MetricCard
        title="All Commodities Index"
        value={m.allCommodities}
        source="BoC BCPI"
      />
      <MetricCard
        title="CAD/USD"
        value={m.cadUsd}
        change={m.cadChange}
        changeLabel="vs prev day"
        source="Bank of Canada"
      />
      <MetricCard
        title="Mining/Oil/Gas GDP"
        value={m.oilGasGdp}
        change={m.gdpChange}
        changeLabel="vs prev period"
        source="StatsCan 36-10-0402"
      />
    </div>
  );
}

async function EnergyPriceChart() {
  const data = await fetchBoCTimeSeries(BOC_SERIES.BCPI_ENERGY, 240);
  const timeRange = computeTimeRange(data);
  return (
    <ChartCard chartId="macro-energy-price" title="BoC Energy Commodity Price Index" timeRange={timeRange} source="Bank of Canada BCPI">
      <Card>
        <CardHeader
          title="BoC Energy Commodity Price Index"
          subtitle="The master signal for Alberta's economy — tracks crude, natural gas, coal"
          badge="LIVE"
        />
        <TimeSeriesAreaChart data={data} color="#f97316" height={280} />
        <p className="text-[10px] text-muted/60 mt-2">
          When this falls below ~300, expect drilling slowdowns within weeks and layoffs within months.
        </p>
      </Card>
    </ChartCard>
  );
}

async function AllCommoditiesChart() {
  const data = await fetchBoCTimeSeries(BOC_SERIES.BCPI_ALL, 240);
  const timeRange = computeTimeRange(data);
  return (
    <ChartCard chartId="macro-all-commodities" title="BoC All Commodities Index" timeRange={timeRange} source="Bank of Canada BCPI">
      <Card>
        <CardHeader
          title="BoC All Commodities Index"
          subtitle="Broad commodity basket — energy + agriculture + metals + forestry"
          badge="LIVE"
        />
        <TimeSeriesAreaChart data={data} color="#3b82f6" />
      </Card>
    </ChartCard>
  );
}

async function EnergyVsCadChart() {
  const [energy, cad] = await Promise.all([
    fetchBoCTimeSeries(BOC_SERIES.BCPI_ENERGY, 120),
    fetchBoCTimeSeries(BOC_SERIES.CAD_USD, 120),
  ]);

  // Merge by date
  const dateMap = new Map<string, MultiSeriesPoint>();
  for (const p of energy) {
    dateMap.set(p.date, { date: p.date, energy: p.value, cad: 0 });
  }
  for (const p of cad) {
    const existing = dateMap.get(p.date);
    if (existing) {
      existing.cad = p.value;
    }
  }
  const merged = Array.from(dateMap.values())
    .filter((p) => p.energy && p.cad)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const timeRange = computeTimeRange(merged);

  return (
    <ChartCard chartId="macro-energy-vs-cad" title="Energy Price vs CAD/USD" timeRange={timeRange} source="Bank of Canada">
      <Card>
        <CardHeader
          title="Energy Price vs CAD/USD"
          subtitle="The petro-dollar correlation — when energy falls, so does the loonie"
          badge="LIVE"
        />
        <MultiSeriesLineChart
          data={merged}
          series={[
            { key: "energy", label: "Energy Index", color: "#f97316", yAxisId: "left" },
            { key: "cad", label: "CAD/USD", color: "#10b981", prefix: "$", yAxisId: "right" },
          ]}
          height={280}
          dualAxis
        />
      </Card>
    </ChartCard>
  );
}

async function NonEnergyChart() {
  const data = await fetchBoCTimeSeries(BOC_SERIES.BCPI_NON_ENERGY, 120);
  const timeRange = computeTimeRange(data);
  return (
    <ChartCard chartId="macro-non-energy" title="Non-Energy Commodity Index" timeRange={timeRange} source="Bank of Canada BCPI">
      <Card>
        <CardHeader
          title="Non-Energy Commodity Index"
          subtitle="Agriculture, metals, forestry, fish — the diversification signal"
          badge="LIVE"
        />
        <TimeSeriesAreaChart data={data} color="#10b981" />
      </Card>
    </ChartCard>
  );
}

async function OilGasGdpChart() {
  const { tableId, coordinate } = STATSCAN_SERIES.AB_GDP_MINING_OIL_GAS;
  const data = await fetchStatCanTimeSeries(tableId, coordinate, 40);
  const timeRange = computeTimeRange(data);
  return (
    <ChartCard chartId="macro-oil-gas-gdp" title="Alberta Mining/Oil & Gas GDP" timeRange={timeRange} source="StatsCan 36-10-0402">
      <Card>
        <CardHeader
          title="Alberta Mining/Oil & Gas GDP"
          subtitle="Real GDP — mining, quarrying, oil & gas extraction (chained 2017$)"
          badge="LIVE"
        />
        <TimeSeriesAreaChart data={data} color="#f59e0b" compact />
      </Card>
    </ChartCard>
  );
}

async function ConstructionGdpChart() {
  const { tableId, coordinate } = STATSCAN_SERIES.AB_GDP_CONSTRUCTION;
  const data = await fetchStatCanTimeSeries(tableId, coordinate, 40);
  const timeRange = computeTimeRange(data);
  return (
    <ChartCard chartId="macro-construction-gdp" title="Alberta Construction GDP" timeRange={timeRange} source="StatsCan 36-10-0402">
      <Card>
        <CardHeader
          title="Alberta Construction GDP"
          subtitle="Real GDP — construction sector (chained 2017$)"
          badge="LIVE"
        />
        <TimeSeriesAreaChart data={data} color="#06b6d4" compact />
      </Card>
    </ChartCard>
  );
}

async function CadUsdChart() {
  const data = await fetchBoCTimeSeries(BOC_SERIES.CAD_USD, 240);
  const timeRange = computeTimeRange(data);
  return (
    <ChartCard chartId="macro-cad-usd" title="CAD/USD Exchange Rate" timeRange={timeRange} source="Bank of Canada">
      <Card>
        <CardHeader
          title="CAD/USD Exchange Rate"
          subtitle="The petro-dollar — heavily correlated with oil prices"
          badge="LIVE"
        />
        <TimeSeriesAreaChart data={data} color="#10b981" valuePrefix="$" />
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
// Page
// ============================================================

export default function EnergyPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="The Engine Room"
        description="Energy drives Alberta. When oil moves, everything else follows — jobs, migration, housing, government revenue. This page tracks the upstream signals."
        category="economy"
        icon={<Flame size={20} />}
      />

      {/* Key Metrics */}
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
          <EnergyMetrics />
        </Suspense>
      </section>

      {/* Hero chart: Energy Price Index */}
      <section>
        <SectionHeader title="The Master Signal" icon={<TrendingUp size={16} />} category="economy" />
        <Suspense fallback={<LoadingCard />}>
          <EnergyPriceChart />
        </Suspense>
      </section>

      {/* Correlation */}
      <section>
        <SectionHeader title="The Petro-Dollar Connection" icon={<DollarSign size={16} />} category="economy" />
        <Suspense fallback={<LoadingCard />}>
          <EnergyVsCadChart />
        </Suspense>
      </section>

      {/* Commodity breakdown */}
      <section>
        <SectionHeader title="Commodity Breakdown" icon={<BarChart3 size={16} />} category="economy" />
        <div className="grid md:grid-cols-2 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <AllCommoditiesChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <NonEnergyChart />
          </Suspense>
        </div>
      </section>

      {/* GDP by sector */}
      <section>
        <SectionHeader title="Industry GDP" icon={<Factory size={16} />} category="economy" />
        <div className="grid md:grid-cols-2 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <OilGasGdpChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <ConstructionGdpChart />
          </Suspense>
        </div>
      </section>

      {/* Exchange rate */}
      <section>
        <SectionHeader title="Currency" icon={<Droplets size={16} />} category="economy" />
        <Suspense fallback={<LoadingCard />}>
          <CadUsdChart />
        </Suspense>
      </section>

      {/* Context: What's not here yet */}
      <section>
        <Card>
          <h3 className="text-sm font-medium mb-2">Coming Soon</h3>
          <div className="grid sm:grid-cols-2 gap-3 text-xs text-muted">
            <div className="flex items-start gap-2">
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
                PLANNED
              </span>
              <div>
                <p className="font-medium text-foreground">AER Well Licences</p>
                <p>Daily well licence data from the Alberta Energy Regulator (ST1). File-based — no API, requires scheduled downloads.</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
                PLANNED
              </span>
              <div>
                <p className="font-medium text-foreground">Petrinex Production</p>
                <p>Monthly oil & gas production volumetrics by well and facility. CSV downloads from Petrinex public data.</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
                PLANNED
              </span>
              <div>
                <p className="font-medium text-foreground">Rig Count</p>
                <p>Weekly active drilling rig count — the leading indicator of production intent.</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
                PLANNED
              </span>
              <div>
                <p className="font-medium text-foreground">Pipeline Capacity</p>
                <p>CER pipeline throughput data — shows whether Alberta can get its product to market.</p>
              </div>
            </div>
          </div>
        </Card>
      </section>
    </main>
  );
}
