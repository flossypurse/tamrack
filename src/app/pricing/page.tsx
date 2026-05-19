import type { Metadata } from "next";
import Link from "next/link";
import { chartsFeatures, learnFeatures } from "@/lib/plans";
import { SITE_URL } from "@/lib/constants/site";
import { Wordmark } from "@/components/brand/wordmark";
import { TCheck } from "@/components/icons/t3";

export const metadata: Metadata = {
  title: "Pricing — Tamrack",
  description: "Free charts and dashboards for Alberta economic data. Tamrack tier coming soon.",
  alternates: {
    canonical: `${SITE_URL}/pricing`,
  },
};

// Pricing model (post-EDO/Realtor sunset, 2026-05-18):
//   Charts (free) + Learn (free) + Tamrack ($9/mo flat + metered overage, placeholder).
// EDO ($299/mo) and Real Estate ($49/mo) were sunset to new signups; existing
// subscribers continue at their current tier. See /sunset for context.

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[var(--surface)]">
      {/* Header */}
      <section className="border-b border-[var(--hairline)]">
        <div className="max-w-5xl mx-auto px-4 py-16 sm:py-24 space-y-6">
          <Link
            href="/"
            className="flex items-center text-[var(--ink)]"
            aria-label="Tamrack — home"
          >
            <Wordmark height={22} />
          </Link>
          <p className="font-mono text-[11px] tracking-[0.18em] uppercase text-[var(--mid)]">
            pricing · v0 · stony plain · q2 2026
          </p>
          <h1 className="font-mono font-extrabold text-3xl sm:text-4xl leading-[1.0] tracking-tight text-[var(--ink)]">
            <span className="text-[var(--amber)]">&gt;</span> free charts. tamrack coming soon.
          </h1>
          <p className="text-base text-[var(--ink)]/85 max-w-xl leading-relaxed">
            Browse Alberta data for free. A paid Tamrack tier is on the way for
            power users.
          </p>
        </div>
      </section>

      {/* Products — instrument-grid */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-px bg-[var(--hairline)] border border-[var(--hairline)]">
          {/* Pulse Charts — Free */}
          <PlanCard
            label="charts · free · public · v0"
            name="Pulse Charts"
            price="$0"
            cadence="forever"
            description="Browse, share, and embed live Alberta data charts."
            features={chartsFeatures}
            cta={{ href: "/charts", label: "Browse charts" }}
            primary={false}
          />

          {/* Pulse Learn — Free */}
          <PlanCard
            label="learn · free · 8 modules · alberta"
            name="Pulse Learn"
            price="$0"
            cadence="forever"
            description="Learn Alberta economics with live data. Earn a certificate."
            features={learnFeatures}
            cta={{ href: "/learn", label: "Start learning — free" }}
            primary={false}
          />

          {/* Tamrack — placeholder, the amber tier */}
          <PlanCard
            label="tamrack · paid · api + mcp · alpha"
            name="Tamrack"
            price="$9"
            cadence="/mo flat + metered overage"
            description="Paid tier for API access, programmatic dashboards, and higher quotas. Pricing locks in before launch."
            features={[
              "50,000 included units / month",
              "Metered overage billed via Stripe",
              "API + MCP tool access",
            ]}
            cta={{ href: "#", label: "Not yet available", disabled: true }}
            primary={true}
            badge="coming soon"
          />
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-5xl mx-auto px-4 pb-16 border-t border-[var(--hairline)] pt-12">
        <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--mid)] mb-8">
          faq · most-asked · town hall fielding
        </p>
        <div className="grid sm:grid-cols-2 gap-px bg-[var(--hairline)] border border-[var(--hairline)]">
          {[
            {
              q: "Is Pulse Charts really free?",
              a: "Yes. All charts are free to browse, embed, and share. No account needed, no trial, no catch.",
            },
            {
              q: "What happened to Pulse EDO and Pulse Real Estate?",
              a: "Both are closed to new signups as of May 2026. Existing subscribers continue at their current price with the same dashboards, exports, and data. See /sunset for details.",
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
              q: "When does Tamrack launch?",
              a: "No public date yet. The shape is $9/mo flat with 50k included units and metered overage. Final pricing and features lock in before launch.",
            },
            {
              q: "Where does the data come from?",
              a: "100% public government data from 18 providers including Bank of Canada, Statistics Canada, Alberta Regional Dashboard, and more — 185+ data feeds updated hourly.",
            },
          ].map((faq) => (
            <div
              key={faq.q}
              className="bg-[var(--surface-elevated)] p-5 space-y-2"
            >
              <h3 className="font-mono text-xs tracking-[0.06em] uppercase text-[var(--ink)] font-semibold">
                {faq.q}
              </h3>
              <p className="text-sm text-[var(--ink)]/80 leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--hairline)] bg-[var(--surface)]">
        <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-[var(--mid)]">
            <Wordmark height={14} />
            <span className="font-mono text-[10px] tracking-[0.14em] uppercase">
              &copy; {new Date().getFullYear()}
            </span>
          </div>
          <div className="flex items-center gap-5 font-mono text-[10px] tracking-[0.14em] uppercase text-[var(--mid)]">
            <Link href="/charts" className="hover:text-[var(--amber)] transition-colors">Charts</Link>
            <Link href="/learn" className="hover:text-[var(--amber)] transition-colors">Learn</Link>
            <Link href="/pricing" className="hover:text-[var(--amber)] transition-colors">Pricing</Link>
            <Link href="/terms" className="hover:text-[var(--amber)] transition-colors">Terms</Link>
            <Link href="/privacy" className="hover:text-[var(--amber)] transition-colors">Privacy</Link>
            <Link href="/login" className="hover:text-[var(--amber)] transition-colors">Sign in</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

/**
 * A pricing tile in the instrument-grid. Border collapses with siblings
 * via the parent's `gap-px` + `bg-[var(--hairline)]` trick.
 */
function PlanCard({
  label,
  name,
  price,
  cadence,
  description,
  features,
  cta,
  primary,
  badge,
}: {
  label: string;
  name: string;
  price: string;
  cadence: string;
  description: string;
  features: readonly string[];
  cta: { href: string; label: string; disabled?: boolean };
  primary: boolean;
  badge?: string;
}) {
  return (
    <div className="bg-[var(--surface-elevated)] p-6 space-y-5">
      <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--mid)] pb-2.5 border-b border-[var(--hairline)]">
        <span className="truncate">{label}</span>
        {badge && (
          <span className="shrink-0 ml-2 text-[var(--amber)]">{badge}</span>
        )}
      </div>

      <div>
        <h2 className="font-mono text-lg font-semibold text-[var(--ink)]">
          {name}
        </h2>
        <div className="mt-3 flex items-baseline gap-2">
          <span
            className={`font-mono font-extrabold text-4xl tracking-tight ${
              primary ? "text-[var(--amber)]" : "text-[var(--ink)]"
            }`}
          >
            {price}
          </span>
          <span className="font-mono text-xs text-[var(--mid)]">{cadence}</span>
        </div>
        <p className="text-sm text-[var(--ink)]/85 mt-3 leading-relaxed">
          {description}
        </p>
      </div>

      <ul className="space-y-2.5 border-t border-[var(--hairline)] pt-4">
        {features.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-sm text-[var(--ink)]/85">
            <TCheck
              size={14}
              className={`shrink-0 mt-0.5 ${primary ? "text-[var(--amber)]" : "text-[var(--ink)]"}`}
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      {cta.disabled ? (
        <div className="block text-center px-5 py-2.5 border border-[var(--hairline)] text-[var(--mid)] font-mono text-xs tracking-[0.14em] uppercase cursor-not-allowed">
          {cta.label}
        </div>
      ) : (
        <Link
          href={cta.href}
          className="block text-center px-5 py-2.5 bg-[var(--ink)] text-[var(--ink-inv)] hover:bg-[var(--amber)] hover:text-[var(--ink)] transition-colors text-sm font-medium"
          style={{ transitionDuration: "var(--dur-instant)" }}
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}
