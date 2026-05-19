"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { trackEvent } from "@/components/analytics";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { TMail, TPending } from "@/components/icons/t3";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan");
  const rawCallbackUrl = searchParams.get("callbackUrl") || "/home/dashboard";
  const callbackUrl = plan && !rawCallbackUrl.includes("plan=")
    ? `${rawCallbackUrl}${rawCallbackUrl.includes("?") ? "&" : "?"}plan=${plan}`
    : rawCallbackUrl;
  const authError = searchParams.get("error");

  // Pulse EDO + Pulse Real Estate sunset to new signups 2026-05-18; login copy
  // no longer advertises them. Existing subscribers sign in normally.
  const heading = "Sign in to Tamrack";
  const subtitle = "Alberta data substrate · returning subscribers";

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      trackEvent("sign_up_intent", "conversion", "login_page");
      const result = await signIn("nodemailer", {
        email,
        callbackUrl,
        redirect: false,
      });
      if (result?.error) {
        setError("Failed to send magic link. Please try again.");
      } else {
        setSent(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--mid)] pb-2 border-b border-[var(--hairline)]">
          magic link · sent · check inbox
        </div>
        <div className="flex items-start gap-3 pt-2">
          <TMail size={20} className="text-[var(--amber)] mt-1 shrink-0" />
          <div className="space-y-2">
            <h2 className="font-mono text-lg font-semibold text-[var(--ink)]">Check your email</h2>
            <p className="text-sm text-[var(--ink)]/85 leading-relaxed">
              We sent a sign-in link to <code className="font-mono text-[var(--amber)]">{email}</code>.
              Click the link to access your dashboard.
            </p>
          </div>
        </div>
        <button
          onClick={() => setSent(false)}
          className="font-mono text-[10px] tracking-[0.14em] uppercase text-[var(--mid)] hover:text-[var(--amber)] transition-colors"
          style={{ transitionDuration: "var(--dur-instant)" }}
        >
          ← use a different email
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--mid)]">
          tamrack · sign in · v0
        </p>
        <h1 className="font-mono text-xl font-extrabold tracking-tight text-[var(--ink)]">
          <span className="text-[var(--amber)]">&gt;</span> {heading}
        </h1>
        <p className="font-mono text-xs text-[var(--mid)]">{subtitle}</p>
      </div>

      {(authError || error) && (
        <div className="border border-[var(--amber)]/40 bg-[var(--amber)]/5 p-3 text-sm text-[var(--ink)] font-mono">
          {error || "There was an error signing in. Please try again."}
        </div>
      )}

      {/* Magic Link */}
      <form onSubmit={handleEmail} className="space-y-3">
        <label className="block font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--mid)]">
          email address
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full px-4 py-2.5 bg-[var(--surface)] border border-[var(--hairline)] text-[var(--ink)] placeholder:text-[var(--mid)]/60 font-mono text-sm focus:outline-none focus:border-[var(--amber)]"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--ink)] text-[var(--ink-inv)] font-medium hover:bg-[var(--amber)] hover:text-[var(--ink)] disabled:opacity-50 transition-colors text-sm"
          style={{ transitionDuration: "var(--dur-instant)" }}
        >
          {loading ? <TPending size={16} /> : <TMail size={16} />}
          {loading ? "Sending…" : "Send magic link"}
        </button>
      </form>

      {/* Divider */}
      {process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true" && (
        <>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--hairline)]" />
            </div>
            <div className="relative flex justify-center font-mono text-[10px] tracking-[0.18em] uppercase">
              <span className="bg-[var(--surface-elevated)] px-2 text-[var(--mid)]">or</span>
            </div>
          </div>

          {/* Google */}
          <button
            onClick={() => signIn("google", { callbackUrl: callbackUrl })}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-[var(--hairline)] text-[var(--ink)] hover:border-[var(--ink)] transition-colors text-sm"
            style={{ transitionDuration: "var(--dur-instant)" }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>
        </>
      )}

      <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-[var(--mid)] leading-relaxed">
        by signing in you agree to our{" "}
        <Link href="/terms" className="text-[var(--amber)] hover:underline">terms</Link>
        {" · "}
        <Link href="/privacy" className="text-[var(--amber)] hover:underline">privacy</Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[var(--surface)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Wordmark */}
        <div className="flex items-center justify-center mb-8 text-[var(--ink)]">
          <Wordmark height={22} />
        </div>

        <div className="bg-[var(--surface-elevated)] border border-[var(--hairline)] p-6">
          <Suspense
            fallback={
              <div className="h-64 flex items-center justify-center font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--mid)]">
                loading…
              </div>
            }
          >
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
