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
  GraduationCap,
  Heart,
  Home,
  Leaf,
  MapPin,
  Shield,
  ShieldAlert,
  TrendingUp,
  Users,
  Wrench,
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
import { CHART_REGISTRY, CATEGORY_LABELS, CATEGORY_COLORS, type ChartCategory } from "@/lib/chart-registry";
import { Sparkline } from "@/components/sparkline";
import { ThemeToggle } from "@/components/theme-toggle";
import { HeroVisualization } from "@/components/hero-viz";

// 1.3.9 — Updated metadata and OG tags
export const metadata: Metadata = {
  title: "Alberta Pulse — Alberta's Data Platform",
  description:
    "Alberta's data platform: free charts, EDO intelligence tools, realtor market reports, and an Alberta economics learning hub. Live data from 18+ government sources across 30 municipalities.",
  alternates: { canonical: "https://albertapulsecheck.ca" },
  openGraph: {
    images: [
      {
        url: "/api/og?title=Alberta+Pulse&subtitle=Alberta%27s+Data+Platform",
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
// 1.3.2 — Products showcase data
// ============================================================

const products = [
  {
    icon: BarChart3,
    name: "Pulse Charts",
    price: "Free",
    priceColor: "text-accent-green",
    borderColor: "border-accent/30",
    desc: "Browse, share, and embed live Alberta data charts. No account required.",
    audience: "Public, media, researchers",
    status: "available" as const,
    href: "/charts",
    cta: "Browse charts",
  },
  {
    icon: Building2,
    name: "Pulse EDO",
    price: "$299/mo",
    priceColor: "text-indigo-400",
    borderColor: "border-indigo-500/30",
    desc: "Community profiles, peer comparison, trend alerts, and council-ready reports.",
    audience: "Economic development officers",
    status: "coming" as const,
    href: "/pricing",
    cta: "Learn more",
  },
  {
    icon: Home,
    name: "Pulse Realtor",
    price: "$49/mo",
    priceColor: "text-accent",
    borderColor: "border-accent/30",
    desc: "Market intelligence, prospect tracking, and listing presentation tools.",
    audience: "Realtors & brokerages",
    status: "coming" as const,
    href: "/pricing",
    cta: "Learn more",
  },
  {
    icon: GraduationCap,
    name: "Pulse Learn",
    price: "Free",
    priceColor: "text-accent-green",
    borderColor: "border-accent-green/30",
    desc: "Gamified Alberta economics course with live data and a certificate of completion.",
    audience: "Students & newcomers",
    status: "coming" as const,
    href: "/home/learn",
    cta: "Learn more",
  },
];

// 1.3.5 — Product-audience mapping cards
const productAudienceCards = [
  {
    icon: Building2,
    product: "Pulse EDO",
    audience: "EDOs and municipal staff",
    desc: "Automated community profiles, peer benchmarks, and council-ready reports — purpose-built for economic development.",
    price: "$299/mo",
    priceColor: "text-indigo-400",
    href: "/pricing",
  },
  {
    icon: Home,
    product: "Pulse Realtor",
    audience: "Realtors and brokerages",
    desc: "Market intelligence, development permit tracking, and neighbourhood snapshots for listing presentations.",
    price: "$49/mo",
    priceColor: "text-accent",
    href: "/pricing",
  },
  {
    icon: BarChart3,
    product: "Pulse Charts",
    audience: "Researchers, media, and the public",
    desc: "Browse, embed, and share live Alberta data charts. Free forever, no account required.",
    price: "Free",
    priceColor: "text-accent-green",
    href: "/charts",
  },
  {
    icon: GraduationCap,
    product: "Pulse Learn",
    audience: "Students and newcomers",
    desc: "Learn Alberta economics through interactive modules, live data, and quizzes. Earn a certificate.",
    price: "Free",
    priceColor: "text-accent-green",
    href: "/home/learn",
  },
];

// 1.3.6 — Capability cards with product badges
const capabilityCards = [
  { icon: BarChart3, title: "Macro Dashboard", desc: "BoC rates, GDP, CPI, unemployment, retail — all live", href: "/home/dashboard", count: "8 indicators", product: "Charts" },
  { icon: Building2, title: "Real Estate Intel", desc: "Permits, assessments, housing starts, rental vacancy, prospects", href: "/real-estate", count: "7 pages", product: "Realtor" },
  { icon: Flame, title: "Energy & Drilling", desc: "Pipeline throughput, well licences, commodity prices, AESO grid", href: "/economy/energy", count: "16 CER feeds", product: "Charts" },
  { icon: Users, title: "Labour & Migration", desc: "Employment, participation, earnings, interprovincial flows, IRCC data", href: "/community/labour", count: "5 IRCC feeds", product: "EDO" },
  { icon: TrendingUp, title: "Intelligence", desc: "Benchmarks, corridors, risk scoring, investment thesis, compare", href: "/economy/benchmarks", count: "6 analysis tools", product: "EDO" },
  { icon: Zap, title: "Leading Signals", desc: "Cross-indicator analysis separating leading from lagging", href: "/home/signals", count: "Multi-source", product: "Charts" },
  { icon: Leaf, title: "Environment", desc: "Weather, air quality, water levels, wildfire tracking with historical trends", href: "/environment", count: "5 pages", product: "Charts" },
  { icon: Heart, title: "Health & Demographics", desc: "Life expectancy, mortality, births & deaths, demographic trends", href: "/community/health", count: "3 pages", product: "Learn" },
  { icon: ShieldAlert, title: "Public Safety", desc: "Crime stats, fire response, traffic alerts, seismic, emergencies", href: "/community", count: "7 pages", product: "Charts" },
  { icon: Wrench, title: "Tools & API", desc: "REST API access, embeddable charts, data source directory, learn hub", href: "/tools", count: "4 pages", product: "Charts" },
];

const productBadgeColors: Record<string, string> = {
  Charts: "bg-accent/10 text-accent border-accent/20",
  EDO: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  Realtor: "bg-accent/10 text-accent border-accent/20",
  Learn: "bg-accent-green/10 text-accent-green border-accent-green/20",
};

// ============================================================
// Page
// ============================================================

export default function LandingPage() {
  const liveMunicipalities = MUNICIPALITY_REGISTRY.filter((m) => m.status === "live");

  return (
    <main className="min-h-screen relative">
      {/* Full-page animated background */}
      <HeroVisualization />

      {/* Live data bar + sparklines */}
      <Suspense fallback={<PulseBarFallback />}>
        <LivePulseBar />
      </Suspense>

      {/* 1.3.1 — Hero (rewritten) */}
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
            Alberta{"'"}s data platform
            <br />
            <span className="text-accent">Charts. Intelligence. Reports. <img src="/mapleleaf.svg" alt="Canada" width={56} height={56} className="inline-block align-baseline opacity-50 ml-1" /></span>
          </h1>
          <p className="text-muted text-lg max-w-2xl mx-auto">
            {totalFeeds}+ live data feeds powering free charts, municipal intelligence tools,
            realtor market reports, and an Alberta economics learning hub.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <Link
              href="/charts"
              className="flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-lg font-semibold hover:bg-accent-hover transition-colors"
            >
              Browse free charts
              <ArrowRight size={16} />
            </Link>
            <Link
              href="#products"
              className="px-6 py-3 border border-card-border rounded-lg text-foreground hover:bg-card transition-colors"
            >
              See products
            </Link>
          </div>
          <p className="text-xs text-muted/50">
            <Link href="/login" className="hover:text-foreground transition-colors underline underline-offset-2">
              Sign in
            </Link>
          </p>
        </div>
      </section>

      {/* 1.3.3 — Scale stats (platform stats) */}
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
            <p className="text-2xl sm:text-3xl font-bold">{CHART_REGISTRY.length}+</p>
            <p className="text-xs text-muted mt-1">Live charts</p>
          </div>
          <div>
            <p className="text-2xl sm:text-3xl font-bold">{dataSources.length}</p>
            <p className="text-xs text-muted mt-1">Government sources</p>
          </div>
        </div>
      </section>

      {/* 1.3.2 — Products showcase */}
      <section id="products" className="relative max-w-full px-4 py-10 lg:py-28">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-xl sm:text-2xl font-bold">Four products, one data foundation</h2>
            <p className="text-sm text-muted mt-2 max-w-xl mx-auto">
              Every product is built on the same {totalFeeds}+ live government data feeds
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {products.map((p) => (
              <Link
                key={p.name}
                href={p.href}
                className={`group bg-card border ${p.borderColor} rounded-xl p-5 hover:border-accent transition-colors space-y-3`}
              >
                <div className="flex items-center justify-between">
                  <p.icon size={22} className="text-accent" />
                  {p.status === "available" ? (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent-green/10 text-accent-green border border-accent-green/20">
                      Available now
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted/10 text-muted border border-card-border">
                      Coming soon
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{p.name}</h3>
                  <span className={`text-xs font-medium ${p.priceColor}`}>{p.price}</span>
                </div>
                <p className="text-xs text-muted leading-relaxed">{p.desc}</p>
                <p className="text-[10px] text-muted/60">{p.audience}</p>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-accent group-hover:underline">
                  {p.cta}
                  <ArrowRight size={12} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 1.3.4 — Chart Catalogue CTA (branded as Pulse Charts) */}
      <section className="relative max-w-full px-4 py-10 lg:py-28">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <span className="inline-block text-[10px] font-medium px-2.5 py-1 rounded-full bg-accent/10 text-accent border border-accent/20 mb-3">
              Pulse Charts
            </span>
            <div className="flex items-center justify-center gap-2 mb-2">
              <BarChart3 size={20} className="text-accent" />
              <h2 className="text-xl sm:text-2xl font-bold">Browse the Chart Catalogue</h2>
            </div>
            <p className="text-sm text-muted mt-2 max-w-xl mx-auto">
              {CHART_REGISTRY.length} live, embeddable charts — free to explore, share, and embed on your website
            </p>
            <p className="text-xs text-accent-green mt-1">Free forever. No account required.</p>
          </div>

          {/* Featured chart cards — one per category */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
            {(["economy", "real-estate", "community", "environment"] as ChartCategory[]).map((cat) => {
              const charts = CHART_REGISTRY.filter((c) => c.category === cat);
              const featured = charts.slice(0, 2);
              return (
                <div key={cat} className="bg-card border border-card-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[cat]}`}>
                      {CATEGORY_LABELS[cat]}
                    </span>
                    <span className="text-[10px] text-muted font-mono">{charts.length} charts</span>
                  </div>
                  <div className="space-y-2">
                    {featured.map((c) => (
                      <Link
                        key={c.id}
                        href={`/charts/${c.id}`}
                        className="block text-xs text-muted hover:text-accent transition-colors truncate"
                      >
                        {c.title}
                      </Link>
                    ))}
                    {charts.length > 2 && (
                      <span className="text-[10px] text-muted/40">
                        +{charts.length - 2} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-center">
            <Link
              href="/charts"
              className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-lg font-semibold hover:bg-accent-hover transition-colors"
            >
              Explore all {CHART_REGISTRY.length} charts
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* Municipality coverage */}
      <section className="relative border-t border-card-border max-w-full px-4 py-10 lg:py-28">
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

      {/* 1.3.5 — Product-audience mapping */}
      <section className="relative border-y border-card-border bg-card/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-10 lg:py-28">
          <div className="text-center mb-8">
            <h2 className="text-xl sm:text-2xl font-bold">Built for how you work</h2>
            <p className="text-sm text-muted mt-2">
              Each product is tailored to a specific audience and workflow
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {productAudienceCards.map((card) => (
              <Link
                key={card.product}
                href={card.href}
                className="group bg-card border border-card-border rounded-xl p-5 hover:border-accent transition-colors space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <card.icon size={20} className="text-accent" />
                    <h3 className="font-semibold text-sm">{card.product}</h3>
                  </div>
                  <span className={`text-xs font-medium ${card.priceColor}`}>{card.price}</span>
                </div>
                <p className="text-xs text-muted/60 uppercase tracking-wider">{card.audience}</p>
                <p className="text-xs text-muted leading-relaxed">{card.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 1.3.6 — Platform capabilities (with product badges) */}
      <section className="relative max-w-full px-4 py-10 lg:py-28">
        <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-xl sm:text-2xl font-bold">One data foundation, four products</h2>
          <p className="text-sm text-muted mt-2">
            Every page is built on real government data — not scraped, not estimated, not stale
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {capabilityCards.map((section) => (
            <Link
              key={section.title}
              href={section.href}
              className="group bg-card border border-card-border rounded-xl p-5 hover:border-accent transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <section.icon size={20} className="text-accent" />
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${productBadgeColors[section.product]}`}>
                    {section.product}
                  </span>
                  <span className="text-[10px] font-mono text-muted">{section.count}</span>
                </div>
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

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
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

      {/* 1.3.7 — Bottom CTA (rewritten) */}
      <section className="relative py-10 lg:py-28">
        <div className="max-w-lg mx-auto text-center space-y-4">
          <h2 className="text-xl font-bold">Start with free charts. Upgrade when you{"'"}re ready.</h2>
          <p className="text-sm text-muted">
            {CHART_REGISTRY.length}+ live Alberta data charts, free forever.
            Purpose-built products for EDOs and realtors coming soon.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/charts"
              className="flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-lg font-semibold hover:bg-accent-hover transition-colors"
            >
              Browse the chart catalogue
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/pricing"
              className="px-6 py-3 border border-card-border rounded-lg text-foreground hover:bg-card transition-colors text-sm"
            >
              See all products
            </Link>
          </div>
        </div>
      </section>

      {/* 1.3.10 — Footer (with /charts link) */}
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
            <Link href="/charts" className="hover:text-foreground transition-colors">Charts</Link>
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
