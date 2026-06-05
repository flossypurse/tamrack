// Federal procurement opportunities — CanadaBuys open tender notices
// Source: Public Services and Procurement Canada, open data (CSV).
// Surfaces currently-open tenders, filtered to IT/software/AI/data work
// that an Alberta-based vendor could deliver. Demand-side feed: unlike the
// macro series, each row is a concrete opportunity with a buyer and a deadline.

// ============================================================
// Endpoint
// ============================================================

// All currently-open tender notices (refreshed continuously by PSPC).
const CANADABUYS_OPEN_TENDERS_URL =
  "https://canadabuys.canada.ca/opendata/pub/openTenderNotice-ouvertAvisAppelOffres.csv";

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

// UNSPSC segment 43 = IT/telecom; 81111x = software / IT services.
const IT_UNSPSC_PREFIXES = ["43", "81111"];

const ALBERTA_RE = /\balberta\b/i;
// Nationally-deliverable buckets a remote AB vendor can serve.
const NATIONAL_RE = /\b(canada|national capital region|north america|world|all)\b/i;

// ============================================================
// CSV parsing (RFC 4180 — the feed has embedded newlines + quoted commas)
// ============================================================

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
// Fetcher
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

  try {
    const res = await fetch(CANADABUYS_OPEN_TENDERS_URL, {
      next: { revalidate: 3600 },
      // The CanadaBuys CDN returns 403 to the default runtime user-agent.
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; TamrackCollector/1.0; +https://tamrack.ca)",
        Accept: "text/csv,*/*",
      },
    });
    if (!res.ok) {
      console.error(`CanadaBuys open tenders fetch failed: ${res.status}`);
      return [];
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
  } catch (err) {
    console.error("CanadaBuys open tenders fetch error:", err);
    return [];
  }
}
