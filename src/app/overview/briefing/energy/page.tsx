import { Suspense } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import {
  Flame,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  ChevronRight,
  BarChart3,
  Droplets,
  Factory,
  Pickaxe,
} from "lucide-react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import {
  fetchBoCTimeSeries,
  BOC_SERIES,
  type TimeSeriesPoint,
} from "@/lib/data-sources";
import {
  fetchRegionalIndicator,
  type RegionalDataPoint,
} from "@/lib/data-sources-regional";
import {
  fetchCrudeOilProduction,
  fetchPipelineThroughput,
  fetchPipelineIncidents,
} from "@/lib/data-sources-cer";
import {
  fetchAlbertaMajorProjects,
  fetchAERWellLicences,
} from "@/lib/data-sources-infrastructure";

// ============================================================
// Helpers
// ============================================================

function trend(data: TimeSeriesPoint[], months = 3): {
  direction: "up" | "down" | "flat";
  pct: number;
  latest: number;
} {
  if (data.length < months * 2) return { direction: "flat", pct: 0, latest: data.at(-1)?.value ?? 0 };
  const recent = data.slice(-months).reduce((s, p) => s + p.value, 0) / months;
  const prior = data.slice(-months * 2, -months).reduce((s, p) => s + p.value, 0) / months;
  const latest = data.at(-1)?.value ?? 0;
  if (prior === 0) return { direction: "flat", pct: 0, latest };
  const pct = ((recent - prior) / Math.abs(prior)) * 100;
  if (pct > 2) return { direction: "up", pct, latest };
  if (pct < -2) return { direction: "down", pct, latest };
  return { direction: "flat", pct, latest };
}

function formatPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatMoney(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function SignalBadge({ signal }: { signal: string }) {
  const colors: Record<string, string> = {
    hot: "bg-red-500/15 text-red-400",
    warming: "bg-amber-500/15 text-amber-400",
    stable: "bg-blue-500/15 text-blue-400",
    cooling: "bg-cyan-500/15 text-cyan-400",
    strong: "bg-green-500/15 text-green-400",
    caution: "bg-orange-500/15 text-orange-400",
    positive: "bg-green-500/15 text-green-400",
    negative: "bg-red-500/15 text-red-400",
    neutral: "bg-gray-500/15 text-gray-400",
    active: "bg-green-500/15 text-green-400",
  };
  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-mono ${colors[signal] ?? colors.neutral}`}>
      {signal}
    </span>
  );
}

function latestForMuni(data: RegionalDataPoint[], muni: string): number | null {
  const rows = data
    .filter((d) => d.municipality.toLowerCase() === muni.toLowerCase())
    .sort((a, b) => b.period.localeCompare(a.period));
  return rows.length > 0 ? rows[0].value : null;
}

function topMunis(data: RegionalDataPoint[], n = 10, ascending = false): { municipality: string; value: number; period: string }[] {
  const latest = new Map<string, { value: number; period: string }>();
  for (const pt of data) {
    const existing = latest.get(pt.municipality);
    if (!existing || pt.period > existing.period) {
      latest.set(pt.municipality, { value: pt.value, period: pt.period });
    }
  }
  return Array.from(latest.entries())
    .map(([municipality, { value, period }]) => ({ municipality, value, period }))
    .filter((m) => m.value > 0)
    .sort((a, b) => ascending ? a.value - b.value : b.value - a.value)
    .slice(0, n);
}

// ============================================================
// Section 1: Quick Stats
// ============================================================

async function QuickStats() {
  const [wellCountRaw, bcpiEnergy, crudeProduction] = await Promise.all([
    fetchRegionalIndicator("Well Count").catch(() => []),
    fetchBoCTimeSeries(BOC_SERIES.BCPI_ENERGY, 6).catch(() => []),
    fetchCrudeOilProduction("Alberta").catch(() => []),
  ]);

  // Total well count across all municipalities
  const topWells = topMunis(wellCountRaw, 100);
  const totalWells = topWells.reduce((sum, m) => sum + m.value, 0);

  // Commodity index
  const bcpiLatest = bcpiEnergy.at(-1)?.value;

  // Latest crude production
  const latestCrude = crudeProduction.at(-1);

  // Pipeline utilization — try Trans Mountain
  const tmThroughput = await fetchPipelineThroughput("TRANS_MOUNTAIN_THROUGHPUT").catch(() => []);
  const latestTm = tmThroughput.at(-1);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      <MetricCard
        title="Total Well Count"
        value={totalWells > 0 ? formatNum(totalWells) : "—"}
        source="Regional Dashboard"
      />
      <MetricCard
        title="AB Crude Production"
        value={latestCrude ? `${formatNum(latestCrude.volume)} kb/d` : "—"}
        source="CER"
      />
      <MetricCard
        title="Trans Mountain Util."
        value={latestTm ? `${(latestTm.utilization * 100).toFixed(0)}%` : "—"}
        source="CER"
      />
      <MetricCard
        title="BCPI Energy"
        value={bcpiLatest ? bcpiLatest.toFixed(1) : "—"}
        source="Bank of Canada"
      />
    </div>
  );
}

// ============================================================
// Section 2: Market Read (production trends + commodity signals)
// ============================================================

async function MarketRead() {
  const [bcpiEnergy, bcpiAll, crudeProduction, incidents, wellLicences] =
    await Promise.all([
      fetchBoCTimeSeries(BOC_SERIES.BCPI_ENERGY, 24).catch(() => []),
      fetchBoCTimeSeries(BOC_SERIES.BCPI_ALL, 24).catch(() => []),
      fetchCrudeOilProduction("Alberta").catch(() => []),
      fetchPipelineIncidents().catch(() => []),
      fetchAERWellLicences().catch(() => []),
    ]);

  const energyIdx = trend(bcpiEnergy);
  const allIdx = trend(bcpiAll);

  const bullets: { icon: React.ElementType; text: string; signal: "positive" | "negative" | "neutral" }[] = [];

  // Commodity price trajectory
  if (energyIdx.latest > 0) {
    if (energyIdx.direction === "up") {
      bullets.push({
        icon: TrendingUp,
        text: `BCPI Energy index at ${energyIdx.latest.toFixed(1)}, trending up (${formatPct(energyIdx.pct)}). Rising commodity prices support capital investment and drilling activity.`,
        signal: "positive",
      });
    } else if (energyIdx.direction === "down") {
      bullets.push({
        icon: TrendingDown,
        text: `BCPI Energy index at ${energyIdx.latest.toFixed(1)}, trending down (${formatPct(energyIdx.pct)}). Falling commodity prices may slow capital deployment and new well licencing.`,
        signal: "negative",
      });
    } else {
      bullets.push({
        icon: Activity,
        text: `BCPI Energy index stable at ${energyIdx.latest.toFixed(1)}. Flat commodity prices = steady-state operations, no rush to expand or contract.`,
        signal: "neutral",
      });
    }
  }

  // Crude production trend
  if (crudeProduction.length >= 6) {
    const recentProd = crudeProduction.slice(-3);
    const priorProd = crudeProduction.slice(-6, -3);
    const recentAvg = recentProd.reduce((s, p) => s + p.volume, 0) / recentProd.length;
    const priorAvg = priorProd.reduce((s, p) => s + p.volume, 0) / priorProd.length;
    const prodPct = priorAvg > 0 ? ((recentAvg - priorAvg) / priorAvg) * 100 : 0;

    if (prodPct > 2) {
      bullets.push({
        icon: Droplets,
        text: `Alberta crude production averaging ${formatNum(recentAvg)} kb/d, up ${formatPct(prodPct)} vs prior quarter. Increasing output = strong field services demand.`,
        signal: "positive",
      });
    } else if (prodPct < -2) {
      bullets.push({
        icon: Droplets,
        text: `Alberta crude production averaging ${formatNum(recentAvg)} kb/d, down ${formatPct(prodPct)}. Declining output — watch for curtailments and reduced well completions.`,
        signal: "negative",
      });
    } else {
      bullets.push({
        icon: Droplets,
        text: `Alberta crude production steady at ~${formatNum(recentAvg)} kb/d. Stable output supports existing service contracts.`,
        signal: "neutral",
      });
    }
  }

  // Well licence activity
  if (wellLicences.length > 0) {
    bullets.push({
      icon: Pickaxe,
      text: `${wellLicences.length} recent well licences issued by AER. ${wellLicences.length > 50 ? "Active licensing pace — drilling activity accelerating." : wellLicences.length > 20 ? "Moderate licensing activity." : "Light licensing — operators being selective."}`,
      signal: wellLicences.length > 50 ? "positive" : wellLicences.length > 20 ? "neutral" : "negative",
    });
  }

  // Pipeline incidents
  if (incidents.length > 0) {
    const recentIncidents = incidents.filter((inc) => {
      const d = new Date(inc.date);
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      return d >= oneYearAgo;
    });
    bullets.push({
      icon: AlertTriangle,
      text: `${recentIncidents.length} pipeline incidents reported in past 12 months (${incidents.length} total on record). ${recentIncidents.length > 20 ? "Elevated — monitor for regulatory tightening." : "Within normal range."}`,
      signal: recentIncidents.length > 20 ? "caution" : "neutral",
    });
  }

  const positiveCount = bullets.filter((b) => b.signal === "positive").length;
  const negativeCount = bullets.filter((b) => b.signal === "negative").length;
  const overallSignal = positiveCount >= 3 ? "positive" : negativeCount >= 3 ? "negative" : "neutral";
  const overallLabel =
    overallSignal === "positive"
      ? "Bullish energy environment — production and prices aligned"
      : overallSignal === "negative"
        ? "Headwinds — commodity weakness and slowing activity"
        : "Mixed conditions — selective deployment warranted";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Activity size={14} className="text-accent" />
        <span className="text-xs font-medium uppercase tracking-wide">Market Read</span>
        <SignalBadge signal={overallSignal} />
      </div>
      <p className="text-xs text-muted italic">{overallLabel}</p>
      <div className="space-y-2">
        {bullets.map((b, i) => {
          const Icon = b.icon;
          return (
            <div
              key={i}
              className={`flex items-start gap-2.5 p-2.5 rounded-lg border ${
                b.signal === "positive"
                  ? "border-green-500/20 bg-green-500/5"
                  : b.signal === "negative"
                    ? "border-red-500/20 bg-red-500/5"
                    : "border-card-border bg-card/50"
              }`}
            >
              <Icon size={13} className="mt-0.5 text-muted shrink-0" />
              <p className="text-xs leading-relaxed">{b.text}</p>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 mt-3">
        <Link href="/economy/energy" className="text-[10px] text-accent hover:underline flex items-center gap-1">
          Energy dashboard <ChevronRight size={10} />
        </Link>
        <Link href="/dashboard" className="text-[10px] text-accent hover:underline flex items-center gap-1">
          Macro dashboard <ChevronRight size={10} />
        </Link>
      </div>
    </div>
  );
}

// ============================================================
// Section 3: Activity (well counts, major projects, regional)
// ============================================================

async function EnergyActivity() {
  const [wellCountRaw, majorProjects, wellLicences] = await Promise.all([
    fetchRegionalIndicator("Well Count").catch(() => []),
    fetchAlbertaMajorProjects().catch(() => []),
    fetchAERWellLicences().catch(() => []),
  ]);

  // Top municipalities by well count
  const topWells = topMunis(wellCountRaw, 10);

  // Energy sector major projects
  const energyProjects = majorProjects
    .filter((p) => {
      const sector = p.sector?.toLowerCase() ?? "";
      return sector.includes("oil") || sector.includes("gas") || sector.includes("energy") ||
             sector.includes("pipeline") || sector.includes("petro");
    })
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 8);

  // Well licence summary by substance
  const substanceCounts = new Map<string, number>();
  for (const wl of wellLicences) {
    const sub = wl.substance || "Unknown";
    substanceCounts.set(sub, (substanceCounts.get(sub) ?? 0) + 1);
  }
  const substanceRows = Array.from(substanceCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <div className="space-y-5">
      {/* Regional well counts */}
      {topWells.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Pickaxe size={14} className="text-orange-400" />
            <span className="text-xs font-medium text-orange-400 uppercase tracking-wide">
              Well Count by Municipality
            </span>
          </div>
          <p className="text-[10px] text-muted mb-2">
            Regional dashboard well counts — indicates drilling concentration and service deployment opportunities.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] text-muted uppercase border-b border-card-border">
                  <th className="text-left py-1.5 pr-3">Municipality</th>
                  <th className="text-right py-1.5 px-2">Wells</th>
                  <th className="text-right py-1.5 pl-2">Period</th>
                </tr>
              </thead>
              <tbody>
                {topWells.map((row) => (
                  <tr key={row.municipality} className="border-b border-card-border/50">
                    <td className="py-1.5 pr-3 font-medium">{row.municipality}</td>
                    <td className="text-right py-1.5 px-2 font-mono">{formatNum(row.value)}</td>
                    <td className="text-right py-1.5 pl-2 text-muted">{row.period}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Well licences by substance */}
      {substanceRows.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Droplets size={14} className="text-cyan-400" />
            <span className="text-xs font-medium text-cyan-400 uppercase tracking-wide">
              Recent Well Licences by Substance
            </span>
          </div>
          <p className="text-[10px] text-muted mb-2">
            AER well licence filings — what operators are drilling for right now.
          </p>
          <div className="space-y-1.5">
            {substanceRows.map(([substance, count]) => (
              <div
                key={substance}
                className="flex items-center justify-between p-2 rounded border border-card-border bg-card/50"
              >
                <span className="text-sm font-medium">{substance}</span>
                <span className="text-xs font-mono text-muted">{count} licences</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Major energy projects */}
      {energyProjects.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Factory size={14} className="text-amber-400" />
            <span className="text-xs font-medium text-amber-400 uppercase tracking-wide">
              Major Energy Projects
            </span>
          </div>
          <p className="text-[10px] text-muted mb-2">
            Alberta major projects (&gt;$5M) in the energy sector — capital deployment and construction activity.
          </p>
          <div className="space-y-1.5">
            {energyProjects.map((p, i) => (
              <div
                key={i}
                className="p-2.5 rounded-lg border border-amber-500/15 bg-amber-500/5"
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="text-sm font-medium">{p.name}</span>
                  <span className="text-xs font-mono text-muted">{formatMoney(p.cost)}</span>
                </div>
                <div className="flex flex-wrap gap-x-3 text-[10px] text-muted">
                  <span>{p.stage}</span>
                  {p.municipality && <span>{p.municipality}</span>}
                  <span>{p.type}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Link href="/economy/energy" className="text-[10px] text-accent hover:underline flex items-center gap-1">
          Energy dashboard <ChevronRight size={10} />
        </Link>
        <Link href="/economy/drilling" className="text-[10px] text-accent hover:underline flex items-center gap-1">
          Drilling activity <ChevronRight size={10} />
        </Link>
      </div>
    </div>
  );
}

// ============================================================
// Loading fallbacks
// ============================================================

function LoadingSection() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-16 rounded-lg bg-card-border/30 animate-pulse" />
      ))}
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-20 rounded-xl bg-card-border/30 animate-pulse" />
      ))}
    </div>
  );
}

// ============================================================
// Page
// ============================================================

export default function EnergyBriefingPage() {
  const today = new Date().toLocaleDateString("en-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2 text-[10px] text-muted mb-2">
        <Link href="/overview/briefing" className="hover:text-accent">Briefings</Link>
        <ChevronRight size={10} />
        <span>Energy</span>
      </div>
      <PageHeader
        title="Energy Briefing"
        description="Production trends, well licensing, commodity prices, pipeline utilization, and major projects — the pulse of Alberta energy."
        category="overview"
        icon={<Flame size={20} />}
      >
        <p className="text-xs text-muted">{today}</p>
      </PageHeader>

      {/* Quick Stats */}
      <Suspense fallback={<LoadingGrid />}>
        <QuickStats />
      </Suspense>

      {/* Market Read */}
      <Card>
        <CardHeader
          title="Market Read"
          subtitle="Commodity prices, production trends, well licensing, and pipeline signals"
          badge="LIVE"
        />
        <Suspense fallback={<LoadingSection />}>
          <MarketRead />
        </Suspense>
      </Card>

      {/* Energy Activity */}
      <Card>
        <CardHeader
          title="Activity"
          subtitle="Well counts by municipality, AER licences, and major energy projects"
          badge="LIVE"
        />
        <Suspense fallback={<LoadingSection />}>
          <EnergyActivity />
        </Suspense>
      </Card>

      {/* Deep Dive Links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {[
          { href: "/economy/energy", label: "Energy", icon: Flame, desc: "Full dashboard" },
          { href: "/economy/drilling", label: "Drilling", icon: Pickaxe, desc: "Well activity" },
          { href: "/dashboard", label: "Dashboard", icon: BarChart3, desc: "Macro view" },
          { href: "/overview/signals", label: "Signals", icon: Activity, desc: "Indicators" },
        ].map((link) => {
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href}>
              <Card className="group hover:border-accent/40 transition-colors h-full">
                <Icon size={16} className="text-muted group-hover:text-accent mb-1.5" />
                <p className="text-xs font-medium">{link.label}</p>
                <p className="text-[10px] text-muted">{link.desc}</p>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Footer */}
      <Card className="text-center">
        <p className="text-[10px] text-muted">
          Data from Canada Energy Regulator (CER), Alberta Energy Regulator (AER),
          Bank of Canada commodity indexes, and Alberta Regional Dashboard.
        </p>
        <p className="text-[10px] text-muted/60 mt-1">
          This briefing frames energy data for operators, service companies, and sector analysts.
        </p>
      </Card>
    </main>
  );
}
