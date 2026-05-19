import Link from "next/link";
import { Activity, ArrowRight, Lock } from "lucide-react";

// Pulse Real Estate is closed to new signups as of 2026-05-18. Grandfathered
// users with an operating_area bypass onboarding via middleware. New arrivals
// at this URL (no operating area) see this sunset notice.

export default function RealtorOnboardingPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="flex items-center justify-center gap-2">
          <Activity size={24} className="text-teal-400" />
          <span className="text-lg font-bold">Pulse Real Estate</span>
        </div>

        <div className="w-14 h-14 rounded-xl bg-teal-500/10 flex items-center justify-center mx-auto">
          <Lock size={26} className="text-teal-400" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Pulse Real Estate is closed to new signups</h1>
          <p className="text-muted text-sm">
            We&apos;re no longer onboarding new realtor seats. Existing subscribers
            keep their market dashboard, prospects, and PDF reports as-is.
          </p>
        </div>

        <div className="space-y-2">
          <Link
            href="/sunset"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-teal-500 text-white rounded-xl font-semibold hover:bg-teal-600 transition-colors"
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
    </main>
  );
}
