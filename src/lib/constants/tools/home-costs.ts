/**
 * Alberta home buying cost constants.
 * Updated: 2026.
 * Sources: Alberta Land Titles, CMHC, CRA GST rebate rules.
 */

// Land Titles registration fee: $50 base + $5 per $5,000 (or fraction)
export const LAND_TITLES = {
  baseFee: 50,
  perUnit: 5, // $5 per $5,000 chunk
  unitSize: 5_000,
};

// Mortgage registration fee: same formula
export const MORTGAGE_REGISTRATION = {
  baseFee: 50,
  perUnit: 5,
  unitSize: 5_000,
};

// CMHC insurance premiums by LTV tier (% of mortgage amount)
export const CMHC_PREMIUMS = [
  { maxLTV: 0.65, rate: 0.006 },
  { maxLTV: 0.75, rate: 0.017 },
  { maxLTV: 0.8, rate: 0.024 },
  { maxLTV: 0.85, rate: 0.028 },
  { maxLTV: 0.9, rate: 0.031 },
  { maxLTV: 0.95, rate: 0.04 },
];

// Typical cost ranges (CAD)
export const TYPICAL_COSTS = {
  lawyerFees: { min: 1_000, max: 2_000, default: 1_500 },
  homeInspection: { min: 300, max: 600, default: 450 },
  titleInsurance: { min: 200, max: 400, default: 300 },
  propertyTaxAdjustment: { min: 0, max: 3_000, default: 1_000 },
  movingCosts: { min: 500, max: 3_000, default: 1_500 },
};

// GST on new homes: 5%
export const GST_RATE = 0.05;

// Standard new housing rebate: 36% of GST, max $6,300
export const GST_NEW_HOUSING_REBATE = {
  rate: 0.36,
  maxRebate: 6_300,
  fullRebateThreshold: 350_000, // full rebate if FMV <= this
  noRebateThreshold: 450_000, // no rebate if FMV > this
};

// First-time buyer GST rebate (Royal Assent March 2026)
export const GST_FIRST_TIME_BUYER_REBATE = {
  fullRebateThreshold: 1_000_000,
  noRebateThreshold: 1_500_000,
  maxRebate: 50_000,
};

// Alberta does NOT have a land/property transfer tax
export const HAS_LAND_TRANSFER_TAX = false;
