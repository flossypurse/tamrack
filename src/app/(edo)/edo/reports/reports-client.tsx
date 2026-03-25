"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  FileText,
  Calendar,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Search,
  X,
  Download,
  Clock,
  Trash2,
  Eye,
  RefreshCw,
  AlertTriangle,
  Info,
  Shield,
  Check,
} from "lucide-react";
import type { MunicipalityRegion } from "@/lib/municipality-registry";
import { REGION_ORDER, REGION_LABELS } from "@/lib/municipality-registry";
import {
  REPORT_TEMPLATES,
  getTemplate,
  getDateRangeOptions,
  formatDateRange,
  generateReportId,
  loadReportHistory,
  saveReport,
  deleteReport,
  type ReportTemplateId,
  type ReportTemplate,
  type DateRange,
  type ReportData,
  type ReportSectionData,
  type ReportMetric,
  type GeneratedReport,
} from "@/lib/edo/reports-shared";
import type { MunicipalityComparison } from "@/lib/edo/compare-shared";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ReportsClientProps {
  municipalitySlug: string;
  municipalityName: string;
  allMunicipalities: MunicipalityComparison[];
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

type View = "picker" | "builder" | "preview";

// ---------------------------------------------------------------------------
// Template icons mapping
// ---------------------------------------------------------------------------

const TEMPLATE_ICONS: Record<string, React.ElementType> = {
  Calendar: Calendar,
  BarChart3: BarChart3,
  TrendingUp: TrendingUp,
};

// ---------------------------------------------------------------------------
// Sparkline (matches profile-section.tsx pattern)
// ---------------------------------------------------------------------------

function ReportSparkline({
  data,
  color = "#6366f1",
}: {
  data: { date: string; value: number }[];
  color?: string;
}) {
  if (data.length < 2) return null;
  const id = `rpt-sp-${color.replace("#", "")}-${Math.random().toString(36).slice(2, 6)}`;
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
            formatter={(value: number) => [value.toLocaleString(), ""]}
            labelFormatter={(label: string) => label}
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

function ChangeIndicator({ change }: { change?: string | null }) {
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
// Municipality Picker (reused from compare pattern)
// ---------------------------------------------------------------------------

function PeerPicker({
  allMunicipalities,
  selected,
  pinned,
  onToggle,
  maxPeers,
}: {
  allMunicipalities: MunicipalityComparison[];
  selected: string[];
  pinned: string;
  onToggle: (slug: string) => void;
  maxPeers: number;
}) {
  const [search, setSearch] = useState("");
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(
    new Set(REGION_ORDER),
  );

  const filtered = useMemo(() => {
    // Exclude pinned municipality from peer list
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
        Peer Municipalities ({selected.length}/{maxPeers})
      </h3>

      <div className="relative mb-3">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
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
                    const isDisabled = !isSelected && selected.length >= maxPeers;
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
// Template Picker
// ---------------------------------------------------------------------------

function TemplatePicker({
  onSelect,
}: {
  onSelect: (templateId: ReportTemplateId) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {REPORT_TEMPLATES.map((t) => {
        const Icon = TEMPLATE_ICONS[t.icon] || FileText;
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className="bg-card border border-card-border rounded-xl p-5 text-left hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all group"
          >
            <div className="flex items-center gap-2 mb-3">
              <Icon size={18} className="text-indigo-400" />
              <h3 className="font-semibold text-sm">{t.name}</h3>
            </div>
            <p className="text-xs text-muted leading-relaxed mb-3">
              {t.description}
            </p>
            <div className="text-[10px] text-muted/60">
              {t.sections.length} sections · {t.dateRangeType} view
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {t.sections.slice(0, 4).map((s) => (
                <span
                  key={s.id}
                  className="text-[9px] px-1.5 py-0.5 bg-background rounded border border-card-border/50 text-muted"
                >
                  {s.title}
                </span>
              ))}
              {t.sections.length > 4 && (
                <span className="text-[9px] px-1.5 py-0.5 text-muted">
                  +{t.sections.length - 4} more
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Report Preview — renders all sections
// ---------------------------------------------------------------------------

const SEVERITY_STYLES = {
  critical: "bg-red-500/10 text-red-400 border-red-500/30",
  warning: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  info: "bg-blue-500/10 text-blue-400 border-blue-500/30",
};

const CHART_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"];

function ReportPreview({ data }: { data: ReportData }) {
  return (
    <div className="space-y-6">
      {data.sections.map((section) => {
        switch (section.type) {
          case "headline-metrics":
            return <HeadlineSection key={section.id} section={section} />;
          case "profile-section":
            return <ProfileSection key={section.id} section={section} />;
          case "peer-comparison":
            return <ComparisonSection key={section.id} section={section} />;
          case "alerts-summary":
            return <AlertsSection key={section.id} section={section} />;
          case "data-citations":
            return <CitationsSection key={section.id} section={section} />;
          default:
            return null;
        }
      })}
    </div>
  );
}

function HeadlineSection({ section }: { section: ReportSectionData }) {
  if (!section.metrics?.length) return null;
  return (
    <div className="bg-card border border-card-border rounded-xl p-4 sm:p-5">
      <h2 className="text-sm font-semibold mb-4">{section.title}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {section.metrics.map((m) => (
          <div key={m.label} className="bg-background/50 border border-card-border/50 rounded-lg p-3">
            <p className="text-[11px] text-muted">{m.label}</p>
            <p className="text-xl font-semibold tracking-tight mt-1">{m.formatted}</p>
            <div className="flex items-center gap-2 mt-1">
              <ChangeIndicator change={m.change} />
              {m.period && <span className="text-[10px] text-muted/50">{m.period}</span>}
            </div>
            <ReportSparkline data={m.trend} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfileSection({ section }: { section: ReportSectionData }) {
  if (!section.metrics?.length) return null;
  return (
    <div className="bg-card border border-card-border rounded-xl p-4 sm:p-5">
      <h2 className="text-sm font-semibold mb-4">{section.title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {section.metrics.map((m) => (
          <div key={m.label} className="bg-background/50 border border-card-border/50 rounded-lg p-3">
            <div className="flex items-start justify-between">
              <p className="text-[11px] text-muted leading-tight">{m.label}</p>
              <ChangeIndicator change={m.change} />
            </div>
            <p className="text-lg font-semibold tracking-tight mt-1">{m.formatted}</p>
            {m.period && <p className="text-[10px] text-muted/60 mt-0.5">{m.period}</p>}
            <ReportSparkline data={m.trend} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ComparisonSection({ section }: { section: ReportSectionData }) {
  const comp = section.comparison;
  if (!comp?.rows?.length) return null;

  return (
    <div className="bg-card border border-card-border rounded-xl p-4 sm:p-5">
      <h2 className="text-sm font-semibold mb-4">{section.title}</h2>
      {/* Municipality legend */}
      <div className="flex flex-wrap gap-3 mb-4">
        {comp.municipalities.map((m, i) => (
          <div key={m.slug} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
            />
            <span className="text-xs text-muted">{m.name}</span>
          </div>
        ))}
      </div>
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-card-border">
              <th className="text-left py-2 pr-4 text-muted font-medium">Indicator</th>
              {comp.municipalities.map((m, i) => (
                <th
                  key={m.slug}
                  className="text-right py-2 px-2 font-medium"
                  style={{ color: CHART_COLORS[i % CHART_COLORS.length] }}
                >
                  {m.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comp.rows.map((row) => (
              <tr key={row.indicatorId} className="border-b border-card-border/30">
                <td className="py-2 pr-4 text-muted">{row.indicatorLabel}</td>
                {row.values.map((v) => (
                  <td key={v.slug} className="text-right py-2 px-2">
                    <span className="font-semibold">{v.formatted}</span>
                    {v.change && (
                      <span
                        className={`block text-[10px] ${
                          v.change.startsWith("+") ? "text-emerald-400" : v.change.startsWith("-") ? "text-red-400" : "text-muted"
                        }`}
                      >
                        {v.change}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AlertsSection({ section }: { section: ReportSectionData }) {
  if (!section.alerts?.length) {
    return (
      <div className="bg-card border border-card-border rounded-xl p-4 sm:p-5">
        <h2 className="text-sm font-semibold mb-3">{section.title}</h2>
        <div className="flex items-center gap-2 text-emerald-400 text-sm">
          <Shield size={16} />
          <span>All clear — no alerts triggered. All metrics are within normal thresholds.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-card-border rounded-xl p-4 sm:p-5">
      <h2 className="text-sm font-semibold mb-4">{section.title}</h2>
      <div className="space-y-2">
        {section.alerts.map((a, i) => (
          <div
            key={i}
            className={`flex items-start gap-3 p-3 rounded-lg border ${SEVERITY_STYLES[a.severity]}`}
          >
            <span className="text-[10px] font-mono font-bold uppercase shrink-0 mt-0.5">
              {a.severity}
            </span>
            <span className="text-xs">{a.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CitationsSection({ section }: { section: ReportSectionData }) {
  if (!section.citations?.length) return null;
  return (
    <div className="bg-card border border-card-border rounded-xl p-4 sm:p-5">
      <h2 className="text-sm font-semibold mb-3">{section.title}</h2>
      <ul className="space-y-1">
        {section.citations.map((c, i) => (
          <li key={i} className="text-xs text-muted flex items-start gap-2">
            <span className="text-muted/40 mt-0.5">•</span>
            {c}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Report History
// ---------------------------------------------------------------------------

function ReportHistory({
  onView,
  onRefresh,
}: {
  onView: (report: GeneratedReport) => void;
  onRefresh: () => void;
}) {
  const [history, setHistory] = useState<GeneratedReport[]>([]);

  useEffect(() => {
    setHistory(loadReportHistory());
  }, []);

  if (history.length === 0) return null;

  const handleDelete = (id: string) => {
    deleteReport(id);
    setHistory(loadReportHistory());
    onRefresh();
  };

  return (
    <div className="bg-card border border-card-border rounded-xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Clock size={14} className="text-muted" />
          Recent Reports
        </h2>
        <span className="text-[10px] text-muted">{history.length} saved</span>
      </div>
      <div className="space-y-2">
        {history.map((r) => (
          <div
            key={r.id}
            className="flex items-center justify-between p-3 bg-background/50 rounded-lg border border-card-border/50"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">
                {r.data.templateName} — {r.config.municipalityName}
              </p>
              <p className="text-[10px] text-muted">
                {r.config.dateRange.label} · Generated{" "}
                {new Date(r.generatedAt).toLocaleDateString("en-CA", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <div className="flex items-center gap-1 ml-3">
              <button
                onClick={() => onView(r)}
                className="p-1.5 text-muted hover:text-indigo-400 transition-colors"
                title="View report"
              >
                <Eye size={14} />
              </button>
              <button
                onClick={() => handleDelete(r.id)}
                className="p-1.5 text-muted hover:text-red-400 transition-colors"
                title="Delete report"
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

export default function ReportsClient({
  municipalitySlug,
  municipalityName,
  allMunicipalities,
}: ReportsClientProps) {
  const [view, setView] = useState<View>("picker");
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplateId | null>(null);
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange | null>(null);
  const [peerSlugs, setPeerSlugs] = useState<string[]>([]);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyKey, setHistoryKey] = useState(0);

  const template = selectedTemplate ? getTemplate(selectedTemplate) : null;

  const dateRangeOptions = useMemo(() => {
    if (!template) return [];
    return getDateRangeOptions(template.dateRangeType);
  }, [template]);

  // Auto-select first date range when template changes
  useEffect(() => {
    if (dateRangeOptions.length > 0 && !selectedDateRange) {
      setSelectedDateRange(dateRangeOptions[0]);
    }
  }, [dateRangeOptions, selectedDateRange]);

  const handleTemplateSelect = useCallback((id: ReportTemplateId) => {
    setSelectedTemplate(id);
    setSelectedDateRange(null);
    setPeerSlugs([]);
    setReportData(null);
    setError(null);
    setView("builder");
  }, []);

  const handlePeerToggle = useCallback((slug: string) => {
    setPeerSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!selectedTemplate || !selectedDateRange) return;

    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("template", selectedTemplate);
    params.set("m", municipalitySlug);
    params.set("sm", String(selectedDateRange.startMonth));
    params.set("sy", String(selectedDateRange.startYear));
    params.set("em", String(selectedDateRange.endMonth));
    params.set("ey", String(selectedDateRange.endYear));
    params.set("label", selectedDateRange.label);
    for (const peer of peerSlugs) {
      params.append("peer", peer);
    }

    try {
      const res = await fetch(`/api/edo/reports?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data: ReportData = await res.json();
      setReportData(data);
      setView("preview");

      // Save to history
      const generated: GeneratedReport = {
        id: generateReportId(),
        config: {
          templateId: selectedTemplate,
          municipalitySlug,
          municipalityName,
          dateRange: selectedDateRange,
          peerSlugs,
        },
        generatedAt: new Date().toISOString(),
        data,
      };
      saveReport(generated);
      setHistoryKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate report");
    } finally {
      setLoading(false);
    }
  }, [selectedTemplate, selectedDateRange, municipalitySlug, municipalityName, peerSlugs]);

  const handleExportPdf = useCallback(() => {
    if (!selectedTemplate || !selectedDateRange) return;

    const params = new URLSearchParams();
    params.set("template", selectedTemplate);
    params.set("m", municipalitySlug);
    params.set("sm", String(selectedDateRange.startMonth));
    params.set("sy", String(selectedDateRange.startYear));
    params.set("em", String(selectedDateRange.endMonth));
    params.set("ey", String(selectedDateRange.endYear));
    params.set("label", selectedDateRange.label);
    for (const peer of peerSlugs) {
      params.append("peer", peer);
    }

    window.open(`/api/edo/reports-pdf?${params.toString()}`, "_blank");
  }, [selectedTemplate, selectedDateRange, municipalitySlug, peerSlugs]);

  const handleViewCached = useCallback((report: GeneratedReport) => {
    setSelectedTemplate(report.config.templateId);
    setSelectedDateRange(report.config.dateRange);
    setPeerSlugs(report.config.peerSlugs);
    setReportData(report.data);
    setView("preview");
  }, []);

  const handleBack = useCallback(() => {
    if (view === "preview") {
      setView("builder");
    } else if (view === "builder") {
      setView("picker");
      setSelectedTemplate(null);
      setSelectedDateRange(null);
      setPeerSlugs([]);
      setReportData(null);
      setError(null);
    }
  }, [view]);

  return (
    <div className="space-y-6">
      {/* Navigation breadcrumb */}
      {view !== "picker" && (
        <button
          onClick={handleBack}
          className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors"
        >
          <ChevronLeft size={14} />
          {view === "builder" ? "Back to templates" : "Back to builder"}
        </button>
      )}

      {/* Template Picker View */}
      {view === "picker" && (
        <>
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">Choose a Report Template</h2>
            <p className="text-xs text-muted">
              Select a template to start building your council report.
            </p>
          </div>
          <TemplatePicker onSelect={handleTemplateSelect} />
          <ReportHistory
            key={historyKey}
            onView={handleViewCached}
            onRefresh={() => setHistoryKey((k) => k + 1)}
          />
        </>
      )}

      {/* Builder View */}
      {view === "builder" && template && (
        <>
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">{template.name}</h2>
            <p className="text-xs text-muted">{template.description}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left: Config */}
            <div className="lg:col-span-1 space-y-4">
              {/* Date Range */}
              <div className="bg-card border border-card-border rounded-xl p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
                  Date Range
                </h3>
                <div className="space-y-1">
                  {dateRangeOptions.map((range) => (
                    <button
                      key={range.label}
                      onClick={() => setSelectedDateRange(range)}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors ${
                        selectedDateRange?.label === range.label
                          ? "bg-indigo-500/10 text-indigo-400 font-medium"
                          : "text-muted hover:text-foreground hover:bg-card-border/30"
                      }`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Peer Picker */}
              <PeerPicker
                allMunicipalities={allMunicipalities}
                selected={peerSlugs}
                pinned={municipalitySlug}
                onToggle={handlePeerToggle}
                maxPeers={template.defaultPeerCount}
              />
            </div>

            {/* Right: Section preview + Generate */}
            <div className="lg:col-span-2 space-y-4">
              {/* Sections preview */}
              <div className="bg-card border border-card-border rounded-xl p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
                  Report Sections
                </h3>
                <div className="space-y-2">
                  {template.sections.map((s, i) => (
                    <div
                      key={s.id}
                      className="flex items-start gap-3 p-2 rounded-lg bg-background/50"
                    >
                      <span className="text-[10px] font-mono text-muted/40 mt-0.5 w-4 text-right">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-xs font-medium">{s.title}</p>
                        <p className="text-[10px] text-muted">{s.description}</p>
                      </div>
                    </div>
                  ))}
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
                    <span className="text-foreground font-medium">Period:</span>{" "}
                    {selectedDateRange?.label ?? "Not selected"}
                  </p>
                  <p>
                    <span className="text-foreground font-medium">Peers:</span>{" "}
                    {peerSlugs.length > 0
                      ? peerSlugs
                          .map(
                            (s) =>
                              allMunicipalities.find((m) => m.slug === s)?.name ?? s,
                          )
                          .join(", ")
                      : "None (no peer comparison)"}
                  </p>
                </div>

                {error && (
                  <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">
                    {error}
                  </div>
                )}

                <button
                  onClick={handleGenerate}
                  disabled={loading || !selectedDateRange}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {loading ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Generating report…
                    </>
                  ) : (
                    <>
                      <FileText size={14} />
                      Generate Report
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Preview View */}
      {view === "preview" && reportData && (
        <>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold">
                {reportData.templateName} — {reportData.municipalityName}
              </h2>
              <p className="text-xs text-muted">
                {reportData.dateRange.label} · Generated{" "}
                {new Date(reportData.generatedAt).toLocaleDateString("en-CA", {
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

          <ReportPreview data={reportData} />
        </>
      )}
    </div>
  );
}
