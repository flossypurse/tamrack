/**
 * Prospect Lead Generator
 *
 * Turns raw data from multiple municipalities into actionable prospect leads
 * for a realtor. Each function generates ranked leads with plain-English
 * explanations and suggested actions.
 */

import {
  fetchEdmontonData,
  EDMONTON_DATASETS,
  fetchSprucGroveDevelopmentStages,
} from "./data-sources";

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
    | "new-neighbourhood";
  priority: "hot" | "warm" | "watch";
  municipality: string;
  location: string;
  headline: string;
  reason: string;
  suggestedAction: string;
  keyNumbers: Record<string, string>;
}

// ============================================================
// Internal: ArcGIS fetcher (re-implemented to avoid exporting
// from data-sources — keeps that module's API stable)
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

// ArcGIS endpoints
const STONY_PLAIN_PARCELS =
  "https://services.arcgis.com/ScgF04sks0ZKbWe3/arcgis/rest/services/Land_Development_Dashboard_Parcels_Public_View/FeatureServer/0";
const STONY_PLAIN_VACANT =
  "https://services.arcgis.com/ScgF04sks0ZKbWe3/arcgis/rest/services/Vacant_Lots/FeatureServer/0";
const SPRUCE_GROVE_ADDRESSES =
  "https://gisinfo.sprucegrove.org/gis/rest/services/Integrations/MRFEnforcementCentreWFS/FeatureServer/0";

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n.toLocaleString()}`;
}

function pct(n: number): string {
  return `${Math.round(n)}%`;
}

// ============================================================
// Lead Type 1: Sellers Sitting on Gold (Stony Plain)
// Parcels where assessed value >> last sale price = equity growth
// ============================================================

export async function findEquityGoldSellers(): Promise<ProspectLead[]> {
  try {
    const data = await fetchArcGIS(STONY_PLAIN_PARCELS, {
      where: "TASS > 0 AND TXSLAM > 50000",
      outFields: "PMNSD,PMZONC,PMYRBL,TXSLAM,TASS,PMYRAS,Area_Acre",
      returnGeometry: "false",
      resultRecordCount: "3000",
    });

    const leads: ProspectLead[] = [];

    for (const row of data) {
      const address = String(row.PMNSD || "").trim();
      const salePrice = Number(row.TXSLAM || 0);
      const assessment = Number(row.TASS || 0);
      const yearBuilt = Number(row.PMYRBL || 0);
      const zoning = String(row.PMZONC || "");
      const acreage = Number(row.Area_Acre || 0);

      if (salePrice <= 0 || assessment <= 0 || !address) continue;

      const equityGap = assessment - salePrice;
      const equityPct = (equityGap / salePrice) * 100;

      // Only show significant equity growth
      if (equityPct < 15 || equityGap < 30000) continue;

      let priority: ProspectLead["priority"];
      if (equityPct > 40 && equityGap > 80000) priority = "hot";
      else if (equityPct > 25 || equityGap > 60000) priority = "warm";
      else priority = "watch";

      leads.push({
        id: `equity-${address}`,
        type: "equity-gold",
        priority,
        municipality: "Stony Plain",
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
          Zoning: zoning,
        },
      });
    }

    return leads.sort((a, b) => {
      const priorityOrder = { hot: 0, warm: 1, watch: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority])
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      // Within same priority, sort by equity gap (parsed from headline)
      return 0;
    }).slice(0, 30);
  } catch {
    return [];
  }
}

// ============================================================
// Lead Type 2: Teardown / Redevelopment Targets (Edmonton)
// Addresses in redeveloping neighbourhoods with active dev permits
// ============================================================

export async function findTeardownTargets(): Promise<ProspectLead[]> {
  try {
    // Get individual dev permits in redeveloping neighbourhoods
    const [devPermits, assessments] = await Promise.all([
      fetchEdmontonData(EDMONTON_DATASETS.DEVELOPMENT_PERMITS, {
        $query: `SELECT address, neighbourhood, neighbourhood_classification, description_of_development, permit_date, status WHERE permit_date > '2024-06-01' AND neighbourhood_classification = 'Redeveloping' AND address IS NOT NULL ORDER BY permit_date DESC LIMIT 200`,
      }).catch(() => []),
      fetchEdmontonData(EDMONTON_DATASETS.PROPERTY_ASSESSMENTS, {
        $query: `SELECT neighbourhood, count(*) as cnt, avg(assessed_value::number) as avg_val WHERE tax_class='Residential' AND neighbourhood IS NOT NULL GROUP BY neighbourhood HAVING count(*) > 20`,
      }).catch(() => []),
    ]);

    // Build assessment lookup
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

    // Count permits per neighbourhood for density scoring
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
        id: `teardown-${address}`,
        type: "teardown",
        priority,
        municipality: "Edmonton",
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

    return leads
      .sort((a, b) => {
        const priorityOrder = { hot: 0, warm: 1, watch: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      })
      .slice(0, 30);
  } catch {
    return [];
  }
}

// ============================================================
// Lead Type 3: Vacant Lot Opportunities (Stony Plain + Spruce Grove)
// Individual vacant lots with zoning and assessment data
// ============================================================

export async function findVacantLotOpportunities(): Promise<ProspectLead[]> {
  try {
    const [stonyLots, spruceLots] = await Promise.all([
      // Stony Plain: individual vacant lots with assessment
      fetchArcGIS(STONY_PLAIN_VACANT, {
        where: "1=1",
        outFields: "PMZNC1,PMZND1,ASSES,LGLPL,Shape__Area",
        returnGeometry: "false",
        resultRecordCount: "500",
      }).catch(() => []),
      // Spruce Grove: vacant parcels with subdivision
      fetchArcGIS(SPRUCE_GROVE_ADDRESSES, {
        where:
          "ASSESS_DESC = 'VACANT RESIDENTIAL LAND' OR ASSESS_DESC = 'VACANT COMMERCIAL LAND'",
        outFields: "ASSESS_DESC,SUBDIVISION,FULL_ADDRESS,BUILDING_TYPE",
        returnGeometry: "false",
        resultRecordCount: "500",
      }).catch(() => []),
    ]);

    const leads: ProspectLead[] = [];

    // Stony Plain vacant lots
    for (const row of stonyLots) {
      const zoning = String(row.PMZNC1 || "").trim();
      const zoningDesc = String(row.PMZND1 || zoning).trim();
      const assessment = Number(row.ASSES || 0);
      const legalPlan = String(row.LGLPL || "").trim();
      const area = Number(row.Shape__Area || 0);
      const areaSqFt = Math.round(area * 10.764); // m² to ft²

      const isResidential =
        zoning.startsWith("R") ||
        zoningDesc.toLowerCase().includes("residential");

      let priority: ProspectLead["priority"];
      if (isResidential && assessment > 0 && assessment < 200000)
        priority = "hot";
      else if (isResidential) priority = "warm";
      else priority = "watch";

      leads.push({
        id: `vacant-sp-${legalPlan || Math.random().toString(36).slice(2)}`,
        type: "vacant-lot",
        priority,
        municipality: "Stony Plain",
        location: legalPlan ? `Plan ${legalPlan}` : `${zoningDesc} lot`,
        headline: isResidential
          ? `Vacant residential lot — ${zoningDesc} zoning${assessment > 0 ? `, assessed at ${fmt(assessment)}` : ""}`
          : `Vacant ${zoningDesc} lot available`,
        reason: isResidential
          ? `Ready-to-build residential lot in Stony Plain. Builders and investors are looking for serviced lots in growing communities.`
          : `${zoningDesc}-zoned vacant lot. Could suit commercial development or mixed-use depending on municipal plans.`,
        suggestedAction: isResidential
          ? `Connect with local builders — match this lot with a buyer. Or pitch to investor clients as a spec build opportunity.`
          : `Research municipal development plans for this area. Could be valuable to the right commercial buyer.`,
        keyNumbers: {
          Zoning: zoningDesc,
          ...(assessment > 0 ? { Assessment: fmt(assessment) } : {}),
          ...(areaSqFt > 0 ? { Size: `${areaSqFt.toLocaleString()} sq ft` } : {}),
        },
      });
    }

    // Spruce Grove vacant lots
    for (const row of spruceLots) {
      const type = String(row.ASSESS_DESC || "").trim();
      const subdivision = String(row.SUBDIVISION || "").trim();
      const address = String(row.FULL_ADDRESS || "").trim();

      const isResidential = type.includes("RESIDENTIAL");

      leads.push({
        id: `vacant-sg-${address || Math.random().toString(36).slice(2)}`,
        type: "vacant-lot",
        priority: isResidential ? "warm" : "watch",
        municipality: "Spruce Grove",
        location: address || `${subdivision} (${type})`,
        headline: `Vacant ${isResidential ? "residential" : "commercial"} lot in ${subdivision || "Spruce Grove"}`,
        reason: isResidential
          ? `Vacant residential lot in ${subdivision || "Spruce Grove"}. The city is growing and serviced lots are in demand.`
          : `Vacant commercial lot — potential for retail, office, or mixed-use development.`,
        suggestedAction: `Contact lot owner about listing. Vacant lots in growing communities sell to builders looking for their next project.`,
        keyNumbers: {
          Type: type,
          ...(subdivision ? { Subdivision: subdivision } : {}),
          Municipality: "Spruce Grove",
        },
      });
    }

    // Sort: residential first, then by priority
    return leads
      .sort((a, b) => {
        const priorityOrder = { hot: 0, warm: 1, watch: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      })
      .slice(0, 40);
  } catch {
    return [];
  }
}

// ============================================================
// Lead Type 4: Renovation-Complete Homes (Edmonton)
// Individual addresses with recent high-value reno permits
// ============================================================

export async function findRenovationCompleteHomes(): Promise<ProspectLead[]> {
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
        id: `reno-${address}`,
        type: "reno-complete",
        priority,
        municipality: "Edmonton",
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

    return leads.slice(0, 30);
  } catch {
    return [];
  }
}

// ============================================================
// Lead Type 5: New Neighbourhood Watch (Spruce Grove)
// Recent development stages = new subdivisions needing agents
// ============================================================

export async function findNewNeighbourhoodDevelopments(): Promise<
  ProspectLead[]
> {
  try {
    const stages = await fetchSprucGroveDevelopmentStages();

    const leads: ProspectLead[] = [];

    // Filter for recent developments with residential lots
    const recent = stages
      .filter((s) => s.year >= 2020 && s.residentialLots > 0)
      .sort((a, b) => b.year - a.year || b.residentialLots - a.residentialLots);

    for (const stage of recent) {
      let priority: ProspectLead["priority"];
      if (stage.year >= 2024 && stage.residentialLots > 20) priority = "hot";
      else if (stage.year >= 2023 || stage.residentialLots > 30)
        priority = "warm";
      else priority = "watch";

      leads.push({
        id: `newhood-${stage.name || stage.plan}`,
        type: "new-neighbourhood",
        priority,
        municipality: "Spruce Grove",
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

    return leads.slice(0, 20);
  } catch {
    return [];
  }
}

// ============================================================
// Combined: Generate all prospect leads
// ============================================================

export async function generateAllProspects(): Promise<ProspectLead[]> {
  const [equity, teardown, vacant, reno, newHood] = await Promise.all([
    findEquityGoldSellers(),
    findTeardownTargets(),
    findVacantLotOpportunities(),
    findRenovationCompleteHomes(),
    findNewNeighbourhoodDevelopments(),
  ]);

  return [...equity, ...teardown, ...vacant, ...reno, ...newHood];
}
