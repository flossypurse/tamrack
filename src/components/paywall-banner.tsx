"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Lock, ArrowRight } from "lucide-react";

// Shows an upgrade banner for non-subscribed users viewing gated content
// Used on municipality deep-dive pages to convert free users
export function PaywallBanner() {
  const { data: session } = useSession();

  const isActive = session?.user?.subscriptionStatus === "active";
  const isTrialing = session?.user?.subscriptionStatus === "trialing";

  // Don't show if user has active subscription or trial
  if (isActive || isTrialing) return null;

  return (
    <div className="bg-gradient-to-r from-accent/5 to-accent/10 border border-accent/20 rounded-xl p-6 text-center space-y-3">
      <div className="flex items-center justify-center gap-2">
        <Lock size={18} className="text-accent" />
        <h3 className="text-sm font-semibold">Upgrade to Alberta Pulse Pro</h3>
      </div>
      <p className="text-xs text-muted max-w-md mx-auto">
        Get full access to all {20}+ municipality dashboards, embeddable charts,
        API access, and prospect lead generation tools.
      </p>
      <div className="flex items-center justify-center gap-4">
        <Link
          href="/billing"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          Start Free Trial — $29/mo
          <ArrowRight size={14} />
        </Link>
      </div>
      <p className="text-[10px] text-muted/60">
        14-day free trial. Cancel anytime. No credit card required to start.
      </p>
    </div>
  );
}

// Smaller inline version for use in cards
export function UpgradeHint({ feature }: { feature: string }) {
  return (
    <Link
      href="/billing"
      className="inline-flex items-center gap-1.5 text-[10px] text-accent hover:text-accent/80 transition-colors"
    >
      <Lock size={10} />
      Upgrade for {feature}
    </Link>
  );
}
