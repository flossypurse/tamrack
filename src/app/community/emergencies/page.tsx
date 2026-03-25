import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import {
  Siren,
  AlertTriangle,
  Shield,
  Bell,
  CheckCircle2,
} from "lucide-react";
import {
  fetchAlbertaEmergencyAlerts,
  fetchTrafficAlerts,
  type EmergencyAlert,
} from "@/lib/data-sources";

// ============================================================
// Loading fallback
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

// ============================================================
// Severity badge helper
// ============================================================

function SeverityBadge({ severity }: { severity: string }) {
  const s = severity.toLowerCase();
  let color = "bg-yellow-500/20 text-yellow-400";
  if (s.includes("high") || s.includes("extreme") || s.includes("warning")) {
    color = "bg-red-500/20 text-red-400";
  } else if (s.includes("moderate") || s.includes("watch")) {
    color = "bg-orange-500/20 text-orange-400";
  }
  return (
    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${color}`}>
      {severity}
    </span>
  );
}

// ============================================================
// Weather Alerts (server component)
// ============================================================

async function WeatherAlertsSection() {
  const alerts = await fetchAlbertaEmergencyAlerts().catch(() => [] as EmergencyAlert[]);

  if (alerts.length === 0) {
    return (
      <Card>
        <div className="flex items-center gap-3 py-6 justify-center">
          <CheckCircle2 className="w-8 h-8 text-accent-green" />
          <div>
            <p className="text-sm font-medium text-foreground">All Clear</p>
            <p className="text-xs text-muted">No active weather alerts for Alberta</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <Card key={alert.id}>
          <div className="flex items-start justify-between mb-2">
            <h4 className="text-sm font-medium text-foreground">{alert.title}</h4>
            <SeverityBadge severity={alert.severity} />
          </div>
          <p className="text-xs text-muted mb-3">{alert.description}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-muted/70">
            {alert.areas.length > 0 && (
              <span>Areas: {alert.areas.join(", ")}</span>
            )}
            {alert.effective && <span>Effective: {alert.effective}</span>}
            {alert.expires && <span>Expires: {alert.expires}</span>}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// Traffic Alerts (server component)
// ============================================================

async function TrafficAlertsSection() {
  const alerts = await fetchTrafficAlerts().catch(() => [] as { id: string; message: string; startTime: string; endTime: string; highImportance: boolean; regions: string[] }[]);

  if (alerts.length === 0) {
    return (
      <Card>
        <div className="flex items-center gap-3 py-6 justify-center">
          <CheckCircle2 className="w-8 h-8 text-accent-green" />
          <div>
            <p className="text-sm font-medium text-foreground">All Clear</p>
            <p className="text-xs text-muted">No active traffic alerts</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <Card
          key={alert.id}
          className={alert.highImportance ? "border-l-2 border-l-red-500" : ""}
        >
          <p className="text-sm text-foreground mb-2">{alert.message}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-muted/70">
            {alert.regions.length > 0 && (
              <span>Region: {alert.regions.join(", ")}</span>
            )}
            {alert.startTime && <span>Start: {alert.startTime}</span>}
            {alert.endTime && <span>End: {alert.endTime}</span>}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// Active Alerts Count (server component)
// ============================================================

async function ActiveAlertsCounts() {
  const [weatherAlerts, trafficAlerts] = await Promise.all([
    fetchAlbertaEmergencyAlerts().catch(() => [] as EmergencyAlert[]),
    fetchTrafficAlerts().catch(() => []),
  ]);

  const highPriority = weatherAlerts.filter((a) => {
    const s = a.severity.toLowerCase();
    return s.includes("high") || s.includes("extreme") || s.includes("warning");
  }).length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <MetricCard
        title="Weather Alerts"
        value={String(weatherAlerts.length)}
        source="ECCC"
      />
      <MetricCard
        title="Traffic Alerts"
        value={String(trafficAlerts.length)}
        source="511 Alberta"
      />
      <MetricCard
        title="High Priority"
        value={String(highPriority)}
        source="Warnings & Extreme"
      />
    </div>
  );
}

// ============================================================
// Page
// ============================================================

export const metadata: Metadata = {
  title: "Alberta Emergency & Weather Alerts",
  description: "Real-time emergency alerts and severe weather warnings for Alberta from the Canadian Alert Ready system.",
};

export default function EmergenciesPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <PageHeader
        title="Emergency Alerts"
        description="Real-time emergency and weather alerts across Alberta"
        category="safety"
        icon={<Siren size={20} />}
      />

      {/* Active Alerts Count */}
      <Suspense
        fallback={
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <LoadingCard />
            <LoadingCard />
            <LoadingCard />
          </div>
        }
      >
        <ActiveAlertsCounts />
      </Suspense>

      {/* Weather Alerts */}
      <section>
        <SectionHeader title="Weather Alerts" icon={<AlertTriangle size={16} />} category="safety" />
        <Suspense fallback={<LoadingCard />}>
          <WeatherAlertsSection />
        </Suspense>
      </section>

      {/* 511 Traffic Alerts */}
      <section>
        <SectionHeader title="511 Traffic Alerts" icon={<Bell size={16} />} category="safety" />
        <Suspense fallback={<LoadingCard />}>
          <TrafficAlertsSection />
        </Suspense>
      </section>

      {/* Emergency Resources */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader
            title="Emergency Resources"
            badge="CONTACTS"
          />
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-foreground">Alberta Emergency Alert</p>
                <p className="text-xs text-muted">emergencyalert.alberta.ca</p>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <Siren className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-foreground">911</p>
                <p className="text-xs text-muted">For emergencies</p>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <Bell className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-foreground">511 Alberta</p>
                <p className="text-xs text-muted">Road conditions &amp; traffic</p>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-foreground">Alberta Wildfire Status</p>
                <p className="text-xs text-muted">wildfire.alberta.ca</p>
              </div>
            </li>
            <li className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-foreground">Alberta Rivers Forecast Centre</p>
                <p className="text-xs text-muted">rivers.alberta.ca</p>
              </div>
            </li>
          </ul>
        </Card>

        {/* Alert Categories */}
        <Card>
          <CardHeader
            title="Alert Categories"
            badge="TYPES"
          />
          <ul className="space-y-2 text-xs text-muted">
            <li>
              <span className="font-medium text-foreground">Weather</span> — Environment and Climate Change Canada (ECCC) warnings, watches, and advisories
            </li>
            <li>
              <span className="font-medium text-foreground">Wildfire</span> — Alberta Forestry and Parks wildfire alerts and status updates
            </li>
            <li>
              <span className="font-medium text-foreground">Flood</span> — Alberta River Forecast Centre advisories and high-water warnings
            </li>
            <li>
              <span className="font-medium text-foreground">AMBER Alert</span> — Missing child alerts issued through the Alberta Emergency Alert system
            </li>
            <li>
              <span className="font-medium text-foreground">Air Quality</span> — Health advisories from Alberta Environment and Protected Areas
            </li>
            <li>
              <span className="font-medium text-foreground">Industrial Incident</span> — Hazardous material releases and industrial emergencies
            </li>
          </ul>
        </Card>
      </section>

      {/* Footer */}
      <footer className="text-center text-[10px] text-muted/50 font-mono pt-4 pb-8">
        Alberta Pulse Check — Emergencies — Data from ECCC &amp; 511 Alberta
      </footer>
    </main>
  );
}
