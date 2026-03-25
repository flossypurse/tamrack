/**
 * EDO Council Reports — Shared types, constants, and template definitions.
 * Safe to import from both client and server components.
 * Follows the compare-shared.ts / alerts-shared.ts pattern to avoid pg/tls client bundle issues.
 */

import type { ComparisonCategory } from "./compare-shared";
import { COMPARISON_INDICATORS, formatComparisonValue } from "./compare-shared";
export { formatComparisonValue };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReportTemplateId = "monthly" | "quarterly" | "annual";

export interface ReportSectionDef {
  id: string;
  title: string;
  description: string;
  /** Which data to pull for this section */
  type: "headline-metrics" | "profile-section" | "peer-comparison" | "alerts-summary" | "data-citations";
  /** For profile-section type: which profile section to render */
  profileSectionKey?: keyof typeof PROFILE_SECTION_KEYS;
  /** For peer-comparison type: which indicator IDs to compare */
  comparisonIndicatorIds?: string[];
}

export interface ReportTemplate {
  id: ReportTemplateId;
  name: string;
  description: string;
  icon: string; // lucide icon name
  sections: ReportSectionDef[];
  /** Default date range type */
  dateRangeType: "month" | "quarter" | "year";
  /** Default number of peer municipalities to suggest */
  defaultPeerCount: number;
}

/** Serializable report config that the user selects before generating */
export interface ReportConfig {
  templateId: ReportTemplateId;
  municipalitySlug: string;
  municipalityName: string;
  dateRange: DateRange;
  peerSlugs: string[];
}

export interface DateRange {
  label: string;
  startMonth: number; // 1-12
  startYear: number;
  endMonth: number;
  endYear: number;
}

/** A generated report stored in history */
export interface GeneratedReport {
  id: string;
  config: ReportConfig;
  generatedAt: string;
  /** Serialized report data for re-viewing */
  data: ReportData;
}

export interface ReportData {
  municipalityName: string;
  municipalitySlug: string;
  templateName: string;
  dateRange: DateRange;
  generatedAt: string;
  sections: ReportSectionData[];
}

export interface ReportSectionData {
  id: string;
  title: string;
  type: ReportSectionDef["type"];
  metrics?: ReportMetric[];
  comparison?: ReportComparisonData;
  alerts?: ReportAlertData[];
  citations?: string[];
}

export interface ReportMetric {
  label: string;
  value: number | null;
  formatted: string;
  unit: string;
  period: string;
  change?: string;
  trend: { date: string; value: number }[];
}

export interface ReportComparisonData {
  municipalities: { slug: string; name: string; color: string }[];
  indicators: { id: string; label: string; format: "number" | "currency" | "percent" | "rate" }[];
  rows: ReportComparisonRow[];
}

export interface ReportComparisonRow {
  indicatorId: string;
  indicatorLabel: string;
  values: { slug: string; value: number | null; formatted: string; change: string | null }[];
}

export interface ReportAlertData {
  severity: "info" | "warning" | "critical";
  label: string;
  description: string;
  changePercent: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Map of profile section keys for type safety */
export const PROFILE_SECTION_KEYS = {
  overview: "overview",
  economy: "economy",
  demographics: "demographics",
  housing: "housing",
  labour: "labour",
  infrastructure: "infrastructure",
} as const;

// Default peer comparison indicators per template type
const MONTHLY_COMPARISON_IDS = [
  "population",
  "building-permits",
  "unemployment",
  "housing-starts",
];

const QUARTERLY_COMPARISON_IDS = [
  "population",
  "assessment-base",
  "building-permits",
  "unemployment",
  "median-income",
  "housing-starts",
  "avg-rent",
  "vacancy-rate",
];

const ANNUAL_COMPARISON_IDS = [
  "population",
  "assessment-base",
  "building-permits",
  "business-counts",
  "unemployment",
  "median-income",
  "housing-starts",
  "avg-sale-price",
  "vacancy-rate",
  "labour-force",
  "net-migration",
  "crime-severity",
];

// ---------------------------------------------------------------------------
// Report Templates
// ---------------------------------------------------------------------------

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: "monthly",
    name: "Monthly Update",
    description: "A concise one-page snapshot of your municipality's key indicators and recent changes. Ideal for regular council briefings.",
    icon: "Calendar",
    dateRangeType: "month",
    defaultPeerCount: 2,
    sections: [
      {
        id: "headline",
        title: "Key Indicators",
        description: "Top-level metrics at a glance",
        type: "headline-metrics",
      },
      {
        id: "economy",
        title: "Economic Snapshot",
        description: "Income, business activity, and tax metrics",
        type: "profile-section",
        profileSectionKey: "economy",
      },
      {
        id: "housing",
        title: "Housing Update",
        description: "Starts, rents, prices, and vacancy",
        type: "profile-section",
        profileSectionKey: "housing",
      },
      {
        id: "alerts",
        title: "Recent Alerts",
        description: "Triggered trend alerts for your municipality",
        type: "alerts-summary",
      },
      {
        id: "peers",
        title: "Peer Comparison",
        description: "Side-by-side with comparable municipalities",
        type: "peer-comparison",
        comparisonIndicatorIds: MONTHLY_COMPARISON_IDS,
      },
      {
        id: "citations",
        title: "Data Sources",
        description: "Sources and timestamps for all data",
        type: "data-citations",
      },
    ],
  },
  {
    id: "quarterly",
    name: "Quarterly Review",
    description: "A comprehensive review covering economy, demographics, housing, and labour trends. Includes peer comparison and trend alerts.",
    icon: "BarChart3",
    dateRangeType: "quarter",
    defaultPeerCount: 3,
    sections: [
      {
        id: "headline",
        title: "Key Indicators",
        description: "Top-level metrics at a glance",
        type: "headline-metrics",
      },
      {
        id: "overview",
        title: "Community Overview",
        description: "Population, assessment base, permits, business counts",
        type: "profile-section",
        profileSectionKey: "overview",
      },
      {
        id: "economy",
        title: "Economy",
        description: "Income, business activity, and tax metrics",
        type: "profile-section",
        profileSectionKey: "economy",
      },
      {
        id: "housing",
        title: "Housing",
        description: "Starts, rents, prices, and vacancy",
        type: "profile-section",
        profileSectionKey: "housing",
      },
      {
        id: "labour",
        title: "Labour Market",
        description: "Unemployment, labour force, enrolment",
        type: "profile-section",
        profileSectionKey: "labour",
      },
      {
        id: "alerts",
        title: "Trend Alerts",
        description: "All triggered alerts for the quarter",
        type: "alerts-summary",
      },
      {
        id: "peers",
        title: "Peer Comparison",
        description: "Side-by-side with comparable municipalities",
        type: "peer-comparison",
        comparisonIndicatorIds: QUARTERLY_COMPARISON_IDS,
      },
      {
        id: "citations",
        title: "Data Sources",
        description: "Sources and timestamps for all data",
        type: "data-citations",
      },
    ],
  },
  {
    id: "annual",
    name: "Annual Summary",
    description: "A full-year analysis with all data sections, deep peer comparison, and complete alert history. Perfect for year-end council presentations.",
    icon: "TrendingUp",
    dateRangeType: "year",
    defaultPeerCount: 4,
    sections: [
      {
        id: "headline",
        title: "Key Indicators",
        description: "Top-level metrics at a glance",
        type: "headline-metrics",
      },
      {
        id: "overview",
        title: "Community Overview",
        description: "Population, assessment base, permits, business counts",
        type: "profile-section",
        profileSectionKey: "overview",
      },
      {
        id: "economy",
        title: "Economy",
        description: "Income, business activity, and tax metrics",
        type: "profile-section",
        profileSectionKey: "economy",
      },
      {
        id: "demographics",
        title: "Demographics",
        description: "Migration, immigration, life expectancy, education",
        type: "profile-section",
        profileSectionKey: "demographics",
      },
      {
        id: "housing",
        title: "Housing",
        description: "Starts, rents, prices, and vacancy",
        type: "profile-section",
        profileSectionKey: "housing",
      },
      {
        id: "labour",
        title: "Labour Market",
        description: "Unemployment, labour force, enrolment, emissions",
        type: "profile-section",
        profileSectionKey: "labour",
      },
      {
        id: "infrastructure",
        title: "Infrastructure & Local Data",
        description: "Parcels, businesses, zoning data",
        type: "profile-section",
        profileSectionKey: "infrastructure",
      },
      {
        id: "alerts",
        title: "Trend Alerts",
        description: "All triggered alerts for the year",
        type: "alerts-summary",
      },
      {
        id: "peers",
        title: "Peer Comparison",
        description: "Comprehensive peer comparison across all key indicators",
        type: "peer-comparison",
        comparisonIndicatorIds: ANNUAL_COMPARISON_IDS,
      },
      {
        id: "citations",
        title: "Data Sources",
        description: "Sources and timestamps for all data",
        type: "data-citations",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getTemplate(id: ReportTemplateId): ReportTemplate | undefined {
  return REPORT_TEMPLATES.find((t) => t.id === id);
}

/** Generate date range options for a template type */
export function getDateRangeOptions(type: "month" | "quarter" | "year"): DateRange[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-indexed
  const ranges: DateRange[] = [];

  if (type === "month") {
    // Last 12 months
    for (let i = 0; i < 12; i++) {
      let m = currentMonth - i;
      let y = currentYear;
      if (m <= 0) {
        m += 12;
        y -= 1;
      }
      const monthName = new Date(y, m - 1, 1).toLocaleString("en-CA", { month: "long" });
      ranges.push({
        label: `${monthName} ${y}`,
        startMonth: m,
        startYear: y,
        endMonth: m,
        endYear: y,
      });
    }
  } else if (type === "quarter") {
    // Last 8 quarters
    let qMonth = Math.floor((currentMonth - 1) / 3) * 3 + 1; // Start of current quarter
    let qYear = currentYear;
    for (let i = 0; i < 8; i++) {
      const endMonth = qMonth + 2;
      const qNum = Math.floor((qMonth - 1) / 3) + 1;
      ranges.push({
        label: `Q${qNum} ${qYear}`,
        startMonth: qMonth,
        startYear: qYear,
        endMonth,
        endYear: qYear,
      });
      qMonth -= 3;
      if (qMonth <= 0) {
        qMonth += 12;
        qYear -= 1;
      }
    }
  } else {
    // Last 5 years
    for (let i = 0; i < 5; i++) {
      const y = currentYear - i;
      ranges.push({
        label: String(y),
        startMonth: 1,
        startYear: y,
        endMonth: 12,
        endYear: y,
      });
    }
  }

  return ranges;
}

/** Format a date range for display */
export function formatDateRange(range: DateRange): string {
  return range.label;
}

/** Generate a unique ID for report history */
export function generateReportId(): string {
  return `rpt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// localStorage helpers for report history
// ---------------------------------------------------------------------------

const STORAGE_KEY = "edo-report-history";
const MAX_REPORTS = 20;

export function loadReportHistory(): GeneratedReport[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as GeneratedReport[];
  } catch {
    return [];
  }
}

export function saveReport(report: GeneratedReport): void {
  if (typeof window === "undefined") return;
  const history = loadReportHistory();
  history.unshift(report);
  // Keep only the last N reports
  const trimmed = history.slice(0, MAX_REPORTS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export function deleteReport(reportId: string): void {
  if (typeof window === "undefined") return;
  const history = loadReportHistory();
  const filtered = history.filter((r) => r.id !== reportId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}
