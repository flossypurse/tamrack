import type { Metadata } from "next";
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
  fetchEdmontonRoadConstruction,
  fetchRoadConstructionByType,
  fetchAlbertaMillRates,
  fetchMajorProjects,
  fetchMajorProjectsBySector,
  BOC_SERIES,
  STATSCAN_SERIES,
  type ResidentialDevPermit,
  type StrathconaPermit,
  type StAlbertDevPermit,
  type RoadConstructionProject,
  type MillRateEntry,
  type MajorProject,
} from "@/lib/data-sources";
import {
  Home,
  Hammer,
  MapPin,
  FileText,
  Building2,
  Globe,
  DollarSign,
  Construction,
  Landmark,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";

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

// -- Rental Market (CMHC via StatsCan) --

async function RentalVacancyMetrics() {
  const [vacancyData, bachelor, oneBed, twoBed, threeBed] = await Promise.all([
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.EDMONTON_VACANCY_RATE.tableId,
      STATSCAN_SERIES.EDMONTON_VACANCY_RATE.coordinate,
      10
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.EDMONTON_RENT_BACHELOR.tableId,
      STATSCAN_SERIES.EDMONTON_RENT_BACHELOR.coordinate,
      10
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.EDMONTON_RENT_1BED.tableId,
      STATSCAN_SERIES.EDMONTON_RENT_1BED.coordinate,
      10
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.EDMONTON_RENT_2BED.tableId,
      STATSCAN_SERIES.EDMONTON_RENT_2BED.coordinate,
      10
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.EDMONTON_RENT_3BED.tableId,
      STATSCAN_SERIES.EDMONTON_RENT_3BED.coordinate,
      10
    ).catch(() => []),
  ]);

  const latestVacancy = vacancyData.at(-1);
  const prevVacancy = vacancyData.at(-2);
  const latestBachelor = bachelor.at(-1);
  const latest1Bed = oneBed.at(-1);
  const latest2Bed = twoBed.at(-1);
  const latest3Bed = threeBed.at(-1);

  const vacancyTrend =
    latestVacancy && prevVacancy
      ? latestVacancy.value > prevVacancy.value
        ? "rising"
        : "falling"
      : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          title="Vacancy Rate"
          value={latestVacancy ? `${latestVacancy.value.toFixed(1)}%` : "—"}
          change={
            vacancyTrend
              ? `${vacancyTrend} (was ${prevVacancy?.value.toFixed(1)}%)`
              : undefined
          }
          source={`CMHC Oct ${latestVacancy?.date?.slice(0, 4) || ""} Survey`}
        />
        <MetricCard
          title="Bachelor Rent"
          value={latestBachelor ? `$${Math.round(latestBachelor.value).toLocaleString()}` : "—"}
          source="CMHC avg rent, apt 3+ units"
        />
        <MetricCard
          title="1-Bedroom Rent"
          value={latest1Bed ? `$${Math.round(latest1Bed.value).toLocaleString()}` : "—"}
          source="CMHC avg rent, apt 3+ units"
        />
        <MetricCard
          title="2-Bedroom Rent"
          value={latest2Bed ? `$${Math.round(latest2Bed.value).toLocaleString()}` : "—"}
          source="CMHC avg rent, apt 3+ units"
        />
        <MetricCard
          title="3-Bedroom Rent"
          value={latest3Bed ? `$${Math.round(latest3Bed.value).toLocaleString()}` : "—"}
          source="CMHC avg rent, apt 3+ units"
        />
      </div>
      <Card>
        <CardHeader
          title="Edmonton CMA — Rental Vacancy Rate (October Survey)"
          subtitle="Apartment structures of 6+ units, privately initiated"
          badge="LIVE"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-card-border text-muted text-left">
                <th className="pb-2 pr-3 font-medium">Year</th>
                <th className="pb-2 pr-3 font-medium text-right">Vacancy %</th>
                <th className="pb-2 pr-3 font-medium text-right">Bachelor</th>
                <th className="pb-2 pr-3 font-medium text-right">1-Bed</th>
                <th className="pb-2 pr-3 font-medium text-right">2-Bed</th>
                <th className="pb-2 font-medium text-right">3-Bed</th>
              </tr>
            </thead>
            <tbody>
              {vacancyData
                .slice(-8)
                .reverse()
                .map((v, i) => {
                  const year = v.date?.slice(0, 4);
                  const bRent = bachelor.find((r) => r.date?.slice(0, 4) === year);
                  const r1 = oneBed.find((r) => r.date?.slice(0, 4) === year);
                  const r2 = twoBed.find((r) => r.date?.slice(0, 4) === year);
                  const r3 = threeBed.find((r) => r.date?.slice(0, 4) === year);
                  return (
                    <tr
                      key={i}
                      className="border-b border-card-border/50 hover:bg-card-border/20"
                    >
                      <td className="py-2 pr-3 font-medium">{year}</td>
                      <td className="py-2 pr-3 text-right">
                        <span
                          className={
                            v.value < 3
                              ? "text-red-400"
                              : v.value < 5
                                ? "text-accent-amber"
                                : "text-accent-green"
                          }
                        >
                          {v.value.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-right text-muted">
                        {bRent ? `$${Math.round(bRent.value).toLocaleString()}` : "—"}
                      </td>
                      <td className="py-2 pr-3 text-right text-muted">
                        {r1 ? `$${Math.round(r1.value).toLocaleString()}` : "—"}
                      </td>
                      <td className="py-2 pr-3 text-right text-muted">
                        {r2 ? `$${Math.round(r2.value).toLocaleString()}` : "—"}
                      </td>
                      <td className="py-2 text-right text-muted">
                        {r3 ? `$${Math.round(r3.value).toLocaleString()}` : "—"}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-muted/60 mt-3">
          Low vacancy (&lt;3%) = landlord&apos;s market, strong rental demand. High vacancy (&gt;5%) = tenant&apos;s market, potential rent declines. Source: CMHC Rental Market Survey via StatsCan 34-10-0127 &amp; 34-10-0133.
        </p>
      </Card>
    </div>
  );
}

// -- Mill Rates comparison --

async function MillRatesTable() {
  const rates = await fetchAlbertaMillRates();
  if (!rates.length) return null;

  return (
    <Card>
      <CardHeader
        title="Edmonton Metro — Municipal Mill Rates"
        subtitle="Property tax rates per $1,000 of assessed value (2024)"
        badge="LIVE"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-card-border text-muted text-left">
              <th className="pb-2 pr-3 font-medium">Municipality</th>
              <th className="pb-2 pr-3 font-medium">Type</th>
              <th className="pb-2 pr-3 font-medium text-right">Residential</th>
              <th className="pb-2 pr-3 font-medium text-right">Non-Residential</th>
              <th className="pb-2 font-medium text-right">Farmland</th>
            </tr>
          </thead>
          <tbody>
            {rates.map((r: MillRateEntry, i: number) => (
              <tr
                key={i}
                className="border-b border-card-border/50 hover:bg-card-border/20"
              >
                <td className="py-2 pr-3 font-medium">{r.municipality}</td>
                <td className="py-2 pr-3 text-muted text-[10px]">{r.status}</td>
                <td className="py-2 pr-3 text-right">
                  <span
                    className={
                      r.residential < 5
                        ? "text-accent-green"
                        : r.residential < 7
                          ? "text-accent-amber"
                          : "text-red-400"
                    }
                  >
                    {r.residential.toFixed(4)}
                  </span>
                </td>
                <td className="py-2 pr-3 text-right text-muted">
                  {r.nonResidential.toFixed(4)}
                </td>
                <td className="py-2 text-right text-muted">
                  {r.farmland > 0 ? r.farmland.toFixed(4) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted/60 mt-3">
        Lower mill rate = lower property tax for same assessed value. A $500K home at 4.68 mills = $2,340/yr tax; at 7.66 mills = $3,830/yr. Source: Alberta Municipal Affairs, 2024 Financial Year.
      </p>
    </Card>
  );
}

// -- Road Construction --

async function RoadConstructionTable() {
  const projects = await fetchEdmontonRoadConstruction(25);
  if (!projects.length) return null;

  return (
    <Card>
      <CardHeader
        title="Edmonton — Active Road & Infrastructure Construction"
        subtitle="Major on-street construction permits — new roads, LRT, bridges, drainage"
        badge="LIVE"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-card-border text-muted text-left">
              <th className="pb-2 pr-3 font-medium">Type</th>
              <th className="pb-2 pr-3 font-medium">Street</th>
              <th className="pb-2 pr-3 font-medium">Limits</th>
              <th className="pb-2 pr-3 font-medium">Start</th>
              <th className="pb-2 font-medium">End</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p: RoadConstructionProject, i: number) => (
              <tr
                key={i}
                className="border-b border-card-border/50 hover:bg-card-border/20"
              >
                <td className="py-2 pr-3 whitespace-nowrap">
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded ${
                      p.workReason.includes("LRT")
                        ? "bg-purple-500/20 text-purple-400"
                        : p.workReason.includes("BRIDGE")
                          ? "bg-blue-500/20 text-blue-400"
                          : p.workReason.includes("NEW")
                            ? "bg-accent-green/20 text-accent-green"
                            : "bg-accent-amber/20 text-accent-amber"
                    }`}
                  >
                    {p.workReason.replace("ROAD CONSTRUCTION ", "").replace("TRAFFIC SIGNAL ", "SIG ")}
                  </span>
                </td>
                <td className="py-2 pr-3 whitespace-nowrap font-mono text-[10px]">
                  {p.street}
                </td>
                <td className="py-2 pr-3 text-muted max-w-xs truncate text-[10px]">
                  {p.intersections}
                </td>
                <td className="py-2 pr-3 text-muted whitespace-nowrap">
                  {p.startDate}
                </td>
                <td className="py-2 text-muted whitespace-nowrap">{p.finishDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted/60 mt-3">
        Infrastructure construction precedes property value increases. New roads and LRT lines drive demand in adjacent neighbourhoods. Source: City of Edmonton On-Street Construction Permits.
      </p>
    </Card>
  );
}

async function RoadConstructionSummary() {
  const byType = await fetchRoadConstructionByType();
  if (!byType.length) return null;

  return (
    <Card>
      <CardHeader
        title="Edmonton — Construction Permits by Type"
        subtitle="All active on-street construction and maintenance permits"
        badge="LIVE"
      />
      <NeighbourhoodBarChart
        data={byType}
        dataKey="count"
        labelKey="type"
        color="#f59e0b"
        tooltipLabel="Permits"
        height={Math.max(250, byType.length * 28)}
      />
    </Card>
  );
}

// -- Major Projects --

async function MajorProjectsTable() {
  const edmontonMetro = [
    "Edmonton",
    "St. Albert",
    "Spruce Grove",
    "Stony Plain",
    "Strathcona",
    "Sherwood Park",
    "Parkland",
    "Leduc",
    "Beaumont",
    "Fort Saskatchewan",
  ];
  const projects = await fetchMajorProjects(edmontonMetro);
  const topProjects = projects.slice(0, 20);
  const bySector = await fetchMajorProjectsBySector(edmontonMetro);

  const totalValue = projects.reduce((s, p) => s + p.cost, 0);
  const underConstruction = projects.filter(
    (p) => p.stage === "Under Construction" || p.stage === "Construction"
  ).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Metro Projects"
          value={projects.length.toString()}
          source="Alberta Major Projects ($5M+)"
        />
        <MetricCard
          title="Total Investment"
          value={`$${(totalValue / 1000).toFixed(1)}B`}
          source="Combined project value"
        />
        <MetricCard
          title="Under Construction"
          value={underConstruction.toString()}
          source="Active build phase"
        />
        <MetricCard
          title="Sectors"
          value={bySector.length.toString()}
          source="Distinct industry sectors"
        />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader
            title="Investment by Sector"
            subtitle="Edmonton metro area — total project value ($M)"
            badge="LIVE"
          />
          <NeighbourhoodBarChart
            data={bySector.map((s) => ({
              neighbourhood: `${s.sector} (${s.count})`,
              value: s.totalCost,
            }))}
            dataKey="value"
            color="#8b5cf6"
            valuePrefix="$"
            valueSuffix="M"
            tooltipLabel="Total $M"
            height={Math.max(250, bySector.length * 32)}
          />
        </Card>
        <Card>
          <CardHeader
            title="Top 20 Projects by Value"
            subtitle="Edmonton metro — largest active & planned projects"
            badge="LIVE"
          />
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-card-border text-muted text-left">
                  <th className="pb-2 pr-3 font-medium">Project</th>
                  <th className="pb-2 pr-3 font-medium text-right">$M</th>
                  <th className="pb-2 pr-3 font-medium">Stage</th>
                  <th className="pb-2 font-medium">Sector</th>
                </tr>
              </thead>
              <tbody>
                {topProjects.map((p: MajorProject, i: number) => (
                  <tr
                    key={i}
                    className="border-b border-card-border/50 hover:bg-card-border/20"
                  >
                    <td className="py-2 pr-3 max-w-[200px] truncate" title={p.name}>
                      {p.name}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono text-accent-green">
                      ${p.cost.toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded ${
                          p.stage === "Under Construction" || p.stage === "Construction"
                            ? "bg-accent-green/20 text-accent-green"
                            : p.stage === "Proposed"
                              ? "bg-accent-amber/20 text-accent-amber"
                              : "bg-blue-500/20 text-blue-400"
                        }`}
                      >
                        {p.stage}
                      </span>
                    </td>
                    <td className="py-2 text-muted text-[10px]">{p.sector}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-muted/60 mt-3">
            Source: Alberta Major Projects Inventory. Projects valued at $5M+. Values in millions CAD.
          </p>
        </Card>
      </div>
    </div>
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
        title="Strathcona County — Recent Development Permits"
        subtitle="Latest residential development permits"
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

export const metadata: Metadata = {
  title: "Alberta Real Estate Intelligence",
  description: "Province-wide real estate intelligence — permit hotspots, assessment trends, and teardown detection across Edmonton, Calgary, and 20+ Alberta municipalities.",
};

export default function RealEstatePage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Real Estate Intelligence"
        description="Where should you be prospecting this week? Live data from Edmonton, Calgary, Strathcona County, St. Albert, and 20+ municipalities."
        category="realestate"
        icon={<Home size={20} />}
      >
        <p className="text-sm text-muted">
          See{" "}
          <a href="/real-estate/prospects" className="text-accent hover:underline">Prospect Leads</a>{" "}
          for province-wide actionable leads.
        </p>
      </PageHeader>

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
        <SectionHeader title="Edmonton Metro (CMA) — All Municipalities" icon={<Globe size={16} />} category="realestate" />
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
        <SectionHeader title="Housing Market (CMHC via StatsCan)" icon={<Home size={16} />} category="realestate" />
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

      {/* Section: Rental Market */}
      <section>
        <SectionHeader title="Rental Market (CMHC Survey)" icon={<Home size={16} />} category="realestate" />
        <p className="text-xs text-muted mb-3">
          Annual October survey — vacancy rates and average rents for the Edmonton CMA.
          Low vacancy (&lt;3%) means strong rental demand; rising vacancy signals softening.
        </p>
        <Suspense fallback={<LoadingTable />}>
          <RentalVacancyMetrics />
        </Suspense>
      </section>

      {/* Section: Mill Rates */}
      <section>
        <SectionHeader title="Property Tax Rates — Mill Rate Comparison" icon={<DollarSign size={16} />} category="realestate" />
        <p className="text-xs text-muted mb-3">
          Compare property tax rates across Edmonton metro municipalities. Lower mill rate = lower tax for same assessed value.
        </p>
        <Suspense fallback={<LoadingTable />}>
          <MillRatesTable />
        </Suspense>
      </section>

      {/* Section: Road Construction */}
      <section>
        <SectionHeader title="Edmonton — Road & Infrastructure Construction" icon={<Construction size={16} />} category="realestate" />
        <p className="text-xs text-muted mb-3">
          Active on-street construction permits. Infrastructure spend precedes property value increases — new roads and LRT lines drive demand in adjacent areas.
        </p>
        <div className="grid lg:grid-cols-2 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <RoadConstructionSummary />
          </Suspense>
          <Suspense fallback={<LoadingTable />}>
            <RoadConstructionTable />
          </Suspense>
        </div>
      </section>

      {/* Section: Major Projects */}
      <section>
        <SectionHeader title="Edmonton Metro — Major Projects ($5M+)" icon={<Landmark size={16} />} category="realestate" />
        <p className="text-xs text-muted mb-3">
          Alberta&apos;s inventory of major capital projects. New hospitals, schools, LRT lines, and industrial facilities
          drive local housing demand — a new project announcement signals future area growth.
        </p>
        <Suspense fallback={<LoadingTable />}>
          <MajorProjectsTable />
        </Suspense>
      </section>

      {/* Section: Edmonton Hot Zones */}
      <section>
        <SectionHeader title="Edmonton — Hot Zones" icon={<MapPin size={16} />} category="realestate" />
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
        <SectionHeader title="Edmonton — Listing Signals" icon={<Home size={16} />} category="realestate" />
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
        <SectionHeader title="Edmonton — Renovation Activity" icon={<Hammer size={16} />} category="realestate" />
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
        <SectionHeader title="Edmonton — Development Permit Feed" icon={<FileText size={16} />} category="realestate" />
        <Suspense fallback={<LoadingTable />}>
          <EdmontonDevPermitsTable />
        </Suspense>
      </section>

      {/* Section: Strathcona County */}
      <section>
        <SectionHeader title="Strathcona County (Sherwood Park)" icon={<Building2 size={16} />} category="realestate" />
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
        <SectionHeader title="St. Albert" icon={<Building2 size={16} />} category="realestate" />
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
            Permits, assessments, dev permits, road construction via SODA API
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
              CMHC Rental
            </span>{" "}
            — Vacancy rates + avg rents (annual Oct survey) via StatsCan
          </div>
          <div>
            <span className="text-foreground font-medium">CMHC Housing</span> —
            Starts, completions, under construction via StatsCan
          </div>
          <div>
            <span className="text-foreground font-medium">Mill Rates</span> —
            12 Edmonton metro municipalities via Alberta Municipal Affairs
          </div>
          <div>
            <span className="text-foreground font-medium">Major Projects</span> —
            $5M+ projects via Alberta Major Projects API
          </div>
          <div>
            <span className="text-foreground font-medium">Road Construction</span> —
            Active permits via Edmonton SODA
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
