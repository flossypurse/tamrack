"use client";

import { useSession } from "next-auth/react";
import { Settings, MapPin } from "lucide-react";
import Link from "next/link";

export default function RealtorSettingsPage() {
  const { data: session } = useSession();

  const operatingArea = session?.user?.operatingArea as string[] | null | undefined;
  const areaNames = operatingArea?.length
    ? operatingArea.map((slug) =>
        slug
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ")
      )
    : [];

  return (
    <main className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-teal-400">
          <Settings size={20} />
          <span className="text-xs font-mono uppercase tracking-wider">Settings</span>
        </div>
        <h1 className="text-2xl font-bold">Realtor Settings</h1>
      </div>

      {/* Operating area */}
      <div className="bg-card border border-card-border rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-teal-400" />
          <h2 className="font-semibold text-sm">Operating Area</h2>
        </div>
        <div className="flex items-center justify-between">
          <div>
            {areaNames.length > 0 ? (
              <div className="space-y-1">
                {areaNames.map((name) => (
                  <p key={name} className="text-foreground font-medium">{name}</p>
                ))}
              </div>
            ) : (
              <p className="text-muted">No municipalities selected</p>
            )}
            <p className="text-xs text-muted mt-1">
              Your market data and prospects are filtered to these municipalities
            </p>
          </div>
          <Link
            href="/realtor/onboarding"
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
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-teal-500/10 text-teal-400">
            Realtor Plan
          </span>
          <span className="text-sm text-muted">$49/mo per seat</span>
        </div>
        <Link
          href="/billing"
          className="inline-flex items-center gap-2 text-sm text-teal-400 hover:text-teal-300 transition-colors"
        >
          Manage billing →
        </Link>
      </div>

      {/* Account */}
      <div className="bg-card border border-card-border rounded-xl p-6 space-y-4">
        <h2 className="font-semibold text-sm">Account</h2>
        <div className="text-sm space-y-1">
          <p><span className="text-muted">Email:</span> {session?.user?.email}</p>
          <p><span className="text-muted">Plan:</span> Realtor ($49/mo)</p>
        </div>
        <Link
          href="/account"
          className="inline-flex items-center gap-2 text-sm text-teal-400 hover:text-teal-300 transition-colors"
        >
          Account settings →
        </Link>
      </div>
    </main>
  );
}
