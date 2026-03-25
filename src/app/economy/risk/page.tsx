import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import { ChartCard } from "@/components/chart-card";
import { computeTimeRange } from "@/lib/time-range";

export const metadata: Metadata = {
  title: "Alberta Market Risk Dashboard",
  description: "Composite risk scoring for Alberta municipalities — employment dependency, vacancy, supply pipeline, rate sensitivity, and insolvency trends.",
};
import {
  MultiSeriesLineChart,
  TimeSeriesAreaChart,
  type MultiSeriesPoint,
} from "@/components/chart";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import {
  ShieldAlert,
  AlertTriangle,
  Home,
  Users,
  Flame,
} from "lucide-react";
import {
  fetchStatCanTimeSeries,
  fetchBoCTimeSeries,
  fetchBoCObservations,
  STATSCAN_SERIES,
  BOC_SERIES,
  type TimeSeriesPoint,
} from "@/lib/data-sources";

// ============================================================
// Risk scoring engine
// ============================================================

interface RiskComponent {
  name: string;
  score: number;      // 0-100 (0=low risk, 100=high risk)
  signal: "low" | "moderate" | "elevated" | "high";
  detail: string;
}

interface MarketRisk {
  overall: number;
  overallSignal: "low" | "moderate" | "elevated" | "high";
  components: RiskComponent[];
}

function scoreToSignal(score: number): "low" | "moderate" | "elevated" | "high" {
  if (score < 25) return "low";
  if (score < 50) return "moderate";
  if (score < 75) return "elevated";
  return "high";
}

async function calculateMarketRisk(): Promise<MarketRisk> {
  const [
    unemployment,
    vacancy,
    starts,
    completions,
    underConstruction,
    policyRate,
    energyIndex,
  ] = await Promise.all([
    fetchStatCanTimeSeries(STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.tableId, STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.coordinate, 12).catch(() => []),
    fetchStatCanTimeSeries(STATSCAN_SERIES.EDMONTON_VACANCY_RATE.tableId, STATSCAN_SERIES.EDMONTON_VACANCY_RATE.coordinate, 5).catch(() => []),
    fetchStatCanTimeSeries(STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.tableId, STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.coordinate, 24).catch(() => []),
    fetchStatCanTimeSeries(STATSCAN_SERIES.EDMONTON_HOUSING_COMPLETIONS.tableId, STATSCAN_SERIES.EDMONTON_HOUSING_COMPLETIONS.coordinate, 24).catch(() => []),
    fetchStatCanTimeSeries(STATSCAN_SERIES.EDMONTON_UNDER_CONSTRUCTION.tableId, STATSCAN_SERIES.EDMONTON_UNDER_CONSTRUCTION.coordinate, 12).catch(() => []),
    fetchBoCObservations(BOC_SERIES.POLICY_RATE, 2).catch(() => null),
    fetchBoCObservations(BOC_SERIES.BCPI_ENERGY, 6).catch(() => null),
  ]);

  const components: RiskComponent[] = [];

  // 1. Employment risk: higher unemployment = higher risk
  const unemp = unemployment.at(-1)?.value;
  const unempPrev = unemployment.at(-7)?.value; // 6 months ago
  if (unemp != null) {
    let score = 0;
    if (unemp > 8) score = 80;
    else if (unemp > 7) score = 60;
    else if (unemp > 6) score = 40;
    else if (unemp > 5) score = 20;
    else score = 10;
    // Trend bonus: rising unemployment adds risk
    if (unempPrev != null && unemp > unempPrev) score = Math.min(100, score + 15);
    components.push({
      name: "Employment",
      score,
      signal: scoreToSignal(score),
      detail: `Unemployment at ${unemp.toFixed(1)}%${unempPrev != null ? ` (was ${unempPrev.toFixed(1)}% 6mo ago)` : ""}`,
    });
  }

  // 2. Vacancy risk: very low vacancy = rent inflation risk; very high = oversupply
  const vac = vacancy.at(-1)?.value;
  if (vac != null) {
    let score = 0;
    if (vac < 1) score = 70; // too tight — rent pressure
    else if (vac < 2) score = 50;
    else if (vac < 3) score = 30;
    else if (vac < 5) score = 15; // healthy
    else if (vac < 7) score = 40; // starting to soften
    else score = 75; // oversupply
    components.push({
      name: "Rental Vacancy",
      score,
      signal: scoreToSignal(score),
      detail: `Vacancy at ${vac.toFixed(1)}% — ${vac < 3 ? "tight market, rent pressure" : vac < 5 ? "healthy balance" : "softening, oversupply risk"}`,
    });
  }

  // 3. Supply pipeline risk: too much building = oversupply
  const recentStarts = starts.slice(-12);
  const recentCompletions = completions.slice(-12);
  const avgStarts = recentStarts.length > 0 ? recentStarts.reduce((s, p) => s + p.value, 0) / recentStarts.length : 0;
  const avgCompletions = recentCompletions.length > 0 ? recentCompletions.reduce((s, p) => s + p.value, 0) / recentCompletions.length : 0;
  const pipelineRatio = avgCompletions > 0 ? avgStarts / avgCompletions : 0;
  if (avgStarts > 0) {
    let score = 0;
    if (pipelineRatio > 2) score = 80; // building way more than completing
    else if (pipelineRatio > 1.5) score = 60;
    else if (pipelineRatio > 1.1) score = 35;
    else if (pipelineRatio > 0.8) score = 15; // balanced
    else score = 50; // completions outpacing starts = slowing
    components.push({
      name: "Supply Pipeline",
      score,
      signal: scoreToSignal(score),
      detail: `Starts/completions ratio: ${pipelineRatio.toFixed(2)}x — ${pipelineRatio > 1.5 ? "heavy building, potential oversupply" : pipelineRatio > 0.8 ? "balanced pipeline" : "slowing starts"}`,
    });
  }

  // 4. Interest rate risk
  const rateLatest = policyRate?.observations?.at(-1)?.[BOC_SERIES.POLICY_RATE]?.v;
  if (rateLatest) {
    const rate = parseFloat(rateLatest);
    let score = 0;
    if (rate > 5) score = 85;
    else if (rate > 4) score = 65;
    else if (rate > 3) score = 45;
    else if (rate > 2) score = 25;
    else score = 10;
    components.push({
      name: "Interest Rate",
      score,
      signal: scoreToSignal(score),
      detail: `BoC policy rate at ${rate.toFixed(2)}% — ${rate > 4 ? "restrictive, mortgage stress risk" : rate > 2 ? "moderate" : "accommodative"}`,
    });
  }

  // 5. Energy dependency risk
  const energyObs = energyIndex?.observations;
  if (energyObs?.length >= 2) {
    const latest = parseFloat(energyObs.at(-1)?.[BOC_SERIES.BCPI_ENERGY]?.v || "0");
    const sixMonthAgo = parseFloat(energyObs.at(0)?.[BOC_SERIES.BCPI_ENERGY]?.v || "0");
    const change = sixMonthAgo > 0 ? ((latest - sixMonthAgo) / sixMonthAgo) * 100 : 0;
    let score = 0;
    if (change < -20) score = 80; // energy crash
    else if (change < -10) score = 60;
    else if (change < 0) score = 35;
    else if (change < 10) score = 15; // stable/growing
    else score = 10; // energy boom
    components.push({
      name: "Energy Dependency",
      score,
      signal: scoreToSignal(score),
      detail: `Energy index ${change >= 0 ? "+" : ""}${change.toFixed(1)}% over 6 months — ${change < -10 ? "declining, economic headwinds" : change > 10 ? "surging, tailwind" : "stable"}`,
    });
  }

  const overall = components.length > 0
    ? Math.round(components.reduce((s, c) => s + c.score, 0) / components.length)
    : 50;

  return {
    overall,
    overallSignal: scoreToSignal(overall),
    components,
  };
}

// ============================================================
// Dashboard sections
// ============================================================

const signalColors = {
  low: "text-accent-green",
  moderate: "text-blue-400",
  elevated: "text-amber-400",
  high: "text-accent-red",
};

const signalBg = {
  low: "bg-accent-green/10",
  moderate: "bg-blue-400/10",
  elevated: "bg-amber-400/10",
  high: "bg-accent-red/10",
};

async function RiskOverview() {
  const risk = await calculateMarketRisk();

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-medium">Overall Market Risk</h3>
            <p className="text-xs text-muted">Composite score across {risk.components.length} risk factors</p>
          </div>
          <div className={`text-3xl font-bold ${signalColors[risk.overallSignal]}`}>
            {risk.overall}
            <span className="text-sm font-normal ml-1">/100</span>
          </div>
        </div>
        <div className="w-full h-3 bg-card-border rounded-full overflow-hidden mb-3">
          <div
            className={`h-full rounded-full transition-all ${
              risk.overallSignal === "low" ? "bg-accent-green" :
              risk.overallSignal === "moderate" ? "bg-blue-400" :
              risk.overallSignal === "elevated" ? "bg-amber-400" :
              "bg-accent-red"
            }`}
            style={{ width: `${risk.overall}%` }}
          />
        </div>
        <p className={`text-xs font-medium uppercase tracking-wider ${signalColors[risk.overallSignal]}`}>
          {risk.overallSignal} risk
        </p>
      </Card>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {risk.components.map((c) => (
          <Card key={c.name}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium">{c.name}</p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${signalBg[c.signal]} ${signalColors[c.signal]}`}>
                {c.signal.toUpperCase()}
              </span>
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className={`text-xl font-bold ${signalColors[c.signal]}`}>{c.score}</span>
              <span className="text-xs text-muted">/100</span>
            </div>
            <div className="w-full h-1.5 bg-card-border rounded-full overflow-hidden mb-2">
              <div
                className={`h-full rounded-full ${
                  c.signal === "low" ? "bg-accent-green" :
                  c.signal === "moderate" ? "bg-blue-400" :
                  c.signal === "elevated" ? "bg-amber-400" :
                  "bg-accent-red"
                }`}
                style={{ width: `${c.score}%` }}
              />
            </div>
            <p className="text-[10px] text-muted">{c.detail}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

async function UnemploymentTrendChart() {
  const data = await fetchStatCanTimeSeries(
    STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.tableId,
    STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.coordinate,
    60
  );
  const timeRange = computeTimeRange(data);
  return (
    <ChartCard chartId="risk-unemployment" title="Alberta Unemployment Rate" timeRange={timeRange} source="StatsCan">
      <Card>
        <CardHeader
          title="Alberta Unemployment Rate"
          subtitle="The lagging indicator of economic health. Rising unemployment = rising default risk. Sourced from StatsCan Labour Force Survey (table 14-10-0287), seasonally adjusted, released monthly."
          badge="LIVE"
          freshness="daily"
        />
        <TimeSeriesAreaChart data={data} color="#ef4444" height={250} valueSuffix="%" />
      </Card>
    </ChartCard>
  );
}

async function RateVsStartsChart() {
  const [rate, starts] = await Promise.all([
    fetchBoCTimeSeries(BOC_SERIES.POLICY_RATE, 120),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.tableId,
      STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.coordinate,
      60
    ),
  ]);

  const dateMap = new Map<string, MultiSeriesPoint>();
  for (const p of rate) {
    const month = p.date.slice(0, 7);
    if (!dateMap.has(month)) {
      dateMap.set(month, { date: `${month}-01`, rate: p.value, starts: 0 });
    }
  }
  for (const p of starts) {
    const month = p.date.slice(0, 7);
    const existing = dateMap.get(month);
    if (existing) existing.starts = p.value;
  }
  const merged = Array.from(dateMap.values())
    .filter((p) => typeof p.rate === "number" && typeof p.starts === "number" && p.starts > 0)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const timeRange = computeTimeRange(merged);
  return (
    <ChartCard chartId="risk-rate-vs-starts" title="Policy Rate vs Housing Starts" timeRange={timeRange} source="Bank of Canada / StatsCan">
      <Card>
        <CardHeader
          title="Policy Rate vs Housing Starts"
          subtitle="When rates rise, starts fall 6-12 months later. The mortgage stress transmission channel. BoC rate from Valet API (daily), housing starts from StatsCan/CMHC (monthly)."
          badge="LIVE"
          freshness="daily"
        />
        <MultiSeriesLineChart
          data={merged}
          series={[
            { key: "rate", label: "BoC Rate %", color: "#ef4444", suffix: "%", yAxisId: "left" },
            { key: "starts", label: "Housing Starts", color: "#3b82f6", yAxisId: "right" },
          ]}
          height={280}
          dualAxis
        />
      </Card>
    </ChartCard>
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
    if (!dateMap.has(month)) {
      dateMap.set(month, { date: `${month}-01`, energy: p.value, unemployment: 0 });
    }
  }
  for (const p of unemployment) {
    const month = p.date.slice(0, 7);
    const existing = dateMap.get(month);
    if (existing) existing.unemployment = p.value;
  }
  const merged = Array.from(dateMap.values())
    .filter((p) => typeof p.energy === "number" && typeof p.unemployment === "number" && p.unemployment > 0)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const timeRange = computeTimeRange(merged);
  return (
    <ChartCard chartId="risk-energy-vs-unemployment" title="Energy Index vs Unemployment" timeRange={timeRange} source="Bank of Canada / StatsCan">
      <Card>
        <CardHeader
          title="Energy Index vs Unemployment"
          subtitle="Alberta's fundamental risk: energy drops → jobs drop → real estate follows. The lag is 6-18 months. Energy index from BoC BCPI (daily), unemployment from StatsCan LFS (monthly)."
          badge="LIVE"
          freshness="daily"
        />
        <MultiSeriesLineChart
          data={merged}
          series={[
            { key: "energy", label: "Energy Index", color: "#f97316", yAxisId: "left" },
            { key: "unemployment", label: "Unemployment %", color: "#ef4444", suffix: "%", yAxisId: "right" },
          ]}
          height={280}
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
// Page
// ============================================================

export default function RiskPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Market Risk Dashboard"
        description="Composite risk scoring across employment, vacancy, supply pipeline, interest rates, and energy dependency. Designed for lenders, underwriters, and risk-aware investors."
        category="intelligence"
        icon={<ShieldAlert size={20} />}
      >
        <div className="flex flex-wrap gap-2">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 font-mono">LENDERS</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-mono">UNDERWRITERS</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-mono">RISK ANALYSTS</span>
        </div>
      </PageHeader>

      {/* Risk Overview */}
      <section>
        <SectionHeader title="Risk Assessment" icon={<AlertTriangle size={16} />} category="intelligence" />
        <Suspense
          fallback={
            <div className="space-y-4">
              <LoadingCard />
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[...Array(5)].map((_, i) => (
                  <Card key={i}><div className="animate-pulse space-y-2"><div className="h-3 bg-card-border rounded w-1/2" /><div className="h-7 bg-card-border rounded w-1/3" /></div></Card>
                ))}
              </div>
            </div>
          }
        >
          <RiskOverview />
        </Suspense>
      </section>

      {/* Risk Correlations */}
      <section>
        <SectionHeader title="The Alberta Risk Chain" icon={<Flame size={16} />} category="intelligence" />
        <Suspense fallback={<LoadingCard />}>
          <EnergyVsUnemploymentChart />
        </Suspense>
      </section>

      <section>
        <SectionHeader title="Rate Sensitivity" icon={<Home size={16} />} category="intelligence" />
        <Suspense fallback={<LoadingCard />}>
          <RateVsStartsChart />
        </Suspense>
      </section>

      <section>
        <SectionHeader title="Employment Trend" icon={<Users size={16} />} category="intelligence" />
        <Suspense fallback={<LoadingCard />}>
          <UnemploymentTrendChart />
        </Suspense>
      </section>

      {/* Methodology */}
      <section>
        <Card>
          <h3 className="text-sm font-medium mb-2">Methodology</h3>
          <div className="text-xs text-muted space-y-2">
            <p>The composite risk score (0-100) is the average of five components:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li><strong>Employment</strong> — Unemployment rate level + 6-month trend direction</li>
              <li><strong>Rental Vacancy</strong> — CMHC vacancy rate (both extremes = higher risk)</li>
              <li><strong>Supply Pipeline</strong> — Starts-to-completions ratio (high ratio = oversupply risk)</li>
              <li><strong>Interest Rate</strong> — BoC policy rate level (higher = mortgage stress)</li>
              <li><strong>Energy Dependency</strong> — 6-month energy price trend (Alberta&apos;s economic driver)</li>
            </ul>
            <p className="text-muted/60">Scores: 0-24 = Low, 25-49 = Moderate, 50-74 = Elevated, 75-100 = High</p>
          </div>
        </Card>
      </section>

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Alberta Pulse Check &mdash; Market Risk &mdash; BoC + StatsCan + CMHC live data
      </footer>
    </main>
  );
}
