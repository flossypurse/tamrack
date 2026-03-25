import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { UserCircle, Clock } from "lucide-react";
import { buildCommunityProfile } from "@/lib/edo/profile-data";
import { ProfileSectionCard, HeadlineMetrics } from "./profile-section";
import { ExportButton } from "./export-button";
import { PrintButton } from "./print-button";

function SectionSkeleton() {
  return (
    <div className="bg-card border border-card-border rounded-xl p-5 animate-pulse">
      <div className="h-4 w-32 bg-card-border/50 rounded mb-4" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-background/50 border border-card-border/30 rounded-lg p-3 h-28" />
        ))}
      </div>
    </div>
  );
}

async function ProfileContent({ municipalitySlug }: { municipalitySlug: string }) {
  const profile = await buildCommunityProfile(municipalitySlug);

  const headlineMetrics = [
    profile.sections.overview.metrics.find((m) => m.label === "Population"),
    profile.sections.overview.metrics.find((m) => m.label === "Assessment Base"),
    profile.sections.overview.metrics.find((m) => m.label === "Building Permits"),
    profile.sections.overview.metrics.find((m) => m.label === "Business Counts"),
  ].filter(Boolean) as import("@/lib/edo/profile-data").ProfileMetric[];

  return (
    <div className="space-y-6">
      {/* Headline metrics */}
      <HeadlineMetrics metrics={headlineMetrics} />

      {/* Sections */}
      <ProfileSectionCard section={profile.sections.overview} />
      <ProfileSectionCard section={profile.sections.economy} />
      <ProfileSectionCard section={profile.sections.demographics} />
      <ProfileSectionCard section={profile.sections.housing} />
      <ProfileSectionCard section={profile.sections.labour} />
      <ProfileSectionCard section={profile.sections.infrastructure} />

      {/* Data citation */}
      <div className="text-[10px] text-muted/50 border-t border-card-border pt-4 space-y-1">
        <div className="flex items-center gap-1">
          <Clock size={10} />
          <span>Generated {new Date(profile.generatedAt).toLocaleString()}</span>
        </div>
        <p>
          Data sourced from regionaldashboard.alberta.ca, StatsCan, and municipal ArcGIS open data portals.
          Regional dashboard data is updated daily. ArcGIS data is cached hourly.
        </p>
      </div>
    </div>
  );
}

export default async function EdoProfileBuilderPage() {
  const session = await auth();
  if (!session?.user?.municipalityId) redirect("/edo/onboarding");

  const municipalitySlug = session.user.municipalityId;
  const municipalityName = municipalitySlug
    .split("-")
    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <main className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-indigo-400">
            <UserCircle size={20} />
            <span className="text-xs font-mono uppercase tracking-wider">Community Profile</span>
          </div>
          <h1 className="text-2xl font-bold">{municipalityName}</h1>
          <p className="text-muted text-sm">
            Comprehensive community profile with key economic indicators, demographics, housing, and labour data.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <ExportButton municipalitySlug={municipalitySlug} municipalityName={municipalityName} />
          <PrintButton />
        </div>
      </div>

      {/* Profile data with suspense */}
      <Suspense
        fallback={
          <div className="space-y-6">
            {/* Headline skeleton */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-card border border-card-border rounded-xl p-4 h-32 animate-pulse" />
              ))}
            </div>
            <SectionSkeleton />
            <SectionSkeleton />
            <SectionSkeleton />
          </div>
        }
      >
        <ProfileContent municipalitySlug={municipalitySlug} />
      </Suspense>
    </main>
  );
}
