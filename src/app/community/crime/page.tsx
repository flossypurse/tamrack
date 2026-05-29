import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import { ChartCard } from "@/components/chart-card";
import { computeTimeRange } from "@/lib/time-range";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import { TimeSeriesAreaChart, TimeSeriesBarChart } from "@/components/chart";
import {
  Shield,
  TrendingUp,
  BarChart3,
  AlertTriangle,
  MapPin,
} from "lucide-react";
import {
  fetchCrimeSeverityIndex,
  fetchCrimeByCategory,
  fetchCalgaryMonthlyTrend,
  type CrimeSeverityPoint,
  type CrimeByCategoryPoint,
} from "@/lib/data-sources-crime";
import { SITE_URL } from "@/lib/constants/site";

// Render on demand: StatsCan + Calgary Socrata fetches happen during render,
// and prerendering at build time was making CI hostage to upstream uptime.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title:
    "Alberta Crime & Safety Data — Crime Severity Index & Community Crime Stats",
  description:
    "Track crime severity index across 200+ Alberta police jurisdictions. Community-level crime data for Calgary. Real-time public safety intelligence.",
  alternates: {
    canonical: `${SITE_URL}/community/crime`,
  },
};

// ============================================================
// Server-side data fetching
// ============================================================

async function getCrimeMetrics() {
  const [csiData, categoryData] = await Promise.all([
    fetchCrimeSeverityIndex().catch(() => [] as CrimeSeverityPoint[]),
    fetchCrimeByCategory().catch(() => [] as CrimeByCategoryPoint[]),
  ]);

  // Get the latest period across all municipalities
  const periods = [...new Set(csiData.map((pt) => pt.period))].sort();
  const latestPeriod = periods.at(-1) ?? "";
  const prevPeriod = periods.at(-2) ?? "";

  // Latest CSI values per municipality
  const latestByMuni = new Map<string, number>();
  const prevByMuni = new Map<string, number>();
  for (const pt of csiData) {
    if (pt.period === latestPeriod) latestByMuni.set(pt.municipality, pt.csi);
    if (pt.period === prevPeriod) prevByMuni.set(pt.municipality, pt.csi);
  }

  // Province-wide average CSI (latest period)
  const latestValues = [...latestByMuni.values()].filter((v) => v > 0);
  const avgCsi =
    latestValues.length > 0
      ? latestValues.reduce((a, b) => a + b, 0) / latestValues.length
      : 0;

  // Province-wide average CSI (previous period)
  const prevValues = [...prevByMuni.values()].filter((v) => v > 0);
  const prevAvgCsi =
    prevValues.length > 0
      ? prevValues.reduce((a, b) => a + b, 0) / prevValues.length
      : 0;

  const yoyChange =
    avgCsi > 0 && prevAvgCsi > 0
      ? (((avgCsi - prevAvgCsi) / prevAvgCsi) * 100).toFixed(1)
      : null;

  // Total Calgary incidents from category data
  const totalCalgaryIncidents = categoryData.reduce(
    (sum, c) => sum + c.totalCount,
    0,
  );

  return {
    avgCsi: avgCsi > 0 ? avgCsi.toFixed(1) : "—",
    yoyChange: yoyChange
      ? `${parseFloat(yoyChange) >= 0 ? "+" : ""}${yoyChange}%`
      : undefined,
    municipalitiesTracked: String(latestByMuni.size || "—"),
    totalCalgaryIncidents:
      totalCalgaryIncidents > 0
        ? totalCalgaryIncidents.toLocaleString()
        : "—",
    latestPeriod,
  };
}

// ============================================================
// Dashboard sections
// ============================================================

async function CrimeMetrics() {
  const m = await getCrimeMetrics();
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Avg Crime Severity Index"
        value={m.avgCsi}
        change={m.yoyChange}
        changeLabel="vs prev period"
        source="AB Regional Dashboard"
      />
      <MetricCard
        title="YoY Change"
        value={m.yoyChange ?? "—"}
        source="AB Regional Dashboard"
      />
      <MetricCard
        title="Municipalities Tracked"
        value={m.municipalitiesTracked}
        source="AB Regional Dashboard"
      />
      <MetricCard
        title="Calgary Total Incidents"
        value={m.totalCalgaryIncidents}
        source="Calgary Open Data"
      />
    </div>
  );
}

async function CrimeSeverityTable() {
  const csiData = await fetchCrimeSeverityIndex().catch(
    () => [] as CrimeSeverityPoint[],
  );

  if (csiData.length === 0) {
    return (
      <Card>
        <CardHeader
          title="Crime Severity Index by Municipality"
          subtitle="No data available"
        />
        <p className="text-xs text-muted">
          Unable to load Crime Severity Index data. Please try again later.
        </p>
      </Card>
    );
  }

  // Get the latest two periods
  const periods = [...new Set(csiData.map((pt) => pt.period))].sort();
  const latestPeriod = periods.at(-1) ?? "";
  const prevPeriod = periods.at(-2) ?? "";

  // Build lookup by municipality for latest and previous periods
  const latestByMuni = new Map<string, number>();
  const prevByMuni = new Map<string, number>();
  for (const pt of csiData) {
    if (pt.period === latestPeriod) latestByMuni.set(pt.municipality, pt.csi);
    if (pt.period === prevPeriod) prevByMuni.set(pt.municipality, pt.csi);
  }

  // Sort by CSI descending, take top 20
  const ranked = [...latestByMuni.entries()]
    .filter(([, csi]) => csi > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  return (
    <Card>
      <CardHeader
        title="Crime Severity Index by Municipality"
        subtitle={`Top 20 highest CSI — ${latestPeriod}`}
        badge="LIVE"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-card-border text-muted">
              <th className="text-left py-2 pr-4 font-medium">#</th>
              <th className="text-left py-2 pr-4 font-medium">Municipality</th>
              <th className="text-right py-2 pr-4 font-medium">CSI</th>
              <th className="text-right py-2 pr-4 font-medium">YoY Change</th>
              <th className="text-right py-2 font-medium">Trend</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map(([municipality, csi], i) => {
              const prev = prevByMuni.get(municipality);
              const change =
                prev && prev > 0
                  ? (((csi - prev) / prev) * 100).toFixed(1)
                  : null;
              const changeNum = change ? parseFloat(change) : 0;

              return (
                <tr
                  key={municipality}
                  className="border-b border-card-border/50 hover:bg-card-border/20 transition-colors"
                >
                  <td className="py-2 pr-4 text-muted">{i + 1}</td>
                  <td className="py-2 pr-4 font-medium text-foreground">
                    {municipality}
                  </td>
                  <td className="py-2 pr-4 text-right font-mono">
                    {csi.toFixed(1)}
                  </td>
                  <td className="py-2 pr-4 text-right font-mono">
                    {change ? (
                      <span
                        className={
                          changeNum > 0
                            ? "text-red-400"
                            : changeNum < 0
                              ? "text-emerald-400"
                              : "text-muted"
                        }
                      >
                        {changeNum >= 0 ? "+" : ""}
                        {change}%
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    {change ? (
                      <span
                        className={
                          changeNum > 0
                            ? "text-red-400"
                            : changeNum < 0
                              ? "text-emerald-400"
                              : "text-muted"
                        }
                      >
                        {changeNum > 0 ? "▲" : changeNum < 0 ? "▼" : "—"}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted/60 mt-3">
        The Crime Severity Index (CSI) measures the overall volume and severity
        of police-reported crime. A higher value indicates more crime and/or more
        serious offences. Canada's baseline CSI is 100 (2006).
      </p>
    </Card>
  );
}

async function CalgaryCrimeByCategoryChart() {
  const data = await fetchCrimeByCategory().catch(
    () => [] as CrimeByCategoryPoint[],
  );

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader
          title="Calgary Crime by Category"
          subtitle="No data available"
        />
        <p className="text-xs text-muted">
          Unable to load Calgary crime category data.
        </p>
      </Card>
    );
  }

  // Convert to TimeSeriesPoint shape for the bar chart (date=category, value=count)
  const chartData = data.slice(0, 15).map((c) => ({
    date: c.category,
    value: c.totalCount,
  }));

  return (
    <ChartCard
      chartId="safety-calgary-crime-by-category"
      title="Calgary Crime by Category"
      source="Calgary Open Data"
    >
      <Card>
        <CardHeader
          title="Calgary Crime by Category"
          subtitle="Total reported incidents by crime type — all communities"
          badge="LIVE"
        />
        <TimeSeriesBarChart data={chartData} color="#ef4444" height={300} compact />
      </Card>
    </ChartCard>
  );
}

async function CalgaryCrimeTrendChart() {
  const data = await fetchCalgaryMonthlyTrend().catch(
    () => [] as { date: string; value: number }[],
  );

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader
          title="Calgary Monthly Crime Trend"
          subtitle="No data available"
        />
        <p className="text-xs text-muted">
          Unable to load Calgary crime trend data.
        </p>
      </Card>
    );
  }

  return (
    <ChartCard
      chartId="safety-calgary-crime-trend"
      title="Calgary Monthly Crime Trend"
      timeRange={computeTimeRange(data)}
      source="Calgary Open Data"
    >
      <Card>
        <CardHeader
          title="Calgary Monthly Crime Trend"
          subtitle="Total reported incidents per month across all communities"
          badge="LIVE"
        />
        <TimeSeriesAreaChart data={data} color="#f97316" height={280} compact />
      </Card>
    </ChartCard>
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

export default function CrimePage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Crime & Safety Data"
        description="Crime severity index across Alberta municipalities and community-level crime data for Calgary. Higher CSI means more crime and/or more serious offences — Canada's baseline is 100 (2006)."
        category="safety"
        icon={<Shield size={20} />}
      />

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
          <CrimeMetrics />
        </Suspense>
      </section>

      {/* Crime Severity Index Table */}
      <section>
        <SectionHeader
          title="Crime Severity Index"
          icon={<MapPin size={16} />}
          category="safety"
        />
        <Suspense fallback={<LoadingCard />}>
          <CrimeSeverityTable />
        </Suspense>
      </section>

      {/* Calgary Crime by Category */}
      <section>
        <SectionHeader
          title="Calgary Community Crime"
          icon={<BarChart3 size={16} />}
          category="safety"
        />
        <Suspense fallback={<LoadingCard />}>
          <CalgaryCrimeByCategoryChart />
        </Suspense>
      </section>

      {/* Calgary Crime Trend */}
      <section>
        <SectionHeader
          title="Calgary Crime Trend"
          icon={<TrendingUp size={16} />}
          category="safety"
        />
        <Suspense fallback={<LoadingCard />}>
          <CalgaryCrimeTrendChart />
        </Suspense>
      </section>

      {/* Coming Soon */}
      <section>
        <Card>
          <h3 className="text-sm font-medium mb-2">Coming Soon</h3>
          <div className="grid sm:grid-cols-2 gap-3 text-xs text-muted">
            <div className="flex items-start gap-2">
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
                PLANNED
              </span>
              <div>
                <p className="font-medium text-foreground">
                  Edmonton Police Data
                </p>
                <p>
                  Community crime mapping from Edmonton Police Service ArcGIS
                  Hub. Neighbourhood-level crime type breakdowns and trends.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
                PLANNED
              </span>
              <div>
                <p className="font-medium text-foreground">
                  StatsCan Detailed Incidents
                </p>
                <p>
                  Table 35-10-0177 — police-reported incidents by detailed
                  violation type for Census Metropolitan Areas. Full breakdown of
                  violent, property, and other criminal code violations.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
                PLANNED
              </span>
              <div>
                <p className="font-medium text-foreground">
                  Calgary Disorder Data
                </p>
                <p>
                  Community disorder statistics — social disorder, physical
                  disorder, and bylaw complaints by neighbourhood. Already
                  wired, UI coming soon.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
                PLANNED
              </span>
              <div>
                <p className="font-medium text-foreground">
                  Crime &amp; Property Value Correlation
                </p>
                <p>
                  Cross-reference CSI trends with residential sale prices to
                  identify neighbourhoods where safety improvements may signal
                  undervalued real estate.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </section>
    </main>
  );
}
