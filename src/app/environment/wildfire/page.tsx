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
import {
  fetchActiveWildfires,
  fetchNonActiveWildfires,
  type ActiveFire,
} from "@/lib/data-sources";

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
  if (ha >= 1000) return `${(ha / 1000).toFixed(1)} K ha`;
  return `${ha.toLocaleString()} ha`;
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-CA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
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
// Active Fires Table
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
          is great news — check back during fire season (April–October) for
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
                <th className="pb-2 pr-4">Fire Name</th>
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
// Page
// ============================================================

export const metadata: Metadata = {
  title: "Alberta Wildfire Watch",
  description: "Track active wildfires across Alberta in near real-time. Historical fire data, cause analysis, and regional wildfire risk indicators.",
};

export default function WildfirePage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Flame className="w-6 h-6 text-orange-500" />
          Wildfire Watch
        </h1>
        <p className="text-sm text-muted mt-1">
          Tracking active wildfires across Alberta in near real-time. Data
          refreshes hourly from Alberta Wildfire&apos;s ArcGIS service.
        </p>
      </div>

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
        Alberta Pulse Check &mdash; Wildfire &mdash; Data from Alberta Wildfire
        ArcGIS
      </p>
    </main>
  );
}
