/**
 * Canadian federal and Alberta provincial tax rates.
 * Updated: 2026 tax year.
 * Source: CRA (canada.ca/en/revenue-agency)
 */

// --- Federal 2026 ---
export const FEDERAL_BRACKETS_2026 = [
  { min: 0, max: 58_523, rate: 0.14 },
  { min: 58_523, max: 117_045, rate: 0.205 },
  { min: 117_045, max: 181_440, rate: 0.26 },
  { min: 181_440, max: 258_482, rate: 0.29 },
  { min: 258_482, max: Infinity, rate: 0.33 },
];

export const FEDERAL_BPA_2026 = {
  base: 14_829, // for high income (>= $258,482)
  max: 16_452, // for income <= $181,440
  clawbackStart: 181_440,
  clawbackEnd: 258_482,
};

// --- Alberta 2026 ---
export const ALBERTA_BRACKETS_2026 = [
  { min: 0, max: 61_200, rate: 0.08 },
  { min: 61_200, max: 154_259, rate: 0.1 },
  { min: 154_259, max: 185_111, rate: 0.12 },
  { min: 185_111, max: 246_813, rate: 0.13 },
  { min: 246_813, max: 370_220, rate: 0.14 },
  { min: 370_220, max: Infinity, rate: 0.15 },
];

export const ALBERTA_BPA_2026 = 22_769;

// --- CPP 2026 ---
export const CPP_2026 = {
  maxPensionableEarnings: 74_600,
  basicExemption: 3_500,
  rate: 0.0595,
  maxContribution: 4_230.45,
};

export const CPP2_2026 = {
  secondCeiling: 85_000,
  rate: 0.04,
  maxContribution: 416,
};

// --- EI 2026 ---
export const EI_2026 = {
  maxInsurableEarnings: 68_900,
  rate: 0.0163,
  maxPremium: 1_123.07,
};

// Lowest federal tax rate for credit calculations
export const FEDERAL_CREDIT_RATE_2026 = 0.14;
export const ALBERTA_CREDIT_RATE_2026 = 0.08;
