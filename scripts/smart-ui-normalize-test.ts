/**
 * Regression test for `src/lib/smart-ui/normalize-envelope.ts`.
 *
 * Exercises the wide-shape → `data.points` projection against synthetic
 * envelopes for `tamrack_housing` (the bug that motivated the
 * normalizer), `tamrack_energy`, and `tamrack_business`. No DB, no
 * upstreams, no MCP — pure-function checks.
 *
 * Run with:
 *   npx tsx scripts/smart-ui-normalize-test.ts
 *
 * Exits non-zero on any assertion failure.
 */

import { normalizeToolEnvelope } from "../src/lib/smart-ui/normalize-envelope";

let failed = 0;
let passed = 0;

function assert(label: string, cond: boolean, detail?: unknown): void {
  if (cond) {
    passed++;
    console.log(`  PASS  ${label}`);
    return;
  }
  failed++;
  console.error(`  FAIL  ${label}`);
  if (detail !== undefined) {
    console.error(`        ${JSON.stringify(detail)}`);
  }
}

interface NormalizedShape {
  data?: {
    points?: { date: string; value: number }[];
    projected_from?: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// tamrack_housing — the regression case from the original bug.
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n[tamrack_housing — starts, municipality=edmonton]");
{
  const envelope = {
    schema_version: "1",
    tool: "tamrack_housing",
    source: "CMHC via StatsCan",
    data: {
      dataset: "starts",
      source: "CMHC via StatsCan WDS (Table 34-10-0154)",
      unit: "dwelling units",
      served_from: "upstream",
      payload: {
        dataset: "starts",
        rows: [
          { date: "2024-01-01", edmonton: 920, calgary: 1450 },
          { date: "2024-02-01", edmonton: 1010, calgary: 1322 },
          { date: "2024-03-01", edmonton: 880, calgary: 1610 },
        ],
      },
    },
  };

  const { normalized } = normalizeToolEnvelope(
    "tamrack_housing",
    { dataset: "starts", municipality: "edmonton" },
    envelope,
  );
  const n = normalized as NormalizedShape;
  assert(
    "projects 3 points",
    n.data?.points?.length === 3,
    n.data?.points,
  );
  assert(
    "picks Edmonton column when municipality=edmonton",
    n.data?.points?.[0]?.value === 920 && n.data?.points?.[2]?.value === 880,
    n.data?.points,
  );
  assert(
    "tags provenance as payload.rows[].edmonton",
    n.data?.projected_from === "payload.rows[].edmonton",
    n.data?.projected_from,
  );
}

console.log("\n[tamrack_housing — starts, municipality=calgary]");
{
  const envelope = {
    schema_version: "1",
    tool: "tamrack_housing",
    source: "CMHC via StatsCan",
    data: {
      dataset: "starts",
      payload: {
        dataset: "starts",
        rows: [
          { date: "2024-01-01", edmonton: 920, calgary: 1450 },
          { date: "2024-02-01", edmonton: 1010, calgary: 1322 },
        ],
      },
    },
  };
  const { normalized } = normalizeToolEnvelope(
    "tamrack_housing",
    { dataset: "starts", municipality: "calgary" },
    envelope,
  );
  const n = normalized as NormalizedShape;
  assert(
    "picks Calgary column when municipality=calgary",
    n.data?.points?.[0]?.value === 1450 && n.data?.points?.[1]?.value === 1322,
    n.data?.points,
  );
}

console.log("\n[tamrack_housing — starts, no municipality (default edmonton)]");
{
  const envelope = {
    schema_version: "1",
    tool: "tamrack_housing",
    source: "CMHC via StatsCan",
    data: {
      dataset: "starts",
      payload: {
        dataset: "starts",
        rows: [{ date: "2024-01-01", edmonton: 920, calgary: 1450 }],
      },
    },
  };
  const { normalized } = normalizeToolEnvelope(
    "tamrack_housing",
    { dataset: "starts" },
    envelope,
  );
  const n = normalized as NormalizedShape;
  assert(
    "defaults to edmonton column when municipality omitted",
    n.data?.points?.[0]?.value === 920,
    n.data?.points,
  );
}

console.log("\n[tamrack_housing — mortgage_rate is narrow rows]");
{
  const envelope = {
    schema_version: "1",
    tool: "tamrack_housing",
    source: "CMHC via StatsCan",
    data: {
      dataset: "mortgage_rate",
      payload: {
        dataset: "mortgage_rate",
        rows: [
          { date: "2024-01-01", value: 5.79 },
          { date: "2024-02-01", value: 5.84 },
        ],
      },
    },
  };
  const { normalized } = normalizeToolEnvelope(
    "tamrack_housing",
    { dataset: "mortgage_rate" },
    envelope,
  );
  const n = normalized as NormalizedShape;
  assert(
    "lifts narrow rows through to data.points",
    n.data?.points?.length === 2 && n.data?.points?.[0]?.value === 5.79,
    n.data?.points,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// tamrack_energy — pool_price_series and pipeline_throughput
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n[tamrack_energy — pool_price_series]");
{
  const envelope = {
    schema_version: "1",
    tool: "tamrack_energy",
    source: "AESO",
    data: {
      dataset: "pool_price_series",
      payload: {
        dataset: "pool_price_series",
        rows: [
          { date: "2024-01-01", value: 38.2 },
          { date: "2024-01-02", value: 41.9 },
        ],
      },
    },
  };
  const { normalized } = normalizeToolEnvelope(
    "tamrack_energy",
    { dataset: "pool_price_series" },
    envelope,
  );
  const n = normalized as NormalizedShape;
  assert(
    "projects 2 pool-price points",
    n.data?.points?.length === 2 && n.data?.points?.[1]?.value === 41.9,
    n.data?.points,
  );
}

console.log("\n[tamrack_energy — pipeline_throughput picks `throughput`]");
{
  const envelope = {
    schema_version: "1",
    tool: "tamrack_energy",
    source: "CER Open Data",
    data: {
      dataset: "pipeline_throughput",
      payload: {
        dataset: "pipeline_throughput",
        pipeline: "NGTL",
        rows: [
          {
            date: "2024-01-01",
            pipeline: "NGTL",
            keyPoint: "ABS",
            product: "Gas",
            throughput: 12_500,
            capacity: 14_000,
            utilization: 0.89,
            unit: "Mm3/d",
          },
        ],
      },
    },
  };
  const { normalized } = normalizeToolEnvelope(
    "tamrack_energy",
    { dataset: "pipeline_throughput", pipeline: "NGTL" },
    envelope,
  );
  const n = normalized as NormalizedShape;
  assert(
    "projects throughput column",
    n.data?.points?.[0]?.value === 12_500,
    n.data?.points,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// tamrack_business — generic count/value column probe
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n[tamrack_business — rows with `count`]");
{
  const envelope = {
    schema_version: "1",
    tool: "tamrack_business",
    source: "Edmonton Open Data",
    data: {
      category: "edmonton_licences_by_year",
      payload: {
        category: "edmonton_licences_by_year",
        rows: [
          { date: "2023-01-01", count: 5240 },
          { date: "2024-01-01", count: 5519 },
        ],
      },
    },
  };
  const { normalized } = normalizeToolEnvelope(
    "tamrack_business",
    { category: "edmonton_licences_by_year" },
    envelope,
  );
  const n = normalized as NormalizedShape;
  assert(
    "projects `count` column",
    n.data?.points?.length === 2 && n.data?.points?.[1]?.value === 5519,
    n.data?.points,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pass-through: tools that already carry data.points should be untouched.
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n[tamrack_macro — already has data.points, pass-through]");
{
  const envelope = {
    schema_version: "1",
    tool: "tamrack_macro",
    source: "BoC",
    data: {
      indicator: "policy_rate",
      source: "BoC Valet",
      unit: "percent",
      last_observation: { date: "2024-06-05", value: 4.75 },
      served_from: "upstream",
      points: [
        { date: "2024-06-04", value: 5.0 },
        { date: "2024-06-05", value: 4.75 },
      ],
    },
  };
  const { normalized, note } = normalizeToolEnvelope(
    "tamrack_macro",
    { indicator: "policy_rate" },
    envelope,
  );
  assert("pass-through preserves identity", normalized === envelope);
  assert("no note emitted on pass-through", note === undefined, { note });
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
