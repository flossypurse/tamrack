"use client";

import { useEffect, useState, useCallback } from "react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  Bell,
  AlertTriangle,
  Info,
  Shield,
  ChevronDown,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Settings2,
  X,
} from "lucide-react";
import {
  DEFAULT_ALERT_RULES,
  ALERT_CATEGORIES,
  SEVERITY_CONFIG,
  SEVERITY_ORDER,
  getDefaultPreferences,
  type AlertPreferences,
  type AlertRule,
  type AlertSeverity,
  type AlertDirection,
  type TriggeredAlert,
  type AlertEvaluationResult,
} from "@/lib/edo/alerts-shared";
import type { ComparisonCategory } from "@/lib/edo/compare-shared";

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

const PREFS_KEY = "edo-alert-preferences";

function loadPreferences(): AlertPreferences {
  if (typeof window === "undefined") return getDefaultPreferences();
  try {
    const stored = localStorage.getItem(PREFS_KEY);
    if (!stored) return getDefaultPreferences();
    return JSON.parse(stored) as AlertPreferences;
  } catch {
    return getDefaultPreferences();
  }
}

function savePreferences(prefs: AlertPreferences) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

// ---------------------------------------------------------------------------
// Sparkline (inline, avoids gradient ID collision with profile-section)
// ---------------------------------------------------------------------------

function AlertSparkline({
  data,
  color = "#6366f1",
}: {
  data: { date: string; value: number }[];
  color?: string;
}) {
  if (data.length < 2) return null;
  const id = `alert-sp-${color.replace("#", "")}-${data.length}`;
  return (
    <div className="h-10 w-full">
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
            labelFormatter={(label) => String(label)}
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
// Severity badge
// ---------------------------------------------------------------------------

function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  const config = SEVERITY_CONFIG[severity];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${config.bgColor} ${config.color} border ${config.borderColor}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
      {config.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Alert card
// ---------------------------------------------------------------------------

function AlertCard({ alert }: { alert: TriggeredAlert }) {
  const config = SEVERITY_CONFIG[alert.severity];
  const DirectionIcon = alert.changeDirection === "up" ? TrendingUp : TrendingDown;
  const sparklineColor =
    alert.severity === "critical"
      ? "#ef4444"
      : alert.severity === "warning"
        ? "#f59e0b"
        : "#6366f1";

  return (
    <div
      className={`bg-card border rounded-xl p-4 space-y-3 ${config.borderColor}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <SeverityBadge severity={alert.severity} />
            <span className="text-[10px] text-muted font-mono">
              {alert.rule.category}
            </span>
          </div>
          <h3 className="text-sm font-semibold leading-tight">
            {alert.rule.label}
          </h3>
          <p className="text-xs text-muted leading-relaxed">
            {alert.description}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <DirectionIcon
            size={16}
            className={
              alert.changeDirection === "up" ? "text-emerald-400" : "text-red-400"
            }
          />
          <span
            className={`text-sm font-semibold tabular-nums ${
              alert.changeDirection === "up" ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {alert.changePercent >= 0 ? "+" : ""}
            {alert.changePercent.toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="flex items-end gap-4">
        <div className="flex-1">
          <AlertSparkline data={alert.trend} color={sparklineColor} />
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] text-muted">
            {alert.previousPeriod} → {alert.period}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Configuration panel
// ---------------------------------------------------------------------------

function RuleToggle({
  rule,
  enabled,
  onToggle,
}: {
  rule: AlertRule;
  enabled: boolean;
  onToggle: (id: string) => void;
}) {
  const Icon = enabled ? ToggleRight : ToggleLeft;
  return (
    <button
      onClick={() => onToggle(rule.id)}
      className={`flex items-center gap-3 w-full text-left px-3 py-2 rounded-lg transition-colors ${
        enabled
          ? "hover:bg-card-border/20"
          : "opacity-50 hover:bg-card-border/10"
      }`}
    >
      <Icon
        size={20}
        className={enabled ? "text-indigo-400 shrink-0" : "text-muted shrink-0"}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{rule.label}</span>
          <SeverityBadge severity={rule.severity} />
        </div>
        <p className="text-[11px] text-muted leading-tight mt-0.5">
          {rule.description}
        </p>
      </div>
    </button>
  );
}

function CustomRuleForm({
  onAdd,
  onCancel,
}: {
  onAdd: (rule: AlertRule) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState("");
  const [regionalKey, setRegionalKey] = useState("Population");
  const [threshold, setThreshold] = useState(5);
  const [direction, setDirection] = useState<AlertDirection>("down");
  const [severity, setSeverity] = useState<AlertSeverity>("warning");
  const [category, setCategory] = useState<ComparisonCategory>("overview");

  const regionalKeyOptions = [
    "Population",
    "Assessment Base",
    "Building Permits",
    "Business Counts",
    "Crime Severity Index",
    "Median Household Income",
    "Average Weekly Earnings",
    "Incorporations",
    "Municipal Tax Rates",
    "Bankruptcies",
    "Net Migration",
    "Permanent Resident Landings",
    "Housing Starts",
    "Average Rent",
    "Average Residential Sale Price",
    "Vacancy Rates",
    "Unemployment Rate",
    "Labour Force",
    "Employment Insurance Beneficiaries",
    "Greenhouse Gas Emissions",
  ];

  const formatForKey: Record<string, AlertRule["format"]> = {
    "Population": "number",
    "Assessment Base": "currency",
    "Building Permits": "number",
    "Business Counts": "number",
    "Crime Severity Index": "number",
    "Median Household Income": "currency",
    "Average Weekly Earnings": "currency",
    "Incorporations": "number",
    "Municipal Tax Rates": "rate",
    "Bankruptcies": "number",
    "Net Migration": "number",
    "Permanent Resident Landings": "number",
    "Housing Starts": "number",
    "Average Rent": "currency",
    "Average Residential Sale Price": "currency",
    "Vacancy Rates": "percent",
    "Unemployment Rate": "percent",
    "Labour Force": "number",
    "Employment Insurance Beneficiaries": "number",
    "Greenhouse Gas Emissions": "number",
  };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;

    const id = `custom-${Date.now()}`;
    const dirLabel =
      direction === "up"
        ? "rises"
        : direction === "down"
          ? "drops"
          : "changes";

    onAdd({
      id,
      label: label.trim(),
      description: `${regionalKey} ${dirLabel} more than ${threshold}% period-over-period`,
      category,
      regionalKey,
      thresholdPercent: threshold,
      direction,
      severity,
      format: formatForKey[regionalKey] ?? "number",
      isDefault: false,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-background/50 border border-card-border/50 rounded-lg p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">New Custom Rule</h4>
        <button
          type="button"
          onClick={onCancel}
          className="p-1 text-muted hover:text-foreground transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] text-muted block mb-1">Rule Name</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Rent Surge"
            className="w-full bg-background border border-card-border rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            required
          />
        </div>

        <div>
          <label className="text-[11px] text-muted block mb-1">Indicator</label>
          <select
            value={regionalKey}
            onChange={(e) => setRegionalKey(e.target.value)}
            className="w-full bg-background border border-card-border rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {regionalKeyOptions.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] text-muted block mb-1">
            Threshold (%)
          </label>
          <input
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            min={0.1}
            max={100}
            step={0.1}
            className="w-full bg-background border border-card-border rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="text-[11px] text-muted block mb-1">Direction</label>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as AlertDirection)}
            className="w-full bg-background border border-card-border rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="down">Decrease</option>
            <option value="up">Increase</option>
            <option value="either">Either</option>
          </select>
        </div>

        <div>
          <label className="text-[11px] text-muted block mb-1">Severity</label>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as AlertSeverity)}
            className="w-full bg-background border border-card-border rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
        </div>

        <div>
          <label className="text-[11px] text-muted block mb-1">Category</label>
          <select
            value={category}
            onChange={(e) =>
              setCategory(e.target.value as ComparisonCategory)
            }
            className="w-full bg-background border border-card-border rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {ALERT_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="submit"
        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
      >
        Add Rule
      </button>
    </form>
  );
}

function ConfigPanel({
  prefs,
  onPrefsChange,
}: {
  prefs: AlertPreferences;
  onPrefsChange: (prefs: AlertPreferences) => void;
}) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["overview"]),
  );
  const [showCustomForm, setShowCustomForm] = useState(false);

  function toggleCategory(cat: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  function toggleRule(ruleId: string) {
    const next = { ...prefs };
    if (next.disabledRuleIds.includes(ruleId)) {
      next.disabledRuleIds = next.disabledRuleIds.filter((id) => id !== ruleId);
    } else {
      next.disabledRuleIds = [...next.disabledRuleIds, ruleId];
    }
    onPrefsChange(next);
  }

  function addCustomRule(rule: AlertRule) {
    const next = {
      ...prefs,
      customRules: [...prefs.customRules, rule],
    };
    onPrefsChange(next);
    setShowCustomForm(false);
  }

  function removeCustomRule(ruleId: string) {
    const next = {
      ...prefs,
      customRules: prefs.customRules.filter((r) => r.id !== ruleId),
      disabledRuleIds: prefs.disabledRuleIds.filter((id) => id !== ruleId),
    };
    onPrefsChange(next);
  }

  const allRules = [...DEFAULT_ALERT_RULES, ...prefs.customRules];
  const enabledCount = allRules.filter(
    (r) => !prefs.disabledRuleIds.includes(r.id),
  ).length;

  return (
    <div className="bg-card border border-card-border rounded-xl p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 size={16} className="text-indigo-400" />
          <h2 className="text-sm font-semibold">Alert Configuration</h2>
        </div>
        <span className="text-[10px] text-muted font-mono">
          {enabledCount}/{allRules.length} active
        </span>
      </div>

      {/* Default rules by category */}
      {ALERT_CATEGORIES.map((cat) => {
        const catRules = allRules.filter((r) => r.category === cat.id);
        if (catRules.length === 0) return null;
        const expanded = expandedCategories.has(cat.id);

        return (
          <div key={cat.id}>
            <button
              onClick={() => toggleCategory(cat.id)}
              className="flex items-center gap-2 w-full text-left py-1"
            >
              {expanded ? (
                <ChevronDown size={14} className="text-muted" />
              ) : (
                <ChevronRight size={14} className="text-muted" />
              )}
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                {cat.label}
              </span>
              <span className="text-[10px] text-muted/50 font-mono">
                {catRules.filter((r) => !prefs.disabledRuleIds.includes(r.id)).length}
                /{catRules.length}
              </span>
            </button>
            {expanded && (
              <div className="space-y-0.5 mt-1">
                {catRules.map((rule) => (
                  <div key={rule.id} className="flex items-center gap-1">
                    <div className="flex-1 min-w-0">
                      <RuleToggle
                        rule={rule}
                        enabled={!prefs.disabledRuleIds.includes(rule.id)}
                        onToggle={toggleRule}
                      />
                    </div>
                    {!rule.isDefault && (
                      <button
                        onClick={() => removeCustomRule(rule.id)}
                        className="p-1.5 text-muted hover:text-red-400 transition-colors shrink-0"
                        title="Remove custom rule"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Custom rule form */}
      {showCustomForm ? (
        <CustomRuleForm
          onAdd={addCustomRule}
          onCancel={() => setShowCustomForm(false)}
        />
      ) : (
        <button
          onClick={() => setShowCustomForm(true)}
          className="flex items-center gap-2 px-3 py-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          <Plus size={14} />
          Add custom rule
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary bar
// ---------------------------------------------------------------------------

function AlertSummary({ alerts }: { alerts: TriggeredAlert[] }) {
  const counts: Record<AlertSeverity, number> = { critical: 0, warning: 0, info: 0 };
  for (const a of alerts) counts[a.severity]++;

  return (
    <div className="flex items-center gap-4">
      {SEVERITY_ORDER.map((sev) => {
        if (counts[sev] === 0) return null;
        const config = SEVERITY_CONFIG[sev];
        const Icon =
          sev === "critical"
            ? AlertTriangle
            : sev === "warning"
              ? Shield
              : Info;
        return (
          <div key={sev} className="flex items-center gap-1.5">
            <Icon size={14} className={config.color} />
            <span className={`text-sm font-semibold ${config.color}`}>
              {counts[sev]}
            </span>
            <span className="text-xs text-muted">{config.label}</span>
          </div>
        );
      })}
      {alerts.length === 0 && (
        <div className="flex items-center gap-1.5 text-emerald-400">
          <Shield size={14} />
          <span className="text-sm font-medium">All clear</span>
          <span className="text-xs text-muted">No alerts triggered</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export default function AlertsClient({
  municipalitySlug,
}: {
  municipalitySlug: string;
}) {
  const [prefs, setPrefs] = useState<AlertPreferences>(getDefaultPreferences);
  const [result, setResult] = useState<AlertEvaluationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);

  // Load preferences from localStorage on mount
  useEffect(() => {
    setPrefs(loadPreferences());
  }, []);

  // Save preferences whenever they change
  const handlePrefsChange = useCallback((newPrefs: AlertPreferences) => {
    setPrefs(newPrefs);
    savePreferences(newPrefs);
  }, []);

  // Fetch alerts
  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("m", municipalitySlug);

      for (const id of prefs.disabledRuleIds) {
        params.append("disabled", id);
      }

      if (prefs.customRules.length > 0) {
        params.set("custom", JSON.stringify(prefs.customRules));
      }

      const res = await fetch(`/api/edo/alerts?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      const data: AlertEvaluationResult = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to evaluate alerts");
    } finally {
      setLoading(false);
    }
  }, [municipalitySlug, prefs]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  return (
    <div className="space-y-6">
      {/* Header area with summary + controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          {result && !loading && <AlertSummary alerts={result.alerts} />}
          {loading && (
            <p className="text-sm text-muted animate-pulse">
              Evaluating alert rules...
            </p>
          )}
          {error && (
            <p className="text-sm text-red-400">Error: {error}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchAlerts}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground bg-card border border-card-border rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={() => setShowConfig(!showConfig)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border ${
              showConfig
                ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/30"
                : "text-muted hover:text-foreground bg-card border-card-border"
            }`}
          >
            <Settings2 size={12} />
            Configure
          </button>
        </div>
      </div>

      {/* Configuration panel (collapsible) */}
      {showConfig && (
        <ConfigPanel prefs={prefs} onPrefsChange={handlePrefsChange} />
      )}

      {/* Alert cards */}
      {result && !loading && result.alerts.length > 0 && (
        <div className="space-y-3">
          {result.alerts.map((alert) => (
            <AlertCard key={alert.ruleId} alert={alert} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {result && !loading && result.alerts.length === 0 && (
        <div className="bg-card border border-card-border rounded-xl p-8 text-center space-y-3">
          <Shield size={32} className="mx-auto text-emerald-400/40" />
          <h2 className="text-lg font-semibold text-muted/60">
            No alerts triggered
          </h2>
          <p className="text-sm text-muted max-w-md mx-auto">
            All {result.rulesEvaluated} active rules were evaluated against the
            latest data for your municipality. No thresholds were exceeded.
          </p>
          <button
            onClick={() => setShowConfig(true)}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Adjust alert thresholds
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-card border border-card-border rounded-xl p-4 space-y-3 animate-pulse"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-20 bg-card-border/30 rounded" />
                  <div className="h-5 w-40 bg-card-border/30 rounded" />
                  <div className="h-3 w-64 bg-card-border/20 rounded" />
                </div>
                <div className="h-6 w-16 bg-card-border/30 rounded" />
              </div>
              <div className="h-10 bg-card-border/20 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      {result && !loading && (
        <p className="text-[10px] text-muted/40 font-mono text-right">
          {result.rulesEvaluated} rules evaluated at{" "}
          {new Date(result.evaluatedAt).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
