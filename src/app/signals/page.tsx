import { Suspense } from "react";
import { Card, CardHeader } from "@/components/card";
import { TimeSeriesAreaChart, TimeSeriesBarChart } from "@/components/chart";
import {
  Radar,
  TrendingUp,
  TrendingDown,
  Minus,
  Building2,
  Briefcase,
  Landmark,
} from "lucide-react";
import {
  fetchBoCTimeSeries,
  fetchEdmontonPermitsSummary,
  fetchEdmontonBusinessLicences,
  fetchEdmontonDevPermits,
  fetchStatCanTimeSeries,
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

function formatChange(data: TimeSeriesPoint[]): string {
  if (data.length < 6) return "Insufficient data";
  const recent = data.slice(-3).reduce((s, p) => s + p.value, 0) / 3;
  const prior = data.slice(-6, -3).reduce((s, p) => s + p.value, 0) / 3;
  if (prior === 0) return "\u2014";
  const pctChange = ((recent - prior) / Math.abs(prior)) * 100;
  return `${pctChange >= 0 ? "+" : ""}${pctChange.toFixed(1)}% vs 3mo ago`;
}

// ============================================================
// Signal Summary
// ============================================================

async function SignalSummary() {
  const [
    permits,
    devPermits,
    licences,
    cmaUnits,
    policyRate,
    unemployment,
    cpi,
    cadUsd,
  ] = await Promise.all([
    fetchEdmontonPermitsSummary().catch(() => []),
    fetchEdmontonDevPermits().catch(() => []),
    fetchEdmontonBusinessLicences().catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.EDMONTON_CMA_RES_UNITS.tableId,
      STATSCAN_SERIES.EDMONTON_CMA_RES_UNITS.coordinate,
      12
    ).catch(() => []),
    fetchBoCTimeSeries(BOC_SERIES.POLICY_RATE, 12).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.tableId,
      STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.coordinate,
      12
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_CPI.tableId,
      STATSCAN_SERIES.AB_CPI.coordinate,
      12
    ).catch(() => []),
    fetchBoCTimeSeries(BOC_SERIES.CAD_USD, 12).catch(() => []),
  ]);

  const signals = [
    {
      name: "Building Permits",
      type: "leading" as const,
      data: permits,
      latest: permits.at(-1)?.value?.toLocaleString() ?? "\u2014",
      source: "Edmonton SODA",
    },
    {
      name: "Dev Permits",
      type: "leading" as const,
      data: devPermits,
      latest: devPermits.at(-1)?.value?.toLocaleString() ?? "\u2014",
      source: "Edmonton SODA",
    },
    {
      name: "Business Licences",
      type: "leading" as const,
      data: licences,
      latest: licences.at(-1)?.value?.toLocaleString() ?? "\u2014",
      source: "Edmonton SODA",
    },
    {
      name: "CMA Dwelling Units",
      type: "leading" as const,
      data: cmaUnits,
      latest: cmaUnits.at(-1)?.value?.toLocaleString() ?? "\u2014",
      source: "StatsCan",
    },
    {
      name: "BoC Policy Rate",
      type: "leading" as const,
      data: policyRate,
      latest: policyRate.at(-1)?.value
        ? `${policyRate.at(-1)!.value}%`
        : "\u2014",
      source: "Bank of Canada",
    },
    {
      name: "Unemployment",
      type: "coincident" as const,
      data: unemployment,
      latest: unemployment.at(-1)?.value
        ? `${unemployment.at(-1)!.value}%`
        : "\u2014",
      source: "StatsCan",
    },
    {
      name: "Alberta CPI",
      type: "coincident" as const,
      data: cpi,
      latest: cpi.at(-1)?.value?.toFixed(1) ?? "\u2014",
      source: "StatsCan",
    },
    {
      name: "CAD/USD",
      type: "coincident" as const,
      data: cadUsd,
      latest: cadUsd.at(-1)?.value
        ? `$${cadUsd.at(-1)!.value.toFixed(4)}`
        : "\u2014",
      source: "Bank of Canada",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {signals.map((s) => {
        const dir = getDirection(s.data);
        const change = formatChange(s.data);
        return (
          <Card key={s.name}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-xs text-muted">{s.name}</p>
                <p className="text-lg font-semibold tracking-tight">
                  {s.latest}
                </p>
              </div>
              <div
                className={`p-1.5 rounded-lg ${
                  dir === "up"
                    ? "bg-green-500/10"
                    : dir === "down"
                      ? "bg-red-500/10"
                      : "bg-slate-500/10"
                }`}
              >
                {dir === "up" && (
                  <TrendingUp size={16} className="text-accent-green" />
                )}
                {dir === "down" && (
                  <TrendingDown size={16} className="text-accent-red" />
                )}
                {dir === "flat" && (
                  <Minus size={16} className="text-muted" />
                )}
              </div>
            </div>
            <p
              className={`text-[10px] ${
                dir === "up"
                  ? "text-accent-green"
                  : dir === "down"
                    ? "text-accent-red"
                    : "text-muted"
              }`}
            >
              {change}
            </p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded ${
                  s.type === "leading"
                    ? "bg-amber-500/10 text-amber-400"
                    : "bg-blue-500/10 text-blue-400"
                }`}
              >
                {s.type === "leading" ? "LEADING" : "COINCIDENT"}
              </span>
              <span className="text-[9px] text-muted/60">{s.source}</span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// Chart sections
// ============================================================

async function PolicyRateChart() {
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

async function CadUsdChart() {
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

async function BuildingPermitsChart() {
  const data = await fetchEdmontonPermitsSummary();
  return (
    <Card>
      <CardHeader
        title="Edmonton Building Permits"
        subtitle="Monthly count since 2023"
        badge="LIVE"
      />
      <TimeSeriesBarChart data={data} color="#f59e0b" />
    </Card>
  );
}

async function DevPermitsChart() {
  const data = await fetchEdmontonDevPermits();
  return (
    <Card>
      <CardHeader
        title="Edmonton Development Permits"
        subtitle="Monthly count since 2023"
        badge="LIVE"
      />
      <TimeSeriesBarChart data={data} color="#06b6d4" />
    </Card>
  );
}

async function CmaUnitsChart() {
  const { tableId, coordinate } = STATSCAN_SERIES.EDMONTON_CMA_RES_UNITS;
  const data = await fetchStatCanTimeSeries(tableId, coordinate, 36);
  return (
    <Card>
      <CardHeader
        title="Edmonton CMA Dwelling Units"
        subtitle="Monthly new dwelling units created"
        badge="LIVE"
      />
      <TimeSeriesBarChart data={data} color="#3b82f6" />
    </Card>
  );
}

async function BusinessLicencesChart() {
  const data = await fetchEdmontonBusinessLicences();
  return (
    <Card>
      <CardHeader
        title="Edmonton Business Licences Issued"
        subtitle="Monthly since 2024"
        badge="LIVE"
      />
      <TimeSeriesBarChart data={data} color="#8b5cf6" />
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

// ============================================================
// Loading fallback
// ============================================================

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

export default function SignalsPage() {
  return (
    <main className="min-h-screen p-6 max-w-7xl mx-auto space-y-6">
      <header>
        <div className="flex items-center gap-2 mb-1">
          <Radar size={20} className="text-accent" />
          <h1 className="text-xl font-semibold tracking-tight">Signals</h1>
        </div>
        <p className="text-sm text-muted">
          Leading indicators side-by-side. When multiple arrows point the same
          direction, pay attention.
        </p>
        <div className="flex gap-4 mt-3 text-xs text-muted">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">
              LEADING
            </span>
            <span>Predicts future activity</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">
              COINCIDENT
            </span>
            <span>Moves with current activity</span>
          </div>
        </div>
      </header>

      {/* Signal Summary */}
      <section>
        <Suspense
          fallback={
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => (
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
          <SignalSummary />
        </Suspense>
      </section>

      {/* Section: Money & Borrowing */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Landmark size={16} className="text-accent" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Money &amp; Borrowing
          </h2>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <PolicyRateChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <CadUsdChart />
          </Suspense>
        </div>
      </section>

      {/* Section: Construction Pipeline */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Building2 size={16} className="text-accent-amber" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Construction Pipeline
          </h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <BuildingPermitsChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <DevPermitsChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <CmaUnitsChart />
          </Suspense>
        </div>
      </section>

      {/* Section: Business & Labour */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Briefcase size={16} className="text-accent-green" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Business &amp; Labour
          </h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <BusinessLicencesChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <UnemploymentChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <CpiChart />
          </Suspense>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Alberta Pulse Check &mdash; Signals &mdash; All data from free public APIs
      </footer>
    </main>
  );
}
