/**
 * Cross-analysis functions — combine multiple data sources at the
 * neighbourhood level to surface signals that no single dataset reveals.
 *
 * Supports Edmonton (SODA) and Calgary (Socrata) — both use the same
 * SoQL query language with different field names.
 */

import { fetchEdmontonData, EDMONTON_DATASETS } from "./data-sources";

// ============================================================
// Calgary Socrata (same API pattern as Edmonton)
// ============================================================

const CALGARY_BASE = "https://data.calgary.ca/resource";
const CALGARY_DATASETS = {
  BUILDING_PERMITS: "c2es-76ed",
  PROPERTY_ASSESSMENTS: "4bsw-nn7w",
  BUSINESS_LICENCES: "vdjc-pybd",
  DEVELOPMENT_PERMITS: "6933-unw5",
} as const;

async function fetchCalgaryData(
  datasetId: string,
  params?: Record<string, string>
): Promise<unknown[]> {
  const url = new URL(`${CALGARY_BASE}/${datasetId}.json`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

// ============================================================
// Types
// ============================================================

export interface TransformationSignal {
  neighbourhood: string;
  city: string;
  avgAssessment: number;
  permitCount: number;
  unitsAdded: number;
  constructionValue: number;
  devPermitCount: number;
  renovationCount: number;
  score: number;
  signal: "hot" | "warming" | "stable" | "cooling";
  whyItMatters: string;
}

export interface TeardownZone {
  neighbourhood: string;
  city: string;
  devPermits: number;
  newConstructionPermits: number;
  avgAssessment: number;
  avgConstructionValue: number;
  ratio: number;
  signal: string;
}

export interface RenovationSignal {
  neighbourhood: string;
  city: string;
  renovationPermits: number;
  totalRenovationValue: number;
  avgRenovationValue: number;
  avgAssessment: number;
  assessmentPercentile: number;
  signal: "strong" | "moderate" | "caution";
  interpretation: string;
}

export interface ConvergenceSignal {
  neighbourhood: string;
  city: string;
  businessLicences: number;
  residentialPermits: number;
  devPermits: number;
  combinedScore: number;
  interpretation: string;
}

// ============================================================
// Utility
// ============================================================

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ============================================================
// 1. Transformation Zones
// ============================================================

async function analyzeEdmontonTransformations(): Promise<TransformationSignal[]> {
  const [permits, assessments, devPermits, renovations] = await Promise.all([
    fetchEdmontonData(EDMONTON_DATASETS.BUILDING_PERMITS, {
      $query: `SELECT neighbourhood, count(*) as cnt, sum(units_added) as total_units, sum(construction_value) as total_val WHERE issue_date > '2024-06-01' AND neighbourhood IS NOT NULL GROUP BY neighbourhood`,
    }).catch(() => []),
    fetchEdmontonData(EDMONTON_DATASETS.PROPERTY_ASSESSMENTS, {
      $query: `SELECT neighbourhood, count(*) as cnt, avg(assessed_value::number) as avg_val WHERE tax_class='Residential' AND neighbourhood IS NOT NULL GROUP BY neighbourhood HAVING count(*) > 20`,
    }).catch(() => []),
    fetchEdmontonData(EDMONTON_DATASETS.DEVELOPMENT_PERMITS, {
      $query: `SELECT neighbourhood, count(*) as cnt WHERE permit_date > '2024-06-01' AND neighbourhood IS NOT NULL GROUP BY neighbourhood`,
    }).catch(() => []),
    fetchEdmontonData(EDMONTON_DATASETS.BUILDING_PERMITS, {
      $query: `SELECT neighbourhood, count(*) as cnt WHERE issue_date > '2024-06-01' AND job_category='Home Improvement' AND neighbourhood IS NOT NULL GROUP BY neighbourhood`,
    }).catch(() => []),
  ]);

  return buildTransformationSignals("Edmonton", permits, assessments, devPermits, renovations, "neighbourhood");
}

async function analyzeCalgaryTransformations(): Promise<TransformationSignal[]> {
  const [permits, assessments, devPermits] = await Promise.all([
    fetchCalgaryData(CALGARY_DATASETS.BUILDING_PERMITS, {
      $query: `SELECT communityname, count(*) as cnt, sum(estprojectcost) as total_val WHERE issueddate > '2024-06-01' AND communityname IS NOT NULL GROUP BY communityname`,
    }).catch(() => []),
    fetchCalgaryData(CALGARY_DATASETS.PROPERTY_ASSESSMENTS, {
      $query: `SELECT comm_name, count(*) as cnt, avg(assessed_value) as avg_val WHERE assessment_class = 'Residential' AND comm_name IS NOT NULL GROUP BY comm_name HAVING count(*) > 20`,
    }).catch(() => []),
    fetchCalgaryData(CALGARY_DATASETS.DEVELOPMENT_PERMITS, {
      $query: `SELECT communityname, count(*) as cnt WHERE applieddate > '2024-06-01' AND communityname IS NOT NULL GROUP BY communityname`,
    }).catch(() => []),
  ]);

  // Calgary doesn't have a separate "Home Improvement" category easily queryable,
  // so we pass empty renovations
  return buildTransformationSignals("Calgary", permits, assessments, devPermits, [], "communityname", "comm_name");
}

function buildTransformationSignals(
  city: string,
  permits: unknown[],
  assessments: unknown[],
  devPermits: unknown[],
  renovations: unknown[],
  permitHoodField: string,
  assessHoodField?: string
): TransformationSignal[] {
  const aField = assessHoodField || permitHoodField;

  const permitMap = new Map<string, { count: number; units: number; value: number }>();
  for (const row of permits as Record<string, string>[]) {
    const hood = (row[permitHoodField] || "").toUpperCase();
    if (!hood) continue;
    permitMap.set(hood, {
      count: parseInt(row.cnt || "0"),
      units: parseInt(row.total_units || "0"),
      value: parseInt(row.total_val || "0"),
    });
  }

  const assessMap = new Map<string, { count: number; avg: number }>();
  for (const row of assessments as Record<string, string>[]) {
    const hood = (row[aField] || "").toUpperCase();
    if (!hood) continue;
    assessMap.set(hood, {
      count: parseInt(row.cnt || "0"),
      avg: parseFloat(row.avg_val || "0"),
    });
  }

  const devMap = new Map<string, number>();
  for (const row of devPermits as Record<string, string>[]) {
    const hood = (row[permitHoodField] || "").toUpperCase();
    if (!hood) continue;
    devMap.set(hood, parseInt(row.cnt || "0"));
  }

  const renoMap = new Map<string, number>();
  for (const row of renovations as Record<string, string>[]) {
    const hood = (row[permitHoodField] || "").toUpperCase();
    if (!hood) continue;
    renoMap.set(hood, parseInt(row.cnt || "0"));
  }

  const allHoods = new Set(assessMap.keys());
  const results: TransformationSignal[] = [];

  const allAvgAssessments = Array.from(assessMap.values()).map((a) => a.avg);
  const medianAssessment = median(allAvgAssessments);
  const allPermitCounts = Array.from(permitMap.values()).map((p) => p.count);
  const medianPermits = median(allPermitCounts) || 1;

  for (const hood of allHoods) {
    const assess = assessMap.get(hood)!;
    const permit = permitMap.get(hood) || { count: 0, units: 0, value: 0 };
    const devCount = devMap.get(hood) || 0;
    const renoCount = renoMap.get(hood) || 0;

    if (assess.count < 30) continue;

    const activityScore =
      (permit.count / Math.max(medianPermits, 1)) * 0.4 +
      (devCount / Math.max(medianPermits, 1)) * 0.3 +
      (renoCount / Math.max(medianPermits, 1)) * 0.3;

    const assessRatio = assess.avg / medianAssessment;
    const assessFactor =
      assessRatio > 0.5 && assessRatio < 1.5
        ? 1.2
        : assessRatio <= 0.5
          ? 0.8
          : 0.6;

    const score = activityScore * assessFactor;

    // Display-friendly name (title case the uppercased hood)
    const displayHood = hood
      .split(" ")
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(" ");

    let signal: TransformationSignal["signal"];
    let whyItMatters: string;

    if (activityScore > 2 && assessRatio < 1.3) {
      signal = "hot";
      whyItMatters = `High construction & development activity (${permit.count} permits, ${devCount} dev permits) but assessments still moderate ($${Math.round(assess.avg).toLocaleString()}). Values likely haven't caught up yet — early mover territory.`;
    } else if (activityScore > 1 && renoCount > medianPermits) {
      signal = "warming";
      whyItMatters = `Renovation activity is high (${renoCount} permits) alongside new development. Existing homeowners are investing — a confidence signal that the neighbourhood is improving.`;
    } else if (activityScore > 1) {
      signal = "warming";
      whyItMatters = `Above-average permit activity (${permit.count} building, ${devCount} development permits). Community is seeing investment — watch for assessment growth.`;
    } else if (activityScore < 0.3 && assessRatio > 1.3) {
      signal = "cooling";
      whyItMatters = `High assessments ($${Math.round(assess.avg).toLocaleString()}) but low new activity. Mature/stable area — or possibly overvalued with declining interest.`;
    } else {
      signal = "stable";
      whyItMatters = `Activity and assessments are balanced. No strong signal in either direction.`;
    }

    results.push({
      neighbourhood: displayHood,
      city,
      avgAssessment: Math.round(assess.avg),
      permitCount: permit.count,
      unitsAdded: permit.units,
      constructionValue: permit.value,
      devPermitCount: devCount,
      renovationCount: renoCount,
      score: Math.round(score * 100) / 100,
      signal,
      whyItMatters,
    });
  }

  return results.sort((a, b) => b.score - a.score);
}

export async function analyzeTransformationZones(): Promise<TransformationSignal[]> {
  const [edmonton, calgary] = await Promise.all([
    analyzeEdmontonTransformations(),
    analyzeCalgaryTransformations(),
  ]);

  return [...edmonton, ...calgary].sort((a, b) => b.score - a.score);
}

// ============================================================
// 2. Teardown Zones
// ============================================================

async function analyzeEdmontonTeardowns(): Promise<TeardownZone[]> {
  const [redevPermits, newConstruction, assessments] = await Promise.all([
    fetchEdmontonData(EDMONTON_DATASETS.DEVELOPMENT_PERMITS, {
      $query: `SELECT neighbourhood, count(*) as cnt WHERE permit_date > '2024-01-01' AND neighbourhood_classification = 'Redeveloping' GROUP BY neighbourhood ORDER BY cnt DESC LIMIT 30`,
    }).catch(() => []),
    fetchEdmontonData(EDMONTON_DATASETS.BUILDING_PERMITS, {
      $query: `SELECT neighbourhood, count(*) as cnt, avg(construction_value) as avg_val WHERE issue_date > '2024-01-01' AND (job_category='Single, Semi-detached & Rowhousing' OR job_category='House Combination') AND neighbourhood IS NOT NULL GROUP BY neighbourhood`,
    }).catch(() => []),
    fetchEdmontonData(EDMONTON_DATASETS.PROPERTY_ASSESSMENTS, {
      $query: `SELECT neighbourhood, avg(assessed_value::number) as avg_val WHERE tax_class='Residential' AND neighbourhood IS NOT NULL GROUP BY neighbourhood HAVING count(*) > 20`,
    }).catch(() => []),
  ]);

  return buildTeardownZones("Edmonton", redevPermits, newConstruction, assessments, "neighbourhood");
}

async function analyzeCalgaryTeardowns(): Promise<TeardownZone[]> {
  const [devPermits, permits, assessments] = await Promise.all([
    fetchCalgaryData(CALGARY_DATASETS.DEVELOPMENT_PERMITS, {
      $query: `SELECT communityname, count(*) as cnt WHERE applieddate > '2024-01-01' AND communityname IS NOT NULL GROUP BY communityname ORDER BY cnt DESC LIMIT 30`,
    }).catch(() => []),
    fetchCalgaryData(CALGARY_DATASETS.BUILDING_PERMITS, {
      $query: `SELECT communityname, count(*) as cnt, avg(estprojectcost) as avg_val WHERE issueddate > '2024-01-01' AND workclassgroup = 'Housing - New' AND communityname IS NOT NULL GROUP BY communityname`,
    }).catch(() => []),
    fetchCalgaryData(CALGARY_DATASETS.PROPERTY_ASSESSMENTS, {
      $query: `SELECT comm_name, avg(assessed_value) as avg_val WHERE assessment_class = 'Residential' AND comm_name IS NOT NULL GROUP BY comm_name HAVING count(*) > 20`,
    }).catch(() => []),
  ]);

  return buildTeardownZones("Calgary", devPermits, permits, assessments, "communityname", "comm_name");
}

function buildTeardownZones(
  city: string,
  devPermitData: unknown[],
  constructionData: unknown[],
  assessmentData: unknown[],
  hoodField: string,
  assessHoodField?: string
): TeardownZone[] {
  const aField = assessHoodField || hoodField;

  const constructionMap = new Map<string, { count: number; avgValue: number }>();
  for (const row of constructionData as Record<string, string>[]) {
    const hood = (row[hoodField] || "").toUpperCase();
    if (!hood) continue;
    constructionMap.set(hood, {
      count: parseInt(row.cnt || "0"),
      avgValue: parseFloat(row.avg_val || "0"),
    });
  }

  const assessMap = new Map<string, number>();
  for (const row of assessmentData as Record<string, string>[]) {
    const hood = (row[aField] || "").toUpperCase();
    if (!hood) continue;
    assessMap.set(hood, parseFloat(row.avg_val || "0"));
  }

  const results: TeardownZone[] = [];
  for (const row of devPermitData as Record<string, string>[]) {
    const hood = (row[hoodField] || "").toUpperCase();
    const devCount = parseInt(row.cnt || "0");
    if (!hood || devCount < 3) continue;

    const construction = constructionMap.get(hood) || { count: 0, avgValue: 0 };
    const avgAssessment = assessMap.get(hood) || 0;
    const ratio = avgAssessment > 0 ? construction.avgValue / avgAssessment : 0;

    const displayHood = hood
      .split(" ")
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(" ");

    let signal: string;
    if (ratio > 1.5 && devCount > 10) {
      signal = "Active teardown zone — new construction value far exceeds existing assessments. Sellers sitting on undervalued land.";
    } else if (ratio > 1) {
      signal = "Emerging teardown activity — new builds are worth more than existing homes. Transition underway.";
    } else if (devCount > 15) {
      signal = "High dev permit activity — watch for construction permits to follow.";
    } else {
      signal = "Early-stage redevelopment — scattered activity, not yet a clear pattern.";
    }

    results.push({
      neighbourhood: displayHood,
      city,
      devPermits: devCount,
      newConstructionPermits: construction.count,
      avgAssessment: Math.round(avgAssessment),
      avgConstructionValue: Math.round(construction.avgValue),
      ratio: Math.round(ratio * 100) / 100,
      signal,
    });
  }

  return results.sort((a, b) => b.devPermits - a.devPermits);
}

export async function analyzeTeardownZones(): Promise<TeardownZone[]> {
  const [edmonton, calgary] = await Promise.all([
    analyzeEdmontonTeardowns(),
    analyzeCalgaryTeardowns(),
  ]);

  return [...edmonton, ...calgary].sort((a, b) => b.devPermits - a.devPermits);
}

// ============================================================
// 3. Renovation ROI
// ============================================================

async function analyzeEdmontonRenovationROI(): Promise<RenovationSignal[]> {
  const [renovations, assessments] = await Promise.all([
    fetchEdmontonData(EDMONTON_DATASETS.BUILDING_PERMITS, {
      $query: `SELECT neighbourhood, count(*) as cnt, sum(construction_value) as total_val, avg(construction_value) as avg_val WHERE issue_date > '2024-06-01' AND job_category='Home Improvement' AND neighbourhood IS NOT NULL GROUP BY neighbourhood HAVING count(*) >= 5 ORDER BY cnt DESC LIMIT 50`,
    }).catch(() => []),
    fetchEdmontonData(EDMONTON_DATASETS.PROPERTY_ASSESSMENTS, {
      $query: `SELECT neighbourhood, avg(assessed_value::number) as avg_val WHERE tax_class='Residential' AND neighbourhood IS NOT NULL GROUP BY neighbourhood HAVING count(*) > 30`,
    }).catch(() => []),
  ]);

  return buildRenovationSignals("Edmonton", renovations, assessments, "neighbourhood");
}

async function analyzeCalgaryRenovationROI(): Promise<RenovationSignal[]> {
  const [renovations, assessments] = await Promise.all([
    fetchCalgaryData(CALGARY_DATASETS.BUILDING_PERMITS, {
      $query: `SELECT communityname, count(*) as cnt, sum(estprojectcost) as total_val, avg(estprojectcost) as avg_val WHERE issueddate > '2024-06-01' AND workclassgroup = 'Improvement' AND communityname IS NOT NULL GROUP BY communityname HAVING count(*) >= 5 ORDER BY cnt DESC LIMIT 50`,
    }).catch(() => []),
    fetchCalgaryData(CALGARY_DATASETS.PROPERTY_ASSESSMENTS, {
      $query: `SELECT comm_name, avg(assessed_value) as avg_val WHERE assessment_class = 'Residential' AND comm_name IS NOT NULL GROUP BY comm_name HAVING count(*) > 30`,
    }).catch(() => []),
  ]);

  return buildRenovationSignals("Calgary", renovations, assessments, "communityname", "comm_name");
}

function buildRenovationSignals(
  city: string,
  renoData: unknown[],
  assessData: unknown[],
  hoodField: string,
  assessHoodField?: string
): RenovationSignal[] {
  const aField = assessHoodField || hoodField;

  const assessMap = new Map<string, number>();
  const allAssessments: number[] = [];
  for (const row of assessData as Record<string, string>[]) {
    const hood = (row[aField] || "").toUpperCase();
    if (!hood) continue;
    const val = parseFloat(row.avg_val || "0");
    assessMap.set(hood, val);
    allAssessments.push(val);
  }
  allAssessments.sort((a, b) => a - b);

  const results: RenovationSignal[] = [];
  for (const row of renoData as Record<string, string>[]) {
    const hood = (row[hoodField] || "").toUpperCase();
    if (!hood) continue;
    const permits = parseInt(row.cnt || "0");
    const totalValue = parseInt(row.total_val || "0");
    const avgRenoValue = parseFloat(row.avg_val || "0");
    const avgAssessment = assessMap.get(hood) || 0;

    if (avgAssessment === 0) continue;

    const percentile = Math.round(
      (allAssessments.filter((a) => a <= avgAssessment).length / allAssessments.length) * 100
    );

    const renoRatio = avgRenoValue / avgAssessment;

    const displayHood = hood
      .split(" ")
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(" ");

    let signal: RenovationSignal["signal"];
    let interpretation: string;

    if (renoRatio > 0.1 && percentile >= 30 && percentile <= 70) {
      signal = "strong";
      interpretation = `Homeowners investing ${(renoRatio * 100).toFixed(0)}% of home value in renovations, in a mid-range neighbourhood (${percentile}th percentile). Strong confidence signal — people are betting on this area improving.`;
    } else if (permits > 15 && percentile < 40) {
      signal = "strong";
      interpretation = `High renovation count (${permits}) in an affordable area (${percentile}th percentile, avg $${Math.round(avgAssessment).toLocaleString()}). Active homeowner investment in a value neighbourhood — potential for assessment growth.`;
    } else if (renoRatio > 0.05 && percentile > 70) {
      signal = "moderate";
      interpretation = `Renovation activity in an already-expensive area (${percentile}th percentile). Homeowners are maintaining/upgrading — less upside potential but stable demand.`;
    } else if (renoRatio < 0.03 && permits > 10) {
      signal = "caution";
      interpretation = `Many small renovations (avg $${Math.round(avgRenoValue).toLocaleString()}) — could be maintenance rather than value-add improvements. Watch for whether assessments follow.`;
    } else {
      signal = "moderate";
      interpretation = `${permits} renovation permits, average investment $${Math.round(avgRenoValue).toLocaleString()} against $${Math.round(avgAssessment).toLocaleString()} assessments. Moderate homeowner confidence.`;
    }

    results.push({
      neighbourhood: displayHood,
      city,
      renovationPermits: permits,
      totalRenovationValue: totalValue,
      avgRenovationValue: Math.round(avgRenoValue),
      avgAssessment: Math.round(avgAssessment),
      assessmentPercentile: percentile,
      signal,
      interpretation,
    });
  }

  return results.sort((a, b) => {
    const signalOrder = { strong: 0, moderate: 1, caution: 2 };
    if (signalOrder[a.signal] !== signalOrder[b.signal]) {
      return signalOrder[a.signal] - signalOrder[b.signal];
    }
    return b.renovationPermits - a.renovationPermits;
  });
}

export async function analyzeRenovationROI(): Promise<RenovationSignal[]> {
  const [edmonton, calgary] = await Promise.all([
    analyzeEdmontonRenovationROI(),
    analyzeCalgaryRenovationROI(),
  ]);

  return [...edmonton, ...calgary].sort((a, b) => {
    const signalOrder = { strong: 0, moderate: 1, caution: 2 };
    if (signalOrder[a.signal] !== signalOrder[b.signal]) {
      return signalOrder[a.signal] - signalOrder[b.signal];
    }
    return b.renovationPermits - a.renovationPermits;
  });
}

// ============================================================
// 4. Business + Residential Convergence
// ============================================================

async function analyzeEdmontonConvergence(): Promise<ConvergenceSignal[]> {
  const [licences, permits, devPermits] = await Promise.all([
    fetchEdmontonData(EDMONTON_DATASETS.BUSINESS_LICENCES, {
      $query: `SELECT neighbourhood, count(*) as cnt WHERE most_recent_issue_date > '2024-06-01' AND neighbourhood IS NOT NULL GROUP BY neighbourhood HAVING count(*) >= 3 ORDER BY cnt DESC LIMIT 100`,
    }).catch(() => []),
    fetchEdmontonData(EDMONTON_DATASETS.BUILDING_PERMITS, {
      $query: `SELECT neighbourhood, count(*) as cnt WHERE issue_date > '2024-06-01' AND (job_category='Single, Semi-detached & Rowhousing' OR job_category='House Combination') AND neighbourhood IS NOT NULL GROUP BY neighbourhood`,
    }).catch(() => []),
    fetchEdmontonData(EDMONTON_DATASETS.DEVELOPMENT_PERMITS, {
      $query: `SELECT neighbourhood, count(*) as cnt WHERE permit_date > '2024-06-01' AND neighbourhood IS NOT NULL GROUP BY neighbourhood`,
    }).catch(() => []),
  ]);

  return buildConvergenceSignals("Edmonton", licences, permits, devPermits, "neighbourhood");
}

async function analyzeCalgaryConvergence(): Promise<ConvergenceSignal[]> {
  const [licences, permits, devPermits] = await Promise.all([
    fetchCalgaryData(CALGARY_DATASETS.BUSINESS_LICENCES, {
      $query: `SELECT communityname, count(*) as cnt WHERE communityname IS NOT NULL GROUP BY communityname HAVING count(*) >= 3 ORDER BY cnt DESC LIMIT 100`,
    }).catch(() => []),
    fetchCalgaryData(CALGARY_DATASETS.BUILDING_PERMITS, {
      $query: `SELECT communityname, count(*) as cnt WHERE issueddate > '2024-06-01' AND workclassgroup = 'Housing - New' AND communityname IS NOT NULL GROUP BY communityname`,
    }).catch(() => []),
    fetchCalgaryData(CALGARY_DATASETS.DEVELOPMENT_PERMITS, {
      $query: `SELECT communityname, count(*) as cnt WHERE applieddate > '2024-06-01' AND communityname IS NOT NULL GROUP BY communityname`,
    }).catch(() => []),
  ]);

  return buildConvergenceSignals("Calgary", licences, permits, devPermits, "communityname");
}

function buildConvergenceSignals(
  city: string,
  licenceData: unknown[],
  permitData: unknown[],
  devPermitData: unknown[],
  hoodField: string
): ConvergenceSignal[] {
  const licenceMap = new Map<string, number>();
  for (const row of licenceData as Record<string, string>[]) {
    const hood = (row[hoodField] || "").toUpperCase();
    if (!hood) continue;
    licenceMap.set(hood, parseInt(row.cnt || "0"));
  }

  const permitMap = new Map<string, number>();
  for (const row of permitData as Record<string, string>[]) {
    const hood = (row[hoodField] || "").toUpperCase();
    if (!hood) continue;
    permitMap.set(hood, parseInt(row.cnt || "0"));
  }

  const devMap = new Map<string, number>();
  for (const row of devPermitData as Record<string, string>[]) {
    const hood = (row[hoodField] || "").toUpperCase();
    if (!hood) continue;
    devMap.set(hood, parseInt(row.cnt || "0"));
  }

  const allHoods = new Set([...licenceMap.keys(), ...permitMap.keys()]);
  const results: ConvergenceSignal[] = [];

  for (const hood of allHoods) {
    const biz = licenceMap.get(hood) || 0;
    const res = permitMap.get(hood) || 0;
    const dev = devMap.get(hood) || 0;

    const categories = [biz > 0, res > 0, dev > 0].filter(Boolean).length;
    if (categories < 2) continue;

    const score = biz * 1.5 + res * 2 + dev;

    const displayHood = hood
      .split(" ")
      .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
      .join(" ");

    let interpretation: string;
    if (biz > 5 && res > 3) {
      interpretation = `Strong convergence: ${biz} new businesses AND ${res} residential permits. This neighbourhood is building both homes and services — the hallmark of a self-sustaining growth area.`;
    } else if (biz > 10 && res === 0) {
      interpretation = `Commercial hub: ${biz} new businesses but no residential construction. May attract residents from nearby areas — watch for future residential permits.`;
    } else if (res > 5 && biz <= 2) {
      interpretation = `Residential boom: ${res} permits but limited business activity. Services will likely follow the population. Early-stage community formation.`;
    } else {
      interpretation = `Mixed activity: ${biz} businesses, ${res} residential permits, ${dev} dev permits. Multi-dimensional growth signal.`;
    }

    results.push({
      neighbourhood: displayHood,
      city,
      businessLicences: biz,
      residentialPermits: res,
      devPermits: dev,
      combinedScore: Math.round(score * 10) / 10,
      interpretation,
    });
  }

  return results
    .sort((a, b) => b.combinedScore - a.combinedScore)
    .slice(0, 30);
}

export async function analyzeBusinessResidentialConvergence(): Promise<ConvergenceSignal[]> {
  const [edmonton, calgary] = await Promise.all([
    analyzeEdmontonConvergence(),
    analyzeCalgaryConvergence(),
  ]);

  return [...edmonton, ...calgary]
    .sort((a, b) => b.combinedScore - a.combinedScore)
    .slice(0, 40);
}
