"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Activity, ArrowRight, Lock } from "lucide-react";
import Link from "next/link";

// Pulse EDO ($299) and Pulse Real Estate ($49) sunset to new signups
// 2026-05-18. Existing subscribers continue unaffected; new arrivals at
// /subscribe?plan=edo or ?plan=realtor see a closed-products panel here.
// No other plans are currently sold via this page.

const SUNSET_PRODUCTS: Record<string, string> = {
  edo: "Pulse EDO",
  realtor: "Pulse Real Estate",
};

function SubscribeBody() {
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan") || "";
  const productName = SUNSET_PRODUCTS[plan];

  if (productName) {
    return (
      <div className="space-y-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-muted/10 flex items-center justify-center mx-auto">
          <Lock size={22} className="text-muted" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">{productName} is no longer offered</h1>
          <p className="text-muted text-sm">
            We closed new signups for {productName} in May 2026. Existing subscribers
            keep their access at the same price.
          </p>
        </div>
        <div className="space-y-2">
          <Link
            href="/sunset"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-accent text-white rounded-xl font-semibold hover:opacity-90 transition-colors"
          >
            Read more
            <ArrowRight size={16} />
          </Link>
          <Link
            href="/charts"
            className="block text-sm text-muted hover:text-foreground transition-colors"
          >
            Browse free charts
          </Link>
        </div>
      </div>
    );
  }

  // No active paid plans are sold here. Send the user to /pricing.
  return (
    <div className="space-y-6 text-center">
      <h1 className="text-xl font-bold">Nothing to subscribe to right now</h1>
      <p className="text-muted text-sm">
        The chart catalogue and Tamrack Learn are free. A paid Tamrack tier
        is coming; the pricing page has the latest.
      </p>
      <Link
        href="/pricing"
        className="inline-flex items-center gap-2 px-5 py-3 bg-accent text-white rounded-xl font-semibold hover:opacity-90 transition-colors"
      >
        See pricing
        <ArrowRight size={16} />
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
          <span className="text-lg font-semibold">Tamrack</span>
        </div>

        <div className="bg-card border border-card-border rounded-xl p-6">
          <Suspense fallback={<div className="h-64 animate-pulse bg-card-border/50 rounded" />}>
            <SubscribeBody />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
