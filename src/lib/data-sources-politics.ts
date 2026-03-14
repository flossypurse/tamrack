// Political data sources: Represent API, OpenParliament, Elections Canada
// Covers elected officials, parliamentary activity, and election results

import { fetchCSV } from "./csv-utils";

// ============================================================
// Constants
// ============================================================

const REPRESENT_BASE = "https://represent.opennorth.ca";
const OPENPARLIAMENT_BASE = "https://api.openparliament.ca";

// Elections Canada 44th General Election (2021) poll-by-poll results
const ELECTIONS_CANADA_44_RESULTS =
  "https://www.elections.ca/res/rep/off/ovr2021app/53/data_donnees/pollresults_resultatsbureauCanada.csv";

// Elections Canada political contributions (ODA)
const ELECTIONS_CANADA_CONTRIBUTIONS =
  "https://www.elections.ca/fin/oda/oda_2024.zip"; // annual ZIP — we'll use the CKAN CSV instead

// ============================================================
// Interfaces
// ============================================================

export interface ElectedOfficial {
  name: string;
  party: string;
  district: string;
  email: string;
  url: string;
  photoUrl: string;
  office: string;
}

export interface ElectoralDistrict {
  name: string;
  id: string;
  boundaryUrl: string;
}

export interface FederalMP {
  name: string;
  party: string;
  riding: string;
  province: string;
  email: string;
  url: string;
  photoUrl: string;
}

export interface ParliamentVote {
  url: string;
  session: string;
  number: number;
  date: string;
  yea: number;
  nay: number;
  paired: number;
  result: string;
  billUrl: string;
  description: string;
}

export interface ParliamentDebate {
  url: string;
  date: string;
  speaker: string;
  topic: string;
  content: string;
}

export interface ElectionRidingResult {
  electoralDistrict: string;
  electoralDistrictNumber: number;
  party: string;
  candidate: string;
  votes: number;
  voteShare: number;
  elected: boolean;
}

export interface PoliticalContribution {
  year: number;
  party: string;
  contributor: string;
  contributorType: string;
  amount: number;
  province: string;
}

// ============================================================
// Represent API — Alberta MLAs (moved from data-sources.ts)
// ============================================================

export async function fetchAlbertaMLAs(): Promise<ElectedOfficial[]> {
  try {
    const res = await fetch(
      `${REPRESENT_BASE}/representatives/alberta-legislature/?format=json&limit=100`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const objects = data?.objects || [];
    return objects.map((o: Record<string, unknown>) => ({
      name: String(o.name || ""),
      party: String(o.party_name || ""),
      district: String(o.district_name || ""),
      email: String(o.email || ""),
      url: String(o.url || o.personal_url || ""),
      photoUrl: String(o.photo_url || ""),
      office: String(o.elected_office || "MLA"),
    }));
  } catch {
    return [];
  }
}

// ============================================================
// Represent API — Alberta Electoral Districts (moved from data-sources.ts)
// ============================================================

export async function fetchAlbertaElectoralDistricts(): Promise<
  ElectoralDistrict[]
> {
  try {
    const res = await fetch(
      `${REPRESENT_BASE}/boundaries/alberta-electoral-districts-2017/?format=json&limit=100`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const objects = data?.objects || [];
    return objects.map((o: Record<string, unknown>) => ({
      name: String(o.name || ""),
      id: String(o.external_id || o.slug || ""),
      boundaryUrl: String(o.url || ""),
    }));
  } catch {
    return [];
  }
}

// ============================================================
// Represent API — Alberta Federal MPs (NEW)
// ============================================================

export async function fetchAlbertaFederalMPs(): Promise<FederalMP[]> {
  try {
    // Represent API supports filtering by boundary set; fetch all House of Commons reps
    // and filter to Alberta
    const res = await fetch(
      `${REPRESENT_BASE}/representatives/house-of-commons/?format=json&limit=500`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) {
      console.error(`[politics] Federal MPs fetch failed: ${res.status}`);
      return [];
    }
    const data = await res.json();
    const objects: Record<string, unknown>[] = data?.objects || [];

    return objects
      .filter((o) => {
        const prov = String(o.province || "").toLowerCase();
        return prov === "alberta" || prov === "ab";
      })
      .map((o) => ({
        name: String(o.name || ""),
        party: String(o.party_name || ""),
        riding: String(o.district_name || ""),
        province: "Alberta",
        email: String(o.email || ""),
        url: String(o.url || o.personal_url || ""),
        photoUrl: String(o.photo_url || ""),
      }));
  } catch (err) {
    console.error("[politics] Federal MPs fetch error:", err);
    return [];
  }
}

// ============================================================
// OpenParliament — Recent Votes (with pagination)
// ============================================================

export async function fetchParliamentVotes(
  limit: number = 50
): Promise<ParliamentVote[]> {
  try {
    const votes: ParliamentVote[] = [];
    let url = `${OPENPARLIAMENT_BASE}/votes/?format=json&limit=${Math.min(limit, 100)}`;

    while (url && votes.length < limit) {
      const res = await fetch(url, {
        next: { revalidate: 3600 },
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        console.error(`[politics] Parliament votes fetch failed: ${res.status}`);
        break;
      }
      const data = await res.json();
      const objects: Record<string, unknown>[] = data?.objects || [];

      for (const v of objects) {
        votes.push({
          url: String(v.url || ""),
          session: String(v.session || ""),
          number: Number(v.number || 0),
          date: String(v.date || ""),
          yea: Number(v.yea_total || 0),
          nay: Number(v.nay_total || 0),
          paired: Number(v.paired_total || 0),
          result: String(v.result || ""),
          billUrl: String(v.bill_url || ""),
          description: String(v.description?.en || v.description || ""),
        });
      }

      // Follow pagination
      const nextUrl = data?.pagination?.next_url;
      if (nextUrl && votes.length < limit) {
        url = nextUrl.startsWith("http")
          ? nextUrl
          : `${OPENPARLIAMENT_BASE}${nextUrl}`;
      } else {
        break;
      }
    }

    return votes.slice(0, limit);
  } catch (err) {
    console.error("[politics] Parliament votes fetch error:", err);
    return [];
  }
}

// ============================================================
// OpenParliament — Debates Mentioning Alberta
// ============================================================

export async function fetchAlbertaDebates(
  limit: number = 30
): Promise<ParliamentDebate[]> {
  try {
    const res = await fetch(
      `${OPENPARLIAMENT_BASE}/search/?q=Alberta&format=json&limit=${Math.min(limit, 100)}`,
      {
        next: { revalidate: 3600 },
        headers: { Accept: "application/json" },
      }
    );
    if (!res.ok) {
      console.error(`[politics] Alberta debates fetch failed: ${res.status}`);
      return [];
    }
    const data = await res.json();
    const objects: Record<string, unknown>[] = data?.objects || [];

    return objects.map((d) => ({
      url: String(d.url || ""),
      date: String(d.date || ""),
      speaker: String(
        (d.politician as Record<string, unknown>)?.name ||
          d.politician_name ||
          ""
      ),
      topic: String(d.topic || d.heading || ""),
      content: String(d.content || d.text || "").slice(0, 500),
    }));
  } catch (err) {
    console.error("[politics] Alberta debates fetch error:", err);
    return [];
  }
}

// ============================================================
// Elections Canada — 44th GE Results for Alberta (CSV)
// ============================================================

export async function fetchFederalElectionResultsAB(): Promise<
  ElectionRidingResult[]
> {
  // The full poll-by-poll CSV is very large.
  // We aggregate to riding-level: sum votes per candidate per riding.
  const rows = await fetchCSV(ELECTIONS_CANADA_44_RESULTS, 604800);

  // Filter to Alberta (province code 48, or province name contains Alberta)
  const abRows = rows.filter((r) => {
    const prov =
      r["Province"] ??
      r["Electoral District Name/Nom de circonscription"] ??
      "";
    const provCode = r["Province Code"] ?? r["Province_Code"] ?? "";
    return (
      provCode === "48" ||
      prov.toLowerCase().includes("alberta")
    );
  });

  // Aggregate votes by riding + candidate
  const key = (r: Record<string, string>) =>
    `${r["Electoral District Number/Numéro de la circonscription"] || r["Electoral_District_Number"] || ""}-${r["Candidate/Candidat"] || r["Candidate"] || ""}`;

  const agg = new Map<
    string,
    { district: string; districtNum: number; party: string; candidate: string; votes: number; elected: boolean }
  >();

  for (const r of abRows) {
    const k = key(r);
    const existing = agg.get(k);
    const votes =
      parseInt(
        r["Votes Obtained/Votes obtenus"] ??
          r["Votes_Obtained"] ??
          r["Votes"] ??
          "0",
        10
      ) || 0;
    const elected =
      (r["Elected Candidate/Candidat élu"] ?? r["Elected"] ?? "")
        .toLowerCase()
        .startsWith("y") ||
      (r["Elected Candidate/Candidat élu"] ?? r["Elected"] ?? "") === "*";

    if (existing) {
      existing.votes += votes;
      if (elected) existing.elected = true;
    } else {
      agg.set(k, {
        district:
          r["Electoral District Name/Nom de circonscription"] ??
          r["Electoral_District_Name"] ??
          "",
        districtNum:
          parseInt(
            r["Electoral District Number/Numéro de la circonscription"] ??
              r["Electoral_District_Number"] ??
              "0",
            10
          ) || 0,
        party:
          r["Political Affiliation Name_English/Appartenance politique_Anglais"] ??
          r["Political_Affiliation"] ??
          r["Party"] ??
          "",
        candidate:
          r["Candidate/Candidat"] ?? r["Candidate"] ?? "",
        votes,
        elected,
      });
    }
  }

  // Calculate vote share per riding
  const byRiding = new Map<number, number>();
  for (const v of agg.values()) {
    byRiding.set(
      v.districtNum,
      (byRiding.get(v.districtNum) ?? 0) + v.votes
    );
  }

  return Array.from(agg.values()).map((v) => ({
    electoralDistrict: v.district,
    electoralDistrictNumber: v.districtNum,
    party: v.party,
    candidate: v.candidate,
    votes: v.votes,
    voteShare: byRiding.get(v.districtNum)
      ? (v.votes / byRiding.get(v.districtNum)!) * 100
      : 0,
    elected: v.elected,
  }));
}

// ============================================================
// Elections Canada — Political Contributions (Alberta donors)
// Uses open.canada.ca CKAN for the contributions CSV
// ============================================================

const CONTRIBUTIONS_DATASET_ID = "024f51fb-3b1f-4fad-94d0-4dad9d9e0c84";

export async function fetchElectionsCanadaContributions(): Promise<
  PoliticalContribution[]
> {
  try {
    // Step 1: Discover the latest CSV resource via CKAN
    const metaRes = await fetch(
      `https://open.canada.ca/data/api/3/action/package_show?id=${CONTRIBUTIONS_DATASET_ID}`,
      { next: { revalidate: 86400 } }
    );
    if (!metaRes.ok) {
      console.error(
        `[politics] CKAN contributions metadata failed: ${metaRes.status}`
      );
      return [];
    }
    const meta = await metaRes.json();
    const resources: Record<string, string>[] = meta?.result?.resources || [];

    // Find most recent CSV resource
    const csvResource = resources.find(
      (r) =>
        (r.format || "").toUpperCase() === "CSV" &&
        (r.url || "").endsWith(".csv")
    );
    if (!csvResource?.url) {
      console.error("[politics] No CSV resource found for contributions dataset");
      return [];
    }

    // Step 2: Fetch and parse the CSV
    const rows = await fetchCSV(csvResource.url, 86400);

    // Filter to Alberta
    return rows
      .filter((r) => {
        const prov =
          r["Province/Territory"] ??
          r["Province"] ??
          r["Prov"] ??
          "";
        return prov.toLowerCase().includes("alberta") || prov === "AB";
      })
      .map((r) => ({
        year:
          parseInt(r["Fiscal Year"] ?? r["Year"] ?? r["Date"] ?? "0", 10) || 0,
        party:
          r["Political Party of Recipient"] ??
          r["Party"] ??
          r["Recipient"] ??
          "",
        contributor: r["Contributor Name"] ?? r["Name"] ?? "",
        contributorType:
          r["Contributor Type"] ?? r["Type"] ?? "",
        amount:
          parseFloat(
            r["Monetary Amount"] ??
              r["Amount"] ??
              r["Contribution Amount"] ??
              "0"
          ) || 0,
        province: "Alberta",
      }));
  } catch (err) {
    console.error("[politics] Elections Canada contributions error:", err);
    return [];
  }
}
