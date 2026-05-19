import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader } from "@/components/card";
import { ChartCard } from "@/components/chart-card";
import { computeTimeRange } from "@/lib/time-range";
import { SITE_URL } from "@/lib/constants/site";

export const metadata: Metadata = {
  title: "Alberta Boom-Bust Cycle Tracker",
  description: "Track where Alberta is in its economic cycle. Live analysis of oil prices, employment, migration, and construction against historical boom-bust patterns.",
  alternates: {
    canonical: `${SITE_URL}/economy/boom-bust`,
  },
};
import {
  TimeSeriesAreaChart,
  MultiSeriesLineChart,
  type MultiSeriesPoint,
} from "@/components/chart";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  History,
} from "lucide-react";
import {
  fetchBoCTimeSeries,
  fetchStatCanTimeSeries,
  fetchAlbertaActivityIndex,
  BOC_SERIES,
  STATSCAN_SERIES,
  type TimeSeriesPoint,
} from "@/lib/data-sources";

// ============================================================
// Helpers
// ============================================================

function getDirection(data: TimeSeriesPoint[]): "up" | "down" | "flat" {
  if (data.length < 6) return "flat";
  const recent = data.slice(-3).reduce((s, p) => s + p.value, 0) / 3;
  const prior = data.slice(-6, -3).reduce((s, p) => s + p.value, 0) / 3;
  if (prior === 0) return "flat";
  const pctChange = ((recent - prior) / Math.abs(prior)) * 100;
  if (pctChange > 2) return "up";
  if (pctChange < -2) return "down";
  return "flat";
}

function assessCyclePhase(signals: {
  energy: TimeSeriesPoint[];
  unemployment: TimeSeriesPoint[];
  population: TimeSeriesPoint[];
  housingStarts: TimeSeriesPoint[];
  permits: TimeSeriesPoint[];
  gdp: TimeSeriesPoint[];
}): { phase: string; description: string; color: string } {
  const energyDir = getDirection(signals.energy);
  const unemploymentDir = getDirection(signals.unemployment);
  const popDir = getDirection(signals.population);
  const housingDir = getDirection(signals.housingStarts);

  // Simple heuristic for cycle phase
  if (energyDir === "up" && unemploymentDir === "down") {
    return {
      phase: "EXPANSION",
      description:
        "Energy prices rising, unemployment falling. Classic Alberta boom conditions. Watch for overheating — labour shortages, cost inflation, speculative building.",
      color: "text-green-400",
    };
  }
  if (energyDir === "up" && unemploymentDir === "up") {
    return {
      phase: "EARLY RECOVERY",
      description:
        "Energy prices recovering but unemployment still elevated. Jobs lag commodity prices by 3-6 months. Housing should follow in 6-12 months.",
      color: "text-yellow-400",
    };
  }
  if (energyDir === "down" && unemploymentDir === "down") {
    return {
      phase: "LATE CYCLE",
      description:
        "Energy prices softening but labour market still tight. The economy is running on momentum. Watch for turning points in housing starts and migration.",
      color: "text-amber-400",
    };
  }
  if (energyDir === "down" && unemploymentDir === "up") {
    return {
      phase: "CONTRACTION",
      description:
        "Energy prices falling and unemployment rising. This is how Alberta busts begin. Migration will reverse, housing will soften, government revenue will tighten.",
      color: "text-red-400",
    };
  }

  // Stable / flat
  if (popDir === "up" && housingDir === "up") {
    return {
      phase: "STEADY GROWTH",
      description:
        "Mixed energy signals but population and construction growing. Structural growth from immigration may be buffering the cycle.",
      color: "text-blue-400",
    };
  }

  return {
    phase: "MIXED SIGNALS",
    description:
      "Indicators are pointing in different directions. This often happens at inflection points — watch closely over the next 1-3 months.",
    color: "text-slate-400",
  };
}

// ============================================================
// Data fetching
// ============================================================

async function getCycleData() {
  const [energy, unemployment, population, housingStarts, gdp, cadUsd, cpi] =
    await Promise.all([
      fetchBoCTimeSeries(BOC_SERIES.BCPI_ENERGY, 120).catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.tableId,
        STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.coordinate,
        60
      ).catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_POPULATION.tableId,
        STATSCAN_SERIES.AB_POPULATION.coordinate,
        20
      ).catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.tableId,
        STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.coordinate,
        60
      ).catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_GDP.tableId,
        STATSCAN_SERIES.AB_GDP.coordinate,
        40
      ).catch(() => []),
      fetchBoCTimeSeries(BOC_SERIES.CAD_USD, 120).catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_CPI.tableId,
        STATSCAN_SERIES.AB_CPI.coordinate,
        60
      ).catch(() => []),
    ]);

  return { energy, unemployment, population, housingStarts, gdp, cadUsd, cpi, permits: [] as TimeSeriesPoint[] };
}

// ============================================================
// Sections
// ============================================================

async function CycleAssessment() {
  const data = await getCycleData();
  const phase = assessCyclePhase(data);

  const signals = [
    { name: "Energy Prices", data: data.energy, source: "BoC BCPI Energy" },
    { name: "Unemployment", data: data.unemployment, source: "StatsCan", invertGood: true },
    { name: "Population", data: data.population, source: "StatsCan" },
    { name: "Housing Starts", data: data.housingStarts, source: "CMHC/StatsCan" },
    { name: "GDP", data: data.gdp, source: "StatsCan" },
    { name: "CAD/USD", data: data.cadUsd, source: "BoC" },
  ];

  return (
    <Card className="border-l-4 border-l-accent">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs text-muted mb-1">Current Cycle Phase</p>
          <h2 className={`text-2xl font-bold tracking-tight ${phase.color}`}>
            {phase.phase}
          </h2>
        </div>
        <RefreshCw size={20} className="text-muted" />
      </div>
      <p className="text-sm text-muted/80 mb-4">{phase.description}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {signals.map((s) => {
          const dir = getDirection(s.data);
          const isGood =
            s.invertGood
              ? dir === "down"
              : dir === "up";
          const isBad =
            s.invertGood
              ? dir === "up"
              : dir === "down";
          return (
            <div key={s.name} className="text-center">
              <div
                className={`inline-flex p-2 rounded-lg mb-1 ${
                  isGood
                    ? "bg-green-500/10"
                    : isBad
                      ? "bg-red-500/10"
                      : "bg-slate-500/10"
                }`}
              >
                {dir === "up" && (
                  <TrendingUp
                    size={16}
                    className={s.invertGood ? "text-red-400" : "text-green-400"}
                  />
                )}
                {dir === "down" && (
                  <TrendingDown
                    size={16}
                    className={s.invertGood ? "text-green-400" : "text-red-400"}
                  />
                )}
                {dir === "flat" && <Minus size={16} className="text-slate-400" />}
              </div>
              <p className="text-xs font-medium">{s.name}</p>
              <p className="text-[9px] text-muted">{s.source}</p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

async function EnergyVsUnemploymentChart() {
  const [energy, unemployment] = await Promise.all([
    fetchBoCTimeSeries(BOC_SERIES.BCPI_ENERGY, 120),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.tableId,
      STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.coordinate,
      60
    ),
  ]);

  const dateMap = new Map<string, MultiSeriesPoint>();
  for (const p of energy) {
    const month = p.date.slice(0, 7);
    if (!dateMap.has(month)) dateMap.set(month, { date: p.date, energy: 0, unemployment: 0 });
    dateMap.get(month)!.energy = p.value;
  }
  for (const p of unemployment) {
    const month = p.date.slice(0, 7);
    if (!dateMap.has(month)) dateMap.set(month, { date: p.date, energy: 0, unemployment: 0 });
    dateMap.get(month)!.unemployment = p.value;
  }
  const merged = Array.from(dateMap.values())
    .filter((p) => p.energy && p.unemployment)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  return (
    <ChartCard chartId="macro-energy-vs-unemployment" title="Energy Price vs Unemployment" timeRange={computeTimeRange(merged)} source="Bank of Canada · StatsCan">
      <Card>
        <CardHeader
          title="Energy Price vs Unemployment"
          subtitle="The inverse correlation — when oil drops, unemployment rises ~6 months later"
          badge="LIVE"
        />
        <MultiSeriesLineChart
          data={merged}
          series={[
            { key: "energy", label: "Energy Index", color: "#f97316", yAxisId: "left" },
            { key: "unemployment", label: "Unemployment %", color: "#ef4444", suffix: "%", yAxisId: "right" },
          ]}
          height={300}
          dualAxis
        />
      </Card>
    </ChartCard>
  );
}

async function EnergyVsHousingChart() {
  const [energy, housing] = await Promise.all([
    fetchBoCTimeSeries(BOC_SERIES.BCPI_ENERGY, 120),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.tableId,
      STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.coordinate,
      60
    ),
  ]);

  const dateMap = new Map<string, MultiSeriesPoint>();
  for (const p of energy) {
    const month = p.date.slice(0, 7);
    if (!dateMap.has(month)) dateMap.set(month, { date: p.date, energy: 0, housing: 0 });
    dateMap.get(month)!.energy = p.value;
  }
  for (const p of housing) {
    const month = p.date.slice(0, 7);
    if (!dateMap.has(month)) dateMap.set(month, { date: p.date, energy: 0, housing: 0 });
    dateMap.get(month)!.housing = p.value;
  }
  const merged = Array.from(dateMap.values())
    .filter((p) => p.energy && p.housing)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  return (
    <ChartCard chartId="macro-energy-vs-housing" title="Energy Price vs Housing Starts" timeRange={computeTimeRange(merged)} source="Bank of Canada · StatsCan">
      <Card>
        <CardHeader
          title="Energy Price vs Housing Starts"
          subtitle="Housing lags energy prices by ~12 months — watch for divergence"
          badge="LIVE"
        />
        <MultiSeriesLineChart
          data={merged}
          series={[
            { key: "energy", label: "Energy Index", color: "#f97316", yAxisId: "left" },
            { key: "housing", label: "Housing Starts", color: "#3b82f6", yAxisId: "right" },
          ]}
          height={300}
          dualAxis
        />
      </Card>
    </ChartCard>
  );
}

async function GdpTrendChart() {
  const { tableId, coordinate } = STATSCAN_SERIES.AB_GDP;
  const data = await fetchStatCanTimeSeries(tableId, coordinate, 40);
  return (
    <ChartCard chartId="macro-gdp" title="Alberta Real GDP" timeRange={computeTimeRange(data)} source="StatsCan">
      <Card>
        <CardHeader
          title="Alberta Real GDP"
          subtitle="Chained 2017 dollars — the broadest measure of economic output"
          badge="LIVE"
        />
        <TimeSeriesAreaChart data={data} color="#10b981" compact height={250} />
      </Card>
    </ChartCard>
  );
}

async function CpiTrendChart() {
  const { tableId, coordinate } = STATSCAN_SERIES.AB_CPI;
  const data = await fetchStatCanTimeSeries(tableId, coordinate, 60);
  return (
    <ChartCard chartId="macro-cpi" title="Alberta CPI" timeRange={computeTimeRange(data)} source="StatsCan">
      <Card>
        <CardHeader
          title="Alberta CPI"
          subtitle="Consumer price index — inflation pressure indicator"
          badge="LIVE"
        />
        <TimeSeriesAreaChart data={data} color="#a855f7" height={250} />
      </Card>
    </ChartCard>
  );
}

async function AAXChart() {
  // Show last 20 years of AAX data
  const allData = await fetchAlbertaActivityIndex();
  const data = allData.slice(-240); // ~20 years of monthly data
  const latest = data.at(-1);
  return (
    <ChartCard chartId="macro-aax" title="Alberta Activity Index (AAX)" timeRange={computeTimeRange(data)} source="Alberta Treasury Board">
      <Card>
        <CardHeader
          title="Alberta Activity Index (AAX)"
          subtitle={`Weighted composite of 9 monthly indicators (Jan 1981 = 100)${latest ? ` — Latest: ${latest.value.toFixed(1)}` : ""}`}
          badge="LIVE"
        />
        <TimeSeriesAreaChart data={data} color="#8b5cf6" height={280} />
        <p className="text-[10px] text-muted/60 mt-2">
          The AAX combines employment, earnings, retail, wholesale, manufacturing,
          truck sales, housing starts, rigs drilling, and oil production into a single
          monthly cycle measure. Dips mark recessions (2008, 2015, 2020).
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
// Historical Context (static)
// ============================================================

function HistoricalBusts() {
  const busts = [
    {
      year: "2008-2009",
      trigger: "Global Financial Crisis",
      oilDrop: "WTI: $147 → $32",
      impact: "Unemployment doubled to 7.5%. Housing prices fell 10-15%. Interprovincial migration reversed.",
    },
    {
      year: "2014-2016",
      trigger: "OPEC price war + oversupply",
      oilDrop: "WTI: $107 → $26",
      impact: "110,000 energy jobs lost. Calgary office vacancy hit 30%. Edmonton housing stagnated for 3 years.",
    },
    {
      year: "2020",
      trigger: "COVID-19 + Saudi-Russia price war",
      oilDrop: "WTI: $63 → negative briefly",
      impact: "Unemployment hit 15.4%. Short but severe. Recovery accelerated by post-COVID demand surge.",
    },
  ];

  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <History size={16} className="text-muted" />
        <h3 className="text-sm font-medium">Alberta Bust History</h3>
      </div>
      <p className="text-xs text-muted mb-4">
        Every bust follows the same pattern: oil drops → drilling stops → layoffs → migration reverses → housing softens → government cuts.
        The question is always: how deep and how long?
      </p>
      <div className="space-y-4">
        {busts.map((b) => (
          <div key={b.year} className="border-l-2 border-red-500/30 pl-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-red-400">{b.year}</span>
              <span className="text-[10px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded">
                {b.trigger}
              </span>
            </div>
            <p className="text-xs text-muted/80 mb-0.5">{b.oilDrop}</p>
            <p className="text-xs text-muted">{b.impact}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ============================================================
// Page
// ============================================================

export default function CyclePage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Boom-Bust Tracker"
        description="Where are we in the Alberta cycle? Oil price → jobs → migration → housing → everything. The pattern repeats — the timing varies."
        category="economy"
        icon={<RefreshCw size={20} />}
      />

      {/* Cycle Assessment */}
      <section>
        <Suspense
          fallback={
            <Card>
              <div className="animate-pulse space-y-3">
                <div className="h-8 bg-card-border rounded w-1/4" />
                <div className="h-4 bg-card-border/50 rounded w-3/4" />
                <div className="grid grid-cols-6 gap-3">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-16 bg-card-border/30 rounded" />
                  ))}
                </div>
              </div>
            </Card>
          }
        >
          <CycleAssessment />
        </Suspense>
      </section>

      {/* Key Correlations */}
      <section>
        <SectionHeader title="Key Correlations" icon={<AlertTriangle size={16} />} category="economy" />
        <div className="grid lg:grid-cols-2 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <EnergyVsUnemploymentChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <EnergyVsHousingChart />
          </Suspense>
        </div>
      </section>

      {/* Broad Indicators */}
      <section>
        <SectionHeader title="Broad Indicators" icon={<TrendingUp size={16} />} category="economy" />
        <div className="grid md:grid-cols-2 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <GdpTrendChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <CpiTrendChart />
          </Suspense>
        </div>
      </section>

      {/* Historical Context */}
      <section>
        <SectionHeader title="Historical Context" icon={<History size={16} />} category="economy" />
        <HistoricalBusts />
      </section>

      {/* Alberta Activity Index */}
      <section>
        <Suspense fallback={<LoadingCard />}>
          <AAXChart />
        </Suspense>
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
                <p className="font-medium text-foreground">Insolvency Filings</p>
                <p>Consumer and business insolvency data from OSB — the stress indicator that spikes during busts.</p>
              </div>
            </div>
          </div>
        </Card>
      </section>
    </main>
  );
}
