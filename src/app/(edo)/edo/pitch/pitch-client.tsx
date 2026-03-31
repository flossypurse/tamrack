"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  Building2,
  Users,
  Home,
  Network,
  TrendingUp,
  TrendingDown,
  Target,
  MapPin,
  Minus,
  ChevronDown,
  ChevronRight,
  Search,
  X,
  Download,
  RefreshCw,
  Check,
  Clock,
  Trash2,
  Eye,
  Presentation,
} from "lucide-react";
import type { MunicipalityRegion } from "@/lib/municipality-registry";
import { REGION_ORDER, REGION_LABELS } from "@/lib/municipality-registry";
import type { MunicipalityComparison } from "@/lib/edo/compare-shared";
import {
  PITCH_SECTIONS,
  AMENITY_LABELS,
  generatePitchId,
  loadPitchHistory,
  savePitchKit,
  deletePitchKit,
  type PitchKit,
  type PitchMetric,
  type PitchBenchmarkRow,
  type PitchAmenity,
  type PitchSectionDef,
  type SavedPitchKit,
} from "@/lib/edo/pitch-shared";
import type { ElementType } from "react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PitchClientProps {
  municipalitySlug: string;
  municipalityName: string;
  allMunicipalities: MunicipalityComparison[];
}

// ---------------------------------------------------------------------------
// Icon mapping
// ---------------------------------------------------------------------------

const SECTION_ICONS: Record<string, ElementType> = {
  Building2,
  Users,
  Home,
  Network,
  TrendingUp,
  Target,
  MapPin,
};

// ---------------------------------------------------------------------------
// Sparkline (matches reports pattern)
// ---------------------------------------------------------------------------

function PitchSparkline({
  data,
  color = "#6366f1",
}: {
  data: { date: string; value: number }[];
  color?: string;
}) {
  if (data.length < 2) return null;
  const id = `pitch-sp-${color.replace("#", "")}-${Math.random().toString(36).slice(2, 6)}`;
  return (
    <div className="h-8 w-full mt-1">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
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
            fill={`url(#${id})`}
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
        isPositive ? "text-emerald-400" : isNegative ? "text-red-400" : "text-muted"
      }`}
    >
      <Icon size={10} />
      {change}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Metric card
// ---------------------------------------------------------------------------

function MetricCard({ metric }: { metric: PitchMetric }) {
  return (
    <div className="bg-background/50 border border-card-border/50 rounded-lg p-3">
      <div className="flex items-start justify-between">
        <p className="text-[11px] text-muted leading-tight">{metric.label}</p>
        <ChangeIndicator change={metric.change} />
      </div>
      <p className="text-lg font-semibold tracking-tight mt-1">{metric.formatted}</p>
      {metric.period && <p className="text-[10px] text-muted/60 mt-0.5">{metric.period}</p>}
      <PitchSparkline data={metric.trend} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Peer Picker (reused from reports pattern)
// ---------------------------------------------------------------------------

function PeerPicker({
  allMunicipalities,
  selected,
  pinned,
  onToggle,
}: {
  allMunicipalities: MunicipalityComparison[];
  selected: string[];
  pinned: string;
  onToggle: (slug: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(
    new Set(REGION_ORDER),
  );

  const filtered = useMemo(() => {
    const others = allMunicipalities.filter((m) => m.slug !== pinned);
    if (!search.trim()) return others;
    const q = search.toLowerCase();
    return others.filter((m) => m.name.toLowerCase().includes(q));
  }, [allMunicipalities, search, pinned]);

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
        Peer Municipalities for Benchmarking ({selected.length}/4)
      </h3>

      <div className="relative mb-3">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          placeholder="Search municipalities..."
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

      <div className="max-h-60 overflow-y-auto space-y-1">
        {REGION_ORDER.map((region) => {
          const munis = byRegion.get(region);
          if (!munis?.length) return null;
          const isExpanded = expandedRegions.has(region);

          return (
            <div key={region}>
              <button
                onClick={() => toggleRegion(region)}
                className="flex items-center gap-1 w-full text-left text-[11px] font-medium text-muted py-1 hover:text-foreground"
              >
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                {REGION_LABELS[region]}
                <span className="text-muted/50 ml-1">({munis.length})</span>
              </button>
              {isExpanded && (
                <div className="pl-4 space-y-0.5">
                  {munis.map((m) => {
                    const isSelected = selected.includes(m.slug);
                    const isDisabled = !isSelected && selected.length >= 4;
                    return (
                      <button
                        key={m.slug}
                        onClick={() => !isDisabled && onToggle(m.slug)}
                        disabled={isDisabled}
                        className={`flex items-center gap-2 w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                          isSelected
                            ? "bg-indigo-500/10 text-indigo-400"
                            : isDisabled
                              ? "text-muted/30 cursor-not-allowed"
                              : "text-muted hover:text-foreground hover:bg-card-border/30"
                        }`}
                      >
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: isSelected ? m.color : "transparent", border: isSelected ? "none" : "1px solid var(--color-muted)" }}
                        />
                        {m.name}
                        {isSelected && <Check size={10} className="ml-auto" />}
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
// Section renderers
// ---------------------------------------------------------------------------

function SectionHeader({ def }: { def: PitchSectionDef }) {
  const Icon = SECTION_ICONS[def.icon] || Building2;
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon size={18} className="text-indigo-400" />
      <h2 className="text-sm font-semibold">{def.title}</h2>
    </div>
  );
}

function NarrativeBlock({ text }: { text: string }) {
  return (
    <p className="text-xs text-muted leading-relaxed mb-4 italic">
      {text}
    </p>
  );
}

function OverviewSection({ data }: { data: PitchKit }) {
  const s = data.sections.overview;
  const def = PITCH_SECTIONS.find((d) => d.id === "overview")!;
  return (
    <div className="bg-card border border-card-border rounded-xl p-4 sm:p-5">
      <SectionHeader def={def} />
      <NarrativeBlock text={s.narrative} />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <MetricCard metric={s.population} />
        <MetricCard metric={s.medianIncome} />
        <MetricCard metric={s.assessmentBase} />
        <MetricCard metric={s.businessCount} />
        <MetricCard metric={s.crimeSeverity} />
      </div>
    </div>
  );
}

function WorkforceSection({ data }: { data: PitchKit }) {
  const s = data.sections.workforce;
  const def = PITCH_SECTIONS.find((d) => d.id === "workforce")!;
  return (
    <div className="bg-card border border-card-border rounded-xl p-4 sm:p-5">
      <SectionHeader def={def} />
      <NarrativeBlock text={s.narrative} />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <MetricCard metric={s.labourForce} />
        <MetricCard metric={s.unemploymentRate} />
        <MetricCard metric={s.avgWeeklyEarnings} />
        <MetricCard metric={s.k9Enrolment} />
        <MetricCard metric={s.hsEnrolment} />
      </div>
    </div>
  );
}

function RealEstateSection({ data }: { data: PitchKit }) {
  const s = data.sections.realEstate;
  const def = PITCH_SECTIONS.find((d) => d.id === "realEstate")!;
  return (
    <div className="bg-card border border-card-border rounded-xl p-4 sm:p-5">
      <SectionHeader def={def} />
      <NarrativeBlock text={s.narrative} />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <MetricCard metric={s.assessmentBase} />
        <MetricCard metric={s.avgSalePrice} />
        <MetricCard metric={s.housingStarts} />
        <MetricCard metric={s.vacancyRate} />
        <MetricCard metric={s.avgRent} />
        <MetricCard metric={s.municipalTaxRate} />
        <MetricCard metric={s.residentialShare} />
      </div>
    </div>
  );
}

function InfrastructureSection({ data }: { data: PitchKit }) {
  const s = data.sections.infrastructure;
  const def = PITCH_SECTIONS.find((d) => d.id === "infrastructure")!;
  return (
    <div className="bg-card border border-card-border rounded-xl p-4 sm:p-5">
      <SectionHeader def={def} />
      <NarrativeBlock text={s.narrative} />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <MetricCard metric={s.parcelsTracked} />
        <div className="bg-background/50 border border-card-border/50 rounded-lg p-3">
          <p className="text-[11px] text-muted">Business Categories</p>
          <p className="text-lg font-semibold tracking-tight mt-1">{s.businessCategories || "—"}</p>
        </div>
        <div className="bg-background/50 border border-card-border/50 rounded-lg p-3">
          <p className="text-[11px] text-muted">Zoning Districts</p>
          <p className="text-lg font-semibold tracking-tight mt-1">{s.zoningDistricts || "—"}</p>
        </div>
        <MetricCard metric={s.dwellingUnits} />
      </div>
    </div>
  );
}

function GrowthSection({ data }: { data: PitchKit }) {
  const s = data.sections.growth;
  const def = PITCH_SECTIONS.find((d) => d.id === "growth")!;
  return (
    <div className="bg-card border border-card-border rounded-xl p-4 sm:p-5">
      <SectionHeader def={def} />
      <NarrativeBlock text={s.narrative} />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <MetricCard metric={s.populationTrend} />
        <MetricCard metric={s.buildingPermits} />
        <MetricCard metric={s.incorporations} />
        <MetricCard metric={s.netMigration} />
        <MetricCard metric={s.permanentResidents} />
      </div>
    </div>
  );
}

function CompetitiveSection({ data }: { data: PitchKit }) {
  const s = data.sections.competitive;
  const def = PITCH_SECTIONS.find((d) => d.id === "competitive")!;

  if (s.benchmarks.length === 0) {
    return (
      <div className="bg-card border border-card-border rounded-xl p-4 sm:p-5">
        <SectionHeader def={def} />
        <p className="text-xs text-muted">
          Select peer municipalities to see competitive benchmarking data.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-card-border rounded-xl p-4 sm:p-5">
      <SectionHeader def={def} />
      <NarrativeBlock text={s.narrative} />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-card-border">
              <th className="text-left py-2 pr-4 text-muted font-medium">Indicator</th>
              <th className="text-right py-2 px-2 font-medium text-indigo-400">
                {data.municipalityName}
              </th>
              <th className="text-right py-2 px-2 font-medium text-muted">
                Peer Avg ({s.peerNames.join(", ")})
              </th>
            </tr>
          </thead>
          <tbody>
            {s.benchmarks.map((b) => {
              const wins = b.municipalityRaw !== null && b.peerAvgRaw !== null && b.municipalityRaw > b.peerAvgRaw;
              return (
                <tr key={b.indicator} className="border-b border-card-border/30">
                  <td className="py-2 pr-4 text-muted">{b.indicator}</td>
                  <td className={`text-right py-2 px-2 font-semibold ${wins ? "text-emerald-400" : ""}`}>
                    {b.municipalityValue}
                  </td>
                  <td className="text-right py-2 px-2 text-muted">
                    {b.peerAvg}
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

function AmenitiesSection({ data }: { data: PitchKit }) {
  const s = data.sections.amenities;
  const def = PITCH_SECTIONS.find((d) => d.id === "amenities")!;
  const hasAmenities = s.amenities.some((a) => a.count > 0);

  return (
    <div className="bg-card border border-card-border rounded-xl p-4 sm:p-5">
      <SectionHeader def={def} />
      {hasAmenities && <NarrativeBlock text={s.narrative} />}
      {hasAmenities ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {s.amenities.map((a) => (
            <div key={a.type} className="bg-background/50 border border-card-border/50 rounded-lg p-3">
              <p className="text-[11px] text-muted">{a.label}</p>
              <p className="text-lg font-semibold tracking-tight mt-1">{a.count}</p>
              {a.topPlaces.length > 0 && (
                <div className="mt-2 space-y-0.5">
                  {a.topPlaces.map((p, i) => (
                    <p key={i} className="text-[10px] text-muted/70 truncate">
                      {p.name}
                      {p.rating ? <span className="text-amber-400 ml-1">{p.rating.toFixed(1)}</span> : null}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted">
          Amenity data requires a Google Maps API key to be configured.
        </p>
      )}
    </div>
  );
}

function CitationsSection() {
  return (
    <div className="bg-card border border-card-border rounded-xl p-4 sm:p-5">
      <h2 className="text-sm font-semibold mb-3">Data Sources</h2>
      <ul className="space-y-1">
        {[
          "regionaldashboard.alberta.ca — 54 indicators for Alberta municipalities",
          "Google Maps Platform — nearby amenities search (10 km radius)",
          "Municipal ArcGIS services — parcel, business, and zoning data",
          "Statistics Canada Web Data Service (WDS)",
          "Peer comparison data sourced from same regional indicators",
        ].map((c, i) => (
          <li key={i} className="text-xs text-muted flex items-start gap-2">
            <span className="text-muted/40 mt-0.5">-</span>
            {c}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pitch History
// ---------------------------------------------------------------------------

function PitchHistory({
  onView,
  onRefresh,
}: {
  onView: (pitch: SavedPitchKit) => void;
  onRefresh: () => void;
}) {
  const [history, setHistory] = useState<SavedPitchKit[]>([]);

  useEffect(() => {
    setHistory(loadPitchHistory());
  }, []);

  if (history.length === 0) return null;

  const handleDelete = (id: string) => {
    deletePitchKit(id);
    setHistory(loadPitchHistory());
    onRefresh();
  };

  return (
    <div className="bg-card border border-card-border rounded-xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Clock size={14} className="text-muted" />
          Recent Pitch Kits
        </h2>
        <span className="text-[10px] text-muted">{history.length} saved</span>
      </div>
      <div className="space-y-2">
        {history.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between p-3 bg-background/50 rounded-lg border border-card-border/50"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">
                {p.data.municipalityName} — Investment Pitch Kit
              </p>
              <p className="text-[10px] text-muted">
                {p.config.peerSlugs.length > 0
                  ? `${p.config.peerSlugs.length} peers`
                  : "No peers"}{" "}
                · Generated{" "}
                {new Date(p.generatedAt).toLocaleDateString("en-CA", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <div className="flex items-center gap-1 ml-3">
              <button
                onClick={() => onView(p)}
                className="p-1.5 text-muted hover:text-indigo-400 transition-colors"
                title="View pitch kit"
              >
                <Eye size={14} />
              </button>
              <button
                onClick={() => handleDelete(p.id)}
                className="p-1.5 text-muted hover:text-red-400 transition-colors"
                title="Delete pitch kit"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

type View = "config" | "preview";

export default function PitchClient({
  municipalitySlug,
  municipalityName,
  allMunicipalities,
}: PitchClientProps) {
  const [view, setView] = useState<View>("config");
  const [peerSlugs, setPeerSlugs] = useState<string[]>([]);
  const [pitchData, setPitchData] = useState<PitchKit | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyKey, setHistoryKey] = useState(0);

  const handlePeerToggle = useCallback((slug: string) => {
    setPeerSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }, []);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("m", municipalitySlug);
    for (const peer of peerSlugs) {
      params.append("peer", peer);
    }

    try {
      const res = await fetch(`/api/edo/pitch?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data: PitchKit = await res.json();
      setPitchData(data);
      setView("preview");

      // Save to history
      const saved: SavedPitchKit = {
        id: generatePitchId(),
        config: { municipalitySlug, municipalityName, peerSlugs },
        generatedAt: new Date().toISOString(),
        data,
      };
      savePitchKit(saved);
      setHistoryKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate pitch kit");
    } finally {
      setLoading(false);
    }
  }, [municipalitySlug, municipalityName, peerSlugs]);

  const handleExportPdf = useCallback(() => {
    const params = new URLSearchParams();
    params.set("m", municipalitySlug);
    for (const peer of peerSlugs) {
      params.append("peer", peer);
    }
    window.open(`/api/edo/pitch-pdf?${params.toString()}`, "_blank");
  }, [municipalitySlug, peerSlugs]);

  const handleViewCached = useCallback((pitch: SavedPitchKit) => {
    setPeerSlugs(pitch.config.peerSlugs);
    setPitchData(pitch.data);
    setView("preview");
  }, []);

  const handleBack = useCallback(() => {
    setView("config");
  }, []);

  return (
    <div className="space-y-6">
      {/* Config view */}
      {view === "config" && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left: Peer picker */}
            <div className="lg:col-span-1 space-y-4">
              <PeerPicker
                allMunicipalities={allMunicipalities}
                selected={peerSlugs}
                pinned={municipalitySlug}
                onToggle={handlePeerToggle}
              />
            </div>

            {/* Right: Section preview + Generate */}
            <div className="lg:col-span-2 space-y-4">
              {/* Sections preview */}
              <div className="bg-card border border-card-border rounded-xl p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
                  Pitch Kit Sections
                </h3>
                <div className="space-y-2">
                  {PITCH_SECTIONS.map((s, i) => {
                    const Icon = SECTION_ICONS[s.icon] || Building2;
                    return (
                      <div
                        key={s.id}
                        className="flex items-start gap-3 p-2 rounded-lg bg-background/50"
                      >
                        <span className="text-[10px] font-mono text-muted/40 mt-0.5 w-4 text-right">
                          {i + 1}
                        </span>
                        <Icon size={14} className="text-indigo-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-medium">{s.title}</p>
                          <p className="text-[10px] text-muted">{s.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Summary + Generate */}
              <div className="bg-card border border-card-border rounded-xl p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
                  Summary
                </h3>
                <div className="space-y-1 text-xs text-muted mb-4">
                  <p>
                    <span className="text-foreground font-medium">Municipality:</span>{" "}
                    {municipalityName}
                  </p>
                  <p>
                    <span className="text-foreground font-medium">Sections:</span>{" "}
                    {PITCH_SECTIONS.length} investor-focused sections
                  </p>
                  <p>
                    <span className="text-foreground font-medium">Benchmarking peers:</span>{" "}
                    {peerSlugs.length > 0
                      ? peerSlugs
                          .map(
                            (s) =>
                              allMunicipalities.find((m) => m.slug === s)?.name ?? s,
                          )
                          .join(", ")
                      : "None (competitive section will be empty)"}
                  </p>
                </div>

                {error && (
                  <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleGenerate}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {loading ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Generating pitch kit...
                    </>
                  ) : (
                    <>
                      <Presentation size={14} />
                      Generate Pitch Kit
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <PitchHistory
            key={historyKey}
            onView={handleViewCached}
            onRefresh={() => setHistoryKey((k) => k + 1)}
          />
        </>
      )}

      {/* Preview view */}
      {view === "preview" && pitchData && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={handleBack}
                className="text-xs text-muted hover:text-foreground transition-colors mb-2"
              >
                &larr; Back to configuration
              </button>
              <h2 className="text-sm font-semibold">
                {pitchData.municipalityName} — Investment Pitch Kit
              </h2>
              <p className="text-xs text-muted">
                Generated{" "}
                {new Date(pitchData.generatedAt).toLocaleDateString("en-CA", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <button
              onClick={handleExportPdf}
              className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <Download size={14} />
              Export PDF
            </button>
          </div>

          <OverviewSection data={pitchData} />
          <WorkforceSection data={pitchData} />
          <RealEstateSection data={pitchData} />
          <InfrastructureSection data={pitchData} />
          <GrowthSection data={pitchData} />
          <CompetitiveSection data={pitchData} />
          <AmenitiesSection data={pitchData} />
          <CitationsSection />
        </>
      )}
    </div>
  );
}
