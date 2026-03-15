import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Card, CardHeader, MetricCard } from "@/components/card";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import { NeighbourhoodBarChart } from "@/components/chart";
import { ChartCard } from "@/components/chart-card";
import { computeTimeRange } from "@/lib/time-range";
import {
  getMunicipality,
  getLiveMunicipalities,
} from "@/lib/municipality-registry";
import {
  fetchAssessmentsByGroup,
  fetchTopProperties,
  fetchMunicipalityMetrics,
  fetchBusinessCategories,
  fetchVacantLots,
  fetchConstructionProjects,
  fetchPermitsByGroup,
  type TopProperty,
  type ConstructionProject,
} from "@/lib/municipality-data";
import { fetchAllRegionalData, type RegionalDashboardRecord } from "@/lib/data-sources";
import { countPlaceTypes } from "@/lib/data-sources-google";
import {
  Building2, Home, Store, HardHat, MapPin, FileText, BarChart3,
  UtensilsCrossed, GraduationCap, Hospital, Pill, ShoppingCart,
  Fuel, Landmark, Dumbbell, Trees, BookOpen, Info, Database,
} from "lucide-react";

// Generate static paths for all live municipalities
export function generateStaticParams() {
  return getLiveMunicipalities().map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const config = getMunicipality(slug);
  if (!config) return { title: "Municipality Not Found" };
  const title = `${config.name} Economic Data & Development Activity`;
  const description = `${config.description} Live building permits, property assessments, business activity, and development data for ${config.name}, Alberta.`;
  return {
    title,
    description,
    openGraph: {
      title: `${title} | Alberta Pulse Check`,
      description,
      url: `https://albertapulsecheck.ca/municipalities/${slug}`,
      type: "website",
      images: [
        {
          url: `/api/og?title=${encodeURIComponent(config.name)}&subtitle=${encodeURIComponent("Economic Data & Development Activity")}&type=municipality`,
          width: 1200,
          height: 630,
          alt: `${config.name} economic data — Alberta Pulse Check`,
        },
      ],
    },
  };
}

// ============================================================
// Key Metrics (server component)
// ============================================================

async function KeyMetrics({ slug }: { slug: string }) {
  const config = getMunicipality(slug)!;
  const isRegionalOnly = config.capabilities.length === 0;

  // For regional-only municipalities, pull key metrics from the provincial dashboard
  if (isRegionalOnly) {
    return <RegionalKeyMetrics slug={slug} />;
  }

  const metrics = await fetchMunicipalityMetrics(config);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Total Parcels"
        value={metrics.totalParcels > 0 ? metrics.totalParcels.toLocaleString() : "—"}
        source={config.dataSource}
      />
      <MetricCard
        title="Avg Assessment"
        value={metrics.avgAssessment > 0 ? `$${metrics.avgAssessment.toLocaleString()}` : "—"}
        source="Assessed properties"
      />
      {metrics.vacantCount > 0 && (
        <MetricCard
          title="Vacant Lots"
          value={metrics.vacantCount.toLocaleString()}
          source="Development opportunities"
        />
      )}
      {metrics.businessCount > 0 && (
        <MetricCard
          title="Businesses"
          value={metrics.businessCount.toLocaleString()}
          change={`Top zone: ${metrics.topZoning}`}
          source="Business registry"
        />
      )}
      {metrics.vacantCount === 0 && metrics.businessCount === 0 && (
        <>
          <MetricCard
            title="Assessed Properties"
            value={metrics.totalAssessed > 0 ? metrics.totalAssessed.toLocaleString() : "—"}
            source="With zoning data"
          />
          <MetricCard
            title="Top Zone"
            value={metrics.topZoning}
            source="Most properties"
          />
        </>
      )}
    </div>
  );
}

// ============================================================
// Regional Key Metrics — for municipalities without direct ArcGIS
// endpoints. Pulls from the Alberta Regional Dashboard
// (regionaldashboard.alberta.ca) which covers 54 indicators
// for all ~340 Alberta municipalities.
// ============================================================

async function RegionalKeyMetrics({ slug }: { slug: string }) {
  const config = getMunicipality(slug)!;
  const lookupName = config.name
    .replace(" (Fort McMurray)", "")
    .replace("Sturgeon County", "Sturgeon")
    .replace("Leduc County", "Leduc County");

  const regional = await fetchAllRegionalData(lookupName);

  const latestVal = (records: RegionalDashboardRecord[], category?: string) => {
    const latest = new Map<string, { value: number; year: string }>();
    for (const r of records) {
      const cat = String(r.Category || "Total");
      const year = String(r.Period || "");
      const val = Number(r.OriginalValue) || 0;
      const existing = latest.get(cat);
      if (!existing || year > existing.year) {
        latest.set(cat, { value: val, year });
      }
    }
    const target = category || "Total";
    return latest.get(target) || null;
  };

  const population = config.population;
  const totalAssessment = latestVal(regional.assessments, "Total");
  const totalPermits = latestVal(regional.buildingPermits, "Total") || latestVal(regional.buildingPermits, "Residential");
  const rent2br = latestVal(regional.averageRent, "2 Bedroom");
  const vacancy = latestVal(regional.vacancyRates, "Total") || latestVal(regional.vacancyRates, "Overall");
  const totalStarts = latestVal(regional.housingStarts, "Total");
  const income = latestVal(regional.medianIncome);
  const taxRate = latestVal(regional.taxRates);

  return (
    <>
      {/* Data availability notice */}
      <Card className="border-accent-amber/30 bg-accent-amber/[0.03]">
        <div className="flex items-start gap-3">
          <Info size={16} className="text-accent-amber shrink-0 mt-0.5" />
          <div className="text-xs text-muted space-y-1">
            <p className="text-foreground font-medium">Regional dashboard data only</p>
            <p>
              {config.name} does not publish a public ArcGIS or open data API for property assessments,
              permits, or business licences. The metrics below come from the{" "}
              <span className="text-foreground">Alberta Regional Dashboard</span> — a province-wide dataset
              maintained by the Government of Alberta covering 54 socioeconomic indicators for all ~340 municipalities.
            </p>
            <p>
              This means you get aggregate figures (total assessment base, building permit counts, median income)
              but not parcel-level detail like individual property values, zoning breakdowns, or business registries.
              For parcel-level data, see municipalities with direct API endpoints like{" "}
              <a href="/m/edmonton" className="text-accent hover:underline">Edmonton</a>,{" "}
              <a href="/m/calgary" className="text-accent hover:underline">Calgary</a>, or{" "}
              <a href="/m/stony-plain" className="text-accent hover:underline">Stony Plain</a>.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {population && (
          <MetricCard
            title="Population"
            value={`~${population.toLocaleString()}`}
            source="Census / municipal estimate"
          />
        )}
        {totalAssessment && (
          <MetricCard
            title="Equalized Assessment"
            value={`$${(totalAssessment.value / 1_000_000).toFixed(0)}M`}
            change={totalAssessment.year}
            source="AB Regional Dashboard"
          />
        )}
        {totalPermits && (
          <MetricCard
            title="Building Permits"
            value={totalPermits.value.toLocaleString()}
            change={totalPermits.year}
            source="AB Regional Dashboard"
          />
        )}
        {rent2br && (
          <MetricCard
            title="Avg Rent (2BR)"
            value={`$${rent2br.value.toLocaleString()}`}
            change={rent2br.year}
            source="AB Regional Dashboard"
          />
        )}
        {vacancy && (
          <MetricCard
            title="Vacancy Rate"
            value={`${vacancy.value.toFixed(1)}%`}
            change={vacancy.year}
            source="AB Regional Dashboard"
          />
        )}
        {totalStarts && (
          <MetricCard
            title="Housing Starts"
            value={totalStarts.value.toLocaleString()}
            change={totalStarts.year}
            source="AB Regional Dashboard"
          />
        )}
        {income && (
          <MetricCard
            title="Median Income"
            value={`$${income.value.toLocaleString()}`}
            change={income.year}
            source="AB Regional Dashboard"
          />
        )}
        {taxRate && (
          <MetricCard
            title="Mill Rate"
            value={taxRate.value.toFixed(4)}
            change={taxRate.year}
            source="AB Regional Dashboard"
          />
        )}
      </div>
    </>
  );
}

// ============================================================
// Assessment Charts
// ============================================================

async function AssessmentsByZoningChart({ slug }: { slug: string }) {
  const config = getMunicipality(slug)!;
  const data = await fetchAssessmentsByGroup(config, "zoning");
  if (data.length === 0) return null;

  const chartData = data.slice(0, 15).map((d) => ({
    neighbourhood: d.group,
    avgValue: d.avgAssessment,
  }));

  return (
    <ChartCard chartId={`${slug}-assessment-by-zone`} title={`${config.name} — Avg Assessment by Zone`} source={config.dataSource}>
      <Card>
        <CardHeader
          title="Avg Assessment by Zone"
          subtitle={`Average property value per zoning district — zoning codes are set by ${config.name}'s land use bylaw and determine what can be built on each parcel`}
          badge="LIVE"
          freshness="daily"
        />
        <NeighbourhoodBarChart
          data={chartData}
          dataKey="avgValue"
          color={config.color}
          valuePrefix="$"
          tooltipLabel="Avg Assessment"
          height={Math.max(250, data.slice(0, 15).length * 28)}
        />
      </Card>
    </ChartCard>
  );
}

async function AssessmentCountChart({ slug }: { slug: string }) {
  const config = getMunicipality(slug)!;
  const data = await fetchAssessmentsByGroup(config, "zoning");
  if (data.length === 0) return null;

  const chartData = data.slice(0, 15).map((d) => ({
    neighbourhood: d.group,
    permits: d.count,
  }));

  return (
    <ChartCard chartId={`${slug}-properties-by-zone`} title={`${config.name} — Properties by Zone`} source={config.dataSource}>
      <Card>
        <CardHeader
          title="Properties by Zone"
          subtitle="Number of assessed parcels per zoning district — shows where development is concentrated and which zones have the most parcels"
          badge="LIVE"
          freshness="daily"
        />
        <NeighbourhoodBarChart
          data={chartData}
          dataKey="permits"
          color="#3b82f6"
          tooltipLabel="Properties"
          height={Math.max(250, data.slice(0, 15).length * 28)}
        />
      </Card>
    </ChartCard>
  );
}

async function AssessmentsByNeighbourhood({ slug }: { slug: string }) {
  const config = getMunicipality(slug)!;
  if (!config.fields.neighbourhood && !config.fields.subdivision) return null;

  const groupBy = config.fields.neighbourhood ? "neighbourhood" : "subdivision";
  const data = await fetchAssessmentsByGroup(config, groupBy);
  if (data.length === 0) return null;

  const chartData = data
    .sort((a, b) => b.avgAssessment - a.avgAssessment)
    .slice(0, 15)
    .map((d) => ({
      neighbourhood: d.group,
      avgValue: d.avgAssessment,
    }));

  const label = groupBy === "neighbourhood" ? "Neighbourhood" : "Subdivision";

  return (
    <ChartCard chartId={`${slug}-assessment-by-${groupBy}`} title={`${config.name} — Avg Assessment by ${label}`} source={config.dataSource}>
      <Card>
        <CardHeader
          title={`Avg Assessment by ${label}`}
          subtitle={`Top 15 ${label.toLowerCase()}s by average property value — higher values indicate more desirable or more developed areas`}
          badge="LIVE"
          freshness="daily"
        />
        <NeighbourhoodBarChart
          data={chartData}
          dataKey="avgValue"
          color="#10b981"
          valuePrefix="$"
          tooltipLabel="Avg Assessment"
          height={Math.max(250, chartData.length * 28)}
        />
      </Card>
    </ChartCard>
  );
}

// ============================================================
// Optional sections (only render if municipality has the data)
// ============================================================

async function BusinessSection({ slug }: { slug: string }) {
  const config = getMunicipality(slug)!;
  if (!config.capabilities.includes("businesses")) return null;

  const data = await fetchBusinessCategories(config);
  if (data.length === 0) return null;

  const chartData = data.slice(0, 15).map((d) => ({
    neighbourhood: d.category,
    permits: d.count,
  }));

  return (
    <section>
      <SectionHeader title="Business Activity" icon={<Store size={16} />} category="municipalities" />
      <ChartCard chartId={`${slug}-businesses`} title={`${config.name} — Businesses by Category`} source={config.dataSource}>
        <Card>
          <CardHeader
            title="Businesses by Category"
            subtitle={`Active business licences registered in ${config.name}. Only Edmonton and Calgary publish business licence data via open APIs — this data comes from the municipal Socrata portal.`}
            badge="LIVE"
            freshness="daily"
          />
          <NeighbourhoodBarChart
            data={chartData}
            dataKey="permits"
            color="#a855f7"
            tooltipLabel="Businesses"
            height={Math.max(250, chartData.length * 28)}
          />
        </Card>
      </ChartCard>
    </section>
  );
}

async function VacantSection({ slug }: { slug: string }) {
  const config = getMunicipality(slug)!;
  if (!config.capabilities.includes("vacant_lots")) return null;

  const data = await fetchVacantLots(config);
  if (data.length === 0) return null;

  const chartData = data.map((d) => ({
    neighbourhood: d.group,
    permits: d.count,
  }));

  return (
    <section>
      <SectionHeader title="Vacant Land" icon={<MapPin size={16} />} category="municipalities" />
      <ChartCard chartId={`${slug}-vacant`} title={`${config.name} — Vacant Lots`} source={config.dataSource}>
        <Card>
          <CardHeader
            title="Vacant Lots by Zone"
            subtitle="Parcels classified as vacant land by zoning type — these represent development-ready sites. Only Stony Plain currently publishes a dedicated vacant lot layer via its ArcGIS endpoint."
            badge="LIVE"
            freshness="daily"
          />
          <NeighbourhoodBarChart
            data={chartData}
            dataKey="permits"
            color="#f59e0b"
            tooltipLabel="Vacant Lots"
            height={Math.max(250, chartData.length * 28)}
          />
        </Card>
      </ChartCard>
    </section>
  );
}

async function ConstructionSection({ slug }: { slug: string }) {
  const config = getMunicipality(slug)!;
  if (!config.capabilities.includes("construction")) return null;

  const projects = await fetchConstructionProjects(config);
  if (projects.length === 0) return null;

  return (
    <section>
      <SectionHeader title="Infrastructure Projects" icon={<HardHat size={16} />} category="municipalities" />
      <Card>
        <CardHeader
          title="Active Construction"
          subtitle="Municipal infrastructure and capital projects — sourced directly from the municipality's ArcGIS project tracker. Not all municipalities publish this data."
          badge="LIVE"
          freshness="daily"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-card-border text-muted text-left">
                <th className="pb-2 pr-3 font-medium">Project</th>
                <th className="pb-2 pr-3 font-medium">Phase</th>
                <th className="pb-2 pr-3 font-medium">Start</th>
                <th className="pb-2 font-medium">Location</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p: ConstructionProject, i: number) => (
                <tr key={i} className="border-b border-card-border/50 hover:bg-card-border/20">
                  <td className="py-2 pr-3">{p.project}</td>
                  <td className="py-2 pr-3">
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent-amber/20 text-accent-amber">
                      {p.phase}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-muted">{p.startDate}</td>
                  <td className="py-2 text-muted max-w-xs truncate">{p.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}

async function PermitSection({ slug }: { slug: string }) {
  const config = getMunicipality(slug)!;
  if (!config.capabilities.includes("permits") && !config.capabilities.includes("dev_permits")) return null;

  const data = await fetchPermitsByGroup(config);
  if (data.length === 0) return null;

  const chartData = data.slice(0, 15).map((d) => ({
    neighbourhood: d.group,
    permits: d.count,
  }));

  return (
    <section>
      <SectionHeader title="Development Permits" icon={<FileText size={16} />} category="municipalities" />
      <ChartCard chartId={`${slug}-permits`} title={`${config.name} — Permits`} source={config.dataSource}>
        <Card>
          <CardHeader
            title="Permits by Area"
            subtitle="Development permit activity — these are approvals for new construction, renovations, and land use changes. Permit volume is a leading indicator of future construction activity."
            badge="LIVE"
            freshness="daily"
          />
          <NeighbourhoodBarChart
            data={chartData}
            dataKey="permits"
            color="#3b82f6"
            tooltipLabel="Permits"
            height={Math.max(250, chartData.length * 28)}
          />
        </Card>
      </ChartCard>
    </section>
  );
}

async function TopPropertiesTable({ slug }: { slug: string }) {
  const config = getMunicipality(slug)!;
  const properties = await fetchTopProperties(config, 20);
  if (properties.length === 0) return null;

  const hasZoning = properties.some((p) => p.zoning);
  const hasYearBuilt = properties.some((p) => p.yearBuilt > 0);
  const hasSalePrice = properties.some((p) => p.salePrice > 0);

  return (
    <section>
      <SectionHeader title="Highest Value Properties" icon={<Home size={16} />} category="municipalities" />
      <Card>
        <CardHeader
          title="Top Assessed Properties"
          subtitle={`Highest assessed values in ${config.name} — assessments are set annually by the municipality and reflect market value as of July 1 of the prior year. Used for property tax calculations.`}
          badge="LIVE"
          freshness="daily"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-card-border text-muted text-left">
                <th className="pb-2 pr-3 font-medium">Address</th>
                <th className="pb-2 pr-3 font-medium">Assessment</th>
                {hasZoning && <th className="pb-2 pr-3 font-medium">Zoning</th>}
                {hasYearBuilt && <th className="pb-2 pr-3 font-medium">Year Built</th>}
                {hasSalePrice && <th className="pb-2 font-medium">Last Sale</th>}
              </tr>
            </thead>
            <tbody>
              {properties.map((p: TopProperty, i: number) => (
                <tr key={i} className="border-b border-card-border/50 hover:bg-card-border/20">
                  <td className="py-2 pr-3 whitespace-nowrap font-mono text-[10px]">
                    {p.address || "—"}
                  </td>
                  <td className="py-2 pr-3 text-accent-green whitespace-nowrap">
                    ${p.assessment.toLocaleString()}
                  </td>
                  {hasZoning && (
                    <td className="py-2 pr-3">
                      <span className="text-[9px] bg-accent/20 text-accent px-1.5 py-0.5 rounded">
                        {p.zoning || "—"}
                      </span>
                    </td>
                  )}
                  {hasYearBuilt && (
                    <td className="py-2 pr-3 text-muted">
                      {p.yearBuilt > 0 ? p.yearBuilt : "—"}
                    </td>
                  )}
                  {hasSalePrice && (
                    <td className="py-2 text-muted">
                      {p.salePrice > 0 ? `$${p.salePrice.toLocaleString()}` : "—"}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}

// ============================================================
// Regional Dashboard Data (province-wide indicators)
// ============================================================

function getLatestByCategory(records: RegionalDashboardRecord[]): { category: string; value: number; year: string }[] {
  const latest = new Map<string, { value: number; year: string }>();
  for (const r of records) {
    const cat = String(r.Category || "Total");
    const year = String(r.Period || "");
    const val = Number(r.OriginalValue) || 0;
    const existing = latest.get(cat);
    if (!existing || year > existing.year) {
      latest.set(cat, { value: val, year });
    }
  }
  return Array.from(latest.entries())
    .map(([category, { value, year }]) => ({ category, value, year }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);
}

function getTimeSeries(records: RegionalDashboardRecord[], category?: string): { year: string; value: number }[] {
  const filtered = category
    ? records.filter((r) => String(r.Category || "Total") === category)
    : records;
  const byYear = new Map<string, number>();
  for (const r of filtered) {
    const year = String(r.Period || "");
    const val = Number(r.OriginalValue) || 0;
    if (year && val > 0) byYear.set(year, val);
  }
  return Array.from(byYear.entries())
    .map(([year, value]) => ({ year, value }))
    .sort((a, b) => a.year.localeCompare(b.year));
}

async function RegionalDataSection({ slug }: { slug: string }) {
  const config = getMunicipality(slug)!;
  // Map municipality names for regional dashboard lookup
  const lookupName = config.name
    .replace(" (Fort McMurray)", "")
    .replace("Sturgeon County", "Sturgeon")
    .replace("Leduc County", "Leduc County");

  const regional = await fetchAllRegionalData(lookupName);

  // Check if we got any data at all
  const totalRecords = Object.values(regional).reduce((s, arr) => s + arr.length, 0);
  if (totalRecords === 0) return null;

  const latestAssessments = getLatestByCategory(regional.assessments);
  const latestPermits = getLatestByCategory(regional.buildingPermits);
  const latestRent = getLatestByCategory(regional.averageRent);
  const latestVacancy = getLatestByCategory(regional.vacancyRates);
  const latestHousing = getLatestByCategory(regional.housingStarts);
  const latestIncome = getLatestByCategory(regional.medianIncome);
  const latestTax = getLatestByCategory(regional.taxRates);

  // Get total assessment value
  const totalAssessment = latestAssessments.find((a) => a.category === "Total");
  const residentialAssessment = latestAssessments.find((a) => a.category === "Residential");

  // Get total building permits (residential)
  const residentialPermits = latestPermits.find((p) => p.category === "Residential");
  const totalPermits = latestPermits.find((p) => p.category === "Total");

  // Rent & vacancy
  const rent2br = latestRent.find((r) => r.category === "2 Bedroom");
  const vacancy = latestVacancy.find((v) => v.category === "Total" || v.category === "Overall");

  // Housing starts
  const totalStarts = latestHousing.find((h) => h.category === "Total");

  // Income
  const income = latestIncome[0];

  // Tax
  const taxRate = latestTax[0];

  return (
    <section>
      <SectionHeader title="Provincial Indicators" icon={<BarChart3 size={16} />} category="municipalities" />

      {/* Context for provincial indicators */}
      <Card className="mb-4">
        <div className="flex items-start gap-3">
          <Database size={14} className="text-muted shrink-0 mt-0.5" />
          <p className="text-xs text-muted leading-relaxed">
            The data below comes from the <span className="text-foreground font-medium">Alberta Regional Dashboard</span>{" "}
            (regionaldashboard.alberta.ca) — a Government of Alberta dataset that provides 54 socioeconomic indicators
            for all ~340 municipalities in the province. Data is updated daily and covers equalized assessments,
            building permits, housing starts, rental markets, income, tax rates, business counts, well activity, and more.
            These are aggregate figures reported at the municipal level, not individual property or business records.
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {totalAssessment && (
          <MetricCard
            title="Equalized Assessment"
            value={`$${(totalAssessment.value / 1_000_000).toFixed(0)}M`}
            change={totalAssessment.year}
            source="AB Regional Dashboard"
          />
        )}
        {residentialAssessment && !totalAssessment && (
          <MetricCard
            title="Residential Assessment"
            value={`$${(residentialAssessment.value / 1_000_000).toFixed(0)}M`}
            change={residentialAssessment.year}
            source="AB Regional Dashboard"
          />
        )}
        {(totalPermits || residentialPermits) && (
          <MetricCard
            title="Building Permits"
            value={(totalPermits?.value || residentialPermits?.value || 0).toLocaleString()}
            change={`${totalPermits ? "Total" : "Residential"} (${totalPermits?.year || residentialPermits?.year})`}
            source="AB Regional Dashboard"
          />
        )}
        {rent2br && (
          <MetricCard
            title="Avg Rent (2BR)"
            value={`$${rent2br.value.toLocaleString()}`}
            change={rent2br.year}
            source="AB Regional Dashboard"
          />
        )}
        {vacancy && (
          <MetricCard
            title="Vacancy Rate"
            value={`${vacancy.value.toFixed(1)}%`}
            change={vacancy.year}
            source="AB Regional Dashboard"
          />
        )}
        {totalStarts && (
          <MetricCard
            title="Housing Starts"
            value={totalStarts.value.toLocaleString()}
            change={totalStarts.year}
            source="AB Regional Dashboard"
          />
        )}
        {income && (
          <MetricCard
            title="Median Income"
            value={`$${income.value.toLocaleString()}`}
            change={income.year}
            source="AB Regional Dashboard"
          />
        )}
        {taxRate && (
          <MetricCard
            title="Mill Rate"
            value={taxRate.value.toFixed(4)}
            change={taxRate.year}
            source="AB Regional Dashboard"
          />
        )}
      </div>

      {/* Assessment breakdown by type */}
      {latestAssessments.length > 1 && (
        <div className="mt-4">
          <Card>
            <CardHeader
              title="Equalized Assessment by Type"
              subtitle={`Property assessment breakdown (${latestAssessments[0]?.year}) — equalized assessments are adjusted by the province to ensure comparability across municipalities for grant allocation and benchmarking`}
              badge="PROVINCIAL"
              freshness="daily"
            />
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-card-border text-muted text-left">
                    <th className="pb-2 pr-3 font-medium">Property Type</th>
                    <th className="pb-2 pr-3 font-medium text-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {latestAssessments.filter((a) => a.category !== "Total").map((a, i) => (
                    <tr key={i} className="border-b border-card-border/50 hover:bg-card-border/20">
                      <td className="py-2 pr-3">{a.category}</td>
                      <td className="py-2 pr-3 text-right text-accent-green">
                        ${(a.value / 1_000_000).toFixed(1)}M
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Building permits breakdown */}
      {latestPermits.length > 1 && (
        <div className="mt-4">
          <Card>
            <CardHeader
              title="Building Permits by Type"
              subtitle={`Permit activity breakdown (${latestPermits[0]?.year}) — building permits are a leading indicator of future construction; residential permits signal housing demand, commercial permits signal business investment`}
              badge="PROVINCIAL"
              freshness="daily"
            />
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-card-border text-muted text-left">
                    <th className="pb-2 pr-3 font-medium">Type</th>
                    <th className="pb-2 pr-3 font-medium text-right">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {latestPermits.filter((p) => p.category !== "Total").map((p, i) => (
                    <tr key={i} className="border-b border-card-border/50 hover:bg-card-border/20">
                      <td className="py-2 pr-3">{p.category}</td>
                      <td className="py-2 pr-3 text-right">{p.value.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </section>
  );
}

// ============================================================
// Local Amenities (Google Maps Places)
// ============================================================

const AMENITY_ICONS: Record<string, React.ReactNode> = {
  restaurant: <UtensilsCrossed size={14} />,
  school: <GraduationCap size={14} />,
  hospital: <Hospital size={14} />,
  pharmacy: <Pill size={14} />,
  supermarket: <ShoppingCart size={14} />,
  gas_station: <Fuel size={14} />,
  bank: <Landmark size={14} />,
  gym: <Dumbbell size={14} />,
  park: <Trees size={14} />,
  library: <BookOpen size={14} />,
};

const AMENITY_LABELS: Record<string, string> = {
  restaurant: "Restaurants",
  school: "Schools",
  hospital: "Hospitals",
  pharmacy: "Pharmacies",
  supermarket: "Supermarkets",
  gas_station: "Gas Stations",
  bank: "Banks",
  gym: "Gyms",
  park: "Parks",
  library: "Libraries",
};

async function AmenitiesSection({ slug }: { slug: string }) {
  if (!process.env.GOOGLE_MAPS_API_KEY) return null;

  const config = getMunicipality(slug)!;
  const { counts } = await countPlaceTypes(config.name);

  // If no counts came back (e.g. geocode failed), skip
  if (Object.keys(counts).length === 0) return null;

  return (
    <section>
      <SectionHeader title="Local Amenities" icon={<MapPin size={16} />} category="municipalities" />
      <Card>
        <CardHeader
          title="Local Amenities"
          subtitle="Within 5km radius"
          freshness="daily"
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Object.entries(counts).map(([type, count]) => (
            <div
              key={type}
              className="flex items-center gap-2.5 rounded-lg bg-card-border/30 px-3 py-2.5"
            >
              <span className="text-muted shrink-0">{AMENITY_ICONS[type]}</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight">{count}</p>
                <p className="text-[10px] text-muted truncate">{AMENITY_LABELS[type] || type}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </section>
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

function LoadingMetrics() {
  return (
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
  );
}

// ============================================================
// Page
// ============================================================

export default async function MunicipalityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const config = getMunicipality(slug);
  if (!config) notFound();

  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title={config.name}
        description={config.description}
        category="municipalities"
        icon={<Building2 size={22} style={{ color: config.color }} />}
      >
        {config.population && (
          <p className="text-xs text-muted/60">
            Population ~{config.population.toLocaleString()}
          </p>
        )}
      </PageHeader>

      {/* Key Metrics */}
      <Suspense fallback={<LoadingMetrics />}>
        <KeyMetrics slug={slug} />
      </Suspense>

      {/* Assessment Charts */}
      {config.capabilities.includes("assessments") && (
        <section>
          <SectionHeader title="Property Assessments" icon={<Home size={16} />} category="municipalities" />
          <div className="grid lg:grid-cols-2 gap-4">
            <Suspense fallback={<LoadingCard />}>
              <AssessmentCountChart slug={slug} />
            </Suspense>
            <Suspense fallback={<LoadingCard />}>
              <AssessmentsByZoningChart slug={slug} />
            </Suspense>
          </div>
          <div className="mt-4">
            <Suspense fallback={<LoadingCard />}>
              <AssessmentsByNeighbourhood slug={slug} />
            </Suspense>
          </div>
        </section>
      )}

      {/* Permits */}
      <Suspense fallback={<LoadingCard />}>
        <PermitSection slug={slug} />
      </Suspense>

      {/* Businesses */}
      <Suspense fallback={<LoadingCard />}>
        <BusinessSection slug={slug} />
      </Suspense>

      {/* Vacant Land */}
      <Suspense fallback={<LoadingCard />}>
        <VacantSection slug={slug} />
      </Suspense>

      {/* Top Properties Table */}
      <Suspense fallback={<LoadingCard />}>
        <TopPropertiesTable slug={slug} />
      </Suspense>

      {/* Construction */}
      <Suspense fallback={<LoadingCard />}>
        <ConstructionSection slug={slug} />
      </Suspense>

      {/* Regional Dashboard Data */}
      <Suspense fallback={<LoadingCard />}>
        <RegionalDataSection slug={slug} />
      </Suspense>

      {/* Local Amenities (Google Maps) */}
      <Suspense fallback={<LoadingCard />}>
        <AmenitiesSection slug={slug} />
      </Suspense>

      {/* Data Sources & Methodology */}
      <Card>
        <h3 className="text-xs font-medium text-foreground mb-3">Data Sources & Methodology</h3>
        <div className="text-[10px] text-muted space-y-2">
          <p>
            <span className="text-foreground font-medium">Primary source</span> — {config.dataSource}
          </p>
          {config.capabilities.length > 0 ? (
            <p>
              <span className="text-foreground font-medium">Available data</span> — {config.capabilities.join(", ").replace(/_/g, " ")}
            </p>
          ) : (
            <p>
              <span className="text-foreground font-medium">Available data</span> — Provincial indicators only (no direct municipal API)
            </p>
          )}
          <p>
            <span className="text-foreground font-medium">Provincial overlay</span> — Alberta Regional Dashboard (regionaldashboard.alberta.ca) provides
            54 socioeconomic indicators for all ~340 Alberta municipalities. Updated daily, cached 24 hours.
          </p>
          <p>
            <span className="text-foreground font-medium">How data is collected</span> — Municipal ArcGIS/Socrata endpoints are queried directly via REST APIs.
            Each municipality uses different field names for the same concepts (e.g. assessed value might be called{" "}
            <span className="font-mono">TASS</span>, <span className="font-mono">assessed_value</span>,{" "}
            <span className="font-mono">ASSESSED_VALUE</span>, or <span className="font-mono">Total_Assessed_Value</span>).
            We normalize these into a consistent schema. Regional dashboard data is fetched from the Government of Alberta&apos;s
            open data API and falls back to PostgreSQL snapshots during upstream outages.
          </p>
          {config.capabilities.length > 0 && (
            <p>
              <span className="text-foreground font-medium">What&apos;s not available</span> —{" "}
              {!config.capabilities.includes("businesses") && "Business licences (only Edmonton & Calgary publish these via API). "}
              {!config.capabilities.includes("permits") && !config.capabilities.includes("dev_permits") && "Building/development permits. "}
              {!config.capabilities.includes("vacant_lots") && "Vacant lot tracking (only Stony Plain has a dedicated layer). "}
              {!config.capabilities.includes("construction") && "Infrastructure project tracking. "}
              These data gaps exist because each municipality decides independently what to publish via their GIS systems.
            </p>
          )}
          {config.notes?.map((note, i) => (
            <p key={i} className="text-accent-amber/80">Note: {note}</p>
          ))}
        </div>
      </Card>

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Alberta Pulse Check — {config.name} — Data from {config.dataSource}
      </footer>
    </main>
  );
}
