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
  Home,
  MapPin,
  ChevronDown,
  Building2,
  DollarSign,
} from "lucide-react";
import type { TopProperty, AssessmentByGroup, VacantLot } from "@/lib/municipality-data";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MuniListingsData {
  slug: string;
  name: string;
  topProperties: TopProperty[];
  assessmentBreakdown: AssessmentByGroup[];
  vacantLots: VacantLot[];
}

export interface ListingsSnapshot {
  operatingArea: string[];
  municipalityNames: string[];
  generatedAt: string;
  municipalities: MuniListingsData[];
}

// ---------------------------------------------------------------------------
// Municipality Selector
// ---------------------------------------------------------------------------

function MunicipalitySelector({
  municipalities,
  selected,
  onSelect,
}: {
  municipalities: MuniListingsData[];
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
// Top Properties Table
// ---------------------------------------------------------------------------

function TopPropertiesTable({ properties }: { properties: TopProperty[] }) {
  if (properties.length === 0) {
    return (
      <div className="bg-card border border-card-border rounded-xl p-6 text-center">
        <Home size={24} className="mx-auto text-teal-400/30 mb-2" />
        <p className="text-sm text-muted">
          No property assessment data available for this municipality.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-card-border flex items-center gap-2">
        <DollarSign size={16} className="text-teal-400" />
        <h3 className="text-sm font-semibold">Top Assessed Properties</h3>
        <span className="ml-auto text-[10px] text-muted">
          {properties.length} properties
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-card-border/50">
              <th className="text-left px-4 py-2 text-[11px] font-medium text-muted">
                Address
              </th>
              <th className="text-right px-4 py-2 text-[11px] font-medium text-muted">
                Assessment
              </th>
              <th className="text-left px-4 py-2 text-[11px] font-medium text-muted">
                Zoning
              </th>
              <th className="text-left px-4 py-2 text-[11px] font-medium text-muted">
                Neighbourhood
              </th>
              <th className="text-right px-4 py-2 text-[11px] font-medium text-muted">
                Year Built
              </th>
            </tr>
          </thead>
          <tbody>
            {properties.map((p, i) => (
              <tr
                key={i}
                className="border-b border-card-border/30 hover:bg-card-border/10 transition-colors"
              >
                <td className="px-4 py-2 font-medium truncate max-w-[200px]">
                  {p.address || "—"}
                </td>
                <td className="text-right px-4 py-2 font-medium text-teal-400">
                  {p.assessment > 0
                    ? p.assessment >= 1_000_000
                      ? `$${(p.assessment / 1_000_000).toFixed(2)}M`
                      : `$${(p.assessment / 1_000).toFixed(0)}K`
                    : "—"}
                </td>
                <td className="px-4 py-2 text-muted truncate max-w-[100px]">
                  {p.zoning || "—"}
                </td>
                <td className="px-4 py-2 text-muted truncate max-w-[120px]">
                  {p.neighbourhood || "—"}
                </td>
                <td className="text-right px-4 py-2 text-muted">
                  {p.yearBuilt > 0 ? p.yearBuilt : "—"}
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
// Assessment Breakdown Chart
// ---------------------------------------------------------------------------

function AssessmentBreakdownChart({
  data,
  title,
}: {
  data: AssessmentByGroup[];
  title: string;
}) {
  if (data.length === 0) return null;

  const chartData = data.slice(0, 12).map((z) => ({
    zone: z.group.length > 18 ? z.group.slice(0, 15) + "..." : z.group,
    avg: z.avgAssessment,
    count: z.count,
  }));

  return (
    <div className="bg-card border border-card-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <MapPin size={16} className="text-teal-400" />
        <h3 className="text-sm font-semibold">{title}</h3>
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
              width={110}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-card)",
                border: "1px solid var(--color-card-border)",
                borderRadius: "8px",
                fontSize: "11px",
              }}
              formatter={(value: number, name: string) => [
                name === "avg"
                  ? `$${value.toLocaleString()}`
                  : value.toLocaleString(),
                name === "avg" ? "Avg Assessment" : "Properties",
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vacant Lots Summary
// ---------------------------------------------------------------------------

function VacantLotsSummary({ lots }: { lots: VacantLot[] }) {
  if (lots.length === 0) return null;

  const totalCount = lots.reduce((s, l) => s + l.count, 0);

  return (
    <div className="bg-card border border-card-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Building2 size={16} className="text-teal-400" />
        <h3 className="text-sm font-semibold">Vacant Lots</h3>
        <span className="ml-auto text-[10px] text-muted">
          {totalCount.toLocaleString()} total
        </span>
      </div>
      <div className="space-y-1">
        {lots.slice(0, 15).map((l) => (
          <div
            key={l.group}
            className="flex items-center justify-between text-xs py-1 border-b border-card-border/30 last:border-0"
          >
            <span className="text-muted truncate max-w-[180px]">{l.group}</span>
            <div className="flex items-center gap-3">
              <span className="font-medium">{l.count}</span>
              {l.avgAssessment > 0 && (
                <span className="text-[10px] text-muted">
                  avg $
                  {l.avgAssessment >= 1_000_000
                    ? `${(l.avgAssessment / 1_000_000).toFixed(1)}M`
                    : `${(l.avgAssessment / 1_000).toFixed(0)}K`}
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
// Main Client Component
// ---------------------------------------------------------------------------

export function ListingsDashboard({
  snapshot,
}: {
  snapshot: ListingsSnapshot;
}) {
  const [selectedSlug, setSelectedSlug] = useState(
    snapshot.municipalities[0]?.slug || "",
  );

  const selectedMuni =
    snapshot.municipalities.find((m) => m.slug === selectedSlug) ||
    snapshot.municipalities[0];

  const areaLabel =
    snapshot.municipalityNames.length === 1
      ? snapshot.municipalityNames[0]
      : `${snapshot.municipalityNames.length} municipalities`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-teal-400">
          <Home size={20} />
          <span className="text-xs font-mono uppercase tracking-wider">
            Listings
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Listing Intelligence</h1>
            <p className="text-muted text-sm mt-1">
              Top properties, assessment breakdown, and vacant lots across{" "}
              {areaLabel}.
            </p>
          </div>
          <MunicipalitySelector
            municipalities={snapshot.municipalities}
            selected={selectedSlug}
            onSelect={setSelectedSlug}
          />
        </div>
      </div>

      {selectedMuni && (
        <>
          {/* Top Properties */}
          <TopPropertiesTable properties={selectedMuni.topProperties} />

          {/* Assessment breakdown + Vacant lots */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AssessmentBreakdownChart
              data={selectedMuni.assessmentBreakdown}
              title="Assessment by Neighbourhood"
            />
            <VacantLotsSummary lots={selectedMuni.vacantLots} />
          </div>
        </>
      )}

      {/* Data citation */}
      <p className="text-[10px] text-muted/50 font-mono">
        Data: Municipal ArcGIS/Socrata · Generated{" "}
        {new Date(snapshot.generatedAt).toLocaleString("en-CA")}
      </p>
    </div>
  );
}
