// Fiscal data sources: Alberta government spending, federal transfers, contracts
// Covers grant disclosure, expenditure by payee, sunshine list, and federal fiscal flows

import { fetchCSV } from "./csv-utils";

// ============================================================
// Constants
// ============================================================

// Alberta Grant Disclosure — CKAN dataset
const AB_GRANTS_DATASET = "grant-disclosure";
const AB_CKAN_BASE = "https://open.alberta.ca/api/3/action";

// Federal Transfer Tables — open.canada.ca
// Major Federal Transfers dataset — CSV with CHT, CST, Equalization by province
const FEDERAL_TRANSFERS_DATASET = "4eee1558-45b7-4484-9336-e692897d393f";
const FED_CKAN_BASE = "https://open.canada.ca/data/api/3/action";

// Federal Proactive Disclosure — Contracts
const FEDERAL_CONTRACTS_DATASET = "d8f85d91-7dec-4fd1-8055-483b77225d8b";

// Federal Proactive Disclosure — Grants & Contributions
const FEDERAL_GRANTS_DATASET = "432527ab-7aac-45b5-81d6-7597107a7013";

// ============================================================
// Interfaces
// ============================================================

export interface GrantRecord {
  fiscalYear: string;
  ministry: string;
  recipient: string;
  program: string;
  amount: number;
  description: string;
}

export interface FederalTransfer {
  year: number;
  province: string;
  transferType: string;
  amount: number;
}

export interface FederalContract {
  vendor: string;
  department: string;
  description: string;
  contractDate: string;
  value: number;
  province: string;
}

export interface FederalGrant {
  recipient: string;
  department: string;
  program: string;
  startDate: string;
  value: number;
  province: string;
}

// ============================================================
// CKAN Resource Discovery
// ============================================================

async function discoverCKANResource(
  base: string,
  datasetId: string,
  format: string = "CSV"
): Promise<string | null> {
  try {
    const res = await fetch(
      `${base}/package_show?id=${datasetId}`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) {
      console.error(
        `[fiscal] CKAN discovery failed for ${datasetId}: ${res.status}`
      );
      return null;
    }
    const data = await res.json();
    const resources: Record<string, string>[] = data?.result?.resources || [];

    // Find most recent resource matching format
    const match = resources.find(
      (r) =>
        (r.format || "").toUpperCase() === format.toUpperCase() &&
        r.url
    );
    return match?.url || null;
  } catch (err) {
    console.error(`[fiscal] CKAN discovery error for ${datasetId}:`, err);
    return null;
  }
}

// ============================================================
// Alberta Grant Disclosure
// ============================================================

export async function fetchAlbertaGrants(
  fiscalYear?: string
): Promise<GrantRecord[]> {
  const csvUrl = await discoverCKANResource(AB_CKAN_BASE, AB_GRANTS_DATASET);
  if (!csvUrl) {
    console.error("[fiscal] No CSV resource found for Alberta grants");
    return [];
  }

  const rows = await fetchCSV(csvUrl, 86400);

  return rows
    .filter((r) => {
      if (fiscalYear) {
        const fy = r["Fiscal Year"] ?? r["fiscal_year"] ?? "";
        return fy.includes(fiscalYear);
      }
      return true;
    })
    .map((r) => ({
      fiscalYear: r["Fiscal Year"] ?? r["fiscal_year"] ?? "",
      ministry: r["Ministry"] ?? r["ministry"] ?? r["Department"] ?? "",
      recipient: r["Recipient"] ?? r["recipient"] ?? r["Payee"] ?? "",
      program: r["Program"] ?? r["program"] ?? "",
      amount:
        parseFloat(
          (r["Amount"] ?? r["amount"] ?? r["Grant Amount"] ?? "0").replace(
            /[,$]/g,
            ""
          )
        ) || 0,
      description: r["Description"] ?? r["description"] ?? "",
    }));
}

// ============================================================
// Federal Transfers to Alberta
// ============================================================

export async function fetchFederalTransfers(): Promise<FederalTransfer[]> {
  const csvUrl = await discoverCKANResource(
    FED_CKAN_BASE,
    FEDERAL_TRANSFERS_DATASET
  );
  if (!csvUrl) {
    console.error("[fiscal] No CSV resource found for federal transfers");
    return [];
  }

  const rows = await fetchCSV(csvUrl, 604800); // Weekly — data changes annually

  return rows
    .filter((r) => {
      const prov =
        r["Province"] ?? r["province"] ?? r["Province/Territory"] ?? "";
      return (
        prov.toLowerCase().includes("alberta") ||
        prov === "AB" ||
        prov === "Alta."
      );
    })
    .map((r) => ({
      year:
        parseInt(
          r["Fiscal Year"] ??
            r["Year"] ??
            r["fiscal_year"] ??
            "0",
          10
        ) || 0,
      province: "Alberta",
      transferType:
        r["Transfer"] ??
        r["transfer_type"] ??
        r["Program"] ??
        r["Type"] ??
        "",
      amount:
        parseFloat(
          (
            r["Amount"] ??
            r["amount"] ??
            r["Amount ($millions)"] ??
            r["Value"] ??
            "0"
          ).replace(/[,$]/g, "")
        ) || 0,
    }));
}

// ============================================================
// Federal Contracts in Alberta
// ============================================================

export async function fetchFederalContractsAB(
  limit: number = 500
): Promise<FederalContract[]> {
  const csvUrl = await discoverCKANResource(
    FED_CKAN_BASE,
    FEDERAL_CONTRACTS_DATASET
  );
  if (!csvUrl) {
    console.error("[fiscal] No CSV resource found for federal contracts");
    return [];
  }

  const rows = await fetchCSV(csvUrl, 86400);

  const abRows = rows.filter((r) => {
    const prov =
      r["province_territory"] ??
      r["Province"] ??
      r["economic_object_province"] ??
      "";
    return (
      prov.toLowerCase().includes("alberta") ||
      prov === "AB"
    );
  });

  return abRows.slice(0, limit).map((r) => ({
    vendor:
      r["vendor_name"] ??
      r["Vendor Name"] ??
      r["vendor"] ??
      "",
    department:
      r["owner_org_title"] ??
      r["Department"] ??
      r["department"] ??
      "",
    description:
      r["description_en"] ??
      r["Description"] ??
      r["description"] ??
      "",
    contractDate:
      r["contract_date"] ??
      r["Contract Date"] ??
      r["start_date"] ??
      "",
    value:
      parseFloat(
        (
          r["contract_value"] ??
          r["original_value"] ??
          r["Value"] ??
          "0"
        ).replace(/[,$]/g, "")
      ) || 0,
    province: "Alberta",
  }));
}

// ============================================================
// Federal Grants & Contributions in Alberta
// ============================================================

export async function fetchFederalGrantsAB(
  limit: number = 500
): Promise<FederalGrant[]> {
  const csvUrl = await discoverCKANResource(
    FED_CKAN_BASE,
    FEDERAL_GRANTS_DATASET
  );
  if (!csvUrl) {
    console.error("[fiscal] No CSV resource found for federal grants");
    return [];
  }

  const rows = await fetchCSV(csvUrl, 86400);

  const abRows = rows.filter((r) => {
    const prov =
      r["province_territory"] ??
      r["Province"] ??
      r["recipient_province"] ??
      "";
    return (
      prov.toLowerCase().includes("alberta") ||
      prov === "AB"
    );
  });

  return abRows.slice(0, limit).map((r) => ({
    recipient:
      r["recipient_legal_name"] ??
      r["Recipient"] ??
      r["recipient"] ??
      "",
    department:
      r["owner_org_title"] ??
      r["Department"] ??
      r["department"] ??
      "",
    program:
      r["prog_name_en"] ??
      r["Program"] ??
      r["program"] ??
      "",
    startDate:
      r["agreement_start_date"] ??
      r["Start Date"] ??
      r["start_date"] ??
      "",
    value:
      parseFloat(
        (
          r["agreement_value"] ??
          r["total_funding_amount"] ??
          r["Value"] ??
          "0"
        ).replace(/[,$]/g, "")
      ) || 0,
    province: "Alberta",
  }));
}
