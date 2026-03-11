import { Suspense } from "react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import { NeighbourhoodBarChart } from "@/components/chart";
import {
  fetchParklandAssessmentsBySubdivision,
  fetchParklandZoningSummary,
  fetchParklandRecentParcels,
  fetchParklandParcelCount,
  fetchParklandAssessmentsByZoning,
  type ParklandParcel,
} from "@/lib/data-sources";
import { Home, MapPin, TreePine, BarChart3 } from "lucide-react";

// ============================================================
// Key metrics
// ============================================================

async function KeyMetrics() {
  const [parcelCount, subdivisions, zoningByCount] = await Promise.all([
    fetchParklandParcelCount().catch(() => 0),
    fetchParklandAssessmentsBySubdivision().catch(() => []),
    fetchParklandAssessmentsByZoning().catch(() => []),
  ]);

  const totalParcels = parcelCount;
  const totalSubdivisions = subdivisions.length;
  const topSubdivision = subdivisions[0];
  const residentialZones = zoningByCount.filter(
    (z) => z.zoning.startsWith("CR") || z.zoning.startsWith("ER") || z.zoning.startsWith("VR") || z.zoning.startsWith("LSR")
  );
  const residentialCount = residentialZones.reduce((s, z) => s + z.count, 0);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Total Parcels"
        value={totalParcels.toLocaleString()}
        source="Parkland County ArcGIS"
      />
      <MetricCard
        title="Subdivisions with Data"
        value={String(totalSubdivisions)}
        source="Parcels with assessments"
      />
      <MetricCard
        title="Largest Subdivision"
        value={topSubdivision?.subdivision || "—"}
        change={topSubdivision ? `${topSubdivision.count} parcels` : ""}
        source="By parcel count"
      />
      <MetricCard
        title="Residential Parcels"
        value={residentialCount.toLocaleString()}
        source="CR/ER/VR/LSR zones"
      />
    </div>
  );
}

// ============================================================
// Charts
// ============================================================

async function SubdivisionAssessmentsChart() {
  const data = await fetchParklandAssessmentsBySubdivision();
  const chartData = data.slice(0, 20).map((d) => ({
    neighbourhood: d.subdivision,
    avgValue: d.avgAssessment,
  }));
  return (
    <Card>
      <CardHeader
        title="Avg Assessment by Subdivision"
        subtitle="Top 20 subdivisions by parcel count — avg assessed value"
        badge="LIVE"
      />
      <NeighbourhoodBarChart
        data={chartData}
        dataKey="avgValue"
        color="#10b981"
        valuePrefix="$"
        tooltipLabel="Avg Assessment"
        height={520}
      />
    </Card>
  );
}

async function SubdivisionCountChart() {
  const data = await fetchParklandAssessmentsBySubdivision();
  const chartData = data.slice(0, 20).map((d) => ({
    neighbourhood: d.subdivision,
    permits: d.count,
  }));
  return (
    <Card>
      <CardHeader
        title="Parcels per Subdivision"
        subtitle="Top 20 subdivisions by number of assessed parcels"
        badge="LIVE"
      />
      <NeighbourhoodBarChart
        data={chartData}
        dataKey="permits"
        color="#3b82f6"
        tooltipLabel="Parcels"
        height={520}
      />
    </Card>
  );
}

async function ZoningChart() {
  const data = await fetchParklandZoningSummary();
  const chartData = data.map((d) => ({
    neighbourhood: d.zoningAbbr || d.zoning,
    permits: d.areaHa,
  }));
  return (
    <Card>
      <CardHeader
        title="Land Use by Zone Type"
        subtitle="Area in hectares per zoning district"
        badge="LIVE"
      />
      <NeighbourhoodBarChart
        data={chartData}
        dataKey="permits"
        color="#f59e0b"
        tooltipLabel="Hectares"
        height={420}
      />
    </Card>
  );
}

async function AssessmentsByZoningChart() {
  const data = await fetchParklandAssessmentsByZoning();
  const chartData = data.filter((d) => d.count >= 5).map((d) => ({
    neighbourhood: d.zoning,
    avgValue: d.avgAssessment,
  }));
  return (
    <Card>
      <CardHeader
        title="Avg Assessment by Zoning Type"
        subtitle="Average assessed value per zoning district"
        badge="LIVE"
      />
      <NeighbourhoodBarChart
        data={chartData}
        dataKey="avgValue"
        color="#ec4899"
        valuePrefix="$"
        tooltipLabel="Avg Assessment"
        height={420}
      />
    </Card>
  );
}

async function HighValueParcelsTable() {
  const parcels = await fetchParklandRecentParcels(25);
  return (
    <Card>
      <CardHeader
        title="Highest Assessed Parcels"
        subtitle="Top parcels by assessed value"
        badge="LIVE"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-card-border text-muted text-left">
              <th className="pb-2 pr-3 font-medium">Subdivision</th>
              <th className="pb-2 pr-3 font-medium">Address</th>
              <th className="pb-2 pr-3 font-medium">Assessment</th>
              <th className="pb-2 pr-3 font-medium">Year</th>
              <th className="pb-2 pr-3 font-medium">Zoning</th>
              <th className="pb-2 font-medium">Acreage</th>
            </tr>
          </thead>
          <tbody>
            {parcels.map((p: ParklandParcel, i: number) => (
              <tr
                key={i}
                className="border-b border-card-border/50 hover:bg-card-border/20"
              >
                <td className="py-2 pr-3 whitespace-nowrap">{p.subdivision}</td>
                <td className="py-2 pr-3 text-muted whitespace-nowrap font-mono text-[10px]">
                  {p.address}
                </td>
                <td className="py-2 pr-3 text-accent-green whitespace-nowrap">
                  ${p.assessment.toLocaleString()}
                </td>
                <td className="py-2 pr-3 text-muted">{p.assessmentYear}</td>
                <td className="py-2 pr-3">
                  {p.zoning && (
                    <span className="text-[9px] bg-accent/20 text-accent px-1.5 py-0.5 rounded">
                      {p.zoning}
                    </span>
                  )}
                </td>
                <td className="py-2 text-muted">
                  {p.acreage > 0 ? `${p.acreage.toFixed(1)} ac` : "—"}
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

export default function ParklandCountyPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <TreePine size={22} className="text-green-400" />
          Parkland County
        </h1>
        <p className="text-sm text-muted mt-1">
          Property assessments, land use, and subdivision data from Parkland
          County&apos;s ArcGIS MapServer. 14,000+ parcels with zoning and assessment data.
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

      {/* Subdivision Analysis */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Home size={16} className="text-green-400" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Subdivisions
          </h2>
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <SubdivisionCountChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <SubdivisionAssessmentsChart />
          </Suspense>
        </div>
      </section>

      {/* Land Use */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <MapPin size={16} className="text-amber-400" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Land Use & Zoning
          </h2>
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <ZoningChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <AssessmentsByZoningChart />
          </Suspense>
        </div>
      </section>

      {/* High Value Parcels */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 size={16} className="text-pink-400" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Highest Value Properties
          </h2>
        </div>
        <Suspense fallback={<LoadingTable />}>
          <HighValueParcelsTable />
        </Suspense>
      </section>

      {/* Data coverage */}
      <Card>
        <h3 className="text-xs font-medium text-muted mb-2">
          Data Sources
        </h3>
        <div className="grid sm:grid-cols-2 gap-3 text-[10px] text-muted">
          <div>
            <span className="text-foreground font-medium">Parcels</span> —
            14,485 parcels with assessments, zoning, subdivision names via ArcGIS MapServer
          </div>
          <div>
            <span className="text-foreground font-medium">Land Use</span> —
            24 zoning districts with area (hectares) via ArcGIS MapServer
          </div>
          <div>
            <span className="text-foreground font-medium">Missing</span> —
            No building/development permit data available via API (GIS visualization only)
          </div>
          <div>
            <span className="text-foreground font-medium">Refresh</span> —
            Assessment data is annual (currently 2024), land use updated as bylaws change
          </div>
        </div>
      </Card>

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Alberta Pulse Check — Parkland County — Data from Parkland County ArcGIS
      </footer>
    </main>
  );
}
