"use client";

import { useState, useMemo, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import {
  Search,
  X,
  ChevronDown,
  ChevronRight,
  Download,
  GitCompare,
  Check,
} from "lucide-react";
import type {
  ComparisonIndicator,
  ComparisonCategory,
  MunicipalityComparison,
  ComparisonDataPoint,
} from "@/lib/edo/compare-shared";
import {
  COMPARISON_INDICATORS,
  COMPARISON_CATEGORIES,
  DEFAULT_INDICATOR_IDS,
  formatComparisonValue,
  getMunicipalityRegionLabel,
} from "@/lib/edo/compare-shared";
import type { MunicipalityRegion } from "@/lib/municipality-registry";
import { REGION_ORDER } from "@/lib/municipality-registry";

// ---------------------------------------------------------------------------
// Types for API response
// ---------------------------------------------------------------------------

interface ComparisonApiResponse {
  municipalities: MunicipalityComparison[];
  indicators: ComparisonIndicator[];
  data: ComparisonDataPoint[];
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Municipality Picker
// ---------------------------------------------------------------------------

function MunicipalityPicker({
  allMunicipalities,
  selected,
  pinned,
  onToggle,
}: {
  allMunicipalities: MunicipalityComparison[];
  selected: string[];
  pinned: string | null;
  onToggle: (slug: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(
    new Set(REGION_ORDER),
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return allMunicipalities;
    const q = search.toLowerCase();
    return allMunicipalities.filter((m) => m.name.toLowerCase().includes(q));
  }, [allMunicipalities, search]);

  const byRegion = useMemo(() => {
    const map = new Map<MunicipalityRegion, MunicipalityComparison[]>();
    for (const m of filtered) {
      const list = map.get(m.region) || [];
      list.push(m);
      map.set(m.region, list);
    }
    return map;
  }, [filtered]);

  const toggleRegion = (region: string) => {
    setExpandedRegions((prev) => {
      const next = new Set(prev);
      if (next.has(region)) next.delete(region);
      else next.add(region);
      return next;
    });
  };

  return (
    <div className="bg-card border border-card-border rounded-xl p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
        Municipalities ({selected.length}/5)
      </h3>

      <div className="relative mb-3">
        <Search
          size={14}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          type="text"
          placeholder="Search municipalities…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 text-sm bg-background border border-card-border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
          >
            <X size={12} />
          </button>
        )}
      </div>

      <div className="space-y-1 max-h-[360px] overflow-y-auto pr-1">
        {REGION_ORDER.map((region) => {
          const munis = byRegion.get(region);
          if (!munis?.length) return null;
          const isExpanded = expandedRegions.has(region);

          return (
            <div key={region}>
              <button
                onClick={() => toggleRegion(region)}
                className="flex items-center gap-1.5 w-full text-left px-1 py-1 text-[11px] font-medium text-muted hover:text-foreground transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown size={12} />
                ) : (
                  <ChevronRight size={12} />
                )}
                {getMunicipalityRegionLabel(region)}
                <span className="text-muted/50">({munis.length})</span>
              </button>

              {isExpanded && (
                <div className="ml-4 space-y-0.5">
                  {munis.map((m) => {
                    const isSelected = selected.includes(m.slug);
                    const isPinned = m.slug === pinned;
                    const atMax = selected.length >= 5 && !isSelected;

                    return (
                      <button
                        key={m.slug}
                        onClick={() => !isPinned && !atMax && onToggle(m.slug)}
                        disabled={isPinned || atMax}
                        className={`flex items-center gap-2 w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                          isSelected
                            ? "bg-indigo-500/10 text-indigo-400"
                            : atMax
                              ? "text-muted/30 cursor-not-allowed"
                              : "text-muted hover:text-foreground hover:bg-card-border/30"
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0 flex items-center justify-center"
                          style={{
                            backgroundColor: isSelected ? m.color : "transparent",
                            border: isSelected
                              ? "none"
                              : "1.5px solid var(--color-card-border)",
                          }}
                        >
                          {isSelected && <Check size={8} className="text-white" />}
                        </span>
                        <span className="truncate">{m.name}</span>
                        {isPinned && (
                          <span className="text-[9px] font-mono text-indigo-400/60 ml-auto">
                            yours
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Indicator Picker
// ---------------------------------------------------------------------------

function IndicatorPicker({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const [expandedCats, setExpandedCats] = useState<Set<string>>(
    new Set(COMPARISON_CATEGORIES.map((c) => c.id)),
  );

  const toggleCat = (id: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const byCat = useMemo(() => {
    const map = new Map<ComparisonCategory, ComparisonIndicator[]>();
    for (const ind of COMPARISON_INDICATORS) {
      const list = map.get(ind.category) || [];
      list.push(ind);
      map.set(ind.category, list);
    }
    return map;
  }, []);

  return (
    <div className="bg-card border border-card-border rounded-xl p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
        Indicators ({selected.length})
      </h3>

      <div className="space-y-1 max-h-[360px] overflow-y-auto pr-1">
        {COMPARISON_CATEGORIES.map((cat) => {
          const indicators = byCat.get(cat.id) || [];
          const isExpanded = expandedCats.has(cat.id);
          const selectedInCat = indicators.filter((i) =>
            selected.includes(i.id),
          ).length;

          return (
            <div key={cat.id}>
              <button
                onClick={() => toggleCat(cat.id)}
                className="flex items-center gap-1.5 w-full text-left px-1 py-1 text-[11px] font-medium text-muted hover:text-foreground transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown size={12} />
                ) : (
                  <ChevronRight size={12} />
                )}
                {cat.label}
                {selectedInCat > 0 && (
                  <span className="text-indigo-400/60 text-[10px]">
                    {selectedInCat}
                  </span>
                )}
              </button>

              {isExpanded && (
                <div className="ml-4 space-y-0.5">
                  {indicators.map((ind) => {
                    const isSelected = selected.includes(ind.id);
                    return (
                      <button
                        key={ind.id}
                        onClick={() => onToggle(ind.id)}
                        className={`flex items-center gap-2 w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                          isSelected
                            ? "bg-indigo-500/10 text-indigo-400"
                            : "text-muted hover:text-foreground hover:bg-card-border/30"
                        }`}
                      >
                        <span
                          className={`w-3 h-3 rounded border flex items-center justify-center flex-shrink-0 ${
                            isSelected
                              ? "bg-indigo-600 border-indigo-600"
                              : "border-card-border"
                          }`}
                        >
                          {isSelected && (
                            <Check size={8} className="text-white" />
                          )}
                        </span>
                        {ind.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={() => {
          // Reset to defaults
          DEFAULT_INDICATOR_IDS.forEach((id) => {
            if (!selected.includes(id)) onToggle(id);
          });
          selected.forEach((id) => {
            if (!DEFAULT_INDICATOR_IDS.includes(id)) onToggle(id);
          });
        }}
        className="mt-3 text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
      >
        Reset to defaults
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Comparison Charts
// ---------------------------------------------------------------------------

const CHART_COLORS = [
  "#6366f1", // indigo
  "#f59e0b", // amber
  "#10b981", // emerald
  "#ef4444", // red
  "#8b5cf6", // violet
];

function ComparisonBarChart({
  indicator,
  data,
  municipalities,
}: {
  indicator: ComparisonIndicator;
  data: ComparisonDataPoint[];
  municipalities: MunicipalityComparison[];
}) {
  const chartData = municipalities.map((m, i) => {
    const dp = data.find(
      (d) =>
        d.municipalitySlug === m.slug && d.indicatorId === indicator.id,
    );
    return {
      name: m.name.length > 15 ? m.name.slice(0, 14) + "…" : m.name,
      fullName: m.name,
      value: dp?.latestValue ?? 0,
      change: dp?.change ?? null,
      period: dp?.latestPeriod ?? "",
      fill: CHART_COLORS[i % CHART_COLORS.length],
    };
  });

  return (
    <div className="bg-card border border-card-border rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="text-sm font-medium">{indicator.label}</h4>
          <p className="text-[10px] text-muted mt-0.5">
            {chartData[0]?.period} · {indicator.unit}
          </p>
        </div>
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-card-border)" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: "var(--color-muted)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--color-muted)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => formatComparisonValue(v, indicator.format)}
              width={65}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-card)",
                border: "1px solid var(--color-card-border)",
                borderRadius: "8px",
                fontSize: "11px",
              }}
              formatter={(value) => [
                formatComparisonValue(value as number | null, indicator.format),
                indicator.label,
              ]}
              labelFormatter={(label) => {
                const item = chartData.find((d) => d.name === String(label));
                return item?.fullName ?? String(label);
              }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48}>
              {chartData.map((entry, idx) => (
                <rect key={idx} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Change indicators */}
      <div className="flex flex-wrap gap-3 mt-2">
        {chartData.map((d, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[10px]">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: d.fill }}
            />
            <span className="text-muted">{d.name}</span>
            {d.change && (
              <span
                className={
                  d.change.startsWith("+")
                    ? "text-emerald-400"
                    : d.change.startsWith("-")
                      ? "text-red-400"
                      : "text-muted"
                }
              >
                {d.change}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ComparisonTrendChart({
  indicator,
  data,
  municipalities,
}: {
  indicator: ComparisonIndicator;
  data: ComparisonDataPoint[];
  municipalities: MunicipalityComparison[];
}) {
  // Merge all municipality time series into a unified dataset
  const allDates = new Set<string>();
  const seriesMap = new Map<string, Map<string, number>>();

  for (const m of municipalities) {
    const dp = data.find(
      (d) => d.municipalitySlug === m.slug && d.indicatorId === indicator.id,
    );
    if (!dp) continue;
    const dateMap = new Map<string, number>();
    for (const pt of dp.trend) {
      allDates.add(pt.date);
      dateMap.set(pt.date, pt.value);
    }
    seriesMap.set(m.slug, dateMap);
  }

  const sortedDates = Array.from(allDates).sort();
  if (sortedDates.length < 2) return null;

  const chartData = sortedDates.map((date) => {
    const point: Record<string, string | number | null> = { date };
    for (const m of municipalities) {
      const dateMap = seriesMap.get(m.slug);
      point[m.slug] = dateMap?.get(date) ?? null;
    }
    return point;
  });

  return (
    <div className="bg-card border border-card-border rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="text-sm font-medium">{indicator.label} — Trend</h4>
          <p className="text-[10px] text-muted mt-0.5">{indicator.unit}</p>
        </div>
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-card-border)" />
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
              tickFormatter={(v: number) => formatComparisonValue(v, indicator.format)}
              width={65}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-card)",
                border: "1px solid var(--color-card-border)",
                borderRadius: "8px",
                fontSize: "11px",
              }}
              formatter={(value, name) => {
                const m = municipalities.find((mu) => mu.slug === String(name));
                return [
                  formatComparisonValue(value as number | null, indicator.format),
                  m?.name ?? String(name),
                ];
              }}
            />
            <Legend
              formatter={(value: string) => {
                const m = municipalities.find((mu) => mu.slug === value);
                return m?.name ?? value;
              }}
              wrapperStyle={{ fontSize: "10px" }}
            />
            {municipalities.map((m, i) => (
              <Area
                key={m.slug}
                type="monotone"
                dataKey={m.slug}
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                fill={CHART_COLORS[i % CHART_COLORS.length]}
                fillOpacity={0.08}
                strokeWidth={1.5}
                dot={false}
                connectNulls
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Comparison Table
// ---------------------------------------------------------------------------

function ComparisonTable({
  indicators,
  data,
  municipalities,
}: {
  indicators: ComparisonIndicator[];
  data: ComparisonDataPoint[];
  municipalities: MunicipalityComparison[];
}) {
  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-card-border">
              <th className="text-left px-4 py-2.5 text-[11px] font-medium text-muted sticky left-0 bg-card z-10">
                Indicator
              </th>
              {municipalities.map((m, i) => (
                <th
                  key={m.slug}
                  className="text-right px-4 py-2.5 text-[11px] font-medium min-w-[120px]"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                      }}
                    />
                    {m.name}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {indicators.map((ind) => (
              <tr
                key={ind.id}
                className="border-b border-card-border/50 hover:bg-card-border/10 transition-colors"
              >
                <td className="px-4 py-2 text-muted sticky left-0 bg-card z-10">
                  {ind.label}
                </td>
                {municipalities.map((m) => {
                  const dp = data.find(
                    (d) =>
                      d.municipalitySlug === m.slug &&
                      d.indicatorId === ind.id,
                  );
                  return (
                    <td key={m.slug} className="text-right px-4 py-2">
                      <span className="font-medium">
                        {formatComparisonValue(dp?.latestValue ?? null, ind.format)}
                      </span>
                      {dp?.change && (
                        <span
                          className={`ml-1.5 text-[10px] ${
                            dp.change.startsWith("+")
                              ? "text-emerald-400"
                              : dp.change.startsWith("-")
                                ? "text-red-400"
                                : "text-muted"
                          }`}
                        >
                          {dp.change}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Compare Client Component
// ---------------------------------------------------------------------------

type ViewMode = "charts" | "table";

export function CompareClient({
  boundMunicipality,
  allMunicipalities,
}: {
  boundMunicipality: string;
  allMunicipalities: MunicipalityComparison[];
}) {
  const [selectedMunis, setSelectedMunis] = useState<string[]>([
    boundMunicipality,
  ]);
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>(
    DEFAULT_INDICATOR_IDS,
  );
  const [viewMode, setViewMode] = useState<ViewMode>("charts");
  const [result, setResult] = useState<ComparisonApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleMuni = useCallback(
    (slug: string) => {
      setSelectedMunis((prev) =>
        prev.includes(slug)
          ? prev.filter((s) => s !== slug)
          : prev.length < 5
            ? [...prev, slug]
            : prev,
      );
    },
    [],
  );

  const toggleIndicator = useCallback((id: string) => {
    setSelectedIndicators((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  }, []);

  const canCompare = selectedMunis.length >= 2 && selectedIndicators.length >= 1;

  const runComparison = useCallback(async () => {
    if (!canCompare) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      selectedMunis.forEach((s) => params.append("m", s));
      selectedIndicators.forEach((i) => params.append("i", i));
      const res = await fetch(`/api/edo/compare?${params.toString()}`);
      if (!res.ok) throw new Error("Comparison fetch failed");
      const json: ComparisonApiResponse = await res.json();
      setResult(json);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [canCompare, selectedMunis, selectedIndicators]);

  const handleExport = useCallback(async () => {
    if (!result) return;
    setExporting(true);
    try {
      const params = new URLSearchParams();
      selectedMunis.forEach((s) => params.append("m", s));
      selectedIndicators.forEach((i) => params.append("i", i));
      const res = await fetch(`/api/edo/compare-pdf?${params.toString()}`);
      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Peer-Comparison.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF export failed:", err);
      alert("PDF export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  }, [result, selectedMunis, selectedIndicators]);

  const activeIndicators = useMemo(
    () =>
      COMPARISON_INDICATORS.filter((ind) =>
        selectedIndicators.includes(ind.id),
      ),
    [selectedIndicators],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-indigo-400">
          <GitCompare size={20} />
          <span className="text-xs font-mono uppercase tracking-wider">
            Peer Comparison
          </span>
        </div>
        <h1 className="text-2xl font-bold">Compare Municipalities</h1>
        <p className="text-muted text-sm">
          Select 2–5 municipalities and choose indicators to compare
          side-by-side.
        </p>
      </div>

      {/* Pickers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MunicipalityPicker
          allMunicipalities={allMunicipalities}
          selected={selectedMunis}
          pinned={boundMunicipality}
          onToggle={toggleMuni}
        />
        <IndicatorPicker
          selected={selectedIndicators}
          onToggle={toggleIndicator}
        />
      </div>

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={runComparison}
          disabled={!canCompare || loading}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          <GitCompare size={14} />
          {loading ? "Loading…" : "Compare"}
        </button>

        {!canCompare && (
          <span className="text-xs text-muted">
            {selectedMunis.length < 2
              ? "Select at least 2 municipalities"
              : "Select at least 1 indicator"}
          </span>
        )}

        {result && (
          <>
            <div className="flex items-center bg-card border border-card-border rounded-lg overflow-hidden ml-auto">
              <button
                onClick={() => setViewMode("charts")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === "charts"
                    ? "bg-indigo-500/10 text-indigo-400"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Charts
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === "table"
                    ? "bg-indigo-500/10 text-indigo-400"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Table
              </button>
            </div>

            <button
              onClick={handleExport}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg transition-colors"
            >
              <Download size={14} />
              {exporting ? "Generating…" : "Export PDF"}
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {viewMode === "table" ? (
            <ComparisonTable
              indicators={activeIndicators}
              data={result.data}
              municipalities={result.municipalities}
            />
          ) : (
            <>
              {/* Bar charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {activeIndicators.map((ind) => (
                  <ComparisonBarChart
                    key={ind.id}
                    indicator={ind}
                    data={result.data}
                    municipalities={result.municipalities}
                  />
                ))}
              </div>

              {/* Trend charts for indicators that have trend data */}
              {activeIndicators.some((ind) =>
                result.data.some(
                  (d) => d.indicatorId === ind.id && d.trend.length >= 2,
                ),
              ) && (
                <>
                  <h2 className="text-sm font-semibold text-muted mt-4">
                    Trend Comparison
                  </h2>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {activeIndicators
                      .filter((ind) =>
                        result.data.some(
                          (d) =>
                            d.indicatorId === ind.id && d.trend.length >= 2,
                        ),
                      )
                      .map((ind) => (
                        <ComparisonTrendChart
                          key={ind.id}
                          indicator={ind}
                          data={result.data}
                          municipalities={result.municipalities}
                        />
                      ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* Data citation */}
          <p className="text-[10px] text-muted/50 font-mono">
            Data: regionaldashboard.alberta.ca · Generated{" "}
            {new Date(result.generatedAt).toLocaleString("en-CA")}
          </p>
        </div>
      )}
    </div>
  );
}
