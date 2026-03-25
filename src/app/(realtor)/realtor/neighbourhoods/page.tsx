import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { MapPin } from "lucide-react";
import { buildNeighbourhoodSnapshot } from "@/lib/realtor/neighbourhood-data";
import { NeighbourhoodsDashboard } from "./neighbourhoods-client";

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function NeighbourhoodsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-teal-400">
          <MapPin size={20} />
          <span className="text-xs font-mono uppercase tracking-wider">
            Neighbourhoods
          </span>
        </div>
        <div className="h-8 w-56 bg-card-border/30 rounded animate-pulse" />
        <div className="h-4 w-72 bg-card-border/20 rounded animate-pulse" />
      </div>

      {/* Cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="bg-card border border-card-border rounded-xl p-3 h-28 animate-pulse"
          >
            <div className="h-3 w-24 bg-card-border/50 rounded mb-3" />
            <div className="h-6 w-20 bg-card-border/50 rounded mb-2" />
            <div className="h-2 w-32 bg-card-border/20 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Async data component
// ---------------------------------------------------------------------------

async function NeighbourhoodsData({
  operatingArea,
}: {
  operatingArea: string[];
}) {
  const snapshot = await buildNeighbourhoodSnapshot(operatingArea);
  return <NeighbourhoodsDashboard snapshot={snapshot} />;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function RealtorNeighbourhoodsPage() {
  const session = await auth();
  const operatingArea = (session?.user as Record<string, unknown> | undefined)
    ?.operatingArea as string[] | null | undefined;

  if (!operatingArea || operatingArea.length === 0) {
    redirect("/realtor/onboarding");
  }

  return (
    <main className="p-4 sm:p-6 max-w-5xl mx-auto">
      <Suspense fallback={<NeighbourhoodsSkeleton />}>
        <NeighbourhoodsData operatingArea={operatingArea} />
      </Suspense>
    </main>
  );
}
