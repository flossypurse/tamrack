-- One-shot cleanup for orphan rows in regional_indicators.
--
-- Before the fetcher-boundary canonicalization fix landed, the worker wrote
-- each row using whatever IndicatorSummaryDescription Alberta's API returned.
-- For most indicators that string is the same as the canonical key we use
-- to request the URL (REGIONAL_INDICATORS in data-sources-regional.ts), but
-- for some it's a different generic category — e.g. requesting
-- "Total%20Equalized%20Assessment" returns rows labelled "Property Assessments".
-- The result was twin sets of rows for the same underlying series, under two
-- different labels.
--
-- Post-fix, the collector always upserts under the canonical key, so the
-- orphan labels stop getting refreshed on subsequent fires and just go stale.
-- This script deletes every row whose label isn't in the canonical set.
--
-- The canonical list below must stay in sync with REGIONAL_INDICATORS in
-- src/lib/data-sources-regional.ts. If a future indicator is added or
-- renamed, update this list before running.
--
-- Run once against the prod Crunchy DB:
--   psql "$DATABASE_URL" -f scripts/cleanup-orphan-indicator-labels.sql
--
-- Idempotent: re-running after a clean run is a no-op.

BEGIN;

-- Audit: what we're about to delete (logged inside the txn for the record).
SELECT
  indicator,
  COUNT(*) AS rows,
  MAX(collected_at) AS most_recent
FROM regional_indicators
WHERE indicator NOT IN (
  'Population',
  'Housing Starts',
  'Unemployment Rate',
  'Building Permits',
  'Average Weekly Earnings',
  'Labour Force',
  'Median Household Income',
  'Business Counts',
  'Net Migration',
  'Assessment Base',
  'Crime Severity Index',
  'Average Residential Sale Price',
  'Farm Cash Receipts',
  'Marital Status',
  'Educational Attainment',
  'Percent of Small Businesses',
  'Total Equalized Assessment',
  'Major Projects',
  'Greenhouse Gas Emissions',
  'Dwelling Units',
  'Well Count',
  'K - 9 Enrollments',
  'Residential Share of Property Assessments',
  'High School Enrollments',
  'Municipal Tax Rates',
  'Incorporations',
  'Percent Visible Minority',
  'Births and Deaths',
  'Average Rent',
  'Census Employment',
  'Percent Aboriginal',
  'Natural Gas Production',
  'Pigs',
  'Businesses',
  'Percent Official Language Speakers',
  'Net Commuter Flow',
  'Percent Single Family Houses',
  'Natural Gas Reserves',
  'Motorized Vehicle Registrations',
  'Driver''s Licenses',
  'Crop Acres',
  'Life Expectancy',
  'Median Income',
  'Bankruptcies',
  'Vacancy Rates',
  'Cattle and Calves',
  'Permanent Resident Landings',
  'Air Quality Index',
  'Employment Insurance Beneficiaries',
  'Temporary Resident Entries',
  'Daily Vehicles per KM',
  'Temporary Resident Stock'
)
GROUP BY indicator
ORDER BY indicator;

DELETE FROM regional_indicators
WHERE indicator NOT IN (
  'Population',
  'Housing Starts',
  'Unemployment Rate',
  'Building Permits',
  'Average Weekly Earnings',
  'Labour Force',
  'Median Household Income',
  'Business Counts',
  'Net Migration',
  'Assessment Base',
  'Crime Severity Index',
  'Average Residential Sale Price',
  'Farm Cash Receipts',
  'Marital Status',
  'Educational Attainment',
  'Percent of Small Businesses',
  'Total Equalized Assessment',
  'Major Projects',
  'Greenhouse Gas Emissions',
  'Dwelling Units',
  'Well Count',
  'K - 9 Enrollments',
  'Residential Share of Property Assessments',
  'High School Enrollments',
  'Municipal Tax Rates',
  'Incorporations',
  'Percent Visible Minority',
  'Births and Deaths',
  'Average Rent',
  'Census Employment',
  'Percent Aboriginal',
  'Natural Gas Production',
  'Pigs',
  'Businesses',
  'Percent Official Language Speakers',
  'Net Commuter Flow',
  'Percent Single Family Houses',
  'Natural Gas Reserves',
  'Motorized Vehicle Registrations',
  'Driver''s Licenses',
  'Crop Acres',
  'Life Expectancy',
  'Median Income',
  'Bankruptcies',
  'Vacancy Rates',
  'Cattle and Calves',
  'Permanent Resident Landings',
  'Air Quality Index',
  'Employment Insurance Beneficiaries',
  'Temporary Resident Entries',
  'Daily Vehicles per KM',
  'Temporary Resident Stock'
);

COMMIT;
