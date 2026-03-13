import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Building2,
  Database,
  Flame,
  Globe,
  HardHat,
  Landmark,
  MapPin,
  Newspaper,
  PiggyBank,
  Shield,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import {
  fetchBoCTimeSeries,
  fetchBoCObservations,
  fetchStatCanTimeSeries,
  BOC_SERIES,
  STATSCAN_SERIES,
} from "@/lib/data-sources";
import { MUNICIPALITY_REGISTRY } from "@/lib/municipality-registry";
import { Sparkline } from "@/components/sparkline";
import { ThemeToggle } from "@/components/theme-toggle";
import { HeroVisualization } from "@/components/hero-viz";

export const metadata: Metadata = {
  title: "Alberta Pulse Check — Real-Time Economic Intelligence for Alberta",
  description:
    "Live economic data from 8+ government sources across 22 Alberta municipalities. Building permits, assessments, energy prices, labour market, migration, and more — updated daily.",
  alternates: { canonical: "https://albertapulsecheck.ca" },
  openGraph: {
    images: [
      {
        url: "/api/og?title=Alberta+Pulse+Check&subtitle=Real-Time+Economic+Intelligence+for+Alberta",
        width: 1200,
        height: 630,
      },
    ],
  },
};

// ============================================================
// Data fetching
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
  // Sparkline data
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
    // Sparklines — 24 data points each
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
// Sections
// ============================================================

const regions: { key: string; label: string; color: string }[] = [
  { key: "edmonton-metro", label: "Edmonton Metro", color: "bg-accent" },
  { key: "calgary-metro", label: "Calgary Metro", color: "bg-accent-red" },
  { key: "central", label: "Central", color: "bg-accent-gold" },
  { key: "south", label: "South", color: "bg-accent-green" },
  { key: "north", label: "North", color: "bg-[#8b5cf6]" },
  { key: "northeast", label: "Northeast", color: "bg-accent-amber" },
];

const roleCards = [
  { icon: Building2, label: "Realtor", href: "/overview/briefing/realtor", desc: "Market positioning, inventory signals, price trends" },
  { icon: HardHat, label: "Developer", href: "/overview/briefing/developer", desc: "Permit pipeline, land supply, construction costs" },
  { icon: PiggyBank, label: "Investor", href: "/overview/briefing/investor", desc: "Yield analysis, growth corridors, risk scoring" },
  { icon: Landmark, label: "Lender", href: "/overview/briefing/lender", desc: "Rate impact, delinquency signals, market health" },
  { icon: Globe, label: "EDO", href: "/overview/briefing/edo", desc: "Business formation, labour supply, infrastructure" },
  { icon: Newspaper, label: "Journalist", href: "/overview/briefing/journalist", desc: "Trend detection, cross-indicator stories, data access" },
  { icon: Flame, label: "Energy", href: "/overview/briefing/energy", desc: "Commodity prices, drilling activity, pipeline data" },
  { icon: MapPin, label: "Site Selection", href: "/overview/briefing/site-selection", desc: "Demographics, zoning, infrastructure, cost of land" },
];

const dataSources = [
  { name: "Bank of Canada", feeds: 13 },
  { name: "Statistics Canada", feeds: 40 },
  { name: "Edmonton Open Data", feeds: 5 },
  { name: "Calgary Open Data", feeds: 4 },
  { name: "Alberta Regional Dashboard", feeds: 54 },
  { name: "Canada Energy Regulator", feeds: 16 },
  { name: "ArcGIS Municipal", feeds: 20 },
  { name: "IRCC Immigration", feeds: 5 },
  { name: "Alberta Major Projects", feeds: 2 },
  { name: "CMHC Housing", feeds: 6 },
];

const totalFeeds = dataSources.reduce((sum, s) => sum + s.feeds, 0);

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
// Page
// ============================================================

export default function LandingPage() {
  const liveMunicipalities = MUNICIPALITY_REGISTRY.filter((m) => m.status === "live");
  const totalCapabilities = MUNICIPALITY_REGISTRY.reduce((sum, m) => sum + m.capabilities.length, 0);

  return (
    <main className="min-h-screen relative">
      {/* Full-page animated background */}
      <HeroVisualization />

      {/* Live data bar + sparklines */}
      <Suspense fallback={<PulseBarFallback />}>
        <LivePulseBar />
      </Suspense>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="relative max-w-5xl mx-auto px-4 py-12 sm:py-16 lg:py-32 text-center space-y-5">
          {/* Theme toggle — top right */}
          <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
            <ThemeToggle />
          </div>

          <div className="flex items-center justify-center gap-2 mb-2">
            <Activity size={28} className="text-accent" />
            <span className="text-lg font-bold">Alberta Pulse Check</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold leading-tight">
            Community intelligence
            <br />
            <span className="text-accent">built in Alberta, for Alberta <img src="/mapleleaf.svg" alt="Canada" width={56} height={56} className="inline-block align-baseline opacity-50 ml-1" /></span>
          </h1>
          <p className="text-muted text-lg max-w-2xl mx-auto">
            {totalFeeds}+ live data feeds from {dataSources.length} government sources,
            covering {liveMunicipalities.length} municipalities across Alberta.
            Cross-analyzed and delivered to your dashboard — no stale reports, no guesswork.
          </p>

          <div className="flex items-center justify-center gap-4 pt-4">
            <Link
              href="/login"
              className="flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-lg font-semibold hover:bg-accent-hover transition-colors"
            >
              Try it free for 14 days
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/dashboard"
              className="px-6 py-3 border border-card-border rounded-lg text-foreground hover:bg-card transition-colors"
            >
              Explore the dashboard
            </Link>
          </div>
          <p className="text-xs text-muted/50">No credit card required</p>
        </div>
      </section>

      {/* Scale stats */}
      <section className="relative border-y border-card-border bg-card/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-6 lg:py-10 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          <div>
            <p className="text-2xl sm:text-3xl font-bold">{totalFeeds}+</p>
            <p className="text-xs text-muted mt-1">Live data feeds</p>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-bold">{liveMunicipalities.length}</p>
            <p className="text-xs text-muted mt-1">Municipalities tracked</p>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-bold">54</p>
            <p className="text-xs text-muted mt-1">Regional indicators</p>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-bold">{dataSources.length}</p>
            <p className="text-xs text-muted mt-1">Government sources</p>
          </div>
        </div>
      </section>

      {/* Municipality coverage */}
      <section className="relative max-w-full px-4 py-10 lg:py-28">
        <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-xl sm:text-2xl font-bold">Province-wide coverage</h2>
          <p className="text-sm text-muted mt-2">
            {liveMunicipalities.length} municipalities live across {regions.length} regions — permits, assessments, businesses, zoning, and more
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {regions.map((region) => {
            const munis = MUNICIPALITY_REGISTRY.filter((m) => m.region === region.key);
            if (munis.length === 0) return null;
            return (
              <div key={region.key} className="bg-card border border-card-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-2 h-2 rounded-full ${region.color}`} />
                  <span className="text-sm font-semibold">{region.label}</span>
                  <span className="text-[10px] text-muted font-mono ml-auto">
                    {munis.filter((m) => m.status === "live").length}/{munis.length} live
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {munis.map((m) => (
                    <Link
                      key={m.slug}
                      href={m.status === "live" ? `/municipalities/${m.slug}` : "#"}
                      className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                        m.status === "live"
                          ? "border-card-border hover:border-accent hover:text-accent cursor-pointer"
                          : "border-card-border/50 text-muted/50 cursor-default"
                      }`}
                    >
                      {m.name.replace(" (Fort McMurray)", "")}
                      {m.status === "planned" && <span className="ml-1 text-[9px] text-muted/40">soon</span>}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        </div>
      </section>

      {/* Role-based entry */}
      <section className="relative border-y border-card-border bg-card/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-10 lg:py-28">
          <div className="text-center mb-8">
            <h2 className="text-xl sm:text-2xl font-bold">Built for your role</h2>
            <p className="text-sm text-muted mt-2">
              Get a briefing tailored to what you actually need to know
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {roleCards.map((role) => (
              <Link
                key={role.label}
                href={role.href}
                className="group bg-card border border-card-border rounded-xl p-4 hover:border-accent transition-colors space-y-2"
              >
                <role.icon size={20} className="text-accent group-hover:scale-110 transition-transform" />
                <h3 className="font-semibold text-sm">{role.label}</h3>
                <p className="text-[11px] text-muted leading-relaxed">{role.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* What's inside — page sections */}
      <section className="relative max-w-full px-4 py-10 lg:py-28">
        <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-xl sm:text-2xl font-bold">Deep, not wide</h2>
          <p className="text-sm text-muted mt-2">
            Every page is built on real government data — not scraped, not estimated, not stale
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { icon: BarChart3, title: "Macro Dashboard", desc: "BoC rates, GDP, CPI, unemployment, retail — all live", href: "/dashboard", count: "8 indicators" },
            { icon: Building2, title: "Real Estate Intel", desc: "Permits, assessments, housing starts, rental vacancy, prospects", href: "/real-estate", count: "7 pages" },
            { icon: Flame, title: "Energy & Drilling", desc: "Pipeline throughput, well licences, commodity prices, AESO grid", href: "/economy/energy", count: "16 CER feeds" },
            { icon: Users, title: "Labour & Migration", desc: "Employment, participation, earnings, interprovincial flows, IRCC data", href: "/economy/labour", count: "5 IRCC feeds" },
            { icon: TrendingUp, title: "Intelligence", desc: "Benchmarks, corridors, risk scoring, investment thesis", href: "/intelligence", count: "5 analysis tools" },
            { icon: Zap, title: "Leading Signals", desc: "Cross-indicator analysis separating leading from lagging", href: "/overview/signals", count: "Multi-source" },
          ].map((section) => (
            <Link
              key={section.title}
              href={section.href}
              className="group bg-card border border-card-border rounded-xl p-5 hover:border-accent transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <section.icon size={20} className="text-accent" />
                <span className="text-[10px] font-mono text-muted">{section.count}</span>
              </div>
              <h3 className="font-semibold text-sm mb-1">{section.title}</h3>
              <p className="text-xs text-muted leading-relaxed">{section.desc}</p>
            </Link>
          ))}
        </div>
        </div>
      </section>

      {/* Data sources */}
      <section className="relative border-y border-card-border bg-card/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-10 lg:py-28">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Database size={16} className="text-accent-gold" />
              <h2 className="text-xl sm:text-2xl font-bold">{dataSources.length} government sources</h2>
            </div>
            <p className="text-sm text-muted">
              100% public data. No scraping, no estimates. Direct from the source.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {dataSources.map((source) => (
              <div
                key={source.name}
                className="flex items-center gap-2 px-3 py-2 bg-card border border-card-border rounded-lg"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-accent-green shrink-0" />
                <span className="text-xs font-medium leading-tight">{source.name}</span>
                <span className="text-[10px] text-muted font-mono ml-auto shrink-0">{source.feeds}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="relative bg-card/80 backdrop-blur-sm border-b border-card-border">
        <div className="max-w-5xl mx-auto px-4 py-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted">
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-accent-green" />
            <span>100% government data sources</span>
          </div>
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-accent" />
            <span>Updated hourly</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin size={14} className="text-accent-gold" />
            <span>Built in Parkland County, AB</span>
            <img src="/mapleleaf.svg" alt="" width={14} height={14} className="opacity-50" />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-10 lg:py-28">
        <div className="max-w-lg mx-auto text-center space-y-4">
          <h2 className="text-xl font-bold">Start making data-driven decisions</h2>
          <p className="text-sm text-muted">
            14-day free trial. Plans start at $29/month CAD.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/login"
              className="flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-lg font-semibold hover:bg-accent-hover transition-colors"
            >
              Start free trial
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/pricing"
              className="px-6 py-3 border border-card-border rounded-lg text-foreground hover:bg-card transition-colors text-sm"
            >
              See pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-card-border bg-card/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted/50">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-accent" />
            <span>Alberta Pulse Check</span>
            <span className="text-card-border">|</span>
            <span>Built in Parkland County, Alberta</span>
            <img src="/mapleleaf.svg" alt="" width={12} height={12} className="opacity-30" />
          </div>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <Link href="/login" className="hover:text-foreground transition-colors">Sign in</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
