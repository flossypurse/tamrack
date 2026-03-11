import { Suspense } from "react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import {
  TimeSeriesAreaChart,
  TimeSeriesBarChart,
  NeighbourhoodBarChart,
} from "@/components/chart";
import {
  fetchHotNeighbourhoods,
  fetchRecentResidentialDevPermits,
  fetchRedevelopingActivity,
  fetchResidentialPermitTrend,
  fetchTopNeighbourhoodAssessments,
  fetchHomeImprovementHotspots,
  fetchBoCObservations,
  fetchStatCanTimeSeries,
  fetchStrathconaHotSubdivisions,
  fetchStrathconaResidentialPermits,
  fetchStrathconaAssessmentsByArea,
  fetchStAlbertDevPermits,
  fetchStAlbertAssessmentsByNeighbourhood,
  BOC_SERIES,
  STATSCAN_SERIES,
  type ResidentialDevPermit,
  type StrathconaPermit,
  type StAlbertDevPermit,
} from "@/lib/data-sources";
import {
  Home,
  TrendingUp,
  Hammer,
  MapPin,
  FileText,
  Building2,
  Globe,
} from "lucide-react";

// ============================================================
// Key metrics
// ============================================================

async function getRealEstateMetrics() {
  const [hotNeighbourhoods, mortgageData, variableData, cmaUnits, housingStarts] =
    await Promise.all([
      fetchHotNeighbourhoods(15).catch(() => []),
      fetchBoCObservations(BOC_SERIES.MORTGAGE_5Y_FIXED, 1).catch(() => null),
      fetchBoCObservations(BOC_SERIES.MORTGAGE_5Y_VARIABLE, 1).catch(
        () => null
      ),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.EDMONTON_CMA_RES_UNITS.tableId,
        STATSCAN_SERIES.EDMONTON_CMA_RES_UNITS.coordinate,
        1
      ).catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.tableId,
        STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.coordinate,
        2
      ).catch(() => []),
    ]);

  const totalUnits = hotNeighbourhoods.reduce((sum, n) => sum + n.units, 0);
  const totalValue = hotNeighbourhoods.reduce(
    (sum, n) => sum + n.totalValue,
    0
  );
  const topArea = hotNeighbourhoods[0];
  const mortgage5y =
    mortgageData?.observations?.[0]?.[BOC_SERIES.MORTGAGE_5Y_FIXED]?.v;
  const variable =
    variableData?.observations?.[0]?.[BOC_SERIES.MORTGAGE_5Y_VARIABLE]?.v;
  const latestCmaUnits = cmaUnits.at(-1);
  const latestStarts = housingStarts.at(-1);

  return {
    totalUnits: totalUnits.toLocaleString(),
    totalValue: `$${(totalValue / 1_000_000).toFixed(0)}M`,
    topArea: topArea?.neighbourhood || "—",
    topAreaUnits: topArea ? `${topArea.units} units` : "",
    mortgage5y: mortgage5y ? `${mortgage5y}%` : "—",
    mortgageVariable: variable ? `${variable}%` : "—",
    cmaUnits: latestCmaUnits
      ? latestCmaUnits.value.toLocaleString()
      : "—",
    cmaDate: latestCmaUnits?.date
      ? latestCmaUnits.date.slice(0, 7)
      : "",
    housingStarts: latestStarts
      ? latestStarts.value.toLocaleString()
      : "—",
    housingStartsDate: latestStarts?.date
      ? latestStarts.date.slice(0, 7)
      : "",
  };
}

// ============================================================
// Chart sections
// ============================================================

async function KeyMetrics() {
  const m = await getRealEstateMetrics();

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Edmonton New Units YTD"
        value={m.totalUnits}
        source="Edmonton SODA — Building Permits"
      />
      <MetricCard
        title="CMA Dwelling Units"
        value={m.cmaUnits}
        change={m.cmaDate ? `as of ${m.cmaDate}` : undefined}
        source="StatsCan 34-10-0292 (full metro)"
      />
      <MetricCard
        title="Hottest Edmonton Area"
        value={m.topArea}
        change={m.topAreaUnits}
        source="By units permitted in 2025"
      />
      <MetricCard
        title="Construction $ YTD"
        value={m.totalValue}
        source="Edmonton SODA — Building Permits"
      />
      <MetricCard
        title="5Y Fixed Rate"
        value={m.mortgage5y}
        source="Bank of Canada"
      />
      <MetricCard
        title="5Y Variable Rate"
        value={m.mortgageVariable}
        source="Bank of Canada"
      />
      <MetricCard
        title="Housing Starts"
        value={m.housingStarts}
        change={m.housingStartsDate ? `as of ${m.housingStartsDate}` : undefined}
        source="CMHC via StatsCan 34-10-0143"
      />
    </div>
  );
}

// -- Metro-wide charts (StatsCan) --

async function MetroUnitsChart() {
  const { tableId, coordinate } = STATSCAN_SERIES.EDMONTON_CMA_RES_UNITS;
  const data = await fetchStatCanTimeSeries(tableId, coordinate, 36);
  return (
    <Card>
      <CardHeader
        title="Edmonton CMA — Dwelling Units Created"
        subtitle="Monthly, all municipalities (StatsCan 34-10-0292)"
        badge="LIVE"
      />
      <TimeSeriesBarChart data={data} color="#3b82f6" />
    </Card>
  );
}

async function MetroPermitValueChart() {
  const { tableId, coordinate } =
    STATSCAN_SERIES.EDMONTON_CMA_RES_PERMIT_VALUE;
  const data = await fetchStatCanTimeSeries(tableId, coordinate, 36);
  return (
    <Card>
      <CardHeader
        title="Edmonton CMA — Residential Permit Value"
        subtitle="Monthly ($000s), all municipalities"
        badge="LIVE"
      />
      <TimeSeriesAreaChart
        data={data}
        color="#10b981"
        valuePrefix="$"
        compact
      />
    </Card>
  );
}

async function MetroSingleFamilyChart() {
  const { tableId, coordinate } = STATSCAN_SERIES.EDMONTON_CMA_SINGLE_UNITS;
  const data = await fetchStatCanTimeSeries(tableId, coordinate, 36);
  return (
    <Card>
      <CardHeader
        title="Edmonton CMA — Single-Family Units"
        subtitle="Monthly new single-detached dwelling units"
        badge="LIVE"
      />
      <TimeSeriesBarChart data={data} color="#f59e0b" />
    </Card>
  );
}

// -- Edmonton charts --

async function NewUnitsChart() {
  const data = await fetchResidentialPermitTrend();
  return (
    <Card>
      <CardHeader
        title="Edmonton — New Housing Units Permitted"
        subtitle="Monthly total — singles, semis, rowhousing"
        badge="LIVE"
      />
      <TimeSeriesBarChart data={data} color="#3b82f6" />
    </Card>
  );
}

async function HotZonesChart() {
  const data = await fetchHotNeighbourhoods(15);
  return (
    <Card>
      <CardHeader
        title="Edmonton — Where New Homes Are Being Built"
        subtitle="Top 15 neighbourhoods by units permitted in 2025"
        badge="LIVE"
      />
      <NeighbourhoodBarChart
        data={data}
        dataKey="units"
        color="#10b981"
        tooltipLabel="Units"
        height={420}
      />
    </Card>
  );
}

async function ConstructionValueChart() {
  const data = await fetchHotNeighbourhoods(15);
  return (
    <Card>
      <CardHeader
        title="Edmonton — Construction $ by Neighbourhood"
        subtitle="Total residential construction value, 2025"
        badge="LIVE"
      />
      <NeighbourhoodBarChart
        data={data}
        dataKey="totalValue"
        color="#f59e0b"
        valuePrefix="$"
        tooltipLabel="Total Value"
        height={420}
      />
    </Card>
  );
}

async function HighValueAssessmentsChart() {
  const data = await fetchTopNeighbourhoodAssessments(15);
  return (
    <Card>
      <CardHeader
        title="Edmonton — Highest Assessed Neighbourhoods"
        subtitle="Avg residential assessment — owners sitting on equity"
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

async function RedevelopingAreasChart() {
  const data = await fetchRedevelopingActivity();
  return (
    <Card>
      <CardHeader
        title="Edmonton — Redeveloping Neighbourhoods"
        subtitle="Residential dev permits in 'Redeveloping' areas — teardowns & infill"
        badge="LIVE"
      />
      <NeighbourhoodBarChart
        data={data}
        dataKey="permits"
        color="#a855f7"
        tooltipLabel="Permits"
        height={420}
      />
    </Card>
  );
}

async function HomeRenovationChart() {
  const data = await fetchHomeImprovementHotspots();
  return (
    <Card>
      <CardHeader
        title="Edmonton — Home Improvement Hotspots"
        subtitle="Where owners are investing in renovations"
        badge="LIVE"
      />
      <NeighbourhoodBarChart
        data={data}
        dataKey="permits"
        color="#06b6d4"
        tooltipLabel="Permits"
        height={420}
      />
    </Card>
  );
}

async function EdmontonDevPermitsTable() {
  const permits = await fetchRecentResidentialDevPermits(20);
  return (
    <Card>
      <CardHeader
        title="Edmonton — Recent Residential Dev Permits"
        subtitle="Latest approved residential projects"
        badge="LIVE"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-card-border text-muted text-left">
              <th className="pb-2 pr-3 font-medium">Date</th>
              <th className="pb-2 pr-3 font-medium">Neighbourhood</th>
              <th className="pb-2 pr-3 font-medium">Status</th>
              <th className="pb-2 pr-3 font-medium">Address</th>
              <th className="pb-2 font-medium">Description</th>
            </tr>
          </thead>
          <tbody>
            {permits.map((p: ResidentialDevPermit, i: number) => (
              <tr
                key={i}
                className="border-b border-card-border/50 hover:bg-card-border/20"
              >
                <td className="py-2 pr-3 text-muted whitespace-nowrap">
                  {p.date}
                </td>
                <td className="py-2 pr-3 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <span>{p.neighbourhood}</span>
                    {p.neighbourhoodClass === "Redeveloping" && (
                      <span className="text-[9px] bg-purple-500/20 text-purple-400 px-1 py-0.5 rounded">
                        REDEV
                      </span>
                    )}
                    {p.neighbourhoodClass === "Developing" && (
                      <span className="text-[9px] bg-green-500/20 text-green-400 px-1 py-0.5 rounded">
                        NEW
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-2 pr-3 whitespace-nowrap">
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded ${
                      p.status === "Approved"
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

// -- Strathcona County charts --

async function StrathconaSubdivisionsChart() {
  const data = await fetchStrathconaHotSubdivisions();
  return (
    <Card>
      <CardHeader
        title="Strathcona County — Hot Subdivisions"
        subtitle="Residential building permits by subdivision, 2025"
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

async function StrathconaAssessmentsChart() {
  const data = await fetchStrathconaAssessmentsByArea();
  return (
    <Card>
      <CardHeader
        title="Strathcona County — Assessments by Type"
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

async function StrathconaPermitsTable() {
  const permits = await fetchStrathconaResidentialPermits(15);
  return (
    <Card>
      <CardHeader
        title="Strathcona County — Recent Residential Permits"
        subtitle="Latest residential building permits"
        badge="LIVE"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-card-border text-muted text-left">
              <th className="pb-2 pr-3 font-medium">Date</th>
              <th className="pb-2 pr-3 font-medium">Subdivision</th>
              <th className="pb-2 pr-3 font-medium">Value</th>
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
                  ${p.value.toLocaleString()}
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

// -- St. Albert charts --

async function StAlbertAssessmentsChart() {
  const data = await fetchStAlbertAssessmentsByNeighbourhood();
  return (
    <Card>
      <CardHeader
        title="St. Albert — Assessments by Neighbourhood"
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

async function StAlbertDevPermitsTable() {
  const permits = await fetchStAlbertDevPermits(15);
  return (
    <Card>
      <CardHeader
        title="St. Albert — Recent Residential Dev Permits"
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

// -- CMHC Housing charts (StatsCan) --

async function HousingStartsChart() {
  const { tableId, coordinate } = STATSCAN_SERIES.EDMONTON_HOUSING_STARTS;
  const data = await fetchStatCanTimeSeries(tableId, coordinate, 36);
  return (
    <Card>
      <CardHeader
        title="Edmonton CMA — Housing Starts"
        subtitle="Monthly, all dwelling types (CMHC via StatsCan 34-10-0143)"
        badge="LIVE"
      />
      <TimeSeriesBarChart data={data} color="#3b82f6" />
    </Card>
  );
}

async function HousingCompletionsChart() {
  const { tableId, coordinate } = STATSCAN_SERIES.EDMONTON_HOUSING_COMPLETIONS;
  const data = await fetchStatCanTimeSeries(tableId, coordinate, 36);
  return (
    <Card>
      <CardHeader
        title="Edmonton CMA — Housing Completions"
        subtitle="Monthly completions (CMHC via StatsCan 34-10-0145)"
        badge="LIVE"
      />
      <TimeSeriesBarChart data={data} color="#10b981" />
    </Card>
  );
}

async function UnderConstructionChart() {
  const { tableId, coordinate } = STATSCAN_SERIES.EDMONTON_UNDER_CONSTRUCTION;
  const data = await fetchStatCanTimeSeries(tableId, coordinate, 36);
  return (
    <Card>
      <CardHeader
        title="Edmonton CMA — Under Construction"
        subtitle="Units under construction (CMHC via StatsCan 34-10-0147)"
        badge="LIVE"
      />
      <TimeSeriesAreaChart data={data} color="#f59e0b" />
    </Card>
  );
}

// ============================================================
// Prospecting tips
// ============================================================

function ProspectingGuide() {
  return (
    <Card className="border-accent/30">
      <h3 className="text-sm font-medium text-accent mb-3">
        How to Use This Page for Prospecting
      </h3>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs text-muted">
        <div className="space-y-1">
          <p className="text-foreground font-medium">New Construction Zones</p>
          <p>
            Neighbourhoods with high unit counts mean buyers are actively
            entering. New homeowners need agents for their next move. Door-knock
            or mail these areas.
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-foreground font-medium">Redeveloping Areas</p>
          <p>
            Infill and teardowns signal neighbourhood transformation. Existing
            owners may sell to developers. These are listing opportunities.
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-foreground font-medium">High-Value Assessments</p>
          <p>
            Owners in top-assessed areas are sitting on equity. Life events
            (retirement, divorce, upsizing) turn them into sellers. Farm these
            areas consistently.
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-foreground font-medium">Renovation Hotspots</p>
          <p>
            Heavy renovation activity can signal owners preparing to sell, or
            investing in long-term holds. Either way, they&apos;re engaged with
            their home&apos;s value.
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-foreground font-medium">Dev Permit Feed</p>
          <p>
            Fresh development permits are real-time signals. A new multi-unit
            project means future buyers. A teardown means a seller. Act fast on
            these.
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-foreground font-medium">Metro CMA Trends</p>
          <p>
            StatsCan data covers the entire Edmonton metro — Parkland County,
            Spruce Grove, Stony Plain, St. Albert, Strathcona all included.
            Shows the big picture.
          </p>
        </div>
      </div>
    </Card>
  );
}

// ============================================================
// Loading fallbacks
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

export default function RealEstatePage() {
  return (
    <main className="min-h-screen p-6 max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">
          Real Estate Intelligence
        </h1>
        <p className="text-sm text-muted mt-1">
          Where should you be prospecting this week? Live data from Edmonton,
          Strathcona County, St. Albert, and StatsCan (full metro).
        </p>
      </header>

      {/* Prospecting Guide */}
      <ProspectingGuide />

      {/* Key Metrics */}
      <section>
        <Suspense
          fallback={
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {[...Array(6)].map((_, i) => (
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

      {/* Section: Metro-wide (StatsCan CMA) */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Globe size={16} className="text-accent" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Edmonton Metro (CMA) — All Municipalities
          </h2>
        </div>
        <p className="text-xs text-muted mb-3">
          Covers Edmonton, Parkland County, Spruce Grove, Stony Plain, St.
          Albert, Strathcona County, Leduc, and all other CMA municipalities.
        </p>
        <div className="grid lg:grid-cols-3 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <MetroUnitsChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <MetroPermitValueChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <MetroSingleFamilyChart />
          </Suspense>
        </div>
      </section>

      {/* Section: Housing Market (CMHC) */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Home size={16} className="text-blue-400" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Housing Market (CMHC via StatsCan)
          </h2>
        </div>
        <p className="text-xs text-muted mb-3">
          Housing starts, completions, and units under construction for the Edmonton CMA. Sourced from CMHC surveys published through Statistics Canada.
        </p>
        <div className="grid lg:grid-cols-3 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <HousingStartsChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <HousingCompletionsChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <UnderConstructionChart />
          </Suspense>
        </div>
      </section>

      {/* Section: Edmonton Hot Zones */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <MapPin size={16} className="text-accent-green" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Edmonton — Hot Zones
          </h2>
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <HotZonesChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <ConstructionValueChart />
          </Suspense>
        </div>
      </section>

      {/* Section: Edmonton Signals */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Home size={16} className="text-purple-400" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Edmonton — Listing Signals
          </h2>
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <RedevelopingAreasChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <HighValueAssessmentsChart />
          </Suspense>
        </div>
      </section>

      {/* Section: Edmonton Renovation */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Hammer size={16} className="text-cyan-400" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Edmonton — Renovation Activity
          </h2>
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <HomeRenovationChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <NewUnitsChart />
          </Suspense>
        </div>
      </section>

      {/* Section: Edmonton Dev Permits */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <FileText size={16} className="text-accent-amber" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Edmonton — Development Permit Feed
          </h2>
        </div>
        <Suspense fallback={<LoadingTable />}>
          <EdmontonDevPermitsTable />
        </Suspense>
      </section>

      {/* Section: Strathcona County */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Building2 size={16} className="text-orange-400" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Strathcona County (Sherwood Park)
          </h2>
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <StrathconaSubdivisionsChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <StrathconaAssessmentsChart />
          </Suspense>
        </div>
        <div className="mt-4">
          <Suspense fallback={<LoadingTable />}>
            <StrathconaPermitsTable />
          </Suspense>
        </div>
      </section>

      {/* Section: St. Albert */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Building2 size={16} className="text-purple-400" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            St. Albert
          </h2>
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <StAlbertAssessmentsChart />
          </Suspense>
          <Suspense fallback={<LoadingTable />}>
            <StAlbertDevPermitsTable />
          </Suspense>
        </div>
      </section>

      {/* Data coverage note */}
      <Card>
        <h3 className="text-xs font-medium text-muted mb-2">
          Data Coverage Notes
        </h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-[10px] text-muted">
          <div>
            <span className="text-foreground font-medium">Edmonton</span> —
            Full permits, assessments, dev permits via SODA API
          </div>
          <div>
            <span className="text-foreground font-medium">
              Strathcona County
            </span>{" "}
            — Building permits + assessments via ArcGIS
          </div>
          <div>
            <span className="text-foreground font-medium">St. Albert</span> —
            Dev permits (weekly) + assessments via ArcGIS
          </div>
          <div>
            <span className="text-foreground font-medium">
              Edmonton CMA (StatsCan)
            </span>{" "}
            — All municipalities, monthly aggregate
          </div>
          <div>
            <span className="text-foreground font-medium">CMHC Housing</span> —
            Starts, completions, under construction via StatsCan
          </div>
          <div>
            <span className="text-muted/60">Parkland County</span> — No permit
            data available (GIS layers only)
          </div>
          <div>
            <span className="text-muted/60">Spruce Grove / Stony Plain</span>{" "}
            — No open data portals
          </div>
        </div>
      </Card>

      {/* Footer */}
      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Alberta Pulse Check — Real Estate Intelligence — Data refreshed hourly — All
        sources free &amp; public
      </footer>
    </main>
  );
}
