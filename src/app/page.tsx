import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  Activity,
  Shield,
} from "lucide-react";
import { TArrowRight } from "@/components/icons/t3";
import { Wordmark } from "@/components/brand/wordmark";
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
import { SectionDividerTerminal } from "@/components/section-divider-terminal";
import { SITE_URL } from "@/lib/constants/site";

export const metadata: Metadata = {
  title: "Tamrack — Live Economic Intelligence for Alberta",
  description:
    "Live economic data for the people who build, sell, and govern Alberta. Free charts, municipal intelligence, real estate market reports, and an economics learning hub — powered by 185+ government data feeds.",
  alternates: { canonical: SITE_URL },
  openGraph: {
    images: [
      {
        url: "/api/og?title=Tamrack&subtitle=Live+economic+intelligence+for+Alberta",
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
    // T3 sparkline palette — monochrome luminance ramp, single amber for the one indicator
    // most relevant to the dashboard story (mortgage cost as the household-pressure signal).
    { label: "BoC Rate", value: d.policyRate, data: d.rateHistory, color: "#0E0E0E" },
    { label: "CAD/USD", value: d.cadUsd, data: d.cadHistory, color: "#3C3C39" },
    { label: "AB Unemployment", value: d.unemployment, data: d.unemploymentHistory, color: "#6E6E68" },
    { label: "5Y Mortgage", value: d.mortgage5y, data: d.mortgageHistory, color: "#E0A03A" },
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
      {/* ── Hero (T3) ── */}
      <section className="relative">
        <div className="relative max-w-3xl mx-auto px-6 pt-20 sm:pt-28 lg:pt-36 pb-14 space-y-10">
          <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
            <ThemeToggle />
          </div>

          {/* Section label (mono caps, letterspaced) */}
          <p className="font-mono text-[11px] tracking-[0.18em] uppercase text-[var(--mid)]">
            tamrack · alberta data substrate · v0
          </p>

          {/* Wordmark — custom-cut, hero scale */}
          <div className="flex items-center text-[var(--ink)]">
            <Wordmark height={68} />
          </div>

          <div className="space-y-5">
            {/* Tagline — mono display, the brand line */}
            <h1 className="font-mono font-extrabold text-3xl sm:text-4xl lg:text-5xl leading-[1.0] tracking-tight text-[var(--ink)]">
              <span className="text-[var(--amber)]">&gt;</span> the stories the data tells.
            </h1>

            {/* Sub — Inter, man-page register */}
            <p className="text-[var(--ink)]/85 text-lg sm:text-xl max-w-2xl leading-relaxed">
              Alberta&apos;s data substrate — {chartCount} live charts from{" "}
              {dataSources.length} government sources, free to browse.{" "}
              <span className="text-[var(--mid)]">
                The insights layer on top is invite-only while we get it right.
              </span>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start gap-3">
            <Link
              href="/access-request"
              className="flex items-center gap-2 px-6 py-3 bg-[var(--ink)] text-[var(--ink-inv)] font-medium hover:bg-[var(--amber)] hover:text-[var(--ink)] transition-colors text-sm"
              style={{ transitionDuration: "var(--dur-instant)" }}
            >
              Request access
              <TArrowRight size={16} />
            </Link>
            <Link
              href="/charts"
              className="px-6 py-3 border border-[var(--ink)] text-[var(--ink)] hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-colors text-sm"
              style={{ transitionDuration: "var(--dur-instant)" }}
            >
              Browse the charts
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

      {/* Between-section beat 1 (A→B): announces the upcoming gov-source strip. Label rhymes with beat 2 ("the proof") to read as a two-beat system. */}
      <div className="py-8 sm:py-12">
        <SectionDividerTerminal label="the sources" />
      </div>

      {/* ── Trust bar ── */}
      <section className="relative border-y border-[var(--border)] bg-[var(--surface-elevated)]/60 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <p className="text-center text-[11px] text-[var(--mid)] uppercase tracking-widest font-medium mb-4">
            100% public government data from
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-[var(--mid)] font-medium">
            {trustSources.map((name) => (
              <span key={name} className="flex items-center gap-1.5">
                <Shield size={12} className="text-[var(--mid)]/60" />
                {name}
              </span>
            ))}
            <span className="text-[var(--mid)]/50">+ {dataSources.length - trustSources.length} more</span>
          </div>
        </div>
      </section>

      {/* ── What's behind the wall ── */}
      <section className="relative bg-[var(--surface)]">
        <div className="max-w-3xl mx-auto px-6 py-16 lg:py-24 space-y-8">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--ink)]">
            What&apos;s behind the wall
          </h2>
          <div className="space-y-5 text-[var(--ink)]/85 text-base sm:text-lg leading-relaxed">
            <p>
              Behind the wall, the data gets read. Not by a model that generates
              a paragraph and calls it a take — by someone who knows the place,
              with help from agents that point at things worth noticing.
            </p>
            <p>
              The agents do the part they&apos;re good at — scanning every chart
              on every refresh, surfacing the inflection that wasn&apos;t there
              last week, flagging the line that just crossed a 5-year baseline.
              The human does the part they&apos;re good at — knowing whether the
              inflection matters, what to write next to it, and who it&apos;s for.
              The insights layer is that handoff, kept tight.
            </p>
          </div>
        </div>
      </section>

      {/* Between-section beat 2 (C→D): announces the upcoming three-number proof strip. */}
      <div className="py-8 sm:py-12">
        <SectionDividerTerminal label="the proof" />
      </div>

      {/* ── Proof strip ── */}
      <section className="relative border-y border-[var(--border)] bg-[var(--surface-elevated)]/60 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-12 lg:py-16">
          <div className="grid sm:grid-cols-3 gap-8 text-center">
            <div className="space-y-2">
              <p className="font-mono text-3xl font-bold text-[var(--ink)] tracking-tight">{chartCount}</p>
              <p className="text-sm text-[var(--mid)]">live charts, updated against the source</p>
            </div>
            <div className="space-y-2">
              <p className="font-mono text-3xl font-bold text-[var(--ink)] tracking-tight">{totalFeeds}</p>
              <p className="text-sm text-[var(--mid)]">data feeds across {dataSources.length} government sources</p>
            </div>
            <div className="space-y-2">
              <p className="font-mono text-3xl font-bold text-[var(--ink)] tracking-tight">{liveMunicipalities.length}</p>
              <p className="text-sm text-[var(--mid)]">Alberta municipalities indexed</p>
            </div>
          </div>

          <div className="mt-10 max-w-xl mx-auto text-center">
            <p className="text-sm text-[var(--mid)] leading-relaxed">
              Every chart pulls from the source on a schedule. When the Bank of
              Canada moves the policy rate, the chart moves within the hour.
            </p>
          </div>
        </div>
      </section>

      {/* ── Free-and-public anchor ── */}
      <section className="relative py-16 lg:py-20 bg-[var(--surface)]">
        <div className="max-w-2xl mx-auto px-6 space-y-6">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--ink)]">
            The chart catalogue is free, forever.
          </h2>
          <p className="text-[var(--ink)]/85 text-base sm:text-lg leading-relaxed">
            {chartCount} charts on Alberta&apos;s economy, real estate, community
            and environment — no account, no trial, no card. The insights layer
            on top is invite-only and that&apos;s where the work happens, but the
            substrate is public because it should be.
          </p>
          <Link
            href="/charts"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--ink)] text-[var(--ink-inv)] font-medium hover:bg-[var(--amber)] hover:text-[var(--ink)] transition-colors text-sm"
            style={{ transitionDuration: "var(--dur-instant)" }}
          >
            Browse the catalogue
            <TArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative border-t border-[var(--border)] bg-[var(--surface-elevated)]/60 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[var(--mid)]/80">
          <div className="flex items-center gap-2.5">
            <Activity size={14} className="text-[var(--amber)]" />
            <span>Tamrack</span>
            <span className="text-[var(--border)]">|</span>
            <span>Built in Parkland County, Alberta</span>
            <img src="/mapleleaf.svg" alt="" width={12} height={12} className="opacity-30" />
          </div>
          <div className="flex items-center gap-5">
            <Link href="/charts" className="hover:text-[var(--ink)] transition-colors">Charts</Link>
            <Link href="/learn" className="hover:text-[var(--ink)] transition-colors">Learn</Link>
            <Link href="/access-request" className="hover:text-[var(--ink)] transition-colors">Request access</Link>
            <Link href="/terms" className="hover:text-[var(--ink)] transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-[var(--ink)] transition-colors">Privacy</Link>
            <Link href="/login" className="hover:text-[var(--ink)] transition-colors">Sign in</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
