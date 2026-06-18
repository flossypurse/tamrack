import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark, Symbol } from "@/components/brand/wordmark";
import { TArrowRight } from "@/components/icons/t3";
import { ThemeToggle } from "@/components/theme-toggle";
import { SITE_URL } from "@/lib/constants/site";
import { auth } from "@/lib/auth";

const LINKEDIN_URL = "https://www.linkedin.com/in/cullywakelin/";

export const metadata: Metadata = {
  title: { absolute: "Tamrack — Alberta's ai-native data substrate" },
  description:
    "Alberta's ai-native data substrate. Browse the free chart catalogue, or sign in to ask the agent. Invite-only.",
  alternates: { canonical: SITE_URL },
  openGraph: {
    images: [
      {
        url: "/api/og?title=Tamrack&subtitle=Alberta%27s+ai-native+data+substrate",
        width: 1200,
        height: 630,
      },
    ],
  },
};

export default async function LandingPage() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return (
    <main className="relative flex min-h-screen flex-col">
      {/* Quiet top-right chrome */}
      <div className="absolute right-4 top-4 flex items-center gap-4 sm:right-6 sm:top-6">
        <Link
          href={isLoggedIn ? "/account" : "/login"}
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--mid)] transition-colors hover:text-[var(--amber)]"
          style={{ transitionDuration: "var(--dur-instant)" }}
        >
          {isLoggedIn ? "account →" : "sign in →"}
        </Link>
        <ThemeToggle />
      </div>

      {/* ── Centered hero ── */}
      <section className="flex flex-1 items-center justify-center px-6">
        <div className="flex w-full max-w-xl flex-col items-center gap-9 text-center">
          <div className="flex flex-col items-center gap-5 text-[var(--ink)]">
            <Symbol size={44} />
            <Wordmark height={56} />
          </div>

          <p className="text-lg leading-relaxed text-[var(--ink)]/85 sm:text-xl">
            Alberta&apos;s ai-native data substrate
          </p>

          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <Link
              href="/charts"
              className="flex items-center gap-2 bg-[var(--ink)] px-6 py-3 text-sm font-medium text-[var(--ink-inv)] transition-colors hover:bg-[var(--amber)] hover:text-[var(--ink)]"
              style={{ transitionDuration: "var(--dur-instant)" }}
            >
              Browse charts
              <TArrowRight size={16} />
            </Link>
            <Link
              href="/login"
              className="px-6 py-3 text-sm text-[var(--ink)] border border-[var(--ink)] transition-colors hover:bg-[var(--ink)] hover:text-[var(--ink-inv)]"
              style={{ transitionDuration: "var(--dur-instant)" }}
            >
              Sign in
            </Link>
          </div>

          <a
            href={LINKEDIN_URL}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--mid)] transition-colors hover:text-[var(--amber)]"
            style={{ transitionDuration: "var(--dur-instant)" }}
          >
            Want access? DM me on LinkedIn →
          </a>
        </div>
      </section>

      {/* ── Minimal footer ── */}
      <footer className="border-t border-[var(--border)]">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-6 py-6 text-sm text-[var(--mid)]/80 sm:flex-row">
          <span>Tamrack · Built in Parkland County, Alberta</span>
          <div className="flex items-center gap-5">
            <Link href="/charts" className="transition-colors hover:text-[var(--ink)]">Charts</Link>
            <Link href="/terms" className="transition-colors hover:text-[var(--ink)]">Terms</Link>
            <Link href="/privacy" className="transition-colors hover:text-[var(--ink)]">Privacy</Link>
            <Link
              href={isLoggedIn ? "/account" : "/login"}
              className="transition-colors hover:text-[var(--ink)]"
            >
              {isLoggedIn ? "Account" : "Sign in"}
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
