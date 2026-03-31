/**
 * Alberta security deposit interest rates by year.
 * Formula: ATB Financial cashable 1-year GIC rate (Nov 1 prior year) minus 3%.
 * If result <= 0, rate is 0%.
 * Source: alberta.ca/annual-security-deposit-interest-rate
 *
 * Interest is simple (not compound) — calculated on original deposit only.
 * Paid annually on tenancy anniversary or at end of tenancy.
 */

export const DEPOSIT_INTEREST_RATES: Record<number, number> = {
  2004: 0.0042,
  2005: 0.0101,
  2006: 0.0171,
  2007: 0.0168,
  2008: 0.0126,
  2009: 0,
  2010: 0,
  2011: 0,
  2012: 0,
  2013: 0,
  2014: 0,
  2015: 0,
  2016: 0,
  2017: 0,
  2018: 0,
  2019: 0,
  2020: 0,
  2021: 0,
  2022: 0,
  2023: 0,
  2024: 0.016,
  2025: 0.005,
  2026: 0,
};

// Earliest and latest year we have data for
export const EARLIEST_YEAR = Math.min(
  ...Object.keys(DEPOSIT_INTEREST_RATES).map(Number)
);
export const LATEST_YEAR = Math.max(
  ...Object.keys(DEPOSIT_INTEREST_RATES).map(Number)
);
