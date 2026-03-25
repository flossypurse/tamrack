import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { FileText } from "lucide-react";
import { buildReportSnapshot, type ReportSnapshot } from "@/lib/realtor/report-data";
import { ReportsDashboard } from "./reports-client";
import { getMunicipality } from "@/lib/municipality-registry";

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ReportsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-teal-400">
          <FileText size={20} />
          <span className="text-xs font-mono uppercase tracking-wider">
            Reports
          </span>
        </div>
        <div className="h-8 w-48 bg-card-border/30 rounded animate-pulse" />
        <div className="h-4 w-72 bg-card-border/20 rounded animate-pulse" />
      </div>

      {/* Print button skeleton */}
      <div className="h-10 w-32 bg-card-border/30 rounded-lg animate-pulse" />

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

      {/* Content skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="bg-card border border-card-border rounded-xl p-4 h-48 animate-pulse"
          >
            <div className="h-4 w-32 bg-card-border/50 rounded mb-4" />
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="h-3 w-full bg-card-border/20 rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Async data component
// ---------------------------------------------------------------------------

function slugToName(slug: string): string {
  const config = getMunicipality(slug);
  if (config) return config.name;
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

async function ReportsData({
  operatingArea,
}: {
  operatingArea: string[];
}) {
  // Build snapshots for all municipalities in operating area in parallel
  const results = await Promise.all(
    operatingArea.map(async (slug) => {
      const snapshot = await buildReportSnapshot(slug);
      return [slug, snapshot] as [string, ReportSnapshot];
    }),
  );

  const snapshots: Record<string, ReportSnapshot> = {};
  for (const [slug, snapshot] of results) {
    snapshots[slug] = snapshot;
  }

  const names = operatingArea.map(slugToName);

  return (
    <ReportsDashboard
      snapshots={snapshots}
      operatingArea={operatingArea}
      municipalityNames={names}
    />
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function RealtorReportsPage() {
  const session = await auth();
  const operatingArea = (session?.user as Record<string, unknown> | undefined)
    ?.operatingArea as string[] | null | undefined;

  if (!operatingArea || operatingArea.length === 0) {
    redirect("/realtor/onboarding");
  }

  return (
    <main className="p-4 sm:p-6 max-w-5xl mx-auto">
      <Suspense fallback={<ReportsSkeleton />}>
        <ReportsData operatingArea={operatingArea} />
      </Suspense>
    </main>
  );
}
