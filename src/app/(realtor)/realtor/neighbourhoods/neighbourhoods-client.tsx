"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  MapPin,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
} from "lucide-react";
import type { NeighbourhoodSnapshot, MuniNeighbourhoodData } from "@/lib/realtor/neighbourhood-data";

// ---------------------------------------------------------------------------
// Municipality Selector
// ---------------------------------------------------------------------------

function MunicipalitySelector({
  municipalities,
  selected,
  onSelect,
}: {
  municipalities: MuniNeighbourhoodData[];
  selected: string;
  onSelect: (slug: string) => void;
}) {
  if (municipalities.length <= 1) return null;

  return (
    <div className="relative">
      <select
        value={selected}
        onChange={(e) => onSelect(e.target.value)}
        className="appearance-none bg-card border border-card-border rounded-lg px-3 py-2 pr-8 text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500/30"
      >
        {municipalities.map((m) => (
          <option key={m.slug} value={m.slug}>
            {m.name}
            {m.hasUAlbertaData ? " (detailed)" : ""}
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
// Neighbourhood Cards (UAlberta data)
// ---------------------------------------------------------------------------

function NeighbourhoodCards({
  data,
}: {
  data: MuniNeighbourhoodData;
}) {
  const { neighbourhoods } = data;

  if (neighbourhoods.length === 0) {
    return (
      <div className="bg-card border border-card-border rounded-xl p-6 text-center">
        <MapPin size={24} className="mx-auto text-teal-400/30 mb-2" />
        <p className="text-sm text-muted">
          No neighbourhood data available for {data.name}.
        </p>
      </div>
    );
  }

  // Show top 30 neighbourhoods
  const displayed = neighbourhoods.slice(0, 30);

  return (
    <div className="space-y-4">
      {data.latestYear && (
        <p className="text-[11px] text-muted">
          {data.hasUAlbertaData ? "UAlberta Open Data" : "Municipal ArcGIS"} —{" "}
          {data.latestYear ? `${data.latestYear} assessments` : "Latest data"}
          {" · "}Showing top {displayed.length} of {neighbourhoods.length} neighbourhoods
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {displayed.map((n) => {
          const isPositive = n.yoyChange !== null && n.yoyChange > 0;
          const isNegative = n.yoyChange !== null && n.yoyChange < 0;
          const ChangeIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;

          return (
            <div
              key={n.neighbourhood}
              className="bg-card border border-card-border rounded-xl p-3 hover:border-teal-500/30 transition-colors"
            >
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
                    {n.yoyChange > 0 ? "+" : ""}{n.yoyChange}%
                  </span>
                )}
              </div>
              <p className="text-lg font-bold tracking-tight">
                ${n.avgAssessment >= 1_000_000
                  ? `${(n.avgAssessment / 1_000_000).toFixed(2)}M`
                  : `${(n.avgAssessment / 1_000).toFixed(0)}K`}
              </p>
              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted">
                <span>{n.propertyCount.toLocaleString()} properties</span>
                {n.avgLotSize > 0 && (
                  <span>{n.avgLotSize.toLocaleString()} m²</span>
                )}
                {n.avgYearBuilt > 0 && (
                  <span>~{n.avgYearBuilt}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Zoning Breakdown Chart
// ---------------------------------------------------------------------------

function ZoningBreakdown({
  data,
}: {
  data: MuniNeighbourhoodData;
}) {
  const { zoningBreakdown } = data;
  if (zoningBreakdown.length === 0) return null;

  const chartData = zoningBreakdown.slice(0, 12).map((z) => ({
    zone: z.group.length > 15 ? z.group.slice(0, 12) + "..." : z.group,
    count: z.count,
    avg: z.avgAssessment,
  }));

  return (
    <div className="bg-card border border-card-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <MapPin size={16} className="text-teal-400" />
        <h3 className="text-sm font-semibold">Assessment by Zoning</h3>
        <span className="text-[10px] text-muted ml-auto">Municipal ArcGIS</span>
      </div>
      <div className="h-56">
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
      {/* Table below chart */}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-card-border/50">
              <th className="text-left px-2 py-1 text-[11px] font-medium text-muted">Zone</th>
              <th className="text-right px-2 py-1 text-[11px] font-medium text-muted">Properties</th>
              <th className="text-right px-2 py-1 text-[11px] font-medium text-muted">Avg Assessment</th>
              <th className="text-right px-2 py-1 text-[11px] font-medium text-muted">Range</th>
            </tr>
          </thead>
          <tbody>
            {zoningBreakdown.slice(0, 15).map((z) => (
              <tr key={z.group} className="border-b border-card-border/30 hover:bg-card-border/10 transition-colors">
                <td className="px-2 py-1 font-medium truncate max-w-[150px]">{z.group}</td>
                <td className="text-right px-2 py-1">{z.count.toLocaleString()}</td>
                <td className="text-right px-2 py-1">
                  ${z.avgAssessment >= 1_000_000
                    ? `${(z.avgAssessment / 1_000_000).toFixed(1)}M`
                    : `${(z.avgAssessment / 1_000).toFixed(0)}K`}
                </td>
                <td className="text-right px-2 py-1 text-muted">
                  ${(z.minAssessment / 1_000).toFixed(0)}K – ${z.maxAssessment >= 1_000_000
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
// Main Client Component
// ---------------------------------------------------------------------------

export function NeighbourhoodsDashboard({
  snapshot,
}: {
  snapshot: NeighbourhoodSnapshot;
}) {
  const [selectedSlug, setSelectedSlug] = useState(
    snapshot.municipalities[0]?.slug || "",
  );

  const selectedMuni = snapshot.municipalities.find(
    (m) => m.slug === selectedSlug,
  ) || snapshot.municipalities[0];

  const areaLabel =
    snapshot.municipalityNames.length === 1
      ? snapshot.municipalityNames[0]
      : `${snapshot.municipalityNames.length} municipalities`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-teal-400">
          <MapPin size={20} />
          <span className="text-xs font-mono uppercase tracking-wider">
            Neighbourhoods
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Neighbourhood Deep Dives</h1>
            <p className="text-muted text-sm mt-1">
              Assessment rankings and property data across {areaLabel}.
            </p>
          </div>
          <MunicipalitySelector
            municipalities={snapshot.municipalities}
            selected={selectedSlug}
            onSelect={setSelectedSlug}
          />
        </div>
      </div>

      {/* Selected municipality content */}
      {selectedMuni && (
        <>
          {/* Neighbourhood cards */}
          <NeighbourhoodCards data={selectedMuni} />

          {/* Zoning breakdown (non-UAlberta municipalities) */}
          <ZoningBreakdown data={selectedMuni} />
        </>
      )}

      {/* Data citation */}
      <p className="text-[10px] text-muted/50 font-mono">
        Data: UAlberta Open Data Centre · Municipal ArcGIS · Generated{" "}
        {new Date(snapshot.generatedAt).toLocaleString("en-CA")}
      </p>
    </div>
  );
}
