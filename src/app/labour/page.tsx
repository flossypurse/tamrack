import { Suspense } from "react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import {
  TimeSeriesAreaChart,
  TimeSeriesBarChart,
  MultiSeriesLineChart,
  type MultiSeriesPoint,
} from "@/components/chart";
import {
  HardHat,
  TrendingUp,
  DollarSign,
  Users,
  BarChart3,
} from "lucide-react";
import {
  fetchStatCanTimeSeries,
  STATSCAN_SERIES,
  type TimeSeriesPoint,
} from "@/lib/data-sources";

// ============================================================
// Data fetching
// ============================================================

async function getLabourMetrics() {
  const [unemployment, employment, participation, earnings] =
    await Promise.all([
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.tableId,
        STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.coordinate,
        2
      ).catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_EMPLOYMENT.tableId,
        STATSCAN_SERIES.AB_EMPLOYMENT.coordinate,
        2
      ).catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_PARTICIPATION_RATE.tableId,
        STATSCAN_SERIES.AB_PARTICIPATION_RATE.coordinate,
        2
      ).catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_WEEKLY_EARNINGS.tableId,
        STATSCAN_SERIES.AB_WEEKLY_EARNINGS.coordinate,
        2
      ).catch(() => []),
    ]);

  const latest = unemployment.at(-1);
  const prev = unemployment.at(-2);
  const uChange = latest && prev ? (latest.value - prev.value).toFixed(1) : null;

  const empLatest = employment.at(-1);
  const empPrev = employment.at(-2);
  const empChange = empLatest && empPrev
    ? ((empLatest.value - empPrev.value) / empPrev.value * 100).toFixed(1)
    : null;

  return {
    unemployment: latest ? `${latest.value}%` : "—",
    unemploymentChange: uChange
      ? `${parseFloat(uChange) >= 0 ? "+" : ""}${uChange}pp`
      : undefined,
    employment: empLatest
      ? `${(empLatest.value / 1_000).toFixed(0)}K`
      : "—",
    employmentChange: empChange
      ? `${parseFloat(empChange) >= 0 ? "+" : ""}${empChange}%`
      : undefined,
    participation: participation.at(-1)
      ? `${participation.at(-1)!.value}%`
      : "—",
    weeklyEarnings: earnings.at(-1)
      ? `$${earnings.at(-1)!.value.toFixed(0)}`
      : "—",
  };
}

// ============================================================
// Sections
// ============================================================

async function LabourMetrics() {
  const m = await getLabourMetrics();
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="AB Unemployment Rate"
        value={m.unemployment}
        change={m.unemploymentChange}
        changeLabel="vs prev month"
        source="StatsCan 14-10-0287"
      />
      <MetricCard
        title="AB Employment"
        value={m.employment}
        change={m.employmentChange}
        changeLabel="vs prev month"
        source="StatsCan 14-10-0287"
      />
      <MetricCard
        title="Participation Rate"
        value={m.participation}
        source="StatsCan 14-10-0287"
      />
      <MetricCard
        title="Avg Weekly Earnings"
        value={m.weeklyEarnings}
        source="StatsCan 14-10-0223"
      />
    </div>
  );
}

async function UnemploymentChart() {
  const { tableId, coordinate } = STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE;
  const data = await fetchStatCanTimeSeries(tableId, coordinate, 60);
  return (
    <Card>
      <CardHeader
        title="Alberta Unemployment Rate"
        subtitle="Seasonally adjusted — the broadest measure of labour market slack"
        badge="LIVE"
      />
      <TimeSeriesAreaChart data={data} color="#ef4444" valueSuffix="%" height={280} />
      <p className="text-[10px] text-muted/60 mt-2">
        Below 6% = tight market (wage pressure, labour shortages in trades).
        Above 8% = stress (layoffs, migration reversal). Alberta&apos;s natural rate is around 6-7%.
      </p>
    </Card>
  );
}

async function EmploymentChart() {
  const { tableId, coordinate } = STATSCAN_SERIES.AB_EMPLOYMENT;
  const data = await fetchStatCanTimeSeries(tableId, coordinate, 60);
  return (
    <Card>
      <CardHeader
        title="Alberta Employment (thousands)"
        subtitle="Total employed persons, seasonally adjusted"
        badge="LIVE"
      />
      <TimeSeriesAreaChart data={data} color="#3b82f6" compact height={250} />
    </Card>
  );
}

async function ParticipationChart() {
  const { tableId, coordinate } = STATSCAN_SERIES.AB_PARTICIPATION_RATE;
  const data = await fetchStatCanTimeSeries(tableId, coordinate, 60);
  return (
    <Card>
      <CardHeader
        title="Participation Rate"
        subtitle="% of working-age population in the labour force"
        badge="LIVE"
      />
      <TimeSeriesAreaChart data={data} color="#10b981" valueSuffix="%" height={250} />
      <p className="text-[10px] text-muted/60 mt-2">
        Alberta typically has Canada&apos;s highest participation rate. A drop signals discouraged workers leaving the labour force — often during busts.
      </p>
    </Card>
  );
}

async function EmploymentVsUnemploymentChart() {
  const [employment, unemployment] = await Promise.all([
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_EMPLOYMENT.tableId,
      STATSCAN_SERIES.AB_EMPLOYMENT.coordinate,
      60
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.tableId,
      STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.coordinate,
      60
    ).catch(() => []),
  ]);

  const dateMap = new Map<string, MultiSeriesPoint>();
  for (const p of employment) {
    dateMap.set(p.date, { date: p.date, employment: p.value, unemployment: 0 });
  }
  for (const p of unemployment) {
    const existing = dateMap.get(p.date);
    if (existing) existing.unemployment = p.value;
  }
  const merged = Array.from(dateMap.values())
    .filter((p) => p.employment && p.unemployment)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  return (
    <Card>
      <CardHeader
        title="Employment vs Unemployment Rate"
        subtitle="Are new jobs keeping up with population growth?"
        badge="LIVE"
      />
      <MultiSeriesLineChart
        data={merged}
        series={[
          { key: "employment", label: "Employment (K)", color: "#3b82f6", yAxisId: "left" },
          { key: "unemployment", label: "Unemployment %", color: "#ef4444", suffix: "%", yAxisId: "right" },
        ]}
        height={300}
        dualAxis
      />
    </Card>
  );
}

async function WeeklyEarningsChart() {
  const { tableId, coordinate } = STATSCAN_SERIES.AB_WEEKLY_EARNINGS;
  const data = await fetchStatCanTimeSeries(tableId, coordinate, 60);
  return (
    <Card>
      <CardHeader
        title="Average Weekly Earnings"
        subtitle="All employees, Alberta — wage growth indicator"
        badge="LIVE"
      />
      <TimeSeriesAreaChart data={data} color="#f59e0b" valuePrefix="$" height={250} />
      <p className="text-[10px] text-muted/60 mt-2">
        Alberta wages are typically 10-20% above the national average, driven by the energy sector premium.
        When the gap narrows, Alberta loses its migration pull.
      </p>
    </Card>
  );
}

async function EmploymentRateChart() {
  const { tableId, coordinate } = STATSCAN_SERIES.AB_EMPLOYMENT_RATE;
  const data = await fetchStatCanTimeSeries(tableId, coordinate, 60);
  return (
    <Card>
      <CardHeader
        title="Employment Rate"
        subtitle="% of working-age population employed — combines participation + unemployment"
        badge="LIVE"
      />
      <TimeSeriesAreaChart data={data} color="#8b5cf6" valueSuffix="%" height={250} />
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
// Context
// ============================================================

function LabourContext() {
  return (
    <Card>
      <h3 className="text-sm font-medium mb-3">Alberta&apos;s Labour Market Is Different</h3>
      <div className="space-y-3 text-xs text-muted">
        <p>
          Alberta&apos;s labour market is unusually concentrated. The energy sector pays 50-100% more than
          equivalent jobs elsewhere, creating a gravity well that pulls workers from every other sector.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="border border-card-border rounded-lg p-3">
            <p className="font-medium text-foreground mb-1">During Booms</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Trades workers are impossible to find</li>
              <li>Construction costs spike 30-50%</li>
              <li>Service sector can&apos;t compete on wages</li>
              <li>Interprovincial migration surges</li>
              <li>Renovation/building timelines extend</li>
            </ul>
          </div>
          <div className="border border-card-border rounded-lg p-3">
            <p className="font-medium text-foreground mb-1">During Busts</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Sudden labour surplus — 100K+ jobs lost</li>
              <li>Workers leave province within months</li>
              <li>Skilled trades available at lower rates</li>
              <li>Renovation bargains as contractors compete</li>
              <li>Service sector stabilizes, retail weakens</li>
            </ul>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ============================================================
// Page
// ============================================================

export default function LabourPage() {
  return (
    <main className="min-h-screen p-6 max-w-7xl mx-auto space-y-6">
      <header>
        <div className="flex items-center gap-2 mb-1">
          <HardHat size={20} className="text-blue-400" />
          <h1 className="text-xl font-semibold tracking-tight">
            Who&apos;s Working, Where?
          </h1>
        </div>
        <p className="text-sm text-muted">
          Alberta&apos;s labour market is uniquely concentrated — high wages in energy pull
          talent from every sector. When energy booms, trades vanish. When it busts,
          there&apos;s a surplus.
        </p>
      </header>

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
          <LabourMetrics />
        </Suspense>
      </section>

      {/* Hero: Unemployment */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={16} className="text-red-400" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            The Headline Number
          </h2>
        </div>
        <Suspense fallback={<LoadingCard />}>
          <UnemploymentChart />
        </Suspense>
      </section>

      {/* Employment vs Unemployment overlay */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Users size={16} className="text-blue-400" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Jobs vs Jobless
          </h2>
        </div>
        <Suspense fallback={<LoadingCard />}>
          <EmploymentVsUnemploymentChart />
        </Suspense>
      </section>

      {/* Detailed charts */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 size={16} className="text-emerald-400" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Labour Force Details
          </h2>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <EmploymentChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <ParticipationChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <EmploymentRateChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <WeeklyEarningsChart />
          </Suspense>
        </div>
      </section>

      {/* Context */}
      <section>
        <LabourContext />
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
                <p className="font-medium text-foreground">Employment by Industry</p>
                <p>Breakdown by NAICS sector — shows concentration risk and where growth is happening.</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
                PLANNED
              </span>
              <div>
                <p className="font-medium text-foreground">Job Vacancies by Sector</p>
                <p>StatsCan quarterly data on unfilled positions — leading indicator of hiring intent and skill shortages.</p>
              </div>
            </div>
          </div>
        </Card>
      </section>

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Alberta Pulse Check &mdash; Labour &mdash; All data from free public APIs
      </footer>
    </main>
  );
}
