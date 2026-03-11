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
  Check,
} from "lucide-react";

const features = [
  { icon: BarChart3, title: "Macro Dashboard", desc: "BoC rates, GDP, CPI, unemployment — all live, all Alberta" },
  { icon: Flame, title: "Energy Tracker", desc: "BCPI energy index, CAD/USD correlation, oil & gas GDP" },
  { icon: Building2, title: "5 Municipalities", desc: "Parkland County, Stony Plain, Spruce Grove, Strathcona, St. Albert" },
  { icon: MapPin, title: "Neighbourhood Intel", desc: "Permit hotspots, assessment trends, teardown detection" },
  { icon: Radar, title: "Leading Signals", desc: "Cross-indicator analysis separating leading from lagging" },
  { icon: Wheat, title: "Agriculture", desc: "Farm cash receipts, commodity indexes, ag GDP trends" },
  { icon: Users, title: "Labour & Migration", desc: "Employment, participation, interprovincial flows" },
  { icon: Key, title: "REST API", desc: "Permits, assessments, signals, macro data — programmatic access" },
];

const included = [
  "20+ live data dashboards",
  "5 municipality deep-dives",
  "Neighbourhood-level signals",
  "Leading indicator analysis",
  "REST API with 1,000 req/day",
  "Daily data snapshots",
  "Historical trend tracking",
  "New data sources added monthly",
];

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-accent/5 via-transparent to-transparent" />
        <div className="relative max-w-5xl mx-auto px-4 py-20 sm:py-32 text-center space-y-6">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Activity size={32} className="text-accent" />
            <span className="text-xl font-bold">Alberta Pulse Check</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold leading-tight">
            Real-time economic intelligence
            <br />
            <span className="text-accent">for Alberta decision-makers</span>
          </h1>
          <p className="text-muted text-lg max-w-2xl mx-auto">
            Live data from Bank of Canada, Statistics Canada, Edmonton Open Data,
            and 5 municipality APIs — processed, cross-analyzed, and delivered to your dashboard.
          </p>
          <div className="flex items-center justify-center gap-4 pt-4">
            <Link
              href="/login"
              className="flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-lg font-semibold hover:bg-accent/90 transition-colors"
            >
              Start 14-day free trial
              <ArrowRight size={16} />
            </Link>
            <Link
              href="#pricing"
              className="px-6 py-3 border border-card-border rounded-lg text-foreground hover:bg-card transition-colors"
            >
              See pricing
            </Link>
          </div>
          <p className="text-xs text-muted/50">No credit card required</p>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="text-center text-sm font-medium text-muted uppercase tracking-wider mb-8">
          What&apos;s inside
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f) => (
            <div key={f.title} className="bg-card border border-card-border rounded-xl p-5 space-y-2">
              <f.icon size={20} className="text-accent" />
              <h3 className="font-semibold text-sm">{f.title}</h3>
              <p className="text-xs text-muted leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Data Sources */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="text-center text-sm font-medium text-muted uppercase tracking-wider mb-2">
          Live data from
        </h2>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted/70 py-6">
          <span>Bank of Canada</span>
          <span className="text-card-border">|</span>
          <span>Statistics Canada</span>
          <span className="text-card-border">|</span>
          <span>Edmonton Open Data</span>
          <span className="text-card-border">|</span>
          <span>Alberta Open Data</span>
          <span className="text-card-border">|</span>
          <span>CMHC</span>
          <span className="text-card-border">|</span>
          <span>5 Municipal APIs</span>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-5xl mx-auto px-4 py-16">
        <h2 className="text-center text-sm font-medium text-muted uppercase tracking-wider mb-8">
          Simple pricing
        </h2>
        <div className="max-w-md mx-auto bg-card border-2 border-accent/30 rounded-xl p-8 space-y-6">
          <div className="text-center space-y-1">
            <h3 className="text-lg font-bold">Alberta Pulse Pro</h3>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-4xl font-bold">$29</span>
              <span className="text-muted">/month CAD</span>
            </div>
            <p className="text-xs text-muted">14-day free trial — no credit card required</p>
          </div>

          <ul className="space-y-2">
            {included.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm">
                <Check size={14} className="text-accent-green mt-0.5 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <Link
            href="/login"
            className="block text-center px-6 py-3 bg-accent text-white rounded-lg font-semibold hover:bg-accent/90 transition-colors"
          >
            Start free trial
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-card-border">
        <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted/50">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-accent" />
            <span>Alberta Pulse Check</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/login" className="hover:text-foreground transition-colors">Sign in</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
