/**
 * Cross-analysis functions — combine multiple data sources at the
 * neighbourhood level to surface signals that no single dataset reveals.
 *
 * These work in two modes:
 * 1. Live API cross-analysis (no DB needed) — combines current API data
 * 2. Historical analysis (DB needed) — detects changes over time
 */

import { fetchEdmontonData, EDMONTON_DATASETS } from "./data-sources";

// ============================================================
// LIVE CROSS-ANALYSIS (no database required)
// ============================================================

/**
 * Assessment Gap Analysis
 * Find neighbourhoods where assessments are moderate but construction
 * activity is HIGH — these are transformation zones where values
 * haven't caught up to the activity yet. Early mover advantage.
 *
 * The inverse (high assessments, low permits) = stable/mature areas.
 */
export interface TransformationSignal {
  neighbourhood: string;
  avgAssessment: number;
  permitCount: number;
  unitsAdded: number;
  constructionValue: number;
  devPermitCount: number;
  renovationCount: number;
  score: number; // composite signal score
  signal: "hot" | "warming" | "stable" | "cooling";
  whyItMatters: string;
}

export async function analyzeTransformationZones(): Promise<TransformationSignal[]> {
  // Fetch three datasets in parallel and cross-reference by neighbourhood
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

  // Build lookup maps
  const permitMap = new Map<string, { count: number; units: number; value: number }>();
  for (const row of permits as { neighbourhood: string; cnt: string; total_units: string; total_val: string }[]) {
    permitMap.set(row.neighbourhood, {
      count: parseInt(row.cnt || "0"),
      units: parseInt(row.total_units || "0"),
      value: parseInt(row.total_val || "0"),
    });
  }

  const assessMap = new Map<string, { count: number; avg: number }>();
  for (const row of assessments as { neighbourhood: string; cnt: string; avg_val: string }[]) {
    assessMap.set(row.neighbourhood, {
      count: parseInt(row.cnt || "0"),
      avg: parseFloat(row.avg_val || "0"),
    });
  }

  const devMap = new Map<string, number>();
  for (const row of devPermits as { neighbourhood: string; cnt: string }[]) {
    devMap.set(row.neighbourhood, parseInt(row.cnt || "0"));
  }

  const renoMap = new Map<string, number>();
  for (const row of renovations as { neighbourhood: string; cnt: string }[]) {
    renoMap.set(row.neighbourhood, parseInt(row.cnt || "0"));
  }

  // Cross-reference: only neighbourhoods that appear in assessments
  const allHoods = new Set(assessMap.keys());
  const results: TransformationSignal[] = [];

  // Calculate medians for scoring
  const allAvgAssessments = Array.from(assessMap.values()).map((a) => a.avg);
  const medianAssessment = median(allAvgAssessments);
  const allPermitCounts = Array.from(permitMap.values()).map((p) => p.count);
  const medianPermits = median(allPermitCounts) || 1;

  for (const hood of allHoods) {
    const assess = assessMap.get(hood)!;
    const permit = permitMap.get(hood) || { count: 0, units: 0, value: 0 };
    const devCount = devMap.get(hood) || 0;
    const renoCount = renoMap.get(hood) || 0;

    // Skip very small neighbourhoods
    if (assess.count < 30) continue;

    // Score: activity relative to assessment level
    // High activity + moderate assessments = high score
    // Activity is normalized by median to get relative measure
    const activityScore =
      (permit.count / Math.max(medianPermits, 1)) * 0.4 +
      (devCount / Math.max(medianPermits, 1)) * 0.3 +
      (renoCount / Math.max(medianPermits, 1)) * 0.3;

    // Assessment factor: moderate assessments score higher (more room to grow)
    // Very cheap or very expensive both score lower
    const assessRatio = assess.avg / medianAssessment;
    const assessFactor =
      assessRatio > 0.5 && assessRatio < 1.5
        ? 1.2 // sweet spot — near median
        : assessRatio <= 0.5
          ? 0.8 // very cheap — may have issues
          : 0.6; // expensive — less upside

    const score = activityScore * assessFactor;

    let signal: TransformationSignal["signal"];
    let whyItMatters: string;

    if (activityScore > 2 && assessRatio < 1.3) {
      signal = "hot";
      whyItMatters = `High construction & development activity (${permit.count} permits, ${devCount} dev permits) but assessments still moderate ($${Math.round(assess.avg).toLocaleString()}). Values likely haven't caught up yet — early mover territory.`;
    } else if (activityScore > 1 && renoCount > medianPermits) {
      signal = "warming";
      whyItMatters = `Renovation activity is high (${renoCount} permits) alongside new development. Existing homeowners are investing — a confidence signal that the neighbourhood is improving.`;
    } else if (activityScore < 0.3 && assessRatio > 1.3) {
      signal = "cooling";
      whyItMatters = `High assessments ($${Math.round(assess.avg).toLocaleString()}) but low new activity. Mature/stable area — or possibly overvalued with declining interest.`;
    } else {
      signal = "stable";
      whyItMatters = `Activity and assessments are balanced. No strong signal in either direction.`;
    }

    results.push({
      neighbourhood: hood,
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

/**
 * Teardown Detector
 * Find properties/neighbourhoods where redevelopment is happening —
 * older homes being replaced with new construction.
 * Signal: high dev permits with "Redeveloping" classification + new construction permits.
 */
export interface TeardownZone {
  neighbourhood: string;
  devPermits: number;
  newConstructionPermits: number;
  avgAssessment: number;
  avgConstructionValue: number;
  ratio: number; // construction value vs assessment — high = big investment relative to current value
  signal: string;
}

export async function analyzeTeardownZones(): Promise<TeardownZone[]> {
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

  const constructionMap = new Map<string, { count: number; avgValue: number }>();
  for (const row of newConstruction as { neighbourhood: string; cnt: string; avg_val: string }[]) {
    constructionMap.set(row.neighbourhood, {
      count: parseInt(row.cnt || "0"),
      avgValue: parseFloat(row.avg_val || "0"),
    });
  }

  const assessMap = new Map<string, number>();
  for (const row of assessments as { neighbourhood: string; avg_val: string }[]) {
    assessMap.set(row.neighbourhood, parseFloat(row.avg_val || "0"));
  }

  const results: TeardownZone[] = [];
  for (const row of redevPermits as { neighbourhood: string; cnt: string }[]) {
    const hood = row.neighbourhood;
    const devCount = parseInt(row.cnt || "0");
    const construction = constructionMap.get(hood) || { count: 0, avgValue: 0 };
    const avgAssessment = assessMap.get(hood) || 0;

    if (devCount < 3) continue;

    const ratio = avgAssessment > 0 ? construction.avgValue / avgAssessment : 0;

    let signal: string;
    if (ratio > 1.5 && devCount > 10) {
      signal = "Active teardown zone — new construction value far exceeds existing assessments. Sellers sitting on undervalued land.";
    } else if (ratio > 1) {
      signal = "Emerging teardown activity — new builds are worth more than existing homes. Transition underway.";
    } else if (devCount > 15) {
      signal = "High dev permit activity in redeveloping area — watch for construction permits to follow.";
    } else {
      signal = "Early-stage redevelopment — scattered activity, not yet a clear pattern.";
    }

    results.push({
      neighbourhood: hood,
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

/**
 * Renovation ROI Signal
 * Neighbourhoods where renovation activity is high AND assessments
 * are rising suggest that homeowner investment is paying off.
 * Neighbourhoods with high renovation but flat/falling assessments = caution.
 */
export interface RenovationSignal {
  neighbourhood: string;
  renovationPermits: number;
  totalRenovationValue: number;
  avgRenovationValue: number;
  avgAssessment: number;
  assessmentPercentile: number; // where this hood sits relative to city
  signal: "strong" | "moderate" | "caution";
  interpretation: string;
}

export async function analyzeRenovationROI(): Promise<RenovationSignal[]> {
  const [renovations, assessments] = await Promise.all([
    fetchEdmontonData(EDMONTON_DATASETS.BUILDING_PERMITS, {
      $query: `SELECT neighbourhood, count(*) as cnt, sum(construction_value) as total_val, avg(construction_value) as avg_val WHERE issue_date > '2024-06-01' AND job_category='Home Improvement' AND neighbourhood IS NOT NULL GROUP BY neighbourhood HAVING count(*) >= 5 ORDER BY cnt DESC LIMIT 50`,
    }).catch(() => []),
    fetchEdmontonData(EDMONTON_DATASETS.PROPERTY_ASSESSMENTS, {
      $query: `SELECT neighbourhood, avg(assessed_value::number) as avg_val WHERE tax_class='Residential' AND neighbourhood IS NOT NULL GROUP BY neighbourhood HAVING count(*) > 30`,
    }).catch(() => []),
  ]);

  const assessMap = new Map<string, number>();
  const allAssessments: number[] = [];
  for (const row of assessments as { neighbourhood: string; avg_val: string }[]) {
    const val = parseFloat(row.avg_val || "0");
    assessMap.set(row.neighbourhood, val);
    allAssessments.push(val);
  }
  allAssessments.sort((a, b) => a - b);

  const results: RenovationSignal[] = [];
  for (const row of renovations as { neighbourhood: string; cnt: string; total_val: string; avg_val: string }[]) {
    const hood = row.neighbourhood;
    const permits = parseInt(row.cnt || "0");
    const totalValue = parseInt(row.total_val || "0");
    const avgRenoValue = parseFloat(row.avg_val || "0");
    const avgAssessment = assessMap.get(hood) || 0;

    if (avgAssessment === 0) continue;

    // What percentile is this neighbourhood's assessment?
    const percentile = Math.round(
      (allAssessments.filter((a) => a <= avgAssessment).length / allAssessments.length) * 100
    );

    // Renovation-to-assessment ratio — how much are people investing relative to home value?
    const renoRatio = avgRenoValue / avgAssessment;

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
      neighbourhood: hood,
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

/**
 * Business + Residential Convergence
 * Neighbourhoods where BOTH new business licences AND residential permits
 * are active — signals an emerging complete community. These tend to
 * appreciate faster because they become self-sustaining.
 */
export interface ConvergenceSignal {
  neighbourhood: string;
  businessLicences: number;
  residentialPermits: number;
  devPermits: number;
  combinedScore: number;
  interpretation: string;
}

export async function analyzeBusinessResidentialConvergence(): Promise<ConvergenceSignal[]> {
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

  const licenceMap = new Map<string, number>();
  for (const row of licences as { neighbourhood: string; cnt: string }[]) {
    licenceMap.set(row.neighbourhood, parseInt(row.cnt || "0"));
  }

  const permitMap = new Map<string, number>();
  for (const row of permits as { neighbourhood: string; cnt: string }[]) {
    permitMap.set(row.neighbourhood, parseInt(row.cnt || "0"));
  }

  const devMap = new Map<string, number>();
  for (const row of devPermits as { neighbourhood: string; cnt: string }[]) {
    devMap.set(row.neighbourhood, parseInt(row.cnt || "0"));
  }

  const allHoods = new Set([...licenceMap.keys(), ...permitMap.keys()]);
  const results: ConvergenceSignal[] = [];

  for (const hood of allHoods) {
    const biz = licenceMap.get(hood) || 0;
    const res = permitMap.get(hood) || 0;
    const dev = devMap.get(hood) || 0;

    // Need activity in at least 2 categories
    const categories = [biz > 0, res > 0, dev > 0].filter(Boolean).length;
    if (categories < 2) continue;

    const score = biz * 1.5 + res * 2 + dev;

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
      neighbourhood: hood,
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

// ============================================================
// Utility
// ============================================================

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
