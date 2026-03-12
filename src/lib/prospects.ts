/**
 * Province-wide Prospect Lead Generator
 *
 * Registry-driven: iterates all live municipalities based on their capabilities.
 * Socrata cities (Edmonton, Calgary) get rich SoQL aggregate queries.
 * ArcGIS municipalities get endpoint-driven queries via field mappings.
 */

import {
  fetchEdmontonData,
  EDMONTON_DATASETS,
  fetchSprucGroveDevelopmentStages,
} from "./data-sources";
import {
  getLiveMunicipalities,
  type MunicipalityConfig,
} from "./municipality-registry";

// ============================================================
// Types
// ============================================================

export interface ProspectLead {
  id: string;
  type:
    | "equity-gold"
    | "teardown"
    | "vacant-lot"
    | "reno-complete"
    | "new-neighbourhood"
    | "dev-permit-surge";
  priority: "hot" | "warm" | "watch";
  municipality: string;
  region: string;
  location: string;
  headline: string;
  reason: string;
  suggestedAction: string;
  keyNumbers: Record<string, string>;
}

// ============================================================
// Internal helpers
// ============================================================

async function fetchArcGIS(
  url: string,
  params: Record<string, string>
): Promise<Record<string, unknown>[]> {
  const searchParams = new URLSearchParams({ f: "json", ...params });
  const res = await fetch(`${url}/query?${searchParams.toString()}`, {
    next: { revalidate: 3600 },
  });
  const data = await res.json();
  if (!data?.features) return [];
  return data.features.map(
    (f: { attributes: Record<string, unknown> }) => f.attributes
  );
}

// Calgary Socrata (same API pattern as Edmonton)
const CALGARY_BASE = "https://data.calgary.ca/resource";
const CALGARY_DATASETS = {
  BUILDING_PERMITS: "c2es-76ed",
  PROPERTY_ASSESSMENTS: "4bsw-nn7w",
  BUSINESS_LICENCES: "vdjc-pybd",
  DEVELOPMENT_PERMITS: "6933-unw5",
} as const;

async function fetchCalgaryData(
  datasetId: string,
  params?: Record<string, string>
): Promise<unknown[]> {
  const url = new URL(`${CALGARY_BASE}/${datasetId}.json`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n.toLocaleString()}`;
}

function pct(n: number): string {
  return `${Math.round(n)}%`;
}

function prioritySort(a: ProspectLead, b: ProspectLead): number {
  const order = { hot: 0, warm: 1, watch: 2 };
  return order[a.priority] - order[b.priority];
}

function regionLabel(region: string): string {
  const labels: Record<string, string> = {
    "edmonton-metro": "Edmonton Metro",
    "calgary-metro": "Calgary Metro",
    central: "Central Alberta",
    south: "Southern Alberta",
    north: "Northern Alberta",
    northwest: "Northwestern Alberta",
    northeast: "Northeastern Alberta",
  };
  return labels[region] || region;
}

// ============================================================
// Lead Type 1: Sellers Sitting on Gold
// Municipalities with both assessment AND sale price data
// Currently: Stony Plain (parcels), Strathmore (assessments)
// ============================================================

async function findEquityForArcGIS(
  config: MunicipalityConfig
): Promise<ProspectLead[]> {
  const endpoint = config.endpoints.parcels || config.endpoints.assessments;
  if (!endpoint) return [];

  const valueField = config.fields.assessmentValue!;
  const salePriceField = config.fields.salePrice!;
  const addressField = config.fields.address || "ADDRESS";
  const zoningField = config.fields.zoning || "";
  const yearBuiltField = config.fields.yearBuilt || "";
  const acreageField = config.fields.acreage || "";

  const outFields = [
    addressField,
    valueField,
    salePriceField,
    zoningField,
    yearBuiltField,
    acreageField,
  ]
    .filter(Boolean)
    .join(",");

  try {
    const data = await fetchArcGIS(endpoint.url, {
      where: `${valueField} > 0 AND ${salePriceField} > 50000`,
      outFields,
      returnGeometry: "false",
      resultRecordCount: "3000",
    });

    const leads: ProspectLead[] = [];

    for (const row of data) {
      const address = String(row[addressField] || "").trim();
      const assessment = Number(row[valueField] || 0);
      const salePrice = Number(row[salePriceField] || 0);
      const yearBuilt = yearBuiltField ? Number(row[yearBuiltField] || 0) : 0;
      const zoning = zoningField ? String(row[zoningField] || "") : "";
      const acreage = acreageField ? Number(row[acreageField] || 0) : 0;

      if (salePrice <= 0 || assessment <= 0 || !address) continue;

      const equityGap = assessment - salePrice;
      const equityPct = (equityGap / salePrice) * 100;

      if (equityPct < 15 || equityGap < 30000) continue;

      let priority: ProspectLead["priority"];
      if (equityPct > 40 && equityGap > 80000) priority = "hot";
      else if (equityPct > 25 || equityGap > 60000) priority = "warm";
      else priority = "watch";

      leads.push({
        id: `equity-${config.slug}-${address}`,
        type: "equity-gold",
        priority,
        municipality: config.name,
        region: regionLabel(config.region),
        location: address,
        headline: `This property gained ${fmt(equityGap)} since last sale (${pct(equityPct)} increase)`,
        reason:
          equityPct > 40
            ? `Assessment is now ${fmt(assessment)} but last sale was only ${fmt(salePrice)}. Owner has massive equity — they may be ready to cash out, trade up, or downsize.`
            : `Assessment climbed to ${fmt(assessment)} from a ${fmt(salePrice)} purchase. Solid equity growth — a potential move-up buyer if they know what their home is worth.`,
        suggestedAction:
          priority === "hot"
            ? `Door knock or mailer — "Did you know your home has gained ${fmt(equityGap)} in value? Here's what that means for your next move."`
            : `Add to mailer campaign — equity growth awareness.`,
        keyNumbers: {
          "Last Sale": fmt(salePrice),
          "Current Assessment": fmt(assessment),
          "Equity Gain": fmt(equityGap),
          ...(yearBuilt > 0 ? { "Year Built": String(yearBuilt) } : {}),
          ...(acreage > 0.1 ? { Acreage: acreage.toFixed(2) } : {}),
          ...(zoning ? { Zoning: zoning } : {}),
        },
      });
    }

    return leads.sort(prioritySort).slice(0, 30);
  } catch {
    return [];
  }
}

export async function findEquityGoldSellers(): Promise<ProspectLead[]> {
  // Find all municipalities with both assessment value and sale price fields
  const equityMunis = getLiveMunicipalities().filter(
    (m) =>
      m.fields.salePrice &&
      m.fields.assessmentValue &&
      (m.endpoints.parcels || m.endpoints.assessments)
  );

  const results = await Promise.all(
    equityMunis.map((m) => findEquityForArcGIS(m))
  );

  return results.flat().sort(prioritySort).slice(0, 50);
}

// ============================================================
// Lead Type 2: Teardown & Redevelopment Targets
// Edmonton (SODA — neighbourhood_classification) + Calgary (Socrata dev permits)
// ============================================================

async function findEdmontonTeardowns(): Promise<ProspectLead[]> {
  try {
    const [devPermits, assessments] = await Promise.all([
      fetchEdmontonData(EDMONTON_DATASETS.DEVELOPMENT_PERMITS, {
        $query: `SELECT address, neighbourhood, neighbourhood_classification, description_of_development, permit_date, status WHERE permit_date > '2024-06-01' AND neighbourhood_classification = 'Redeveloping' AND address IS NOT NULL ORDER BY permit_date DESC LIMIT 200`,
      }).catch(() => []),
      fetchEdmontonData(EDMONTON_DATASETS.PROPERTY_ASSESSMENTS, {
        $query: `SELECT neighbourhood, count(*) as cnt, avg(assessed_value::number) as avg_val WHERE tax_class='Residential' AND neighbourhood IS NOT NULL GROUP BY neighbourhood HAVING count(*) > 20`,
      }).catch(() => []),
    ]);

    const assessMap = new Map<string, number>();
    for (const row of assessments as {
      neighbourhood: string;
      avg_val: string;
    }[]) {
      assessMap.set(
        row.neighbourhood,
        Math.round(parseFloat(row.avg_val || "0"))
      );
    }

    const hoodCounts = new Map<string, number>();
    for (const p of devPermits as { neighbourhood: string }[]) {
      const hood = p.neighbourhood;
      hoodCounts.set(hood, (hoodCounts.get(hood) || 0) + 1);
    }

    const leads: ProspectLead[] = [];
    const seenAddresses = new Set<string>();

    for (const row of devPermits as {
      address: string;
      neighbourhood: string;
      description_of_development: string;
      permit_date: string;
      status: string;
    }[]) {
      const address = row.address?.trim();
      if (!address || seenAddresses.has(address)) continue;
      seenAddresses.add(address);

      const hood = row.neighbourhood;
      const avgAssessment = assessMap.get(hood) || 0;
      const hoodPermitCount = hoodCounts.get(hood) || 0;
      const desc = row.description_of_development || "";
      const date = row.permit_date?.split("T")[0] || "";

      let priority: ProspectLead["priority"];
      if (hoodPermitCount > 10 && avgAssessment > 0 && avgAssessment < 400000)
        priority = "hot";
      else if (hoodPermitCount > 5) priority = "warm";
      else priority = "watch";

      const isResidential =
        desc.toLowerCase().includes("residential") ||
        desc.toLowerCase().includes("dwelling") ||
        desc.toLowerCase().includes("house");

      leads.push({
        id: `teardown-edm-${address}`,
        type: "teardown",
        priority,
        municipality: "Edmonton",
        region: "Edmonton Metro",
        location: `${address}, ${hood}`,
        headline: isResidential
          ? `Active redevelopment — ${hoodPermitCount} dev permits in ${hood} this year`
          : `Development permit filed in redeveloping area (${hood})`,
        reason:
          avgAssessment > 0
            ? `${hood} is classified as "Redeveloping" with ${hoodPermitCount} active dev permits. Average home assessment is ${fmt(avgAssessment)} — developers are buying here because the land is worth more than the structures.`
            : `${hood} is actively redeveloping with ${hoodPermitCount} dev permits filed. Older homes in this area are being replaced — owners may want to sell before or during the wave.`,
        suggestedAction:
          priority === "hot"
            ? `Target nearby homeowners — "Your neighbourhood is transforming. Homes on your street sold to developers for above asking. Want a free valuation?"`
            : `Add ${hood} to watchlist — monitor for listing opportunities as redevelopment accelerates.`,
        keyNumbers: {
          Neighbourhood: hood,
          "Dev Permits": String(hoodPermitCount),
          ...(avgAssessment > 0
            ? { "Avg Assessment": fmt(avgAssessment) }
            : {}),
          "Permit Date": date,
          Status: row.status || "Unknown",
        },
      });
    }

    return leads;
  } catch {
    return [];
  }
}

async function findCalgaryTeardowns(): Promise<ProspectLead[]> {
  try {
    // Calgary dev permits — find communities with high activity
    const [devPermits, assessments] = await Promise.all([
      fetchCalgaryData(CALGARY_DATASETS.DEVELOPMENT_PERMITS, {
        $query: `SELECT communityname, count(*) as cnt WHERE applieddate > '2024-06-01' AND communityname IS NOT NULL GROUP BY communityname ORDER BY cnt DESC LIMIT 30`,
      }).catch(() => []),
      fetchCalgaryData(CALGARY_DATASETS.PROPERTY_ASSESSMENTS, {
        $query: `SELECT comm_name, count(*) as cnt, avg(assessed_value) as avg_val WHERE assessment_class = 'Residential' AND comm_name IS NOT NULL GROUP BY comm_name HAVING count(*) > 20`,
      }).catch(() => []),
    ]);

    if (!Array.isArray(devPermits)) return [];

    const assessMap = new Map<string, number>();
    if (Array.isArray(assessments)) {
      for (const row of assessments as {
        comm_name: string;
        avg_val: string;
      }[]) {
        assessMap.set(
          row.comm_name?.toUpperCase(),
          Math.round(parseFloat(row.avg_val || "0"))
        );
      }
    }

    const leads: ProspectLead[] = [];

    for (const row of devPermits as {
      communityname: string;
      cnt: string;
    }[]) {
      const community = row.communityname;
      const permitCount = parseInt(row.cnt || "0");
      if (permitCount < 5 || !community) continue;

      const avgAssessment =
        assessMap.get(community.toUpperCase()) || 0;

      let priority: ProspectLead["priority"];
      if (permitCount > 20 && avgAssessment > 0 && avgAssessment < 500000)
        priority = "hot";
      else if (permitCount > 10) priority = "warm";
      else priority = "watch";

      leads.push({
        id: `teardown-cal-${community}`,
        type: "teardown",
        priority,
        municipality: "Calgary",
        region: "Calgary Metro",
        location: community,
        headline: `${permitCount} development permits filed in ${community}`,
        reason:
          avgAssessment > 0
            ? `${community} has ${permitCount} active dev permits. Average residential assessment is ${fmt(avgAssessment)}. High permit activity with moderate assessments signals transformation — land is becoming more valuable than existing structures.`
            : `${community} has ${permitCount} active dev permits. Concentrated development activity indicates neighbourhood transformation — sellers may be sitting on undervalued land.`,
        suggestedAction:
          priority === "hot"
            ? `Door knock in ${community} — "Developers are buying on your street. Want to know what your lot is worth?"`
            : `Add ${community} to your Calgary watchlist — development activity is building.`,
        keyNumbers: {
          Community: community,
          "Dev Permits": String(permitCount),
          ...(avgAssessment > 0
            ? { "Avg Assessment": fmt(avgAssessment) }
            : {}),
        },
      });
    }

    return leads;
  } catch {
    return [];
  }
}

export async function findTeardownTargets(): Promise<ProspectLead[]> {
  const [edmonton, calgary] = await Promise.all([
    findEdmontonTeardowns(),
    findCalgaryTeardowns(),
  ]);

  return [...edmonton, ...calgary].sort(prioritySort).slice(0, 40);
}

// ============================================================
// Lead Type 3: Vacant Lot Opportunities
// Registry-driven: any municipality with vacantLots endpoint or
// parcels with propertyClass that can filter for vacant land
// ============================================================

async function findVacantForMunicipality(
  config: MunicipalityConfig
): Promise<ProspectLead[]> {
  // Dedicated vacant lots endpoint
  if (config.endpoints.vacantLots) {
    return findVacantFromEndpoint(config);
  }
  // Parcels with propertyClass filter
  if (config.endpoints.parcels && config.fields.propertyClass) {
    return findVacantFromParcels(config);
  }
  return [];
}

async function findVacantFromEndpoint(
  config: MunicipalityConfig
): Promise<ProspectLead[]> {
  const endpoint = config.endpoints.vacantLots!;
  const zoningField =
    config.fields.vacantZoning || config.fields.zoning || "ZONING";
  const assessField =
    config.fields.vacantAssessment || config.fields.assessmentValue || "";
  const addressField = config.fields.address || "";

  const outFields = [zoningField, assessField, addressField, "Shape__Area", "LGLPL"]
    .filter(Boolean)
    .join(",");

  try {
    const data = await fetchArcGIS(endpoint.url, {
      where: "1=1",
      outFields,
      returnGeometry: "false",
      resultRecordCount: "500",
    });

    const leads: ProspectLead[] = [];

    for (const row of data) {
      const zoning = String(row[zoningField] || "").trim();
      const assessment = assessField ? Number(row[assessField] || 0) : 0;
      const legalPlan = String(row["LGLPL"] || "").trim();
      const address = addressField ? String(row[addressField] || "").trim() : "";
      const area = Number(row["Shape__Area"] || 0);
      const areaSqFt = Math.round(area * 10.764);

      const isResidential =
        zoning.startsWith("R") ||
        zoning.toLowerCase().includes("residential");

      let priority: ProspectLead["priority"];
      if (isResidential && assessment > 0 && assessment < 200000)
        priority = "hot";
      else if (isResidential) priority = "warm";
      else priority = "watch";

      const location = address || legalPlan ? `Plan ${legalPlan}` : `${zoning} lot`;

      leads.push({
        id: `vacant-${config.slug}-${legalPlan || address || Math.random().toString(36).slice(2)}`,
        type: "vacant-lot",
        priority,
        municipality: config.name,
        region: regionLabel(config.region),
        location,
        headline: isResidential
          ? `Vacant residential lot — ${zoning} zoning${assessment > 0 ? `, assessed at ${fmt(assessment)}` : ""}`
          : `Vacant ${zoning} lot available`,
        reason: isResidential
          ? `Ready-to-build residential lot in ${config.name}. Builders and investors are looking for serviced lots in growing communities.`
          : `${zoning}-zoned vacant lot. Could suit commercial development or mixed-use depending on municipal plans.`,
        suggestedAction: isResidential
          ? `Connect with local builders — match this lot with a buyer. Or pitch to investor clients as a spec build opportunity.`
          : `Research municipal development plans for this area. Could be valuable to the right commercial buyer.`,
        keyNumbers: {
          Zoning: zoning,
          ...(assessment > 0 ? { Assessment: fmt(assessment) } : {}),
          ...(areaSqFt > 0
            ? { Size: `${areaSqFt.toLocaleString()} sq ft` }
            : {}),
        },
      });
    }

    return leads.sort(prioritySort);
  } catch {
    return [];
  }
}

async function findVacantFromParcels(
  config: MunicipalityConfig
): Promise<ProspectLead[]> {
  const endpoint = config.endpoints.parcels!;
  const classField = config.fields.propertyClass!;
  const addressField = config.fields.address || "";
  const subdivisionField = config.fields.subdivision || "";

  // Build a vacancy filter — different municipalities use different terms
  const vacantTerms = [
    "VACANT RESIDENTIAL LAND",
    "VACANT COMMERCIAL LAND",
    "VACANT",
    "Vacant",
  ];
  const whereClause = vacantTerms
    .map((t) => `${classField} = '${t}'`)
    .join(" OR ");

  const outFields = [classField, addressField, subdivisionField]
    .filter(Boolean)
    .join(",");

  try {
    const data = await fetchArcGIS(endpoint.url, {
      where: whereClause,
      outFields,
      returnGeometry: "false",
      resultRecordCount: "500",
    });

    if (data.length === 0) return [];

    const leads: ProspectLead[] = [];

    for (const row of data) {
      const type = String(row[classField] || "").trim();
      const address = addressField
        ? String(row[addressField] || "").trim()
        : "";
      const subdivision = subdivisionField
        ? String(row[subdivisionField] || "").trim()
        : "";

      const isResidential = type.toUpperCase().includes("RESIDENTIAL");

      leads.push({
        id: `vacant-${config.slug}-${address || Math.random().toString(36).slice(2)}`,
        type: "vacant-lot",
        priority: isResidential ? "warm" : "watch",
        municipality: config.name,
        region: regionLabel(config.region),
        location: address || `${subdivision} (${type})`,
        headline: `Vacant ${isResidential ? "residential" : "commercial"} lot in ${subdivision || config.name}`,
        reason: isResidential
          ? `Vacant residential lot in ${subdivision || config.name}. Growing communities need new homes — serviced lots are in demand.`
          : `Vacant commercial lot — potential for retail, office, or mixed-use development.`,
        suggestedAction: `Contact lot owner about listing. Vacant lots in growing communities sell to builders looking for their next project.`,
        keyNumbers: {
          Type: type,
          ...(subdivision ? { Subdivision: subdivision } : {}),
          Municipality: config.name,
        },
      });
    }

    return leads.sort(prioritySort);
  } catch {
    return [];
  }
}

export async function findVacantLotOpportunities(): Promise<ProspectLead[]> {
  // Find municipalities with vacant lot data or parcels with property class
  const vacantMunis = getLiveMunicipalities().filter(
    (m) =>
      m.endpoints.vacantLots ||
      (m.endpoints.parcels && m.fields.propertyClass)
  );

  const results = await Promise.all(
    vacantMunis.map((m) => findVacantForMunicipality(m))
  );

  return results.flat().sort(prioritySort).slice(0, 50);
}

// ============================================================
// Lead Type 4: Renovation-Complete Homes
// Edmonton (SODA) + Calgary (Socrata) — high-value reno permits
// ============================================================

async function findEdmontonRenovations(): Promise<ProspectLead[]> {
  try {
    const data = await fetchEdmontonData(EDMONTON_DATASETS.BUILDING_PERMITS, {
      $query: `SELECT address, neighbourhood, construction_value, job_description, issue_date WHERE job_category='Home Improvement' AND construction_value > 50000 AND issue_date > '2024-06-01' AND address IS NOT NULL ORDER BY construction_value DESC LIMIT 100`,
    });

    if (!Array.isArray(data)) return [];

    const leads: ProspectLead[] = [];
    const seenAddresses = new Set<string>();

    for (const row of data as {
      address: string;
      neighbourhood: string;
      construction_value: string;
      job_description: string;
      issue_date: string;
    }[]) {
      const address = row.address?.trim();
      if (!address || seenAddresses.has(address)) continue;
      seenAddresses.add(address);

      const renoValue = parseInt(row.construction_value || "0");
      const hood = row.neighbourhood || "";
      const desc = row.job_description || "";
      const date = row.issue_date?.split("T")[0] || "";

      let priority: ProspectLead["priority"];
      if (renoValue > 200000) priority = "hot";
      else if (renoValue > 100000) priority = "warm";
      else priority = "watch";

      const isMajor = renoValue > 150000;

      leads.push({
        id: `reno-edm-${address}`,
        type: "reno-complete",
        priority,
        municipality: "Edmonton",
        region: "Edmonton Metro",
        location: `${address}, ${hood}`,
        headline: isMajor
          ? `Major renovation (${fmt(renoValue)}) — likely preparing to sell or just upgraded`
          : `${fmt(renoValue)} renovation completed — owner investing in their home`,
        reason: isMajor
          ? `A ${fmt(renoValue)} renovation is significant — often a sign the owner is about to list (renovate-to-sell). Or, neighbours see the upgrades and start thinking about their own home's value.`
          : `${fmt(renoValue)} home improvement in ${hood}. This homeowner is investing — they either love the neighbourhood (referral potential) or are prepping to sell.`,
        suggestedAction: isMajor
          ? `Check MLS for this address. If not listed, door knock — "I noticed the renovation. Are you planning to sell? I have buyers looking in ${hood}."`
          : `Door knock neighbours — "Your neighbour just invested ${fmt(renoValue)} in their home. Want to know what that means for your property value?"`,
        keyNumbers: {
          "Reno Value": fmt(renoValue),
          Neighbourhood: hood,
          "Permit Date": date,
          ...(desc ? { Type: desc.slice(0, 50) } : {}),
        },
      });
    }

    return leads;
  } catch {
    return [];
  }
}

async function findCalgaryRenovations(): Promise<ProspectLead[]> {
  try {
    const data = await fetchCalgaryData(CALGARY_DATASETS.BUILDING_PERMITS, {
      $query: `SELECT originaladdress, communityname, estprojectcost, description, issueddate WHERE workclassgroup = 'Improvement' AND estprojectcost > 50000 AND issueddate > '2024-06-01' AND originaladdress IS NOT NULL ORDER BY estprojectcost DESC LIMIT 100`,
    });

    if (!Array.isArray(data)) return [];

    const leads: ProspectLead[] = [];
    const seenAddresses = new Set<string>();

    for (const row of data as {
      originaladdress: string;
      communityname: string;
      estprojectcost: string;
      description: string;
      issueddate: string;
    }[]) {
      const address = row.originaladdress?.trim();
      if (!address || seenAddresses.has(address)) continue;
      seenAddresses.add(address);

      const renoValue = parseInt(row.estprojectcost || "0");
      const community = row.communityname || "";
      const desc = row.description || "";
      const date = row.issueddate?.split("T")[0] || "";

      let priority: ProspectLead["priority"];
      if (renoValue > 200000) priority = "hot";
      else if (renoValue > 100000) priority = "warm";
      else priority = "watch";

      const isMajor = renoValue > 150000;

      leads.push({
        id: `reno-cal-${address}`,
        type: "reno-complete",
        priority,
        municipality: "Calgary",
        region: "Calgary Metro",
        location: `${address}, ${community}`,
        headline: isMajor
          ? `Major renovation (${fmt(renoValue)}) — likely preparing to sell or just upgraded`
          : `${fmt(renoValue)} renovation completed — owner investing in their home`,
        reason: isMajor
          ? `A ${fmt(renoValue)} renovation in ${community} is significant — often a sign the owner is about to list. Calgary's market rewards well-renovated homes.`
          : `${fmt(renoValue)} home improvement in ${community}. This homeowner is investing — they either love the area (referral potential) or are prepping to sell.`,
        suggestedAction: isMajor
          ? `Check MLS for this address. If not listed, door knock — "I noticed the renovation. Are you planning to sell? I have buyers looking in ${community}."`
          : `Door knock neighbours — "Your neighbour just invested ${fmt(renoValue)} in their home. Want to know what that means for your property value?"`,
        keyNumbers: {
          "Reno Value": fmt(renoValue),
          Community: community,
          "Permit Date": date,
          ...(desc ? { Type: desc.slice(0, 50) } : {}),
        },
      });
    }

    return leads;
  } catch {
    return [];
  }
}

export async function findRenovationCompleteHomes(): Promise<ProspectLead[]> {
  const [edmonton, calgary] = await Promise.all([
    findEdmontonRenovations(),
    findCalgaryRenovations(),
  ]);

  return [...edmonton, ...calgary].sort(prioritySort).slice(0, 40);
}

// ============================================================
// Lead Type 5: New Neighbourhood Watch
// Registry-driven: any municipality with development_stages capability
// Currently: Spruce Grove
// ============================================================

export async function findNewNeighbourhoodDevelopments(): Promise<
  ProspectLead[]
> {
  // Find municipalities with development_stages capability
  const devStageMunis = getLiveMunicipalities().filter((m) =>
    m.capabilities.includes("development_stages")
  );

  const allLeads: ProspectLead[] = [];

  for (const config of devStageMunis) {
    if (config.slug === "spruce-grove") {
      // Spruce Grove has a dedicated fetch function
      try {
        const stages = await fetchSprucGroveDevelopmentStages();
        const recent = stages
          .filter((s) => s.year >= 2020 && s.residentialLots > 0)
          .sort(
            (a, b) =>
              b.year - a.year || b.residentialLots - a.residentialLots
          );

        for (const stage of recent) {
          let priority: ProspectLead["priority"];
          if (stage.year >= 2024 && stage.residentialLots > 20)
            priority = "hot";
          else if (stage.year >= 2023 || stage.residentialLots > 30)
            priority = "warm";
          else priority = "watch";

          allLeads.push({
            id: `newhood-${config.slug}-${stage.name || stage.plan}`,
            type: "new-neighbourhood",
            priority,
            municipality: config.name,
            region: regionLabel(config.region),
            location: stage.name || `Plan ${stage.plan}`,
            headline:
              stage.year >= 2024
                ? `New development — ${stage.residentialLots} residential lots (${stage.year})`
                : `Growing subdivision — ${stage.residentialLots} lots registered in ${stage.year}`,
            reason:
              stage.year >= 2024
                ? `${stage.name} is a fresh development with ${stage.residentialLots} residential lots. Lot buyers need agents for their new builds. The developer (${stage.developer || "unknown"}) may also need a preferred agent referral.`
                : `${stage.name} has ${stage.residentialLots} lots from ${stage.year}. Some may still be available or the early buyers are now looking to sell their first homes (move-up buyers).`,
            suggestedAction:
              stage.year >= 2024
                ? `Contact developer (${stage.developer || "check municipal records"}) — offer to be the preferred agent for lot buyers. Attend model home openings.`
                : `Farm this area with door knocking. Early buyers (${stage.year}) may be ready to move up. You'd be the neighbourhood expert.`,
            keyNumbers: {
              "Residential Lots": String(stage.residentialLots),
              "Total Lots": String(stage.totalLots),
              Year: String(stage.year),
              Developer: stage.developer || "N/A",
              ...(stage.plan ? { Plan: stage.plan } : {}),
            },
          });
        }
      } catch {
        // skip
      }
    }
    // Future: other municipalities with development_stages can be added here
  }

  return allLeads.slice(0, 20);
}

// ============================================================
// Lead Type 6: Dev Permit Surge (NEW)
// ArcGIS municipalities with dev_permits — address-level leads
// Strathcona, St. Albert, Banff, Sylvan Lake, Calgary (community-level)
// ============================================================

async function findDevPermitSurgeForArcGIS(
  config: MunicipalityConfig
): Promise<ProspectLead[]> {
  const endpoint = config.endpoints.devPermits;
  if (!endpoint) return [];

  const addressField = config.fields.permitAddress || config.fields.address || "ADDRESS";
  const typeField = config.fields.permitType || "";
  const statusField = config.fields.permitStatus || "";
  const descField = config.fields.permitDescription || "";
  const subdivisionField = config.fields.subdivision || config.fields.neighbourhood || "";
  const dateField = config.fields.permitDate || "";

  const outFields = [
    addressField,
    typeField,
    statusField,
    descField,
    subdivisionField,
    dateField,
  ]
    .filter(Boolean)
    .join(",");

  try {
    // For epoch dates, we need a different where clause
    let whereClause = "1=1";
    if (dateField && config.filters?.permitDateField === "epoch") {
      // Last 12 months in epoch ms
      const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000;
      whereClause = `${dateField} > ${cutoff}`;
    }
    if (config.filters?.residentialFilter) {
      whereClause = config.filters.residentialFilter;
    }

    const data = await fetchArcGIS(endpoint.url, {
      where: whereClause,
      outFields,
      returnGeometry: "false",
      resultRecordCount: "200",
      orderByFields: dateField ? `${dateField} DESC` : "",
    });

    if (data.length === 0) return [];

    // Group by subdivision/neighbourhood to find hotspots
    const groupCounts = new Map<string, number>();
    for (const row of data) {
      const group = subdivisionField
        ? String(row[subdivisionField] || "Unknown").trim()
        : config.name;
      groupCounts.set(group, (groupCounts.get(group) || 0) + 1);
    }

    const leads: ProspectLead[] = [];
    const seenAddresses = new Set<string>();

    for (const row of data) {
      const address = String(row[addressField] || "").trim();
      if (!address || seenAddresses.has(address)) continue;
      seenAddresses.add(address);

      const type = typeField ? String(row[typeField] || "") : "";
      const status = statusField ? String(row[statusField] || "") : "";
      const desc = descField ? String(row[descField] || "") : "";
      const subdivision = subdivisionField
        ? String(row[subdivisionField] || "").trim()
        : "";
      const areaPermitCount = subdivision
        ? groupCounts.get(subdivision) || 0
        : data.length;

      // Parse date (handle epoch and ISO)
      let dateStr = "";
      if (dateField && row[dateField]) {
        const rawDate = row[dateField];
        if (typeof rawDate === "number" && rawDate > 1000000000) {
          dateStr = new Date(rawDate).toISOString().split("T")[0];
        } else {
          dateStr = String(rawDate).split("T")[0];
        }
      }

      const isResidential =
        type.toUpperCase().includes("RESIDENTIAL") ||
        desc.toLowerCase().includes("residential") ||
        desc.toLowerCase().includes("dwelling");

      let priority: ProspectLead["priority"];
      if (areaPermitCount > 15 && isResidential) priority = "hot";
      else if (areaPermitCount > 8 || isResidential) priority = "warm";
      else priority = "watch";

      leads.push({
        id: `devpermit-${config.slug}-${address}`,
        type: "dev-permit-surge",
        priority,
        municipality: config.name,
        region: regionLabel(config.region),
        location: subdivision ? `${address}, ${subdivision}` : address,
        headline: `Development permit${areaPermitCount > 5 ? ` — ${areaPermitCount} permits in ${subdivision || config.name}` : ""}`,
        reason: isResidential
          ? `Active residential development permit in ${config.name}. ${areaPermitCount > 5 ? `${subdivision || "This area"} has ${areaPermitCount} recent permits — growth is accelerating.` : "New construction signals neighbourhood growth."}`
          : `Development permit activity in ${config.name}. ${desc ? `Project: ${desc.slice(0, 80)}` : ""}`,
        suggestedAction:
          priority === "hot"
            ? `High-activity area — farm ${subdivision || config.name} for listings. Neighbours of new builds often consider selling.`
            : `Monitor ${subdivision || config.name} for future listing opportunities.`,
        keyNumbers: {
          ...(type ? { Type: type } : {}),
          ...(status ? { Status: status } : {}),
          ...(dateStr ? { Date: dateStr } : {}),
          ...(subdivision ? { Area: subdivision } : {}),
          "Area Permits": String(areaPermitCount),
        },
      });
    }

    return leads.sort(prioritySort).slice(0, 20);
  } catch {
    return [];
  }
}

export async function findDevPermitSurge(): Promise<ProspectLead[]> {
  // Find ArcGIS municipalities with dev_permits (excluding Calgary — handled in teardowns)
  const devPermitMunis = getLiveMunicipalities().filter(
    (m) =>
      m.capabilities.includes("dev_permits") &&
      m.slug !== "calgary" &&
      m.endpoints.devPermits
  );

  const results = await Promise.all(
    devPermitMunis.map((m) => findDevPermitSurgeForArcGIS(m))
  );

  return results.flat().sort(prioritySort).slice(0, 40);
}

// ============================================================
// Combined: Generate all prospect leads province-wide
// ============================================================

export async function generateAllProspects(): Promise<ProspectLead[]> {
  const [equity, teardown, vacant, reno, newHood, devSurge] =
    await Promise.all([
      findEquityGoldSellers(),
      findTeardownTargets(),
      findVacantLotOpportunities(),
      findRenovationCompleteHomes(),
      findNewNeighbourhoodDevelopments(),
      findDevPermitSurge(),
    ]);

  return [...equity, ...teardown, ...vacant, ...reno, ...newHood, ...devSurge];
}

// ============================================================
// Helpers for UI — group leads by municipality or region
// ============================================================

export function groupLeadsByRegion(
  leads: ProspectLead[]
): Record<string, ProspectLead[]> {
  const groups: Record<string, ProspectLead[]> = {};
  for (const lead of leads) {
    const region = lead.region;
    if (!groups[region]) groups[region] = [];
    groups[region].push(lead);
  }
  return groups;
}

export function groupLeadsByMunicipality(
  leads: ProspectLead[]
): Record<string, ProspectLead[]> {
  const groups: Record<string, ProspectLead[]> = {};
  for (const lead of leads) {
    if (!groups[lead.municipality]) groups[lead.municipality] = [];
    groups[lead.municipality].push(lead);
  }
  return groups;
}

export function getLeadSummary(leads: ProspectLead[]) {
  const municipalities = new Set(leads.map((l) => l.municipality));
  const regions = new Set(leads.map((l) => l.region));
  return {
    total: leads.length,
    hot: leads.filter((l) => l.priority === "hot").length,
    warm: leads.filter((l) => l.priority === "warm").length,
    watch: leads.filter((l) => l.priority === "watch").length,
    municipalityCount: municipalities.size,
    regionCount: regions.size,
    municipalities: Array.from(municipalities),
    regions: Array.from(regions),
  };
}
