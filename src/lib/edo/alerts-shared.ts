/**
 * EDO Trend Alerts — Shared types, constants, and default rules.
 * Safe to import from both client and server components.
 * Follows the compare-shared.ts pattern to avoid pg/tls client bundle issues.
 */

import type { ComparisonCategory } from "./compare-shared";
import { formatComparisonValue } from "./compare-shared";
export { formatComparisonValue };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AlertSeverity = "info" | "warning" | "critical";
export type AlertDirection = "up" | "down" | "either";

export interface AlertRule {
  id: string;
  label: string;
  description: string;
  category: ComparisonCategory;
  /** regionaldashboard.alberta.ca indicator name */
  regionalKey: string;
  /** Percentage threshold that triggers the alert */
  thresholdPercent: number;
  /** Which direction triggers: "up" = increase, "down" = decrease, "either" = both */
  direction: AlertDirection;
  /** Base severity — may be escalated if change is 2x+ threshold */
  severity: AlertSeverity;
  /** Format for display */
  format: "number" | "currency" | "percent" | "rate";
  /** Whether this is a built-in default rule */
  isDefault: boolean;
}

export interface TriggeredAlert {
  ruleId: string;
  rule: AlertRule;
  municipalitySlug: string;
  municipalityName: string;
  severity: AlertSeverity;
  currentValue: number | null;
  previousValue: number | null;
  changePercent: number;
  changeDirection: "up" | "down";
  period: string;
  previousPeriod: string;
  description: string;
  trend: { date: string; value: number }[];
  evaluatedAt: string;
}

export interface AlertEvaluationResult {
  municipalitySlug: string;
  municipalityName: string;
  alerts: TriggeredAlert[];
  rulesEvaluated: number;
  evaluatedAt: string;
}

/** User's alert preferences (stored in localStorage) */
export interface AlertPreferences {
  /** Rule IDs that are disabled (all enabled by default) */
  disabledRuleIds: string[];
  /** Custom rules added by the user */
  customRules: AlertRule[];
}

// ---------------------------------------------------------------------------
// Default alert rules — common EDO concerns
// ---------------------------------------------------------------------------

export const DEFAULT_ALERT_RULES: AlertRule[] = [
  // Overview / Critical
  {
    id: "population-decline",
    label: "Population Decline",
    description: "Population drops more than 1% period-over-period",
    category: "overview",
    regionalKey: "Population",
    thresholdPercent: 1,
    direction: "down",
    severity: "critical",
    format: "number",
    isDefault: true,
  },
  {
    id: "assessment-base-drop",
    label: "Assessment Base Drop",
    description: "Assessment base drops more than 3% period-over-period",
    category: "overview",
    regionalKey: "Assessment Base",
    thresholdPercent: 3,
    direction: "down",
    severity: "critical",
    format: "currency",
    isDefault: true,
  },
  {
    id: "crime-severity-spike",
    label: "Crime Severity Spike",
    description: "Crime severity index rises more than 10% period-over-period",
    category: "overview",
    regionalKey: "Crime Severity Index",
    thresholdPercent: 10,
    direction: "up",
    severity: "warning",
    format: "number",
    isDefault: true,
  },

  // Economy
  {
    id: "median-income-drop",
    label: "Median Income Decline",
    description: "Median household income drops more than 3% period-over-period",
    category: "economy",
    regionalKey: "Median Household Income",
    thresholdPercent: 3,
    direction: "down",
    severity: "warning",
    format: "currency",
    isDefault: true,
  },
  {
    id: "bankruptcies-spike",
    label: "Bankruptcies Surge",
    description: "Bankruptcies increase more than 15% period-over-period",
    category: "economy",
    regionalKey: "Bankruptcies",
    thresholdPercent: 15,
    direction: "up",
    severity: "warning",
    format: "number",
    isDefault: true,
  },
  {
    id: "incorporations-surge",
    label: "New Business Surge",
    description: "Incorporations increase more than 10% period-over-period",
    category: "economy",
    regionalKey: "Incorporations",
    thresholdPercent: 10,
    direction: "up",
    severity: "info",
    format: "number",
    isDefault: true,
  },
  {
    id: "tax-rate-increase",
    label: "Tax Rate Increase",
    description: "Municipal tax rate rises more than 5% period-over-period",
    category: "economy",
    regionalKey: "Municipal Tax Rates",
    thresholdPercent: 5,
    direction: "up",
    severity: "warning",
    format: "rate",
    isDefault: true,
  },

  // Demographics
  {
    id: "net-migration-drop",
    label: "Net Migration Decline",
    description: "Net migration drops more than 20% period-over-period",
    category: "demographics",
    regionalKey: "Net Migration",
    thresholdPercent: 20,
    direction: "down",
    severity: "warning",
    format: "number",
    isDefault: true,
  },
  {
    id: "immigration-surge",
    label: "Immigration Surge",
    description: "Permanent resident landings increase more than 15% period-over-period",
    category: "demographics",
    regionalKey: "Permanent Resident Landings",
    thresholdPercent: 15,
    direction: "up",
    severity: "info",
    format: "number",
    isDefault: true,
  },

  // Housing
  {
    id: "permit-slowdown",
    label: "Building Permit Slowdown",
    description: "Building permits drop more than 15% period-over-period",
    category: "housing",
    regionalKey: "Building Permits",
    thresholdPercent: 15,
    direction: "down",
    severity: "warning",
    format: "number",
    isDefault: true,
  },
  {
    id: "housing-starts-drop",
    label: "Housing Starts Decline",
    description: "Housing starts drop more than 15% period-over-period",
    category: "housing",
    regionalKey: "Housing Starts",
    thresholdPercent: 15,
    direction: "down",
    severity: "warning",
    format: "number",
    isDefault: true,
  },
  {
    id: "vacancy-rate-spike",
    label: "Vacancy Rate Spike",
    description: "Vacancy rate increases more than 20% period-over-period",
    category: "housing",
    regionalKey: "Vacancy Rates",
    thresholdPercent: 20,
    direction: "up",
    severity: "warning",
    format: "percent",
    isDefault: true,
  },
  {
    id: "sale-price-surge",
    label: "Home Price Surge",
    description: "Average residential sale price rises more than 10% period-over-period",
    category: "housing",
    regionalKey: "Average Residential Sale Price",
    thresholdPercent: 10,
    direction: "up",
    severity: "info",
    format: "currency",
    isDefault: true,
  },

  // Labour
  {
    id: "unemployment-spike",
    label: "Unemployment Spike",
    description: "Unemployment rate rises more than 15% period-over-period",
    category: "labour",
    regionalKey: "Unemployment Rate",
    thresholdPercent: 15,
    direction: "up",
    severity: "critical",
    format: "percent",
    isDefault: true,
  },
  {
    id: "labour-force-decline",
    label: "Labour Force Decline",
    description: "Labour force shrinks more than 3% period-over-period",
    category: "labour",
    regionalKey: "Labour Force",
    thresholdPercent: 3,
    direction: "down",
    severity: "warning",
    format: "number",
    isDefault: true,
  },
  {
    id: "ei-beneficiaries-spike",
    label: "EI Claims Surge",
    description: "Employment insurance beneficiaries increase more than 15% period-over-period",
    category: "labour",
    regionalKey: "Employment Insurance Beneficiaries",
    thresholdPercent: 15,
    direction: "up",
    severity: "warning",
    format: "number",
    isDefault: true,
  },
];

// ---------------------------------------------------------------------------
// Category metadata
// ---------------------------------------------------------------------------

export const ALERT_CATEGORIES: { id: ComparisonCategory; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "economy", label: "Economy" },
  { id: "demographics", label: "Demographics" },
  { id: "housing", label: "Housing" },
  { id: "labour", label: "Labour" },
];

// ---------------------------------------------------------------------------
// Severity helpers
// ---------------------------------------------------------------------------

export const SEVERITY_CONFIG: Record<
  AlertSeverity,
  { label: string; color: string; bgColor: string; borderColor: string; dotColor: string }
> = {
  critical: {
    label: "Critical",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    dotColor: "bg-red-400",
  },
  warning: {
    label: "Warning",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    dotColor: "bg-amber-400",
  },
  info: {
    label: "Info",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    dotColor: "bg-blue-400",
  },
};

export const SEVERITY_ORDER: AlertSeverity[] = ["critical", "warning", "info"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getDefaultPreferences(): AlertPreferences {
  return {
    disabledRuleIds: [],
    customRules: [],
  };
}

/** Merge default + custom rules, excluding disabled ones */
export function getActiveRules(prefs: AlertPreferences): AlertRule[] {
  const allRules = [...DEFAULT_ALERT_RULES, ...prefs.customRules];
  return allRules.filter((r) => !prefs.disabledRuleIds.includes(r.id));
}

/** Build a human-readable description of a triggered alert */
export function buildAlertDescription(
  rule: AlertRule,
  changePercent: number,
  direction: "up" | "down",
  currentFormatted: string,
  previousFormatted: string,
): string {
  const dirLabel = direction === "up" ? "increased" : "decreased";
  const absPct = Math.abs(changePercent).toFixed(1);
  return `${rule.label} ${dirLabel} ${absPct}% (${previousFormatted} → ${currentFormatted})`;
}
