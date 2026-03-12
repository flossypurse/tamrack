import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Card, CardHeader, MetricCard } from "@/components/card";
import { NeighbourhoodBarChart } from "@/components/chart";
import { EmbedButton } from "@/components/embed-button";
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
import { Building2, Home, Store, HardHat, MapPin, FileText, BarChart3, TrendingUp } from "lucide-react";

// Generate static paths for all live municipalities
export function generateStaticParams() {
  return getLiveMunicipalities().map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const config = getMunicipality(slug);
  if (!config) return { title: "Municipality Not Found" };
  return {
    title: `${config.name} — Alberta Pulse Check`,
    description: config.description,
  };
}

// ============================================================
// Key Metrics (server component)
// ============================================================

async function KeyMetrics({ slug }: { slug: string }) {
  const config = getMunicipality(slug)!;
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
    <Card>
      <div className="flex items-start justify-between">
        <CardHeader
          title="Avg Assessment by Zone"
          subtitle={`Average property value per zoning district`}
          badge="LIVE"
        />
        <EmbedButton chartId={`${slug}-assessment-by-zone`} title={`${config.name} — Avg Assessment by Zone`} />
      </div>
      <NeighbourhoodBarChart
        data={chartData}
        dataKey="avgValue"
        color={config.color}
        valuePrefix="$"
        tooltipLabel="Avg Assessment"
        height={Math.max(250, data.slice(0, 15).length * 28)}
      />
    </Card>
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
    <Card>
      <div className="flex items-start justify-between">
        <CardHeader
          title="Properties by Zone"
          subtitle="Number of assessed parcels per zoning district"
          badge="LIVE"
        />
        <EmbedButton chartId={`${slug}-properties-by-zone`} title={`${config.name} — Properties by Zone`} />
      </div>
      <NeighbourhoodBarChart
        data={chartData}
        dataKey="permits"
        color="#3b82f6"
        tooltipLabel="Properties"
        height={Math.max(250, data.slice(0, 15).length * 28)}
      />
    </Card>
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
    <Card>
      <div className="flex items-start justify-between">
        <CardHeader
          title={`Avg Assessment by ${label}`}
          subtitle={`Top 15 ${label.toLowerCase()}s by average property value`}
          badge="LIVE"
        />
        <EmbedButton chartId={`${slug}-assessment-by-${groupBy}`} title={`${config.name} — Avg Assessment by ${label}`} />
      </div>
      <NeighbourhoodBarChart
        data={chartData}
        dataKey="avgValue"
        color="#10b981"
        valuePrefix="$"
        tooltipLabel="Avg Assessment"
        height={Math.max(250, chartData.length * 28)}
      />
    </Card>
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
      <div className="flex items-center gap-2 mb-3">
        <Store size={16} className="text-purple-400" />
        <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
          Business Activity
        </h2>
      </div>
      <Card>
        <div className="flex items-start justify-between">
          <CardHeader
            title="Businesses by Category"
            subtitle={`Registered businesses in ${config.name}`}
            badge="LIVE"
          />
          <EmbedButton chartId={`${slug}-businesses`} title={`${config.name} — Businesses by Category`} />
        </div>
        <NeighbourhoodBarChart
          data={chartData}
          dataKey="permits"
          color="#a855f7"
          tooltipLabel="Businesses"
          height={Math.max(250, chartData.length * 28)}
        />
      </Card>
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
      <div className="flex items-center gap-2 mb-3">
        <MapPin size={16} className="text-amber-400" />
        <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
          Vacant Land
        </h2>
      </div>
      <Card>
        <div className="flex items-start justify-between">
          <CardHeader
            title="Vacant Lots by Zone"
            subtitle="Development-ready parcels by zoning type"
            badge="LIVE"
          />
          <EmbedButton chartId={`${slug}-vacant`} title={`${config.name} — Vacant Lots`} />
        </div>
        <NeighbourhoodBarChart
          data={chartData}
          dataKey="permits"
          color="#f59e0b"
          tooltipLabel="Vacant Lots"
          height={Math.max(250, chartData.length * 28)}
        />
      </Card>
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
      <div className="flex items-center gap-2 mb-3">
        <HardHat size={16} className="text-amber-400" />
        <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
          Infrastructure Projects
        </h2>
      </div>
      <Card>
        <CardHeader
          title="Active Construction"
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
      <div className="flex items-center gap-2 mb-3">
        <FileText size={16} className="text-blue-400" />
        <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
          Development Permits
        </h2>
      </div>
      <Card>
        <div className="flex items-start justify-between">
          <CardHeader
            title="Permits by Area"
            subtitle="Development permit activity"
            badge="LIVE"
          />
          <EmbedButton chartId={`${slug}-permits`} title={`${config.name} — Permits`} />
        </div>
        <NeighbourhoodBarChart
          data={chartData}
          dataKey="permits"
          color="#3b82f6"
          tooltipLabel="Permits"
          height={Math.max(250, chartData.length * 28)}
        />
      </Card>
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
      <div className="flex items-center gap-2 mb-3">
        <Home size={16} className="text-green-400" />
        <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
          Highest Value Properties
        </h2>
      </div>
      <Card>
        <CardHeader
          title="Top Assessed Properties"
          subtitle={`Highest assessed values in ${config.name}`}
          badge="LIVE"
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
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 size={16} className="text-cyan-400" />
        <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
          Provincial Indicators
        </h2>
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400">
          AB REGIONAL DASHBOARD
        </span>
      </div>
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
              subtitle={`Property assessment breakdown (${latestAssessments[0]?.year})`}
              badge="PROVINCIAL"
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
              subtitle={`Permit activity breakdown (${latestPermits[0]?.year})`}
              badge="PROVINCIAL"
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
      <header>
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <Building2 size={22} style={{ color: config.color }} />
          {config.name}
        </h1>
        <p className="text-sm text-muted mt-1">{config.description}</p>
        {config.population && (
          <p className="text-xs text-muted/60 mt-0.5">
            Population ~{config.population.toLocaleString()}
          </p>
        )}
      </header>

      {/* Key Metrics */}
      <Suspense fallback={<LoadingMetrics />}>
        <KeyMetrics slug={slug} />
      </Suspense>

      {/* Assessment Charts */}
      {config.capabilities.includes("assessments") && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Home size={16} className="text-green-400" />
            <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
              Property Assessments
            </h2>
          </div>
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

      {/* Data Sources */}
      <Card>
        <h3 className="text-xs font-medium text-muted mb-2">Data Sources</h3>
        <div className="text-[10px] text-muted space-y-1">
          <p>
            <span className="text-foreground font-medium">Source</span> — {config.dataSource}
          </p>
          <p>
            <span className="text-foreground font-medium">Capabilities</span> — {config.capabilities.join(", ").replace(/_/g, " ")}
          </p>
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
