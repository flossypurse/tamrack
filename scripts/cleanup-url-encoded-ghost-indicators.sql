-- One-shot cleanup for URL-encoded ghost rows in regional_indicators.
--
-- A legacy ingest bug wrote three indicator rows using the URL-encoded form
-- of the indicator name instead of the decoded human-readable form. Each is
-- a single ghost row that shadows the real series.
--
-- The corresponding decoded indicators ("Total Equalized Assessment",
-- "Residential Share of Property Assessments", "Municipal Tax Rates") are
-- already populated correctly via REGIONAL_INDICATORS, so the ghosts can be
-- removed without backfilling.
--
-- Run once against the prod Crunchy DB:
--   psql "$DATABASE_URL" -f scripts/cleanup-url-encoded-ghost-indicators.sql
--
-- Idempotent: re-running is a no-op once the rows are gone.

BEGIN;

SELECT
  indicator,
  COUNT(*) AS rows
FROM regional_indicators
WHERE indicator IN (
  'Total%20Equalized%20Assessment',
  'Residential%20Share%20of%20Property%20Assessments',
  'Municipal%20Tax%20Rates'
)
GROUP BY indicator;

DELETE FROM regional_indicators
WHERE indicator IN (
  'Total%20Equalized%20Assessment',
  'Residential%20Share%20of%20Property%20Assessments',
  'Municipal%20Tax%20Rates'
);

COMMIT;
