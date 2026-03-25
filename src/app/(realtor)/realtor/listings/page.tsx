import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Home } from "lucide-react";
import { getMunicipality } from "@/lib/municipality-registry";
import {
  fetchTopProperties,
  fetchAssessmentsByGroup,
  fetchVacantLots,
} from "@/lib/municipality-data";
import {
  ListingsDashboard,
  type MuniListingsData,
  type ListingsSnapshot,
} from "./listings-client";

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ListingsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-teal-400">
          <Home size={20} />
          <span className="text-xs font-mono uppercase tracking-wider">
            Listings
          </span>
        </div>
        <div className="h-8 w-48 bg-card-border/30 rounded animate-pulse" />
        <div className="h-4 w-80 bg-card-border/20 rounded animate-pulse" />
      </div>

      {/* Properties table skeleton */}
      <div className="bg-card border border-card-border rounded-xl p-4 animate-pulse">
        <div className="h-4 w-40 bg-card-border/50 rounded mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="h-3 w-48 bg-card-border/30 rounded" />
              <div className="h-3 w-20 bg-card-border/30 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Chart + lots skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="bg-card border border-card-border rounded-xl p-4 h-64 animate-pulse"
          >
            <div className="h-4 w-32 bg-card-border/50 rounded mb-4" />
            <div className="h-48 w-full bg-card-border/20 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugToName(slug: string): string {
  const config = getMunicipality(slug);
  if (config) return config.name;
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Async data component
// ---------------------------------------------------------------------------

async function ListingsData({
  operatingArea,
}: {
  operatingArea: string[];
}) {
  const municipalities: MuniListingsData[] = await Promise.all(
    operatingArea.map(async (slug) => {
      const config = getMunicipality(slug);
      const name = slugToName(slug);

      if (!config) {
        return {
          slug,
          name,
          topProperties: [],
          assessmentBreakdown: [],
          vacantLots: [],
        };
      }

      const [topProperties, assessmentBreakdown, vacantLots] =
        await Promise.all([
          fetchTopProperties(config, 20).catch(() => []),
          fetchAssessmentsByGroup(config, "neighbourhood").catch(() => []),
          fetchVacantLots(config).catch(() => []),
        ]);

      return {
        slug,
        name,
        topProperties,
        assessmentBreakdown,
        vacantLots,
      };
    }),
  );

  const snapshot: ListingsSnapshot = {
    operatingArea,
    municipalityNames: operatingArea.map(slugToName),
    generatedAt: new Date().toISOString(),
    municipalities,
  };

  return <ListingsDashboard snapshot={snapshot} />;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function RealtorListingsPage() {
  const session = await auth();
  const operatingArea = (session?.user as Record<string, unknown> | undefined)
    ?.operatingArea as string[] | null | undefined;

  if (!operatingArea || operatingArea.length === 0) {
    redirect("/realtor/onboarding");
  }

  return (
    <main className="p-4 sm:p-6 max-w-5xl mx-auto">
      <Suspense fallback={<ListingsSkeleton />}>
        <ListingsData operatingArea={operatingArea} />
      </Suspense>
    </main>
  );
}
