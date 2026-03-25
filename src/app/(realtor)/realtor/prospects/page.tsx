import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Users } from "lucide-react";
import { buildProspectSnapshot } from "@/lib/realtor/prospect-data";
import { ProspectsDashboard } from "./prospects-client";

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ProspectsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-teal-400">
          <Users size={20} />
          <span className="text-xs font-mono uppercase tracking-wider">
            Prospects
          </span>
        </div>
        <div className="h-8 w-48 bg-card-border/30 rounded animate-pulse" />
        <div className="h-4 w-80 bg-card-border/20 rounded animate-pulse" />
      </div>

      {/* Hot zones + chart skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="bg-card border border-card-border rounded-xl p-4 h-52 animate-pulse"
          >
            <div className="h-3 w-24 bg-card-border/50 rounded mb-3" />
            <div className="h-32 w-full bg-card-border/20 rounded" />
          </div>
        ))}
      </div>

      {/* Recent permits skeleton */}
      <div className="bg-card border border-card-border rounded-xl p-4 animate-pulse">
        <div className="h-4 w-48 bg-card-border/50 rounded mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="h-3 w-40 bg-card-border/30 rounded" />
                <div className="h-2 w-28 bg-card-border/20 rounded" />
              </div>
              <div className="h-3 w-12 bg-card-border/30 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Async data component
// ---------------------------------------------------------------------------

async function ProspectsData({
  operatingArea,
}: {
  operatingArea: string[];
}) {
  const snapshot = await buildProspectSnapshot(operatingArea);
  return <ProspectsDashboard snapshot={snapshot} />;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function RealtorProspectsPage() {
  const session = await auth();
  const operatingArea = (session?.user as Record<string, unknown> | undefined)
    ?.operatingArea as string[] | null | undefined;

  if (!operatingArea || operatingArea.length === 0) {
    redirect("/realtor/onboarding");
  }

  return (
    <main className="p-4 sm:p-6 max-w-5xl mx-auto">
      <Suspense fallback={<ProspectsSkeleton />}>
        <ProspectsData operatingArea={operatingArea} />
      </Suspense>
    </main>
  );
}
