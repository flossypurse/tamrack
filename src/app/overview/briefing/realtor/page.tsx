import { Suspense } from "react";
import Link from "next/link";
import {
  Home,
  TrendingUp,
  TrendingDown,
  Minus,
  Flame,
  MapPin,
  Briefcase,
  Building2,
  ArrowRight,
  DollarSign,
  Activity,
  Users,
  Target,
  Wrench,
  Store,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import {
  fetchBoCTimeSeries,
  fetchStatCanTimeSeries,
  fetchEdmontonPermitsSummary,
  fetchEdmontonBusinessLicences,
  fetchEdmontonDevPermits,
  BOC_SERIES,
  STATSCAN_SERIES,
  type TimeSeriesPoint,
  fetchHotNeighbourhoods,
  fetchRedevelopingActivity,
  fetchHomeImprovementHotspots,
} from "@/lib/data-sources";
import {
  analyzeTransformationZones,
  analyzeTeardownZones,
  analyzeRenovationROI,
  analyzeBusinessResidentialConvergence,
  type TransformationSignal,
  type TeardownZone,
  type RenovationSignal,
  type ConvergenceSignal,
} from "@/lib/analysis";

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

function arrow(dir: "up" | "down" | "flat") {
  if (dir === "up") return <TrendingUp size={12} className="text-accent-green" />;
  if (dir === "down") return <TrendingDown size={12} className="text-accent-red" />;
  return <Minus size={12} className="text-muted" />;
}

function formatMoney(n: number): string {
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

// ============================================================
// Section 1: Market Pulse (macro signals that affect realtor decisions)
// ============================================================

async function MarketPulse() {
  const [policyRate, mortgage5y, cadUsd, unemployment, permits, devPermits, licences] =
    await Promise.all([
      fetchBoCTimeSeries(BOC_SERIES.POLICY_RATE, 24).catch(() => []),
      fetchBoCTimeSeries(BOC_SERIES.MORTGAGE_5Y_FIXED, 24).catch(() => []),
      fetchBoCTimeSeries(BOC_SERIES.CAD_USD, 24).catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.tableId,
        STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.coordinate,
        24
      ).catch(() => []),
      fetchEdmontonPermitsSummary().catch(() => []),
      fetchEdmontonDevPermits().catch(() => []),
      fetchEdmontonBusinessLicences().catch(() => []),
    ]);

  const rate = trend(policyRate);
  const mortgage = trend(mortgage5y);
  const unemp = trend(unemployment);
  const permitTrend = trend(permits);
  const devTrend = trend(devPermits);
  const bizTrend = trend(licences);

  // Build narrative
  const bullets: { icon: React.ElementType; text: string; signal: "positive" | "negative" | "neutral" }[] = [];

  // Rate story
  if (rate.direction === "down") {
    bullets.push({
      icon: DollarSign,
      text: `BoC rate at ${rate.latest.toFixed(2)}%, trending down. Buyers qualifying for more — your pool is expanding.`,
      signal: "positive",
    });
  } else if (rate.direction === "up") {
    bullets.push({
      icon: DollarSign,
      text: `BoC rate at ${rate.latest.toFixed(2)}%, trending up. Tighter qualifying — focus on move-up buyers with equity.`,
      signal: "negative",
    });
  } else {
    bullets.push({
      icon: DollarSign,
      text: `BoC rate holding at ${rate.latest.toFixed(2)}%. Stable rates = predictable mortgage math for buyers.`,
      signal: "neutral",
    });
  }

  // Mortgage rate
  if (mortgage.latest > 0) {
    bullets.push({
      icon: Home,
      text: `5-year fixed at ${mortgage.latest.toFixed(2)}%. ${mortgage.direction === "down" ? "Falling — good time to lock in." : mortgage.direction === "up" ? "Rising — create urgency for fence-sitters." : "Stable."}`,
      signal: mortgage.direction === "down" ? "positive" : mortgage.direction === "up" ? "negative" : "neutral",
    });
  }

  // Permit activity
  if (permitTrend.direction === "up") {
    bullets.push({
      icon: Building2,
      text: `Edmonton building permits up ${formatPct(permitTrend.pct)} vs 3 months ago. Construction accelerating — new inventory coming.`,
      signal: "positive",
    });
  } else if (permitTrend.direction === "down") {
    bullets.push({
      icon: Building2,
      text: `Edmonton building permits down ${formatPct(permitTrend.pct)}. Slowing construction = tighter future supply.`,
      signal: "neutral",
    });
  }

  // Business licences
  if (bizTrend.direction === "up") {
    bullets.push({
      icon: Store,
      text: `Business licence activity up ${formatPct(bizTrend.pct)}. New businesses = neighbourhood momentum for sellers.`,
      signal: "positive",
    });
  }

  // Unemployment
  if (unemp.direction === "up") {
    bullets.push({
      icon: Users,
      text: `Alberta unemployment trending up (${unemp.latest.toFixed(1)}%). Watch for softer demand — qualify buyers more carefully.`,
      signal: "negative",
    });
  } else if (unemp.direction === "down") {
    bullets.push({
      icon: Users,
      text: `Alberta unemployment trending down (${unemp.latest.toFixed(1)}%). Strong jobs = confident buyers.`,
      signal: "positive",
    });
  }

  const positiveCount = bullets.filter((b) => b.signal === "positive").length;
  const overallSignal = positiveCount >= 3 ? "positive" : positiveCount >= 1 ? "neutral" : "negative";
  const overallLabel =
    overallSignal === "positive"
      ? "Market conditions favour activity"
      : overallSignal === "neutral"
        ? "Mixed signals — be selective"
        : "Challenging market — focus on fundamentals";

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
        <Link href="/overview/signals" className="text-[10px] text-accent hover:underline flex items-center gap-1">
          Full signals dashboard <ChevronRight size={10} />
        </Link>
        <Link href="/dashboard" className="text-[10px] text-accent hover:underline flex items-center gap-1">
          Macro dashboard <ChevronRight size={10} />
        </Link>
      </div>
    </div>
  );
}

// ============================================================
// Section 2: Prospecting Opportunities (where to call this week)
// ============================================================

async function ProspectingOpportunities() {
  const [hotZones, teardowns, renoSignals, convergence] = await Promise.all([
    analyzeTransformationZones().catch(() => [] as TransformationSignal[]),
    analyzeTeardownZones().catch(() => [] as TeardownZone[]),
    analyzeRenovationROI().catch(() => [] as RenovationSignal[]),
    analyzeBusinessResidentialConvergence().catch(() => [] as ConvergenceSignal[]),
  ]);

  // Top transformation zones = best prospecting opportunities
  const topHot = hotZones
    .filter((z) => z.signal === "hot")
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  const topWarming = hotZones
    .filter((z) => z.signal === "warming")
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  // Top teardown zones = seller leads ("your lot is worth more than your house")
  const topTeardowns = teardowns
    .sort((a, b) => b.devPermits - a.devPermits)
    .slice(0, 5);

  // Strong reno areas = homeowners investing = likely to sell in 2-3 years
  const strongReno = renoSignals
    .filter((r) => r.signal === "strong")
    .slice(0, 5);

  // Convergence zones = hot neighbourhoods building homes + businesses
  const topConvergence = convergence
    .sort((a, b) => b.combinedScore - a.combinedScore)
    .slice(0, 3);

  return (
    <div className="space-y-5">
      {/* Hot zones — where to focus */}
      {topHot.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Flame size={14} className="text-red-400" />
            <span className="text-xs font-medium text-red-400 uppercase tracking-wide">
              Hot Zones — High Activity
            </span>
          </div>
          <p className="text-[10px] text-muted mb-2">
            Neighbourhoods with high permit + dev permit activity relative to current assessments.
            Values haven&apos;t caught up to the building activity yet.
          </p>
          <div className="space-y-2">
            {topHot.map((zone) => (
              <div
                key={zone.neighbourhood}
                className="p-3 rounded-lg border border-red-500/20 bg-red-500/5"
              >
                <div className="flex items-start justify-between mb-1.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{zone.neighbourhood}</span>
                      <SignalBadge signal={zone.signal} />
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">{zone.city}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-[10px] text-muted">
                      <span>Avg: {formatMoney(zone.avgAssessment)}</span>
                      <span>{zone.permitCount} permits</span>
                      <span>{zone.devPermitCount} dev permits</span>
                      {zone.unitsAdded > 0 && <span>+{zone.unitsAdded} units</span>}
                    </div>
                  </div>
                  <span className="text-xs font-mono text-muted">{zone.score}</span>
                </div>
                <p className="text-xs text-foreground/70 leading-relaxed">{zone.whyItMatters}</p>
                <p className="text-[10px] text-accent-green mt-1.5 font-medium">
                  Pitch: &ldquo;Your neighbourhood is transforming — let&apos;s talk about what your home is worth now.&rdquo;
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warming zones */}
      {topWarming.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-amber-400" />
            <span className="text-xs font-medium text-amber-400 uppercase tracking-wide">
              Warming — Early Signals
            </span>
          </div>
          <div className="space-y-2">
            {topWarming.map((zone) => (
              <div
                key={zone.neighbourhood}
                className="p-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">{zone.neighbourhood}</span>
                  <SignalBadge signal={zone.signal} />
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">{zone.city}</span>
                  <span className="text-[10px] text-muted">
                    {formatMoney(zone.avgAssessment)} avg | {zone.permitCount} permits
                  </span>
                </div>
                <p className="text-xs text-foreground/70">{zone.whyItMatters}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Teardown opportunities */}
      {topTeardowns.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-orange-400" />
            <span className="text-xs font-medium text-orange-400 uppercase tracking-wide">
              Teardown Zones — Seller Leads
            </span>
          </div>
          <p className="text-[10px] text-muted mb-2">
            Neighbourhoods where dev permits classify activity as &ldquo;Redeveloping&rdquo; — the lot is worth more than the house.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] text-muted uppercase border-b border-card-border">
                  <th className="text-left py-1.5 pr-3">Neighbourhood / City</th>
                  <th className="text-right py-1.5 px-2">Dev Permits</th>
                  <th className="text-right py-1.5 px-2">New Builds</th>
                  <th className="text-right py-1.5 px-2">Avg Assessment</th>
                  <th className="text-right py-1.5 pl-2">Ratio</th>
                </tr>
              </thead>
              <tbody>
                {topTeardowns.map((td) => (
                  <tr key={td.neighbourhood} className="border-b border-card-border/50">
                    <td className="py-1.5 pr-3 font-medium">{td.neighbourhood} <span className="text-[10px] text-muted font-normal">{td.city}</span></td>
                    <td className="text-right py-1.5 px-2">{td.devPermits}</td>
                    <td className="text-right py-1.5 px-2">{td.newConstructionPermits}</td>
                    <td className="text-right py-1.5 px-2">{formatMoney(td.avgAssessment)}</td>
                    <td className={`text-right py-1.5 pl-2 font-mono ${td.ratio >= 1.5 ? "text-red-400" : "text-muted"}`}>
                      {td.ratio.toFixed(1)}x
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-accent-green mt-2 font-medium">
            Pitch: &ldquo;Your lot is worth more than your house — a builder will pay a premium for your land.&rdquo;
          </p>
        </div>
      )}

      {/* Renovation ROI — future sellers */}
      {strongReno.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Wrench size={14} className="text-green-400" />
            <span className="text-xs font-medium text-green-400 uppercase tracking-wide">
              Renovation Hot Spots — Future Sellers
            </span>
          </div>
          <p className="text-[10px] text-muted mb-2">
            Homeowners investing heavily in improvements — they&apos;re building equity and often sell within 2-3 years.
          </p>
          <div className="space-y-1.5">
            {strongReno.map((r) => (
              <div
                key={r.neighbourhood}
                className="flex items-center justify-between p-2 rounded border border-green-500/15 bg-green-500/5"
              >
                <div>
                  <span className="text-sm font-medium">{r.neighbourhood}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent ml-1.5">{r.city}</span>
                  <span className="text-[10px] text-muted ml-2">
                    {r.renovationPermits} renos | avg {formatMoney(r.avgRenovationValue)}
                  </span>
                </div>
                <span className="text-[10px] text-muted">
                  Home avg: {formatMoney(r.avgAssessment)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Convergence zones — homes + businesses building together */}
      {topConvergence.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Store size={14} className="text-cyan-400" />
            <span className="text-xs font-medium text-cyan-400 uppercase tracking-wide">
              Convergence Zones — Homes + Businesses
            </span>
          </div>
          <p className="text-[10px] text-muted mb-2">
            Neighbourhoods building both homes and services simultaneously.
            These are the &ldquo;destination neighbourhoods&rdquo; buyers ask about.
          </p>
          <div className="space-y-1.5">
            {topConvergence.map((c) => (
              <div
                key={c.neighbourhood}
                className="flex items-center justify-between p-2 rounded border border-cyan-500/15 bg-cyan-500/5"
              >
                <div>
                  <span className="text-sm font-medium">{c.neighbourhood}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent ml-1.5">{c.city}</span>
                  <span className="text-[10px] text-muted ml-2">
                    {c.businessLicences} businesses | {c.residentialPermits} residential permits
                  </span>
                </div>
                <span className="text-xs font-mono text-muted">{c.combinedScore}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-accent-green mt-2 font-medium">
            Pitch: &ldquo;This neighbourhood is becoming a destination — new shops, new homes, rising values.&rdquo;
          </p>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Link href="/real-estate/neighbourhoods" className="text-[10px] text-accent hover:underline flex items-center gap-1">
          Full neighbourhood analysis <ChevronRight size={10} />
        </Link>
        <Link href="/real-estate/prospects" className="text-[10px] text-accent hover:underline flex items-center gap-1">
          Prospect leads <ChevronRight size={10} />
        </Link>
      </div>
    </div>
  );
}

// ============================================================
// Section 3: Quick Stats Grid
// ============================================================

async function QuickStats() {
  const [policyRate, mortgage5y, unemployment, permits] = await Promise.all([
    fetchBoCTimeSeries(BOC_SERIES.POLICY_RATE, 6).catch(() => []),
    fetchBoCTimeSeries(BOC_SERIES.MORTGAGE_5Y_FIXED, 6).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.tableId,
      STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.coordinate,
      6
    ).catch(() => []),
    fetchEdmontonPermitsSummary().catch(() => []),
  ]);

  const rate = policyRate.at(-1)?.value;
  const mtg = mortgage5y.at(-1)?.value;
  const unemp = unemployment.at(-1)?.value;
  const permitLatest = permits.at(-1)?.value;
  const permitPrev = permits.at(-2)?.value;

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
        title="Edmonton Permits"
        value={permitLatest ? permitLatest.toLocaleString() : "—"}
        change={
          permitLatest && permitPrev
            ? `${permitLatest > permitPrev ? "+" : ""}${(((permitLatest - permitPrev) / permitPrev) * 100).toFixed(0)}%`
            : undefined
        }
        changeLabel="vs prior month"
        source="Edmonton SODA"
      />
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

export default function RealtorBriefingPage() {
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
          <span>Realtor</span>
        </div>
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-lg bg-accent-green/10">
            <Home size={20} className="text-accent-green" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Realtor Briefing</h1>
            <p className="text-xs text-muted">{today}</p>
          </div>
        </div>
        <p className="text-sm text-muted mt-2">
          Market conditions, prospecting opportunities, and neighbourhood signals —
          everything you need to plan your week.
        </p>
      </header>

      {/* Quick Stats */}
      <Suspense fallback={<LoadingGrid />}>
        <QuickStats />
      </Suspense>

      {/* Market Pulse */}
      <Card>
        <CardHeader
          title="Market Read"
          subtitle="Macro signals that affect your conversations with buyers and sellers"
          badge="LIVE"
        />
        <Suspense fallback={<LoadingSection />}>
          <MarketPulse />
        </Suspense>
      </Card>

      {/* Prospecting Opportunities */}
      <Card>
        <CardHeader
          title="Prospecting Opportunities"
          subtitle="Edmonton + Calgary neighbourhood intelligence — where to focus this week"
          badge="LIVE"
        />
        <Suspense fallback={<LoadingSection />}>
          <ProspectingOpportunities />
        </Suspense>
      </Card>

      {/* Deep Dive Links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {[
          { href: "/real-estate/neighbourhoods", label: "Neighbourhoods", icon: MapPin, desc: "Micro signals" },
          { href: "/overview/signals", label: "Signals", icon: Activity, desc: "Leading indicators" },
          { href: "/real-estate/market", label: "Market Intel", icon: Home, desc: "Price + volume" },
          { href: "/real-estate/prospects", label: "Prospects", icon: Target, desc: "Lead lists" },
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
          Data from Edmonton + Calgary Open Data, Bank of Canada, and Statistics Canada APIs.
          Cross-referencing permits, assessments, dev permits, and business licences across both cities.
        </p>
        <p className="text-[10px] text-muted/60 mt-1">
          This briefing pulls the same live data as the full dashboard — it just frames it for your decisions.
        </p>
      </Card>
    </main>
  );
}
