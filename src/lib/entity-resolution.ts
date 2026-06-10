/**
 * Entity resolution for the operator directory.
 *
 * Matches a business in `intel_operators` to records in our other NAMED feeds
 * (municipal business licences, AER well licences, federal contracts/grants)
 * via trigram name similarity + locality corroboration, so per-business signals
 * come from OUR substrate rather than open-web research. Accepted matches are
 * persisted to `signals.operator_aliases` (the pre-existing resolution table);
 * `getOperatorSignals` fans across the resolved sources for the compose step.
 *
 * Resolution is name-based and therefore probabilistic — every signal carries a
 * confidence and the match method, and a low-confidence match is recorded but
 * flagged rather than asserted as fact.
 */
import { randomUUID } from "crypto";
import { getDb } from "./db";

// Legal-form suffixes and noise tokens stripped before trigram comparison so
// "North Face Mechanical Ltd." and "North Face Mechanical" collapse together.
const SUFFIX_RE =
  /\b(ltd|ltee|limited|inc|incorporated|corp|corporation|co|company|llp|llc|lp|ulc|holdings?|enterprises?|services?|group|the)\b/g;

export function normalizeBusinessName(raw: string): string {
  return (raw || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[.,'"`()/\\-]/g, " ")
    .replace(SUFFIX_RE, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sameLocality(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

// Accept a name match when similarity is high on its own, or moderate with a
// corroborating locality (city) match — the second arm catches the common case
// where the same business appears in two feeds with slightly different names.
const STRONG = 0.6;
const MODERATE = 0.42;

export type ResolvedSourceKey =
  | "edmonton_licence"
  | "calgary_licence"
  | "well_licence"
  | "federal_contract"
  | "federal_grant";

export interface OperatorSignals {
  business_licence: {
    source: "edmonton" | "calgary";
    city: string | null;
    category: string | null;
    status: string | null;
    since: string | null;
    confidence: number;
  } | null;
  well_activity: {
    licences: number;
    latest_filing: string | null;
    substances: string[];
    confidence: number;
  } | null;
  federal_contracts: {
    count: number;
    total_value_cad: number;
    latest_date: string | null;
    confidence: number;
  } | null;
  resolved_sources: ResolvedSourceKey[];
}

interface OperatorRef {
  id: string;
  name: string;
  city?: string | null;
}

async function recordAlias(
  client: import("pg").PoolClient,
  operatorId: string,
  canonicalName: string,
  aliasString: string,
  source: ResolvedSourceKey,
  sourceRowId: string | null,
  confidence: number,
  method: string,
): Promise<void> {
  await client.query(
    `INSERT INTO signals.operator_aliases
       (id, canonical_id, canonical_name, alias_string, source, source_row_id, confidence, match_method, resolved_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8, NOW())
     ON CONFLICT (alias_string, source) DO UPDATE SET
       canonical_id = EXCLUDED.canonical_id,
       canonical_name = EXCLUDED.canonical_name,
       source_row_id = EXCLUDED.source_row_id,
       confidence = EXCLUDED.confidence,
       match_method = EXCLUDED.match_method,
       resolved_at = NOW()`,
    [randomUUID(), operatorId, canonicalName, aliasString, source, sourceRowId, confidence, method],
  );
}

/**
 * Resolve one operator against the named feeds and return its OUR-sourced
 * signals. When `persist` is true, accepted matches are written to
 * `signals.operator_aliases`. Pure read when persist is false (used by the
 * compose step, which shouldn't write during a research run).
 */
export async function getOperatorSignals(
  op: OperatorRef,
  opts: { persist?: boolean } = {},
): Promise<OperatorSignals> {
  const pool = await getDb();
  const q = normalizeBusinessName(op.name);
  const out: OperatorSignals = {
    business_licence: null,
    well_activity: null,
    federal_contracts: null,
    resolved_sources: [],
  };
  if (q.length < 3) return out;

  const client = await pool.connect();
  try {
    if (opts.persist) await client.query("BEGIN");

    // --- Business licences (trigram-indexed) ---
    const lic = await client.query<{
      source: string; licence_id: string; trade_name: string; city: string | null;
      category: string | null; status: string | null; issue_date: string | null; sim: number;
    }>(
      `SELECT source, licence_id, trade_name, city, category, status, issue_date,
              similarity(LOWER(trade_name), $1) AS sim
         FROM business_licences
        WHERE LOWER(trade_name) % $1
        ORDER BY sim DESC
        LIMIT 5`,
      [q],
    );
    for (const r of lic.rows) {
      const cityMatch = sameLocality(r.city, op.city);
      const accept = r.sim >= STRONG || (r.sim >= MODERATE && cityMatch);
      if (!accept) continue;
      const conf = Math.min(0.99, r.sim + (cityMatch ? 0.1 : 0));
      out.business_licence = {
        source: r.source as "edmonton" | "calgary",
        city: r.city, category: r.category, status: r.status,
        since: r.issue_date, confidence: Number(conf.toFixed(3)),
      };
      out.resolved_sources.push(
        r.source === "calgary" ? "calgary_licence" : "edmonton_licence",
      );
      if (opts.persist) {
        await recordAlias(client, op.id, op.name, normalizeBusinessName(r.trade_name),
          r.source === "calgary" ? "calgary_licence" : "edmonton_licence",
          r.licence_id, conf, cityMatch ? "trigram+city" : "trigram");
      }
      break; // best match only
    }

    // --- Well licences (licensee = company; small table, seq scan is fine) ---
    const well = await client.query<{
      licences: number; latest: string | null; substances: string[]; sim: number; licensee: string;
    }>(
      `SELECT licensee, count(*)::int AS licences, max(filing_date) AS latest,
              array_agg(DISTINCT substance) AS substances,
              max(similarity(LOWER(licensee), $1)) AS sim
         FROM well_licences
        WHERE LOWER(licensee) % $1
        GROUP BY licensee
        ORDER BY sim DESC
        LIMIT 1`,
      [q],
    );
    if (well.rows[0] && well.rows[0].sim >= STRONG) {
      const w = well.rows[0];
      out.well_activity = {
        licences: w.licences, latest_filing: w.latest,
        substances: (w.substances || []).filter(Boolean),
        confidence: Number(Math.min(0.99, w.sim).toFixed(3)),
      };
      out.resolved_sources.push("well_licence");
      if (opts.persist) {
        await recordAlias(client, op.id, op.name, normalizeBusinessName(w.licensee),
          "well_licence", null, w.sim, "trigram");
      }
    }

    // --- Federal contracts (vendor; may be empty until first collection) ---
    const fc = await client.query<{
      cnt: number; total: number; latest: string | null; sim: number; vendor: string;
    }>(
      `SELECT vendor, count(*)::int AS cnt, coalesce(sum(value),0) AS total,
              max(contract_date) AS latest, max(similarity(LOWER(vendor), $1)) AS sim
         FROM fiscal_federal_contracts
        WHERE LOWER(vendor) % $1
        GROUP BY vendor
        ORDER BY sim DESC
        LIMIT 1`,
      [q],
    ).catch(() => ({ rows: [] as never[] }));
    if (fc.rows[0] && fc.rows[0].sim >= STRONG) {
      const c = fc.rows[0];
      out.federal_contracts = {
        count: c.cnt, total_value_cad: Number(c.total), latest_date: c.latest,
        confidence: Number(Math.min(0.99, c.sim).toFixed(3)),
      };
      out.resolved_sources.push("federal_contract");
      if (opts.persist) {
        await recordAlias(client, op.id, op.name, normalizeBusinessName(c.vendor),
          "federal_contract", null, c.sim, "trigram");
      }
    }

    if (opts.persist) await client.query("COMMIT");
    return out;
  } catch (e) {
    if (opts.persist) await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Daily resolution pass: probe every operator against the named feeds and
 * persist accepted matches to `signals.operator_aliases`. Idempotent (the
 * alias upsert is keyed on (alias_string, source)). Returns the number of
 * operators that resolved to at least one source.
 */
export async function resolveAllOperators(today: string): Promise<number> {
  const pool = await getDb();
  const { rows: ops } = await pool.query<OperatorRef>(
    `SELECT id, name, city FROM intel_operators ORDER BY name`,
  );
  let resolved = 0;
  for (const op of ops) {
    try {
      const sig = await getOperatorSignals(op, { persist: true });
      if (sig.resolved_sources.length > 0) resolved += 1;
    } catch (e) {
      console.warn(`[resolve] ${op.id} failed:`, e instanceof Error ? e.message : e);
    }
  }
  await pool.query(
    `INSERT INTO snapshot_log (taken_at, source, records_inserted, status, error)
     VALUES (NOW(), $1, $2, 'ok', NULL)`,
    ["entity_resolution", resolved],
  );
  void today;
  return resolved;
}

/** Human-readable one-liners for the compose prompt / structured output. */
export function describeSignals(s: OperatorSignals): string[] {
  const lines: string[] = [];
  if (s.business_licence) {
    const b = s.business_licence;
    lines.push(
      `Active ${b.source} business licence${b.category ? ` (${b.category})` : ""}${b.since ? `, since ${String(b.since).slice(0, 10)}` : ""} [Tamrack, conf ${b.confidence}]`,
    );
  }
  if (s.well_activity) {
    lines.push(
      `${s.well_activity.licences} AER well licence(s)${s.well_activity.latest_filing ? `, latest ${String(s.well_activity.latest_filing).slice(0, 10)}` : ""} [Tamrack, conf ${s.well_activity.confidence}]`,
    );
  }
  if (s.federal_contracts) {
    lines.push(
      `${s.federal_contracts.count} federal contract(s) totalling $${Math.round(s.federal_contracts.total_value_cad).toLocaleString()} [Tamrack, conf ${s.federal_contracts.confidence}]`,
    );
  }
  return lines;
}
