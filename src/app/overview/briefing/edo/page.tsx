import { Suspense } from "react";
import Link from "next/link";
import {
  Landmark,
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Users,
  Building2,
  DollarSign,
  ChevronRight,
  BarChart3,
  Briefcase,
  Factory,
  Shield,
  Scale,
  Layers,
} from "lucide-react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import {
  fetchRegionalIndicator,
  type RegionalDataPoint,
} from "@/lib/data-sources-regional";
import {
  fetchAlbertaMajorProjects,
  type MajorProject,
} from "@/lib/data-sources-infrastructure";

// ============================================================
// Helpers
// ============================================================

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
    leader: "bg-accent/15 text-accent",
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

/** Get latest values per municipality with period info */
function latestByMuni(data: RegionalDataPoint[]): Map<string, { value: number; period: string }> {
  const map = new Map<string, { value: number; period: string }>();
  for (const pt of data) {
    const existing = map.get(pt.municipality);
    if (!existing || pt.period > existing.period) {
      map.set(pt.municipality, { value: pt.value, period: pt.period });
    }
  }
  return map;
}

// ============================================================
// Section 1: Quick Stats (province-level highlights)
// ============================================================

async function QuickStats() {
  const [incorporationsRaw, populationRaw, assessmentRaw, taxRateRaw] = await Promise.all([
    fetchRegionalIndicator("Incorporations").catch(() => []),
    fetchRegionalIndicator("Population").catch(() => []),
    fetchRegionalIndicator("Total Equalized Assessment").catch(() => []),
    fetchRegionalIndicator("Municipal Tax Rates").catch(() => []),
  ]);

  const edmontonPop = latestForMuni(populationRaw, "Edmonton");
  const calgaryPop = latestForMuni(populationRaw, "Calgary");
  const edmontonIncorp = latestForMuni(incorporationsRaw, "Edmonton");
  const calgaryIncorp = latestForMuni(incorporationsRaw, "Calgary");

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      <MetricCard
        title="Edmonton Pop."
        value={edmontonPop != null ? Math.round(edmontonPop).toLocaleString() : "—"}
        source="Regional Dashboard"
      />
      <MetricCard
        title="Calgary Pop."
        value={calgaryPop != null ? Math.round(calgaryPop).toLocaleString() : "—"}
        source="Regional Dashboard"
      />
      <MetricCard
        title="Edmonton Incorp."
        value={edmontonIncorp != null ? Math.round(edmontonIncorp).toLocaleString() : "—"}
        source="Regional Dashboard"
      />
      <MetricCard
        title="Calgary Incorp."
        value={calgaryIncorp != null ? Math.round(calgaryIncorp).toLocaleString() : "—"}
        source="Regional Dashboard"
      />
    </div>
  );
}

// ============================================================
// Section 2: Municipal Scorecard (comparative analysis)
// ============================================================

async function MunicipalScorecard() {
  const [
    populationRaw, assessmentRaw, taxRateRaw, incorporationsRaw,
    housingStartsRaw, buildingPermitsRaw, bankruptcyRaw, eiRaw,
    medianIncomeRaw, vacancyRaw, businessCountRaw, labourForceRaw,
  ] = await Promise.all([
    fetchRegionalIndicator("Population").catch(() => []),
    fetchRegionalIndicator("Total Equalized Assessment").catch(() => []),
    fetchRegionalIndicator("Municipal Tax Rates").catch(() => []),
    fetchRegionalIndicator("Incorporations").catch(() => []),
    fetchRegionalIndicator("Housing Starts").catch(() => []),
    fetchRegionalIndicator("Building Permits").catch(() => []),
    fetchRegionalIndicator("Bankruptcies").catch(() => []),
    fetchRegionalIndicator("Employment Insurance Beneficiaries").catch(() => []),
    fetchRegionalIndicator("Median Household Income").catch(() => []),
    fetchRegionalIndicator("Vacancy Rates").catch(() => []),
    fetchRegionalIndicator("Business Counts").catch(() => []),
    fetchRegionalIndicator("Labour Force").catch(() => []),
  ]);

  // Build scorecard for major municipalities
  const popMap = latestByMuni(populationRaw);
  const assessMap = latestByMuni(assessmentRaw);
  const taxMap = latestByMuni(taxRateRaw);
  const incorpMap = latestByMuni(incorporationsRaw);
  const startsMap = latestByMuni(housingStartsRaw);
  const permitsMap = latestByMuni(buildingPermitsRaw);
  const bankruptcyMap = latestByMuni(bankruptcyRaw);
  const eiMap = latestByMuni(eiRaw);
  const incomeMap = latestByMuni(medianIncomeRaw);
  const vacancyMap = latestByMuni(vacancyRaw);
  const businessMap = latestByMuni(businessCountRaw);
  const labourMap = latestByMuni(labourForceRaw);

  interface ScorecardRow {
    municipality: string;
    population: number;
    assessment: number;
    taxRate: number;
    incorporations: number;
    housingStarts: number;
    medianIncome: number;
    vacancy: number;
    businesses: number;
    score: number;
    signal: string;
  }

  const rows: ScorecardRow[] = [];

  for (const [muni, popData] of popMap) {
    if (popData.value < 5000) continue; // Skip very small municipalities

    const assessment = assessMap.get(muni)?.value ?? 0;
    const taxRate = taxMap.get(muni)?.value ?? 0;
    const incorporations = incorpMap.get(muni)?.value ?? 0;
    const starts = startsMap.get(muni)?.value ?? 0;
    const income = incomeMap.get(muni)?.value ?? 0;
    const vacancy = vacancyMap.get(muni)?.value ?? 0;
    const businesses = businessMap.get(muni)?.value ?? 0;

    // Composite economic health score
    // Positive: incorporations, housing starts, low vacancy, high income
    // Negative: high vacancy, low incorporations
    let score = 0;
    if (incorporations > 100) score += 2;
    else if (incorporations > 30) score += 1;
    if (starts > 100) score += 2;
    else if (starts > 20) score += 1;
    if (vacancy < 3) score += 2;
    else if (vacancy < 5) score += 1;
    else if (vacancy > 7) score -= 1;
    if (income > 80000) score += 1;
    if (businesses > 500) score += 1;

    let signal: string;
    if (score >= 6) signal = "leader";
    else if (score >= 4) signal = "strong";
    else if (score >= 2) signal = "stable";
    else signal = "cooling";

    rows.push({
      municipality: muni,
      population: popData.value,
      assessment,
      taxRate,
      incorporations,
      housingStarts: starts,
      medianIncome: income,
      vacancy,
      businesses,
      score,
      signal,
    });
  }

  rows.sort((a, b) => b.score - a.score);
  const topRows = rows.slice(0, 12);

  // Tax competitiveness — lowest tax rates
  const taxRows = rows
    .filter((r) => r.taxRate > 0)
    .sort((a, b) => a.taxRate - b.taxRate)
    .slice(0, 8);

  // Business formation leaders
  const incorpRows = rows
    .filter((r) => r.incorporations > 0)
    .sort((a, b) => b.incorporations - a.incorporations)
    .slice(0, 8);

  // Market read narrative
  const leaders = rows.filter((r) => r.signal === "leader" || r.signal === "strong");
  const cooling = rows.filter((r) => r.signal === "cooling");

  const bullets: { icon: React.ElementType; text: string; signal: "positive" | "negative" | "neutral" }[] = [];

  if (leaders.length > 0) {
    bullets.push({
      icon: TrendingUp,
      text: `${leaders.length} municipalities scoring as economic leaders/strong: ${leaders.slice(0, 4).map((r) => r.municipality).join(", ")}${leaders.length > 4 ? ` + ${leaders.length - 4} more` : ""}. Active business formation, housing growth, and low vacancy.`,
      signal: "positive",
    });
  }

  if (cooling.length > 0) {
    bullets.push({
      icon: TrendingDown,
      text: `${cooling.length} municipalities showing cooling signals: ${cooling.slice(0, 3).map((r) => r.municipality).join(", ")}${cooling.length > 3 ? ` + ${cooling.length - 3} more` : ""}. Elevated vacancy, low incorporations, or weak starts.`,
      signal: "negative",
    });
  }

  // Tax competitiveness insight
  if (taxRows.length >= 2) {
    const lowest = taxRows[0];
    const highest = taxRows.at(-1)!;
    bullets.push({
      icon: Scale,
      text: `Tax rate spread: ${lowest.municipality} (${lowest.taxRate.toFixed(2)}) to ${highest.municipality} (${highest.taxRate.toFixed(2)}). A ${(highest.taxRate - lowest.taxRate).toFixed(2)} point range across comparable municipalities creates competitive positioning opportunities.`,
      signal: "neutral",
    });
  }

  // Business formation
  if (incorpRows.length > 0) {
    const total = incorpRows.reduce((s, r) => s + r.incorporations, 0);
    bullets.push({
      icon: Briefcase,
      text: `${total.toLocaleString()} new incorporations across top ${incorpRows.length} municipalities. ${incorpRows[0].municipality} leads with ${incorpRows[0].incorporations.toLocaleString()}.`,
      signal: "positive",
    });
  }

  const positiveCount = bullets.filter((b) => b.signal === "positive").length;
  const overallSignal = positiveCount >= 2 ? "positive" : "neutral";

  return (
    <div className="space-y-5">
      {/* Market Read */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Activity size={14} className="text-accent" />
          <span className="text-xs font-medium uppercase tracking-wide">Provincial Read</span>
          <SignalBadge signal={overallSignal} />
        </div>
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
      </div>

      {/* Scorecard table */}
      {topRows.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 size={14} className="text-accent" />
            <span className="text-xs font-medium text-accent uppercase tracking-wide">
              Municipal Scorecards — Economic Health
            </span>
          </div>
          <p className="text-[10px] text-muted mb-2">
            Composite score based on incorporations, housing starts, vacancy, income, and business counts.
            Council-ready comparison data.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] text-muted uppercase border-b border-card-border">
                  <th className="text-left py-1.5 pr-2">Municipality</th>
                  <th className="text-right py-1.5 px-1.5">Pop.</th>
                  <th className="text-right py-1.5 px-1.5">Incorp.</th>
                  <th className="text-right py-1.5 px-1.5">Starts</th>
                  <th className="text-right py-1.5 px-1.5">Vacancy</th>
                  <th className="text-right py-1.5 px-1.5">Income</th>
                  <th className="text-left py-1.5 pl-1.5">Signal</th>
                </tr>
              </thead>
              <tbody>
                {topRows.map((row) => (
                  <tr key={row.municipality} className="border-b border-card-border/50">
                    <td className="py-1.5 pr-2 font-medium">{row.municipality}</td>
                    <td className="text-right py-1.5 px-1.5">{Math.round(row.population).toLocaleString()}</td>
                    <td className="text-right py-1.5 px-1.5">{row.incorporations > 0 ? Math.round(row.incorporations).toLocaleString() : "—"}</td>
                    <td className="text-right py-1.5 px-1.5">{row.housingStarts > 0 ? Math.round(row.housingStarts).toLocaleString() : "—"}</td>
                    <td className={`text-right py-1.5 px-1.5 font-mono ${row.vacancy < 3 ? "text-green-400" : row.vacancy > 5 ? "text-red-400" : "text-muted"}`}>
                      {row.vacancy > 0 ? `${row.vacancy.toFixed(1)}%` : "—"}
                    </td>
                    <td className="text-right py-1.5 px-1.5">{row.medianIncome > 0 ? formatMoney(row.medianIncome) : "—"}</td>
                    <td className="py-1.5 pl-1.5"><SignalBadge signal={row.signal} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tax competitiveness */}
      {taxRows.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Scale size={14} className="text-cyan-400" />
            <span className="text-xs font-medium text-cyan-400 uppercase tracking-wide">
              Tax Competitiveness — Mill Rates
            </span>
          </div>
          <p className="text-[10px] text-muted mb-2">
            Municipal tax rates sorted lowest to highest. Lower rates attract business investment and residential relocation.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {taxRows.map((row, i) => (
              <div key={row.municipality} className={`p-2 rounded border text-center ${i < 3 ? "border-green-500/20 bg-green-500/5" : "border-card-border bg-card/50"}`}>
                <p className="text-sm font-medium truncate">{row.municipality}</p>
                <p className="text-lg font-semibold font-mono">{row.taxRate.toFixed(2)}</p>
                <p className="text-[9px] text-muted">mill rate</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Link href="/intelligence/compare" className="text-[10px] text-accent hover:underline flex items-center gap-1">
          Full comparison tool <ChevronRight size={10} />
        </Link>
        <Link href="/intelligence/benchmarks" className="text-[10px] text-accent hover:underline flex items-center gap-1">
          Benchmarks <ChevronRight size={10} />
        </Link>
      </div>
    </div>
  );
}

// ============================================================
// Section 3: Major Projects Pipeline
// ============================================================

async function ProjectsPipeline() {
  const majorProjects = await fetchAlbertaMajorProjects().catch(() => []);

  // Group by sector
  const bySector = new Map<string, MajorProject[]>();
  for (const p of majorProjects) {
    const sector = p.sector || "Other";
    if (!bySector.has(sector)) bySector.set(sector, []);
    bySector.get(sector)!.push(p);
  }

  // Sort sectors by total cost
  const sectors = Array.from(bySector.entries())
    .map(([sector, projects]) => ({
      sector,
      projects,
      totalCost: projects.reduce((s, p) => s + p.cost, 0),
      count: projects.length,
    }))
    .sort((a, b) => b.totalCost - a.totalCost)
    .slice(0, 6);

  const totalInvestment = majorProjects.reduce((s, p) => s + p.cost, 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-4 text-xs">
        <div>
          <span className="text-muted">Total Pipeline:</span>{" "}
          <span className="font-semibold">{formatMoney(totalInvestment * 1_000_000)}</span>
        </div>
        <div>
          <span className="text-muted">Projects:</span>{" "}
          <span className="font-semibold">{majorProjects.length}</span>
        </div>
      </div>

      {/* By sector */}
      {sectors.map(({ sector, projects, totalCost, count }) => (
        <div key={sector}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <Factory size={12} className="text-muted" />
              <span className="text-xs font-medium">{sector}</span>
              <span className="text-[9px] text-muted font-mono">{count} projects</span>
            </div>
            <span className="text-xs font-mono text-muted">{formatMoney(totalCost * 1_000_000)}</span>
          </div>
          <div className="space-y-1">
            {projects
              .sort((a, b) => b.cost - a.cost)
              .slice(0, 3)
              .map((p, i) => (
                <div
                  key={`${sector}-${i}`}
                  className="flex items-center justify-between p-1.5 rounded border border-card-border/50 bg-card/30 text-[11px]"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-medium truncate block">{p.name}</span>
                    <span className="text-[10px] text-muted">{p.stage} · {p.location || p.municipality}</span>
                  </div>
                  <span className="font-mono text-muted shrink-0 ml-2">
                    {p.cost > 0 ? formatMoney(p.cost * 1_000_000) : "—"}
                  </span>
                </div>
              ))}
          </div>
        </div>
      ))}

      <div className="flex gap-2 pt-2">
        <Link href="/intelligence/corridors" className="text-[10px] text-accent hover:underline flex items-center gap-1">
          Growth corridors <ChevronRight size={10} />
        </Link>
        <Link href="/dashboard" className="text-[10px] text-accent hover:underline flex items-center gap-1">
          Full dashboard <ChevronRight size={10} />
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

export default function EDOBriefingPage() {
  const today = new Date().toLocaleDateString("en-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <header>
        <div className="flex items-center gap-2 text-[10px] text-muted mb-2">
          <Link href="/overview/briefing" className="hover:text-accent">Briefings</Link>
          <ChevronRight size={10} />
          <span>EDO</span>
        </div>
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <Landmark size={20} className="text-purple-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Economic Development Officer Briefing</h1>
            <p className="text-xs text-muted">{today}</p>
          </div>
        </div>
        <p className="text-sm text-muted mt-2">
          Municipal scorecards, tax competitiveness, business formation, and the major projects pipeline —
          council-ready intelligence for economic development strategy.
        </p>
      </header>

      {/* Quick Stats */}
      <Suspense fallback={<LoadingGrid />}>
        <QuickStats />
      </Suspense>

      {/* Municipal Scorecard */}
      <Card>
        <CardHeader
          title="Municipal Scorecard & Market Read"
          subtitle="Comparative analysis across 12+ indicators — identify leaders, competitors, and opportunities"
          badge="LIVE"
        />
        <Suspense fallback={<LoadingSection />}>
          <MunicipalScorecard />
        </Suspense>
      </Card>

      {/* Major Projects Pipeline */}
      <Card>
        <CardHeader
          title="Major Projects Pipeline"
          subtitle="Alberta projects over $5M by sector — investment activity and employment drivers"
          badge="LIVE"
        />
        <Suspense fallback={<LoadingSection />}>
          <ProjectsPipeline />
        </Suspense>
      </Card>

      {/* Deep Dive Links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {[
          { href: "/intelligence/compare", label: "Compare", icon: BarChart3, desc: "Side-by-side" },
          { href: "/intelligence/benchmarks", label: "Benchmarks", icon: Scale, desc: "Indicator rankings" },
          { href: "/intelligence/corridors", label: "Corridors", icon: Layers, desc: "Growth directions" },
          { href: "/dashboard", label: "Dashboard", icon: Activity, desc: "Full macro view" },
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
          Data from Alberta Regional Dashboard (54 indicators, ~340 municipalities) and Alberta Major Projects inventory.
          All indicators sourced from regionaldashboard.alberta.ca.
        </p>
        <p className="text-[10px] text-muted/60 mt-1">
          This briefing is designed for council presentations and inter-municipal benchmarking.
        </p>
      </Card>
    </main>
  );
}
