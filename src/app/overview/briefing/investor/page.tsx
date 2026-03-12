import { Suspense } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  Activity,
  Users,
  Building2,
  Home,
  AlertTriangle,
  ChevronRight,
  BarChart3,
  Shield,
  Percent,
  MapPin,
} from "lucide-react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import {
  fetchBoCTimeSeries,
  fetchStatCanTimeSeries,
  BOC_SERIES,
  STATSCAN_SERIES,
  type TimeSeriesPoint,
} from "@/lib/data-sources";
import {
  fetchRegionalIndicator,
  type RegionalDataPoint,
} from "@/lib/data-sources-regional";
import { fetchImmigrationTimeSeries } from "@/lib/data-sources-ircc";

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

/** Get latest value for a municipality from regional data points */
function latestForMuni(data: RegionalDataPoint[], muni: string): number | null {
  const rows = data
    .filter((d) => d.municipality.toLowerCase() === muni.toLowerCase())
    .sort((a, b) => b.period.localeCompare(a.period));
  return rows.length > 0 ? rows[0].value : null;
}

/** Get top municipalities by latest value from regional data */
function topMunis(data: RegionalDataPoint[], n = 5, ascending = false): { municipality: string; value: number; period: string }[] {
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
  const [policyRate, mortgage5y, vacancyRaw, avgRentRaw] = await Promise.all([
    fetchBoCTimeSeries(BOC_SERIES.POLICY_RATE, 6).catch(() => []),
    fetchBoCTimeSeries(BOC_SERIES.MORTGAGE_5Y_FIXED, 6).catch(() => []),
    fetchRegionalIndicator("Vacancy Rates").catch(() => []),
    fetchRegionalIndicator("Average Rent").catch(() => []),
  ]);

  const rate = policyRate.at(-1)?.value;
  const mtg = mortgage5y.at(-1)?.value;

  // Province-wide average vacancy and rent from Edmonton CMA
  const edmontonVacancy = latestForMuni(vacancyRaw, "Edmonton");
  const edmontonRent = latestForMuni(avgRentRaw, "Edmonton");

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      <MetricCard
        title="BoC Rate"
        value={rate ? `${rate.toFixed(2)}%` : "—"}
        source="Bank of Canada"
      />
      <MetricCard
        title="5Y Fixed Mortgage"
        value={mtg ? `${mtg.toFixed(2)}%` : "—"}
        source="Bank of Canada"
      />
      <MetricCard
        title="Edmonton Vacancy"
        value={edmontonVacancy != null ? `${edmontonVacancy.toFixed(1)}%` : "—"}
        source="Regional Dashboard"
      />
      <MetricCard
        title="Edmonton Avg Rent"
        value={edmontonRent != null ? `$${Math.round(edmontonRent).toLocaleString()}` : "—"}
        source="Regional Dashboard"
      />
    </div>
  );
}

// ============================================================
// Section 2: Market Read (macro signals for investors)
// ============================================================

async function MarketRead() {
  const [policyRate, mortgage5y, mortgage5v, unemployment, vacancyRaw, assessmentRaw, bankruptcyRaw, immigrationTs] =
    await Promise.all([
      fetchBoCTimeSeries(BOC_SERIES.POLICY_RATE, 24).catch(() => []),
      fetchBoCTimeSeries(BOC_SERIES.MORTGAGE_5Y_FIXED, 24).catch(() => []),
      fetchBoCTimeSeries(BOC_SERIES.MORTGAGE_5Y_VARIABLE, 24).catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.tableId,
        STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.coordinate,
        24
      ).catch(() => []),
      fetchRegionalIndicator("Vacancy Rates").catch(() => []),
      fetchRegionalIndicator("Total Equalized Assessment").catch(() => []),
      fetchRegionalIndicator("Bankruptcies").catch(() => []),
      fetchImmigrationTimeSeries("Alberta").catch(() => []),
    ]);

  const rate = trend(policyRate);
  const fixed = trend(mortgage5y);
  const variable = trend(mortgage5v);
  const unemp = trend(unemployment);

  // Immigration trend (annual data — compare last 2 years)
  const imm = immigrationTs as { year: number; value: number }[];
  const immLatest = imm.at(-1);
  const immPrev = imm.at(-2);
  const immTrend = immLatest && immPrev && immPrev.value > 0
    ? ((immLatest.value - immPrev.value) / immPrev.value) * 100
    : 0;

  // Build narrative
  const bullets: { icon: React.ElementType; text: string; signal: "positive" | "negative" | "neutral" }[] = [];

  // Rate trajectory — cash flow impact
  if (rate.direction === "down") {
    bullets.push({
      icon: DollarSign,
      text: `BoC rate at ${rate.latest.toFixed(2)}%, trending down (${formatPct(rate.pct)}). Financing costs falling — cash flow improves on variable-rate debt. Refinancing window opening.`,
      signal: "positive",
    });
  } else if (rate.direction === "up") {
    bullets.push({
      icon: DollarSign,
      text: `BoC rate at ${rate.latest.toFixed(2)}%, trending up. Rising carrying costs erode yields — stress-test your portfolio at ${(rate.latest + 0.5).toFixed(2)}%.`,
      signal: "negative",
    });
  } else {
    bullets.push({
      icon: DollarSign,
      text: `BoC rate holding at ${rate.latest.toFixed(2)}%. Stable financing environment — predictable cash flow projections.`,
      signal: "neutral",
    });
  }

  // Mortgage spread — fixed vs variable opportunity
  if (fixed.latest > 0 && variable.latest > 0) {
    const spread = fixed.latest - variable.latest;
    if (spread > 0.5) {
      bullets.push({
        icon: Percent,
        text: `Fixed-variable spread: ${spread.toFixed(2)}pp. Variable rate (${variable.latest.toFixed(2)}%) significantly cheaper — consider variable for short-hold investments.`,
        signal: "positive",
      });
    } else {
      bullets.push({
        icon: Percent,
        text: `Fixed (${fixed.latest.toFixed(2)}%) and variable (${variable.latest.toFixed(2)}%) converging — spread only ${spread.toFixed(2)}pp. Fixed rate locks may be worth the certainty premium.`,
        signal: "neutral",
      });
    }
  }

  // Vacancy signal
  const edmontonVacancy = latestForMuni(vacancyRaw, "Edmonton");
  const calgaryVacancy = latestForMuni(vacancyRaw, "Calgary");
  if (edmontonVacancy != null) {
    if (edmontonVacancy < 3) {
      bullets.push({
        icon: Home,
        text: `Edmonton vacancy at ${edmontonVacancy.toFixed(1)}% — tight rental market. Strong rent growth potential, minimal vacancy risk.${calgaryVacancy != null ? ` Calgary: ${calgaryVacancy.toFixed(1)}%.` : ""}`,
        signal: "positive",
      });
    } else if (edmontonVacancy > 5) {
      bullets.push({
        icon: Home,
        text: `Edmonton vacancy at ${edmontonVacancy.toFixed(1)}% — elevated. Budget for longer turnover periods. Screen for quality tenants, not speed.${calgaryVacancy != null ? ` Calgary: ${calgaryVacancy.toFixed(1)}%.` : ""}`,
        signal: "negative",
      });
    } else {
      bullets.push({
        icon: Home,
        text: `Edmonton vacancy at ${edmontonVacancy.toFixed(1)}% — balanced market. Steady rental demand.${calgaryVacancy != null ? ` Calgary: ${calgaryVacancy.toFixed(1)}%.` : ""}`,
        signal: "neutral",
      });
    }
  }

  // Immigration as demand driver
  if (immLatest && immLatest.value > 0) {
    bullets.push({
      icon: Users,
      text: `Alberta PR landings: ${immLatest.value.toLocaleString()} (${immLatest.year}).${immTrend !== 0 ? ` ${immTrend > 0 ? "Up" : "Down"} ${Math.abs(immTrend).toFixed(0)}% YoY.` : ""} Immigration = rental demand floor — new arrivals rent first.`,
      signal: immTrend > 5 ? "positive" : immTrend < -10 ? "negative" : "neutral",
    });
  }

  // Unemployment — tenant risk
  if (unemp.direction === "up") {
    bullets.push({
      icon: AlertTriangle,
      text: `Alberta unemployment trending up (${unemp.latest.toFixed(1)}%). Higher arrears risk — tighten screening, build cash reserves.`,
      signal: "negative",
    });
  } else if (unemp.direction === "down") {
    bullets.push({
      icon: Activity,
      text: `Alberta unemployment falling (${unemp.latest.toFixed(1)}%). Employed tenants = reliable rents. Confident market for rent increases.`,
      signal: "positive",
    });
  }

  // Bankruptcy signal
  const edmontonBankruptcies = latestForMuni(bankruptcyRaw, "Edmonton");
  const calgaryBankruptcies = latestForMuni(bankruptcyRaw, "Calgary");
  if (edmontonBankruptcies != null && edmontonBankruptcies > 0) {
    bullets.push({
      icon: Shield,
      text: `Bankruptcies — Edmonton: ${Math.round(edmontonBankruptcies).toLocaleString()}${calgaryBankruptcies != null ? `, Calgary: ${Math.round(calgaryBankruptcies).toLocaleString()}` : ""}. ${edmontonBankruptcies > 2000 ? "Elevated levels — distressed opportunities may emerge." : "Within normal range."}`,
      signal: edmontonBankruptcies > 2000 ? "caution" : "neutral",
    });
  }

  const positiveCount = bullets.filter((b) => b.signal === "positive").length;
  const negativeCount = bullets.filter((b) => b.signal === "negative").length;
  const overallSignal = positiveCount >= 3 ? "positive" : negativeCount >= 3 ? "negative" : "neutral";
  const overallLabel =
    overallSignal === "positive"
      ? "Conditions favour acquisition — rates and demand aligned"
      : overallSignal === "negative"
        ? "Defensive posture — protect cash flow, defer acquisitions"
        : "Mixed signals — be selective, focus on fundamentals";

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
        <Link href="/dashboard" className="text-[10px] text-accent hover:underline flex items-center gap-1">
          Macro dashboard <ChevronRight size={10} />
        </Link>
        <Link href="/overview/signals" className="text-[10px] text-accent hover:underline flex items-center gap-1">
          Full signals <ChevronRight size={10} />
        </Link>
      </div>
    </div>
  );
}

// ============================================================
// Section 3: Rental Yield Opportunities (regional data)
// ============================================================

async function RentalYieldOpportunities() {
  const [vacancyRaw, rentRaw, assessmentRaw, housingStartsRaw, eiRaw] = await Promise.all([
    fetchRegionalIndicator("Vacancy Rates").catch(() => []),
    fetchRegionalIndicator("Average Rent").catch(() => []),
    fetchRegionalIndicator("Total Equalized Assessment").catch(() => []),
    fetchRegionalIndicator("Housing Starts").catch(() => []),
    fetchRegionalIndicator("Employment Insurance Beneficiaries").catch(() => []),
  ]);

  // Build municipality-level yield proxies
  // Gross yield proxy = (avgRent * 12) / (assessment per dwelling unit proxy)
  // We use total equalized assessment / dwelling count as a rough per-unit value
  const rentMap = new Map<string, number>();
  const vacancyMap = new Map<string, number>();
  const assessmentMap = new Map<string, number>();
  const startsMap = new Map<string, number>();
  const eiMap = new Map<string, number>();

  for (const pt of rentRaw) {
    const existing = rentMap.get(pt.municipality);
    if (!existing || pt.period > (rentMap.get(pt.municipality + "_p") || "")) {
      rentMap.set(pt.municipality, pt.value);
      rentMap.set(pt.municipality + "_p", parseFloat(pt.period) || 0);
    }
  }

  for (const pt of vacancyRaw) {
    const key = pt.municipality + "_latest";
    const existing = vacancyMap.get(key);
    if (!existing || pt.period > String(existing)) {
      vacancyMap.set(pt.municipality, pt.value);
      vacancyMap.set(key, parseFloat(pt.period) || 0);
    }
  }

  // Build yield table: municipalities with both rent and vacancy data
  interface YieldRow {
    municipality: string;
    avgRent: number;
    vacancy: number;
    annualRent: number;
    signal: "strong" | "moderate" | "caution";
    narrative: string;
  }

  const yieldRows: YieldRow[] = [];
  const munis = new Set<string>();
  for (const pt of rentRaw) munis.add(pt.municipality);
  for (const pt of vacancyRaw) munis.add(pt.municipality);

  for (const muni of munis) {
    const rent = latestForMuni(rentRaw, muni);
    const vacancy = latestForMuni(vacancyRaw, muni);
    if (rent == null || vacancy == null || rent <= 0) continue;

    const annualRent = rent * 12;
    let signal: YieldRow["signal"];
    let narrative: string;

    if (vacancy < 3 && rent > 800) {
      signal = "strong";
      narrative = `Tight vacancy (${vacancy.toFixed(1)}%) with solid rents ($${Math.round(rent)}/mo). Low turnover risk, strong cash flow potential.`;
    } else if (vacancy > 5) {
      signal = "caution";
      narrative = `Elevated vacancy (${vacancy.toFixed(1)}%). Budget for longer vacancies. Rents at $${Math.round(rent)}/mo may face downward pressure.`;
    } else {
      signal = "moderate";
      narrative = `Balanced market. Vacancy ${vacancy.toFixed(1)}%, rent $${Math.round(rent)}/mo. Stable returns without exceptional upside.`;
    }

    yieldRows.push({ municipality: muni, avgRent: rent, vacancy, annualRent, signal, narrative });
  }

  // Sort: strong first, then by rent descending
  const signalOrder = { strong: 0, moderate: 1, caution: 2 };
  yieldRows.sort((a, b) => {
    if (signalOrder[a.signal] !== signalOrder[b.signal]) return signalOrder[a.signal] - signalOrder[b.signal];
    return b.avgRent - a.avgRent;
  });

  const topYield = yieldRows.slice(0, 8);

  // Risk signals — municipalities with high EI beneficiaries
  const topEI = topMunis(eiRaw, 5);

  // Assessment growth — top growing municipalities
  const topAssessment = topMunis(assessmentRaw, 5);

  return (
    <div className="space-y-5">
      {/* Rental yield table */}
      {topYield.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={14} className="text-green-400" />
            <span className="text-xs font-medium text-green-400 uppercase tracking-wide">
              Rental Market by Municipality
            </span>
          </div>
          <p className="text-[10px] text-muted mb-2">
            Vacancy + rent data from Alberta Regional Dashboard. Low vacancy + strong rents = best cash flow positioning.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] text-muted uppercase border-b border-card-border">
                  <th className="text-left py-1.5 pr-3">Municipality</th>
                  <th className="text-right py-1.5 px-2">Avg Rent</th>
                  <th className="text-right py-1.5 px-2">Vacancy</th>
                  <th className="text-right py-1.5 px-2">Annual Rent</th>
                  <th className="text-left py-1.5 pl-2">Signal</th>
                </tr>
              </thead>
              <tbody>
                {topYield.map((row) => (
                  <tr key={row.municipality} className="border-b border-card-border/50">
                    <td className="py-1.5 pr-3 font-medium">{row.municipality}</td>
                    <td className="text-right py-1.5 px-2">${Math.round(row.avgRent).toLocaleString()}</td>
                    <td className={`text-right py-1.5 px-2 font-mono ${row.vacancy < 3 ? "text-green-400" : row.vacancy > 5 ? "text-red-400" : "text-muted"}`}>
                      {row.vacancy.toFixed(1)}%
                    </td>
                    <td className="text-right py-1.5 px-2">${Math.round(row.annualRent).toLocaleString()}</td>
                    <td className="py-1.5 pl-2"><SignalBadge signal={row.signal} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Assessment growth — where equity builds */}
      {topAssessment.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-accent" />
            <span className="text-xs font-medium text-accent uppercase tracking-wide">
              Assessment Leaders — Equity Growth
            </span>
          </div>
          <p className="text-[10px] text-muted mb-2">
            Municipalities with the highest total equalized assessment. Large assessment base = stable tax environment + equity growth.
          </p>
          <div className="space-y-1.5">
            {topAssessment.map((m) => (
              <div
                key={m.municipality}
                className="flex items-center justify-between p-2 rounded border border-card-border bg-card/50"
              >
                <span className="text-sm font-medium">{m.municipality}</span>
                <span className="text-xs font-mono text-muted">{formatMoney(m.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risk signals — EI beneficiaries */}
      {topEI.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-orange-400" />
            <span className="text-xs font-medium text-orange-400 uppercase tracking-wide">
              Risk Watch — EI Beneficiaries
            </span>
          </div>
          <p className="text-[10px] text-muted mb-2">
            Municipalities with the highest EI beneficiary counts. Elevated EI = higher tenant default risk and softer rent growth.
          </p>
          <div className="space-y-1.5">
            {topEI.map((m) => (
              <div
                key={m.municipality}
                className="flex items-center justify-between p-2 rounded border border-orange-500/15 bg-orange-500/5"
              >
                <span className="text-sm font-medium">{m.municipality}</span>
                <span className="text-xs font-mono text-orange-400">{Math.round(m.value).toLocaleString()} beneficiaries</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Link href="/real-estate/market" className="text-[10px] text-accent hover:underline flex items-center gap-1">
          Real estate intel <ChevronRight size={10} />
        </Link>
        <Link href="/intelligence/risk" className="text-[10px] text-accent hover:underline flex items-center gap-1">
          Risk analysis <ChevronRight size={10} />
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

export default function InvestorBriefingPage() {
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
          <span>Investor</span>
        </div>
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-lg bg-amber-500/10">
            <TrendingUp size={20} className="text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Investor Briefing</h1>
            <p className="text-xs text-muted">{today}</p>
          </div>
        </div>
        <p className="text-sm text-muted mt-2">
          Rate trajectory, rental yields, assessment growth, and risk signals —
          everything you need to evaluate Alberta real estate opportunities.
        </p>
      </header>

      {/* Quick Stats */}
      <Suspense fallback={<LoadingGrid />}>
        <QuickStats />
      </Suspense>

      {/* Market Read */}
      <Card>
        <CardHeader
          title="Market Read"
          subtitle="Macro signals that affect portfolio returns and acquisition timing"
          badge="LIVE"
        />
        <Suspense fallback={<LoadingSection />}>
          <MarketRead />
        </Suspense>
      </Card>

      {/* Rental Yield Opportunities */}
      <Card>
        <CardHeader
          title="Rental Yield & Risk"
          subtitle="Municipality-level vacancy, rent, assessment growth, and risk indicators"
          badge="LIVE"
        />
        <Suspense fallback={<LoadingSection />}>
          <RentalYieldOpportunities />
        </Suspense>
      </Card>

      {/* Deep Dive Links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {[
          { href: "/real-estate/market", label: "Market Intel", icon: Home, desc: "Price + volume" },
          { href: "/intelligence/risk", label: "Risk Analysis", icon: Shield, desc: "Default signals" },
          { href: "/overview/signals", label: "Signals", icon: Activity, desc: "Leading indicators" },
          { href: "/dashboard", label: "Dashboard", icon: BarChart3, desc: "Full macro view" },
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
          Data from Bank of Canada, Statistics Canada, Alberta Regional Dashboard, and IRCC.
          Vacancy rates, rents, and assessments sourced from regionaldashboard.alberta.ca.
        </p>
        <p className="text-[10px] text-muted/60 mt-1">
          This briefing frames the same live data as the full dashboard for investment decisions.
        </p>
      </Card>
    </main>
  );
}
