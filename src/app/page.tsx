import type { Metadata } from "next";
import Link from "next/link";
import { Activity } from "lucide-react";
import { TArrowRight } from "@/components/icons/t3";
import { Wordmark } from "@/components/brand/wordmark";
import { MUNICIPALITY_REGISTRY } from "@/lib/municipality-registry";
import { CHART_REGISTRY } from "@/lib/chart-registry";
import { ThemeToggle } from "@/components/theme-toggle";
import { SectionDividerTerminal } from "@/components/section-divider-terminal";
import { SITE_URL } from "@/lib/constants/site";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: { absolute: "Tamrack — A data agent for Alberta" },
  description:
    "Ask a question, get the chart. Tamrack is an invite-only data agent that reads 185+ Alberta government feeds and renders custom dashboards from a sentence. The chart catalogue is free.",
  alternates: { canonical: SITE_URL },
  openGraph: {
    images: [
      {
        url: "/api/og?title=Tamrack&subtitle=A+data+agent+for+Alberta",
        width: 1200,
        height: 630,
      },
    ],
  },
};

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
  { name: "CWFIS Wildfire", feeds: 2 },
  { name: "511 Alberta", feeds: 1 },
  { name: "Alberta CKAN Health", feeds: 3 },
  { name: "Infrastructure Canada", feeds: 2 },
  { name: "Edmonton Fire & EMS", feeds: 1 },
  { name: "CRA Tax Stats", feeds: 1 },
];

const totalFeeds = dataSources.reduce((sum, s) => sum + s.feeds, 0);

// Sample exchanges with the agent — each is a query users could plausibly
// type, paired with the dashboard Tamrack would render. The output line
// gives source attribution to ground the example in real feeds, not vibes.
const agentExchanges = [
  {
    query: "alberta unemployment, last 5 years",
    output: "AB unemployment rate · 60 months · StatsCan 14-10-0287-03",
  },
  {
    query: "edmonton housing starts in 2024",
    output: "Edmonton dwelling starts · monthly · CMHC via StatsCan",
  },
  {
    query: "compare AB drilling activity to WTI since 2020",
    output: "AER well licences + crude price · 5y · two-axis line",
  },
  {
    query: "which AB municipalities grew fastest 2021–2024",
    output: "Population CAGR · 30 munis · Alberta Regional Dashboard",
  },
];

// ============================================================
// Page
// ============================================================

export default async function LandingPage() {
  const liveMunicipalities = MUNICIPALITY_REGISTRY.filter((m) => m.status === "live");
  const chartCount = CHART_REGISTRY.length;
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    <main className="min-h-screen relative">
      {/* ── Hero ── */}
      <section className="relative">
        <div className="relative max-w-3xl mx-auto px-6 pt-20 sm:pt-28 lg:pt-36 pb-14 space-y-10">
          <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-4">
            <Link
              href={isLoggedIn ? "/account" : "/login"}
              className="font-mono text-[11px] tracking-[0.18em] uppercase text-[var(--mid)] hover:text-[var(--amber)] transition-colors"
              style={{ transitionDuration: "var(--dur-instant)" }}
            >
              {isLoggedIn ? "account →" : "sign in →"}
            </Link>
            <ThemeToggle />
          </div>

          <p className="font-mono text-[11px] tracking-[0.18em] uppercase text-[var(--mid)]">
            tamrack · alberta data substrate · v0
          </p>

          <div className="flex items-center text-[var(--ink)]">
            <Wordmark height={68} />
          </div>

          <div className="space-y-5">
            <h1 className="font-mono font-extrabold text-3xl sm:text-4xl lg:text-5xl leading-[1.0] tracking-tight text-[var(--ink)]">
              <span className="text-[var(--amber)]">&gt;</span> ask. render. read.
            </h1>

            <p className="text-[var(--ink)]/85 text-lg sm:text-xl max-w-2xl leading-relaxed">
              Tamrack is a data agent for Alberta. Type a question, get the
              chart — pulled live from {dataSources.length} government sources.{" "}
              <span className="text-[var(--mid)]">
                The {chartCount}-chart catalogue is free. The agent is
                invite-only while we get it right.
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
              Browse the catalogue
            </Link>
          </div>
        </div>
      </section>

      <div className="py-8 sm:py-12">
        <SectionDividerTerminal label="the agent" />
      </div>

      {/* ── Agent: sentence in, dashboard out ── */}
      <section className="relative bg-[var(--surface)]">
        <div className="max-w-3xl mx-auto px-6 py-12 lg:py-16 space-y-10">
          <div className="space-y-5">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--ink)]">
              A sentence in. A dashboard out.
            </h2>
            <p className="text-[var(--ink)]/85 text-base sm:text-lg leading-relaxed">
              Tamrack reads {totalFeeds} feeds across {dataSources.length}{" "}
              government sources and writes the chart you asked for. No
              filters to wrangle. No dashboard layout to learn. Just the
              question, in plain English.
            </p>
          </div>

          {/* Console-style sample exchanges — fake but plausible queries the
              agent would handle. Renders as a man-page transcript: prompt,
              user line, output line. */}
          <div className="border border-[var(--hairline)] bg-[var(--surface-elevated)]/40 font-mono text-[13px] leading-relaxed">
            <div className="px-4 py-2 border-b border-[var(--hairline)] flex items-center justify-between">
              <span className="text-[10px] tracking-[0.18em] uppercase text-[var(--mid)]">
                tamrack · /account/chat
              </span>
              <span className="text-[10px] tracking-[0.18em] uppercase text-[var(--mid)]/60">
                sample
              </span>
            </div>
            <div className="px-4 py-4 space-y-4">
              {agentExchanges.map((ex, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex gap-2">
                    <span className="text-[var(--amber)] shrink-0">&gt;</span>
                    <span className="text-[var(--ink)]">{ex.query}</span>
                  </div>
                  <div className="flex gap-2 text-[var(--mid)]">
                    <span className="shrink-0">·</span>
                    <span>{ex.output}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-sm text-[var(--mid)] leading-relaxed">
            Every chart the agent renders is grounded — it cites the feed, the
            window, the table ID. If the source disagrees with the chart, the
            source wins.
          </p>
        </div>
      </section>

      <div className="py-8 sm:py-12">
        <SectionDividerTerminal label="the substrate" />
      </div>

      {/* ── Proof strip — the underlying numbers ── */}
      <section className="relative border-y border-[var(--border)] bg-[var(--surface-elevated)]/60 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-12 lg:py-16">
          <div className="grid sm:grid-cols-3 gap-8 text-center">
            <div className="space-y-2">
              <p className="font-mono text-3xl font-bold text-[var(--ink)] tracking-tight">{chartCount}</p>
              <p className="text-sm text-[var(--mid)]">live charts the agent can compose from</p>
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
              Every feed pulls from the source on a schedule. When the data
              moves, the substrate moves within the hour.
            </p>
          </div>
        </div>
      </section>

      <div className="py-8 sm:py-12">
        <SectionDividerTerminal label="the split" />
      </div>

      {/* ── Free vs invited ── */}
      <section className="relative bg-[var(--surface)]">
        <div className="max-w-4xl mx-auto px-6 py-12 lg:py-16 grid md:grid-cols-2 gap-10">
          <div className="space-y-5">
            <p className="font-mono text-[11px] tracking-[0.18em] uppercase text-[var(--mid)]">
              free, forever
            </p>
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--ink)]">
              The chart catalogue.
            </h3>
            <p className="text-[var(--ink)]/85 leading-relaxed">
              {chartCount} live charts on Alberta&apos;s economy, real estate,
              community, and environment. Browse, embed, share. No account,
              no trial, no card.
            </p>
            <Link
              href="/charts"
              className="inline-flex items-center gap-2 text-sm font-medium text-[var(--ink)] hover:text-[var(--amber)] transition-colors"
              style={{ transitionDuration: "var(--dur-instant)" }}
            >
              Browse the catalogue
              <TArrowRight size={14} />
            </Link>
          </div>
          <div className="space-y-5">
            <p className="font-mono text-[11px] tracking-[0.18em] uppercase text-[var(--amber)]">
              invite-only · v0
            </p>
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--ink)]">
              The agent + the API.
            </h3>
            <p className="text-[var(--ink)]/85 leading-relaxed">
              The Tamrack agent that builds custom dashboards from a sentence,
              plus an HTTP API and MCP server you can point your own agents
              at. Small intake — we&apos;re onboarding founders one-by-one.
            </p>
            <Link
              href="/access-request"
              className="inline-flex items-center gap-2 text-sm font-medium text-[var(--ink)] hover:text-[var(--amber)] transition-colors"
              style={{ transitionDuration: "var(--dur-instant)" }}
            >
              Request access
              <TArrowRight size={14} />
            </Link>
          </div>
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
          </div>
          <div className="flex items-center gap-5">
            <Link href="/charts" className="hover:text-[var(--ink)] transition-colors">Charts</Link>
            <Link href="/learn" className="hover:text-[var(--ink)] transition-colors">Learn</Link>
            {!isLoggedIn && (
              <Link href="/access-request" className="hover:text-[var(--ink)] transition-colors">Request access</Link>
            )}
            <Link href="/terms" className="hover:text-[var(--ink)] transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-[var(--ink)] transition-colors">Privacy</Link>
            <Link
              href={isLoggedIn ? "/account" : "/login"}
              className="hover:text-[var(--ink)] transition-colors"
            >
              {isLoggedIn ? "Account" : "Sign in"}
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
