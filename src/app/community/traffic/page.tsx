import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import {
  fetchRoadConditions,
  fetchTrafficEvents,
  fetchTrafficAlerts,
  fetchEdmontonTrafficDisruptions,
  fetchCalgaryTrafficIncidents,
  type RoadCondition,
  type TrafficEvent,
} from "@/lib/data-sources";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import {
  Car,
  AlertTriangle,
  Construction,
  Route,
  MapPin,
} from "lucide-react";

// ============================================================
// Helpers
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

function conditionColor(condition: string): string {
  const c = condition.toLowerCase();
  if (c.includes("bare") || c.includes("dry")) return "text-green-400";
  if (c.includes("partly covered") || c.includes("icy sections"))
    return "text-yellow-400";
  if (
    c.includes("covered") ||
    c.includes("snow covered") ||
    c.includes("ice covered")
  )
    return "text-orange-400";
  if (c.includes("closed") || c.includes("travel not recommended"))
    return "text-red-500";
  return "text-muted";
}

// ============================================================
// Key Metrics
// ============================================================

async function KeyMetrics() {
  const [roads, events, alerts] = await Promise.all([
    fetchRoadConditions().catch(() => []),
    fetchTrafficEvents().catch(() => []),
    fetchTrafficAlerts().catch(() => []),
  ]);

  const roadsArr = Array.isArray(roads) ? roads : [];
  const eventsArr = Array.isArray(events) ? events : [];
  const alertsArr = Array.isArray(alerts) ? alerts : [];

  const closedCount = roadsArr.filter((r: RoadCondition) => {
    const c = (r.primaryCondition || "").toLowerCase();
    return c.includes("closed") || c.includes("travel not recommended");
  }).length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <MetricCard
        title="Highways Reporting"
        value={roadsArr.length.toString()}
        source="511 Alberta"
      />
      <MetricCard
        title="Traffic Events"
        value={eventsArr.length.toString()}
        source="511 Alberta"
      />
      <MetricCard
        title="Active Alerts"
        value={alertsArr.length.toString()}
        source="511 Alberta"
      />
      <MetricCard
        title="Closed / Not Recommended"
        value={closedCount.toString()}
        change={closedCount > 0 ? `${closedCount} road${closedCount > 1 ? "s" : ""}` : undefined}
        source="511 Alberta"
      />
    </div>
  );
}

// ============================================================
// Road Conditions Table
// ============================================================

async function RoadConditionsSection() {
  const roads = await fetchRoadConditions().catch(() => []);
  const roadsArr = (Array.isArray(roads) ? roads : []) as RoadCondition[];

  if (roadsArr.length === 0) {
    return (
      <Card>
        <CardHeader title="Highway Conditions" subtitle="No data available" badge="511 AB" />
        <p className="text-sm text-muted">Unable to load road conditions.</p>
      </Card>
    );
  }

  const sorted = [...roadsArr]
    .sort((a, b) => (a.roadName || "").localeCompare(b.roadName || ""))
    .slice(0, 50);

  return (
    <Card>
      <CardHeader
        title="Highway Conditions"
        subtitle={`${roadsArr.length} highways reporting`}
        badge="511 AB"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-card-border text-muted">
              <th className="text-left py-2 pr-3 font-medium">Highway</th>
              <th className="text-left py-2 pr-3 font-medium">Area</th>
              <th className="text-left py-2 pr-3 font-medium">Condition</th>
              <th className="text-left py-2 pr-3 font-medium">Visibility</th>
              <th className="text-left py-2 font-medium">Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((road, i) => (
              <tr
                key={`${road.roadName}-${i}`}
                className="border-b border-card-border/50 hover:bg-card-border/20"
              >
                <td className="py-2 pr-3 font-mono">
                  <Route className="inline w-3 h-3 mr-1 text-muted" />
                  {road.roadName || "—"}
                </td>
                <td className="py-2 pr-3 text-muted">{road.area || "—"}</td>
                <td className={`py-2 pr-3 font-medium ${conditionColor(road.primaryCondition || "")}`}>
                  {road.primaryCondition || "—"}
                </td>
                <td className="py-2 pr-3 text-muted">{road.visibility || "—"}</td>
                <td className="py-2 text-muted">{road.lastUpdated || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {roadsArr.length > 50 && (
        <p className="text-[10px] text-muted/60 mt-2 font-mono">
          Showing 50 of {roadsArr.length} highways
        </p>
      )}
    </Card>
  );
}

// ============================================================
// Traffic Events
// ============================================================

async function TrafficEventsSection() {
  const events = await fetchTrafficEvents().catch(() => []);
  const eventsArr = (Array.isArray(events) ? events : []) as TrafficEvent[];

  if (eventsArr.length === 0) {
    return (
      <Card>
        <CardHeader title="Traffic Events" subtitle="No active events" badge="511 AB" />
        <p className="text-sm text-muted">No traffic events reported.</p>
      </Card>
    );
  }

  const recent = [...eventsArr]
    .sort((a, b) => {
      const da = a.startTime ? new Date(a.startTime).getTime() : 0;
      const db = b.startTime ? new Date(b.startTime).getTime() : 0;
      return db - da;
    })
    .slice(0, 20);

  return (
    <div>
      <SectionHeader title="Traffic Events" icon={<Construction size={16} />} category="safety" />
      <div className="grid gap-3 sm:grid-cols-2">
        {recent.map((event, i) => (
          <Card key={`event-${i}`}>
            <div className="flex items-start justify-between mb-2">
              <span className="text-[10px] font-mono bg-yellow-400/10 text-yellow-400 px-2 py-0.5 rounded-full">
                {event.type || "Event"}
              </span>
              {event.startTime && (
                <span className="text-[10px] text-muted">{event.startTime}</span>
              )}
            </div>
            <p className="text-sm text-foreground mb-1">{event.description || "—"}</p>
            {event.roadName && (
              <p className="text-xs text-muted flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {event.roadName}
              </p>
            )}
          </Card>
        ))}
      </div>
      {eventsArr.length > 20 && (
        <p className="text-[10px] text-muted/60 mt-2 font-mono">
          Showing 20 of {eventsArr.length} events
        </p>
      )}
    </div>
  );
}

// ============================================================
// Traffic Alerts
// ============================================================

async function TrafficAlertsSection() {
  const alerts = await fetchTrafficAlerts().catch(() => []);
  const alertsArr = Array.isArray(alerts) ? alerts : [];

  if (alertsArr.length === 0) {
    return null;
  }

  return (
    <div>
      <SectionHeader title="Traffic Alerts" icon={<AlertTriangle size={16} />} category="safety" />
      <div className="grid gap-3">
        {alertsArr.map((alert, i) => {
          const isHigh = alert.highImportance;
          return (
            <Card
              key={`alert-${i}`}
              className={isHigh ? "border-red-500/50" : ""}
            >
              <div className="flex items-start gap-3">
                <AlertTriangle
                  className={`w-5 h-5 mt-0.5 shrink-0 ${isHigh ? "text-red-500" : "text-yellow-400"}`}
                />
                <div className="min-w-0">
                  <p className="text-sm text-foreground">{alert.message || "—"}</p>
                  <div className="flex items-center gap-3 mt-1">
                    {alert.regions.length > 0 && (
                      <span className="text-xs text-muted">{alert.regions.join(", ")}</span>
                    )}
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                        isHigh
                          ? "bg-red-500/10 text-red-500"
                          : "bg-yellow-400/10 text-yellow-400"
                      }`}
                    >
                      {isHigh ? "HIGH" : "NORMAL"}
                    </span>
                    {alert.startTime && (
                      <span className="text-[10px] text-muted">{alert.startTime}</span>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Edmonton Disruptions
// ============================================================

async function EdmontonDisruptionsSection() {
  const disruptions = await fetchEdmontonTrafficDisruptions().catch(() => []);
  const arr = Array.isArray(disruptions) ? disruptions : [];

  if (arr.length === 0) {
    return (
      <Card>
        <CardHeader title="Edmonton Traffic Disruptions" subtitle="No active disruptions" badge="YEG" />
        <p className="text-sm text-muted">No disruptions reported.</p>
      </Card>
    );
  }

  const rows = arr.slice(0, 15);

  return (
    <Card>
      <CardHeader
        title="Edmonton Traffic Disruptions"
        subtitle={`${arr.length} active disruptions`}
        badge="YEG"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-card-border text-muted">
              <th className="text-left py-2 pr-3 font-medium">Description</th>
              <th className="text-left py-2 pr-3 font-medium">Location</th>
              <th className="text-left py-2 pr-3 font-medium">Start</th>
              <th className="text-left py-2 pr-3 font-medium">End</th>
              <th className="text-left py-2 font-medium">Type</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d: { description?: string; location?: string; startDate?: string; endDate?: string; type?: string }, i: number) => (
              <tr
                key={`edm-${i}`}
                className="border-b border-card-border/50 hover:bg-card-border/20"
              >
                <td className="py-2 pr-3 max-w-[200px] truncate">{d.description || "—"}</td>
                <td className="py-2 pr-3 text-muted max-w-[150px] truncate">{d.location || "—"}</td>
                <td className="py-2 pr-3 text-muted whitespace-nowrap">{d.startDate || "—"}</td>
                <td className="py-2 pr-3 text-muted whitespace-nowrap">{d.endDate || "—"}</td>
                <td className="py-2">
                  <span className="text-[10px] font-mono bg-accent/10 text-accent px-2 py-0.5 rounded-full">
                    {d.type || "—"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {arr.length > 15 && (
        <p className="text-[10px] text-muted/60 mt-2 font-mono">
          Showing 15 of {arr.length} disruptions
        </p>
      )}
    </Card>
  );
}

// ============================================================
// Calgary Incidents
// ============================================================

async function CalgaryIncidentsSection() {
  const incidents = await fetchCalgaryTrafficIncidents().catch(() => []);
  const arr = Array.isArray(incidents) ? incidents : [];

  if (arr.length === 0) {
    return (
      <Card>
        <CardHeader title="Calgary Traffic Incidents" subtitle="No active incidents" badge="YYC" />
        <p className="text-sm text-muted">No incidents reported.</p>
      </Card>
    );
  }

  const rows = arr.slice(0, 15);

  return (
    <Card>
      <CardHeader
        title="Calgary Traffic Incidents"
        subtitle={`${arr.length} active incidents`}
        badge="YYC"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-card-border text-muted">
              <th className="text-left py-2 pr-3 font-medium">Description</th>
              <th className="text-left py-2 pr-3 font-medium">Location</th>
              <th className="text-left py-2 pr-3 font-medium">Time</th>
              <th className="text-left py-2 pr-3 font-medium">Type</th>
              <th className="text-left py-2 font-medium">Quadrant</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((inc: { description?: string; location?: string; time?: string; type?: string; quadrant?: string }, i: number) => (
              <tr
                key={`yyc-${i}`}
                className="border-b border-card-border/50 hover:bg-card-border/20"
              >
                <td className="py-2 pr-3 max-w-[200px] truncate">{inc.description || "—"}</td>
                <td className="py-2 pr-3 text-muted max-w-[150px] truncate">{inc.location || "—"}</td>
                <td className="py-2 pr-3 text-muted whitespace-nowrap">{inc.time || "—"}</td>
                <td className="py-2 pr-3">
                  <span className="text-[10px] font-mono bg-accent/10 text-accent px-2 py-0.5 rounded-full">
                    {inc.type || "—"}
                  </span>
                </td>
                <td className="py-2 text-muted">{inc.quadrant || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {arr.length > 15 && (
        <p className="text-[10px] text-muted/60 mt-2 font-mono">
          Showing 15 of {arr.length} incidents
        </p>
      )}
    </Card>
  );
}

// ============================================================
// Page
// ============================================================

export const metadata: Metadata = {
  title: "Alberta Highway Conditions & Traffic",
  description: "Real-time highway conditions, road closures, and traffic events across Alberta's major transportation corridors.",
  alternates: {
    canonical: "https://albertapulsecheck.ca/community/traffic",
  },
};

export default function TrafficPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <PageHeader
        title="Traffic & Roads"
        description="Real-time highway conditions and traffic events across Alberta"
        category="safety"
        icon={<Car size={20} />}
      />

      {/* Key Metrics */}
      <Suspense fallback={<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <LoadingCard key={i} />)}</div>}>
        <KeyMetrics />
      </Suspense>

      {/* Traffic Alerts */}
      <Suspense fallback={<LoadingCard />}>
        <TrafficAlertsSection />
      </Suspense>

      {/* Road Conditions */}
      <Suspense fallback={<LoadingCard />}>
        <RoadConditionsSection />
      </Suspense>

      {/* Traffic Events */}
      <Suspense fallback={<LoadingCard />}>
        <TrafficEventsSection />
      </Suspense>

      {/* Edmonton + Calgary side by side on larger screens */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Suspense fallback={<LoadingCard />}>
          <EdmontonDisruptionsSection />
        </Suspense>
        <Suspense fallback={<LoadingCard />}>
          <CalgaryIncidentsSection />
        </Suspense>
      </div>
    </main>
  );
}
