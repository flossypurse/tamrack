"use client";

import { useState } from "react";
import { Activity, Mail, Loader2, CheckCircle2, Building2, GraduationCap } from "lucide-react";
import Link from "next/link";
import { use } from "react";

const productInfo: Record<string, { name: string; description: string; icon: typeof Building2 }> = {
  edo: {
    name: "Pulse EDO",
    description: "Community profiles, peer comparison, and council-ready reports for economic development officers.",
    icon: Building2,
  },
  learn: {
    name: "Pulse Learn",
    description: "Eight interactive modules covering Alberta economics with quizzes, live charts, and a certificate.",
    icon: GraduationCap,
  },
};

export default function WaitlistPage({ params }: { params: Promise<{ product: string }> }) {
  const { product } = use(params);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [alreadyOnList, setAlreadyOnList] = useState(false);
  const [error, setError] = useState("");

  const info = productInfo[product];

  if (!info) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <h1 className="text-xl font-bold">Unknown product</h1>
          <Link href="/" className="text-accent hover:underline">Back to homepage</Link>
        </div>
      </div>
    );
  }

  const Icon = info.icon;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, product }),
      });
      const data = await res.json();
      if (data.success) {
        setDone(true);
        setAlreadyOnList(data.alreadyOnList);
      } else {
        setError(data.error || "Something went wrong.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Activity size={28} className="text-accent" />
          <span className="text-lg font-semibold">Alberta Pulse Check</span>
        </div>

        <div className="bg-card border border-card-border rounded-xl p-6">
          {done ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-accent-green/10 flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} className="text-accent-green" />
              </div>
              <h2 className="text-xl font-semibold">
                {alreadyOnList ? "You're already on the list" : "You're on the list"}
              </h2>
              <p className="text-muted text-sm">
                We'll email you at <span className="text-foreground font-medium">{email}</span> when {info.name} launches.
              </p>
              <Link href="/" className="inline-block text-sm text-accent hover:underline">
                Back to homepage
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <Icon size={28} className="text-indigo-400 mx-auto" />
                <h1 className="text-2xl font-bold">Join the {info.name} waitlist</h1>
                <p className="text-muted text-sm">{info.description}</p>
              </div>

              {error && (
                <div className="bg-accent-red/10 border border-accent-red/20 rounded-lg p-3 text-sm text-accent-red">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                <label className="block text-sm font-medium text-muted">Email address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-2.5 bg-card border border-card-border rounded-lg text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/50"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-500 text-white rounded-lg font-medium hover:bg-indigo-600 disabled:opacity-50 transition-colors"
                >
                  {loading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Mail size={16} />
                  )}
                  {loading ? "Joining..." : "Join waitlist"}
                </button>
              </form>

              <Link
                href="/"
                className="block text-center text-sm text-muted hover:text-foreground transition-colors"
              >
                Back to homepage
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
