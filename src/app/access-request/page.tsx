"use client";

import { useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { TArrowRight, TPending } from "@/components/icons/t3";

export default function AccessRequestPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [intent, setIntent] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/access-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, intent }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || "Something went wrong. Please try again.");
      } else {
        setSent(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--surface)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Wordmark */}
        <Link
          href="/"
          aria-label="Tamrack — home"
          className="flex items-center justify-center mb-8 text-[var(--ink)]"
        >
          <Wordmark height={22} />
        </Link>

        <div className="bg-[var(--surface-elevated)] border border-[var(--hairline)] p-6">
          {sent ? (
            <div className="space-y-4">
              <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--mid)] pb-2 border-b border-[var(--hairline)]">
                access · requested · queued
              </div>
              <div className="space-y-2 pt-2">
                <h2 className="font-mono text-lg font-semibold text-[var(--ink)]">
                  Request received
                </h2>
                <p className="text-sm text-[var(--ink)]/85 leading-relaxed">
                  We&apos;ll be in touch.
                </p>
              </div>
              <Link
                href="/"
                className="font-mono text-[10px] tracking-[0.14em] uppercase text-[var(--mid)] hover:text-[var(--amber)] transition-colors"
                style={{ transitionDuration: "var(--dur-instant)" }}
              >
                ← back to tamrack
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--mid)]">
                  tamrack · access request · v0
                </p>
                <h1 className="font-mono text-xl font-extrabold tracking-tight text-[var(--ink)]">
                  <span className="text-[var(--amber)]">&gt;</span> Request access
                </h1>
                <p className="font-mono text-xs text-[var(--mid)]">
                  invite-only · we&apos;ll reach out
                </p>
              </div>

              {error && (
                <div className="border border-[var(--amber)]/40 bg-[var(--amber)]/5 p-3 text-sm text-[var(--ink)] font-mono">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label
                    htmlFor="access-request-name"
                    className="block font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--mid)]"
                  >
                    name
                  </label>
                  <input
                    id="access-request-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full px-4 py-2.5 bg-[var(--surface)] border border-[var(--hairline)] text-[var(--ink)] placeholder:text-[var(--mid)]/60 font-mono text-sm focus:outline-none focus:border-[var(--amber)]"
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="access-request-email"
                    className="block font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--mid)]"
                  >
                    email
                  </label>
                  <input
                    id="access-request-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-2.5 bg-[var(--surface)] border border-[var(--hairline)] text-[var(--ink)] placeholder:text-[var(--mid)]/60 font-mono text-sm focus:outline-none focus:border-[var(--amber)]"
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="access-request-intent"
                    className="block font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--mid)]"
                  >
                    intent · optional
                  </label>
                  <textarea
                    id="access-request-intent"
                    rows={3}
                    value={intent}
                    onChange={(e) => setIntent(e.target.value)}
                    placeholder="A sentence or two on what you'd use it for."
                    className="w-full px-4 py-2.5 bg-[var(--surface)] border border-[var(--hairline)] text-[var(--ink)] placeholder:text-[var(--mid)]/60 font-mono text-sm focus:outline-none focus:border-[var(--amber)] resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--ink)] text-[var(--ink-inv)] font-medium hover:bg-[var(--amber)] hover:text-[var(--ink)] disabled:opacity-50 transition-colors text-sm"
                  style={{ transitionDuration: "var(--dur-instant)" }}
                >
                  {loading ? <TPending size={16} /> : <TArrowRight size={16} />}
                  {loading ? "Sending…" : "Request access"}
                </button>
              </form>

              <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-[var(--mid)] leading-relaxed">
                <Link href="/" className="text-[var(--amber)] hover:underline">
                  ← back
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
