import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { TrendingUp } from "lucide-react";
import { buildMarketSnapshot } from "@/lib/realtor/market-data";
import { MarketDashboard } from "./market-client";

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function MarketSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-teal-400">
          <TrendingUp size={20} />
          <span className="text-xs font-mono uppercase tracking-wider">
            Market Intelligence
          </span>
        </div>
        <div className="h-8 w-48 bg-card-border/30 rounded animate-pulse" />
        <div className="h-4 w-72 bg-card-border/20 rounded animate-pulse" />
      </div>

      {/* Metric cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-card border border-card-border rounded-xl p-4 h-36 animate-pulse"
          >
            <div className="h-3 w-20 bg-card-border/50 rounded mb-3" />
            <div className="h-7 w-24 bg-card-border/50 rounded" />
            <div className="h-10 w-full bg-card-border/20 rounded mt-4" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="bg-card border border-card-border rounded-xl p-4 h-40 animate-pulse">
        <div className="h-4 w-32 bg-card-border/50 rounded mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-3 w-full bg-card-border/20 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Async data component
// ---------------------------------------------------------------------------

async function MarketData({
  operatingArea,
}: {
  operatingArea: string[];
}) {
  const snapshot = await buildMarketSnapshot(operatingArea);
  return <MarketDashboard snapshot={snapshot} />;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function RealtorMarketPage() {
  const session = await auth();
  const operatingArea = (session?.user as Record<string, unknown> | undefined)
    ?.operatingArea as string[] | null | undefined;

  if (!operatingArea || operatingArea.length === 0) {
    redirect("/realtor/onboarding");
  }

  return (
    <main className="p-4 sm:p-6 max-w-5xl mx-auto">
      <Suspense fallback={<MarketSkeleton />}>
        <MarketData operatingArea={operatingArea} />
      </Suspense>
    </main>
  );
}
