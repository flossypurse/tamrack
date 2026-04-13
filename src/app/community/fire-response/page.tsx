import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import { ChartCard } from "@/components/chart-card";
import { computeTimeRange } from "@/lib/time-range";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import { TimeSeriesAreaChart, TimeSeriesBarChart } from "@/components/chart";
import { Flame, BarChart3, MapPin, AlertTriangle, Radio } from "lucide-react";
import {
  fetchEdmontonFireByType,
  fetchEdmontonFireByNeighbourhood,
  fetchEdmontonFireMonthlyTrend,
  fetchCWFISActiveFires,
  fetch511Alerts,
  type FireIncidentSummary,
  type ActiveFireCWFIS,
  type AlbertaAlert,
} from "@/lib/data-sources-fire";

export const metadata: Metadata = {
  title: "Alberta Fire & Emergency Response Data",
  description:
    "Edmonton fire and EMS incident data, active wildfire tracking, and Alberta emergency alerts. Real-time public safety intelligence.",
  alternates: {
    canonical: "https://albertapulsecheck.ca/community/fire-response",
  },
};

// ============================================================
// Event type labels
// ============================================================

const EVENT_TYPE_LABELS: Record<string, string> = {
  MD: "Medical",
  AL: "Alarms",
  TA: "Traffic Accidents",
  OF: "Outside Fires",
  CA: "Carbon Monoxide",
  FR: "Structure Fires",
  HZ: "Hazmat",
  VF: "Vehicle Fires",
};

function eventTypeLabel(code: string): string {
  return EVENT_TYPE_LABELS[code] || code;
}

// Stage of control labels for CWFIS
const STAGE_LABELS: Record<string, string> = {
  OC: "Out of Control",
  BH: "Being Held",
  UC: "Under Control",
  EX: "Extinguished",
};

function stageLabel(code: string): string {
  return STAGE_LABELS[code.toUpperCase()] || code;
}

function stageColor(code: string): string {
  switch (code.toUpperCase()) {
    case "OC":
      return "text-red-400";
    case "BH":
      return "text-amber-400";
    case "UC":
      return "text-blue-400";
    case "EX":
      return "text-green-400";
    default:
      return "text-muted";
  }
}

// ============================================================
// Server-side data fetching
// ============================================================

async function getFireMetrics() {
  const [byType, activeFires, alerts, trend] = await Promise.all([
    fetchEdmontonFireByType().catch(() => [] as FireIncidentSummary[]),
    fetchCWFISActiveFires().catch(() => [] as ActiveFireCWFIS[]),
    fetch511Alerts().catch(() => [] as AlbertaAlert[]),
    fetchEdmontonFireMonthlyTrend(1).catch(
      () => [] as { date: string; value: number }[]
    ),
  ]);

  const totalIncidents = byType.reduce((sum, t) => sum + t.count, 0);

  // Weighted average duration across all types
  const totalWeightedDuration = byType.reduce(
    (sum, t) => sum + t.avgDuration * t.count,
    0
  );
  const avgDuration =
    totalIncidents > 0
      ? Math.round((totalWeightedDuration / totalIncidents) * 10) / 10
      : 0;

  return {
    totalIncidents: totalIncidents > 0 ? totalIncidents.toLocaleString() : "--",
    avgDuration: avgDuration > 0 ? `${avgDuration} min` : "--",
    activeWildfires: String(activeFires.length),
    alertCount: String(alerts.length),
  };
}

// ============================================================
// Dashboard sections
// ============================================================

async function FireMetrics() {
  const m = await getFireMetrics();
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Edmonton Incidents"
        value={m.totalIncidents}
        source="Edmonton Open Data (all time)"
      />
      <MetricCard
        title="Avg Event Duration"
        value={m.avgDuration}
        source="Edmonton Fire Rescue"
      />
      <MetricCard
        title="Active Wildfires (AB)"
        value={m.activeWildfires}
        source="CWFIS"
      />
      <MetricCard
        title="511 Alberta Alerts"
        value={m.alertCount}
        source="511.alberta.ca"
      />
    </div>
  );
}

async function IncidentsByTypeSection() {
  const data = await fetchEdmontonFireByType();
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader title="Edmonton Fire Incidents by Type" badge="LIVE" />
        <p className="text-xs text-muted">No incident data available</p>
      </Card>
    );
  }

  // Find max for relative bar widths
  const maxCount = Math.max(...data.map((d) => d.count));

  return (
    <ChartCard chartId="fire-incidents-by-type" title="Edmonton Fire Incidents by Type" source="City of Edmonton">
      <Card>
        <CardHeader
          title="Edmonton Fire Incidents by Type"
          subtitle="All-time incident counts by event type from Edmonton Fire Rescue Services"
          badge="LIVE"
        />
        <div className="space-y-2">
          {data.map((item) => (
            <div key={item.eventType} className="flex items-center gap-3">
              <div className="w-24 sm:w-32 text-xs text-muted truncate shrink-0">
                {eventTypeLabel(item.eventType)}
              </div>
              <div className="flex-1 h-6 bg-card-border/30 rounded-sm overflow-hidden">
                <div
                  className="h-full rounded-sm"
                  style={{
                    width: `${(item.count / maxCount) * 100}%`,
                    backgroundColor: item.eventType === "MD" ? "#ef4444" :
                      item.eventType === "AL" ? "#f59e0b" :
                      item.eventType === "TA" ? "#3b82f6" :
                      item.eventType === "FR" ? "#f97316" :
                      item.eventType === "OF" ? "#ec4899" :
                      item.eventType === "HZ" ? "#8b5cf6" :
                      item.eventType === "VF" ? "#14b8a6" :
                      item.eventType === "CA" ? "#6366f1" :
                      "#6b7280",
                  }}
                />
              </div>
              <div className="w-20 text-xs text-right font-mono tabular-nums">
                {item.count.toLocaleString()}
              </div>
              <div className="w-20 text-[10px] text-muted text-right hidden sm:block">
                ~{item.avgDuration} min
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted/60 mt-3">
          MD = Medical, AL = Alarms, TA = Traffic Accidents, OF = Outside Fires, FR = Structure Fires, HZ = Hazmat, VF = Vehicle Fires, CA = Carbon Monoxide
        </p>
      </Card>
    </ChartCard>
  );
}

async function MonthlyTrendSection() {
  const data = await fetchEdmontonFireMonthlyTrend(3);
  return (
    <ChartCard chartId="fire-monthly-trend" title="Edmonton Fire/EMS Monthly Call Volume" timeRange={computeTimeRange(data)} source="City of Edmonton">
      <Card>
        <CardHeader
          title="Monthly Call Volume"
          subtitle="Edmonton Fire Rescue Services monthly incident counts over the last 3 years"
          badge="LIVE"
        />
        <TimeSeriesAreaChart data={data} color="#ef4444" height={280} compact />
      </Card>
    </ChartCard>
  );
}

async function TopNeighbourhoodsSection() {
  const data = await fetchEdmontonFireByNeighbourhood(15);
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader title="Top Neighbourhoods by Incident Volume" badge="LIVE" />
        <p className="text-xs text-muted">No neighbourhood data available</p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Top Neighbourhoods by Incident Volume"
        subtitle="Edmonton neighbourhoods with the highest fire/EMS call volume"
        badge="LIVE"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-card-border text-muted">
              <th className="text-left py-2 pr-3 font-medium">#</th>
              <th className="text-left py-2 pr-3 font-medium">Neighbourhood</th>
              <th className="text-right py-2 pr-3 font-medium">Total Incidents</th>
              <th className="text-left py-2 font-medium hidden sm:table-cell">
                Most Common Type
              </th>
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 15).map((item, i) => (
              <tr
                key={item.neighbourhoodName}
                className="border-b border-card-border/50 hover:bg-card-border/20"
              >
                <td className="py-1.5 pr-3 text-muted">{i + 1}</td>
                <td className="py-1.5 pr-3 font-medium">
                  {item.neighbourhoodName}
                </td>
                <td className="py-1.5 pr-3 text-right font-mono tabular-nums">
                  {item.count.toLocaleString()}
                </td>
                <td className="py-1.5 text-muted hidden sm:table-cell">
                  {eventTypeLabel(item.topEventType) || "--"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted/60 mt-3">
        Source: Edmonton Open Data &mdash; Fire Rescue Services
      </p>
    </Card>
  );
}

async function ActiveWildfiresSection() {
  const fires = await fetchCWFISActiveFires();

  if (fires.length === 0) {
    return (
      <Card>
        <CardHeader title="Active Wildfires (Alberta)" badge="LIVE" />
        <div className="flex items-center gap-2 py-6 justify-center">
          <span className="text-green-400 text-sm">&#10003;</span>
          <p className="text-sm text-muted">
            No active wildfires reported in Alberta
          </p>
        </div>
        <p className="text-[10px] text-muted/60 text-center">
          Source: Canadian Wildland Fire Information System (CWFIS)
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Active Wildfires (Alberta)"
        subtitle={`${fires.length} active fire${fires.length === 1 ? "" : "s"} reported by CWFIS`}
        badge="LIVE"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-card-border text-muted">
              <th className="text-left py-2 pr-3 font-medium">Fire Name</th>
              <th className="text-right py-2 pr-3 font-medium">Hectares</th>
              <th className="text-left py-2 pr-3 font-medium">Status</th>
              <th className="text-left py-2 pr-3 font-medium hidden sm:table-cell">
                Start Date
              </th>
              <th className="text-right py-2 font-medium hidden md:table-cell">
                Lat / Lon
              </th>
            </tr>
          </thead>
          <tbody>
            {fires.map((fire, i) => (
              <tr
                key={`${fire.fireName}-${i}`}
                className="border-b border-card-border/50 hover:bg-card-border/20"
              >
                <td className="py-1.5 pr-3 font-medium">
                  {fire.fireName || "Unnamed"}
                </td>
                <td className="py-1.5 pr-3 text-right font-mono tabular-nums">
                  {fire.hectares > 0 ? fire.hectares.toLocaleString() : "--"}
                </td>
                <td className={`py-1.5 pr-3 font-medium ${stageColor(fire.stageOfControl)}`}>
                  {stageLabel(fire.stageOfControl)}
                </td>
                <td className="py-1.5 pr-3 text-muted hidden sm:table-cell">
                  {fire.startDate || "--"}
                </td>
                <td className="py-1.5 text-right font-mono text-muted hidden md:table-cell">
                  {fire.lat.toFixed(2)}, {fire.lon.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted/60 mt-3">
        Source: Canadian Wildland Fire Information System &mdash; Updated daily during fire season
      </p>
    </Card>
  );
}

async function AlertsSection() {
  const alerts = await fetch511Alerts();

  if (alerts.length === 0) {
    return (
      <Card>
        <CardHeader title="Current Alberta Alerts" badge="LIVE" />
        <div className="flex items-center gap-2 py-6 justify-center">
          <span className="text-green-400 text-sm">&#10003;</span>
          <p className="text-sm text-muted">No active alerts</p>
        </div>
        <p className="text-[10px] text-muted/60 text-center">
          Source: 511.alberta.ca
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Current Alberta Alerts"
        subtitle={`${alerts.length} active alert${alerts.length === 1 ? "" : "s"}`}
        badge="LIVE"
      />
      <div className="space-y-3">
        {alerts.slice(0, 20).map((alert) => (
          <div
            key={alert.id}
            className={`p-3 rounded-lg border ${
              alert.highImportance
                ? "border-red-500/30 bg-red-500/5"
                : "border-card-border bg-card-border/10"
            }`}
          >
            <div className="flex items-start gap-2">
              {alert.highImportance && (
                <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">{alert.message}</p>
                {alert.notes && (
                  <p className="text-[10px] text-muted mt-1">{alert.notes}</p>
                )}
                <div className="flex items-center gap-3 mt-1.5">
                  {alert.regions.length > 0 && (
                    <span className="text-[10px] text-muted font-mono">
                      {alert.regions.join(", ")}
                    </span>
                  )}
                  {alert.startTime > 0 && (
                    <span className="text-[10px] text-muted/60">
                      Started: {new Date(alert.startTime).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted/60 mt-3">
        Source: 511.alberta.ca &mdash; Refreshed every 5 minutes
      </p>
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

export default function FireResponsePage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Fire & Emergency Response"
        description="Real-time fire and emergency response data from Edmonton Fire Rescue Services, plus active wildfire tracking across Alberta."
        category="safety"
        icon={<Flame size={20} />}
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
          <FireMetrics />
        </Suspense>
      </section>

      {/* Incidents by Type */}
      <section>
        <SectionHeader
          title="Incidents by Type"
          icon={<BarChart3 size={16} />}
          category="safety"
        />
        <Suspense fallback={<LoadingCard />}>
          <IncidentsByTypeSection />
        </Suspense>
      </section>

      {/* Monthly Trend */}
      <section>
        <SectionHeader
          title="Monthly Call Volume"
          icon={<Flame size={16} />}
          category="safety"
        />
        <Suspense fallback={<LoadingCard />}>
          <MonthlyTrendSection />
        </Suspense>
      </section>

      {/* Top Neighbourhoods */}
      <section>
        <SectionHeader
          title="Top Neighbourhoods"
          icon={<MapPin size={16} />}
          category="safety"
        />
        <Suspense fallback={<LoadingCard />}>
          <TopNeighbourhoodsSection />
        </Suspense>
      </section>

      {/* Active Wildfires */}
      <section>
        <SectionHeader
          title="Active Wildfires"
          icon={<AlertTriangle size={16} />}
          category="safety"
        />
        <Suspense fallback={<LoadingCard />}>
          <ActiveWildfiresSection />
        </Suspense>
      </section>

      {/* Current Alerts */}
      <section>
        <SectionHeader
          title="Alberta Alerts"
          icon={<Radio size={16} />}
          category="safety"
        />
        <Suspense fallback={<LoadingCard />}>
          <AlertsSection />
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
                <p className="font-medium text-foreground">Calgary Fire Data</p>
                <p>
                  Calgary open data has historical fire incidents but the dataset
                  ends in 2020. Will add once an updated source is available.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
                PLANNED
              </span>
              <div>
                <p className="font-medium text-foreground">
                  Municipality Fire Response
                </p>
                <p>
                  Fire response times and incident data from other Alberta
                  municipalities as open data becomes available.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </section>
    </main>
  );
}
