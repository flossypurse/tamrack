import { Suspense } from "react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import { NeighbourhoodBarChart } from "@/components/chart";
import {
  fetchSpruceGroveAddressesBySubdivision,
  fetchSpruceGroveByPropertyType,
  fetchSpruceGroveZoning,
  fetchSprucGroveDevelopmentStages,
  fetchSpruceGroveAddressCount,
  fetchSpruceGroveVacantParcels,
  type SpruceGroveDevelopmentStage,
} from "@/lib/data-sources";
import { Building2, Home, MapPin, HardHat, TreePine } from "lucide-react";

// ============================================================
// Key metrics
// ============================================================

async function KeyMetrics() {
  const [addressCount, subdivisions, propertyTypes, vacantParcels] =
    await Promise.all([
      fetchSpruceGroveAddressCount().catch(() => 0),
      fetchSpruceGroveAddressesBySubdivision().catch(() => []),
      fetchSpruceGroveByPropertyType().catch(() => []),
      fetchSpruceGroveVacantParcels().catch(() => []),
    ]);

  const totalSubdivisions = subdivisions.length;
  const topSubdivision = subdivisions[0];
  const vacantTotal = vacantParcels.reduce((s, v) => s + v.count, 0);
  const residentialTypes = propertyTypes.filter(
    (t) =>
      t.type.includes("RESIDENTIAL") ||
      t.type.includes("CONDOMINIUM")
  );
  const residentialCount = residentialTypes.reduce((s, t) => s + t.count, 0);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Total Addresses"
        value={addressCount.toLocaleString()}
        source="Spruce Grove ArcGIS"
      />
      <MetricCard
        title="Neighbourhoods"
        value={String(totalSubdivisions)}
        source="Distinct subdivisions"
      />
      <MetricCard
        title="Residential Properties"
        value={residentialCount.toLocaleString()}
        source="SFR + multi-family + condo"
      />
      <MetricCard
        title="Vacant Parcels"
        value={vacantTotal.toLocaleString()}
        source="Development opportunities"
      />
    </div>
  );
}

// ============================================================
// Charts
// ============================================================

async function SubdivisionChart() {
  const data = await fetchSpruceGroveAddressesBySubdivision();
  const chartData = data.slice(0, 20).map((d) => ({
    neighbourhood: d.subdivision,
    permits: d.count,
  }));
  return (
    <Card>
      <CardHeader
        title="Addresses by Subdivision"
        subtitle="Top 20 neighbourhoods by address count"
        badge="LIVE"
      />
      <NeighbourhoodBarChart
        data={chartData}
        dataKey="permits"
        color="#3b8fdb"
        tooltipLabel="Addresses"
        height={520}
      />
    </Card>
  );
}

async function PropertyTypeChart() {
  const data = await fetchSpruceGroveByPropertyType();
  const chartData = data.slice(0, 15).map((d) => ({
    neighbourhood: d.type,
    permits: d.count,
  }));
  return (
    <Card>
      <CardHeader
        title="Properties by Assessment Type"
        subtitle="Property classification distribution"
        badge="LIVE"
      />
      <NeighbourhoodBarChart
        data={chartData}
        dataKey="permits"
        color="#3b82f6"
        tooltipLabel="Properties"
        height={520}
      />
    </Card>
  );
}

async function ZoningChart() {
  const data = await fetchSpruceGroveZoning();
  const chartData = data.slice(0, 20).map((d) => ({
    neighbourhood: `${d.zoneClass} (${d.zoneDesc.slice(0, 25)})`,
    permits: d.count,
  }));
  return (
    <Card>
      <CardHeader
        title="Zoning Districts"
        subtitle="Zone count by classification"
        badge="LIVE"
      />
      <NeighbourhoodBarChart
        data={chartData}
        dataKey="permits"
        color="#f59e0b"
        tooltipLabel="Zones"
        height={420}
      />
    </Card>
  );
}

async function VacantParcelsChart() {
  const data = await fetchSpruceGroveVacantParcels();
  const chartData = data.map((d) => ({
    neighbourhood: d.subdivision,
    permits: d.count,
  }));
  if (chartData.length === 0) return null;
  return (
    <Card>
      <CardHeader
        title="Vacant Parcels by Type"
        subtitle="Development-ready parcels"
        badge="LIVE"
      />
      <NeighbourhoodBarChart
        data={chartData}
        dataKey="permits"
        color="#ec4899"
        tooltipLabel="Vacant"
        height={420}
      />
    </Card>
  );
}

async function DevelopmentStagesTable() {
  const stages = await fetchSprucGroveDevelopmentStages();
  const recent = stages.filter((s) => s.year >= 2018).slice(0, 25);
  if (recent.length === 0) return null;
  return (
    <Card>
      <CardHeader
        title="Development Stages"
        subtitle="Registered development stages with lot counts"
        badge="LIVE"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-card-border text-muted text-left">
              <th className="pb-2 pr-3 font-medium">Name</th>
              <th className="pb-2 pr-3 font-medium">Developer</th>
              <th className="pb-2 pr-3 font-medium">Res. Lots</th>
              <th className="pb-2 pr-3 font-medium">Total Lots</th>
              <th className="pb-2 pr-3 font-medium">Year</th>
              <th className="pb-2 font-medium">Plan</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((s: SpruceGroveDevelopmentStage, i: number) => (
              <tr
                key={i}
                className="border-b border-card-border/50 hover:bg-card-border/20"
              >
                <td className="py-2 pr-3 whitespace-nowrap">{s.name}</td>
                <td className="py-2 pr-3 text-muted whitespace-nowrap">
                  {s.developer}
                </td>
                <td className="py-2 pr-3 text-accent-green">
                  {s.residentialLots > 0 ? s.residentialLots : "—"}
                </td>
                <td className="py-2 pr-3 text-muted">
                  {s.totalLots > 0 ? s.totalLots : "—"}
                </td>
                <td className="py-2 pr-3 text-muted">
                  {s.year > 0 ? s.year : "—"}
                </td>
                <td className="py-2 text-muted font-mono text-[10px]">
                  {s.plan}
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

export default function SpruceGrovePage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <TreePine size={22} className="text-teal-400" />
          Spruce Grove
        </h1>
        <p className="text-sm text-muted mt-1">
          Property types, neighbourhoods, zoning, development stages, and vacant
          parcels. 22,000+ addresses with subdivision and assessment type data.
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

      {/* Neighbourhoods */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Home size={16} className="text-teal-400" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Neighbourhoods & Property Types
          </h2>
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <SubdivisionChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <PropertyTypeChart />
          </Suspense>
        </div>
      </section>

      {/* Zoning & Vacant */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <MapPin size={16} className="text-amber-400" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Zoning & Development Opportunities
          </h2>
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <ZoningChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <VacantParcelsChart />
          </Suspense>
        </div>
      </section>

      {/* Development Stages */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <HardHat size={16} className="text-blue-400" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Development Stages
          </h2>
        </div>
        <Suspense fallback={<LoadingTable />}>
          <DevelopmentStagesTable />
        </Suspense>
      </section>

      {/* Data coverage */}
      <Card>
        <h3 className="text-xs font-medium text-muted mb-2">
          Data Sources
        </h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-[10px] text-muted">
          <div>
            <span className="text-foreground font-medium">Addresses</span> —
            22,094 site addresses with assessment types, building types, subdivisions via ArcGIS FeatureServer
          </div>
          <div>
            <span className="text-foreground font-medium">Zoning</span> —
            1,047 zoning districts with 39 zone types via ArcGIS MapServer
          </div>
          <div>
            <span className="text-foreground font-medium">Development</span> —
            257 registered development stages with lot counts, developers, years
          </div>
          <div>
            <span className="text-foreground font-medium">Parcels</span> —
            15,893 parcels with vacancy flags and property types
          </div>
          <div>
            <span className="text-foreground font-medium">Missing</span> —
            No dollar-value assessments or building permits via API (permits are in monthly PDFs)
          </div>
          <div>
            <span className="text-foreground font-medium">Also Available</span> —
            Flood zones with risk scores, utility infrastructure, environmental site assessments
          </div>
        </div>
      </Card>

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Alberta Pulse Check — Spruce Grove — Data from City of Spruce Grove ArcGIS
      </footer>
    </main>
  );
}
