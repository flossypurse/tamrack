import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Building2, GitCompare, Bell, FileText, UserCircle, TrendingUp, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { fetchHeadlineMetrics } from "@/lib/edo/profile-data";
import { HeadlineMetrics } from "./profile-builder/profile-section";

function getMunicipalityName(slug: string | null): string {
  if (!slug) return "Your Municipality";
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

async function DashboardMetrics({ municipalitySlug }: { municipalitySlug: string }) {
  const data = await fetchHeadlineMetrics(municipalitySlug);
  const metrics = [data.population, data.assessmentBase, data.buildingPermits, data.businessCount];
  return <HeadlineMetrics metrics={metrics} />;
}

function MetricsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-card border border-card-border rounded-xl p-4 h-32 animate-pulse">
          <div className="h-3 w-16 bg-card-border/50 rounded mb-3" />
          <div className="h-7 w-20 bg-card-border/50 rounded" />
        </div>
      ))}
    </div>
  );
}

export default async function EdoDashboardPage() {
  const session = await auth();
  if (!session?.user?.municipalityId) {
    redirect("/edo/onboarding");
  }

  const municipalitySlug = session.user.municipalityId;
  const municipalityName = getMunicipalityName(municipalitySlug);

  const quickActions = [
    {
      href: "/edo/profile-builder",
      icon: UserCircle,
      title: "Community Profile",
      description: "Generate a comprehensive profile for " + municipalityName,
    },
    {
      href: "/edo/compare",
      icon: GitCompare,
      title: "Peer Comparison",
      description: "Compare against similar municipalities",
    },
    {
      href: "/edo/alerts",
      icon: Bell,
      title: "Trend Alerts",
      description: "Monitor key indicators for changes",
    },
    {
      href: "/edo/reports",
      icon: FileText,
      title: "Council Reports",
      description: "Generate reports for council presentations",
    },
  ];

  return (
    <main className="p-4 sm:p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-indigo-400">
          <Building2 size={20} />
          <span className="text-xs font-mono uppercase tracking-wider">EDO Dashboard</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold">{municipalityName}</h1>
        <p className="text-muted text-sm">
          Your economic development intelligence hub. Data is updated hourly from 18 government sources.
        </p>
      </div>

      {/* Key metrics — live data */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={16} className="text-indigo-400" />
          <h2 className="text-sm font-semibold">Key Indicators</h2>
        </div>
        <Suspense fallback={<MetricsSkeleton />}>
          <DashboardMetrics municipalitySlug={municipalitySlug} />
        </Suspense>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-semibold mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="group flex items-start gap-3 bg-card border border-card-border rounded-xl p-4 hover:border-indigo-500/30 transition-colors"
              >
                <Icon size={18} className="text-muted group-hover:text-indigo-400 mt-0.5 shrink-0 transition-colors" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-medium group-hover:text-indigo-400 transition-colors">
                      {action.title}
                    </h3>
                    <ArrowRight size={12} className="text-muted group-hover:text-indigo-400 transition-colors" />
                  </div>
                  <p className="text-xs text-muted mt-0.5">{action.description}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Data coverage note */}
      <div className="text-xs text-muted/60 border-t border-card-border pt-4">
        <p>
          Data sourced from regionaldashboard.alberta.ca, StatsCan, ArcGIS, and 15+ other government APIs.
          See <Link href={`/municipalities/${municipalitySlug}`} className="underline hover:text-foreground">public municipality page</Link> for
          the full data available.
        </p>
      </div>
    </main>
  );
}
