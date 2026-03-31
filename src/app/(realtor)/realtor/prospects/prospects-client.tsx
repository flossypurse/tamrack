"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  Users,
  Building2,
  TrendingUp,
  TrendingDown,
  Minus,
  HardHat,
  MapPin,
  Flame,
} from "lucide-react";
import type { ProspectSnapshot } from "@/lib/realtor/prospect-data";

// ---------------------------------------------------------------------------
// Sparkline
// ---------------------------------------------------------------------------

function Sparkline({
  data,
  color = "#14b8a6",
}: {
  data: { date: string; value: number }[];
  color?: string;
}) {
  if (data.length < 2) return null;
  return (
    <div className="h-32">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-card-border)"
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "var(--color-muted)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--color-muted)" }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-card)",
              border: "1px solid var(--color-card-border)",
              borderRadius: "8px",
              fontSize: "11px",
            }}
            formatter={(value) => [Number(value).toLocaleString(), ""]}
          />
          <defs>
            <linearGradient id={`pv-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#pv-${color.replace("#", "")})`}
            dot={false}
            animationDuration={300}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recent Permits Feed
// ---------------------------------------------------------------------------

function RecentPermitsFeed({
  permits,
}: {
  permits: ProspectSnapshot["recentPermits"];
}) {
  if (permits.length === 0) {
    return (
      <div className="bg-card border border-card-border rounded-xl p-6 text-center">
        <Building2 size={24} className="mx-auto text-teal-400/30 mb-2" />
        <p className="text-sm text-muted">
          No recent permits found in your operating area.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-card-border flex items-center gap-2">
        <Building2 size={16} className="text-teal-400" />
        <h3 className="text-sm font-semibold">Recent Development Permits</h3>
        <span className="ml-auto text-[10px] text-muted">{permits.length} permits</span>
      </div>
      <div className="max-h-[420px] overflow-y-auto divide-y divide-card-border/30">
        {permits.map((p, i) => (
          <div key={i} className="px-4 py-3 hover:bg-card-border/10 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {p.type || p.description || "Permit"}
                </p>
                {p.address && (
                  <p className="text-xs text-muted truncate mt-0.5">{p.address}</p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-muted/70">{p.municipality}</span>
                  {p.date && (
                    <span className="text-[10px] text-muted/50">{p.date}</span>
                  )}
                </div>
              </div>
              {p.value > 0 && (
                <span className="text-xs font-medium text-teal-400 whitespace-nowrap">
                  ${p.value >= 1_000_000
                    ? `${(p.value / 1_000_000).toFixed(1)}M`
                    : p.value >= 1_000
                      ? `${(p.value / 1_000).toFixed(0)}K`
                      : p.value.toLocaleString()}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Permit Volume Chart
// ---------------------------------------------------------------------------

function PermitVolumeChart({
  data,
}: {
  data: ProspectSnapshot["permitVolumeTrend"];
}) {
  if (data.length < 2) return null;

  return (
    <div className="bg-card border border-card-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp size={16} className="text-teal-400" />
        <h3 className="text-sm font-semibold">Building Permit Volume</h3>
        <span className="text-[10px] text-muted ml-auto">Regional Dashboard</span>
      </div>
      <Sparkline data={data} color="#14b8a6" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Housing Starts Chart
// ---------------------------------------------------------------------------

function HousingStartsChart({
  data,
}: {
  data: ProspectSnapshot["housingStartsTrend"];
}) {
  if (data.length < 2) return null;

  return (
    <div className="bg-card border border-card-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <HardHat size={16} className="text-teal-400" />
        <h3 className="text-sm font-semibold">Housing Starts</h3>
        <span className="text-[10px] text-muted ml-auto">Regional Dashboard</span>
      </div>
      <Sparkline data={data} color="#f59e0b" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Construction Activity
// ---------------------------------------------------------------------------

function ConstructionActivity({
  data,
}: {
  data: ProspectSnapshot["construction"];
}) {
  if (data.length === 0) return null;

  return (
    <div className="bg-card border border-card-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <HardHat size={16} className="text-teal-400" />
        <h3 className="text-sm font-semibold">Active Construction</h3>
      </div>
      <div className="space-y-4">
        {data.map((muni) => (
          <div key={muni.slug}>
            {data.length > 1 && (
              <p className="text-[11px] font-medium text-muted mb-1.5">
                {muni.name}
              </p>
            )}
            <div className="space-y-1">
              {muni.projects.slice(0, 8).map((p, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-xs py-1 border-b border-card-border/30 last:border-0"
                >
                  <span className="truncate max-w-[250px]">
                    {p.project || "Unnamed Project"}
                  </span>
                  <div className="flex items-center gap-2">
                    {p.phase && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-teal-500/10 text-teal-400 rounded">
                        {p.phase}
                      </span>
                    )}
                    {p.location && (
                      <span className="text-[10px] text-muted truncate max-w-[120px]">
                        {p.location}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hot Zones
// ---------------------------------------------------------------------------

function HotZones({ zones }: { zones: ProspectSnapshot["hotZones"] }) {
  const activeZones = zones.filter((z) => z.score > 0);
  if (activeZones.length === 0) return null;

  return (
    <div className="bg-card border border-card-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Flame size={16} className="text-teal-400" />
        <h3 className="text-sm font-semibold">Hot Zones</h3>
        <span className="text-[10px] text-muted ml-auto">Activity ranking</span>
      </div>
      <div className="space-y-2">
        {activeZones.map((z, i) => {
          const isPositive = z.assessmentChange?.startsWith("+");
          const isNegative = z.assessmentChange?.startsWith("-");
          const ChangeIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;

          return (
            <div
              key={z.slug}
              className="flex items-center gap-3 py-2 border-b border-card-border/30 last:border-0"
            >
              <span className={`text-xs font-bold w-6 text-center ${
                i === 0 ? "text-teal-400" : i === 1 ? "text-teal-400/70" : "text-muted"
              }`}>
                #{i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{z.name}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  {z.permitCount > 0 && (
                    <span className="text-[10px] text-muted">
                      {z.permitCount} permits
                    </span>
                  )}
                  {z.constructionCount > 0 && (
                    <span className="text-[10px] text-muted">
                      {z.constructionCount} projects
                    </span>
                  )}
                </div>
              </div>
              {z.assessmentChange && (
                <span
                  className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${
                    isPositive
                      ? "text-emerald-400"
                      : isNegative
                        ? "text-red-400"
                        : "text-muted"
                  }`}
                >
                  <ChangeIcon size={10} />
                  {z.assessmentChange}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Assessment Trends Table
// ---------------------------------------------------------------------------

function AssessmentTrendsTable({
  data,
}: {
  data: ProspectSnapshot["assessmentTrends"];
}) {
  const withData = data.filter((d) => d.latestValue !== null);
  if (withData.length === 0) return null;

  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-card-border flex items-center gap-2">
        <MapPin size={16} className="text-teal-400" />
        <h3 className="text-sm font-semibold">Assessment Base by Municipality</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-card-border/50">
              <th className="text-left px-4 py-2 text-[11px] font-medium text-muted">Municipality</th>
              <th className="text-right px-4 py-2 text-[11px] font-medium text-muted">Assessment Base</th>
              <th className="text-right px-4 py-2 text-[11px] font-medium text-muted">Change</th>
            </tr>
          </thead>
          <tbody>
            {withData.map((d) => {
              const isPositive = d.change?.startsWith("+");
              const isNegative = d.change?.startsWith("-");
              return (
                <tr key={d.slug} className="border-b border-card-border/30 hover:bg-card-border/10 transition-colors">
                  <td className="px-4 py-2 font-medium">{d.name}</td>
                  <td className="text-right px-4 py-2">
                    {d.latestValue !== null
                      ? d.latestValue >= 1_000_000_000
                        ? `$${(d.latestValue / 1_000_000_000).toFixed(1)}B`
                        : d.latestValue >= 1_000_000
                          ? `$${(d.latestValue / 1_000_000).toFixed(1)}M`
                          : `$${(d.latestValue / 1_000).toFixed(0)}K`
                      : "—"}
                  </td>
                  <td className="text-right px-4 py-2">
                    {d.change ? (
                      <span className={isPositive ? "text-emerald-400" : isNegative ? "text-red-400" : "text-muted"}>
                        {d.change}
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Permit Breakdown (bar chart)
// ---------------------------------------------------------------------------

function PermitBreakdown({
  data,
}: {
  data: ProspectSnapshot["permitGroups"];
}) {
  if (data.length === 0) return null;

  // Combine top permit types across municipalities
  const combined = new Map<string, number>();
  for (const muni of data) {
    for (const p of muni.permits) {
      combined.set(p.group, (combined.get(p.group) || 0) + p.count);
    }
  }
  const topTypes = Array.from(combined.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([type, count]) => ({ type, count }));

  if (topTypes.length === 0) return null;

  return (
    <div className="bg-card border border-card-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Building2 size={16} className="text-teal-400" />
        <h3 className="text-sm font-semibold">Permits by Type</h3>
      </div>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={topTypes}
            layout="vertical"
            margin={{ top: 5, right: 10, bottom: 5, left: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-card-border)"
              horizontal={false}
            />
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: "var(--color-muted)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="type"
              tick={{ fontSize: 10, fill: "var(--color-muted)" }}
              axisLine={false}
              tickLine={false}
              width={120}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-card)",
                border: "1px solid var(--color-card-border)",
                borderRadius: "8px",
                fontSize: "11px",
              }}
            />
            <Bar
              dataKey="count"
              fill="#14b8a6"
              radius={[0, 3, 3, 0]}
              maxBarSize={20}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Client Component
// ---------------------------------------------------------------------------

export function ProspectsDashboard({
  snapshot,
}: {
  snapshot: ProspectSnapshot;
}) {
  const areaLabel =
    snapshot.municipalityNames.length === 1
      ? snapshot.municipalityNames[0]
      : `${snapshot.municipalityNames.length} municipalities`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-teal-400">
          <Users size={20} />
          <span className="text-xs font-mono uppercase tracking-wider">
            Prospects
          </span>
        </div>
        <h1 className="text-2xl font-bold">Prospect Tracker</h1>
        <p className="text-muted text-sm">
          Development permits, construction, and assessment changes across{" "}
          {areaLabel}. Identify motivated buyers and sellers.
        </p>
      </div>

      {/* Hot Zones + Permit Volume side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <HotZones zones={snapshot.hotZones} />
        <PermitVolumeChart data={snapshot.permitVolumeTrend} />
      </div>

      {/* Recent Permits Feed */}
      <RecentPermitsFeed permits={snapshot.recentPermits} />

      {/* Charts row: Permit Breakdown + Housing Starts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PermitBreakdown data={snapshot.permitGroups} />
        <HousingStartsChart data={snapshot.housingStartsTrend} />
      </div>

      {/* Construction Activity */}
      <ConstructionActivity data={snapshot.construction} />

      {/* Assessment Trends */}
      <AssessmentTrendsTable data={snapshot.assessmentTrends} />

      {/* Data citation */}
      <p className="text-[10px] text-muted/50 font-mono">
        Data: Municipal ArcGIS/Socrata · regionaldashboard.alberta.ca · Generated{" "}
        {new Date(snapshot.generatedAt).toLocaleString("en-CA")}
      </p>
    </div>
  );
}
