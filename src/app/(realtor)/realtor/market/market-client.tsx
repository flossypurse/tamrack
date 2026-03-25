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
  Legend,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Building2,
  Home,
  DollarSign,
  Users,
} from "lucide-react";
import type {
  RealtorMarketSnapshot,
  RealtorMetric,
} from "@/lib/realtor/market-data";
import type { PermitSummary } from "@/lib/municipality-data";

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
    <div className="h-10 w-full mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
        >
          <defs>
            <linearGradient
              id={`sp-${color.replace("#", "")}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-card)",
              border: "1px solid var(--color-card-border)",
              borderRadius: "6px",
              fontSize: "10px",
            }}
            formatter={(value: number) => [value.toLocaleString(), ""]}
            labelFormatter={(label: string) => label}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#sp-${color.replace("#", "")})`}
            dot={false}
            animationDuration={300}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Change indicator
// ---------------------------------------------------------------------------

function ChangeIndicator({ change }: { change?: string }) {
  if (!change) return null;
  const isPositive = change.startsWith("+");
  const isNegative = change.startsWith("-");
  const Icon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${
        isPositive
          ? "text-emerald-400"
          : isNegative
            ? "text-red-400"
            : "text-muted"
      }`}
    >
      <Icon size={10} />
      {change}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Headline metric card
// ---------------------------------------------------------------------------

function HeadlineCard({
  metric,
  icon: Icon,
}: {
  metric: RealtorMetric;
  icon: React.ComponentType<{ size: number; className?: string }>;
}) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-1.5">
          <Icon size={14} className="text-teal-400" />
          <p className="text-[11px] text-muted leading-tight">{metric.label}</p>
        </div>
        <ChangeIndicator change={metric.change} />
      </div>
      <p className="text-2xl font-bold tracking-tight mt-1.5">
        {metric.formatted}
      </p>
      {metric.period && (
        <p className="text-[10px] text-muted/60 mt-0.5">{metric.period}</p>
      )}
      <Sparkline data={metric.trend} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-municipality breakdown table
// ---------------------------------------------------------------------------

function MunicipalityBreakdown({
  data,
}: {
  data: RealtorMarketSnapshot["perMunicipality"];
}) {
  if (data.length <= 1) return null;
  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-card-border">
        <h3 className="text-sm font-semibold">By Municipality</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-card-border/50">
              <th className="text-left px-4 py-2 text-[11px] font-medium text-muted">
                Municipality
              </th>
              <th className="text-right px-4 py-2 text-[11px] font-medium text-muted">
                Avg Sale Price
              </th>
              <th className="text-right px-4 py-2 text-[11px] font-medium text-muted">
                Permits
              </th>
              <th className="text-right px-4 py-2 text-[11px] font-medium text-muted">
                Starts
              </th>
              <th className="text-right px-4 py-2 text-[11px] font-medium text-muted">
                Assessment Base
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((m) => (
              <tr
                key={m.slug}
                className="border-b border-card-border/30 hover:bg-card-border/10 transition-colors"
              >
                <td className="px-4 py-2 font-medium">{m.name}</td>
                <td className="text-right px-4 py-2">
                  <span>{m.avgSalePrice.formatted}</span>
                  {m.avgSalePrice.change && (
                    <span
                      className={`ml-1.5 text-[10px] ${
                        m.avgSalePrice.change.startsWith("+")
                          ? "text-emerald-400"
                          : "text-red-400"
                      }`}
                    >
                      {m.avgSalePrice.change}
                    </span>
                  )}
                </td>
                <td className="text-right px-4 py-2">
                  {m.buildingPermits.formatted}
                </td>
                <td className="text-right px-4 py-2">
                  {m.housingStarts.formatted}
                </td>
                <td className="text-right px-4 py-2">
                  {m.assessmentBase.formatted}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Permit activity
// ---------------------------------------------------------------------------

function PermitActivity({
  data,
}: {
  data: { slug: string; name: string; permits: PermitSummary[] }[];
}) {
  if (data.length === 0) return null;

  return (
    <div className="bg-card border border-card-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Building2 size={16} className="text-teal-400" />
        <h3 className="text-sm font-semibold">Permit Activity</h3>
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
              {muni.permits.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-xs py-1 border-b border-card-border/30 last:border-0"
                >
                  <span className="text-muted truncate max-w-[200px]">
                    {p.group}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{p.count}</span>
                    {p.totalValue > 0 && (
                      <span className="text-muted text-[10px]">
                        $
                        {p.totalValue >= 1_000_000
                          ? `${(p.totalValue / 1_000_000).toFixed(1)}M`
                          : `${(p.totalValue / 1_000).toFixed(0)}K`}
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
// Rental market (CMHC)
// ---------------------------------------------------------------------------

function RentalMarket({ data }: { data: RealtorMarketSnapshot["rental"] }) {
  const hasVacancy = data.vacancyRates.length > 0;
  const hasRents = data.rents.length > 0;
  if (!hasVacancy && !hasRents) return null;

  const latestRent = hasRents ? data.rents[data.rents.length - 1] : null;

  return (
    <div className="bg-card border border-card-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Home size={16} className="text-teal-400" />
        <h3 className="text-sm font-semibold">Rental Market</h3>
        <span className="text-[10px] text-muted ml-auto">CMHC via StatsCan</span>
      </div>

      {hasVacancy && (
        <div className="mb-4">
          <p className="text-[11px] text-muted mb-2">
            Vacancy Rate — Edmonton vs Calgary
          </p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data.vacancyRates}
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
                  tickFormatter={(v: number) => `${v}%`}
                  width={40}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-card-border)",
                    borderRadius: "8px",
                    fontSize: "11px",
                  }}
                  formatter={(value: number) => [`${value}%`, ""]}
                />
                <Legend wrapperStyle={{ fontSize: "10px" }} />
                <Area
                  type="monotone"
                  dataKey="edmonton"
                  name="Edmonton"
                  stroke="#14b8a6"
                  fill="#14b8a6"
                  fillOpacity={0.1}
                  strokeWidth={1.5}
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="calgary"
                  name="Calgary"
                  stroke="#f59e0b"
                  fill="#f59e0b"
                  fillOpacity={0.1}
                  strokeWidth={1.5}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {latestRent && (
        <div>
          <p className="text-[11px] text-muted mb-2">
            Average Rents — {latestRent.date}
          </p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  {
                    type: "Bachelor",
                    Edmonton: latestRent.edmontonBachelor,
                    Calgary: latestRent.calgaryBachelor,
                  },
                  {
                    type: "1-Bed",
                    Edmonton: latestRent.edmontonOneBed,
                    Calgary: latestRent.calgaryOneBed,
                  },
                  {
                    type: "2-Bed",
                    Edmonton: latestRent.edmontonTwoBed,
                    Calgary: latestRent.calgaryTwoBed,
                  },
                  {
                    type: "3-Bed",
                    Edmonton: latestRent.edmontonThreeBed,
                    Calgary: latestRent.calgaryThreeBed,
                  },
                ]}
                margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-card-border)"
                />
                <XAxis
                  dataKey="type"
                  tick={{ fontSize: 10, fill: "var(--color-muted)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--color-muted)" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `$${v}`}
                  width={50}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-card-border)",
                    borderRadius: "8px",
                    fontSize: "11px",
                  }}
                  formatter={(value: number) => [`$${value}`, ""]}
                />
                <Legend wrapperStyle={{ fontSize: "10px" }} />
                <Bar
                  dataKey="Edmonton"
                  fill="#14b8a6"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={32}
                />
                <Bar
                  dataKey="Calgary"
                  fill="#f59e0b"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Assessment trends (UAlberta)
// ---------------------------------------------------------------------------

function AssessmentTrends({
  data,
}: {
  data: RealtorMarketSnapshot["assessmentTrends"];
}) {
  if (data.length < 2) return null;

  return (
    <div className="bg-card border border-card-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <DollarSign size={16} className="text-teal-400" />
        <h3 className="text-sm font-semibold">Assessment Trends</h3>
        <span className="text-[10px] text-muted ml-auto">
          UAlberta Open Data
        </span>
      </div>
      <p className="text-[11px] text-muted mb-2">
        Avg neighbourhood assessment — Edmonton vs Calgary
      </p>
      <div className="h-44">
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
              dataKey="year"
              tick={{ fontSize: 10, fill: "var(--color-muted)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--color-muted)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) =>
                v >= 1_000_000
                  ? `$${(v / 1_000_000).toFixed(1)}M`
                  : `$${(v / 1_000).toFixed(0)}K`
              }
              width={60}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-card)",
                border: "1px solid var(--color-card-border)",
                borderRadius: "8px",
                fontSize: "11px",
              }}
              formatter={(value: number) => [
                `$${value.toLocaleString()}`,
                "",
              ]}
            />
            <Legend wrapperStyle={{ fontSize: "10px" }} />
            <Area
              type="monotone"
              dataKey="edmonton"
              name="Edmonton"
              stroke="#14b8a6"
              fill="#14b8a6"
              fillOpacity={0.1}
              strokeWidth={1.5}
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="calgary"
              name="Calgary"
              stroke="#f59e0b"
              fill="#f59e0b"
              fillOpacity={0.1}
              strokeWidth={1.5}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export function MarketDashboard({
  snapshot,
}: {
  snapshot: RealtorMarketSnapshot;
}) {
  const { headlines } = snapshot;
  const areaLabel =
    snapshot.municipalityNames.length === 1
      ? snapshot.municipalityNames[0]
      : `${snapshot.municipalityNames.length} municipalities`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-teal-400">
          <TrendingUp size={20} />
          <span className="text-xs font-mono uppercase tracking-wider">
            Market Intelligence
          </span>
        </div>
        <h1 className="text-2xl font-bold">Market Overview</h1>
        <p className="text-muted text-sm">
          Real-time market conditions across {areaLabel}. Updated daily from
          public sources.
        </p>
      </div>

      {/* Headline metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <HeadlineCard metric={headlines.avgSalePrice} icon={DollarSign} />
        <HeadlineCard metric={headlines.buildingPermits} icon={Building2} />
        <HeadlineCard metric={headlines.vacancyRate} icon={Home} />
        <HeadlineCard metric={headlines.housingStarts} icon={Building2} />
        <HeadlineCard metric={headlines.population} icon={Users} />
        <HeadlineCard metric={headlines.medianIncome} icon={DollarSign} />
      </div>

      {/* Per-municipality breakdown */}
      <MunicipalityBreakdown data={snapshot.perMunicipality} />

      {/* Permit activity + Rental market side by side on large screens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PermitActivity data={snapshot.permitActivity} />
        <RentalMarket data={snapshot.rental} />
      </div>

      {/* Assessment trends */}
      <AssessmentTrends data={snapshot.assessmentTrends} />

      {/* Data citation */}
      <p className="text-[10px] text-muted/50 font-mono">
        Data: regionaldashboard.alberta.ca · StatsCan (CMHC) · UAlberta Open
        Data · Municipal ArcGIS/Socrata · Generated{" "}
        {new Date(snapshot.generatedAt).toLocaleString("en-CA")}
      </p>
    </div>
  );
}
