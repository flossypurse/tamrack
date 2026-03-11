import { Suspense } from "react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import { NeighbourhoodBarChart } from "@/components/chart";
import {
  fetchStrathconaHotSubdivisions,
  fetchStrathconaResidentialPermits,
  fetchStrathconaAssessmentsByArea,
  type StrathconaPermit,
} from "@/lib/data-sources";
import { Building2, Home, FileText, BarChart3 } from "lucide-react";

// ============================================================
// Key metrics
// ============================================================

async function KeyMetrics() {
  const [subdivisions, assessments] = await Promise.all([
    fetchStrathconaHotSubdivisions().catch(() => []),
    fetchStrathconaAssessmentsByArea().catch(() => []),
  ]);

  const totalPermits = subdivisions.reduce((s, a) => s + a.permits, 0);
  const totalValue = subdivisions.reduce((s, a) => s + a.totalValue, 0);
  const topSubdivision = subdivisions[0];
  const topAssessment = assessments[0];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Residential Dev Permits"
        value={totalPermits.toLocaleString()}
        source="2024+ via Strathcona ArcGIS"
      />
      <MetricCard
        title="Active Subdivisions"
        value={String(subdivisions.length)}
        source="With residential permits"
      />
      <MetricCard
        title="Hottest Subdivision"
        value={topSubdivision?.subdivision || "—"}
        change={topSubdivision ? `${topSubdivision.permits} permits` : ""}
        source="By permit count"
      />
      <MetricCard
        title="Top Assessed Type"
        value={topAssessment?.neighbourhood || "—"}
        change={topAssessment ? `$${topAssessment.avgValue.toLocaleString()} avg` : ""}
        source="By avg assessed value"
      />
    </div>
  );
}

// ============================================================
// Charts
// ============================================================

async function SubdivisionsChart() {
  const data = await fetchStrathconaHotSubdivisions();
  return (
    <Card>
      <CardHeader
        title="Hot Subdivisions"
        subtitle="Residential development permits by subdivision, 2024+"
        badge="LIVE"
      />
      <NeighbourhoodBarChart
        data={data}
        dataKey="permits"
        labelKey="subdivision"
        color="#f97316"
        tooltipLabel="Permits"
        height={420}
      />
    </Card>
  );
}

async function PermitCountChart() {
  const data = await fetchStrathconaHotSubdivisions();
  const chartData = data.map((d) => ({
    neighbourhood: d.subdivision,
    permits: d.permits,
  }));
  return (
    <Card>
      <CardHeader
        title="Permit Count by Subdivision"
        subtitle="Residential development permits, 2024+"
        badge="LIVE"
      />
      <NeighbourhoodBarChart
        data={chartData}
        dataKey="permits"
        color="#10b981"
        tooltipLabel="Permits"
        height={420}
      />
    </Card>
  );
}

async function AssessmentsChart() {
  const data = await fetchStrathconaAssessmentsByArea();
  return (
    <Card>
      <CardHeader
        title="Assessments by Type"
        subtitle="Avg assessed value by building type (top 5000 properties)"
        badge="LIVE"
      />
      <NeighbourhoodBarChart
        data={data}
        dataKey="avgValue"
        color="#ec4899"
        valuePrefix="$"
        tooltipLabel="Avg Assessment"
        height={420}
      />
    </Card>
  );
}

async function RecentPermitsTable() {
  const permits = await fetchStrathconaResidentialPermits(20);
  return (
    <Card>
      <CardHeader
        title="Recent Development Permits"
        subtitle="Latest residential development permits issued"
        badge="LIVE"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-card-border text-muted text-left">
              <th className="pb-2 pr-3 font-medium">Date</th>
              <th className="pb-2 pr-3 font-medium">Subdivision</th>
              <th className="pb-2 pr-3 font-medium">Use</th>
              <th className="pb-2 pr-3 font-medium">Address</th>
              <th className="pb-2 font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            {permits.map((p: StrathconaPermit, i: number) => (
              <tr
                key={i}
                className="border-b border-card-border/50 hover:bg-card-border/20"
              >
                <td className="py-2 pr-3 text-muted whitespace-nowrap">
                  {p.date}
                </td>
                <td className="py-2 pr-3 whitespace-nowrap">{p.subdivision}</td>
                <td className="py-2 pr-3 text-accent-green whitespace-nowrap">
                  {p.units || "—"}
                </td>
                <td className="py-2 pr-3 text-muted whitespace-nowrap font-mono text-[10px]">
                  {p.address}
                </td>
                <td className="py-2 text-muted max-w-xs truncate">
                  {p.description}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ============================================================
// Loading
// ============================================================

function LoadingCard() {
  return (
    <Card>
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-card-border rounded w-1/3" />
        <div className="h-[200px] bg-card-border/50 rounded" />
      </div>
    </Card>
  );
}

function LoadingTable() {
  return (
    <Card>
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-card-border rounded w-1/3" />
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-6 bg-card-border/30 rounded" />
        ))}
      </div>
    </Card>
  );
}

// ============================================================
// Page
// ============================================================

export default function StrathconaPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <Building2 size={22} className="text-orange-400" />
          Strathcona County
        </h1>
        <p className="text-sm text-muted mt-1">
          Development permits, property assessments, and subdivision activity for
          Sherwood Park and surrounding area.
        </p>
      </header>

      {/* Key Metrics */}
      <section>
        <Suspense
          fallback={
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i}>
                  <div className="animate-pulse space-y-2">
                    <div className="h-3 bg-card-border rounded w-1/2" />
                    <div className="h-7 bg-card-border rounded w-2/3" />
                  </div>
                </Card>
              ))}
            </div>
          }
        >
          <KeyMetrics />
        </Suspense>
      </section>

      {/* Building Activity */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Home size={16} className="text-orange-400" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Building Activity
          </h2>
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <SubdivisionsChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <PermitCountChart />
          </Suspense>
        </div>
      </section>

      {/* Assessments */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 size={16} className="text-pink-400" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Property Assessments
          </h2>
        </div>
        <Suspense fallback={<LoadingCard />}>
          <AssessmentsChart />
        </Suspense>
      </section>

      {/* Recent Permits */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <FileText size={16} className="text-blue-400" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Recent Permits
          </h2>
        </div>
        <Suspense fallback={<LoadingTable />}>
          <RecentPermitsTable />
        </Suspense>
      </section>

      {/* Data coverage */}
      <Card>
        <h3 className="text-xs font-medium text-muted mb-2">
          Data Sources
        </h3>
        <div className="grid sm:grid-cols-2 gap-3 text-[10px] text-muted">
          <div>
            <span className="text-foreground font-medium">Development Permits</span> —
            Residential dev permits 2024+ with subdivisions, use type via ArcGIS
          </div>
          <div>
            <span className="text-foreground font-medium">Property Assessments</span> —
            2025 assessed values by building type (top 5000 properties)
          </div>
        </div>
      </Card>

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Alberta Pulse Check — Strathcona County — Data from Strathcona County ArcGIS
      </footer>
    </main>
  );
}
