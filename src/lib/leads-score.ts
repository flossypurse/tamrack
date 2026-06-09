/**
 * Pure scoring functions for the per-geo demand-heat composite.
 *
 * This file has NO database imports and NO side effects — it takes
 * pre-fetched plain-data inputs and returns a ranked array of
 * `GeoLeadScore` objects. That makes it independently unit-testable.
 *
 * === Scoring design (v1) ===
 *
 * Four sub-scores, each min-max normalized 0–1 across the geo set for
 * the latest available period:
 *
 *   hiringMomentum   (weight 0.35) — per-city Tier-B posting count
 *                     from the latest Job Bank month, boosted by
 *                     month-over-month momentum.
 *
 *   permitExpansion  (weight 0.25) — commercial permit volume for the
 *                     most recent snapshot in municipality_permits,
 *                     boosted by growth vs the prior snapshot.
 *
 *   businessFormation (weight 0.20) — Incorporations indicator from
 *                     regional_indicators, most recent period.
 *
 *   procurementBackdrop (weight 0.20) — Alberta-level open-tender count.
 *                     *** v1 LIMITATION: this is the SAME value for
 *                     every geo (provincial backdrop). It does NOT
 *                     differentiate municipalities; it shifts all scores
 *                     uniformly. Included to reserve the dimension for a
 *                     future per-geo procurement signal. ***
 *
 * composite = round(100 x sum(weightᵢ * subᵢ)).  Ranked descending.
 *
 * === Normalization ===
 *
 * min-max across the geo set:  (v - min) / (max - min)
 * When all values are equal (or only one geo), the sub-score is 0.5 for
 * all geos (avoids division by zero and avoids misleading 1.0 rankings
 * when there is no variance in the input signal).
 */

// ---------------------------------------------------------------------------
// Tunable scoring constants
// ---------------------------------------------------------------------------

/** Fraction of composite score driven by Tier-B hiring postings + momentum. */
export const WEIGHT_HIRING_MOMENTUM = 0.35;

/** Fraction of composite score driven by commercial permit volume + growth. */
export const WEIGHT_PERMIT_EXPANSION = 0.25;

/** Fraction of composite score driven by business incorporation rate. */
export const WEIGHT_BUSINESS_FORMATION = 0.20;

/**
 * Fraction of composite score driven by provincial open-tender volume.
 * Identical across all geos in v1 — see module docstring for rationale.
 */
export const WEIGHT_PROCUREMENT_BACKDROP = 0.20;

/**
 * Month-over-month momentum multiplier applied to the Tier-B posting count
 * before normalization.  A geo with +20% MoM growth gets:
 *   adjustedCount = count x (1 + 0.20 x HIRING_MOMENTUM_BOOST)
 * Set to 1.0 so a +100% MoM swing is equivalent to doubling the count.
 */
export const HIRING_MOMENTUM_BOOST = 1.0;

/**
 * Permit growth multiplier applied to the raw permit count before
 * normalization.  Same formula as HIRING_MOMENTUM_BOOST.
 */
export const PERMIT_GROWTH_BOOST = 1.0;

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/** Hiring data for one city from the Job Bank read layer. */
export interface CityHiringInput {
  /** City name as stored in jobbank_postings.city (case-insensitive match attempted). */
  city: string;
  /** Number of Tier-B postings in the latest month. */
  tierBCount: number;
  /**
   * Month-over-month delta percentage (e.g. +20 means 20% growth).
   * null when no prior month is stored.
   */
  momDeltaPct: number | null;
}

/** Permit snapshot for one municipality from municipality_permits. */
export interface MuniPermitInput {
  /** Municipality name as stored in municipality_permits (matched to registry slug). */
  municipality: string;
  /** Total permit count in the most recent snapshot. */
  count: number;
  /** Permit count in the prior snapshot — used to compute growth. null if no prior. */
  priorCount: number | null;
}

/** Business formation data for one geo from regional_indicators. */
export interface GeoFormationInput {
  /** CSD UID from regional_indicators. */
  csduid: string;
  /** Most-recent Incorporations value. */
  incorporations: number;
}

/**
 * All fetched inputs consumed by the scorer. Built by `data-sources-leads.ts`.
 * Fields are allowed to be sparse — the scorer gracefully handles missing data
 * by leaving the corresponding sub-score at the floor value (0.5 when all geos
 * have no data, 0 when only this geo is missing).
 */
export interface LeadScoreInputs {
  /** Hiring data by city — best-effort city->slug matching done by the scorer. */
  hiringByCity: CityHiringInput[];
  /** Permit data by municipality slug. */
  permitsBySlug: Record<string, MuniPermitInput>;
  /** Business-formation data by csduid. */
  formationByCsduid: Record<string, GeoFormationInput>;
  /**
   * Count of currently-open Alberta-relevant procurement tenders.
   * Same value broadcast to all geos — provincial backdrop only.
   */
  openTenderCount: number;
  /** ISO YYYY-MM of the Job Bank data consumed (for meta). */
  hiringMonth: string | null;
  /** ISO date of the permit snapshot consumed (for meta). */
  permitSnapshotDate: string | null;
  /** ISO period string of the incorporations data consumed (for meta). */
  formationPeriod: string | null;
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface SubScores {
  /** 0-1 normalized hiring momentum sub-score. */
  hiringMomentum: number;
  /** 0-1 normalized permit expansion sub-score. */
  permitExpansion: number;
  /** 0-1 normalized business formation sub-score. */
  businessFormation: number;
  /**
   * 0-1 normalized procurement backdrop sub-score.
   * Identical for all geos in v1.
   */
  procurementBackdrop: number;
}

export interface RawSignals {
  /** Momentum-adjusted Tier-B posting count (pre-normalization). */
  hiringAdjustedCount: number;
  /** Raw Tier-B count before adjustment. */
  tierBCount: number;
  /** MoM delta pct from Job Bank; null if unavailable. */
  momDeltaPct: number | null;
  /** Raw permit count from the latest snapshot. */
  permitCount: number;
  /** Permit count from the prior snapshot; null if unavailable. */
  permitPriorCount: number | null;
  /** Momentum-adjusted permit count (pre-normalization). */
  permitAdjustedCount: number;
  /** Raw incorporations value from regional_indicators. */
  incorporations: number;
  /** Province-level open tender count. */
  openTenderCount: number;
}

export interface DataCoverage {
  /** Whether hiring data was found for this geo. */
  hasHiring: boolean;
  /** Whether permit data was found for this geo. */
  hasPermits: boolean;
  /** Whether formation data was found for this geo. */
  hasFormation: boolean;
  /** Whether procurement data is available (always true). */
  hasProcurement: boolean;
}

export interface GeoLeadScore {
  /** Municipality display name. */
  geo: string;
  /** Registry slug (e.g. "edmonton", "red-deer"). */
  slug: string;
  /** CSD UID from the municipality registry. */
  csduid: string;
  /** 1-based rank (1 = highest demand heat). */
  rank: number;
  /** Composite score 0-100. */
  score: number;
  /** Individual sub-scores (0-1 each). */
  subScores: SubScores;
  /** Raw underlying values before normalization. */
  raw: RawSignals;
  /** Which input signals were present for this geo. */
  coverage: DataCoverage;
}

/** Full scoring result including metadata for the MCP response envelope. */
export interface LeadScoreResult {
  rankings: GeoLeadScore[];
  meta: {
    /** ISO timestamp of when this result was computed. */
    computedAt: string;
    hiringMonth: string | null;
    permitSnapshotDate: string | null;
    formationPeriod: string | null;
    openTenderCount: number;
    geoCount: number;
    /** v1 known limitation: procurement sub-score is non-differentiating. */
    caveats: string[];
  };
}

// ---------------------------------------------------------------------------
// Municipality geo descriptor (caller provides from the registry)
// ---------------------------------------------------------------------------

export interface GeoDescriptor {
  slug: string;
  name: string;
  csduid: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Min-max normalize an array of values to [0, 1].
 * When all values are equal (or the array has one element), returns 0.5 for
 * all entries to avoid division-by-zero and avoid misleading 1.0 rankings
 * when there is no variance in the input signal.
 */
function minMaxNormalize(values: number[]): number[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 0.5);
  return values.map((v) => (v - min) / (max - min));
}

/** Round a number to `dp` decimal places. */
function roundTo(value: number, dp: number): number {
  const factor = 10 ** dp;
  return Math.round(value * factor) / factor;
}

// ---------------------------------------------------------------------------
// City -> slug matching
// ---------------------------------------------------------------------------

/**
 * Build a lookup table: normalized city-name -> slug.
 * Uses the municipality name from the registry (lowercased) plus a few
 * common abbreviations that appear in Job Bank data.
 */
function buildCityToSlug(geos: GeoDescriptor[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const g of geos) {
    map.set(g.name.toLowerCase(), g.slug);
    map.set(g.slug.toLowerCase().replace(/-/g, " "), g.slug);
    // Strip trailing county / municipal-district qualifier for fuzzy match
    const stripped = g.name
      .toLowerCase()
      .replace(/\s+(county|municipal district|m\.?d\.?)\s*$/i, "")
      .trim();
    if (stripped && stripped !== g.name.toLowerCase()) {
      map.set(stripped, g.slug);
    }
  }
  // Well-known aliases that appear differently in Job Bank city fields
  map.set("fort mcmurray", "wood-buffalo");
  map.set("wood buffalo", "wood-buffalo");
  map.set("sherwood park", "strathcona");
  return map;
}

// ---------------------------------------------------------------------------
// Core scorer
// ---------------------------------------------------------------------------

/**
 * Compute per-geo demand-heat composite scores from pre-fetched inputs.
 *
 * @param geos   - Canonical geo list from the municipality registry.
 * @param inputs - Pre-fetched signal data (no DB calls in here).
 * @returns      Ranked array of scores plus metadata.
 */
export function computeLeadScores(
  geos: GeoDescriptor[],
  inputs: LeadScoreInputs,
): LeadScoreResult {
  const computedAt = new Date().toISOString();
  const cityToSlug = buildCityToSlug(geos);

  // Build slug -> hiring data from the flat city array
  const hiringBySlug = new Map<string, CityHiringInput>();
  for (const h of inputs.hiringByCity) {
    const slug = cityToSlug.get(h.city.toLowerCase());
    if (slug) {
      // If multiple city rows map to the same slug, accumulate counts
      const existing = hiringBySlug.get(slug);
      if (existing) {
        existing.tierBCount += h.tierBCount;
        // Average the MoM delta when merging rows
        if (h.momDeltaPct != null) {
          existing.momDeltaPct =
            existing.momDeltaPct != null
              ? (existing.momDeltaPct + h.momDeltaPct) / 2
              : h.momDeltaPct;
        }
      } else {
        hiringBySlug.set(slug, { ...h });
      }
    }
  }

  // Compute raw signals per geo
  type GeoRaw = {
    slug: string;
    name: string;
    csduid: string;
    hiringAdjustedCount: number;
    tierBCount: number;
    momDeltaPct: number | null;
    permitAdjustedCount: number;
    permitCount: number;
    permitPriorCount: number | null;
    incorporations: number;
    hasHiring: boolean;
    hasPermits: boolean;
    hasFormation: boolean;
  };

  const rawList: GeoRaw[] = geos.map((g) => {
    // Hiring
    const hiring = hiringBySlug.get(g.slug);
    const tierBCount = hiring?.tierBCount ?? 0;
    const momDeltaPct = hiring?.momDeltaPct ?? null;
    const momMultiplier =
      momDeltaPct != null
        ? 1 + (momDeltaPct / 100) * HIRING_MOMENTUM_BOOST
        : 1;
    // Clamp multiplier to >= 0 so a -200% MoM edge case doesn't go negative
    const hiringAdjustedCount = tierBCount * Math.max(0, momMultiplier);

    // Permits
    const permit = inputs.permitsBySlug[g.slug];
    const permitCount = permit?.count ?? 0;
    const permitPriorCount = permit?.priorCount ?? null;
    const permitGrowthPct =
      permitPriorCount != null && permitPriorCount > 0
        ? ((permitCount - permitPriorCount) / permitPriorCount) * 100
        : 0;
    const permitGrowthMultiplier =
      1 + (permitGrowthPct / 100) * PERMIT_GROWTH_BOOST;
    const permitAdjustedCount = permitCount * Math.max(0, permitGrowthMultiplier);

    // Formation
    const formation = inputs.formationByCsduid[g.csduid];
    const incorporations = formation?.incorporations ?? 0;

    return {
      slug: g.slug,
      name: g.name,
      csduid: g.csduid,
      hiringAdjustedCount,
      tierBCount,
      momDeltaPct,
      permitAdjustedCount,
      permitCount,
      permitPriorCount,
      incorporations,
      hasHiring: !!hiring,
      hasPermits: !!permit,
      hasFormation: !!formation,
    };
  });

  // Normalize each dimension across all geos. A geo with no data for a signal
  // contributes 0 (raw), so it normalizes toward the floor — intended for a
  // demand-heat LEAD ranking: absence of evidence is a weak lead, not a
  // neutral one. The coverage flags below tell consumers WHICH dimensions are
  // backed by real data so a low score from a coverage gap is distinguishable
  // from a low score from observed-low demand.
  const hiringNorm = minMaxNormalize(rawList.map((r) => r.hiringAdjustedCount));
  const permitNorm = minMaxNormalize(rawList.map((r) => r.permitAdjustedCount));
  const formationNorm = minMaxNormalize(rawList.map((r) => r.incorporations));

  // Procurement: single provincial value broadcast to all geos.
  // minMaxNormalize([x, x, x, ...]) returns [0.5, 0.5, ...] — correct for v1.
  const procurementNorm: number[] = rawList.map(() => 0.5);

  // Assemble scored rows
  const scored: GeoLeadScore[] = rawList.map((r, i) => {
    const sHiring = hiringNorm[i];
    const sPermit = permitNorm[i];
    const sFormation = formationNorm[i];
    const sProcurement = procurementNorm[i];

    const composite =
      WEIGHT_HIRING_MOMENTUM * sHiring +
      WEIGHT_PERMIT_EXPANSION * sPermit +
      WEIGHT_BUSINESS_FORMATION * sFormation +
      WEIGHT_PROCUREMENT_BACKDROP * sProcurement;

    return {
      geo: r.name,
      slug: r.slug,
      csduid: r.csduid,
      rank: 0, // filled after sort
      score: Math.round(100 * composite),
      subScores: {
        hiringMomentum: roundTo(sHiring, 4),
        permitExpansion: roundTo(sPermit, 4),
        businessFormation: roundTo(sFormation, 4),
        procurementBackdrop: roundTo(sProcurement, 4),
      },
      raw: {
        hiringAdjustedCount: roundTo(r.hiringAdjustedCount, 2),
        tierBCount: r.tierBCount,
        momDeltaPct: r.momDeltaPct,
        permitCount: r.permitCount,
        permitPriorCount: r.permitPriorCount,
        permitAdjustedCount: roundTo(r.permitAdjustedCount, 2),
        incorporations: r.incorporations,
        openTenderCount: inputs.openTenderCount,
      },
      coverage: {
        hasHiring: r.hasHiring,
        hasPermits: r.hasPermits,
        hasFormation: r.hasFormation,
        hasProcurement: true,
      },
    };
  });

  // Sort descending by score, then assign 1-based rank
  scored.sort((a, b) => b.score - a.score);
  scored.forEach((row, i) => {
    row.rank = i + 1;
  });

  return {
    rankings: scored,
    meta: {
      computedAt,
      hiringMonth: inputs.hiringMonth,
      permitSnapshotDate: inputs.permitSnapshotDate,
      formationPeriod: inputs.formationPeriod,
      openTenderCount: inputs.openTenderCount,
      geoCount: geos.length,
      caveats: [
        "procurementBackdrop sub-score is identical for all geos in v1 " +
          "(provincial open-tender count, not per-geo). It shifts all scores " +
          "uniformly and is NOT a differentiating signal until a per-geo " +
          "procurement feed is added.",
        "Job Bank strips employer names; hiring signals are aggregate " +
          "sector/geo strain, not per-company leads.",
        "City-to-geo matching is name-based; Job Bank city spellings that " +
          "differ from the registry name will be missed (coverage.hasHiring = false).",
        "Permit data covers municipalities with active permit collection only. " +
          "A geo with no permit (or hiring/formation) data contributes 0 on that " +
          "dimension and ranks low there — absence of evidence reads as a weak " +
          "lead, not a neutral one. Use the per-row coverage flags to tell a " +
          "coverage gap apart from observed-low demand.",
      ],
    },
  };
}
