import { Suspense } from "react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import {
  Activity,
  AlertTriangle,
  MapPin,
  Clock,
  Zap,
} from "lucide-react";
import {
  fetchAlbertaEarthquakes,
  type Earthquake,
} from "@/lib/data-sources";

// ============================================================
// Helpers
// ============================================================

function getMagnitudeColor(mag: number): string {
  if (mag < 2.0) return "text-green-400";
  if (mag < 4.0) return "text-yellow-400";
  if (mag < 5.0) return "text-orange-400";
  return "text-red-500";
}

function getMagnitudeLabel(mag: number): string {
  if (mag < 2.0) return "Micro";
  if (mag < 4.0) return "Minor";
  if (mag < 5.0) return "Light";
  return "Moderate+";
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-CA", { year: "numeric", month: "short" });
}

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
// Key Metrics
// ============================================================

async function KeyMetrics() {
  const quakes = await fetchAlbertaEarthquakes(365).catch(() => [] as Earthquake[]);

  if (!quakes.length) {
    return (
      <Card>
        <CardHeader title="Key Metrics" subtitle="No earthquake data available" />
      </Card>
    );
  }

  const totalCount = quakes.length;
  const largest = Math.max(...quakes.map((q) => q.magnitude));
  const avgMag = (
    quakes.reduce((sum, q) => sum + q.magnitude, 0) / totalCount
  ).toFixed(1);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthCount = quakes.filter(
    (q) => new Date(q.time) >= startOfMonth
  ).length;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <MetricCard
        title="Total Earthquakes (Past Year)"
        value={totalCount.toLocaleString()}
        source="USGS"
      />
      <MetricCard
        title="Largest Magnitude"
        value={largest.toFixed(1)}
        source="USGS"
      />
      <MetricCard
        title="Average Magnitude"
        value={avgMag}
        source="USGS"
      />
      <MetricCard
        title="Earthquakes This Month"
        value={thisMonthCount.toLocaleString()}
        source="USGS"
      />
    </div>
  );
}

// ============================================================
// Recent Earthquakes Table
// ============================================================

async function RecentEarthquakesTable() {
  const quakes = await fetchAlbertaEarthquakes(365).catch(() => [] as Earthquake[]);

  if (!quakes.length) {
    return (
      <Card>
        <CardHeader title="Recent Earthquakes" subtitle="No data available" />
      </Card>
    );
  }

  const sorted = [...quakes].sort(
    (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
  );

  return (
    <Card>
      <CardHeader
        title="Recent Earthquakes"
        subtitle={`${sorted.length} events in the past year`}
        badge="LIVE"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr className="text-left text-muted border-b border-card-border">
              <th className="pb-2 pr-3">
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Date/Time
                </span>
              </th>
              <th className="pb-2 pr-3">
                <span className="inline-flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Magnitude
                </span>
              </th>
              <th className="pb-2 pr-3">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Location
                </span>
              </th>
              <th className="pb-2 pr-3">Depth (km)</th>
              <th className="pb-2">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-card-border/50">
            {sorted.map((q, i) => (
              <tr key={i} className="hover:bg-card-border/20 transition-colors">
                <td className="py-2 pr-3 whitespace-nowrap text-muted">
                  {formatDate(q.time)}
                </td>
                <td className={`py-2 pr-3 font-mono font-semibold ${getMagnitudeColor(q.magnitude)}`}>
                  {q.magnitude.toFixed(1)}
                  <span className="text-[10px] text-muted ml-1">
                    {getMagnitudeLabel(q.magnitude)}
                  </span>
                </td>
                <td className="py-2 pr-3 text-foreground">
                  {q.location || "Unknown"}
                </td>
                <td className="py-2 pr-3 font-mono text-muted">
                  {q.depth?.toFixed(1) ?? "—"}
                </td>
                <td className="py-2 text-muted font-mono text-[10px]">
                  {q.source || "USGS"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ============================================================
// Magnitude Distribution
// ============================================================

async function MagnitudeDistribution() {
  const quakes = await fetchAlbertaEarthquakes(365).catch(() => [] as Earthquake[]);

  if (!quakes.length) {
    return (
      <Card>
        <CardHeader title="Magnitude Distribution" subtitle="No data available" />
      </Card>
    );
  }

  const ranges = [
    { label: "Micro (<2.0)", color: "bg-green-400/20 text-green-400 border-green-400/30", count: 0 },
    { label: "Minor (2.0–3.9)", color: "bg-yellow-400/20 text-yellow-400 border-yellow-400/30", count: 0 },
    { label: "Light (4.0–4.9)", color: "bg-orange-400/20 text-orange-400 border-orange-400/30", count: 0 },
    { label: "Moderate (5.0+)", color: "bg-red-500/20 text-red-500 border-red-500/30", count: 0 },
  ];

  for (const q of quakes) {
    if (q.magnitude < 2.0) ranges[0].count++;
    else if (q.magnitude < 4.0) ranges[1].count++;
    else if (q.magnitude < 5.0) ranges[2].count++;
    else ranges[3].count++;
  }

  return (
    <Card>
      <CardHeader
        title="Magnitude Distribution"
        subtitle="Breakdown by magnitude range"
      />
      <div className="flex flex-wrap gap-3">
        {ranges.map((r) => (
          <div
            key={r.label}
            className={`px-3 py-2 rounded-lg border ${r.color} text-sm font-medium`}
          >
            <span className="text-lg font-semibold mr-1">{r.count}</span>
            {r.label}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ============================================================
// Monthly Trend
// ============================================================

async function MonthlyTrend() {
  const quakes = await fetchAlbertaEarthquakes(365).catch(() => [] as Earthquake[]);

  if (!quakes.length) {
    return (
      <Card>
        <CardHeader title="Monthly Trend" subtitle="No data available" />
      </Card>
    );
  }

  const monthCounts = new Map<string, number>();
  for (const q of quakes) {
    const key = getMonthKey(q.time);
    monthCounts.set(key, (monthCounts.get(key) || 0) + 1);
  }

  // Sort chronologically
  const sorted = [...monthCounts.entries()].sort((a, b) => {
    const da = new Date(a[0]);
    const db = new Date(b[0]);
    return da.getTime() - db.getTime();
  });

  const maxCount = Math.max(...sorted.map(([, c]) => c));

  return (
    <Card>
      <CardHeader
        title="Monthly Trend"
        subtitle="Earthquake count by month"
      />
      <div className="space-y-2">
        {sorted.map(([month, count]) => (
          <div key={month} className="flex items-center gap-3 text-sm">
            <span className="text-muted w-20 text-xs font-mono shrink-0">
              {month}
            </span>
            <div className="flex-1 h-5 bg-card-border/30 rounded overflow-hidden">
              <div
                className="h-full bg-accent/60 rounded transition-all"
                style={{ width: `${(count / maxCount) * 100}%` }}
              />
            </div>
            <span className="text-foreground font-mono text-xs w-8 text-right">
              {count}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ============================================================
// Induced Seismicity Context (static)
// ============================================================

function InducedSeismicityContext() {
  return (
    <Card>
      <CardHeader
        title="Induced Seismicity in Alberta"
        subtitle="Context for interpreting seismic data"
      />
      <div className="space-y-3 text-sm text-muted">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
          <p>
            Alberta has significant <strong className="text-foreground">induced seismicity</strong> from
            hydraulic fracturing (fracking) and wastewater disposal associated with oil and gas operations.
            These events are distinct from natural tectonic earthquakes.
          </p>
        </div>
        <div className="flex items-start gap-2">
          <Activity className="w-4 h-4 text-accent shrink-0 mt-0.5" />
          <p>
            The Alberta Energy Regulator (AER) monitors induced seismicity through the{" "}
            <strong className="text-foreground">RAVEN seismic monitoring network</strong>. Operators
            can be ordered to reduce or cease operations if triggered seismicity exceeds defined
            magnitude thresholds.
          </p>
        </div>
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
          <p>
            Induced events are typically <strong className="text-foreground">below magnitude 4.0</strong>,
            but can be felt by nearby residents and occasionally cause minor damage. Areas with active
            unconventional drilling (e.g., Fox Creek, Red Deer corridor) see the highest concentration
            of induced events.
          </p>
        </div>
      </div>
    </Card>
  );
}

// ============================================================
// Page
// ============================================================

export default function EarthquakesPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Activity className="w-7 h-7 text-accent" />
          Seismic Activity
        </h1>
        <p className="text-sm text-muted mt-1">
          Monitoring earthquakes in Alberta, including induced seismicity from oil and gas operations.
        </p>
      </div>

      {/* Key Metrics */}
      <Suspense fallback={<LoadingCard />}>
        <KeyMetrics />
      </Suspense>

      {/* Magnitude Distribution + Induced Context */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Suspense fallback={<LoadingCard />}>
          <MagnitudeDistribution />
        </Suspense>
        <InducedSeismicityContext />
      </div>

      {/* Monthly Trend */}
      <Suspense fallback={<LoadingCard />}>
        <MonthlyTrend />
      </Suspense>

      {/* Recent Earthquakes Table */}
      <Suspense fallback={<LoadingCard />}>
        <RecentEarthquakesTable />
      </Suspense>

      {/* Footer */}
      <footer className="text-center text-[10px] text-muted/50 font-mono pt-4 pb-8">
        Alberta Pulse Check — Seismic — Data from USGS Earthquake API
      </footer>
    </main>
  );
}
