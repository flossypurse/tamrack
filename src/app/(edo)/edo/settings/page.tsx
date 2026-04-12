"use client";

import { useSession } from "next-auth/react";
import { Settings, Building2 } from "lucide-react";
import Link from "next/link";

export default function EdoSettingsPage() {
  const { data: session } = useSession();

  const municipalityId = session?.user?.municipalityId as string | null | undefined;
  const municipalityName = municipalityId
    ? municipalityId
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
    : null;

  return (
    <main className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-indigo-400">
          <Settings size={20} />
          <span className="text-xs font-mono uppercase tracking-wider">Settings</span>
        </div>
        <h1 className="text-2xl font-bold">EDO Settings</h1>
      </div>

      {/* Municipality */}
      <div className="bg-card border border-card-border rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Building2 size={16} className="text-indigo-400" />
          <h2 className="font-semibold text-sm">Municipality</h2>
        </div>
        <div className="flex items-center justify-between">
          <div>
            {municipalityName ? (
              <p className="text-foreground font-medium">{municipalityName}</p>
            ) : (
              <p className="text-muted">No municipality selected</p>
            )}
            <p className="text-xs text-muted mt-1">
              Your dashboards, reports, and alerts are scoped to this municipality
            </p>
          </div>
          <Link
            href="/edo/onboarding"
            className="px-3 py-1.5 text-sm border border-card-border rounded-lg hover:bg-card-border/30 transition-colors"
          >
            Change
          </Link>
        </div>
      </div>

      {/* Subscription */}
      <div className="bg-card border border-card-border rounded-xl p-6 space-y-4">
        <h2 className="font-semibold text-sm">Subscription</h2>
        <div className="flex items-center gap-3">
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-500/10 text-indigo-400">
            EDO Plan
          </span>
          <span className="text-sm text-muted">$299/mo per municipality</span>
        </div>
        <Link
          href="/billing"
          className="inline-flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          Manage billing →
        </Link>
      </div>

      {/* Account */}
      <div className="bg-card border border-card-border rounded-xl p-6 space-y-4">
        <h2 className="font-semibold text-sm">Account</h2>
        <div className="text-sm space-y-1">
          <p><span className="text-muted">Email:</span> {session?.user?.email}</p>
          <p><span className="text-muted">Plan:</span> EDO ($299/mo)</p>
        </div>
        <Link
          href="/account"
          className="inline-flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          Account settings →
        </Link>
      </div>
    </main>
  );
}
