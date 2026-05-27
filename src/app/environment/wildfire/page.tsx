import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import {
  Flame,
  AlertTriangle,
  TreePine,
  MapPin,
  Clock,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import {
  fetchActiveWildfires,
  fetchNonActiveWildfires,
  type ActiveFire,
} from "@/lib/data-sources";
import {
  fetchCWFISActiveFires,
  fetchWildfireYearlySummary,
  fetchWildfireCauseBreakdown,
  type CWFISFire,
  type WildfireYearlySummary,
  type WildfireCauseBreakdown,
} from "@/lib/data-sources-infrastructure";
import {
  FireCountAreaChart,
  HectaresBurnedBarChart,
  CauseBreakdownChart,
} from "./charts";
import { SITE_URL } from "@/lib/constants/site";

export const revalidate = 86400; // daily cache for historical data

// ============================================================
// Helpers
// ============================================================

function stageColor(stage: string) {
  const s = stage.toUpperCase();
  if (s === "OC" || s.includes("OUT OF CONTROL"))
    return { text: "text-red-500", bg: "bg-red-500/10" };
  if (s === "BH" || s.includes("BEING HELD"))
    return { text: "text-orange-400", bg: "bg-orange-500/10" };
  if (s === "UC" || s.includes("UNDER CONTROL"))
    return { text: "text-yellow-400", bg: "bg-yellow-500/10" };
  if (s === "TO" || s === "EX" || s.includes("TURNED OVER") || s.includes("EXTINGUISHED"))
    return { text: "text-green-400", bg: "bg-green-500/10" };
  return { text: "text-muted", bg: "bg-card-border/50" };
}

function stageBadge(stage: string) {
  const { text, bg } = stageColor(stage);
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${text} ${bg}`}>
      {stage}
    </span>
  );
}

function formatSize(ha: number): string {
  if (ha >= 1_000_000) return `${(ha / 1_000_000).toFixed(2)} M ha`;
  if (ha >= 1000) return `${(ha / 1000).toFixed(1)} K ha`;
  return `${ha.toLocaleString()} ha`;
}

function formatDate(iso: string): string {
  if (!iso) return "\u2014";
  try {
    return new Date(iso).toLocaleDateString("en-CA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "\u2014";
  }
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
// Active Fires Table (Alberta ArcGIS)
// ============================================================

async function ActiveFiresTable() {
  const fires = await fetchActiveWildfires().catch(() => [] as ActiveFire[]);

  if (fires.length === 0) {
    return (
      <Card>
        <CardHeader
          title="Active Wildfires"
          subtitle="No active wildfires reported"
        />
        <p className="text-sm text-muted">
          There are currently no active wildfires being tracked in Alberta. This
          is great news — check back during fire season (April\u2013October) for
          updates.
        </p>
      </Card>
    );
  }

  const sorted = [...fires].sort((a, b) => b.size - a.size);

  const totalArea = fires.reduce((sum, f) => sum + f.size, 0);
  const outOfControl = fires.filter(
    (f) => f.stageOfControl.toUpperCase() === "OC" || f.stageOfControl.toUpperCase().includes("OUT OF CONTROL")
  ).length;
  const beingHeld = fires.filter(
    (f) => f.stageOfControl.toUpperCase() === "BH" || f.stageOfControl.toUpperCase().includes("BEING HELD")
  ).length;

  return (
    <>
      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          title="Active Fires"
          value={fires.length.toString()}
          source="Alberta Wildfire ArcGIS"
        />
        <MetricCard
          title="Total Area Burned"
          value={formatSize(totalArea)}
          source="Active fires only"
        />
        <MetricCard
          title="Out of Control"
          value={outOfControl.toString()}
          source="Immediate concern"
        />
        <MetricCard
          title="Being Held"
          value={beingHeld.toString()}
          source="Contained perimeter"
        />
      </div>

      {/* Table */}
      <Card>
        <CardHeader
          title="Active Wildfires"
          subtitle={`${fires.length} fires currently being tracked`}
          badge="LIVE"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border text-left text-xs text-muted">
                <th className="pb-2 pr-4">Fire ID</th>
                <th className="pb-2 pr-4">Stage of Control</th>
                <th className="pb-2 pr-4 text-right">Size (ha)</th>
                <th className="pb-2 pr-4">Start Date</th>
                <th className="pb-2">Location</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((fire, i) => (
                <tr
                  key={`${fire.name}-${i}`}
                  className="border-b border-card-border/50 last:border-0"
                >
                  <td className="py-2 pr-4 font-medium">{fire.name}</td>
                  <td className="py-2 pr-4">{stageBadge(fire.stageOfControl)}</td>
                  <td className="py-2 pr-4 text-right font-mono text-xs">
                    {fire.size.toLocaleString()}
                  </td>
                  <td className="py-2 pr-4 text-xs text-muted">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(fire.startDate)}
                    </span>
                  </td>
                  <td className="py-2 text-xs text-muted">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {fire.latitude.toFixed(3)}, {fire.longitude.toFixed(3)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

// ============================================================
// Season Summary
// ============================================================

async function SeasonSummary() {
  const [active, nonActive] = await Promise.all([
    fetchActiveWildfires().catch(() => [] as ActiveFire[]),
    fetchNonActiveWildfires().catch(() => [] as ActiveFire[]),
  ]);

  const allFires = [...active, ...nonActive];
  const totalHectares = allFires.reduce((sum, f) => sum + f.size, 0);

  const breakdown: Record<string, number> = {};
  for (const f of allFires) {
    const stage = f.stageOfControl || "Unknown";
    breakdown[stage] = (breakdown[stage] || 0) + 1;
  }

  return (
    <Card>
      <CardHeader
        title="Season Summary"
        subtitle="All fires reported this season (active + non-active)"
      />
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-muted">Total Fires This Season</p>
          <p className="text-xl font-semibold">{allFires.length}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Total Hectares Burned</p>
          <p className="text-xl font-semibold">{formatSize(totalHectares)}</p>
        </div>
      </div>
      <div>
        <p className="text-xs text-muted mb-2">Breakdown by Stage of Control</p>
        <div className="space-y-1.5">
          {Object.entries(breakdown)
            .sort((a, b) => b[1] - a[1])
            .map(([stage, count]) => (
              <div key={stage} className="flex items-center gap-2">
                {stageBadge(stage)}
                <span className="text-sm font-mono">{count}</span>
              </div>
            ))}
        </div>
      </div>
      {allFires.length === 0 && (
        <p className="text-sm text-muted mt-2">
          No fires have been reported this season yet.
        </p>
      )}
    </Card>
  );
}

// ============================================================
// CWFIS Active Fires (Backup Source)
// ============================================================

async function CWFISActiveFiresSection() {
  const fires = await fetchCWFISActiveFires().catch(() => [] as CWFISFire[]);

  if (fires.length === 0) {
    return (
      <Card>
        <CardHeader
          title="CWFIS Active Fires"
          subtitle="Backup source from Natural Resources Canada"
        />
        <p className="text-sm text-muted">
          No active Alberta fires reported by CWFIS. This data source works
          year-round even when Alberta&apos;s seasonal ArcGIS service is offline.
        </p>
        <p className="text-xs text-muted mt-2">
          Source: Canadian Wildland Fire Information System (CWFIS) &mdash; Natural Resources Canada
        </p>
      </Card>
    );
  }

  const sorted = [...fires].sort((a, b) => b.hectares - a.hectares);
  const totalHectares = fires.reduce((sum, f) => sum + f.hectares, 0);

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <MetricCard
          title="CWFIS Active (AB)"
          value={fires.length.toString()}
          source="CWFIS / NRCan"
        />
        <MetricCard
          title="Total Hectares"
          value={formatSize(totalHectares)}
          source="CWFIS active fires"
        />
        <MetricCard
          title="Data Source"
          value="CWFIS"
          source="cwfif geoserver / NRCan"
        />
      </div>

      <Card>
        <CardHeader
          title="CWFIS Active Fires (Alberta)"
          subtitle="Complementary data from Natural Resources Canada's CWFIS \u2014 works year-round even when Alberta's seasonal service is offline."
          badge="BACKUP"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border text-left text-xs text-muted">
                <th className="pb-2 pr-4">Fire ID</th>
                <th className="pb-2 pr-4">Stage of Control</th>
                <th className="pb-2 pr-4 text-right">Size (ha)</th>
                <th className="pb-2 pr-4">Start Date</th>
                <th className="pb-2 pr-4">Response</th>
                <th className="pb-2">Location</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((fire, i) => (
                <tr
                  key={`cwfis-${fire.firename}-${i}`}
                  className="border-b border-card-border/50 last:border-0"
                >
                  <td className="py-2 pr-4 font-medium">
                    {fire.firename || "\u2014"}
                  </td>
                  <td className="py-2 pr-4">
                    {stageBadge(fire.stageOfControl || "Unknown")}
                  </td>
                  <td className="py-2 pr-4 text-right font-mono text-xs">
                    {fire.hectares.toLocaleString()}
                  </td>
                  <td className="py-2 pr-4 text-xs text-muted">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {fire.startdate || "\u2014"}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-xs text-muted">
                    {fire.responseType || "\u2014"}
                  </td>
                  <td className="py-2 text-xs text-muted">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {fire.lat.toFixed(3)}, {fire.lon.toFixed(3)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted mt-3">
          Source: Canadian Wildland Fire Information System (CWFIS) &mdash; Natural Resources Canada. Updated daily.
        </p>
      </Card>
    </>
  );
}

// ============================================================
// Historical Wildfire Trends
// ============================================================

async function HistoricalTrendsSection() {
  const yearly = await fetchWildfireYearlySummary().catch(
    () => [] as WildfireYearlySummary[]
  );

  if (yearly.length === 0) {
    return (
      <Card>
        <CardHeader
          title="Historical Wildfire Trends"
          subtitle="2006\u20132025"
        />
        <p className="text-sm text-muted">
          Historical wildfire data is currently unavailable. Check back later.
        </p>
      </Card>
    );
  }

  // Key stats
  const totalFires = yearly.reduce((sum, y) => sum + y.count, 0);
  const totalHectares = yearly.reduce((sum, y) => sum + y.totalHectares, 0);
  const avgPerYear = Math.round(totalFires / yearly.length);
  const worstByCount = yearly.reduce((a, b) => (b.count > a.count ? b : a));
  const worstByArea = yearly.reduce((a, b) =>
    b.totalHectares > a.totalHectares ? b : a
  );

  // Simple trend: compare last 5 years average to first 5 years average
  const firstFive = yearly.slice(0, 5);
  const lastFive = yearly.slice(-5);
  const firstAvg =
    firstFive.reduce((s, y) => s + y.count, 0) / (firstFive.length || 1);
  const lastAvg =
    lastFive.reduce((s, y) => s + y.count, 0) / (lastFive.length || 1);
  const trendPct = ((lastAvg - firstAvg) / (firstAvg || 1)) * 100;
  const trendDir =
    trendPct > 10 ? "Increasing" : trendPct < -10 ? "Decreasing" : "Stable";

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          title="Total Fires (2006-2025)"
          value={totalFires.toLocaleString()}
          source="Alberta Open Data"
        />
        <MetricCard
          title="Total Hectares Burned"
          value={formatSize(totalHectares)}
          source="2006-2025"
        />
        <MetricCard
          title="Average Fires/Year"
          value={avgPerYear.toLocaleString()}
          source={`${yearly.length} years`}
        />
        <MetricCard
          title="Trend Direction"
          value={trendDir}
          source={`${trendPct > 0 ? "+" : ""}${trendPct.toFixed(0)}% (last 5y vs first 5y)`}
        />
      </div>

      <Card>
        <CardHeader
          title="Fire Count by Year"
          subtitle={`${yearly[0]?.year}\u2013${yearly[yearly.length - 1]?.year} \u2014 Most fires in a single year: ${worstByCount.year} (${worstByCount.count.toLocaleString()})`}
        />
        <FireCountAreaChart data={yearly} height={280} />
        <p className="text-xs text-muted mt-2">
          Source: Alberta Historical Wildfire Data (Open Alberta)
        </p>
      </Card>

      <Card>
        <CardHeader
          title="Hectares Burned by Year"
          subtitle={`Worst year by area: ${worstByArea.year} (${formatSize(worstByArea.totalHectares)})`}
        />
        <HectaresBurnedBarChart data={yearly} height={280} />
        <p className="text-xs text-muted mt-2">
          Source: Alberta Historical Wildfire Data (Open Alberta)
        </p>
      </Card>
    </>
  );
}

// ============================================================
// Cause Analysis
// ============================================================

async function CauseAnalysisSection() {
  const causes = await fetchWildfireCauseBreakdown().catch(
    () => [] as WildfireCauseBreakdown[]
  );

  if (causes.length === 0) {
    return (
      <Card>
        <CardHeader
          title="Cause Analysis"
          subtitle="Wildfire causes breakdown"
        />
        <p className="text-sm text-muted">
          Cause data is currently unavailable. Check back later.
        </p>
      </Card>
    );
  }

  const totalFires = causes.reduce((sum, c) => sum + c.count, 0);
  const topCause = causes[0];

  return (
    <Card>
      <CardHeader
        title="Cause Analysis"
        subtitle="Historical wildfire causes (2006\u20132025)"
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart */}
        <div>
          <CauseBreakdownChart
            data={causes.filter((c) => c.count > 0)}
            height={Math.max(200, causes.filter((c) => c.count > 0).length * 40)}
          />
        </div>

        {/* Summary table */}
        <div>
          <p className="text-xs text-muted mb-3">
            Leading cause: <strong className="text-foreground">{topCause.cause}</strong>{" "}
            ({((topCause.count / totalFires) * 100).toFixed(1)}% of all fires)
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border text-left text-xs text-muted">
                <th className="pb-2 pr-4">Cause</th>
                <th className="pb-2 pr-4 text-right">Fires</th>
                <th className="pb-2 pr-4 text-right">% of Total</th>
                <th className="pb-2 text-right">Hectares</th>
              </tr>
            </thead>
            <tbody>
              {causes
                .filter((c) => c.count > 0)
                .map((c) => (
                  <tr
                    key={c.cause}
                    className="border-b border-card-border/50 last:border-0"
                  >
                    <td className="py-1.5 pr-4 font-medium">{c.cause}</td>
                    <td className="py-1.5 pr-4 text-right font-mono text-xs">
                      {c.count.toLocaleString()}
                    </td>
                    <td className="py-1.5 pr-4 text-right font-mono text-xs text-muted">
                      {((c.count / totalFires) * 100).toFixed(1)}%
                    </td>
                    <td className="py-1.5 text-right font-mono text-xs">
                      {formatSize(c.totalHectares)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-muted mt-3">
        Source: Alberta Historical Wildfire Data (Open Alberta) &mdash; 2006\u20132025
      </p>
    </Card>
  );
}

// ============================================================
// Page
// ============================================================

export const metadata: Metadata = {
  title: "Alberta Wildfire Watch",
  description: "Track active wildfires across Alberta in near real-time. Historical fire data, cause analysis, and regional wildfire risk indicators.",
  alternates: {
    canonical: `${SITE_URL}/environment/wildfire`,
  },
};

export default function WildfirePage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <PageHeader
        title="Wildfire Watch"
        description="Tracking active wildfires across Alberta in near real-time. Data refreshes hourly from Alberta Wildfire's ArcGIS service."
        category="environment"
        icon={<Flame size={20} />}
      />

      {/* Active fires — includes metrics + table */}
      <Suspense
        fallback={
          <div className="space-y-3">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <LoadingCard key={i} />
              ))}
            </div>
            <LoadingCard />
          </div>
        }
      >
        <ActiveFiresTable />
      </Suspense>

      {/* Season Summary */}
      <Suspense fallback={<LoadingCard />}>
        <SeasonSummary />
      </Suspense>

      {/* CWFIS Active Fires (Backup Source) */}
      <Suspense fallback={<LoadingCard />}>
        <CWFISActiveFiresSection />
      </Suspense>

      {/* Historical Wildfire Trends */}
      <Suspense
        fallback={
          <div className="space-y-3">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <LoadingCard key={i} />
              ))}
            </div>
            <LoadingCard />
            <LoadingCard />
          </div>
        }
      >
        <HistoricalTrendsSection />
      </Suspense>

      {/* Cause Analysis */}
      <Suspense fallback={<LoadingCard />}>
        <CauseAnalysisSection />
      </Suspense>

      {/* Historical Context */}
      <Card>
        <CardHeader
          title="Historical Context"
          subtitle="Alberta's wildfire history"
        />
        <div className="space-y-3 text-sm text-muted">
          <div className="flex items-start gap-2">
            <TreePine className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
            <p>
              Alberta&apos;s fire season typically runs from <strong className="text-foreground">April through
              October</strong>, with peak activity in May and June when dry conditions
              and lightning strikes converge.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <Flame className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <p>
              <strong className="text-foreground">2023 was record-breaking</strong> — over 2.2 million
              hectares burned across Alberta, making it the worst wildfire season
              in the province&apos;s history. More than 38,000 people were evacuated.
            </p>
          </div>
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
            <p>
              Climate change is increasing wildfire risk across western Canada.
              Hotter, drier summers and earlier snowmelt extend the fire season
              and create conditions for more intense fires.
            </p>
          </div>
        </div>
      </Card>

      {/* Alberta Wildfire Safety */}
      <Card>
        <CardHeader
          title="Wildfire Safety Resources"
          subtitle="Stay informed and stay safe"
        />
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-foreground font-medium">Alberta Emergency Alert</p>
              <p className="text-muted">
                Visit{" "}
                <a
                  href="https://www.alberta.ca/emergency"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline"
                >
                  alberta.ca/emergency
                </a>{" "}
                for official alerts, evacuation orders, and emergency updates.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-foreground font-medium">Evacuation Information</p>
              <p className="text-muted">
                If your area is under an evacuation order or alert, follow
                instructions from local authorities. Register with your local
                reception centre and monitor{" "}
                <a
                  href="https://wildfire.alberta.ca"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline"
                >
                  wildfire.alberta.ca
                </a>{" "}
                for the latest fire status updates.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Footer */}
      <p className="text-center text-xs text-muted py-4">
        Tamrack &mdash; Wildfire &mdash; Data from Alberta Wildfire
        ArcGIS, CWFIS (NRCan), and Alberta Open Data
      </p>
    </main>
  );
}
