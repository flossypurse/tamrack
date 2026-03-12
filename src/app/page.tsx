import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  BarChart3,
  Building2,
  MapPin,
  Radar,
  Wheat,
  Users,
  Flame,
  Key,
  ArrowRight,
  Database,
  Shield,
  Globe,
  Layers,
} from "lucide-react";
import { AlbertaOutline, MapleLeaf, MountainRidge, WildRose } from "@/components/alberta-decorations";

const features = [
  { icon: BarChart3, title: "Macro Dashboard", desc: "BoC rates, GDP, CPI, unemployment, retail sales — all live, all Alberta" },
  { icon: Building2, title: "26 Municipalities", desc: "14 live across 7 regions — Edmonton metro, Calgary metro, central, south, and north" },
  { icon: Flame, title: "Energy & Drilling", desc: "BCPI energy index, CAD/USD, oil & gas GDP, well activity, pipeline data" },
  { icon: Globe, title: "20+ Topic Pages", desc: "Weather, wildfire, air quality, elections, water, earthquakes, traffic, rental, and more" },
  { icon: MapPin, title: "Neighbourhood Intel", desc: "Permit hotspots, assessment trends, zoning analysis, teardown detection" },
  { icon: Radar, title: "Leading Signals", desc: "Cross-indicator analysis separating leading from lagging across the province" },
  { icon: Wheat, title: "Agriculture", desc: "Farm cash receipts, commodity indexes, ag GDP trends" },
  { icon: Users, title: "Labour & Migration", desc: "Employment, participation, interprovincial flows" },
  { icon: Layers, title: "Compare & Embed", desc: "Side-by-side municipality comparison, embeddable charts for any indicator" },
  { icon: Key, title: "REST API", desc: "Permits, assessments, signals, macro data — programmatic access" },
];

const dataSources = [
  "Bank of Canada",
  "Statistics Canada",
  "Edmonton Open Data",
  "Calgary Open Data",
  "Alberta Open Data",
  "Regional Dashboard AB",
  "CMHC",
  "ArcGIS (12 municipalities)",
];

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

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-accent/5 via-transparent to-transparent" />

        {/* Alberta province outline — faint watermark */}
        <AlbertaOutline className="absolute -right-10 top-4 w-[280px] h-[420px] text-accent opacity-[0.04] pointer-events-none select-none" />

        {/* Mountain ridge at bottom of hero */}
        <MountainRidge className="absolute bottom-0 left-0 w-full h-[60px] text-accent opacity-[0.04] pointer-events-none select-none" />

        <div className="relative max-w-5xl mx-auto px-4 py-20 sm:py-28 text-center space-y-6">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Activity size={32} className="text-accent" />
            <span className="text-xl font-bold">Alberta Pulse Check</span>
            <MapleLeaf size={16} className="text-accent-red opacity-30" />
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold leading-tight">
            Economic intelligence
            <br />
            <span className="text-accent">built in Alberta, for Alberta</span>
          </h1>
          <p className="text-muted text-lg max-w-2xl mx-auto">
            Live data from 8+ government sources across 26 municipalities — processed,
            cross-analyzed, and delivered to your dashboard. No guesswork, no stale reports.
          </p>

          {/* Data sources — prominent, above CTA */}
          <div className="max-w-3xl mx-auto pt-2">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Database size={14} className="text-accent-gold" />
              <span className="text-xs font-medium text-muted uppercase tracking-wider">
                Live data from {dataSources.length} government sources
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2">
              {dataSources.map((source) => (
                <span
                  key={source}
                  className="px-3 py-1 bg-card border border-card-border rounded-full text-xs font-medium text-foreground/80"
                >
                  {source}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 pt-6">
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

      {/* Trust bar */}
      <section className="border-y border-card-border bg-card/50">
        <div className="max-w-5xl mx-auto px-4 py-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted">
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-accent-green" />
            <span>100% government data sources</span>
          </div>
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-accent" />
            <span>Updated daily</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin size={14} className="text-accent-gold" />
            <span>Built in Parkland County, AB</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="text-center text-sm font-medium text-muted uppercase tracking-wider mb-8">
          What&apos;s inside
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {features.map((f) => (
            <div key={f.title} className="bg-card border border-card-border rounded-xl p-5 space-y-2">
              <f.icon size={20} className="text-accent" />
              <h3 className="font-semibold text-sm">{f.title}</h3>
              <p className="text-xs text-muted leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-4 py-16">
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
      <footer className="border-t border-card-border">
        <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted/50">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-accent" />
            <span>Alberta Pulse Check</span>
            <span className="text-card-border">|</span>
            <WildRose size={12} className="text-accent opacity-40" />
            <span>Built in Parkland County, Alberta</span>
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
