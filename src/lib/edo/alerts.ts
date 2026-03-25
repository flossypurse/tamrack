/**
 * EDO Trend Alerts Engine (server-only)
 *
 * Evaluates alert rules against regional time series data for a municipality.
 * Reuses fetchRegionalTimeSeries() — no duplicated fetch logic.
 */

import {
  fetchRegionalTimeSeries,
  type TimeSeriesPoint,
} from "../data-sources-regional";
import { getMunicipality } from "../municipality-registry";

// Re-export shared types/constants for server-side consumers
export {
  DEFAULT_ALERT_RULES,
  ALERT_CATEGORIES,
  SEVERITY_CONFIG,
  SEVERITY_ORDER,
  getDefaultPreferences,
  getActiveRules,
  buildAlertDescription,
  formatComparisonValue,
} from "./alerts-shared";
export type {
  AlertRule,
  AlertSeverity,
  AlertDirection,
  TriggeredAlert,
  AlertEvaluationResult,
  AlertPreferences,
} from "./alerts-shared";

import type {
  AlertRule,
  AlertSeverity,
  TriggeredAlert,
  AlertEvaluationResult,
} from "./alerts-shared";
import { buildAlertDescription, formatComparisonValue } from "./alerts-shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function safeTimeSeries(
  indicator: string,
  municipalityName: string,
): Promise<TimeSeriesPoint[]> {
  try {
    return await fetchRegionalTimeSeries(indicator, municipalityName);
  } catch {
    return [];
  }
}

/** Escalate severity if change is 2x+ the threshold */
function escalateSeverity(
  baseSeverity: AlertSeverity,
  changePercent: number,
  threshold: number,
): AlertSeverity {
  const ratio = Math.abs(changePercent) / threshold;
  if (ratio >= 3 && baseSeverity !== "critical") return "critical";
  if (ratio >= 2 && baseSeverity === "info") return "warning";
  return baseSeverity;
}

// ---------------------------------------------------------------------------
// Single rule evaluator
// ---------------------------------------------------------------------------

async function evaluateRule(
  rule: AlertRule,
  municipalitySlug: string,
  municipalityName: string,
): Promise<TriggeredAlert | null> {
  const series = await safeTimeSeries(rule.regionalKey, municipalityName);

  if (series.length < 2) return null;

  const current = series[series.length - 1];
  const previous = series[series.length - 2];

  if (previous.value === 0) return null;

  const changePercent =
    ((current.value - previous.value) / Math.abs(previous.value)) * 100;
  const absChange = Math.abs(changePercent);
  const direction: "up" | "down" = changePercent >= 0 ? "up" : "down";

  // Check if change exceeds threshold in the monitored direction
  const triggered =
    absChange >= rule.thresholdPercent &&
    (rule.direction === "either" || rule.direction === direction);

  if (!triggered) return null;

  const severity = escalateSeverity(rule.severity, changePercent, rule.thresholdPercent);

  const currentFormatted = formatComparisonValue(current.value, rule.format);
  const previousFormatted = formatComparisonValue(previous.value, rule.format);

  return {
    ruleId: rule.id,
    rule,
    municipalitySlug,
    municipalityName,
    severity,
    currentValue: current.value,
    previousValue: previous.value,
    changePercent,
    changeDirection: direction,
    period: current.date,
    previousPeriod: previous.date,
    description: buildAlertDescription(
      rule,
      changePercent,
      direction,
      currentFormatted,
      previousFormatted,
    ),
    trend: series.slice(-10),
    evaluatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Main evaluator — evaluates all active rules for a municipality
// ---------------------------------------------------------------------------

export async function evaluateAlerts(
  municipalitySlug: string,
  rules: AlertRule[],
): Promise<AlertEvaluationResult> {
  const config = getMunicipality(municipalitySlug);
  const municipalityName = config
    ? config.name
    : municipalitySlug
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

  // Evaluate all rules in parallel
  const results = await Promise.all(
    rules.map((rule) => evaluateRule(rule, municipalitySlug, municipalityName)),
  );

  // Filter to only triggered alerts, sort by severity (critical first)
  const severityWeight: Record<AlertSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };

  const alerts = results
    .filter((r): r is TriggeredAlert => r !== null)
    .sort((a, b) => severityWeight[a.severity] - severityWeight[b.severity]);

  return {
    municipalitySlug,
    municipalityName,
    alerts,
    rulesEvaluated: rules.length,
    evaluatedAt: new Date().toISOString(),
  };
}
