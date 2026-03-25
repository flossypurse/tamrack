import { Suspense } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import {
  TrendingUp,
  TrendingDown,
  CreditCard,
  DollarSign,
  Activity,
  Users,
  AlertTriangle,
  ChevronRight,
  BarChart3,
  Shield,
  Building2,
  Home,
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
    low: "bg-green-500/15 text-green-400",
    moderate: "bg-amber-500/15 text-amber-400",
    elevated: "bg-red-500/15 text-red-400",
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
  const [policyRate, mortgage5y, unemployment, vacancyRaw] = await Promise.all([
    fetchBoCTimeSeries(BOC_SERIES.POLICY_RATE, 6).catch(() => []),
    fetchBoCTimeSeries(BOC_SERIES.MORTGAGE_5Y_FIXED, 6).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.tableId,
      STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.coordinate,
      6
    ).catch(() => []),
    fetchRegionalIndicator("Vacancy Rates").catch(() => []),
  ]);

  const rate = policyRate.at(-1)?.value;
  const mtg = mortgage5y.at(-1)?.value;
  const unemp = unemployment.at(-1)?.value;
  const edmontonVacancy = latestForMuni(vacancyRaw, "Edmonton");

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
        title="AB Unemployment"
        value={unemp ? `${unemp.toFixed(1)}%` : "—"}
        source="StatsCan"
      />
      <MetricCard
        title="Edmonton Vacancy"
        value={edmontonVacancy != null ? `${edmontonVacancy.toFixed(1)}%` : "—"}
        source="Regional Dashboard"
      />
    </div>
  );
}

// ============================================================
// Section 2: Market Read (rate environment + origination outlook)
// ============================================================

async function MarketRead() {
  const [policyRate, mortgage5y, mortgage5v, unemployment, vacancyRaw, bankruptcyRaw, eiRaw, assessmentRaw] =
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
      fetchRegionalIndicator("Bankruptcies").catch(() => []),
      fetchRegionalIndicator("Employment Insurance Beneficiaries").catch(() => []),
      fetchRegionalIndicator("Total Equalized Assessment").catch(() => []),
    ]);

  const rate = trend(policyRate);
  const fixed = trend(mortgage5y);
  const variable = trend(mortgage5v);
  const unemp = trend(unemployment);

  const bullets: { icon: React.ElementType; text: string; signal: "positive" | "negative" | "neutral" }[] = [];

  // Rate trajectory — origination volume
  if (rate.direction === "down") {
    bullets.push({
      icon: DollarSign,
      text: `BoC rate at ${rate.latest.toFixed(2)}%, trending down (${formatPct(rate.pct)}). Falling rates expand qualifying — expect higher origination volume and refinancing activity.`,
      signal: "positive",
    });
  } else if (rate.direction === "up") {
    bullets.push({
      icon: DollarSign,
      text: `BoC rate at ${rate.latest.toFixed(2)}%, trending up. Tighter qualifying shrinks applicant pool — origination volume likely declining. Focus on renewals.`,
      signal: "negative",
    });
  } else {
    bullets.push({
      icon: DollarSign,
      text: `BoC rate holding at ${rate.latest.toFixed(2)}%. Stable rate environment — predictable qualifying thresholds and pipeline volume.`,
      signal: "neutral",
    });
  }

  // Fixed vs variable spread
  if (fixed.latest > 0 && variable.latest > 0) {
    const spread = fixed.latest - variable.latest;
    if (spread > 0.5) {
      bullets.push({
        icon: CreditCard,
        text: `Fixed-variable spread: ${spread.toFixed(2)}pp. Variable (${variable.latest.toFixed(2)}%) significantly cheaper — borrowers will ask about variable. Stress-test at qualifying rate before recommending.`,
        signal: "neutral",
      });
    } else {
      bullets.push({
        icon: CreditCard,
        text: `Fixed (${fixed.latest.toFixed(2)}%) and variable (${variable.latest.toFixed(2)}%) converging (${spread.toFixed(2)}pp spread). Fixed locks are easy to sell — low premium for certainty.`,
        signal: "positive",
      });
    }
  }

  // Vacancy as collateral risk
  const edmontonVacancy = latestForMuni(vacancyRaw, "Edmonton");
  const calgaryVacancy = latestForMuni(vacancyRaw, "Calgary");
  if (edmontonVacancy != null) {
    if (edmontonVacancy > 5) {
      bullets.push({
        icon: Home,
        text: `Edmonton vacancy at ${edmontonVacancy.toFixed(1)}% — elevated. Higher vacancy weakens rental income for investor-borrowers. Scrutinise rental property applications more carefully.${calgaryVacancy != null ? ` Calgary: ${calgaryVacancy.toFixed(1)}%.` : ""}`,
        signal: "negative",
      });
    } else if (edmontonVacancy < 3) {
      bullets.push({
        icon: Home,
        text: `Edmonton vacancy at ${edmontonVacancy.toFixed(1)}% — tight. Strong rental market supports investor-borrower income claims.${calgaryVacancy != null ? ` Calgary: ${calgaryVacancy.toFixed(1)}%.` : ""}`,
        signal: "positive",
      });
    } else {
      bullets.push({
        icon: Home,
        text: `Edmonton vacancy at ${edmontonVacancy.toFixed(1)}% — balanced. Standard underwriting assumptions hold.${calgaryVacancy != null ? ` Calgary: ${calgaryVacancy.toFixed(1)}%.` : ""}`,
        signal: "neutral",
      });
    }
  }

  // Unemployment as default risk
  if (unemp.direction === "up") {
    bullets.push({
      icon: Users,
      text: `Alberta unemployment trending up (${unemp.latest.toFixed(1)}%, ${formatPct(unemp.pct)}). Rising job losses = higher default probability. Tighten TDS/GDS thresholds and verify employment stability.`,
      signal: "negative",
    });
  } else if (unemp.direction === "down") {
    bullets.push({
      icon: Users,
      text: `Alberta unemployment falling (${unemp.latest.toFixed(1)}%). Strong employment = low default risk. Confident underwriting environment.`,
      signal: "positive",
    });
  } else {
    bullets.push({
      icon: Users,
      text: `Alberta unemployment stable at ${unemp.latest.toFixed(1)}%. Default risk within normal parameters.`,
      signal: "neutral",
    });
  }

  // Bankruptcy trends
  const edmontonBankruptcies = latestForMuni(bankruptcyRaw, "Edmonton");
  const calgaryBankruptcies = latestForMuni(bankruptcyRaw, "Calgary");
  if (edmontonBankruptcies != null && edmontonBankruptcies > 0) {
    bullets.push({
      icon: AlertTriangle,
      text: `Bankruptcies — Edmonton: ${Math.round(edmontonBankruptcies).toLocaleString()}${calgaryBankruptcies != null ? `, Calgary: ${Math.round(calgaryBankruptcies).toLocaleString()}` : ""}. ${edmontonBankruptcies > 2000 ? "Elevated — check for concentrated exposure in high-bankruptcy postal codes." : "Within normal range — standard portfolio risk."}`,
      signal: edmontonBankruptcies > 2000 ? "negative" : "neutral",
    });
  }

  // EI beneficiary concentrations
  const topEI = topMunis(eiRaw, 3);
  if (topEI.length > 0) {
    const eiList = topEI.map((m) => `${m.municipality} (${Math.round(m.value).toLocaleString()})`).join(", ");
    bullets.push({
      icon: Shield,
      text: `Highest EI concentrations: ${eiList}. EI-heavy markets have elevated arrears risk — monitor exposure in these regions.`,
      signal: "negative",
    });
  }

  const positiveCount = bullets.filter((b) => b.signal === "positive").length;
  const negativeCount = bullets.filter((b) => b.signal === "negative").length;
  const overallSignal = positiveCount >= 3 ? "positive" : negativeCount >= 3 ? "negative" : "neutral";
  const overallLabel =
    overallSignal === "positive"
      ? "Favourable lending environment — rates and employment aligned"
      : overallSignal === "negative"
        ? "Elevated risk — tighten underwriting and monitor arrears"
        : "Mixed signals — standard underwriting with selective caution";

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
        <Link href="/home/signals" className="text-[10px] text-accent hover:underline flex items-center gap-1">
          Full signals <ChevronRight size={10} />
        </Link>
      </div>
    </div>
  );
}

// ============================================================
// Section 3: Portfolio Risk Matrix
// ============================================================

async function PortfolioRisk() {
  const [vacancyRaw, bankruptcyRaw, eiRaw, assessmentRaw, unemploymentRaw] = await Promise.all([
    fetchRegionalIndicator("Vacancy Rates").catch(() => []),
    fetchRegionalIndicator("Bankruptcies").catch(() => []),
    fetchRegionalIndicator("Employment Insurance Beneficiaries").catch(() => []),
    fetchRegionalIndicator("Total Equalized Assessment").catch(() => []),
    fetchRegionalIndicator("Unemployment Rate").catch(() => []),
  ]);

  // Build municipality risk matrix
  interface RiskRow {
    municipality: string;
    vacancy: number | null;
    bankruptcies: number | null;
    eiBeneficiaries: number | null;
    assessment: number | null;
    riskScore: number;
    signal: "low" | "moderate" | "elevated";
  }

  const munis = new Set<string>();
  for (const pt of vacancyRaw) munis.add(pt.municipality);
  for (const pt of bankruptcyRaw) munis.add(pt.municipality);

  const riskRows: RiskRow[] = [];
  for (const muni of munis) {
    const vacancy = latestForMuni(vacancyRaw, muni);
    const bankruptcies = latestForMuni(bankruptcyRaw, muni);
    const ei = latestForMuni(eiRaw, muni);
    const assessment = latestForMuni(assessmentRaw, muni);

    // Need at least vacancy or bankruptcies to score
    if (vacancy == null && bankruptcies == null) continue;

    // Risk scoring: higher vacancy, bankruptcies, EI = higher risk
    let score = 0;
    if (vacancy != null) {
      if (vacancy > 5) score += 3;
      else if (vacancy > 3) score += 1;
    }
    if (bankruptcies != null) {
      if (bankruptcies > 2000) score += 3;
      else if (bankruptcies > 500) score += 1;
    }
    if (ei != null) {
      if (ei > 5000) score += 2;
      else if (ei > 1000) score += 1;
    }

    const signal: RiskRow["signal"] =
      score >= 5 ? "elevated" : score >= 2 ? "moderate" : "low";

    riskRows.push({
      municipality: muni,
      vacancy,
      bankruptcies,
      eiBeneficiaries: ei,
      assessment,
      riskScore: score,
      signal,
    });
  }

  // Sort by risk score descending
  riskRows.sort((a, b) => b.riskScore - a.riskScore);
  const topRisk = riskRows.slice(0, 10);

  // Assessment base stability — top by assessment value
  const topAssessment = topMunis(assessmentRaw, 5);

  return (
    <div className="space-y-5">
      {/* Risk matrix table */}
      {topRisk.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-red-400" />
            <span className="text-xs font-medium text-red-400 uppercase tracking-wide">
              Municipality Risk Matrix
            </span>
          </div>
          <p className="text-[10px] text-muted mb-2">
            Composite risk score based on vacancy rates, bankruptcies, and EI beneficiary concentrations.
            Higher score = more portfolio risk exposure.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] text-muted uppercase border-b border-card-border">
                  <th className="text-left py-1.5 pr-3">Municipality</th>
                  <th className="text-right py-1.5 px-2">Vacancy</th>
                  <th className="text-right py-1.5 px-2">Bankruptcies</th>
                  <th className="text-right py-1.5 px-2">EI</th>
                  <th className="text-right py-1.5 px-2">Assessment</th>
                  <th className="text-left py-1.5 pl-2">Risk</th>
                </tr>
              </thead>
              <tbody>
                {topRisk.map((row) => (
                  <tr key={row.municipality} className="border-b border-card-border/50">
                    <td className="py-1.5 pr-3 font-medium">{row.municipality}</td>
                    <td className={`text-right py-1.5 px-2 font-mono ${
                      row.vacancy != null && row.vacancy > 5 ? "text-red-400" :
                      row.vacancy != null && row.vacancy < 3 ? "text-green-400" : "text-muted"
                    }`}>
                      {row.vacancy != null ? `${row.vacancy.toFixed(1)}%` : "—"}
                    </td>
                    <td className="text-right py-1.5 px-2 font-mono text-muted">
                      {row.bankruptcies != null ? Math.round(row.bankruptcies).toLocaleString() : "—"}
                    </td>
                    <td className="text-right py-1.5 px-2 font-mono text-muted">
                      {row.eiBeneficiaries != null ? Math.round(row.eiBeneficiaries).toLocaleString() : "—"}
                    </td>
                    <td className="text-right py-1.5 px-2 font-mono text-muted">
                      {row.assessment != null ? formatMoney(row.assessment) : "—"}
                    </td>
                    <td className="py-1.5 pl-2"><SignalBadge signal={row.signal} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Assessment base stability */}
      {topAssessment.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Building2 size={14} className="text-accent" />
            <span className="text-xs font-medium text-accent uppercase tracking-wide">
              Assessment Base Leaders — Collateral Strength
            </span>
          </div>
          <p className="text-[10px] text-muted mb-2">
            Largest assessment bases indicate stable property values and deep collateral markets.
            Lending in these markets carries lower LTV risk.
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

      <div className="flex gap-2 pt-2">
        <Link href="/economy/risk" className="text-[10px] text-accent hover:underline flex items-center gap-1">
          Risk analysis <ChevronRight size={10} />
        </Link>
        <Link href="/home/signals" className="text-[10px] text-accent hover:underline flex items-center gap-1">
          Signals dashboard <ChevronRight size={10} />
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

export default function LenderBriefingPage() {
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
        <span>Lender</span>
      </div>
      <PageHeader
        title="Lender Briefing"
        description="Rate environment, origination outlook, default risk signals, and municipality-level portfolio risk — everything for underwriting decisions."
        category="overview"
        icon={<CreditCard size={20} />}
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
          subtitle="Rate trajectory, origination volume signals, and borrower risk indicators"
          badge="LIVE"
        />
        <Suspense fallback={<LoadingSection />}>
          <MarketRead />
        </Suspense>
      </Card>

      {/* Portfolio Risk */}
      <Card>
        <CardHeader
          title="Portfolio Risk"
          subtitle="Municipality-level risk scoring — vacancy, bankruptcies, EI, and assessment base"
          badge="LIVE"
        />
        <Suspense fallback={<LoadingSection />}>
          <PortfolioRisk />
        </Suspense>
      </Card>

      {/* Deep Dive Links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {[
          { href: "/economy/risk", label: "Risk Analysis", icon: Shield, desc: "Default signals" },
          { href: "/home/signals", label: "Signals", icon: Activity, desc: "Leading indicators" },
          { href: "/home/dashboard", label: "Dashboard", icon: BarChart3, desc: "Full macro view" },
          { href: "/real-estate/market", label: "Market Intel", icon: Home, desc: "Price + volume" },
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
          Data from Bank of Canada, Statistics Canada, and Alberta Regional Dashboard.
          Risk scores combine vacancy rates, bankruptcies, and EI beneficiary data.
        </p>
        <p className="text-[10px] text-muted/60 mt-1">
          This briefing frames the same live data as the full dashboard for lending decisions.
        </p>
      </Card>
    </main>
  );
}
