import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { TArrowRight } from "@/components/icons/t3";

// Public sunset notice — T3 Terminal chrome.

export const metadata: Metadata = {
  title: "Sunset notice",
  description:
    "The EDO and Real Estate products are closed to new signups. Existing subscribers continue at their current price.",
  alternates: {
    canonical: "https://tamrack.ca/sunset",
  },
};

export default function SunsetPage() {
  return (
    <main className="min-h-screen bg-[var(--surface)]">
      <section className="max-w-2xl mx-auto px-4 py-16 sm:py-24 space-y-10">
        <Link href="/" className="flex items-center text-[var(--ink)]" aria-label="Tamrack — home">
          <Wordmark height={20} />
        </Link>

        <div className="space-y-4">
          <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--mid)]">
            sunset notice · may 2026 · stony plain
          </p>
          <h1 className="font-mono font-extrabold text-2xl sm:text-3xl leading-tight tracking-tight text-[var(--ink)]">
            <span className="text-[var(--amber)]">&gt;</span> EDO and Real Estate are closed to new signups.
          </h1>
        </div>

        <div className="space-y-4 text-base text-[var(--ink)]/90 leading-relaxed">
          <p>
            Both products are sunset as paid offerings. Existing subscribers
            continue at their current price with the same dashboards, exports,
            and data. Nothing changes inside the product.
          </p>
          <p>
            New visitors landing on{" "}
            <code className="font-mono text-sm text-[var(--amber)]">/edo</code> or{" "}
            <code className="font-mono text-sm text-[var(--amber)]">/realtor</code> URLs are
            redirected here. The marketing pages are gone.
          </p>
          <p>
            The free surface — the chart catalogue and Tamrack Learn — keeps
            running. A paid Tamrack tier is in the works for API access and
            higher quotas.
          </p>
        </div>

        <div className="space-y-3 border-t border-[var(--hairline)] pt-6">
          <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--mid)]">
            what this means
          </p>
          <ul className="space-y-2 text-[var(--ink)]/90">
            <li className="flex gap-3">
              <span className="text-[var(--amber)] font-mono shrink-0">·</span>
              <span>Existing EDO and Real Estate subscriptions keep working.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[var(--amber)] font-mono shrink-0">·</span>
              <span>Same price. Same data. Same exports. Same dashboards.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[var(--amber)] font-mono shrink-0">·</span>
              <span>Cancel from the billing page if you want to. We won&apos;t auto-cancel anyone.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[var(--amber)] font-mono shrink-0">·</span>
              <span>New signups are closed. There&apos;s no waitlist.</span>
            </li>
          </ul>
        </div>

        <div className="flex flex-wrap gap-3 pt-4">
          <Link
            href="/charts"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--ink)] text-[var(--ink-inv)] hover:bg-[var(--amber)] hover:text-[var(--ink)] transition-colors text-sm font-medium"
            style={{ transitionDuration: "var(--dur-instant)" }}
          >
            Browse free charts
            <TArrowRight size={14} />
          </Link>
          <Link
            href="/learn"
            className="inline-flex items-center px-5 py-2.5 border border-[var(--ink)] text-[var(--ink)] hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-colors text-sm"
            style={{ transitionDuration: "var(--dur-instant)" }}
          >
            Tamrack Learn
          </Link>
          <Link
            href="/billing"
            className="inline-flex items-center px-5 py-2.5 border border-[var(--ink)] text-[var(--ink)] hover:bg-[var(--ink)] hover:text-[var(--ink-inv)] transition-colors text-sm"
            style={{ transitionDuration: "var(--dur-instant)" }}
          >
            Manage subscription
          </Link>
        </div>

        <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-[var(--mid)] pt-8 border-t border-[var(--hairline)]">
          questions about your subscription? · reach out via the billing page · we&apos;ll sort it.
        </p>
      </section>
    </main>
  );
}
