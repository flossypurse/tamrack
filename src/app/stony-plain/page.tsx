import { Suspense } from "react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import { NeighbourhoodBarChart } from "@/components/chart";
import {
  fetchStonyPlainAssessmentsByZoning,
  fetchStonyPlainHighValueParcels,
  fetchStonyPlainBusinessesByCategory,
  fetchStonyPlainVacantLots,
  fetchStonyPlainConstructionProjects,
  fetchStonyPlainParcelCount,
  fetchStonyPlainVacantCount,
  type StonyPlainParcel,
  type StonyPlainConstruction,
} from "@/lib/data-sources";
import { Building2, Home, Store, HardHat, MapPin } from "lucide-react";

// ============================================================
// Key metrics
// ============================================================

async function KeyMetrics() {
  const [parcelCount, vacantCount, businesses, assessments] = await Promise.all([
    fetchStonyPlainParcelCount().catch(() => 0),
    fetchStonyPlainVacantCount().catch(() => 0),
    fetchStonyPlainBusinessesByCategory().catch(() => []),
    fetchStonyPlainAssessmentsByZoning().catch(() => []),
  ]);

  const totalBusinesses = businesses.reduce((s, b) => s + b.count, 0);
  const topCategory = businesses[0];
  const totalAssessed = assessments.reduce((s, a) => s + a.count, 0);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Total Parcels"
        value={parcelCount.toLocaleString()}
        source="Stony Plain ArcGIS"
      />
      <MetricCard
        title="Vacant Lots"
        value={vacantCount.toLocaleString()}
        source="Development opportunities"
      />
      <MetricCard
        title="Registered Businesses"
        value={totalBusinesses.toLocaleString()}
        change={topCategory ? `Top: ${topCategory.category}` : ""}
        source="Business registry"
      />
      <MetricCard
        title="Assessed Properties"
        value={totalAssessed.toLocaleString()}
        source="Properties with zoning"
      />
    </div>
  );
}

// ============================================================
// Charts
// ============================================================

async function AssessmentsByZoningChart() {
  const data = await fetchStonyPlainAssessmentsByZoning();
  const chartData = data.filter((d) => d.count >= 3).map((d) => ({
    neighbourhood: d.zoning,
    avgValue: d.avgAssessment,
  }));
  return (
    <Card>
      <CardHeader
        title="Avg Assessment by Zoning"
        subtitle="Average assessed value per zoning district"
        badge="LIVE"
      />
      <NeighbourhoodBarChart
        data={chartData}
        dataKey="avgValue"
        color="#10b981"
        valuePrefix="$"
        tooltipLabel="Avg Assessment"
        height={420}
      />
    </Card>
  );
}

async function ZoningCountChart() {
  const data = await fetchStonyPlainAssessmentsByZoning();
  const chartData = data.filter((d) => d.count >= 3).map((d) => ({
    neighbourhood: d.zoning,
    permits: d.count,
  }));
  return (
    <Card>
      <CardHeader
        title="Properties by Zoning"
        subtitle="Number of assessed parcels per zoning district"
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

async function BusinessCategoriesChart() {
  const data = await fetchStonyPlainBusinessesByCategory();
  const chartData = data.slice(0, 15).map((d) => ({
    neighbourhood: d.category,
    permits: d.count,
  }));
  return (
    <Card>
      <CardHeader
        title="Businesses by Category"
        subtitle="Registered businesses in Stony Plain"
        badge="LIVE"
      />
      <NeighbourhoodBarChart
        data={chartData}
        dataKey="permits"
        color="#a855f7"
        tooltipLabel="Businesses"
        height={420}
      />
    </Card>
  );
}

async function VacantLotsChart() {
  const data = await fetchStonyPlainVacantLots();
  const chartData = data.map((d) => ({
    neighbourhood: d.zoning,
    permits: d.count,
  }));
  return (
    <Card>
      <CardHeader
        title="Vacant Lots by Zoning"
        subtitle="Development-ready parcels by zoning type"
        badge="LIVE"
      />
      <NeighbourhoodBarChart
        data={chartData}
        dataKey="permits"
        color="#f59e0b"
        tooltipLabel="Vacant Lots"
        height={420}
      />
    </Card>
  );
}

async function HighValueParcelsTable() {
  const parcels = await fetchStonyPlainHighValueParcels(20);
  return (
    <Card>
      <CardHeader
        title="Highest Assessed Properties"
        subtitle="Top parcels by total taxable assessment"
        badge="LIVE"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-card-border text-muted text-left">
              <th className="pb-2 pr-3 font-medium">Address</th>
              <th className="pb-2 pr-3 font-medium">Assessment</th>
              <th className="pb-2 pr-3 font-medium">Zoning</th>
              <th className="pb-2 pr-3 font-medium">Year Built</th>
              <th className="pb-2 font-medium">Last Sale</th>
            </tr>
          </thead>
          <tbody>
            {parcels.map((p: StonyPlainParcel, i: number) => (
              <tr
                key={i}
                className="border-b border-card-border/50 hover:bg-card-border/20"
              >
                <td className="py-2 pr-3 whitespace-nowrap font-mono text-[10px]">
                  {p.address}
                </td>
                <td className="py-2 pr-3 text-accent-green whitespace-nowrap">
                  ${p.assessment.toLocaleString()}
                </td>
                <td className="py-2 pr-3">
                  <span className="text-[9px] bg-accent/20 text-accent px-1.5 py-0.5 rounded">
                    {p.zoning}
                  </span>
                </td>
                <td className="py-2 pr-3 text-muted">
                  {p.yearBuilt > 0 ? p.yearBuilt : "—"}
                </td>
                <td className="py-2 text-muted">
                  {p.salePrice > 0 ? `$${p.salePrice.toLocaleString()}` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

async function ConstructionProjectsTable() {
  const projects = await fetchStonyPlainConstructionProjects();
  if (projects.length === 0) return null;
  return (
    <Card>
      <CardHeader
        title="Active Construction Projects"
        subtitle="Municipal infrastructure projects"
        badge="LIVE"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-card-border text-muted text-left">
              <th className="pb-2 pr-3 font-medium">Project</th>
              <th className="pb-2 pr-3 font-medium">Phase</th>
              <th className="pb-2 pr-3 font-medium">Start</th>
              <th className="pb-2 pr-3 font-medium">End</th>
              <th className="pb-2 font-medium">Location</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p: StonyPlainConstruction, i: number) => (
              <tr
                key={i}
                className="border-b border-card-border/50 hover:bg-card-border/20"
              >
                <td className="py-2 pr-3 whitespace-nowrap">{p.project}</td>
                <td className="py-2 pr-3">
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded ${
                      p.phase === "Construction"
                        ? "bg-accent-amber/20 text-accent-amber"
                        : "bg-accent-green/20 text-accent-green"
                    }`}
                  >
                    {p.phase}
                  </span>
                </td>
                <td className="py-2 pr-3 text-muted">{p.startDate}</td>
                <td className="py-2 pr-3 text-muted">{p.endDate}</td>
                <td className="py-2 text-muted max-w-xs truncate">
                  {p.location}
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

export default function StonyPlainPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <Building2 size={22} className="text-blue-400" />
          Stony Plain
        </h1>
        <p className="text-sm text-muted mt-1">
          Property assessments, businesses, vacant lots, and construction
          projects. 8,400+ parcels with zoning, year built, and sale price data.
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
            <ZoningCountChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <AssessmentsByZoningChart />
          </Suspense>
        </div>
      </section>

      {/* Business & Development */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Store size={16} className="text-purple-400" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Business & Development Opportunities
          </h2>
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <BusinessCategoriesChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <VacantLotsChart />
          </Suspense>
        </div>
      </section>

      {/* High Value Properties */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <MapPin size={16} className="text-pink-400" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Highest Value Properties
          </h2>
        </div>
        <Suspense fallback={<LoadingTable />}>
          <HighValueParcelsTable />
        </Suspense>
      </section>

      {/* Construction Projects */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <HardHat size={16} className="text-amber-400" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Infrastructure Projects
          </h2>
        </div>
        <Suspense fallback={<LoadingTable />}>
          <ConstructionProjectsTable />
        </Suspense>
      </section>

      {/* Data coverage */}
      <Card>
        <h3 className="text-xs font-medium text-muted mb-2">
          Data Sources
        </h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-[10px] text-muted">
          <div>
            <span className="text-foreground font-medium">Parcels</span> —
            8,477 parcels with assessments, sale prices, year built, zoning via ArcGIS FeatureServer
          </div>
          <div>
            <span className="text-foreground font-medium">Assessments</span> —
            9,032 records for 2026 assessment year
          </div>
          <div>
            <span className="text-foreground font-medium">Businesses</span> —
            425 registered businesses with categories
          </div>
          <div>
            <span className="text-foreground font-medium">Vacant Lots</span> —
            495 development-ready parcels
          </div>
          <div>
            <span className="text-foreground font-medium">Construction</span> —
            Active municipal infrastructure projects
          </div>
          <div>
            <span className="text-foreground font-medium">Also Available</span> —
            Traffic counts, building footprints, neighbourhoods, infill map
          </div>
        </div>
      </Card>

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Alberta Pulse Check — Stony Plain — Data from Town of Stony Plain ArcGIS
      </footer>
    </main>
  );
}
