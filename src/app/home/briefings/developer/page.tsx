export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import {
  TrendingUp,
  TrendingDown,
  Building,
  Building2,
  Activity,
  Users,
  DollarSign,
  ChevronRight,
  MapPin,
  Layers,
  HardHat,
  AlertTriangle,
  BarChart3,
  Landmark,
} from "lucide-react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import {
  fetchBoCTimeSeries,
  fetchStatCanTimeSeries,
  fetchEdmontonPermitsSummary,
  fetchEdmontonDevPermits,
  BOC_SERIES,
  STATSCAN_SERIES,
  type TimeSeriesPoint,
} from "@/lib/data-sources";
import {
  fetchRegionalIndicator,
  type RegionalDataPoint,
} from "@/lib/data-sources-regional";
import {
  fetchAlbertaMajorProjects,
  fetchInfrastructureProjects,
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

function formatMoney(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function formatPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
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

function topMunis(data: RegionalDataPoint[], n = 5): { municipality: string; value: number; period: string }[] {
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
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}

// ============================================================
// Section 1: Quick Stats
// ============================================================

async function QuickStats() {
  const [housingStartsRaw, permitsRaw, populationRaw, policyRate] = await Promise.all([
    fetchRegionalIndicator("Housing Starts").catch(() => []),
    fetchEdmontonPermitsSummary().catch(() => []),
    fetchRegionalIndicator("Population").catch(() => []),
    fetchBoCTimeSeries(BOC_SERIES.POLICY_RATE, 6).catch(() => []),
  ]);

  const edmontonStarts = latestForMuni(housingStartsRaw, "Edmonton");
  const calgaryStarts = latestForMuni(housingStartsRaw, "Calgary");
  const permitLatest = permitsRaw.at(-1)?.value;
  const edmontonPop = latestForMuni(populationRaw, "Edmonton");
  const rate = policyRate.at(-1)?.value;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      <MetricCard
        title="Edmonton Starts"
        value={edmontonStarts != null ? Math.round(edmontonStarts).toLocaleString() : "—"}
        source="Regional Dashboard"
      />
      <MetricCard
        title="Calgary Starts"
        value={calgaryStarts != null ? Math.round(calgaryStarts).toLocaleString() : "—"}
        source="Regional Dashboard"
      />
      <MetricCard
        title="Edmonton Permits"
        value={permitLatest ? permitLatest.toLocaleString() : "—"}
        source="Edmonton SODA"
      />
      <MetricCard
        title="BoC Rate"
        value={rate ? `${rate.toFixed(2)}%` : "—"}
        source="Bank of Canada"
      />
    </div>
  );
}

// ============================================================
// Section 2: Market Read (macro signals for developers)
// ============================================================

async function MarketRead() {
  const [policyRate, mortgage5y, permits, devPermits, unemployment, housingStartsRaw, populationRaw, dwellingRaw] =
    await Promise.all([
      fetchBoCTimeSeries(BOC_SERIES.POLICY_RATE, 24).catch(() => []),
      fetchBoCTimeSeries(BOC_SERIES.MORTGAGE_5Y_FIXED, 24).catch(() => []),
      fetchEdmontonPermitsSummary().catch(() => []),
      fetchEdmontonDevPermits().catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.tableId,
        STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.coordinate,
        24
      ).catch(() => []),
      fetchRegionalIndicator("Housing Starts").catch(() => []),
      fetchRegionalIndicator("Population").catch(() => []),
      fetchRegionalIndicator("Dwelling Units").catch(() => []),
    ]);

  const rate = trend(policyRate);
  const mortgage = trend(mortgage5y);
  const permitTrend = trend(permits);
  const devTrend = trend(devPermits);
  const unemp = trend(unemployment);

  const bullets: { icon: React.ElementType; text: string; signal: "positive" | "negative" | "neutral" }[] = [];

  // Rate impact on construction financing
  if (rate.direction === "down") {
    bullets.push({
      icon: DollarSign,
      text: `BoC rate at ${rate.latest.toFixed(2)}%, trending down. Construction financing costs easing — better project economics for new starts.`,
      signal: "positive",
    });
  } else if (rate.direction === "up") {
    bullets.push({
      icon: DollarSign,
      text: `BoC rate at ${rate.latest.toFixed(2)}%, trending up. Rising construction financing costs — stress-test project pro formas at ${(rate.latest + 1).toFixed(1)}%.`,
      signal: "negative",
    });
  } else {
    bullets.push({
      icon: DollarSign,
      text: `BoC rate stable at ${rate.latest.toFixed(2)}%. Predictable financing environment for multi-year projects.`,
      signal: "neutral",
    });
  }

  // Mortgage rates — buyer demand signal
  if (mortgage.direction === "down") {
    bullets.push({
      icon: Building2,
      text: `5-year fixed at ${mortgage.latest.toFixed(2)}%, falling. Buyer qualifying power expanding — pre-sale demand should strengthen.`,
      signal: "positive",
    });
  } else if (mortgage.direction === "up") {
    bullets.push({
      icon: Building2,
      text: `5-year fixed at ${mortgage.latest.toFixed(2)}%, rising. Pre-sale conversion rates may slow — price accordingly or add incentives.`,
      signal: "negative",
    });
  }

  // Permit velocity — competition signal
  if (permitTrend.direction === "up") {
    bullets.push({
      icon: HardHat,
      text: `Edmonton building permits up ${formatPct(permitTrend.pct)}. Accelerating construction — watch for supply competition in 12-18 months.`,
      signal: "neutral",
    });
  } else if (permitTrend.direction === "down") {
    bullets.push({
      icon: HardHat,
      text: `Edmonton building permits down ${formatPct(permitTrend.pct)}. Slower pipeline — less future supply competition for current projects.`,
      signal: "positive",
    });
  }

  // Dev permits — pipeline signal
  if (devTrend.direction === "up") {
    bullets.push({
      icon: Layers,
      text: `Development permit activity up ${formatPct(devTrend.pct)}. More land being entitled — indicates developer confidence in demand.`,
      signal: "positive",
    });
  }

  // Population growth drives housing demand
  const edmontonPop = latestForMuni(populationRaw, "Edmonton");
  const calgaryPop = latestForMuni(populationRaw, "Calgary");
  if (edmontonPop != null && calgaryPop != null) {
    bullets.push({
      icon: Users,
      text: `Edmonton: ${Math.round(edmontonPop).toLocaleString()} | Calgary: ${Math.round(calgaryPop).toLocaleString()}. Population growth drives housing absorption — watch for year-over-year changes.`,
      signal: "neutral",
    });
  }

  // Employment
  if (unemp.direction === "up") {
    bullets.push({
      icon: AlertTriangle,
      text: `Alberta unemployment trending up (${unemp.latest.toFixed(1)}%). Weaker demand — defer spec builds, focus on pre-sold inventory.`,
      signal: "negative",
    });
  } else if (unemp.direction === "down") {
    bullets.push({
      icon: Activity,
      text: `Alberta unemployment falling (${unemp.latest.toFixed(1)}%). Strong labour market supports buyer confidence and absorption.`,
      signal: "positive",
    });
  }

  const positiveCount = bullets.filter((b) => b.signal === "positive").length;
  const negativeCount = bullets.filter((b) => b.signal === "negative").length;
  const overallSignal = positiveCount >= 3 ? "positive" : negativeCount >= 3 ? "negative" : "neutral";
  const overallLabel =
    overallSignal === "positive"
      ? "Favourable conditions for new development — demand and financing aligned"
      : overallSignal === "negative"
        ? "Caution — tighten underwriting, defer marginal projects"
        : "Mixed signals — pursue entitled land, be selective on new starts";

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
        <Link href="/home/dashboard" className="text-[10px] text-accent hover:underline flex items-center gap-1">
          Macro dashboard <ChevronRight size={10} />
        </Link>
        <Link href="/real-estate/pipeline" className="text-[10px] text-accent hover:underline flex items-center gap-1">
          Development pipeline <ChevronRight size={10} />
        </Link>
      </div>
    </div>
  );
}

// ============================================================
// Section 3: Development Opportunities
// ============================================================

async function DevelopmentOpportunities() {
  const [housingStartsRaw, buildingPermitsRaw, populationRaw, dwellingRaw, majorProjects, infraProjects] =
    await Promise.all([
      fetchRegionalIndicator("Housing Starts").catch(() => []),
      fetchRegionalIndicator("Building Permits").catch(() => []),
      fetchRegionalIndicator("Population").catch(() => []),
      fetchRegionalIndicator("Dwelling Units").catch(() => []),
      fetchAlbertaMajorProjects().catch(() => []),
      fetchInfrastructureProjects("Alberta").catch(() => []),
    ]);

  // Housing starts by municipality
  const topStarts = topMunis(housingStartsRaw, 8);

  // Building permits by municipality
  const topPermits = topMunis(buildingPermitsRaw, 8);

  // Population-to-dwelling ratio — high ratio = undersupplied
  interface AbsorptionRow {
    municipality: string;
    population: number;
    dwellings: number;
    ratio: number;
    starts: number;
    signal: "strong" | "moderate" | "caution";
    narrative: string;
  }

  const absorptionRows: AbsorptionRow[] = [];
  const munis = new Set<string>();
  for (const pt of populationRaw) munis.add(pt.municipality);

  for (const muni of munis) {
    const pop = latestForMuni(populationRaw, muni);
    const dwell = latestForMuni(dwellingRaw, muni);
    const starts = latestForMuni(housingStartsRaw, muni);
    if (pop == null || dwell == null || dwell <= 0 || pop < 5000) continue;

    const ratio = pop / dwell;
    let signal: AbsorptionRow["signal"];
    let narrative: string;

    if (ratio > 2.8) {
      signal = "strong";
      narrative = `${ratio.toFixed(2)} people per dwelling — above average density signals undersupply. Strong absorption potential for new units.`;
    } else if (ratio < 2.2) {
      signal = "caution";
      narrative = `${ratio.toFixed(2)} people per dwelling — lower density suggests adequate supply. Compete on quality/location, not volume.`;
    } else {
      signal = "moderate";
      narrative = `${ratio.toFixed(2)} people per dwelling — balanced supply. Steady absorption for well-located projects.`;
    }

    absorptionRows.push({
      municipality: muni,
      population: pop,
      dwellings: dwell,
      ratio,
      starts: starts ?? 0,
      signal,
      narrative,
    });
  }

  absorptionRows.sort((a, b) => b.ratio - a.ratio);
  const topAbsorption = absorptionRows.slice(0, 8);

  // Infrastructure projects near development — filter for construction/housing related
  const relevantInfra = infraProjects
    .filter((p) => p.fundingAmount > 1_000_000)
    .sort((a, b) => b.fundingAmount - a.fundingAmount)
    .slice(0, 5);

  const relevantMajor = majorProjects
    .filter((p) => {
      const sector = p.sector.toLowerCase();
      return sector.includes("commercial") || sector.includes("residential") ||
             sector.includes("infrastructure") || sector.includes("institutional") ||
             sector.includes("mixed") || sector.includes("recreation") || sector.includes("power");
    })
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 5);

  return (
    <div className="space-y-5">
      {/* Housing starts leaders */}
      {topStarts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Building size={14} className="text-accent" />
            <span className="text-xs font-medium text-accent uppercase tracking-wide">
              Housing Starts Leaders
            </span>
          </div>
          <p className="text-[10px] text-muted mb-2">
            Municipalities with highest housing starts. High starts = active market but also competition for trades and materials.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {topStarts.map((m) => (
              <div key={m.municipality} className="p-2 rounded border border-card-border bg-card/50 text-center">
                <p className="text-sm font-medium truncate">{m.municipality}</p>
                <p className="text-lg font-semibold">{Math.round(m.value).toLocaleString()}</p>
                <p className="text-[9px] text-muted">starts</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Absorption proxy — population/dwelling ratio */}
      {topAbsorption.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Users size={14} className="text-green-400" />
            <span className="text-xs font-medium text-green-400 uppercase tracking-wide">
              Absorption Signal — Population per Dwelling
            </span>
          </div>
          <p className="text-[10px] text-muted mb-2">
            Higher ratio = more people per home = undersupply. Best markets for new inventory absorption.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] text-muted uppercase border-b border-card-border">
                  <th className="text-left py-1.5 pr-3">Municipality</th>
                  <th className="text-right py-1.5 px-2">Population</th>
                  <th className="text-right py-1.5 px-2">Dwellings</th>
                  <th className="text-right py-1.5 px-2">Ratio</th>
                  <th className="text-right py-1.5 px-2">Starts</th>
                  <th className="text-left py-1.5 pl-2">Signal</th>
                </tr>
              </thead>
              <tbody>
                {topAbsorption.map((row) => (
                  <tr key={row.municipality} className="border-b border-card-border/50">
                    <td className="py-1.5 pr-3 font-medium">{row.municipality}</td>
                    <td className="text-right py-1.5 px-2">{Math.round(row.population).toLocaleString()}</td>
                    <td className="text-right py-1.5 px-2">{Math.round(row.dwellings).toLocaleString()}</td>
                    <td className={`text-right py-1.5 px-2 font-mono ${row.ratio > 2.8 ? "text-green-400" : row.ratio < 2.2 ? "text-orange-400" : "text-muted"}`}>
                      {row.ratio.toFixed(2)}
                    </td>
                    <td className="text-right py-1.5 px-2">{row.starts > 0 ? Math.round(row.starts).toLocaleString() : "—"}</td>
                    <td className="py-1.5 pl-2"><SignalBadge signal={row.signal} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Infrastructure near development */}
      {(relevantMajor.length > 0 || relevantInfra.length > 0) && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Landmark size={14} className="text-purple-400" />
            <span className="text-xs font-medium text-purple-400 uppercase tracking-wide">
              Infrastructure Pipeline — Development Catalysts
            </span>
          </div>
          <p className="text-[10px] text-muted mb-2">
            Major projects that create demand, improve access, or signal government investment near development areas.
          </p>
          <div className="space-y-1.5">
            {relevantMajor.map((p, i) => (
              <div
                key={`major-${i}`}
                className="flex items-start justify-between p-2 rounded border border-purple-500/15 bg-purple-500/5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{p.name}</p>
                  <p className="text-[10px] text-muted">
                    {p.sector} · {p.stage} · {p.location || p.municipality}
                  </p>
                </div>
                <span className="text-xs font-mono text-muted shrink-0 ml-2">
                  {p.cost > 0 ? formatMoney(p.cost * 1_000_000) : "—"}
                </span>
              </div>
            ))}
            {relevantInfra.map((p, i) => (
              <div
                key={`infra-${i}`}
                className="flex items-start justify-between p-2 rounded border border-card-border bg-card/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{p.name}</p>
                  <p className="text-[10px] text-muted">
                    Federal · {p.status} · {p.location}
                  </p>
                </div>
                <span className="text-xs font-mono text-muted shrink-0 ml-2">{formatMoney(p.fundingAmount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Link href="/real-estate/pipeline" className="text-[10px] text-accent hover:underline flex items-center gap-1">
          Development pipeline <ChevronRight size={10} />
        </Link>
        <Link href="/economy/corridors" className="text-[10px] text-accent hover:underline flex items-center gap-1">
          Growth corridors <ChevronRight size={10} />
        </Link>
        <Link href="/real-estate/neighbourhoods" className="text-[10px] text-accent hover:underline flex items-center gap-1">
          Neighbourhood signals <ChevronRight size={10} />
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

export default function DeveloperBriefingPage() {
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
        <Link href="/home/briefings" className="hover:text-accent">Briefings</Link>
        <ChevronRight size={10} />
        <span>Developer</span>
      </div>
      <PageHeader
        title="Developer / Homebuilder Briefing"
        description="Housing starts, permit velocity, absorption signals, and infrastructure pipeline — everything you need to plan land acquisition and project timing."
        category="overview"
        icon={<Building size={20} />}
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
          subtitle="Macro signals that affect project financing, buyer demand, and construction timing"
          badge="LIVE"
        />
        <Suspense fallback={<LoadingSection />}>
          <MarketRead />
        </Suspense>
      </Card>

      {/* Development Opportunities */}
      <Card>
        <CardHeader
          title="Development Opportunities"
          subtitle="Housing starts, absorption proxies, and infrastructure catalysts by municipality"
          badge="LIVE"
        />
        <Suspense fallback={<LoadingSection />}>
          <DevelopmentOpportunities />
        </Suspense>
      </Card>

      {/* Deep Dive Links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {[
          { href: "/real-estate/pipeline", label: "Pipeline", icon: Layers, desc: "Dev permits + stages" },
          { href: "/economy/corridors", label: "Corridors", icon: MapPin, desc: "Growth directions" },
          { href: "/real-estate/neighbourhoods", label: "Neighbourhoods", icon: Building2, desc: "Micro signals" },
          { href: "/home/dashboard", label: "Dashboard", icon: BarChart3, desc: "Full macro view" },
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
          Data from Edmonton Open Data, Alberta Regional Dashboard, Infrastructure Canada, and Alberta Major Projects.
          Housing starts, population, and dwelling data from regionaldashboard.alberta.ca.
        </p>
        <p className="text-[10px] text-muted/60 mt-1">
          This briefing frames the same live data as the full dashboard for development decisions.
        </p>
      </Card>
    </main>
  );
}
