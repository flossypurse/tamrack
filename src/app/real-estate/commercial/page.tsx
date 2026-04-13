import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import { ChartCard } from "@/components/chart-card";
import { computeTimeRange } from "@/lib/time-range";

export const metadata: Metadata = {
  title: "Alberta Commercial Real Estate Pulse",
  description: "Commercial property assessments, business formation trends, retail sales, and commercial zoning analysis across Alberta municipalities.",
  alternates: {
    canonical: "https://albertapulsecheck.ca/real-estate/commercial",
  },
};
import {
  TimeSeriesBarChart,
  TimeSeriesAreaChart,
  NeighbourhoodBarChart,
} from "@/components/chart";
import {
  Store,
  TrendingUp,
  Building2,
  BarChart3,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import {
  fetchEdmontonCommercialAssessments,
  fetchEdmontonBusinessCategories,
  fetchEdmontonBusinessesByNeighbourhood,
  fetchEdmontonCommercialPermits,
  fetchEdmontonBusinessLicences,
  fetchStatCanTimeSeries,
  STATSCAN_SERIES,
  type CommercialAssessment,
  type BusinessCategory,
  type BusinessByNeighbourhood,
} from "@/lib/data-sources";

// ============================================================
// Server-side data fetching
// ============================================================

async function getCommercialMetrics() {
  const [assessments, categories, businesses, retailSales] = await Promise.all([
    fetchEdmontonCommercialAssessments(5).catch(() => []),
    fetchEdmontonBusinessCategories(5).catch(() => []),
    fetchEdmontonBusinessesByNeighbourhood(1).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_RETAIL_SALES.tableId,
      STATSCAN_SERIES.AB_RETAIL_SALES.coordinate,
      2
    ).catch(() => []),
  ]);

  const totalCommercialProps = assessments.reduce((sum, a) => sum + a.count, 0);
  const totalBusinesses = categories.reduce((sum, c) => sum + c.count, 0);
  const topCategory = categories[0];

  const retailLatest = retailSales.at(-1);
  const retailPrev = retailSales.at(-2);
  const retailChange =
    retailLatest && retailPrev
      ? ((retailLatest.value - retailPrev.value) / retailPrev.value * 100).toFixed(1)
      : null;

  return {
    totalCommercialProps: totalCommercialProps > 0 ? totalCommercialProps.toLocaleString() : "—",
    totalBusinesses: totalBusinesses > 0 ? totalBusinesses.toLocaleString() : "—",
    topCategory: topCategory ? `${topCategory.category} (${topCategory.count.toLocaleString()})` : "—",
    retailSales: retailLatest ? `$${(retailLatest.value / 1_000_000).toFixed(0)}M` : "—",
    retailChange: retailChange
      ? `${parseFloat(retailChange) >= 0 ? "+" : ""}${retailChange}%`
      : undefined,
  };
}

// ============================================================
// Dashboard sections
// ============================================================

async function CommercialMetrics() {
  const m = await getCommercialMetrics();
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Commercial Properties"
        value={m.totalCommercialProps}
        source="Edmonton Open Data"
      />
      <MetricCard
        title="Active Businesses"
        value={m.totalBusinesses}
        source="Edmonton Licences"
      />
      <MetricCard
        title="Top Category"
        value={m.topCategory}
        source="Edmonton Licences"
      />
      <MetricCard
        title="AB Retail Sales"
        value={m.retailSales}
        change={m.retailChange}
        changeLabel="vs prev month"
        source="StatsCan 20-10-0056"
      />
    </div>
  );
}

async function CommercialAssessmentsChart() {
  const data = await fetchEdmontonCommercialAssessments(15);
  return (
    <ChartCard chartId="re-commercial-assessments" title="Top Commercial Neighbourhoods by Total Assessment" source="City of Edmonton">
      <Card>
        <CardHeader
          title="Top Commercial Neighbourhoods by Total Assessment"
          subtitle="Where is commercial property value concentrated? Higher totals = established commercial districts."
          badge="LIVE"
        />
        <NeighbourhoodBarChart
          data={data}
          dataKey="totalValue"
          labelKey="neighbourhood"
          color="#f59e0b"
          height={400}
          valuePrefix="$"
          tooltipLabel="Total Assessment"
        />
      </Card>
    </ChartCard>
  );
}

async function BusinessCategoriesChart() {
  const data = await fetchEdmontonBusinessCategories(15);
  return (
    <ChartCard chartId="re-business-categories" title="Business Licences by Category" source="City of Edmonton">
      <Card>
        <CardHeader
          title="Business Licences by Category"
          subtitle="What kinds of businesses are operating? Reveals the commercial mix."
          badge="LIVE"
        />
        <NeighbourhoodBarChart
          data={data.map((d) => ({ neighbourhood: d.category, value: d.count }))}
          dataKey="value"
          labelKey="neighbourhood"
          color="#3b82f6"
          height={400}
          tooltipLabel="Active Licences"
        />
      </Card>
    </ChartCard>
  );
}

async function BusinessDensityChart() {
  const data = await fetchEdmontonBusinessesByNeighbourhood(15);
  return (
    <ChartCard chartId="re-business-density" title="Business Density by Neighbourhood" source="City of Edmonton">
      <Card>
        <CardHeader
          title="Business Density by Neighbourhood"
          subtitle="Where are businesses clustering? High density = commercial gravity + foot traffic."
          badge="LIVE"
        />
        <NeighbourhoodBarChart
          data={data.map((d) => ({ neighbourhood: d.neighbourhood, value: d.count }))}
          dataKey="value"
          labelKey="neighbourhood"
          color="#10b981"
          height={400}
          tooltipLabel="Active Businesses"
        />
      </Card>
    </ChartCard>
  );
}

async function CommercialPermitsChart() {
  const data = await fetchEdmontonCommercialPermits();
  const timeRange = computeTimeRange(data);
  return (
    <ChartCard chartId="re-commercial-permits" title="Commercial Building Permits — Edmonton" timeRange={timeRange} source="City of Edmonton">
      <Card>
        <CardHeader
          title="Commercial Building Permits — Edmonton"
          subtitle="Monthly commercial permit activity. Rising = business confidence in brick-and-mortar."
          badge="LIVE"
        />
        <TimeSeriesBarChart data={data} color="#f59e0b" height={250} />
      </Card>
    </ChartCard>
  );
}

async function BusinessLicenceTrendChart() {
  const data = await fetchEdmontonBusinessLicences();
  const timeRange = computeTimeRange(data);
  return (
    <ChartCard chartId="re-business-licences" title="New Business Licences — Edmonton" timeRange={timeRange} source="City of Edmonton">
      <Card>
        <CardHeader
          title="New Business Licences — Edmonton"
          subtitle="Monthly new/renewed licences. The pulse of business formation."
          badge="LIVE"
        />
        <TimeSeriesAreaChart data={data} color="#3b82f6" height={250} />
      </Card>
    </ChartCard>
  );
}

async function RetailSalesChart() {
  const data = await fetchStatCanTimeSeries(
    STATSCAN_SERIES.AB_RETAIL_SALES.tableId,
    STATSCAN_SERIES.AB_RETAIL_SALES.coordinate,
    40
  );
  const timeRange = computeTimeRange(data);
  return (
    <ChartCard chartId="re-retail-sales" title="Alberta Retail Sales" timeRange={timeRange} source="StatsCan">
      <Card>
        <CardHeader
          title="Alberta Retail Sales"
          subtitle="Monthly retail trade — consumer spending confidence signal"
          badge="LIVE"
        />
        <TimeSeriesAreaChart data={data} color="#8b5cf6" height={250} compact valuePrefix="$" />
      </Card>
    </ChartCard>
  );
}

async function CommercialAssessmentsTable() {
  const data = await fetchEdmontonCommercialAssessments(20);
  return (
    <Card>
      <CardHeader
        title="Commercial Assessment Details"
        subtitle="Top 20 neighbourhoods by total non-residential assessed value"
        badge="LIVE"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-card-border text-left text-muted">
              <th className="py-2 pr-4">Neighbourhood</th>
              <th className="py-2 pr-4 text-right">Properties</th>
              <th className="py-2 pr-4 text-right">Avg Value</th>
              <th className="py-2 text-right">Total Value</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.neighbourhood} className="border-b border-card-border/50">
                <td className="py-1.5 pr-4 font-medium">{row.neighbourhood}</td>
                <td className="py-1.5 pr-4 text-right text-muted">{row.count.toLocaleString()}</td>
                <td className="py-1.5 pr-4 text-right text-muted">${row.avgValue.toLocaleString()}</td>
                <td className="py-1.5 text-right font-mono">${row.totalValue.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
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

export default function CommercialPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Commercial Pulse"
        description="Commercial property assessments, business formation, category mix, and retail trends. Where is commercial activity concentrating and what kind of businesses are thriving?"
        category="realestate"
        icon={<Store size={20} />}
      >
        <div className="flex flex-wrap gap-2">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-mono">CRE INVESTORS</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-mono">FRANCHISE OPS</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono">SITE SELECTION</span>
        </div>
      </PageHeader>

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
          <CommercialMetrics />
        </Suspense>
      </section>

      {/* Activity Trends */}
      <section>
        <SectionHeader title="Activity Trends" icon={<TrendingUp size={16} />} category="realestate" />
        <div className="grid md:grid-cols-2 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <CommercialPermitsChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <BusinessLicenceTrendChart />
          </Suspense>
        </div>
      </section>

      {/* Retail */}
      <section>
        <Suspense fallback={<LoadingCard />}>
          <RetailSalesChart />
        </Suspense>
      </section>

      {/* Where */}
      <section>
        <SectionHeader title="Where is the Commercial Value?" icon={<Building2 size={16} />} category="realestate" />
        <div className="grid md:grid-cols-2 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <CommercialAssessmentsChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <BusinessDensityChart />
          </Suspense>
        </div>
      </section>

      {/* Business Mix */}
      <section>
        <SectionHeader title="Business Mix" icon={<BarChart3 size={16} />} category="realestate" />
        <Suspense fallback={<LoadingCard />}>
          <BusinessCategoriesChart />
        </Suspense>
      </section>

      {/* Table */}
      <section>
        <Suspense fallback={<LoadingCard />}>
          <CommercialAssessmentsTable />
        </Suspense>
      </section>

      {/* Context */}
      <section>
        <Card>
          <h3 className="text-sm font-medium mb-2">Who Uses This</h3>
          <div className="grid sm:grid-cols-3 gap-3 text-xs text-muted">
            <div>
              <p className="font-medium text-foreground mb-1">CRE Investors</p>
              <p>Identify high-value commercial corridors and watch for assessment growth trends. Pair with vacancy data for cap rate signals.</p>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">Franchise Operators</p>
              <p>Business category density reveals competition saturation. Low count in a growing neighbourhood = opportunity. High count = avoid.</p>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">Site Selection</p>
              <p>Cross-reference business density with residential growth for &quot;complete community&quot; signals — where residents AND businesses are both growing.</p>
            </div>
          </div>
        </Card>
      </section>
    </main>
  );
}
