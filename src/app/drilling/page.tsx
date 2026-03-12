import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader, MetricCard } from "@/components/card";

export const metadata: Metadata = {
  title: "Alberta Drilling & Well Activity",
  description: "AER well licence data, drilling activity trends, oil and gas production volumes, and oilfield service activity across Alberta.",
};
import {
  TimeSeriesAreaChart,
  MultiSeriesLineChart,
  type MultiSeriesPoint,
} from "@/components/chart";
import { Flame, TrendingUp, BarChart3, Factory, DollarSign } from "lucide-react";
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

async function getDrillingMetrics() {
  const [energyIndex, oilGasGdp, constructionGdp, cadUsd] = await Promise.all([
    fetchBoCObservations(BOC_SERIES.BCPI_ENERGY, 2).catch(() => null),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_GDP_MINING_OIL_GAS.tableId,
      STATSCAN_SERIES.AB_GDP_MINING_OIL_GAS.coordinate,
      2
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_GDP_CONSTRUCTION.tableId,
      STATSCAN_SERIES.AB_GDP_CONSTRUCTION.coordinate,
      2
    ).catch(() => []),
    fetchBoCObservations(BOC_SERIES.CAD_USD, 2).catch(() => null),
  ]);

  const gdpLatest = oilGasGdp.at(-1);
  const gdpPrev = oilGasGdp.at(-2);
  const gdpChange =
    gdpLatest && gdpPrev
      ? ((gdpLatest.value - gdpPrev.value) / gdpPrev.value * 100).toFixed(1)
      : null;

  const energyLatest =
    energyIndex?.observations?.at(-1)?.[BOC_SERIES.BCPI_ENERGY]?.v;
  const energyPrev =
    energyIndex?.observations?.at(-2)?.[BOC_SERIES.BCPI_ENERGY]?.v;
  const energyChange =
    energyLatest && energyPrev
      ? ((parseFloat(energyLatest) - parseFloat(energyPrev)) / parseFloat(energyPrev) * 100).toFixed(1)
      : null;

  const constLatest = constructionGdp.at(-1);
  const constPrev = constructionGdp.at(-2);
  const constChange =
    constLatest && constPrev
      ? ((constLatest.value - constPrev.value) / constPrev.value * 100).toFixed(1)
      : null;

  const cadLatest =
    cadUsd?.observations?.at(-1)?.[BOC_SERIES.CAD_USD]?.v;
  const cadPrev =
    cadUsd?.observations?.at(-2)?.[BOC_SERIES.CAD_USD]?.v;
  const cadChange =
    cadLatest && cadPrev
      ? ((parseFloat(cadLatest) - parseFloat(cadPrev)) * 100).toFixed(2)
      : null;

  return {
    oilGasGdp: gdpLatest
      ? `$${(gdpLatest.value / 1_000).toFixed(1)}B`
      : "—",
    gdpChange: gdpChange
      ? `${parseFloat(gdpChange) >= 0 ? "+" : ""}${gdpChange}%`
      : undefined,
    energyIndex: energyLatest ? parseFloat(energyLatest).toFixed(1) : "—",
    energyChange: energyChange
      ? `${parseFloat(energyChange) >= 0 ? "+" : ""}${energyChange}%`
      : undefined,
    constructionGdp: constLatest
      ? `$${(constLatest.value / 1_000).toFixed(1)}B`
      : "—",
    constChange: constChange
      ? `${parseFloat(constChange) >= 0 ? "+" : ""}${constChange}%`
      : undefined,
    cadUsd: cadLatest ? `$${parseFloat(cadLatest).toFixed(4)}` : "—",
    cadChange: cadChange
      ? `${parseFloat(cadChange) >= 0 ? "+" : ""}${cadChange}¢`
      : undefined,
  };
}

// ============================================================
// Dashboard sections
// ============================================================

async function DrillingMetrics() {
  const m = await getDrillingMetrics();
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Mining/Oil/Gas GDP"
        value={m.oilGasGdp}
        change={m.gdpChange}
        changeLabel="vs prev period"
        source="StatsCan 36-10-0402"
      />
      <MetricCard
        title="Energy Commodity Index"
        value={m.energyIndex}
        change={m.energyChange}
        changeLabel="vs prev"
        source="BoC BCPI Energy"
      />
      <MetricCard
        title="Construction GDP"
        value={m.constructionGdp}
        change={m.constChange}
        changeLabel="vs prev period"
        source="StatsCan 36-10-0402"
      />
      <MetricCard
        title="CAD/USD"
        value={m.cadUsd}
        change={m.cadChange}
        changeLabel="vs prev day"
        source="Bank of Canada"
      />
    </div>
  );
}

async function EnergyPriceTrendsChart() {
  const data = await fetchBoCTimeSeries(BOC_SERIES.BCPI_ENERGY, 120);
  return (
    <Card>
      <CardHeader
        title="Energy Price Trends"
        subtitle="BoC Energy Commodity Price Index — crude, natural gas, coal. The leading signal for drilling activity."
        badge="LIVE"
      />
      <TimeSeriesAreaChart data={data} color="#f97316" height={280} />
      <p className="text-[10px] text-muted/60 mt-2">
        Energy prices lead drilling activity by 4-8 weeks. A sustained drop below ~300 signals rig laydowns.
      </p>
    </Card>
  );
}

async function OilGasGdpChart() {
  const { tableId, coordinate } = STATSCAN_SERIES.AB_GDP_MINING_OIL_GAS;
  const data = await fetchStatCanTimeSeries(tableId, coordinate, 40);
  return (
    <Card>
      <CardHeader
        title="Oil & Gas GDP Trend"
        subtitle="Real GDP — mining, quarrying, oil & gas extraction (chained 2017$)"
        badge="LIVE"
      />
      <TimeSeriesAreaChart data={data} color="#f59e0b" height={280} />
    </Card>
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

  return (
    <Card>
      <CardHeader
        title="Energy vs CAD/USD Correlation"
        subtitle="When energy prices move, the loonie follows — the petrodollar effect in real time"
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
  );
}

async function ConstructionGdpChart() {
  const { tableId, coordinate } = STATSCAN_SERIES.AB_GDP_CONSTRUCTION;
  const data = await fetchStatCanTimeSeries(tableId, coordinate, 40);
  return (
    <Card>
      <CardHeader
        title="Construction Activity"
        subtitle="Real GDP — construction sector (chained 2017$). Proxy for drilling infrastructure and oilfield construction spend."
        badge="LIVE"
      />
      <TimeSeriesAreaChart data={data} color="#06b6d4" height={280} />
      <p className="text-[10px] text-muted/60 mt-2">
        Construction GDP captures pipeline builds, facility construction, and camp expansions tied to drilling booms.
      </p>
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

export default function DrillingPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <header>
        <div className="flex items-center gap-2 mb-1">
          <Flame size={20} className="text-orange-400" />
          <h1 className="text-xl font-semibold tracking-tight">
            Drilling &amp; Energy Activity
          </h1>
        </div>
        <p className="text-sm text-muted">
          Well licences, production, and oilfield activity across Alberta. When
          drilling ramps up, service companies, housing, and retail follow.
        </p>
      </header>

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
          <DrillingMetrics />
        </Suspense>
      </section>

      {/* Energy Price Trends */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={16} className="text-orange-400" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Energy Price Trends
          </h2>
        </div>
        <Suspense fallback={<LoadingCard />}>
          <EnergyPriceTrendsChart />
        </Suspense>
      </section>

      {/* Oil & Gas GDP Trend */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 size={16} className="text-amber-400" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Oil &amp; Gas GDP Trend
          </h2>
        </div>
        <Suspense fallback={<LoadingCard />}>
          <OilGasGdpChart />
        </Suspense>
      </section>

      {/* Energy vs CAD Correlation */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <DollarSign size={16} className="text-emerald-400" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Energy vs CAD Correlation
          </h2>
        </div>
        <Suspense fallback={<LoadingCard />}>
          <EnergyVsCadChart />
        </Suspense>
      </section>

      {/* Construction Activity */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Factory size={16} className="text-cyan-400" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Construction Activity
          </h2>
        </div>
        <Suspense fallback={<LoadingCard />}>
          <ConstructionGdpChart />
        </Suspense>
      </section>

      {/* Coming Soon */}
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
                <p>Daily well licence data from the Alberta Energy Regulator (ST1). Tracks new drilling approvals — the earliest signal of activity.</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
                PLANNED
              </span>
              <div>
                <p className="font-medium text-foreground">Petrinex Production</p>
                <p>Monthly oil &amp; gas production volumes by well and facility. Shows where barrels are actually flowing.</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
                PLANNED
              </span>
              <div>
                <p className="font-medium text-foreground">Active Rig Count</p>
                <p>CAODC weekly active drilling rig count — the leading indicator of production intent and service company demand.</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
                PLANNED
              </span>
              <div>
                <p className="font-medium text-foreground">Pipeline Capacity</p>
                <p>CER pipeline throughput data — whether Alberta can get its product to market drives investment decisions.</p>
              </div>
            </div>
          </div>
        </Card>
      </section>

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Alberta Pulse Check &mdash; Drilling &amp; Energy &mdash; All data from free public APIs
      </footer>
    </main>
  );
}
