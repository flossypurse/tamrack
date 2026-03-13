import Link from "next/link";
import { Activity, Check, ArrowRight } from "lucide-react";

const free = [
  "Macro economy dashboard (8 pages)",
  "Municipality explorer & coverage map",
  "Energy, drilling, agriculture overviews",
  "Labour & migration data",
  "Environment: weather, air quality, water, wildfire",
  "Health & demographics overview",
  "Public safety: crime, fire, traffic, emergencies",
  "Data source directory & learn hub",
];

const pro = [
  "Everything in Free, plus:",
  "Deep-dive dashboards for 30 municipalities",
  "Neighbourhood-level assessments & permits",
  "Real estate intel: rental, commercial, pipeline",
  "Growth corridors, benchmarks, risk analysis",
  "Investment thesis & compare tools",
  "9 role-based briefings (realtor, investor, energy, EDO, …)",
  "AESO electricity, CER pipeline, immigration dashboards",
  "REST API access (1,000 req/day)",
  "Embeddable charts for any indicator",
  "Priority data requests",
];

export default function PricingPage() {
  return (
    <main className="min-h-screen">
      {/* Header */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-accent/5 via-transparent to-transparent" />
        <div className="relative max-w-4xl mx-auto px-4 py-16 sm:py-24 text-center space-y-4">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Activity size={28} className="text-accent" />
            <span className="text-lg font-bold">Alberta Pulse Check</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold">
            Simple, transparent pricing
          </h1>
          <p className="text-muted text-lg max-w-xl mx-auto">
            Start free. Upgrade when you need municipality deep-dives, API access, and pro analytics.
          </p>
        </div>
      </section>

      {/* Plans */}
      <section className="max-w-4xl mx-auto px-4 pb-16">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Free */}
          <div className="bg-card border border-card-border rounded-xl p-8 space-y-6">
            <div>
              <h2 className="text-lg font-bold">Free</h2>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-bold">$0</span>
                <span className="text-muted text-sm">/month</span>
              </div>
              <p className="text-sm text-muted mt-2">
                Province-wide macro data, forever free.
              </p>
            </div>
            <ul className="space-y-3">
              {free.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <Check size={16} className="text-accent-green mt-0.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/dashboard"
              className="block text-center px-6 py-3 border border-card-border rounded-lg text-foreground hover:bg-card-border/30 transition-colors font-medium text-sm"
            >
              Explore the dashboard
            </Link>
          </div>

          {/* Pro */}
          <div className="bg-card border-2 border-accent rounded-xl p-8 space-y-6 relative">
            <div className="absolute -top-3 left-6">
              <span className="px-3 py-1 bg-accent text-white text-xs font-bold rounded-full uppercase tracking-wider">
                Most popular
              </span>
            </div>
            <div>
              <h2 className="text-lg font-bold">Pro</h2>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-bold">$29</span>
                <span className="text-muted text-sm">/month CAD</span>
              </div>
              <p className="text-sm text-muted mt-2">
                14-day free trial. No credit card required.
              </p>
            </div>
            <ul className="space-y-3">
              {pro.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <Check size={16} className="text-accent-green mt-0.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 px-6 py-3 bg-accent text-white rounded-lg font-semibold hover:bg-accent-hover transition-colors"
            >
              Start free trial
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-4xl mx-auto px-4 pb-16">
        <h2 className="text-center text-sm font-medium text-muted uppercase tracking-wider mb-8">
          Frequently asked questions
        </h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {[
            {
              q: "What happens after the 14-day trial?",
              a: "You'll be downgraded to the Free tier automatically. No charge unless you subscribe.",
            },
            {
              q: "Can I cancel anytime?",
              a: "Yes. Cancel from your billing page and you keep access until the end of your billing period.",
            },
            {
              q: "What payment methods do you accept?",
              a: "Visa, Mastercard, and American Express via Stripe. All prices are in Canadian dollars.",
            },
            {
              q: "Is there an annual plan?",
              a: "Not yet. We're keeping it simple with monthly billing for now.",
            },
          ].map((faq) => (
            <div key={faq.q} className="bg-card border border-card-border rounded-xl p-5 space-y-2">
              <h3 className="font-semibold text-sm">{faq.q}</h3>
              <p className="text-sm text-muted">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-card-border">
        <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted/50">
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
