"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Activity, Check, ArrowRight, Loader2, Home, Building2 } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { trackEvent } from "@/components/analytics";

const planDetails: Record<string, {
  name: string;
  price: string;
  icon: typeof Home;
  accent: string;
  features: string[];
}> = {
  realtor: {
    name: "Pulse Real Estate",
    price: "$49/mo per seat",
    icon: Home,
    accent: "teal",
    features: [
      "Market intelligence dashboard",
      "Development permit tracking & alerts",
      "Neighbourhood deep-dive reports",
      "Listing presentation data packs",
      "Assessment trend analysis",
      "Client-ready PDF exports",
    ],
  },
  edo: {
    name: "Pulse EDO",
    price: "$299/mo per municipality",
    icon: Building2,
    accent: "indigo",
    features: [
      "Dedicated dashboard for your municipality",
      "Community profile generator (PDF export)",
      "Peer municipality comparison (2-5 at once)",
      "Automated trend alerts dashboard",
      "Council-ready report templates",
      "Investment pitch kit builder",
      "Priority support",
    ],
  },
};

function SubscribeForm() {
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") || "realtor";
  const details = planDetails[plan];
  const { status: sessionStatus } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isAuthenticated = sessionStatus === "authenticated";

  if (!details) {
    return (
      <div className="text-center space-y-4">
        <h1 className="text-xl font-bold">Unknown plan</h1>
        <Link href="/pricing" className="text-accent hover:underline">
          View available plans
        </Link>
      </div>
    );
  }

  const Icon = details.icon;
  const isTeal = details.accent === "teal";

  async function handleSubscribe() {
    setLoading(true);
    setError(null);
    trackEvent("begin_checkout", "conversion", "subscribe_page");
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "checkout", plan }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Something went wrong. Please try again.");
        setLoading(false);
      }
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto ${isTeal ? "bg-teal-500/10" : "bg-indigo-500/10"}`}>
          <Icon size={24} className={isTeal ? "text-teal-500" : "text-indigo-500"} />
        </div>
        <h1 className="text-2xl font-bold">{details.name}</h1>
        <p className="text-muted text-sm">{details.price}</p>
      </div>

      <ul className="space-y-2.5">
        {details.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm">
            <Check size={15} className={`mt-0.5 shrink-0 ${isTeal ? "text-teal-500" : "text-indigo-500"}`} />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {error && (
        <div className="bg-red-500/10 text-red-400 text-sm px-4 py-2 rounded-lg">
          {error}
        </div>
      )}

      {isAuthenticated ? (
        <button
          onClick={handleSubscribe}
          disabled={loading}
          className={`w-full flex items-center justify-center gap-2 px-5 py-3 text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-50 transition-colors ${isTeal ? "bg-teal-500" : "bg-indigo-500"}`}
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <ArrowRight size={16} />
          )}
          {loading ? "Redirecting to checkout..." : "Subscribe now"}
        </button>
      ) : (
        <Link
          href={`/login?callbackUrl=/subscribe?plan=${plan}`}
          className={`w-full flex items-center justify-center gap-2 px-5 py-3 text-white rounded-xl font-semibold hover:opacity-90 transition-colors ${isTeal ? "bg-teal-500" : "bg-indigo-500"}`}
        >
          <ArrowRight size={16} />
          Sign in to subscribe
        </Link>
      )}

      <Link
        href="/charts"
        className="block text-center text-sm text-muted hover:text-foreground transition-colors"
      >
        Maybe later — browse free charts
      </Link>
    </div>
  );
}

export default function SubscribePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Activity size={28} className="text-accent" />
          <span className="text-lg font-semibold">Alberta Pulse Check</span>
        </div>

        <div className="bg-card border border-card-border rounded-xl p-6">
          <Suspense fallback={<div className="h-64 animate-pulse bg-card-border/50 rounded" />}>
            <SubscribeForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
