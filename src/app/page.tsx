import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Building2,
  GraduationCap,
  Home,
  MapPin,
  Shield,
} from "lucide-react";
import {
  fetchBoCTimeSeries,
  fetchBoCObservations,
  fetchStatCanTimeSeries,
  BOC_SERIES,
  STATSCAN_SERIES,
} from "@/lib/data-sources";
import { MUNICIPALITY_REGISTRY } from "@/lib/municipality-registry";
import { CHART_REGISTRY, CATEGORY_LABELS, CATEGORY_COLORS, type ChartCategory } from "@/lib/chart-registry";
import { Sparkline } from "@/components/sparkline";
import { ThemeToggle } from "@/components/theme-toggle";
import { HeroVisualization } from "@/components/hero-viz";

export const metadata: Metadata = {
  title: "Alberta Pulse — See What's Really Happening in Alberta",
  description:
    "Live economic data for the people who build, sell, and govern Alberta. Free charts, municipal intelligence, realtor market reports, and an economics learning hub — powered by 185+ government data feeds.",
  alternates: { canonical: "https://albertapulsecheck.ca" },
  openGraph: {
    images: [
      {
        url: "/api/og?title=Alberta+Pulse&subtitle=See+what%27s+really+happening+in+Alberta",
        width: 1200,
        height: 630,
      },
    ],
  },
};

// ============================================================
// Data fetching (unchanged)
// ============================================================

interface PulseMetrics {
  policyRate: string;
  cadUsd: string;
  cadChange: string | null;
  unemployment: string;
  unemploymentChange: string | null;
  mortgage5y: string;
  cpi: string;
  cpiChange: string | null;
  population: string;
  popChange: string | null;
  rateHistory: { date: string; value: number }[];
  cadHistory: { date: string; value: number }[];
  unemploymentHistory: { date: string; value: number }[];
  mortgageHistory: { date: string; value: number }[];
  gdpHistory: { date: string; value: number }[];
  housingStartsHistory: { date: string; value: number }[];
}

async function getPulseData(): Promise<PulseMetrics> {
  const [
    policyRateObs,
    cadUsdObs,
    mortgageObs,
    unemploymentData,
    populationData,
    cpiData,
    rateHistory,
    cadHistory,
    unemploymentHistory,
    mortgageHistory,
    gdpHistory,
    housingStartsHistory,
  ] = await Promise.all([
    fetchBoCObservations(BOC_SERIES.POLICY_RATE, 1).catch(() => null),
    fetchBoCObservations(BOC_SERIES.CAD_USD, 2).catch(() => null),
    fetchBoCObservations(BOC_SERIES.MORTGAGE_5Y_FIXED, 1).catch(() => null),
    fetchStatCanTimeSeries(STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.tableId, STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.coordinate, 2).catch(() => []),
    fetchStatCanTimeSeries(STATSCAN_SERIES.AB_POPULATION.tableId, STATSCAN_SERIES.AB_POPULATION.coordinate, 2).catch(() => []),
    fetchStatCanTimeSeries(STATSCAN_SERIES.AB_CPI.tableId, STATSCAN_SERIES.AB_CPI.coordinate, 2).catch(() => []),
    fetchBoCTimeSeries(BOC_SERIES.POLICY_RATE, 24).catch(() => []),
    fetchBoCTimeSeries(BOC_SERIES.CAD_USD, 24).catch(() => []),
    fetchStatCanTimeSeries(STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.tableId, STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.coordinate, 24).catch(() => []),
    fetchBoCTimeSeries(BOC_SERIES.MORTGAGE_5Y_FIXED, 24).catch(() => []),
    fetchStatCanTimeSeries(STATSCAN_SERIES.AB_GDP.tableId, STATSCAN_SERIES.AB_GDP.coordinate, 16).catch(() => []),
    fetchStatCanTimeSeries(STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.tableId, STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.coordinate, 24).catch(() => []),
  ]);

  const policyRate = policyRateObs?.observations?.[0]?.[BOC_SERIES.POLICY_RATE]?.v;
  const cadCurrent = cadUsdObs?.observations?.at(-1)?.[BOC_SERIES.CAD_USD]?.v;
  const cadPrev = cadUsdObs?.observations?.at(-2)?.[BOC_SERIES.CAD_USD]?.v;
  const mortgage5y = mortgageObs?.observations?.[0]?.[BOC_SERIES.MORTGAGE_5Y_FIXED]?.v;

  const cadChange = cadCurrent && cadPrev
    ? ((parseFloat(cadCurrent) - parseFloat(cadPrev)) * 100).toFixed(2)
    : null;

  const latestU = unemploymentData.at?.(-1);
  const prevU = unemploymentData.at?.(-2);
  const latestPop = populationData.at?.(-1);
  const prevPop = populationData.at?.(-2);
  const latestCpi = cpiData.at?.(-1);
  const prevCpi = cpiData.at?.(-2);

  return {
    policyRate: policyRate ? `${policyRate}%` : "—",
    cadUsd: cadCurrent ? `$${parseFloat(cadCurrent).toFixed(4)}` : "—",
    cadChange: cadChange ? `${parseFloat(cadChange) >= 0 ? "+" : ""}${cadChange}¢` : null,
    unemployment: latestU ? `${latestU.value}%` : "—",
    unemploymentChange: latestU && prevU ? `${(latestU.value - prevU.value) >= 0 ? "+" : ""}${(latestU.value - prevU.value).toFixed(1)}pp` : null,
    mortgage5y: mortgage5y ? `${mortgage5y}%` : "—",
    cpi: latestCpi ? `${latestCpi.value}` : "—",
    cpiChange: latestCpi && prevCpi ? `${(latestCpi.value - prevCpi.value) >= 0 ? "+" : ""}${(latestCpi.value - prevCpi.value).toFixed(1)}` : null,
    population: latestPop ? `${(latestPop.value / 1_000_000).toFixed(2)}M` : "—",
    popChange: latestPop && prevPop ? `+${((latestPop.value - prevPop.value) / prevPop.value * 100).toFixed(1)}%` : null,
    rateHistory: rateHistory,
    cadHistory: cadHistory,
    unemploymentHistory: unemploymentHistory,
    mortgageHistory: mortgageHistory,
    gdpHistory: gdpHistory,
    housingStartsHistory: housingStartsHistory,
  };
}

// ============================================================
// LivePulseBar + Fallback (unchanged — do not modify)
// ============================================================

async function LivePulseBar() {
  const d = await getPulseData();

  const tickers = [
    { label: "BoC Rate", value: d.policyRate, change: null },
    { label: "CAD/USD", value: d.cadUsd, change: d.cadChange },
    { label: "5Y Mortgage", value: d.mortgage5y, change: null },
    { label: "AB Unemployment", value: d.unemployment, change: d.unemploymentChange },
    { label: "AB CPI", value: d.cpi, change: d.cpiChange },
    { label: "AB Population", value: d.population, change: d.popChange },
  ];

  const sparkCards = [
    { title: "BoC Policy Rate", data: d.rateHistory, color: "#3b82f6", suffix: "%" },
    { title: "CAD/USD", data: d.cadHistory, color: "#10b981", prefix: "$" },
    { title: "AB Unemployment", data: d.unemploymentHistory, color: "#f97316", suffix: "%" },
    { title: "5Y Fixed Mortgage", data: d.mortgageHistory, color: "#ef4444", suffix: "%" },
    { title: "Alberta GDP", data: d.gdpHistory, color: "#a855f7", compact: true },
    { title: "Housing Starts", data: d.housingStartsHistory, color: "#06b6d4", compact: true },
  ];

  return (
    <>
      {/* Live ticker */}
      <div className="border-b border-card-border bg-card sticky top-0 z-30 relative">
        <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-1 overflow-x-auto scrollbar-none">
          <span className="flex items-center gap-1.5 shrink-0 mr-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-green" />
            </span>
            <span className="text-[10px] font-mono text-muted uppercase tracking-wider">Live</span>
          </span>
          {tickers.map((t) => (
            <div key={t.label} className="flex items-center gap-1.5 px-3 py-0.5 shrink-0">
              <span className="text-[10px] text-muted font-medium">{t.label}</span>
              <span className="text-xs font-semibold">{t.value}</span>
              {t.change && (
                <span className={`text-[10px] ${t.change.startsWith("+") ? "text-accent-green" : t.change.startsWith("-") ? "text-accent-red" : "text-muted"}`}>
                  {t.change}
                </span>
              )}
            </div>
          ))}
          {/* Maple leaf on the right */}
          <span className="ml-auto shrink-0 pl-2">
            <img src="/mapleleaf.svg" alt="" width={14} height={14} className="opacity-40" />
          </span>
        </div>
      </div>

      {/* Sparkline grid */}
      <section className="relative z-10 bg-card pb-2 border-b border-card-border">
        <div className="max-w-6xl mx-auto px-4 pt-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {sparkCards.map((card) => {
            const latest = card.data.at?.(-1);
            const prev = card.data.at?.(-2);
            const val = latest?.value;
            const displayVal = val != null
              ? card.compact
                ? val >= 1_000_000_000
                  ? `${(val / 1_000_000_000).toFixed(1)}B`
                  : val >= 1_000_000
                    ? `${(val / 1_000_000).toFixed(1)}M`
                    : val >= 1_000
                      ? `${(val / 1_000).toFixed(0)}K`
                      : val.toLocaleString()
                : `${card.prefix || ""}${typeof val === "number" ? val.toLocaleString(undefined, { maximumFractionDigits: 2 }) : val}${card.suffix || ""}`
              : "—";
            const delta = val != null && prev?.value != null ? val - prev.value : null;
            const pctChange = delta != null && prev?.value ? ((delta / prev.value) * 100).toFixed(1) : null;

            return (
              <div key={card.title} className="bg-card border border-card-border rounded-xl p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted font-medium leading-tight">{card.title}</span>
                  <span className="text-[9px] font-mono text-accent/60">LIVE</span>
                </div>
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <span className="text-lg font-semibold tracking-tight leading-none">{displayVal}</span>
                    {pctChange && (
                      <span className={`block text-[10px] mt-0.5 ${parseFloat(pctChange) >= 0 ? "text-accent-green" : "text-accent-red"}`}>
                        {parseFloat(pctChange) >= 0 ? "+" : ""}{pctChange}%
                      </span>
                    )}
                  </div>
                  <Sparkline data={card.data} color={card.color} width={80} height={28} />
                </div>
              </div>
            );
          })}
        </div>
        </div>
      </section>
    </>
  );
}

function PulseBarFallback() {
  return (
    <>
      <div className="border-b border-card-border bg-card relative z-10">
        <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-4">
          <div className="h-3 w-32 bg-card-border rounded animate-pulse" />
          <div className="h-3 w-48 bg-card-border rounded animate-pulse" />
          <div className="h-3 w-40 bg-card-border rounded animate-pulse" />
        </div>
      </div>
      <section className="max-w-6xl mx-auto px-4 pt-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-card border border-card-border rounded-xl p-3 animate-pulse">
              <div className="h-3 w-16 bg-card-border rounded mb-2" />
              <div className="h-5 w-12 bg-card-border rounded" />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

// ============================================================
// Static data
// ============================================================

const dataSources = [
  { name: "Bank of Canada", feeds: 13 },
  { name: "Statistics Canada", feeds: 40 },
  { name: "Edmonton Open Data", feeds: 5 },
  { name: "Calgary Open Data", feeds: 8 },
  { name: "Alberta Regional Dashboard", feeds: 54 },
  { name: "Canada Energy Regulator", feeds: 16 },
  { name: "ArcGIS Municipal", feeds: 22 },
  { name: "IRCC Immigration", feeds: 5 },
  { name: "Alberta Major Projects", feeds: 2 },
  { name: "CMHC Housing", feeds: 6 },
  { name: "AESO Electricity", feeds: 3 },
  { name: "AER Well Licences", feeds: 1 },
  { name: "CWFIS Wildfire", feeds: 2 },
  { name: "511 Alberta", feeds: 1 },
  { name: "Alberta CKAN Health", feeds: 3 },
  { name: "Infrastructure Canada", feeds: 2 },
  { name: "Edmonton Fire & EMS", feeds: 1 },
  { name: "CRA Tax Stats", feeds: 1 },
];

const totalFeeds = dataSources.reduce((sum, s) => sum + s.feeds, 0);

// ============================================================
// Page
// ============================================================

export default function LandingPage() {
  const liveMunicipalities = MUNICIPALITY_REGISTRY.filter((m) => m.status === "live");

  return (
    <main className="min-h-screen relative">
      {/* Full-page animated background */}
      <HeroVisualization />

      {/* Live data bar + sparklines (unchanged) */}
      <Suspense fallback={<PulseBarFallback />}>
        <LivePulseBar />
      </Suspense>

      {/* ── Section 1: Hero ── */}
      <section className="relative overflow-hidden">
        <div className="relative max-w-3xl mx-auto px-6 py-16 sm:py-20 lg:py-32 text-center space-y-6">
          <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
            <ThemeToggle />
          </div>

          <div className="flex items-center justify-center gap-2.5">
            <Activity size={28} className="text-accent" />
            <span className="text-lg font-bold tracking-tight">Alberta Pulse</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight">
            See what{"'"}s really happening
            <br />
            <span className="text-accent">in Alberta</span>
          </h1>

          <p className="text-muted text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed">
            Live economic data for the people who build, sell, and govern this province.
            {" "}<span className="text-foreground font-medium">{totalFeeds}+ data feeds</span> from{" "}
            <span className="text-foreground font-medium">{dataSources.length} government sources</span> across{" "}
            <span className="text-foreground font-medium">{liveMunicipalities.length} municipalities</span>.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/charts"
              className="flex items-center gap-2 px-7 py-3.5 bg-accent text-white rounded-2xl font-semibold hover:bg-accent-hover transition-colors text-base shadow-lg shadow-accent/20"
            >
              Explore free charts
              <ArrowRight size={18} />
            </Link>
            <Link
              href="#for-professionals"
              className="px-7 py-3.5 border border-card-border rounded-2xl text-foreground hover:bg-card transition-colors text-base"
            >
              For professionals
            </Link>
          </div>

          <p className="text-sm text-muted">
            <Link href="/login" className="hover:text-foreground transition-colors underline underline-offset-4 decoration-card-border">
              Sign in to your account
            </Link>
          </p>
        </div>
      </section>

      {/* ── Section 2: Chart catalogue showcase ── */}
      <section className="relative max-w-full px-6 py-16 lg:py-24">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-sm font-medium text-accent mb-2">Free forever. No account required.</p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {CHART_REGISTRY.length}+ live charts, ready to explore
            </h2>
            <p className="text-base text-muted mt-3 max-w-xl mx-auto leading-relaxed">
              Every chart pulls directly from government APIs — not scraped, not estimated, not stale.
              Browse, share, or embed them on your website.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {(["economy", "real-estate", "community", "environment"] as ChartCategory[]).map((cat) => {
              const charts = CHART_REGISTRY.filter((c) => c.category === cat);
              const featured = charts.slice(0, 3);
              return (
                <Link
                  key={cat}
                  href={`/charts?category=${cat}`}
                  className="group bg-card border border-card-border rounded-2xl p-5 hover:border-accent/40 transition-colors"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${CATEGORY_COLORS[cat]}`}>
                      {CATEGORY_LABELS[cat]}
                    </span>
                    <span className="text-xs text-muted font-mono">{charts.length}</span>
                  </div>
                  <div className="space-y-2.5">
                    {featured.map((c) => (
                      <p
                        key={c.id}
                        className="text-sm text-muted group-hover:text-foreground transition-colors truncate leading-snug"
                      >
                        {c.title}
                      </p>
                    ))}
                    {charts.length > 3 && (
                      <p className="text-xs text-muted/50">
                        +{charts.length - 3} more
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="text-center">
            <Link
              href="/charts"
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-accent text-white rounded-2xl font-semibold hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20"
            >
              Browse the full catalogue
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Section 3: For professionals ── */}
      <section id="for-professionals" className="relative border-y border-card-border bg-card/60 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-16 lg:py-24">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Purpose-built tools for your work
            </h2>
            <p className="text-base text-muted mt-3 max-w-xl mx-auto leading-relaxed">
              The same live data, shaped for how you actually use it.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* EDO */}
            <div className="bg-card border border-card-border rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Building2 size={20} className="text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold">For economic development officers</h3>
                  <p className="text-sm text-muted">$299/mo per municipality</p>
                </div>
              </div>
              <p className="text-sm text-muted leading-relaxed">
                Automated community profiles, peer comparison across 26 indicators,
                trend alerts, council-ready reports, and investment pitch kits — all generated from live data.
              </p>
              <ul className="text-sm text-muted space-y-1.5">
                <li className="flex items-start gap-2"><span className="text-accent mt-0.5">&#10132;</span> Compare your municipality to peers</li>
                <li className="flex items-start gap-2"><span className="text-accent mt-0.5">&#10132;</span> Get alerted when indicators shift</li>
                <li className="flex items-start gap-2"><span className="text-accent mt-0.5">&#10132;</span> Export PDF reports for council</li>
              </ul>
              <Link href="/pricing" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
                Learn more <ArrowRight size={14} />
              </Link>
            </div>

            {/* Realtor */}
            <div className="bg-card border border-card-border rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Home size={20} className="text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold">For realtors &amp; brokerages</h3>
                  <p className="text-sm text-muted">$49/mo per seat</p>
                </div>
              </div>
              <p className="text-sm text-muted leading-relaxed">
                Market intelligence, development permit tracking, neighbourhood deep dives,
                and branded reports you can hand to clients — built for how realtors actually work.
              </p>
              <ul className="text-sm text-muted space-y-1.5">
                <li className="flex items-start gap-2"><span className="text-accent mt-0.5">&#10132;</span> Track new permits in your area</li>
                <li className="flex items-start gap-2"><span className="text-accent mt-0.5">&#10132;</span> Neighbourhood snapshots for listings</li>
                <li className="flex items-start gap-2"><span className="text-accent mt-0.5">&#10132;</span> Market reports in one click</li>
              </ul>
              <Link href="/pricing" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
                Learn more <ArrowRight size={14} />
              </Link>
            </div>

            {/* Learn */}
            <div className="bg-card border border-card-border rounded-2xl p-6 space-y-4 sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <GraduationCap size={20} className="text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold">Learn Alberta economics</h3>
                  <p className="text-sm text-accent-green font-medium">Free</p>
                </div>
              </div>
              <p className="text-sm text-muted leading-relaxed">
                Eight interactive modules covering energy, housing, tax, immigration, and more —
                with quizzes, live charts, and a certificate when you finish.
              </p>
              <ul className="text-sm text-muted space-y-1.5">
                <li className="flex items-start gap-2"><span className="text-accent mt-0.5">&#10132;</span> 8 modules, 35+ lessons</li>
                <li className="flex items-start gap-2"><span className="text-accent mt-0.5">&#10132;</span> Built on real Alberta data</li>
                <li className="flex items-start gap-2"><span className="text-accent mt-0.5">&#10132;</span> Earn a certificate of completion</li>
              </ul>
              <Link href="/learn" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
                Start learning <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 4: Trust bar ── */}
      <section className="relative">
        <div className="max-w-5xl mx-auto px-6 py-10 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-sm text-muted">
          <div className="flex items-center gap-2.5">
            <Shield size={16} className="text-accent-green" />
            <span>100% government data sources</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Activity size={16} className="text-accent" />
            <span>Updated hourly</span>
          </div>
          <div className="flex items-center gap-2.5">
            <BarChart3 size={16} className="text-accent-gold" />
            <span>{CHART_REGISTRY.length}+ live charts</span>
          </div>
          <div className="flex items-center gap-2.5">
            <MapPin size={16} className="text-accent" />
            <span>Built in Parkland County, AB</span>
            <img src="/mapleleaf.svg" alt="" width={14} height={14} className="opacity-50" />
          </div>
        </div>
      </section>

      {/* ── Section 5: Bottom CTA ── */}
      <section className="relative py-16 lg:py-24">
        <div className="max-w-lg mx-auto text-center space-y-5 px-6">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Start exploring — it{"'"}s free
          </h2>
          <p className="text-base text-muted leading-relaxed">
            {CHART_REGISTRY.length}+ live Alberta data charts, free forever.
            Professional tools for EDOs and realtors when you{"'"}re ready.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
            <Link
              href="/charts"
              className="flex items-center gap-2 px-7 py-3.5 bg-accent text-white rounded-2xl font-semibold hover:bg-accent-hover transition-colors shadow-lg shadow-accent/20"
            >
              Browse the chart catalogue
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/pricing"
              className="px-7 py-3.5 border border-card-border rounded-2xl text-foreground hover:bg-card transition-colors"
            >
              See pricing
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative border-t border-card-border bg-card/60 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted/60">
          <div className="flex items-center gap-2.5">
            <Activity size={14} className="text-accent" />
            <span>Alberta Pulse</span>
            <span className="text-card-border">|</span>
            <span>Built in Parkland County, Alberta</span>
            <img src="/mapleleaf.svg" alt="" width={12} height={12} className="opacity-30" />
          </div>
          <div className="flex items-center gap-5">
            <Link href="/charts" className="hover:text-foreground transition-colors">Charts</Link>
            <Link href="/learn" className="hover:text-foreground transition-colors">Learn</Link>
            <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/login" className="hover:text-foreground transition-colors">Sign in</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
