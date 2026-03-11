import { Suspense } from "react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import {
  NeighbourhoodBarChart,
  TimeSeriesBarChart,
} from "@/components/chart";
import {
  fetchStAlbertDevPermits,
  fetchStAlbertDevPermitsSummary,
  fetchStAlbertAssessmentsByNeighbourhood,
  type StAlbertDevPermit,
} from "@/lib/data-sources";
import { Building2, Home, FileText, BarChart3 } from "lucide-react";

// ============================================================
// Key metrics
// ============================================================

async function KeyMetrics() {
  const [permits, assessments] = await Promise.all([
    fetchStAlbertDevPermits(100).catch(() => []),
    fetchStAlbertAssessmentsByNeighbourhood().catch(() => []),
  ]);

  const totalPermits = permits.length;
  const topNeighbourhood = assessments[0];
  const totalAssessed = assessments.reduce((s, a) => s + a.count, 0);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Residential Dev Permits"
        value={String(totalPermits)}
        source="Current + past year"
      />
      <MetricCard
        title="Assessed Properties"
        value={totalAssessed.toLocaleString()}
        source="Residential, 2025"
      />
      <MetricCard
        title="Highest Avg Assessment"
        value={topNeighbourhood?.neighbourhood || "—"}
        change={topNeighbourhood ? `$${topNeighbourhood.avgValue.toLocaleString()}` : ""}
        source="By neighbourhood"
      />
      <MetricCard
        title="Neighbourhoods Tracked"
        value={String(assessments.length)}
        source="With 5+ residential properties"
      />
    </div>
  );
}

// ============================================================
// Charts
// ============================================================

async function DevPermitTrendChart() {
  const data = await fetchStAlbertDevPermitsSummary();
  return (
    <Card>
      <CardHeader
        title="Dev Permits by Month"
        subtitle="Monthly residential development permit decisions"
        badge="LIVE"
      />
      <TimeSeriesBarChart data={data} color="#a855f7" />
    </Card>
  );
}

async function AssessmentsChart() {
  const data = await fetchStAlbertAssessmentsByNeighbourhood();
  return (
    <Card>
      <CardHeader
        title="Assessments by Neighbourhood"
        subtitle="Avg residential assessed value, 2025"
        badge="LIVE"
      />
      <NeighbourhoodBarChart
        data={data}
        dataKey="avgValue"
        color="#a855f7"
        valuePrefix="$"
        tooltipLabel="Avg Assessment"
        height={420}
      />
    </Card>
  );
}

async function AssessmentCountChart() {
  const data = await fetchStAlbertAssessmentsByNeighbourhood();
  const chartData = data
    .sort((a, b) => b.count - a.count)
    .slice(0, 15)
    .map((d) => ({
      neighbourhood: d.neighbourhood,
      permits: d.count,
    }));
  return (
    <Card>
      <CardHeader
        title="Properties per Neighbourhood"
        subtitle="Residential property count by neighbourhood"
        badge="LIVE"
      />
      <NeighbourhoodBarChart
        data={chartData}
        dataKey="permits"
        color="#3b82f6"
        tooltipLabel="Properties"
        height={420}
      />
    </Card>
  );
}

async function DevPermitsTable() {
  const permits = await fetchStAlbertDevPermits(20);
  return (
    <Card>
      <CardHeader
        title="Recent Residential Dev Permits"
        subtitle="Weekly development permit decisions"
        badge="LIVE"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-card-border text-muted text-left">
              <th className="pb-2 pr-3 font-medium">Date</th>
              <th className="pb-2 pr-3 font-medium">Type</th>
              <th className="pb-2 pr-3 font-medium">Status</th>
              <th className="pb-2 pr-3 font-medium">Address</th>
              <th className="pb-2 font-medium">Subject</th>
            </tr>
          </thead>
          <tbody>
            {permits.map((p: StAlbertDevPermit, i: number) => (
              <tr
                key={i}
                className="border-b border-card-border/50 hover:bg-card-border/20"
              >
                <td className="py-2 pr-3 text-muted whitespace-nowrap">
                  {p.date}
                </td>
                <td className="py-2 pr-3 whitespace-nowrap text-muted">
                  {p.type.replace("DP ", "")}
                </td>
                <td className="py-2 pr-3 whitespace-nowrap">
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded ${
                      p.status === "COMPLETED"
                        ? "bg-accent-green/20 text-accent-green"
                        : "bg-accent-amber/20 text-accent-amber"
                    }`}
                  >
                    {p.status}
                  </span>
                </td>
                <td className="py-2 pr-3 text-muted whitespace-nowrap font-mono text-[10px]">
                  {p.address}
                </td>
                <td className="py-2 text-muted max-w-xs truncate">
                  {p.subject}
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

export default function StAlbertPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <Building2 size={22} className="text-purple-400" />
          St. Albert
        </h1>
        <p className="text-sm text-muted mt-1">
          Development permits and property assessments by neighbourhood.
          Weekly permit decisions and 2025 residential assessment data.
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

      {/* Dev Permits */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <FileText size={16} className="text-purple-400" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Development Permits
          </h2>
        </div>
        <Suspense fallback={<LoadingCard />}>
          <DevPermitTrendChart />
        </Suspense>
        <div className="mt-4">
          <Suspense fallback={<LoadingTable />}>
            <DevPermitsTable />
          </Suspense>
        </div>
      </section>

      {/* Assessments */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Home size={16} className="text-green-400" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Property Assessments
          </h2>
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <AssessmentsChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <AssessmentCountChart />
          </Suspense>
        </div>
      </section>

      {/* Data coverage */}
      <Card>
        <h3 className="text-xs font-medium text-muted mb-2">
          Data Sources
        </h3>
        <div className="grid sm:grid-cols-2 gap-3 text-[10px] text-muted">
          <div>
            <span className="text-foreground font-medium">Dev Permits</span> —
            Current year + past year residential permits via ArcGIS FeatureServer
          </div>
          <div>
            <span className="text-foreground font-medium">Assessments</span> —
            2025 residential assessments by neighbourhood via ArcGIS FeatureServer
          </div>
        </div>
      </Card>

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Alberta Pulse Check — St. Albert — Data from City of St. Albert ArcGIS
      </footer>
    </main>
  );
}
