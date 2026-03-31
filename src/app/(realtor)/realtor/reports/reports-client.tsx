"use client";

import { useState, useRef } from "react";
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
  FileText,
  TrendingUp,
  TrendingDown,
  Minus,
  Building2,
  Home,
  DollarSign,
  Users,
  ChevronDown,
  Printer,
  MapPin,
} from "lucide-react";
import type {
  ReportSnapshot,
  ReportMetric,
  ReportNeighbourhood,
} from "@/lib/realtor/report-data";

// ---------------------------------------------------------------------------
// Municipality selector
// ---------------------------------------------------------------------------

function MunicipalitySelector({
  slugs,
  names,
  selected,
  onSelect,
}: {
  slugs: string[];
  names: string[];
  selected: string;
  onSelect: (slug: string) => void;
}) {
  if (slugs.length <= 1) return null;

  return (
    <div className="relative">
      <select
        value={selected}
        onChange={(e) => onSelect(e.target.value)}
        className="appearance-none bg-card border border-card-border rounded-lg px-3 py-2 pr-8 text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500/30"
      >
        {slugs.map((slug, i) => (
          <option key={slug} value={slug}>
            {names[i]}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Neighbourhood selector (Edmonton/Calgary)
// ---------------------------------------------------------------------------

function NeighbourhoodSelector({
  neighbourhoods,
  selected,
  onSelect,
}: {
  neighbourhoods: ReportNeighbourhood[];
  selected: string;
  onSelect: (name: string) => void;
}) {
  if (neighbourhoods.length === 0) return null;

  return (
    <div className="relative">
      <select
        value={selected}
        onChange={(e) => onSelect(e.target.value)}
        className="appearance-none bg-card border border-card-border rounded-lg px-3 py-2 pr-8 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500/30 max-w-xs"
      >
        <option value="">All neighbourhoods (top 20)</option>
        {neighbourhoods.slice(0, 100).map((n) => (
          <option key={n.neighbourhood} value={n.neighbourhood}>
            {n.neighbourhood}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
      />
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
              id={`rpt-${color.replace("#", "")}`}
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
            formatter={(value) => [Number(value).toLocaleString(), ""]}
            labelFormatter={(label) => label}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#rpt-${color.replace("#", "")})`}
            dot={false}
            animationDuration={300}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Headline metric card
// ---------------------------------------------------------------------------

function HeadlineCard({
  metric,
  icon: Icon,
}: {
  metric: ReportMetric;
  icon: React.ComponentType<{ size: number; className?: string }>;
}) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-4 print:border-gray-300 print:shadow-none">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-1.5">
          <Icon size={14} className="text-teal-400 print:text-teal-600" />
          <p className="text-[11px] text-muted leading-tight print:text-gray-600">
            {metric.label}
          </p>
        </div>
        <ChangeIndicator change={metric.change} />
      </div>
      <p className="text-2xl font-bold tracking-tight mt-1.5 print:text-black">
        {metric.formatted}
      </p>
      {metric.period && (
        <p className="text-[10px] text-muted/60 mt-0.5">{metric.period}</p>
      )}
      <div className="print:hidden">
        <Sparkline data={metric.trend} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Permit activity summary
// ---------------------------------------------------------------------------

function PermitSummaryCard({
  permits,
}: {
  permits: ReportSnapshot["permitActivity"];
}) {
  if (permits.length === 0) return null;

  return (
    <div className="bg-card border border-card-border rounded-xl p-4 print:border-gray-300">
      <div className="flex items-center gap-2 mb-3">
        <Building2 size={16} className="text-teal-400 print:text-teal-600" />
        <h3 className="text-sm font-semibold">Permit Activity</h3>
      </div>
      <div className="space-y-1">
        {permits.map((p, i) => (
          <div
            key={i}
            className="flex items-center justify-between text-xs py-1 border-b border-card-border/30 last:border-0 print:border-gray-200"
          >
            <span className="text-muted truncate max-w-[200px] print:text-gray-600">
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
  );
}

// ---------------------------------------------------------------------------
// Neighbourhood assessment card
// ---------------------------------------------------------------------------

function NeighbourhoodCard({ n }: { n: ReportNeighbourhood }) {
  const isPositive = n.yoyChange !== null && n.yoyChange > 0;
  const isNegative = n.yoyChange !== null && n.yoyChange < 0;
  const ChangeIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;

  return (
    <div className="bg-card border border-card-border rounded-xl p-3 hover:border-teal-500/30 transition-colors print:border-gray-300">
      <div className="flex items-start justify-between mb-2">
        <p className="text-sm font-medium truncate max-w-[180px]">
          {n.neighbourhood}
        </p>
        {n.yoyChange !== null && (
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
            {n.yoyChange > 0 ? "+" : ""}
            {n.yoyChange}%
          </span>
        )}
      </div>
      <p className="text-lg font-bold tracking-tight">
        $
        {n.avgAssessment >= 1_000_000
          ? `${(n.avgAssessment / 1_000_000).toFixed(2)}M`
          : `${(n.avgAssessment / 1_000).toFixed(0)}K`}
      </p>
      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted">
        <span>{n.propertyCount.toLocaleString()} properties</span>
        {n.avgLotSize > 0 && <span>{n.avgLotSize.toLocaleString()} m²</span>}
        {n.avgYearBuilt > 0 && <span>~{n.avgYearBuilt}</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Zoning breakdown chart
// ---------------------------------------------------------------------------

function ZoningBreakdownChart({
  data,
}: {
  data: ReportSnapshot["zoningBreakdown"];
}) {
  if (data.length === 0) return null;

  const chartData = data.slice(0, 10).map((z) => ({
    zone: z.group.length > 15 ? z.group.slice(0, 12) + "..." : z.group,
    count: z.count,
    avg: z.avgAssessment,
  }));

  return (
    <div className="bg-card border border-card-border rounded-xl p-4 print:border-gray-300">
      <div className="flex items-center gap-2 mb-3">
        <MapPin size={16} className="text-teal-400 print:text-teal-600" />
        <h3 className="text-sm font-semibold">Assessment by Zoning</h3>
      </div>
      <div className="h-52 print:hidden">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
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
              tickFormatter={(v: number) =>
                v >= 1_000_000
                  ? `$${(v / 1_000_000).toFixed(1)}M`
                  : `$${(v / 1_000).toFixed(0)}K`
              }
            />
            <YAxis
              type="category"
              dataKey="zone"
              tick={{ fontSize: 10, fill: "var(--color-muted)" }}
              axisLine={false}
              tickLine={false}
              width={100}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-card)",
                border: "1px solid var(--color-card-border)",
                borderRadius: "8px",
                fontSize: "11px",
              }}
              formatter={(value, name) => [
                String(name) === "avg"
                  ? `$${Number(value).toLocaleString()}`
                  : Number(value).toLocaleString(),
                String(name) === "avg" ? "Avg Assessment" : "Properties",
              ]}
            />
            <Bar
              dataKey="avg"
              fill="#14b8a6"
              radius={[0, 3, 3, 0]}
              maxBarSize={18}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Print-friendly table */}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-card-border/50 print:border-gray-300">
              <th className="text-left px-2 py-1 text-[11px] font-medium text-muted">
                Zone
              </th>
              <th className="text-right px-2 py-1 text-[11px] font-medium text-muted">
                Properties
              </th>
              <th className="text-right px-2 py-1 text-[11px] font-medium text-muted">
                Avg Assessment
              </th>
              <th className="text-right px-2 py-1 text-[11px] font-medium text-muted">
                Range
              </th>
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 12).map((z) => (
              <tr
                key={z.group}
                className="border-b border-card-border/30 print:border-gray-200"
              >
                <td className="px-2 py-1 font-medium truncate max-w-[150px]">
                  {z.group}
                </td>
                <td className="text-right px-2 py-1">
                  {z.count.toLocaleString()}
                </td>
                <td className="text-right px-2 py-1">
                  $
                  {z.avgAssessment >= 1_000_000
                    ? `${(z.avgAssessment / 1_000_000).toFixed(1)}M`
                    : `${(z.avgAssessment / 1_000).toFixed(0)}K`}
                </td>
                <td className="text-right px-2 py-1 text-muted">
                  ${(z.minAssessment / 1_000).toFixed(0)}K – $
                  {z.maxAssessment >= 1_000_000
                    ? `${(z.maxAssessment / 1_000_000).toFixed(1)}M`
                    : `${(z.maxAssessment / 1_000).toFixed(0)}K`}
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
// Rental snapshot
// ---------------------------------------------------------------------------

function RentalSnapshot({
  rental,
}: {
  rental: ReportSnapshot["rental"];
}) {
  const hasVacancy = rental.vacancyRates.length > 0;
  const hasRents = rental.rents.length > 0;
  if (!hasVacancy && !hasRents) return null;

  const latestRent = hasRents ? rental.rents[rental.rents.length - 1] : null;

  return (
    <div className="bg-card border border-card-border rounded-xl p-4 print:border-gray-300">
      <div className="flex items-center gap-2 mb-3">
        <Home size={16} className="text-teal-400 print:text-teal-600" />
        <h3 className="text-sm font-semibold">Rental Market</h3>
        <span className="text-[10px] text-muted ml-auto">CMHC via StatsCan</span>
      </div>

      {hasVacancy && (
        <div className="mb-4 print:hidden">
          <p className="text-[11px] text-muted mb-2">
            Vacancy Rate — Edmonton vs Calgary
          </p>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={rental.vacancyRates}
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
                  formatter={(value) => [`${value}%`, ""]}
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
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-card-border/50 print:border-gray-300">
                  <th className="text-left px-2 py-1 text-[11px] font-medium text-muted">
                    Unit
                  </th>
                  <th className="text-right px-2 py-1 text-[11px] font-medium text-muted">
                    Edmonton
                  </th>
                  <th className="text-right px-2 py-1 text-[11px] font-medium text-muted">
                    Calgary
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    type: "Bachelor",
                    e: latestRent.edmontonBachelor,
                    c: latestRent.calgaryBachelor,
                  },
                  {
                    type: "1-Bed",
                    e: latestRent.edmontonOneBed,
                    c: latestRent.calgaryOneBed,
                  },
                  {
                    type: "2-Bed",
                    e: latestRent.edmontonTwoBed,
                    c: latestRent.calgaryTwoBed,
                  },
                  {
                    type: "3-Bed",
                    e: latestRent.edmontonThreeBed,
                    c: latestRent.calgaryThreeBed,
                  },
                ].map((r) => (
                  <tr
                    key={r.type}
                    className="border-b border-card-border/30 print:border-gray-200"
                  >
                    <td className="px-2 py-1 font-medium">{r.type}</td>
                    <td className="text-right px-2 py-1">
                      {r.e > 0 ? `$${r.e}` : "—"}
                    </td>
                    <td className="text-right px-2 py-1">
                      {r.c > 0 ? `$${r.c}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Client Component
// ---------------------------------------------------------------------------

export function ReportsDashboard({
  snapshots,
  operatingArea,
  municipalityNames,
}: {
  snapshots: Record<string, ReportSnapshot>;
  operatingArea: string[];
  municipalityNames: string[];
}) {
  const [selectedSlug, setSelectedSlug] = useState(operatingArea[0] || "");
  const [selectedNeighbourhood, setSelectedNeighbourhood] = useState("");
  const reportRef = useRef<HTMLDivElement>(null);

  const snapshot = snapshots[selectedSlug];
  if (!snapshot) return null;

  const displayNeighbourhoods = selectedNeighbourhood
    ? snapshot.neighbourhoods.filter(
        (n) => n.neighbourhood === selectedNeighbourhood,
      )
    : snapshot.neighbourhoods.slice(0, 20);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2 print:hidden">
        <div className="flex items-center gap-2 text-teal-400">
          <FileText size={20} />
          <span className="text-xs font-mono uppercase tracking-wider">
            Reports
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Client Reports</h1>
            <p className="text-muted text-sm mt-1">
              Generate market reports for listing presentations and client
              meetings.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <MunicipalitySelector
              slugs={operatingArea}
              names={municipalityNames}
              selected={selectedSlug}
              onSelect={(slug) => {
                setSelectedSlug(slug);
                setSelectedNeighbourhood("");
              }}
            />
            {snapshot.hasNeighbourhoodData && (
              <NeighbourhoodSelector
                neighbourhoods={snapshot.neighbourhoods}
                selected={selectedNeighbourhood}
                onSelect={setSelectedNeighbourhood}
              />
            )}
          </div>
        </div>
      </div>

      {/* Print button */}
      <div className="print:hidden">
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Printer size={16} />
          Print Report
        </button>
      </div>

      {/* Report content (printable) */}
      <div ref={reportRef} className="space-y-6 print:space-y-4">
        {/* Print header (only visible when printing) */}
        <div className="hidden print:block mb-6">
          <div className="flex items-center justify-between border-b-2 border-teal-600 pb-3">
            <div>
              <h1 className="text-xl font-bold text-black">
                Market Report — {snapshot.name}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Generated{" "}
                {new Date(snapshot.generatedAt).toLocaleDateString("en-CA", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-teal-600">
                Pulse Realtor
              </p>
              <p className="text-[10px] text-gray-400">albertapulsecheck.ca</p>
            </div>
          </div>
        </div>

        {/* Headline metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 print:grid-cols-3 print:gap-2">
          <HeadlineCard
            metric={snapshot.headlines.avgSalePrice}
            icon={DollarSign}
          />
          <HeadlineCard
            metric={snapshot.headlines.buildingPermits}
            icon={Building2}
          />
          <HeadlineCard
            metric={snapshot.headlines.housingStarts}
            icon={Building2}
          />
          <HeadlineCard
            metric={snapshot.headlines.vacancyRate}
            icon={Home}
          />
          <HeadlineCard
            metric={snapshot.headlines.assessmentBase}
            icon={DollarSign}
          />
          <HeadlineCard
            metric={snapshot.headlines.population}
            icon={Users}
          />
        </div>

        {/* Neighbourhood section (Edmonton/Calgary) */}
        {snapshot.hasNeighbourhoodData && displayNeighbourhoods.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <MapPin size={16} className="text-teal-400 print:text-teal-600" />
              <h3 className="text-sm font-semibold">
                Neighbourhood Assessments
              </h3>
              {snapshot.latestAssessmentYear && (
                <span className="text-[10px] text-muted ml-auto">
                  UAlberta Open Data — {snapshot.latestAssessmentYear}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 print:grid-cols-3 print:gap-2">
              {displayNeighbourhoods.map((n) => (
                <NeighbourhoodCard key={n.neighbourhood} n={n} />
              ))}
            </div>
          </div>
        )}

        {/* Zoning breakdown (non-Edmonton/Calgary) */}
        {!snapshot.hasNeighbourhoodData && (
          <ZoningBreakdownChart data={snapshot.zoningBreakdown} />
        )}

        {/* Permit activity + Rental side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 print:grid-cols-2 print:gap-2">
          <PermitSummaryCard permits={snapshot.permitActivity} />
          <RentalSnapshot rental={snapshot.rental} />
        </div>

        {/* Data citation */}
        <p className="text-[10px] text-muted/50 font-mono print:text-gray-400">
          Data: regionaldashboard.alberta.ca · StatsCan (CMHC) · UAlberta Open
          Data · Municipal ArcGIS/Socrata · Generated{" "}
          {new Date(snapshot.generatedAt).toLocaleString("en-CA")}
        </p>
      </div>
    </div>
  );
}
