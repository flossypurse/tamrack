import Link from "next/link";
import { Activity, Check, ArrowRight, BarChart3, Building2, GraduationCap, Home } from "lucide-react";

// 1.3.8 — 4-product pricing model

const chartsFeatures = [
  "Browse 100+ live data charts",
  "Embed any chart on your website",
  "Share via link, X, or LinkedIn",
  "Filter by category and keyword",
  "SEO-friendly permalink pages",
  "No account required",
];

const edoFeatures = [
  "Dedicated dashboard for your municipality",
  "Community profile generator (PDF export)",
  "Peer municipality comparison (2-5 at once)",
  "Automated trend alerts (email digest)",
  "Council-ready report templates",
  "Investment pitch kit builder",
  "Priority support",
];

const realtorFeatures = [
  "Market intelligence dashboard",
  "Development permit tracking & alerts",
  "Neighbourhood deep-dive reports",
  "Listing presentation data packs",
  "Assessment trend analysis",
  "Client-ready PDF exports",
];

const learnFeatures = [
  "8-module Alberta economics course",
  "Interactive quizzes with live data",
  "Embedded Pulse Charts in every lesson",
  "Certificate of completion",
  "Shareable on LinkedIn",
  "No account required to start",
];

export default function PricingPage() {
  return (
    <main className="min-h-screen">
      {/* Header */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-accent/5 via-transparent to-transparent" />
        <div className="relative max-w-5xl mx-auto px-4 py-16 sm:py-24 text-center space-y-4">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Activity size={28} className="text-accent" />
            <span className="text-lg font-bold">Alberta Pulse Check</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold">
            Alberta data, purpose-built for how you work
          </h1>
          <p className="text-muted text-lg max-w-xl mx-auto">
            Free charts for everyone. Purpose-built products for professionals.
          </p>
        </div>
      </section>

      {/* Products */}
      <section className="max-w-6xl mx-auto px-4 pb-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Pulse Charts — Free */}
          <div className="bg-card border border-card-border rounded-xl p-6 space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 size={18} className="text-accent" />
                <h2 className="text-lg font-bold">Pulse Charts</h2>
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-bold">$0</span>
                <span className="text-muted text-sm">/forever</span>
              </div>
              <p className="text-sm text-muted mt-2">
                Browse, share, and embed live Alberta data charts.
              </p>
            </div>
            <ul className="space-y-2.5">
              {chartsFeatures.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <Check size={15} className="text-accent-green mt-0.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/charts"
              className="block text-center px-5 py-2.5 bg-accent text-white rounded-lg font-medium text-sm hover:bg-accent-hover transition-colors"
            >
              Browse charts
            </Link>
          </div>

          {/* Pulse EDO — $299/mo */}
          <div className="bg-card border-2 border-indigo-500 rounded-xl p-6 space-y-5 relative">
            <div className="absolute -top-3 left-6">
              <span className="px-3 py-1 bg-indigo-500 text-white text-xs font-bold rounded-full uppercase tracking-wider">
                For EDOs
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Building2 size={18} className="text-indigo-400" />
                <h2 className="text-lg font-bold">Pulse EDO</h2>
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-bold">$299</span>
                <span className="text-muted text-sm">/mo per municipality</span>
              </div>
              <p className="text-sm text-muted mt-2">
                Community profiles, benchmarks, and council-ready reports.
              </p>
            </div>
            <ul className="space-y-2.5">
              {edoFeatures.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <Check size={15} className="text-indigo-400 mt-0.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="space-y-2">
              <span className="block text-center text-xs text-muted bg-muted/10 rounded-lg py-2">
                Coming soon
              </span>
              <Link
                href="/login?waitlist=edo"
                className="flex items-center justify-center gap-2 px-5 py-2.5 border border-indigo-500 text-indigo-400 rounded-lg font-medium text-sm hover:bg-indigo-500/10 transition-colors"
              >
                Join the waitlist
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          {/* Pulse Realtor — $49/mo */}
          <div className="bg-card border-2 border-teal-500 rounded-xl p-6 space-y-5 relative">
            <div className="absolute -top-3 left-6">
              <span className="px-3 py-1 bg-teal-500 text-white text-xs font-bold rounded-full uppercase tracking-wider">
                For Realtors
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Home size={18} className="text-teal-400" />
                <h2 className="text-lg font-bold">Pulse Realtor</h2>
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-bold">$49</span>
                <span className="text-muted text-sm">/mo per seat</span>
              </div>
              <p className="text-sm text-muted mt-2">
                Market intel, prospect tracking, and listing tools.
              </p>
            </div>
            <ul className="space-y-2.5">
              {realtorFeatures.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <Check size={15} className="text-teal-400 mt-0.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/login?callbackUrl=/realtor/market&plan=realtor"
              className="block text-center px-5 py-2.5 bg-teal-500 text-white rounded-lg font-medium text-sm hover:bg-teal-600 transition-colors"
            >
              Get started — $49/mo
            </Link>
          </div>

          {/* Pulse Learn — Free */}
          <div className="bg-card border border-card-border rounded-xl p-6 space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <GraduationCap size={18} className="text-accent-green" />
                <h2 className="text-lg font-bold">Pulse Learn</h2>
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-bold">$0</span>
                <span className="text-muted text-sm">/forever</span>
              </div>
              <p className="text-sm text-muted mt-2">
                Learn Alberta economics with live data and earn a certificate.
              </p>
            </div>
            <ul className="space-y-2.5">
              {learnFeatures.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <Check size={15} className="text-accent-green mt-0.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="space-y-2">
              <span className="block text-center text-xs text-muted bg-muted/10 rounded-lg py-2">
                Coming soon
              </span>
              <Link
                href="/home/learn"
                className="block text-center px-5 py-2.5 border border-card-border rounded-lg text-foreground hover:bg-card-border/30 transition-colors font-medium text-sm"
              >
                Preview learning hub
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-5xl mx-auto px-4 pb-16">
        <h2 className="text-center text-sm font-medium text-muted uppercase tracking-wider mb-8">
          Frequently asked questions
        </h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {[
            {
              q: "Is Pulse Charts really free?",
              a: "Yes. All charts are free to browse, embed, and share. No account needed, no trial, no catch.",
            },
            {
              q: "When will EDO and Realtor launch?",
              a: "Pulse Realtor is available now. Pulse EDO is in development — join the waitlist and we'll notify you when it's ready.",
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
              q: "Can I add multiple municipalities to an EDO plan?",
              a: "Each municipality is $299/mo. Contact us for volume pricing on regional districts.",
            },
            {
              q: "Where does the data come from?",
              a: "100% public government data from 18+ sources including Bank of Canada, Statistics Canada, Alberta Regional Dashboard, and more.",
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
        <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted/50">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-accent" />
            <span>Alberta Pulse Check</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/charts" className="hover:text-foreground transition-colors">Charts</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/login" className="hover:text-foreground transition-colors">Sign in</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
