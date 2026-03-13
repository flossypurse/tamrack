import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader } from "@/components/card";
import { ChartCard } from "@/components/chart-card";
import {
  NeighbourhoodBarChart,
} from "@/components/chart";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import {
  Scale,
  TrendingUp,
  Building2,
  BarChart3,
} from "lucide-react";
import {
  getLiveMunicipalities,
  getMunicipalitiesByRegion,
  REGION_LABELS,
  REGION_ORDER,
  type MunicipalityConfig,
} from "@/lib/municipality-registry";
import {
  fetchMunicipalityMetrics,
  type MunicipalityMetrics,
} from "@/lib/municipality-data";
import {
  fetchStatCanTimeSeries,
  STATSCAN_SERIES,
} from "@/lib/data-sources";

// ============================================================
// Server-side data fetching
// ============================================================

type MunicipalityBenchmark = {
  name: string;
  slug: string;
  region: MunicipalityConfig["region"];
  population: number;
  metrics: MunicipalityMetrics;
};

async function getAllBenchmarks(): Promise<MunicipalityBenchmark[]> {
  const municipalities = getLiveMunicipalities();

  // Fetch metrics for all municipalities in parallel
  const results = await Promise.allSettled(
    municipalities.map(async (config) => {
      const metrics = await fetchMunicipalityMetrics(config);
      return {
        name: config.name,
        slug: config.slug,
        region: config.region,
        population: config.population || 0,
        metrics,
      };
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<MunicipalityBenchmark> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((b) => b.metrics.totalParcels > 0 || b.metrics.totalAssessed > 0);
}

// ============================================================
// Dashboard sections
// ============================================================

async function BenchmarkOverview() {
  const benchmarks = await getAllBenchmarks();
  const byRegion = new Map<string, MunicipalityBenchmark[]>();
  for (const b of benchmarks) {
    const list = byRegion.get(b.region) || [];
    list.push(b);
    byRegion.set(b.region, list);
  }

  return (
    <Card>
      <CardHeader
        title={`${benchmarks.length} Municipalities Benchmarked`}
        subtitle="Live data from municipal ArcGIS endpoints — parcels, assessments, businesses, vacant lots"
        badge="LIVE"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-card-border text-left text-muted">
              <th className="py-2 pr-3">Municipality</th>
              <th className="py-2 pr-3 text-right">Population</th>
              <th className="py-2 pr-3 text-right">Parcels</th>
              <th className="py-2 pr-3 text-right">Avg Assessment</th>
              <th className="py-2 pr-3 text-right">Businesses</th>
              <th className="py-2 text-right">Vacant Lots</th>
            </tr>
          </thead>
          <tbody>
            {benchmarks
              .sort((a, b) => (b.population || 0) - (a.population || 0))
              .map((b) => (
                <tr key={b.slug} className="border-b border-card-border/50 hover:bg-foreground/[0.02]">
                  <td className="py-1.5 pr-3">
                    <a href={`/municipalities/${b.slug}`} className="font-medium text-accent hover:underline">
                      {b.name}
                    </a>
                    <span className="text-muted/60 ml-1.5 text-[10px]">
                      {REGION_LABELS[b.region as keyof typeof REGION_LABELS] || b.region}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 text-right text-muted">{b.population > 0 ? b.population.toLocaleString() : "—"}</td>
                  <td className="py-1.5 pr-3 text-right text-muted">{b.metrics.totalParcels > 0 ? b.metrics.totalParcels.toLocaleString() : "—"}</td>
                  <td className="py-1.5 pr-3 text-right font-mono">
                    {b.metrics.avgAssessment > 0 ? `$${b.metrics.avgAssessment.toLocaleString()}` : "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-right text-muted">{b.metrics.businessCount > 0 ? b.metrics.businessCount.toLocaleString() : "—"}</td>
                  <td className="py-1.5 text-right text-muted">{b.metrics.vacantCount > 0 ? b.metrics.vacantCount.toLocaleString() : "—"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

async function AssessmentComparison() {
  const benchmarks = await getAllBenchmarks();
  const data = benchmarks
    .filter((b) => b.metrics.avgAssessment > 0)
    .sort((a, b) => b.metrics.avgAssessment - a.metrics.avgAssessment)
    .map((b) => ({ neighbourhood: b.name, value: b.metrics.avgAssessment }));

  return (
    <ChartCard chartId="bench-avg-assessment" title="Average Assessment by Municipality" source="Municipal ArcGIS">
      <Card>
        <CardHeader
          title="Average Assessment by Municipality"
          subtitle="Higher average = more expensive properties. Compare to find value opportunities."
          badge="LIVE"
        />
        <NeighbourhoodBarChart
          data={data}
          dataKey="value"
          labelKey="neighbourhood"
          color="#3b82f6"
          height={Math.max(300, data.length * 28)}
          valuePrefix="$"
          tooltipLabel="Avg Assessment"
        />
      </Card>
    </ChartCard>
  );
}

async function ParcelCountComparison() {
  const benchmarks = await getAllBenchmarks();
  const data = benchmarks
    .filter((b) => b.metrics.totalParcels > 0)
    .sort((a, b) => b.metrics.totalParcels - a.metrics.totalParcels)
    .map((b) => ({ neighbourhood: b.name, value: b.metrics.totalParcels }));

  return (
    <ChartCard chartId="bench-parcel-count" title="Total Parcels by Municipality" source="Municipal ArcGIS">
      <Card>
        <CardHeader
          title="Total Parcels by Municipality"
          subtitle="A proxy for development density — more parcels = more built-out."
          badge="LIVE"
        />
        <NeighbourhoodBarChart
          data={data}
          dataKey="value"
          labelKey="neighbourhood"
          color="#10b981"
          height={Math.max(300, data.length * 28)}
          tooltipLabel="Parcels"
        />
      </Card>
    </ChartCard>
  );
}

async function VacantLotComparison() {
  const benchmarks = await getAllBenchmarks();
  const data = benchmarks
    .filter((b) => b.metrics.vacantCount > 0)
    .sort((a, b) => b.metrics.vacantCount - a.metrics.vacantCount)
    .map((b) => ({ neighbourhood: b.name, value: b.metrics.vacantCount }));

  if (data.length === 0) return null;

  return (
    <ChartCard chartId="bench-vacant-lots" title="Vacant Lots by Municipality" source="Municipal ArcGIS">
      <Card>
        <CardHeader
          title="Vacant Lots by Municipality"
          subtitle="Where is buildable land still available? Developers and land bankers watch this."
          badge="LIVE"
        />
        <NeighbourhoodBarChart
          data={data}
          dataKey="value"
          labelKey="neighbourhood"
          color="#f59e0b"
          height={Math.max(200, data.length * 28)}
          tooltipLabel="Vacant Lots"
        />
      </Card>
    </ChartCard>
  );
}

async function BusinessCountComparison() {
  const benchmarks = await getAllBenchmarks();
  const data = benchmarks
    .filter((b) => b.metrics.businessCount > 0)
    .sort((a, b) => b.metrics.businessCount - a.metrics.businessCount)
    .map((b) => ({ neighbourhood: b.name, value: b.metrics.businessCount }));

  if (data.length === 0) return null;

  return (
    <ChartCard chartId="bench-businesses" title="Active Businesses by Municipality" source="Municipal ArcGIS">
      <Card>
        <CardHeader
          title="Active Businesses by Municipality"
          subtitle="Business density signals commercial maturity. More businesses per capita = stronger local economy."
          badge="LIVE"
        />
        <NeighbourhoodBarChart
          data={data}
          dataKey="value"
          labelKey="neighbourhood"
          color="#8b5cf6"
          height={Math.max(200, data.length * 28)}
          tooltipLabel="Businesses"
        />
      </Card>
    </ChartCard>
  );
}

async function MacroContext() {
  const [unemployment, population, gdp] = await Promise.all([
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.tableId,
      STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.coordinate,
      1
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_POPULATION.tableId,
      STATSCAN_SERIES.AB_POPULATION.coordinate,
      1
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_GDP.tableId,
      STATSCAN_SERIES.AB_GDP.coordinate,
      1
    ).catch(() => []),
  ]);

  return (
    <Card>
      <CardHeader
        title="Provincial Context"
        subtitle="Municipality benchmarks in the context of Alberta-wide macro indicators"
      />
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-xs text-muted">Unemployment</p>
          <p className="text-lg font-semibold">{unemployment.at(-1)?.value.toFixed(1) || "—"}%</p>
        </div>
        <div>
          <p className="text-xs text-muted">Population</p>
          <p className="text-lg font-semibold">{population.at(-1) ? `${(population.at(-1)!.value / 1_000_000).toFixed(2)}M` : "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted">GDP</p>
          <p className="text-lg font-semibold">{gdp.at(-1) ? `$${(gdp.at(-1)!.value / 1_000).toFixed(0)}B` : "—"}</p>
        </div>
      </div>
    </Card>
  );
}

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

// ============================================================
// Page
// ============================================================

export const metadata: Metadata = {
  title: "Alberta Municipal Benchmarks",
  description: "Side-by-side benchmark comparison of Alberta municipalities — permits, assessments, population, business activity, and economic indicators.",
};

export default function BenchmarksPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Municipal Benchmarks"
        description="Side-by-side comparison of all registered municipalities across Alberta. Assessments, parcels, businesses, and vacant lots — pulled live from each municipality's data systems."
        category="intelligence"
        icon={<Scale size={20} />}
      >
        <div className="flex flex-wrap gap-2">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-mono">EDOs</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono">INVESTORS</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 font-mono">SITE SELECTION</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-mono">DEVELOPERS</span>
        </div>
      </PageHeader>

      {/* Provincial context */}
      <section>
        <Suspense fallback={<LoadingCard />}>
          <MacroContext />
        </Suspense>
      </section>

      {/* Full comparison table */}
      <section>
        <SectionHeader title="Full Comparison" icon={<Building2 size={16} />} category="intelligence" />
        <Suspense fallback={<LoadingCard />}>
          <BenchmarkOverview />
        </Suspense>
      </section>

      {/* Assessment comparison */}
      <section>
        <SectionHeader title="Assessment Comparison" icon={<TrendingUp size={16} />} category="intelligence" />
        <Suspense fallback={<LoadingCard />}>
          <AssessmentComparison />
        </Suspense>
      </section>

      {/* Parcel counts */}
      <section>
        <SectionHeader title="Development Density" icon={<BarChart3 size={16} />} category="intelligence" />
        <Suspense fallback={<LoadingCard />}>
          <ParcelCountComparison />
        </Suspense>
      </section>

      {/* Vacant lots + businesses */}
      <section>
        <div className="grid md:grid-cols-2 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <VacantLotComparison />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <BusinessCountComparison />
          </Suspense>
        </div>
      </section>

      {/* Context */}
      <section>
        <Card>
          <h3 className="text-sm font-medium mb-2">Who Uses This</h3>
          <div className="grid sm:grid-cols-3 gap-3 text-xs text-muted">
            <div>
              <p className="font-medium text-foreground mb-1">Economic Development Officers</p>
              <p>Compare your municipality to neighbours. Export this data for council presentations and investment attraction materials.</p>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">Investors</p>
              <p>Find value gaps — municipalities with low average assessments but high business counts are undervalued commercial markets.</p>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">Site Selection Consultants</p>
              <p>Rank municipalities by available land (vacant lots), workforce proximity (population), and business ecosystem maturity.</p>
            </div>
          </div>
        </Card>
      </section>

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Alberta Pulse Check &mdash; Municipal Benchmarks &mdash; Live data from {getLiveMunicipalities().length} municipalities
      </footer>
    </main>
  );
}
