import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader, MetricCard } from "@/components/card";

export const metadata: Metadata = {
  title: "Alberta Investment Thesis",
  description: "Macro cycle position, energy outlook, rate environment, and migration momentum — should you invest in Alberta real estate right now?",
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
  TrendingUp,
  Flame,
  Users,
  Home,
  BarChart3,
  DollarSign,
  AlertTriangle,
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

async function getKeyMetrics() {
  const [policyRate, unemployment, energyIndex, cadUsd] = await Promise.all([
    fetchBoCObservations(BOC_SERIES.POLICY_RATE, 2).catch(() => null),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.tableId,
      STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.coordinate,
      2
    ).catch(() => []),
    fetchBoCObservations(BOC_SERIES.BCPI_ENERGY, 2).catch(() => null),
    fetchBoCObservations(BOC_SERIES.CAD_USD, 2).catch(() => null),
  ]);

  const rateLatest =
    policyRate?.observations?.at(-1)?.[BOC_SERIES.POLICY_RATE]?.v;
  const ratePrev =
    policyRate?.observations?.at(-2)?.[BOC_SERIES.POLICY_RATE]?.v;
  const rateChange =
    rateLatest && ratePrev
      ? ((parseFloat(rateLatest) - parseFloat(ratePrev)) * 100).toFixed(0)
      : null;

  const unempLatest = unemployment.at(-1);
  const unempPrev = unemployment.at(-2);
  const unempChange =
    unempLatest && unempPrev
      ? ((unempLatest.value - unempPrev.value)).toFixed(1)
      : null;

  const energyLatest =
    energyIndex?.observations?.at(-1)?.[BOC_SERIES.BCPI_ENERGY]?.v;
  const energyPrev =
    energyIndex?.observations?.at(-2)?.[BOC_SERIES.BCPI_ENERGY]?.v;
  const energyChange =
    energyLatest && energyPrev
      ? (
          ((parseFloat(energyLatest) - parseFloat(energyPrev)) /
            parseFloat(energyPrev)) *
          100
        ).toFixed(1)
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
    policyRate: rateLatest ? `${parseFloat(rateLatest).toFixed(2)}%` : "—",
    policyRateChange: rateChange
      ? `${parseFloat(rateChange) >= 0 ? "+" : ""}${rateChange} bps`
      : undefined,
    unemployment: unempLatest ? `${unempLatest.value.toFixed(1)}%` : "—",
    unemploymentChange: unempChange
      ? `${parseFloat(unempChange) >= 0 ? "+" : ""}${unempChange} pp`
      : undefined,
    energyIndex: energyLatest ? parseFloat(energyLatest).toFixed(1) : "—",
    energyChange: energyChange
      ? `${parseFloat(energyChange) >= 0 ? "+" : ""}${energyChange}%`
      : undefined,
    cadUsd: cadLatest ? `$${parseFloat(cadLatest).toFixed(4)}` : "—",
    cadChange: cadChange
      ? `${parseFloat(cadChange) >= 0 ? "+" : ""}${cadChange}\u00A2`
      : undefined,
  };
}

// ============================================================
// Dashboard sections
// ============================================================

async function KeyMetrics() {
  const m = await getKeyMetrics();
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="BoC Policy Rate"
        value={m.policyRate}
        change={m.policyRateChange}
        changeLabel="vs prev"
        source="Bank of Canada"
      />
      <MetricCard
        title="AB Unemployment Rate"
        value={m.unemployment}
        change={m.unemploymentChange}
        changeLabel="vs prev month"
        source="StatsCan 14-10-0287"
      />
      <MetricCard
        title="Energy Commodity Index"
        value={m.energyIndex}
        change={m.energyChange}
        changeLabel="vs prev"
        source="BoC BCPI Energy"
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

async function PolicyRateChart() {
  const data = await fetchBoCTimeSeries(BOC_SERIES.POLICY_RATE, 120);
  return (
    <Card>
      <CardHeader
        title="BoC Policy Rate Trend"
        subtitle="The cost of capital — rate cuts signal easing, rate hikes signal tightening"
        badge="LIVE"
      />
      <TimeSeriesAreaChart data={data} color="#3b82f6" height={280} />
    </Card>
  );
}

async function EnergyIndexChart() {
  const data = await fetchBoCTimeSeries(BOC_SERIES.BCPI_ENERGY, 240);
  return (
    <Card>
      <CardHeader
        title="BoC Energy Commodity Price Index"
        subtitle="The master signal for Alberta — tracks crude, natural gas, coal"
        badge="LIVE"
      />
      <TimeSeriesAreaChart data={data} color="#f97316" height={280} />
    </Card>
  );
}

async function EnergyVsCadChart() {
  const [energy, cad] = await Promise.all([
    fetchBoCTimeSeries(BOC_SERIES.BCPI_ENERGY, 120),
    fetchBoCTimeSeries(BOC_SERIES.CAD_USD, 120),
  ]);

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
        title="Energy Price vs CAD/USD"
        subtitle="The petro-dollar correlation — energy drives the loonie"
        badge="LIVE"
      />
      <MultiSeriesLineChart
        data={merged}
        series={[
          {
            key: "energy",
            label: "Energy Index",
            color: "#f97316",
            yAxisId: "left",
          },
          {
            key: "cad",
            label: "CAD/USD",
            color: "#10b981",
            prefix: "$",
            yAxisId: "right",
          },
        ]}
        height={280}
        dualAxis
      />
    </Card>
  );
}

async function EmploymentChart() {
  const { tableId, coordinate } = STATSCAN_SERIES.AB_EMPLOYMENT;
  const data = await fetchStatCanTimeSeries(tableId, coordinate, 40);
  return (
    <Card>
      <CardHeader
        title="Alberta Employment"
        subtitle="Total employment, seasonally adjusted — the jobs signal"
        badge="LIVE"
      />
      <TimeSeriesAreaChart data={data} color="#10b981" height={280} compact />
    </Card>
  );
}

async function MigrationChart() {
  const { tableId, coordinate } = STATSCAN_SERIES.AB_NET_INTERPROVINCIAL;
  const data = await fetchStatCanTimeSeries(tableId, coordinate, 20);
  return (
    <Card>
      <CardHeader
        title="Net Interprovincial Migration"
        subtitle="People voting with their feet — positive = Alberta is attracting Canadians"
        badge="LIVE"
      />
      <TimeSeriesBarChart data={data} color="#3b82f6" height={280} />
    </Card>
  );
}

async function HousingStartsChart() {
  const { tableId, coordinate } = STATSCAN_SERIES.EDMONTON_HOUSING_STARTS;
  const data = await fetchStatCanTimeSeries(tableId, coordinate, 24);
  return (
    <Card>
      <CardHeader
        title="Edmonton CMA Housing Starts"
        subtitle="New construction activity — leading indicator of supply pipeline"
        badge="LIVE"
      />
      <TimeSeriesBarChart data={data} color="#8b5cf6" height={280} />
    </Card>
  );
}

async function PermitValueChart() {
  const { tableId, coordinate } =
    STATSCAN_SERIES.EDMONTON_CMA_RES_PERMIT_VALUE;
  const data = await fetchStatCanTimeSeries(tableId, coordinate, 24);
  return (
    <Card>
      <CardHeader
        title="Edmonton CMA Residential Permit Value"
        subtitle="Dollar value of residential building permits — developer confidence"
        badge="LIVE"
      />
      <TimeSeriesAreaChart data={data} color="#f59e0b" height={280} compact />
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

export default function InvestPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Alberta Investment Thesis"
        description="Macro cycle position, energy outlook, migration momentum, and real estate trajectory. Built for advisors managing Alberta exposure."
        category="intelligence"
        icon={<TrendingUp size={20} />}
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
          <KeyMetrics />
        </Suspense>
      </section>

      {/* The Macro Cycle */}
      <section>
        <SectionHeader title="Where Are We in the Cycle?" icon={<BarChart3 size={16} />} category="intelligence" />
        <div className="grid md:grid-cols-2 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <PolicyRateChart />
          </Suspense>
          <Card>
            <CardHeader
              title="The Alberta Cycle"
              subtitle="Understanding the sequence"
            />
            <p className="text-sm text-muted leading-relaxed">
              Alberta&apos;s economy follows a predictable pattern: energy
              prices &rarr; drilling activity &rarr; employment &rarr; migration
              &rarr; housing demand &rarr; retail/services. Understanding where
              we are in this cycle is the single most valuable insight for
              Alberta investors.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                "Energy",
                "Drilling",
                "Employment",
                "Migration",
                "Housing",
                "Retail",
              ].map((stage, i) => (
                <span
                  key={stage}
                  className="text-xs px-2 py-1 rounded-full bg-card-border text-muted"
                >
                  {i > 0 && (
                    <span className="mr-1 text-muted/40">&rarr;</span>
                  )}
                  {stage}
                </span>
              ))}
            </div>
          </Card>
        </div>
      </section>

      {/* Energy Outlook */}
      <section>
        <SectionHeader title="The Engine" icon={<Flame size={16} />} category="intelligence" />
        <div className="grid md:grid-cols-2 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <EnergyIndexChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <EnergyVsCadChart />
          </Suspense>
        </div>
      </section>

      {/* Labour & Migration */}
      <section>
        <SectionHeader title="Are People Coming?" icon={<Users size={16} />} category="intelligence" />
        <div className="grid md:grid-cols-2 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <EmploymentChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <MigrationChart />
          </Suspense>
        </div>
      </section>

      {/* Real Estate */}
      <section>
        <SectionHeader title="Housing Market Signals" icon={<Home size={16} />} category="intelligence" />
        <div className="grid md:grid-cols-2 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <HousingStartsChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <PermitValueChart />
          </Suspense>
        </div>
      </section>

      {/* Bull/Bear Case */}
      <section>
        <SectionHeader title="The Bull/Bear Case" icon={<DollarSign size={16} />} category="intelligence" />
        <Card>
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-accent-green mb-3">
                Bull Case
              </h3>
              <ul className="space-y-2 text-sm text-muted">
                <li className="flex items-start gap-2">
                  <span className="text-accent-green mt-0.5 shrink-0">+</span>
                  Strong migration inflows
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent-green mt-0.5 shrink-0">+</span>
                  Energy prices stabilizing above breakeven
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent-green mt-0.5 shrink-0">+</span>
                  Rate cuts boosting affordability
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent-green mt-0.5 shrink-0">+</span>
                  Diversification progress (tech, agri-food)
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-medium text-accent-red mb-3">
                Bear Case
              </h3>
              <ul className="space-y-2 text-sm text-muted">
                <li className="flex items-start gap-2">
                  <span className="text-accent-red mt-0.5 shrink-0">&minus;</span>
                  Energy price collapse risk
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent-red mt-0.5 shrink-0">&minus;</span>
                  US trade policy uncertainty
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent-red mt-0.5 shrink-0">&minus;</span>
                  Housing supply overshoot in some markets
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent-red mt-0.5 shrink-0">&minus;</span>
                  Interest rate sensitivity
                </li>
              </ul>
            </div>
          </div>
        </Card>
      </section>

      {/* Historical Context */}
      <section>
        <SectionHeader title="Historical Context" icon={<AlertTriangle size={16} />} category="intelligence" />
        <Card>
          <CardHeader
            title="Boom & Bust Cycles"
            subtitle="Pattern recognition for Alberta investors"
          />
          <p className="text-sm text-muted leading-relaxed">
            Alberta has experienced three major busts: 2008 (financial crisis),
            2014 (oil price collapse), 2020 (COVID + price war). Each recovery
            followed the same pattern: energy recovery &rarr; employment
            recovery &rarr; migration resumption &rarr; housing rebound. The
            question is always timing.
          </p>
        </Card>
      </section>

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Alberta Pulse Check &mdash; Investment Thesis &mdash; Data from Bank of
        Canada, Statistics Canada, and CMHC via free public APIs
      </footer>
    </main>
  );
}
