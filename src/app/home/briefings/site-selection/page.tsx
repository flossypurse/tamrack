import { Suspense } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import {
  TrendingUp,
  TrendingDown,
  MapPin,
  Users,
  Store,
  Building2,
  Activity,
  ChevronRight,
  BarChart3,
  Briefcase,
  Home,
  Target,
} from "lucide-react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import {
  fetchRegionalIndicator,
  type RegionalDataPoint,
} from "@/lib/data-sources-regional";

// ============================================================
// Helpers
// ============================================================

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
    underserved: "bg-purple-500/15 text-purple-400",
    saturated: "bg-orange-500/15 text-orange-400",
    growing: "bg-green-500/15 text-green-400",
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
  const [populationRaw, incorporationsRaw] = await Promise.all([
    fetchRegionalIndicator("Population").catch(() => []),
    fetchRegionalIndicator("Incorporations").catch(() => []),
  ]);

  const edmontonPop = latestForMuni(populationRaw, "Edmonton");
  const calgaryPop = latestForMuni(populationRaw, "Calgary");

  // Find top growth municipality (excluding Edmonton/Calgary)
  const topPop = topMunis(populationRaw, 20);
  const topGrowth = topPop.find(
    (m) => m.municipality !== "Edmonton" && m.municipality !== "Calgary"
  );

  // Total incorporations across all municipalities
  const incorpLatest = topMunis(incorporationsRaw, 100);
  const totalIncorp = incorpLatest.reduce((sum, m) => sum + m.value, 0);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      <MetricCard
        title="Edmonton Pop"
        value={edmontonPop != null ? formatNum(edmontonPop) : "—"}
        source="Regional Dashboard"
      />
      <MetricCard
        title="Calgary Pop"
        value={calgaryPop != null ? formatNum(calgaryPop) : "—"}
        source="Regional Dashboard"
      />
      <MetricCard
        title={topGrowth ? `${topGrowth.municipality} Pop` : "Top Satellite"}
        value={topGrowth ? formatNum(topGrowth.value) : "—"}
        source="Regional Dashboard"
      />
      <MetricCard
        title="Total Incorporations"
        value={totalIncorp > 0 ? totalIncorp.toLocaleString() : "—"}
        source="Regional Dashboard"
      />
    </div>
  );
}

// ============================================================
// Section 2: Market Read (growth corridors + business density)
// ============================================================

async function MarketRead() {
  const [populationRaw, businessRaw, incorporationsRaw, permitsRaw, vacancyRaw, incomeRaw] =
    await Promise.all([
      fetchRegionalIndicator("Population").catch(() => []),
      fetchRegionalIndicator("Business Counts").catch(() => []),
      fetchRegionalIndicator("Incorporations").catch(() => []),
      fetchRegionalIndicator("Building Permits").catch(() => []),
      fetchRegionalIndicator("Vacancy Rates").catch(() => []),
      fetchRegionalIndicator("Median Household Income").catch(() => []),
    ]);

  const bullets: { icon: React.ElementType; text: string; signal: "positive" | "negative" | "neutral" }[] = [];

  // Population growth corridors
  const topPopMunis = topMunis(populationRaw, 10);
  const edPop = latestForMuni(populationRaw, "Edmonton");
  const cgPop = latestForMuni(populationRaw, "Calgary");
  if (topPopMunis.length > 0) {
    const satellites = topPopMunis
      .filter((m) => m.municipality !== "Edmonton" && m.municipality !== "Calgary")
      .slice(0, 3);
    if (satellites.length > 0) {
      const satList = satellites.map((m) => `${m.municipality} (${formatNum(m.value)})`).join(", ");
      bullets.push({
        icon: Users,
        text: `Largest satellite markets: ${satList}. These represent the growth corridors between Edmonton and Calgary — expanding consumer bases for new locations.`,
        signal: "positive",
      });
    }
  }

  // Business density signals
  const topBiz = topMunis(businessRaw, 10);
  if (topBiz.length > 0) {
    const topBizSatellites = topBiz
      .filter((m) => m.municipality !== "Edmonton" && m.municipality !== "Calgary")
      .slice(0, 3);
    if (topBizSatellites.length > 0) {
      const bizList = topBizSatellites.map((m) => `${m.municipality} (${formatNum(m.value)})`).join(", ");
      bullets.push({
        icon: Store,
        text: `Highest business density outside metros: ${bizList}. Established commercial ecosystems — consider co-tenancy or competitive positioning.`,
        signal: "neutral",
      });
    }
  }

  // New incorporations = entrepreneurial energy
  const topIncorp = topMunis(incorporationsRaw, 5);
  if (topIncorp.length > 0) {
    const incorpList = topIncorp.slice(0, 3).map((m) => `${m.municipality} (${Math.round(m.value)})`).join(", ");
    bullets.push({
      icon: Briefcase,
      text: `Top incorporation activity: ${incorpList}. New business formation signals growing demand for B2B services and commercial space.`,
      signal: "positive",
    });
  }

  // Building permits = residential growth
  const topPermits = topMunis(permitsRaw, 10);
  const permitSatellites = topPermits
    .filter((m) => m.municipality !== "Edmonton" && m.municipality !== "Calgary")
    .slice(0, 3);
  if (permitSatellites.length > 0) {
    const permitList = permitSatellites.map((m) => `${m.municipality} (${formatNum(m.value)})`).join(", ");
    bullets.push({
      icon: Building2,
      text: `Residential growth leaders: ${permitList}. Active building = incoming rooftops. New households = immediate consumer demand.`,
      signal: "positive",
    });
  }

  // Vacancy as availability signal
  const lowVacancy = topMunis(vacancyRaw, 20, true).filter((m) => m.value > 0).slice(0, 3);
  if (lowVacancy.length > 0) {
    const vacList = lowVacancy.map((m) => `${m.municipality} (${m.value.toFixed(1)}%)`).join(", ");
    bullets.push({
      icon: Home,
      text: `Tightest rental markets: ${vacList}. Low vacancy = strong housing demand and stable consumer spending power.`,
      signal: "positive",
    });
  }

  const positiveCount = bullets.filter((b) => b.signal === "positive").length;
  const overallSignal = positiveCount >= 3 ? "positive" : positiveCount >= 1 ? "neutral" : "negative";
  const overallLabel =
    overallSignal === "positive"
      ? "Multiple growth corridors active — expansion window open"
      : "Selective opportunities — focus on specific corridors";

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
        <Link href="/economy/corridors" className="text-[10px] text-accent hover:underline flex items-center gap-1">
          Growth corridors <ChevronRight size={10} />
        </Link>
        <Link href="/economy/compare" className="text-[10px] text-accent hover:underline flex items-center gap-1">
          Municipality compare <ChevronRight size={10} />
        </Link>
      </div>
    </div>
  );
}

// ============================================================
// Section 3: Trade Area Analysis
// ============================================================

async function TradeAreaAnalysis() {
  const [populationRaw, businessRaw, incomeRaw, vacancyRaw, permitsRaw] = await Promise.all([
    fetchRegionalIndicator("Population").catch(() => []),
    fetchRegionalIndicator("Business Counts").catch(() => []),
    fetchRegionalIndicator("Median Household Income").catch(() => []),
    fetchRegionalIndicator("Vacancy Rates").catch(() => []),
    fetchRegionalIndicator("Building Permits").catch(() => []),
  ]);

  // Build municipality comparison
  interface TradeRow {
    municipality: string;
    population: number | null;
    businesses: number | null;
    income: number | null;
    vacancy: number | null;
    permits: number | null;
    bizPerCapita: number | null;
    signal: "underserved" | "growing" | "saturated" | "neutral";
    narrative: string;
  }

  // Get top 15 municipalities by population
  const topPop = topMunis(populationRaw, 15);

  const rows: TradeRow[] = [];
  for (const m of topPop) {
    const pop = m.value;
    const biz = latestForMuni(businessRaw, m.municipality);
    const income = latestForMuni(incomeRaw, m.municipality);
    const vacancy = latestForMuni(vacancyRaw, m.municipality);
    const permits = latestForMuni(permitsRaw, m.municipality);

    const bizPerCapita = biz != null && pop > 0 ? (biz / pop) * 1000 : null;

    let signal: TradeRow["signal"] = "neutral";
    let narrative = "";

    if (bizPerCapita != null) {
      if (bizPerCapita < 30 && pop > 10000) {
        signal = "underserved";
        narrative = `Low business density (${bizPerCapita.toFixed(0)} per 1K pop) for a municipality of ${formatNum(pop)}. Gap = opportunity for new entrants.`;
      } else if (bizPerCapita > 80) {
        signal = "saturated";
        narrative = `High business density (${bizPerCapita.toFixed(0)} per 1K pop). Competitive market — differentiation required.`;
      } else if (permits != null && permits > 100) {
        signal = "growing";
        narrative = `Active building (${formatNum(permits)} permits) with moderate business density. Incoming rooftops not yet served.`;
      } else {
        narrative = `Balanced market. ${bizPerCapita.toFixed(0)} businesses per 1K population.`;
      }
    } else {
      narrative = "Limited business data — population data available.";
    }

    rows.push({
      municipality: m.municipality,
      population: pop,
      businesses: biz,
      income,
      vacancy,
      permits,
      bizPerCapita,
      signal,
      narrative,
    });
  }

  // Gap analysis — underserved markets
  const underserved = rows.filter((r) => r.signal === "underserved");
  const growing = rows.filter((r) => r.signal === "growing");

  return (
    <div className="space-y-5">
      {/* Full comparison table */}
      {rows.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <MapPin size={14} className="text-cyan-400" />
            <span className="text-xs font-medium text-cyan-400 uppercase tracking-wide">
              Municipality Comparison
            </span>
          </div>
          <p className="text-[10px] text-muted mb-2">
            Population, business density, income, and growth signals for top Alberta municipalities.
            Biz/1K = businesses per 1,000 residents (proxy for commercial density).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] text-muted uppercase border-b border-card-border">
                  <th className="text-left py-1.5 pr-3">Municipality</th>
                  <th className="text-right py-1.5 px-2">Pop</th>
                  <th className="text-right py-1.5 px-2">Businesses</th>
                  <th className="text-right py-1.5 px-2">Biz/1K</th>
                  <th className="text-right py-1.5 px-2">Income</th>
                  <th className="text-right py-1.5 px-2">Vacancy</th>
                  <th className="text-left py-1.5 pl-2">Signal</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.municipality} className="border-b border-card-border/50">
                    <td className="py-1.5 pr-3 font-medium">{row.municipality}</td>
                    <td className="text-right py-1.5 px-2 font-mono">{row.population != null ? formatNum(row.population) : "—"}</td>
                    <td className="text-right py-1.5 px-2 font-mono">{row.businesses != null ? formatNum(row.businesses) : "—"}</td>
                    <td className={`text-right py-1.5 px-2 font-mono ${
                      row.bizPerCapita != null && row.bizPerCapita < 30 ? "text-purple-400" :
                      row.bizPerCapita != null && row.bizPerCapita > 80 ? "text-orange-400" : "text-muted"
                    }`}>
                      {row.bizPerCapita != null ? row.bizPerCapita.toFixed(0) : "—"}
                    </td>
                    <td className="text-right py-1.5 px-2 font-mono text-muted">
                      {row.income != null ? formatMoney(row.income) : "—"}
                    </td>
                    <td className="text-right py-1.5 px-2 font-mono text-muted">
                      {row.vacancy != null ? `${row.vacancy.toFixed(1)}%` : "—"}
                    </td>
                    <td className="py-1.5 pl-2"><SignalBadge signal={row.signal} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Underserved gap analysis */}
      {underserved.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Target size={14} className="text-purple-400" />
            <span className="text-xs font-medium text-purple-400 uppercase tracking-wide">
              Underserved Markets — Gap Opportunities
            </span>
          </div>
          <p className="text-[10px] text-muted mb-2">
            High population but low business density — consumers are there, services aren&apos;t.
          </p>
          <div className="space-y-1.5">
            {underserved.map((m) => (
              <div
                key={m.municipality}
                className="p-2.5 rounded-lg border border-purple-500/20 bg-purple-500/5"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">{m.municipality}</span>
                  <SignalBadge signal="underserved" />
                </div>
                <p className="text-xs text-foreground/70">{m.narrative}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Growing markets */}
      {growing.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-green-400" />
            <span className="text-xs font-medium text-green-400 uppercase tracking-wide">
              Growing Markets — Incoming Rooftops
            </span>
          </div>
          <p className="text-[10px] text-muted mb-2">
            Active residential building with moderate business density — new customers arriving.
          </p>
          <div className="space-y-1.5">
            {growing.map((m) => (
              <div
                key={m.municipality}
                className="p-2.5 rounded-lg border border-green-500/20 bg-green-500/5"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">{m.municipality}</span>
                  <SignalBadge signal="growing" />
                </div>
                <p className="text-xs text-foreground/70">{m.narrative}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Link href="/economy/compare" className="text-[10px] text-accent hover:underline flex items-center gap-1">
          Full comparison tool <ChevronRight size={10} />
        </Link>
        <Link href="/municipalities" className="text-[10px] text-accent hover:underline flex items-center gap-1">
          Municipality deep-dives <ChevronRight size={10} />
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

export default function SiteSelectionBriefingPage() {
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
        <span>Site Selection</span>
      </div>
      <PageHeader
        title="Site Selection Briefing"
        description="Population corridors, business density, trade area gaps, and growth signals — everything for location and franchise decisions."
        category="overview"
        icon={<MapPin size={20} />}
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
          subtitle="Growth corridors, business density, and residential expansion signals"
          badge="LIVE"
        />
        <Suspense fallback={<LoadingSection />}>
          <MarketRead />
        </Suspense>
      </Card>

      {/* Trade Area Analysis */}
      <Card>
        <CardHeader
          title="Trade Area Analysis"
          subtitle="Municipality comparison with gap analysis — find underserved markets"
          badge="LIVE"
        />
        <Suspense fallback={<LoadingSection />}>
          <TradeAreaAnalysis />
        </Suspense>
      </Card>

      {/* Deep Dive Links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {[
          { href: "/economy/compare", label: "Compare", icon: BarChart3, desc: "Side-by-side" },
          { href: "/economy/corridors", label: "Corridors", icon: MapPin, desc: "Growth paths" },
          { href: "/municipalities", label: "Municipalities", icon: Building2, desc: "Deep-dives" },
          { href: "/home/dashboard", label: "Dashboard", icon: Activity, desc: "Full macro view" },
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
          Data from Alberta Regional Dashboard — population, business counts, income,
          vacancy rates, and building permits across all municipalities.
        </p>
        <p className="text-[10px] text-muted/60 mt-1">
          This briefing frames regional data for site selection and franchise expansion decisions.
        </p>
      </Card>
    </main>
  );
}
