// Canada Job Bank — Alberta Tier-B signal fetcher
//
// Source: "Job Postings Advertised on Canada's National Job Bank Website"
//   Open Government Portal dataset ea639e28-c0fc-48bf-b5dd-b8899bd43072
//   Published by Employment and Social Development Canada (ESDC).
//   Licence: Open Government Licence – Canada (freely reusable, no API key needed).
//
// Feed characteristics:
//   - Monthly CSV published on the ~3rd of each following month.
//   - Format: UTF-16LE with BOM, TAB-delimited (not comma). The extension says .csv
//     but the actual delimiter is \t — the parseTsv function handles this.
//   - No employer name is included (ESDC omits it for privacy). The dataset
//     provides NOC code, job title, city, province, NAICS sector, salary, and
//     vacancy count. That is enough for lead-signal detection.
//   - The file is discovered dynamically through the CKAN API so the fetcher
//     never goes stale when ESDC publishes a new month.
//
// Signal model:
//   Alberta businesses hiring for manual-process roles (dispatchers, admin
//   assistants, bookkeepers, inventory clerks, etc.) are latent demand for
//   operations-automation software. Each posting is a "Tier B" signal row.
//   NOC21 codes are more reliable than title-string matching because titles
//   are employer-supplied free text; NOC codes are standardised by ESDC.

import { getDb } from "./db";

// ============================================================
// Endpoint & config
// ============================================================

// CKAN package metadata API — resolves to the latest monthly CSV URL.
const CKAN_PACKAGE_API =
  "https://open.canada.ca/data/api/action/package_show?id=ea639e28-c0fc-48bf-b5dd-b8899bd43072";

// The open.canada.ca download URLs redirect to time-limited Azure SAS URLs.
// fetch() follows the redirect automatically; no special handling needed.
// A browser-like User-Agent avoids the 403 some GC CDNs return to plain runtimes.
const UA =
  "Mozilla/5.0 (compatible; TamrackCollector/1.0; +https://tamrack.ca)";

// ============================================================
// NOC21 Tier-B signal codes
// ============================================================
//
// These are NOC 2021 (5-digit) codes for roles that signal manual-process
// strain in SMB back-offices. Hiring for these roles is a leading indicator
// that the employer has automatable operations work.
//
// Mapping source: https://noc.esdc.gc.ca/
//
export const TIER_B_NOC21_CODES: Record<string, string> = {
  "12100": "Executive assistants",
  "12200": "Accounting technicians and bookkeepers",
  "13100": "Administrative officers",
  "13102": "Payroll administrators",
  "13110": "Administrative assistants",
  "13201": "Production and transportation logistics coordinators",
  "13202": "Supply chain logistics analysts",
  "14111": "Data entry clerks",
  "14200": "Accounting and related clerks",
  "14400": "Shippers and receivers",
  "14402": "Storekeepers and partspersons",
  "14403": "Purchasing and inventory control workers",
  "14404": "Dispatchers",
  "15110": "Customs, ship and other brokers",
  "15111": "Freight forwarders",
  "15200": "Contractors and supervisors, supply chain, tracking and scheduling occupations",
};

// ============================================================
// Types
// ============================================================

export interface JobBankPosting {
  // Internal Job Bank location snapshot ID (not the public posting URL).
  wicId: string;
  // ESDC-normalised job title (lowercase, occasionally "NA").
  jobTitle: string;
  // Employer's original free-text job title.
  originalTitle: string;
  // NOC 2021 5-digit code, or "" when not classified (external contributor postings).
  noc21Code: string;
  // Human-readable NOC 2021 code name.
  noc21Name: string;
  // NOC 2016 4-digit code — included for backward compatibility.
  noc2016Code: string;
  // Province/Territory as written in the dataset ("Alberta", "British Columbia", …).
  province: string;
  city: string;
  postalCode: string;
  economicRegion: string;
  naicsSector: string;
  firstPostingDate: string; // "YYYY/MM/DD"
  vacancyCount: number;
  employmentType: string; // "Full time", "Part time", …
  employmentTerm: string; // "Permanent", "Term or contract", …
  salaryMin: number; // 0 if not stated
  salaryMax: number; // 0 if not stated
  salaryPer: string; // "Hour", "Year", "Month", "Week", "Day", "NA"
  // Which Tier-B NOC code matched this row.
  matchedNocCode: string;
  matchedNocName: string;
}

export interface FetchJobBankOptions {
  // ISO YYYY-MM of the data month to fetch. Defaults to the latest published month
  // discovered via the CKAN API. Provide an explicit value in tests to pin a month.
  month?: string;
  // Province filter. Defaults to "Alberta".
  province?: string;
  // When true, only return postings whose NOC21 code is in TIER_B_NOC21_CODES.
  // When false, return all Alberta postings.
  tierBOnly?: boolean;
  // Hard cap on returned rows (applied after filtering). 0 = no limit.
  limit?: number;
}

export interface JobBankSummary {
  month: string; // "YYYY-MM" of the dataset
  totalAlbertaPostings: number;
  tierBPostings: number;
  byNoc: { code: string; name: string; count: number; vacancies: number }[];
  bySector: { sector: string; count: number }[];
  byCity: { city: string; count: number }[];
  sampleRows: JobBankPosting[];
}

// ============================================================
// TSV parser (UTF-16 BOM stripped upstream, raw text passed in)
// ============================================================

/**
 * Minimal TSV parser for the Job Bank feed. The feed uses \t as delimiter and
 * does not quote fields — embedded tabs would be a data error, not an encoding
 * convention. CRLF and bare CR are both normalised to LF before splitting.
 */
function parseTsv(text: string): Record<string, string>[] {
  // Strip a UTF-8 or UTF-16 BOM that survived the TextDecoder round-trip.
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const lines = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split("\t");
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const fields = line.split("\t");
    const row: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      row[headers[c].trim()] = (fields[c] ?? "").trim();
    }
    rows.push(row);
  }
  return rows;
}

function parseNum(val: string | undefined): number {
  if (!val || val === "NA" || val === "*No data") return 0;
  const n = parseFloat(val.replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

function clean(val: string | undefined): string {
  if (!val || val === "NA" || val === "*No data") return "";
  return val.trim();
}

// ============================================================
// CKAN resource discovery
// ============================================================

/**
 * Queries the Open Canada CKAN API to find the download URL for the most
 * recently published English Job Bank monthly CSV.
 *
 * ESDC publishes a new resource on roughly the 3rd of each month for the
 * prior month's data. The CKAN API lists all historical resources in
 * creation-date order; we sort descending and take the first English one.
 */
async function resolveLatestEnglishUrl(): Promise<{ url: string; month: string } | null> {
  try {
    const res = await fetch(CKAN_PACKAGE_API, {
      headers: { "User-Agent": UA },
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      console.error(`[jobbank] CKAN API ${res.status}`);
      return null;
    }
    const json = await res.json();
    const resources: { url: string; created: string; name: string }[] =
      json?.result?.resources ?? [];

    // Filter to English monthly CSVs (URL contains "-en-" and ends with .csv)
    const enResources = resources.filter((r) =>
      /\/job-bank-open-data-all-job-postings-en-/.test(r.url ?? "")
    );
    if (enResources.length === 0) return null;

    // Most recently created first
    enResources.sort((a, b) => b.created.localeCompare(a.created));
    const latest = enResources[0];

    // Extract "YYYY-MM" from the resource name, e.g. "May 2026 Job Postings…"
    const nameMatch = latest.name?.match(/^(\w+ \d{4})/);
    let month = "";
    if (nameMatch) {
      const parsed = new Date(nameMatch[1] + " 1");
      if (!isNaN(parsed.getTime())) {
        month = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
      }
    }

    return { url: latest.url, month };
  } catch (err) {
    console.error("[jobbank] CKAN resource discovery failed:", err);
    return null;
  }
}

/**
 * Resolves the authoritative data month ("YYYY-MM") of the latest published
 * Job Bank snapshot via the CKAN API. Returns "" if it can't be determined.
 * The CKAN response is cached (1h) so callers that also fetch postings pay for
 * this lookup only once.
 */
export async function resolveLatestJobBankMonth(): Promise<string> {
  const resolved = await resolveLatestEnglishUrl();
  return resolved?.month ?? "";
}

// ============================================================
// Fetcher
// ============================================================

// Result of a Job Bank fetch: the postings plus the authoritative data month
// ("YYYY-MM") resolved from CKAN. Bundling the month here means callers never
// need a second CKAN round-trip to learn which month they got — and can never
// store rows under a month key that diverges from the data they fetched.
export interface JobBankFetchResult {
  postings: JobBankPosting[];
  month: string;
}

/**
 * Fetches and parses the latest Job Bank monthly CSV, filters to Alberta, and
 * optionally narrows to Tier-B NOC21 codes.
 *
 * NOTE: `opts.month` does NOT pin the data month — CKAN only exposes the latest
 * monthly resource, so this always returns the newest published month. The
 * returned `month` is the authoritative value; use it, don't assume `opts.month`.
 *
 * Never throws — returns `{ postings: [], month: "" }` on any error.
 */
export async function fetchJobBankPostings(
  opts: FetchJobBankOptions = {}
): Promise<JobBankFetchResult> {
  const province = opts.province ?? "Alberta";
  const tierBOnly = opts.tierBOnly ?? true;
  const limitN = opts.limit ?? 0;

  const resolved = await resolveLatestEnglishUrl();
  if (!resolved) {
    console.error("[jobbank] Could not resolve latest CSV URL");
    return { postings: [], month: "" };
  }
  const csvUrl = resolved.url;
  const dataMonth = resolved.month;

  try {
    const res = await fetch(csvUrl, {
      headers: {
        "User-Agent": UA,
        Accept: "text/csv,*/*",
      },
      // Cache for 6 hours — the monthly file is static once published, but the
      // CKAN API may point to a different URL after month rollover.
      next: { revalidate: 21600 },
    });
    if (!res.ok) {
      console.error(`[jobbank] CSV fetch ${res.status} from ${csvUrl}`);
      return { postings: [], month: dataMonth };
    }

    // The file is UTF-16LE with BOM. Fetch returns a byte stream; we need
    // TextDecoder to handle the encoding before parsing.
    const buffer = await res.arrayBuffer();
    const text = new TextDecoder("utf-16le").decode(buffer);

    const rawRows = parseTsv(text);
    if (rawRows.length === 0) return { postings: [], month: dataMonth };

    const out: JobBankPosting[] = [];

    for (const r of rawRows) {
      const rowProvince = r["Province/Territory"] ?? "";
      if (!rowProvince.toLowerCase().includes(province.toLowerCase())) continue;

      const noc21 = clean(r["NOC21 Code"]);
      const noc21Name = clean(r["NOC21 Code Name"]);
      const matchedCode = TIER_B_NOC21_CODES[noc21] !== undefined ? noc21 : "";
      const matchedName = matchedCode ? TIER_B_NOC21_CODES[noc21] : "";

      if (tierBOnly && !matchedCode) continue;

      out.push({
        wicId: clean(r["WIC Job Location Snapshot ID"]),
        jobTitle: clean(r["Job Title"]),
        originalTitle: clean(r["Original Job Title"]),
        noc21Code: noc21,
        noc21Name,
        noc2016Code: clean(r["NOC 2016 Code"]),
        province: rowProvince,
        city: clean(r["City"]),
        postalCode: clean(r["Work Location Postal Code"]),
        economicRegion: clean(r["Economic  Region"]) || clean(r["Economic Region"]),
        naicsSector: clean(r["NAICS"]),
        firstPostingDate: clean(r["First Posting Date"]),
        vacancyCount: Math.max(1, parseNum(r["Vacancy Count"])),
        employmentType: clean(r["Employment Type"]),
        employmentTerm: clean(r["Employment Term"]),
        salaryMin: parseNum(r["Salary Minimum"]),
        salaryMax: parseNum(r["Salary Maximum"]),
        salaryPer: clean(r["Salary Per"]),
        matchedNocCode: matchedCode,
        matchedNocName: matchedName,
      });

      if (limitN > 0 && out.length >= limitN) break;
    }

    // Most-recently posted first
    out.sort((a, b) => b.firstPostingDate.localeCompare(a.firstPostingDate));

    return { postings: out, month: dataMonth };
  } catch (err) {
    console.error("[jobbank] Fetch/parse error:", err);
    return { postings: [], month: dataMonth };
  }
}

/**
 * High-level summary roll-up: total Alberta postings, Tier-B count,
 * breakdowns by NOC / NAICS sector / city, and a sample of rows.
 *
 * This is the primary function for the MCP tool / HTTP endpoint because
 * returning thousands of raw rows over an API call is wasteful.
 */
export async function fetchJobBankSummary(
  opts: Pick<FetchJobBankOptions, "month" | "province"> = {}
): Promise<JobBankSummary | null> {
  const province = opts.province ?? "Alberta";

  // Fetch all Alberta postings (not just Tier-B) so we can compute totals.
  // The result bundles the authoritative data month — no second CKAN call.
  const { postings: all, month } = await fetchJobBankPostings({
    ...opts,
    province,
    tierBOnly: false,
  });
  if (all.length === 0) return null;

  const tierB = all.filter((r) => !!r.matchedNocCode);

  // NOC breakdown
  const nocMap = new Map<string, { name: string; count: number; vacancies: number }>();
  for (const r of tierB) {
    const key = r.matchedNocCode;
    const entry = nocMap.get(key) ?? { name: r.matchedNocName, count: 0, vacancies: 0 };
    entry.count += 1;
    entry.vacancies += r.vacancyCount;
    nocMap.set(key, entry);
  }
  const byNoc = [...nocMap.entries()]
    .map(([code, { name, count, vacancies }]) => ({ code, name, count, vacancies }))
    .sort((a, b) => b.count - a.count);

  // NAICS sector breakdown
  const sectorMap = new Map<string, number>();
  for (const r of tierB) {
    const s = r.naicsSector || "Not stated";
    sectorMap.set(s, (sectorMap.get(s) ?? 0) + 1);
  }
  const bySector = [...sectorMap.entries()]
    .map(([sector, count]) => ({ sector, count }))
    .sort((a, b) => b.count - a.count);

  // City breakdown
  const cityMap = new Map<string, number>();
  for (const r of tierB) {
    const c = r.city || "Not stated";
    cityMap.set(c, (cityMap.get(c) ?? 0) + 1);
  }
  const byCity = [...cityMap.entries()]
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  return {
    month,
    totalAlbertaPostings: all.length,
    tierBPostings: tierB.length,
    byNoc,
    bySector,
    byCity,
    sampleRows: tierB.slice(0, 10),
  };
}

// ============================================================
// Reader (accumulated jobbank_* tables → summary)
// ============================================================
//
// The MCP tool + HTTP route read from Postgres (populated daily by the
// collector) rather than the live CSV — fast, offline-safe, and it exposes the
// month-over-month momentum that the single live snapshot cannot.

export interface HiringSampleRow {
  jobTitle: string;
  nocCode: string;
  nocName: string;
  city: string;
  naicsSector: string;
  firstPostingDate: string;
  vacancyCount: number;
}

export interface HiringMomentum {
  prevMonth: string;
  prevTierB: number;
  deltaPct: number; // (current - prev) / prev * 100, rounded
}

export interface HiringSummaryDb {
  month: string;
  totalAlbertaPostings: number;
  tierBPostings: number;
  byNoc: { code: string; name: string; count: number; vacancies: number }[];
  bySector: { sector: string; count: number }[];
  byCity: { city: string; count: number }[];
  sampleRows: HiringSampleRow[];
  momentum: HiringMomentum | null;
}

/**
 * Read the stored hiring summary for one month (default: latest stored month).
 * Returns null when no month has been collected yet.
 */
export async function readHiringSummary(
  month?: string,
): Promise<HiringSummaryDb | null> {
  const pool = await getDb();

  const monthRow = month
    ? (
        await pool.query<{
          data_month: string;
          total_alberta_postings: number;
          tier_b_postings: number;
        }>(
          `SELECT data_month, total_alberta_postings, tier_b_postings
             FROM jobbank_monthly WHERE data_month = $1`,
          [month],
        )
      ).rows[0]
    : (
        await pool.query<{
          data_month: string;
          total_alberta_postings: number;
          tier_b_postings: number;
        }>(
          `SELECT data_month, total_alberta_postings, tier_b_postings
             FROM jobbank_monthly ORDER BY data_month DESC LIMIT 1`,
        )
      ).rows[0];

  if (!monthRow) return null;
  const m = monthRow.data_month;

  const byNoc = (
    await pool.query<{ code: string; name: string; count: string; vacancies: string }>(
      `SELECT matched_noc_code AS code, MAX(matched_noc_name) AS name,
              COUNT(*)::INT AS count, COALESCE(SUM(vacancy_count), 0)::INT AS vacancies
         FROM jobbank_postings
        WHERE data_month = $1 AND matched_noc_code <> ''
        GROUP BY matched_noc_code ORDER BY count DESC`,
      [m],
    )
  ).rows.map((r) => ({
    code: r.code,
    name: r.name,
    count: Number(r.count),
    vacancies: Number(r.vacancies),
  }));

  const bySector = (
    await pool.query<{ sector: string; count: string }>(
      `SELECT COALESCE(NULLIF(naics_sector, ''), 'Not stated') AS sector, COUNT(*)::INT AS count
         FROM jobbank_postings WHERE data_month = $1
        GROUP BY 1 ORDER BY count DESC`,
      [m],
    )
  ).rows.map((r) => ({ sector: r.sector, count: Number(r.count) }));

  const byCity = (
    await pool.query<{ city: string; count: string }>(
      `SELECT COALESCE(NULLIF(city, ''), 'Not stated') AS city, COUNT(*)::INT AS count
         FROM jobbank_postings WHERE data_month = $1
        GROUP BY 1 ORDER BY count DESC LIMIT 20`,
      [m],
    )
  ).rows.map((r) => ({ city: r.city, count: Number(r.count) }));

  const sampleRows = (
    await pool.query<{
      job_title: string;
      matched_noc_code: string;
      matched_noc_name: string;
      city: string;
      naics_sector: string;
      first_posting_date: string;
      vacancy_count: number;
    }>(
      `SELECT job_title, matched_noc_code, matched_noc_name, city, naics_sector,
              first_posting_date, vacancy_count
         FROM jobbank_postings WHERE data_month = $1
        ORDER BY first_posting_date DESC LIMIT 10`,
      [m],
    )
  ).rows.map((r) => ({
    jobTitle: r.job_title,
    nocCode: r.matched_noc_code,
    nocName: r.matched_noc_name,
    city: r.city,
    naicsSector: r.naics_sector,
    firstPostingDate: r.first_posting_date,
    vacancyCount: Number(r.vacancy_count),
  }));

  // Month-over-month momentum vs the previous stored month.
  const prev = (
    await pool.query<{ data_month: string; tier_b_postings: number }>(
      `SELECT data_month, tier_b_postings FROM jobbank_monthly
        WHERE data_month < $1 ORDER BY data_month DESC LIMIT 1`,
      [m],
    )
  ).rows[0];

  let momentum: HiringMomentum | null = null;
  if (prev && prev.tier_b_postings > 0) {
    momentum = {
      prevMonth: prev.data_month,
      prevTierB: Number(prev.tier_b_postings),
      deltaPct: Math.round(
        ((monthRow.tier_b_postings - prev.tier_b_postings) / prev.tier_b_postings) * 100,
      ),
    };
  }

  return {
    month: m,
    totalAlbertaPostings: Number(monthRow.total_alberta_postings),
    tierBPostings: Number(monthRow.tier_b_postings),
    byNoc,
    bySector,
    byCity,
    sampleRows,
    momentum,
  };
}
