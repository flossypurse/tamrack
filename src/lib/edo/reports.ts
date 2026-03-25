/**
 * EDO Council Reports Engine (server-only)
 *
 * Generates structured report data by assembling data from:
 * - buildCommunityProfile() for profile sections
 * - fetchComparison() for peer comparison
 * - evaluateAlerts() for trend alerts
 *
 * Reuses existing data aggregators — no duplicated fetch logic.
 */

import { buildCommunityProfile, type CommunityProfile, type ProfileMetric } from "./profile-data";
import { fetchComparison } from "./compare";
import { COMPARISON_INDICATORS, formatComparisonValue } from "./compare-shared";
import { evaluateAlerts, DEFAULT_ALERT_RULES } from "./alerts";
import { getMunicipality } from "../municipality-registry";

// Re-export shared types and constants for server-side consumers
export {
  REPORT_TEMPLATES,
  getTemplate,
  getDateRangeOptions,
  formatDateRange,
  generateReportId,
  PROFILE_SECTION_KEYS,
} from "./reports-shared";
export type {
  ReportTemplateId,
  ReportTemplate,
  ReportSectionDef,
  ReportConfig,
  DateRange,
  GeneratedReport,
  ReportData,
  ReportSectionData,
  ReportMetric,
  ReportComparisonData,
  ReportComparisonRow,
  ReportAlertData,
} from "./reports-shared";

import type {
  ReportConfig,
  ReportData,
  ReportSectionData,
  ReportSectionDef,
  ReportMetric,
  ReportComparisonData,
  ReportComparisonRow,
  ReportAlertData,
} from "./reports-shared";
import { getTemplate, PROFILE_SECTION_KEYS } from "./reports-shared";

// ---------------------------------------------------------------------------
// Profile metric → ReportMetric converter
// ---------------------------------------------------------------------------

function toReportMetric(m: ProfileMetric): ReportMetric {
  return {
    label: m.label,
    value: m.value,
    formatted: m.formatted,
    unit: m.unit,
    period: m.period,
    change: m.change,
    trend: m.trend,
  };
}

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

function buildHeadlineSection(
  def: ReportSectionDef,
  profile: CommunityProfile,
): ReportSectionData {
  const headlines = [
    profile.sections.overview.metrics.find((m) => m.label === "Population"),
    profile.sections.overview.metrics.find((m) => m.label === "Assessment Base"),
    profile.sections.overview.metrics.find((m) => m.label === "Building Permits"),
    profile.sections.overview.metrics.find((m) => m.label === "Business Counts"),
  ].filter(Boolean) as ProfileMetric[];

  return {
    id: def.id,
    title: def.title,
    type: def.type,
    metrics: headlines.map(toReportMetric),
  };
}

function buildProfileSection(
  def: ReportSectionDef,
  profile: CommunityProfile,
): ReportSectionData {
  const key = def.profileSectionKey;
  if (!key || !(key in profile.sections)) {
    return { id: def.id, title: def.title, type: def.type, metrics: [] };
  }

  const section = profile.sections[key as keyof typeof profile.sections];
  const metrics = section.metrics
    .filter((m) => m.formatted !== "—" || m.trend.length > 0)
    .map(toReportMetric);

  return {
    id: def.id,
    title: def.title,
    type: def.type,
    metrics,
  };
}

async function buildComparisonSection(
  def: ReportSectionDef,
  municipalitySlug: string,
  peerSlugs: string[],
): Promise<ReportSectionData> {
  const allSlugs = [municipalitySlug, ...peerSlugs.filter((s) => s !== municipalitySlug)];

  if (allSlugs.length < 2 || !def.comparisonIndicatorIds?.length) {
    return { id: def.id, title: def.title, type: def.type };
  }

  const result = await fetchComparison(allSlugs, def.comparisonIndicatorIds);

  const municipalities = result.municipalities.map((m) => ({
    slug: m.slug,
    name: m.name,
    color: m.color,
  }));

  const indicators = result.indicators.map((ind) => ({
    id: ind.id,
    label: ind.label,
    format: ind.format,
  }));

  const rows: ReportComparisonRow[] = result.indicators.map((ind) => ({
    indicatorId: ind.id,
    indicatorLabel: ind.label,
    values: allSlugs.map((slug) => {
      const dp = result.data.find(
        (d) => d.municipalitySlug === slug && d.indicatorId === ind.id,
      );
      return {
        slug,
        value: dp?.latestValue ?? null,
        formatted: formatComparisonValue(dp?.latestValue ?? null, ind.format),
        change: dp?.change ?? null,
      };
    }),
  }));

  const comparison: ReportComparisonData = { municipalities, indicators, rows };

  return {
    id: def.id,
    title: def.title,
    type: def.type,
    comparison,
  };
}

async function buildAlertsSection(
  def: ReportSectionDef,
  municipalitySlug: string,
): Promise<ReportSectionData> {
  const result = await evaluateAlerts(municipalitySlug, DEFAULT_ALERT_RULES);

  const alerts: ReportAlertData[] = result.alerts.map((a) => ({
    severity: a.severity,
    label: a.rule.label,
    description: a.description,
    changePercent: a.changePercent,
  }));

  return {
    id: def.id,
    title: def.title,
    type: def.type,
    alerts,
  };
}

function buildCitationsSection(
  def: ReportSectionDef,
  hasPeers: boolean,
): ReportSectionData {
  const citations = [
    "regionaldashboard.alberta.ca — 54 indicators for Alberta municipalities",
    "Statistics Canada Web Data Service (WDS)",
    "Bank of Canada Valet API",
  ];
  if (hasPeers) {
    citations.push("Peer comparison data sourced from same regional indicators");
  }
  citations.push(
    `Report generated ${new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}`,
  );

  return {
    id: def.id,
    title: def.title,
    type: def.type,
    citations,
  };
}

// ---------------------------------------------------------------------------
// Main report generator
// ---------------------------------------------------------------------------

export async function generateReport(config: ReportConfig): Promise<ReportData> {
  const template = getTemplate(config.templateId);
  if (!template) {
    throw new Error(`Unknown template: ${config.templateId}`);
  }

  // Fetch community profile (used by headline + profile sections)
  const profile = await buildCommunityProfile(config.municipalitySlug);

  // Build all sections — parallel where possible
  const sectionPromises = template.sections.map(async (def): Promise<ReportSectionData> => {
    switch (def.type) {
      case "headline-metrics":
        return buildHeadlineSection(def, profile);
      case "profile-section":
        return buildProfileSection(def, profile);
      case "peer-comparison":
        return buildComparisonSection(def, config.municipalitySlug, config.peerSlugs);
      case "alerts-summary":
        return buildAlertsSection(def, config.municipalitySlug);
      case "data-citations":
        return buildCitationsSection(def, config.peerSlugs.length > 0);
      default:
        return { id: def.id, title: def.title, type: def.type };
    }
  });

  const sections = await Promise.all(sectionPromises);

  return {
    municipalityName: config.municipalityName,
    municipalitySlug: config.municipalitySlug,
    templateName: template.name,
    dateRange: config.dateRange,
    generatedAt: new Date().toISOString(),
    sections,
  };
}
