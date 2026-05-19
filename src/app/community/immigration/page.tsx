import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import { ChartCard } from "@/components/chart-card";
import { computeTimeRange } from "@/lib/time-range";
import { SITE_URL } from "@/lib/constants/site";

export const metadata: Metadata = {
  title: "Alberta Migration & Population Growth",
  description: "Who is moving to Alberta and why? International immigration, interprovincial migration flows, and population growth data updated quarterly.",
  alternates: {
    canonical: `${SITE_URL}/community/immigration`,
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
  Plane,
  TrendingUp,
  Users,
  ArrowRightLeft,
  MapPin,
} from "lucide-react";
import {
  fetchBoCTimeSeries,
  fetchStatCanTimeSeries,
  BOC_SERIES,
  STATSCAN_SERIES,
  type TimeSeriesPoint,
} from "@/lib/data-sources";

// ============================================================
// Data fetching
// ============================================================

async function getMigrationMetrics() {
  const [population, immigration, interprovincialNet, births, deaths] =
    await Promise.all([
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_POPULATION.tableId,
        STATSCAN_SERIES.AB_POPULATION.coordinate,
        4
      ).catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_IMMIGRATION.tableId,
        STATSCAN_SERIES.AB_IMMIGRATION.coordinate,
        4
      ).catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_NET_INTERPROVINCIAL.tableId,
        STATSCAN_SERIES.AB_NET_INTERPROVINCIAL.coordinate,
        4
      ).catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_BIRTHS.tableId,
        STATSCAN_SERIES.AB_BIRTHS.coordinate,
        4
      ).catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_DEATHS.tableId,
        STATSCAN_SERIES.AB_DEATHS.coordinate,
        4
      ).catch(() => []),
    ]);

  const popLatest = population.at(-1);
  const popPrev = population.at(-2);
  const popChange = popLatest && popPrev
    ? ((popLatest.value - popPrev.value) / popPrev.value * 100).toFixed(1)
    : null;

  const interLatest = interprovincialNet.at(-1);
  const interPrev = interprovincialNet.at(-2);

  const immLatest = immigration.at(-1);

  return {
    population: popLatest ? `${(popLatest.value / 1_000_000).toFixed(2)}M` : "—",
    popChange: popChange ? `+${popChange}%` : undefined,
    immigration: immLatest ? `${(immLatest.value / 1_000).toFixed(1)}K` : "—",
    interprovincial: interLatest
      ? `${interLatest.value >= 0 ? "+" : ""}${(interLatest.value / 1_000).toFixed(1)}K`
      : "—",
    interprovincialDir: interLatest
      ? interLatest.value >= 0 ? "positive" : "negative"
      : "unknown",
    naturalIncrease: births.at(-1) && deaths.at(-1)
      ? `${((births.at(-1)!.value - deaths.at(-1)!.value) / 1_000).toFixed(1)}K`
      : "—",
  };
}

// ============================================================
// Sections
// ============================================================

async function MigrationMetrics() {
  const m = await getMigrationMetrics();
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Alberta Population"
        value={m.population}
        change={m.popChange}
        changeLabel="YoY"
        source="StatsCan 17-10-0005"
      />
      <MetricCard
        title="International Immigration"
        value={m.immigration}
        source="StatsCan 17-10-0008"
      />
      <MetricCard
        title="Net Interprovincial"
        value={m.interprovincial}
        source="StatsCan 17-10-0008"
      />
      <MetricCard
        title="Natural Increase"
        value={m.naturalIncrease}
        source="StatsCan 17-10-0008"
      />
    </div>
  );
}

async function PopulationChart() {
  const { tableId, coordinate } = STATSCAN_SERIES.AB_POPULATION;
  const data = await fetchStatCanTimeSeries(tableId, coordinate, 40);
  return (
    <ChartCard chartId="macro-population" title="Alberta Population" timeRange={computeTimeRange(data)} source="StatsCan">
      <Card>
        <CardHeader
          title="Alberta Population"
          subtitle="Quarterly estimates — Edmonton metro is now Canada's fastest-growing CMA"
          badge="LIVE"
        />
        <TimeSeriesAreaChart data={data} color="#3b82f6" compact height={280} />
        <p className="text-[10px] text-muted/60 mt-2">
          Alberta added 200K+ people in the last 3 years. At 3% annual growth, Edmonton
          is outpacing Vancouver and Toronto. This drives housing demand, school enrollment,
          retail expansion.
        </p>
      </Card>
    </ChartCard>
  );
}

async function ImmigrationChart() {
  const { tableId, coordinate } = STATSCAN_SERIES.AB_IMMIGRATION;
  const data = await fetchStatCanTimeSeries(tableId, coordinate, 40);
  return (
    <ChartCard chartId="macro-immigration" title="International Immigration to Alberta" timeRange={computeTimeRange(data)} source="StatsCan">
      <Card>
        <CardHeader
          title="International Immigration to Alberta"
          subtitle="Annual arrivals — the primary growth engine"
          badge="LIVE"
        />
        <TimeSeriesBarChart data={data} color="#10b981" height={250} />
        <p className="text-[10px] text-muted/60 mt-2">
          Edmonton attracted 40% more international residents than Vancouver in recent years.
          Demographics skew young and multicultural — EAL student populations grew 105%.
        </p>
      </Card>
    </ChartCard>
  );
}

async function InterprovincialChart() {
  const { tableId, coordinate } = STATSCAN_SERIES.AB_NET_INTERPROVINCIAL;
  const data = await fetchStatCanTimeSeries(tableId, coordinate, 40);
  return (
    <ChartCard chartId="macro-interprovincial" title="Net Interprovincial Migration" timeRange={computeTimeRange(data)} source="StatsCan">
      <Card>
        <CardHeader
          title="Net Interprovincial Migration"
          subtitle="People moving to Alberta minus people leaving — the boom-bust signal"
          badge="LIVE"
        />
        <TimeSeriesBarChart data={data} color="#f97316" height={250} />
        <p className="text-[10px] text-muted/60 mt-2">
          This is the boom signal. When positive: people are chasing Alberta jobs/wages.
          When negative (as in 2015-2016): the bust has arrived and workers are fleeing.
          For real estate, this is demand forecasting.
        </p>
      </Card>
    </ChartCard>
  );
}

async function MigrationComponentsChart() {
  const [immigration, netInterprov, emigration, births, deaths] =
    await Promise.all([
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_IMMIGRATION.tableId,
        STATSCAN_SERIES.AB_IMMIGRATION.coordinate,
        20
      ).catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_NET_INTERPROVINCIAL.tableId,
        STATSCAN_SERIES.AB_NET_INTERPROVINCIAL.coordinate,
        20
      ).catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_EMIGRATION.tableId,
        STATSCAN_SERIES.AB_EMIGRATION.coordinate,
        20
      ).catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_BIRTHS.tableId,
        STATSCAN_SERIES.AB_BIRTHS.coordinate,
        20
      ).catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_DEATHS.tableId,
        STATSCAN_SERIES.AB_DEATHS.coordinate,
        20
      ).catch(() => []),
    ]);

  const dateMap = new Map<string, MultiSeriesPoint>();
  const addSeries = (data: TimeSeriesPoint[], key: string) => {
    for (const p of data) {
      if (!dateMap.has(p.date)) dateMap.set(p.date, { date: p.date });
      dateMap.get(p.date)![key] = p.value;
    }
  };
  addSeries(immigration, "immigration");
  addSeries(netInterprov, "netInterprov");
  addSeries(emigration, "emigration");
  addSeries(births, "births");
  addSeries(deaths, "deaths");

  const merged = Array.from(dateMap.values()).sort((a, b) =>
    String(a.date).localeCompare(String(b.date))
  );

  return (
    <ChartCard chartId="macro-migration-components" title="Population Growth Components" timeRange={computeTimeRange(merged)} source="StatsCan">
      <Card>
        <CardHeader
          title="Population Growth Components"
          subtitle="Breaking down where Alberta's growth comes from (annual)"
          badge="LIVE"
        />
        <MultiSeriesLineChart
          data={merged}
          series={[
            { key: "immigration", label: "International Immigration", color: "#10b981" },
            { key: "netInterprov", label: "Net Interprovincial", color: "#3b82f6" },
            { key: "emigration", label: "Net Emigration", color: "#ef4444" },
            { key: "births", label: "Births", color: "#f59e0b" },
            { key: "deaths", label: "Deaths", color: "#6b7280" },
          ]}
          height={350}
        />
      </Card>
    </ChartCard>
  );
}

async function MigrationVsEnergyChart() {
  const [interprovincial, energy] = await Promise.all([
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_NET_INTERPROVINCIAL.tableId,
      STATSCAN_SERIES.AB_NET_INTERPROVINCIAL.coordinate,
      40
    ).catch(() => []),
    fetchBoCTimeSeries(BOC_SERIES.BCPI_ENERGY, 120).catch(() => []),
  ]);

  const dateMap = new Map<string, MultiSeriesPoint>();
  for (const p of interprovincial) {
    dateMap.set(p.date, { date: p.date, migration: p.value, energy: 0 });
  }
  // Energy is daily/weekly, migration is quarterly — match by closest quarter
  for (const p of energy) {
    const quarter = p.date.slice(0, 7);
    for (const [key, point] of dateMap) {
      if (key.startsWith(quarter.slice(0, 4))) {
        // rough match by year
        if (!point.energy || (point.energy as number) === 0) {
          point.energy = p.value;
        }
      }
    }
  }
  const merged = Array.from(dateMap.values())
    .filter((p) => p.energy)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  return (
    <ChartCard chartId="macro-migration-vs-energy" title="Net Migration vs Energy Prices" timeRange={computeTimeRange(merged)} source="StatsCan · Bank of Canada">
      <Card>
        <CardHeader
          title="Net Migration vs Energy Prices"
          subtitle="People follow the money — migration tracks energy with a lag"
          badge="LIVE"
        />
        <MultiSeriesLineChart
          data={merged}
          series={[
            { key: "migration", label: "Net Interprovincial", color: "#3b82f6", yAxisId: "left" },
            { key: "energy", label: "Energy Index", color: "#f97316", yAxisId: "right" },
          ]}
          height={300}
          dualAxis
        />
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

function MigrationContext() {
  return (
    <Card>
      <h3 className="text-sm font-medium mb-3">Why Migration Matters for Real Estate</h3>
      <div className="space-y-3 text-xs text-muted">
        <p>
          Migration is the primary demand driver for Edmonton&apos;s housing market. Unlike Toronto
          or Vancouver, where prices are driven by limited supply and speculation, Edmonton&apos;s
          market is demand-driven — and demand follows jobs.
        </p>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="border border-card-border rounded-lg p-3">
            <p className="font-medium text-foreground mb-1">International</p>
            <p>Structural growth — steady regardless of oil prices. Creates demand for
            starter homes, rental, and specific neighbourhoods near settlement services.</p>
          </div>
          <div className="border border-card-border rounded-lg p-3">
            <p className="font-medium text-foreground mb-1">Interprovincial</p>
            <p>Cyclical — follows energy. Workers from BC, Ontario, Atlantic Canada.
            When positive: rental pressure, then purchase demand. When negative: vacancy rises.</p>
          </div>
          <div className="border border-card-border rounded-lg p-3">
            <p className="font-medium text-foreground mb-1">The Real Estate Signal</p>
            <p>If interprovincial migration is positive AND immigration is strong, housing
            demand has legs. If interprovincial flips negative, watch listing inventory closely.</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ============================================================
// Page
// ============================================================

export default function MigrationPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="The People Flow"
        description="Who is coming to Alberta, who is leaving, and why? Migration drives housing demand, school enrollment, retail, and services."
        category="economy"
        icon={<Plane size={20} />}
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
          <MigrationMetrics />
        </Suspense>
      </section>

      {/* Hero: Population */}
      <section>
        <SectionHeader title="The Growth Story" icon={<Users size={16} />} category="economy" />
        <Suspense fallback={<LoadingCard />}>
          <PopulationChart />
        </Suspense>
      </section>

      {/* Migration flows */}
      <section>
        <SectionHeader title="Migration Flows" icon={<ArrowRightLeft size={16} />} category="economy" />
        <div className="grid lg:grid-cols-2 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <ImmigrationChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <InterprovincialChart />
          </Suspense>
        </div>
      </section>

      {/* Components breakdown */}
      <section>
        <SectionHeader title="Growth Components" icon={<TrendingUp size={16} />} category="economy" />
        <Suspense fallback={<LoadingCard />}>
          <MigrationComponentsChart />
        </Suspense>
      </section>

      {/* Correlation */}
      <section>
        <SectionHeader title="Migration & Energy Correlation" icon={<MapPin size={16} />} category="economy" />
        <Suspense fallback={<LoadingCard />}>
          <MigrationVsEnergyChart />
        </Suspense>
      </section>

      {/* Context */}
      <section>
        <MigrationContext />
      </section>
    </main>
  );
}
