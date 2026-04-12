import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  Activity,
  ArrowRight,
  Shield,
  MapPin,
} from "lucide-react";
import {
  fetchBoCTimeSeries,
  fetchBoCObservations,
  fetchStatCanTimeSeries,
  BOC_SERIES,
  STATSCAN_SERIES,
} from "@/lib/data-sources";
import { MUNICIPALITY_REGISTRY } from "@/lib/municipality-registry";
import { CHART_REGISTRY } from "@/lib/chart-registry";
import { Sparkline } from "@/components/sparkline";
import { ThemeToggle } from "@/components/theme-toggle";
import { HeroVisualization } from "@/components/hero-viz";
import { LandingTabs } from "@/components/landing-tabs";

export const metadata: Metadata = {
  title: "Alberta Pulse Check — Live Economic Intelligence for Alberta",
  description:
    "Live economic data for the people who build, sell, and govern Alberta. Free charts, municipal intelligence, real estate market reports, and an economics learning hub — powered by 185+ government data feeds.",
  alternates: { canonical: "https://albertapulsecheck.ca" },
  openGraph: {
    images: [
      {
        url: "/api/og?title=Alberta+Pulse+Check&subtitle=Live+economic+intelligence+for+Alberta",
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
  unemployment: string;
  mortgage5y: string;
  rateHistory: { date: string; value: number }[];
  cadHistory: { date: string; value: number }[];
  unemploymentHistory: { date: string; value: number }[];
  mortgageHistory: { date: string; value: number }[];
}

async function getPulseData(): Promise<PulseMetrics> {
  const [
    policyRateObs,
    cadUsdObs,
    mortgageObs,
    unemploymentData,
    rateHistory,
    cadHistory,
    unemploymentHistory,
    mortgageHistory,
  ] = await Promise.all([
    fetchBoCObservations(BOC_SERIES.POLICY_RATE, 1).catch(() => null),
    fetchBoCObservations(BOC_SERIES.CAD_USD, 1).catch(() => null),
    fetchBoCObservations(BOC_SERIES.MORTGAGE_5Y_FIXED, 1).catch(() => null),
    fetchStatCanTimeSeries(STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.tableId, STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.coordinate, 1).catch(() => []),
    fetchBoCTimeSeries(BOC_SERIES.POLICY_RATE, 24).catch(() => []),
    fetchBoCTimeSeries(BOC_SERIES.CAD_USD, 24).catch(() => []),
    fetchStatCanTimeSeries(STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.tableId, STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.coordinate, 24).catch(() => []),
    fetchBoCTimeSeries(BOC_SERIES.MORTGAGE_5Y_FIXED, 24).catch(() => []),
  ]);

  const policyRate = policyRateObs?.observations?.[0]?.[BOC_SERIES.POLICY_RATE]?.v;
  const cadCurrent = cadUsdObs?.observations?.at(-1)?.[BOC_SERIES.CAD_USD]?.v;
  const mortgage5y = mortgageObs?.observations?.[0]?.[BOC_SERIES.MORTGAGE_5Y_FIXED]?.v;
  const latestU = unemploymentData.at?.(-1);

  return {
    policyRate: policyRate ? `${policyRate}%` : "—",
    cadUsd: cadCurrent ? `$${parseFloat(cadCurrent).toFixed(4)}` : "—",
    unemployment: latestU ? `${latestU.value}%` : "—",
    mortgage5y: mortgage5y ? `${mortgage5y}%` : "—",
    rateHistory,
    cadHistory,
    unemploymentHistory,
    mortgageHistory,
  };
}

// ============================================================
// Live proof strip — compact, 4 indicators with sparklines
// ============================================================

async function LiveProofStrip() {
  const d = await getPulseData();

  const indicators = [
    { label: "BoC Rate", value: d.policyRate, data: d.rateHistory, color: "#3b82f6" },
    { label: "CAD/USD", value: d.cadUsd, data: d.cadHistory, color: "#10b981" },
    { label: "AB Unemployment", value: d.unemployment, data: d.unemploymentHistory, color: "#f97316" },
    { label: "5Y Mortgage", value: d.mortgage5y, data: d.mortgageHistory, color: "#ef4444" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto">
      {indicators.map((ind) => (
        <div key={ind.label} className="bg-card/80 backdrop-blur border border-card-border rounded-xl px-3 py-2.5 flex items-center gap-3">
          <div className="min-w-0">
            <p className="text-[10px] text-muted font-medium truncate">{ind.label}</p>
            <p className="text-sm font-semibold leading-tight">{ind.value}</p>
          </div>
          <Sparkline data={ind.data} color={ind.color} width={56} height={20} />
        </div>
      ))}
    </div>
  );
}

function LiveProofFallback() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-card/80 border border-card-border rounded-xl px-3 py-2.5 animate-pulse">
          <div className="h-3 w-16 bg-card-border rounded mb-1.5" />
          <div className="h-4 w-12 bg-card-border rounded" />
        </div>
      ))}
    </div>
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

// Key sources to display as trust logos
const trustSources = [
  "Bank of Canada",
  "Statistics Canada",
  "CMHC",
  "Canada Energy Regulator",
  "IRCC",
];

// ============================================================
// Page
// ============================================================

export default function LandingPage() {
  const liveMunicipalities = MUNICIPALITY_REGISTRY.filter((m) => m.status === "live");
  const chartCount = CHART_REGISTRY.length;

  return (
    <main className="min-h-screen relative">
      {/* Full-page animated background */}
      <HeroVisualization />

      {/* ── Hero ── */}
      <section className="relative">
        <div className="relative max-w-3xl mx-auto px-6 pt-16 sm:pt-24 lg:pt-32 pb-12 text-center space-y-8">
          <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
            <ThemeToggle />
          </div>

          <div className="flex items-center justify-center gap-2.5">
            <Activity size={28} className="text-accent" />
            <span className="text-lg font-bold tracking-tight">Alberta Pulse Check</span>
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight">
              Alberta{"'"}s economy,{" "}
              <span className="text-accent">one place</span>
            </h1>

            <p className="text-muted text-lg sm:text-xl max-w-xl mx-auto leading-relaxed">
              {chartCount}+ live charts from {dataSources.length} government sources.
              Free to browse. No account needed.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/charts"
              className="flex items-center gap-2 px-7 py-3.5 bg-accent text-white rounded-2xl font-semibold hover:bg-accent-hover transition-colors text-base shadow-lg shadow-accent/20"
            >
              Explore free charts
              <ArrowRight size={18} />
            </Link>
            <Link
              href="/pricing"
              className="px-7 py-3.5 border border-card-border rounded-2xl text-foreground hover:bg-card transition-colors text-base"
            >
              See professional tools
            </Link>
          </div>
        </div>

        {/* Live proof — small sparkline strip right under hero */}
        <div className="relative px-6 pb-16 sm:pb-20">
          <Suspense fallback={<LiveProofFallback />}>
            <LiveProofStrip />
          </Suspense>
          <p className="text-center text-[11px] text-muted/60 mt-3 font-mono">
            Live from government APIs — updated hourly
          </p>
        </div>
      </section>

      {/* ── Trust bar ── */}
      <section className="relative border-y border-card-border bg-card/60 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <p className="text-center text-[11px] text-muted/60 uppercase tracking-widest font-medium mb-4">
            100% public government data from
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-muted font-medium">
            {trustSources.map((name) => (
              <span key={name} className="flex items-center gap-1.5">
                <Shield size={12} className="text-accent/50" />
                {name}
              </span>
            ))}
            <span className="text-muted/40">+ {dataSources.length - trustSources.length} more</span>
          </div>
        </div>
      </section>

      {/* ── What you can do — tabbed section ── */}
      <section className="relative">
        <div className="max-w-5xl mx-auto px-6 py-16 lg:py-24">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              One platform, built for how you work
            </h2>
            <p className="text-base text-muted mt-3 max-w-xl mx-auto leading-relaxed">
              Whether you{"'"}re browsing trends, closing deals, or briefing council —
              the data is already here.
            </p>
          </div>

          <LandingTabs chartCount={chartCount} municipalityCount={liveMunicipalities.length} />
        </div>
      </section>

      {/* ── Social proof / credibility ── */}
      <section className="relative border-y border-card-border bg-card/60 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-12 lg:py-16">
          <div className="grid sm:grid-cols-3 gap-8 text-center">
            <div className="space-y-2">
              <p className="text-3xl font-bold text-accent">{totalFeeds}+</p>
              <p className="text-sm text-muted">Live government data feeds</p>
            </div>
            <div className="space-y-2">
              <p className="text-3xl font-bold text-accent">{liveMunicipalities.length}</p>
              <p className="text-sm text-muted">Alberta municipalities</p>
            </div>
            <div className="space-y-2">
              <p className="text-3xl font-bold text-accent">{chartCount}+</p>
              <p className="text-sm text-muted">Charts you can browse right now</p>
            </div>
          </div>

          <div className="mt-10 max-w-lg mx-auto text-center">
            <p className="text-sm text-muted leading-relaxed italic">
              &ldquo;Every chart pulls directly from government APIs — not scraped,
              not estimated, not stale. When the Bank of Canada updates a rate,
              you see it here within the hour.&rdquo;
            </p>
            <p className="text-xs text-muted/60 mt-3 flex items-center justify-center gap-1.5">
              <MapPin size={11} />
              Built in Parkland County, Alberta
              <img src="/mapleleaf.svg" alt="" width={12} height={12} className="opacity-40" />
            </p>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="relative py-16 lg:py-24">
        <div className="max-w-lg mx-auto text-center space-y-5 px-6">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Start exploring — it{"'"}s free
          </h2>
          <p className="text-base text-muted leading-relaxed">
            No account, no trial, no credit card.
            Just {chartCount}+ live Alberta data charts.
          </p>
          <Link
            href="/charts"
            className="inline-flex items-center gap-2 px-8 py-4 bg-accent text-white rounded-2xl font-semibold hover:bg-accent-hover transition-colors text-lg shadow-lg shadow-accent/20"
          >
            Browse the chart catalogue
            <ArrowRight size={18} />
          </Link>
          <p className="text-sm text-muted">
            Professional tools?{" "}
            <Link href="/pricing" className="text-accent hover:underline">
              See pricing
            </Link>
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative border-t border-card-border bg-card/60 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted/60">
          <div className="flex items-center gap-2.5">
            <Activity size={14} className="text-accent" />
            <span>Alberta Pulse Check</span>
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
