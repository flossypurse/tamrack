// Federal procurement opportunities — CanadaBuys open tender notices
// Source: Public Services and Procurement Canada, open data (CSV).
// Surfaces currently-open tenders, filtered to IT/software/AI/data work
// that an Alberta-based vendor could deliver. Demand-side feed: unlike the
// macro series, each row is a concrete opportunity with a buyer and a deadline.
//
// Two halves:
//   - fetchOpenTenderOpportunities() — pulls the live CSV from CanadaBuys.
//     Used by the daily collector to refresh the `opportunities` table.
//   - readOpportunities() — reads the accumulated `opportunities` table from
//     Postgres. Used by the MCP tool and HTTP route so agent/code callers
//     never wait on (or hammer) the upstream CDN.

import { getDb } from "./db";

// ============================================================
// Endpoint
// ============================================================

// All currently-open tender notices (refreshed continuously by PSPC).
const CANADABUYS_OPEN_TENDERS_URL =
  "https://canadabuys.canada.ca/opendata/pub/openTenderNotice-ouvertAvisAppelOffres.csv";

// ============================================================
// Errors
// ============================================================

// Thrown when the CanadaBuys CDN refuses the request (403) or returns any
// non-2xx. Mirrors AERAccessBlockedError: the collector catches it and writes
// a real `error` snapshot_log row instead of silently logging "0 rows, ok".
export class ProcurementAccessBlockedError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`CanadaBuys open tenders fetch blocked: HTTP ${status}`);
    this.name = "ProcurementAccessBlockedError";
    this.status = status;
  }
}

// ============================================================
// Interfaces
// ============================================================

export interface TenderOpportunity {
  title: string;
  referenceNumber: string;
  solicitationNumber: string;
  buyer: string;
  category: string;
  procurementMethod: string;
  gsin: string;
  gsinDescription: string;
  unspsc: string;
  unspscDescription: string;
  regionsOfOpportunity: string;
  regionsOfDelivery: string;
  publicationDate: string;
  closingDate: string;
  expectedStartDate: string;
  expectedEndDate: string;
  status: string;
  noticeUrl: string;
  // Which relevance terms matched — drives downstream scoring / debugging.
  matchedTerms: string[];
}

export interface FetchTenderOptions {
  // Narrow to opportunities whose delivery/opportunity region touches Alberta.
  // Default keeps Alberta + nationally-deliverable (remote) work.
  albertaOnly?: boolean;
  // Keep only IT/software/AI/data matches. Default true. False returns everything.
  relevantOnly?: boolean;
  // Drop notices whose closing date has already passed. Default true.
  // The "open" feed retains amended / standing notices with stale closings.
  //
  // NOTE (UTC vs Eastern): the closing comparison is a calendar-date string
  // compare against today's UTC date. Federal closing times are Eastern, so a
  // tender closing *this afternoon ET* can still read as open late in the UTC
  // day. Acceptable for a daily lead feed — the collector stores everything
  // (excludeClosed: false) and the read layer re-derives open/closed at query
  // time, so a few hours of slop never persists.
  excludeClosed?: boolean;
}

// ============================================================
// Relevance filters
// ============================================================

// Word-ish patterns over title + GSIN + UNSPSC description.
const IT_TERMS: { term: string; re: RegExp }[] = [
  { term: "artificial intelligence", re: /\bartificial intelligence\b/i },
  { term: "machine learning", re: /\bmachine learning\b/i },
  { term: "ai", re: /\bA\.?I\.?\b/ },
  { term: "generative", re: /\bgenerative\b/i },
  { term: "llm", re: /\bLLM\b/i },
  { term: "chatbot", re: /\bchat ?bot\b/i },
  { term: "natural language", re: /\bnatural language\b/i },
  { term: "data analytics", re: /\bdata analyt/i },
  { term: "data science", re: /\bdata scien/i },
  { term: "data platform", re: /\bdata platform\b/i },
  { term: "dashboard", re: /\bdashboard/i },
  { term: "predictive model", re: /\bpredictive model/i },
  { term: "software development", re: /\bsoftware develop/i },
  { term: "application development", re: /\bapplication develop/i },
  { term: "custom software", re: /\bcustom software\b/i },
  { term: "web application", re: /\bweb app/i },
  { term: "website", re: /\bweb ?site\b/i },
  { term: "informatics", re: /\binformatics\b/i },
  { term: "digital platform", re: /\bdigital platform\b/i },
  { term: "cloud", re: /\bcloud\b/i },
  { term: "api", re: /\bAPI\b/ },
  { term: "database", re: /\bdatabase\b/i },
  { term: "automation", re: /\bautomation\b/i },
];

// `cloud` and `api` over-match on their own ("cloud seeding", "API" inside an
// unrelated acronym), so they only count when a second, more specific IT term
// also matches. Everything else is specific enough to stand alone.
const WEAK_TERMS = new Set(["cloud", "api"]);

// UNSPSC families that signal IT / software / data professional services:
//   43       → IT & telecom hardware/software segment
//   811*     → computer / IT services (covers 81111x software too)
//   80101700 → business / management consulting
//   80111600 → IT / management-staffing consultation
// The bare "43"/"81111" list under-matched the professional-services half of
// the feed and made matchedTerms look more comprehensive than it was.
const IT_UNSPSC_PREFIXES = ["43", "811", "80101700", "80111600"];

const ALBERTA_RE = /\balberta\b/i;
// Nationally-deliverable buckets a remote AB vendor can serve.
const NATIONAL_RE = /\b(canada|national capital region|north america|world|all)\b/i;

// ============================================================
// CSV parsing (RFC 4180)
// ============================================================
//
// This is a hand-rolled RFC-4180 parser on purpose. The shared fetchCSV()
// helper splits the body on "\n", which corrupts this feed: CanadaBuys cells
// contain embedded newlines (multi-line descriptions) and quoted commas, so a
// naive line split shreds rows mid-record. Do NOT "simplify" this back to a
// line-split — it will silently produce garbage rows. This parser tracks quote
// state so embedded newlines/commas inside quotes stay part of their field.
function parseCsv(text: string): Record<string, string>[] {
  // Strip a leading UTF-8 BOM if present.
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++; // escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      field = "";
      row = [];
    } else if (ch === "\r") {
      // swallow — handled by the \n branch
    } else {
      field += ch;
    }
  }
  // Flush trailing field/row if the file didn't end with a newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length === 0) return [];
  const header = rows[0];
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((col, idx) => {
      obj[col] = r[idx] ?? "";
    });
    return obj;
  });
}

// ============================================================
// Fetcher (live CanadaBuys CSV → typed rows)
// ============================================================

// Collapse embedded newlines (multi-value cells) and trim.
function norm(value: string | undefined): string {
  return (value ?? "").replace(/\s*\n\s*/g, "; ").trim();
}

function isRelevant(haystack: string, unspsc: string): string[] {
  const matched: string[] = [];
  for (const { term, re } of IT_TERMS) {
    if (re.test(haystack)) matched.push(term);
  }
  if (IT_UNSPSC_PREFIXES.some((p) => unspsc.startsWith(p))) {
    matched.push(`unspsc:${unspsc.slice(0, 2)}`);
  }
  // Weak terms ("cloud", "api") don't count unless something stronger matched
  // too — otherwise they balloon the result set with false positives.
  const strong = matched.filter((m) => !WEAK_TERMS.has(m));
  if (strong.length === 0) return [];
  return matched;
}

function isReachable(opportunity: string, delivery: string, albertaOnly: boolean): boolean {
  const combined = `${opportunity} ${delivery}`;
  if (albertaOnly) return ALBERTA_RE.test(combined);
  // Remote-deliverable: Alberta, national, or no region stated.
  if (combined.trim().length === 0) return true;
  return ALBERTA_RE.test(combined) || NATIONAL_RE.test(combined);
}

export async function fetchOpenTenderOpportunities(
  opts: FetchTenderOptions = {}
): Promise<TenderOpportunity[]> {
  const albertaOnly = opts.albertaOnly ?? false;
  const relevantOnly = opts.relevantOnly ?? true;
  const excludeClosed = opts.excludeClosed ?? true;
  const todayIso = new Date().toISOString().slice(0, 10);

  const res = await fetch(CANADABUYS_OPEN_TENDERS_URL, {
    next: { revalidate: 3600 },
    // The CanadaBuys CDN returns 403 to the default runtime user-agent.
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; TamrackCollector/1.0; +https://tamrack.ca)",
      Accept: "text/csv,*/*",
    },
  });
  if (!res.ok) {
    // Throw (don't return []) so the collector logs a real failure row.
    throw new ProcurementAccessBlockedError(res.status);
  }
  const text = await res.text();
  const records = parseCsv(text);

  const out: TenderOpportunity[] = [];
  for (const r of records) {
    const title = r["title-titre-eng"] ?? "";
    if (title.length === 0) continue;

    const gsinDescription = r["gsinDescription-nibsDescription-eng"] ?? "";
    const unspscDescription = r["unspscDescription-eng"] ?? "";
    const unspsc = r["unspsc"] ?? "";
    const haystack = `${title} ${gsinDescription} ${unspscDescription}`;

    const matchedTerms = isRelevant(haystack, unspsc);
    if (relevantOnly && matchedTerms.length === 0) continue;

    const closingDate = r["tenderClosingDate-appelOffresDateCloture"] ?? "";
    if (excludeClosed && closingDate && closingDate.slice(0, 10) < todayIso) continue;

    const regionsOfOpportunity = norm(r["regionsOfOpportunity-regionAppelOffres-eng"]);
    const regionsOfDelivery = norm(r["regionsOfDelivery-regionsLivraison-eng"]);
    if (!isReachable(regionsOfOpportunity, regionsOfDelivery, albertaOnly)) continue;

    out.push({
      title,
      referenceNumber: r["referenceNumber-numeroReference"] ?? "",
      solicitationNumber: r["solicitationNumber-numeroSollicitation"] ?? "",
      buyer:
        r["contractingEntityName-nomEntitContractante-eng"] ||
        r["endUserEntitiesName-nomEntitesUtilisateurFinal-eng"] ||
        "",
      category: norm(r["procurementCategory-categorieApprovisionnement"]),
      procurementMethod: r["procurementMethod-methodeApprovisionnement-eng"] ?? "",
      gsin: r["gsin-nibs"] ?? "",
      gsinDescription,
      unspsc,
      unspscDescription,
      regionsOfOpportunity,
      regionsOfDelivery,
      publicationDate: r["publicationDate-datePublication"] ?? "",
      closingDate,
      expectedStartDate: r["expectedContractStartDate-dateDebutContratPrevue"] ?? "",
      expectedEndDate: r["expectedContractEndDate-dateFinContratPrevue"] ?? "",
      status: r["tenderStatus-appelOffresStatut-eng"] ?? "",
      noticeUrl: r["noticeURL-URLavis-eng"] ?? "",
      matchedTerms,
    });
  }

  // Soonest-closing first.
  out.sort((a, b) => a.closingDate.localeCompare(b.closingDate));
  return out;
}

// ============================================================
// Reader (accumulated `opportunities` table → typed rows)
// ============================================================

export interface StoredOpportunity extends TenderOpportunity {
  source: string;
  collectedAt: string;
}

export interface ReadOpportunityOptions {
  // Only tenders still open (closing_date >= today, or no closing date).
  openOnly?: boolean;
  // Only tenders closing on/before this YYYY-MM-DD date.
  closingBefore?: string;
  // Cap the number of rows returned. Defaults to 100, hard cap 500.
  limit?: number;
}

interface OpportunityRow {
  title: string;
  reference_number: string;
  solicitation_number: string;
  buyer: string;
  category: string;
  procurement_method: string;
  gsin: string;
  gsin_description: string;
  unspsc: string;
  unspsc_description: string;
  regions_of_opportunity: string;
  regions_of_delivery: string;
  publication_date: string;
  closing_date: string;
  expected_start_date: string;
  expected_end_date: string;
  status: string;
  notice_url: string;
  matched_terms: string;
  source: string;
  collected_at: Date | string;
}

function rowToStored(r: OpportunityRow): StoredOpportunity {
  let matchedTerms: string[] = [];
  try {
    const parsed = JSON.parse(r.matched_terms || "[]");
    if (Array.isArray(parsed)) matchedTerms = parsed.map((t) => String(t));
  } catch {
    matchedTerms = [];
  }
  return {
    title: r.title,
    referenceNumber: r.reference_number,
    solicitationNumber: r.solicitation_number,
    buyer: r.buyer,
    category: r.category,
    procurementMethod: r.procurement_method,
    gsin: r.gsin,
    gsinDescription: r.gsin_description,
    unspsc: r.unspsc,
    unspscDescription: r.unspsc_description,
    regionsOfOpportunity: r.regions_of_opportunity,
    regionsOfDelivery: r.regions_of_delivery,
    publicationDate: r.publication_date,
    closingDate: r.closing_date,
    expectedStartDate: r.expected_start_date,
    expectedEndDate: r.expected_end_date,
    status: r.status,
    noticeUrl: r.notice_url,
    matchedTerms,
    source: r.source,
    collectedAt:
      r.collected_at instanceof Date
        ? r.collected_at.toISOString()
        : String(r.collected_at),
  };
}

export async function readOpportunities(
  opts: ReadOpportunityOptions = {},
): Promise<StoredOpportunity[]> {
  const pool = await getDb();
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
  const todayIso = new Date().toISOString().slice(0, 10);

  const where: string[] = [];
  const params: unknown[] = [];

  if (opts.openOnly) {
    // Keep rows with no closing date (standing notices) and rows closing today
    // or later. Calendar-date string compare matches how the data is stored.
    params.push(todayIso);
    where.push(`(closing_date = '' OR closing_date >= $${params.length})`);
  }
  if (opts.closingBefore) {
    params.push(opts.closingBefore);
    where.push(`(closing_date <> '' AND closing_date <= $${params.length})`);
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  params.push(limit);

  const { rows } = await pool.query<OpportunityRow>(
    `SELECT title, reference_number, solicitation_number, buyer, category,
            procurement_method, gsin, gsin_description, unspsc, unspsc_description,
            regions_of_opportunity, regions_of_delivery, publication_date,
            closing_date, expected_start_date, expected_end_date, status,
            notice_url, matched_terms, source, collected_at
       FROM opportunities
       ${whereSql}
       ORDER BY (closing_date = '') ASC, closing_date ASC, collected_at DESC
       LIMIT $${params.length}`,
    params,
  );

  return rows.map(rowToStored);
}
