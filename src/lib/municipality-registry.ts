// Municipality Registry — config-driven system for scaling to all of Alberta
// Adding a new municipality = adding an entry here with its ArcGIS endpoints + field mappings

// ============================================================
// Types
// ============================================================

export type DataCapability =
  | "assessments"
  | "permits"
  | "businesses"
  | "vacant_lots"
  | "construction"
  | "zoning"
  | "development_stages"
  | "dev_permits";

export type MunicipalityRegion =
  | "edmonton-metro"
  | "calgary-metro"
  | "central"
  | "south"
  | "north"
  | "northwest"
  | "northeast";

export interface ArcGISEndpoint {
  url: string;
  type: "FeatureServer" | "MapServer";
}

export interface FieldMapping {
  // Assessment fields
  assessmentValue?: string;       // e.g., "TASS", "Assessment", "Assessed_Value", "assess_2024"
  assessmentYear?: string;        // e.g., "PMYRAS", "AssessmentYear"
  address?: string;               // e.g., "PMNSD", "MunicipalAddress", "ADDRESS"
  zoning?: string;                // e.g., "PMZONC", "Zoning", "ZONECLASS"
  zoningDescription?: string;     // e.g., "ZONEDESC", "Zoning"
  subdivision?: string;           // e.g., "Subdivision", "SUBDIVISION"
  neighbourhood?: string;         // e.g., "Neighbourhood", "SUBDIVISION"
  propertyClass?: string;         // e.g., "Property_Class", "ASSESS_DESC"
  yearBuilt?: string;             // e.g., "PMYRBL"
  salePrice?: string;             // e.g., "TXSLAM"
  acreage?: string;               // e.g., "Area_Acre", "AreaAcre", "Hectares"

  // Permit fields
  permitType?: string;
  permitStatus?: string;
  permitDate?: string;
  permitDescription?: string;
  permitValue?: string;
  permitAddress?: string;

  // Business fields
  businessName?: string;
  businessCategory?: string;
  businessAddress?: string;

  // Vacant lot fields
  vacantZoning?: string;
  vacantAssessment?: string;

  // Construction fields
  projectName?: string;
  projectPhase?: string;
  projectStart?: string;
  projectEnd?: string;
  projectLocation?: string;

  // Development stage fields
  stageName?: string;
  developer?: string;
  residentialLots?: string;
  totalLots?: string;
  stageYear?: string;
}

export interface MunicipalityConfig {
  slug: string;
  name: string;
  region: MunicipalityRegion;
  population?: number;        // approximate, for display
  status: "live" | "planned";  // live = endpoints verified, planned = discovered but unverified

  // Data endpoints
  endpoints: {
    assessments?: ArcGISEndpoint;
    parcels?: ArcGISEndpoint;
    permits?: ArcGISEndpoint;
    devPermits?: ArcGISEndpoint;
    devPermitsPast?: ArcGISEndpoint;
    businesses?: ArcGISEndpoint;
    vacantLots?: ArcGISEndpoint;
    construction?: ArcGISEndpoint;
    zoning?: ArcGISEndpoint;
    developmentStages?: ArcGISEndpoint;
    landUse?: ArcGISEndpoint;
    subdivisions?: ArcGISEndpoint;
  };

  // Field name mappings (each ArcGIS server uses different field names)
  fields: FieldMapping;

  // What data is available
  capabilities: DataCapability[];

  // Special query filters
  filters?: {
    assessmentWhere?: string;     // e.g., "TASS > 0 AND PMZONC IS NOT NULL"
    residentialFilter?: string;   // e.g., "Property_Class='Residential'"
    permitDateField?: "epoch" | "iso";  // how dates are stored
  };

  // Display metadata
  dataSource: string;   // e.g., "Town of Stony Plain ArcGIS"
  description: string;  // one-liner for the page header
  color: string;        // accent color for charts
  notes?: string[];     // data coverage notes
}

// ============================================================
// Registry
// ============================================================

export const MUNICIPALITY_REGISTRY: MunicipalityConfig[] = [
  // ── EDMONTON METRO ──────────────────────────────────────────

  {
    slug: "stony-plain",
    name: "Stony Plain",
    region: "edmonton-metro",
    population: 18000,
    status: "live",
    endpoints: {
      parcels: { url: "https://services.arcgis.com/ScgF04sks0ZKbWe3/arcgis/rest/services/Land_Development_Dashboard_Parcels_Public_View/FeatureServer/0", type: "FeatureServer" },
      assessments: { url: "https://services.arcgis.com/ScgF04sks0ZKbWe3/arcgis/rest/services/2026_Assessments/FeatureServer/0", type: "FeatureServer" },
      businesses: { url: "https://services.arcgis.com/ScgF04sks0ZKbWe3/arcgis/rest/services/ToSP_Businesses/FeatureServer/0", type: "FeatureServer" },
      vacantLots: { url: "https://services.arcgis.com/ScgF04sks0ZKbWe3/arcgis/rest/services/Vacant_Lots/FeatureServer/0", type: "FeatureServer" },
      construction: { url: "https://services.arcgis.com/ScgF04sks0ZKbWe3/arcgis/rest/services/Construction_Projects/FeatureServer/0", type: "FeatureServer" },
    },
    fields: {
      assessmentValue: "TASS",
      assessmentYear: "PMYRAS",
      address: "PMNSD",
      zoning: "PMZONC",
      yearBuilt: "PMYRBL",
      salePrice: "TXSLAM",
      acreage: "Area_Acre",
      businessName: "NAME",
      businessCategory: "CATEGORY",
      businessAddress: "Number,Street_Name,Street_Type",
      vacantZoning: "PMZND1",
      vacantAssessment: "ASSES",
      projectName: "Program",
      projectPhase: "Project_Phase",
      projectStart: "Start_Date",
      projectEnd: "End_date",
      projectLocation: "Location",
    },
    capabilities: ["assessments", "businesses", "vacant_lots", "construction", "zoning"],
    filters: {
      assessmentWhere: "TASS > 0 AND PMZONC IS NOT NULL",
    },
    dataSource: "Town of Stony Plain ArcGIS",
    description: "Property assessments, businesses, vacant lots, and construction projects. 8,400+ parcels with zoning, year built, and sale price data.",
    color: "#3b82f6",
  },

  {
    slug: "parkland-county",
    name: "Parkland County",
    region: "edmonton-metro",
    population: 33000,
    status: "live",
    endpoints: {
      parcels: { url: "https://maps.parklandcounty.com/arcgis/rest/services/discoverParkland/Query/MapServer/2000", type: "MapServer" },
      landUse: { url: "https://maps.parklandcounty.com/arcgis/rest/services/Dynamics/DynamicsCRM/MapServer/29", type: "MapServer" },
      subdivisions: { url: "https://maps.parklandcounty.com/arcgis/rest/services/Dynamics/DynamicsCRM/MapServer/18", type: "MapServer" },
    },
    fields: {
      assessmentValue: "Assessment",
      assessmentYear: "AssessmentYear",
      address: "MunicipalAddress",
      zoning: "Zoning",
      subdivision: "Subdivision",
      acreage: "AreaAcre",
    },
    capabilities: ["assessments", "zoning"],
    filters: {
      assessmentWhere: "Subdivision IS NOT NULL AND Assessment IS NOT NULL",
    },
    dataSource: "Parkland County ArcGIS",
    description: "14,485 parcels across 24 zoning districts with subdivision and assessment data. Rural and country residential properties.",
    color: "#10b981",
  },

  {
    slug: "spruce-grove",
    name: "Spruce Grove",
    region: "edmonton-metro",
    population: 39000,
    status: "live",
    endpoints: {
      parcels: { url: "https://gisinfo.sprucegrove.org/gis/rest/services/Integrations/MRFEnforcementCentreWFS/FeatureServer/0", type: "FeatureServer" },
      zoning: { url: "https://gisinfo.sprucegrove.org/gis/rest/services/BusinessPartners/CorporateWMS/MapServer/30", type: "MapServer" },
      developmentStages: { url: "https://gisinfo.sprucegrove.org/gis/rest/services/BusinessPartners/CorporateWMS/MapServer/40", type: "MapServer" },
    },
    fields: {
      subdivision: "SUBDIVISION",
      propertyClass: "ASSESS_DESC",
      zoning: "ZONECLASS",
      zoningDescription: "ZONEDESC",
      stageName: "StageFullName",
      developer: "Developer",
      residentialLots: "ResidentialLotCount",
      totalLots: "TotalLotCount",
      stageYear: "Year",
    },
    capabilities: ["zoning", "development_stages"],
    dataSource: "City of Spruce Grove ArcGIS",
    description: "22,094 addresses across 42 subdivisions. Property types, zoning districts, and active development stages. No dollar-value assessments via API.",
    color: "#a855f7",
    notes: ["No dollar-value assessments available via API", "No building permits via API"],
  },

  {
    slug: "strathcona",
    name: "Strathcona County",
    region: "edmonton-metro",
    population: 101000,
    status: "live",
    endpoints: {
      devPermits: { url: "https://services.arcgis.com/B7ZrK1Hv4P1dsm9R/arcgis/rest/services/Development_Permits/FeatureServer/0", type: "FeatureServer" },
      assessments: { url: "https://services.arcgis.com/B7ZrK1Hv4P1dsm9R/arcgis/rest/services/2025%20Property%20Tax%20Assessment/FeatureServer/0", type: "FeatureServer" },
    },
    fields: {
      assessmentValue: "assess_2024",
      address: "address",
      neighbourhood: "bldg",
      permitType: "CATEGORY",
      permitStatus: "STATUS",
      permitDate: "ISSUEDATE",
      permitDescription: "DESCRIPTION",
      permitAddress: "CIVICADDRESS",
      subdivision: "SUBDIVISION",
    },
    capabilities: ["assessments", "dev_permits"],
    filters: {
      residentialFilter: "CATEGORY='RESIDENTIAL' AND ISSUE_YEAR>=2024",
      permitDateField: "epoch",
    },
    dataSource: "Strathcona County ArcGIS",
    description: "Development permits and property assessments for Sherwood Park and surrounding area. 2,000+ residential permit records.",
    color: "#f59e0b",
  },

  {
    slug: "st-albert",
    name: "St. Albert",
    region: "edmonton-metro",
    population: 70000,
    status: "live",
    endpoints: {
      devPermits: { url: "https://services1.arcgis.com/fyyY0cNXvmUWvX1x/arcgis/rest/services/DP_PastYear_YTD_ETL_public_view/FeatureServer/2", type: "FeatureServer" },
      devPermitsPast: { url: "https://services1.arcgis.com/fyyY0cNXvmUWvX1x/arcgis/rest/services/DP_PastYear_YTD_ETL_public_view/FeatureServer/3", type: "FeatureServer" },
      assessments: { url: "https://services1.arcgis.com/fyyY0cNXvmUWvX1x/arcgis/rest/services/LandscapeTaxAssessment2025_view/FeatureServer/0", type: "FeatureServer" },
    },
    fields: {
      assessmentValue: "Assessed_Value",
      neighbourhood: "Neighbourhood",
      propertyClass: "Property_Class",
      permitType: "TYPE",
      permitStatus: "STATUS",
      permitDate: "APPROVED_DATE",
      permitAddress: "ADDRESS",
      permitDescription: "SUBJECT",
    },
    capabilities: ["assessments", "dev_permits"],
    filters: {
      residentialFilter: "Property_Class='Residential'",
      permitDateField: "epoch",
    },
    dataSource: "City of St. Albert ArcGIS",
    description: "Development permits and property tax assessments by neighbourhood. Residential focus with assessment breakdowns.",
    color: "#06b6d4",
  },

  {
    slug: "leduc",
    name: "Leduc",
    region: "edmonton-metro",
    population: 35000,
    status: "live",
    endpoints: {
      assessments: { url: "https://maps.leduc.ca/arcgis/rest/services/Assessment_parcel/MapServer/0", type: "MapServer" },
    },
    fields: {
      assessmentValue: "ASSESSMENT",
      address: "ADDRESS",
      propertyClass: "PROPERTY_TYPE",
      yearBuilt: "YEAR_BUILT",
    },
    capabilities: ["assessments"],
    dataSource: "City of Leduc ArcGIS MapServer",
    description: "Property assessments with zoning and neighbourhood breakdowns for Leduc and Nisku industrial area.",
    color: "#ef4444",
  },

  {
    slug: "beaumont",
    name: "Beaumont",
    region: "edmonton-metro",
    population: 22000,
    status: "planned",
    endpoints: {
      parcels: { url: "https://services1.arcgis.com/vSJSJBCERhofQMUY/arcgis/rest/services/Beaumont_Property_Assessments/FeatureServer/0", type: "FeatureServer" },
    },
    fields: {
      assessmentValue: "ASSESSED_VALUE",
      address: "ADDRESS",
      zoning: "ZONE",
      neighbourhood: "NEIGHBOURHOOD",
    },
    capabilities: ["assessments"],
    filters: {
      assessmentWhere: "ASSESSED_VALUE > 0",
    },
    dataSource: "City of Beaumont ArcGIS",
    description: "Property assessments for one of Alberta's fastest-growing bedroom communities south of Edmonton.",
    color: "#8b5cf6",
  },

  {
    slug: "fort-saskatchewan",
    name: "Fort Saskatchewan",
    region: "edmonton-metro",
    population: 28000,
    status: "planned",
    endpoints: {
      parcels: { url: "https://services1.arcgis.com/vSJSJBCERhofQMUY/arcgis/rest/services/FortSask_Property_Assessments/FeatureServer/0", type: "FeatureServer" },
    },
    fields: {
      assessmentValue: "ASSESSED_VALUE",
      address: "ADDRESS",
      zoning: "ZONE",
      neighbourhood: "NEIGHBOURHOOD",
    },
    capabilities: ["assessments"],
    filters: {
      assessmentWhere: "ASSESSED_VALUE > 0",
    },
    dataSource: "City of Fort Saskatchewan ArcGIS",
    description: "Property assessments for the heart of Alberta's Industrial Heartland. Petrochemical corridor community.",
    color: "#3b8fdb",
  },

  {
    slug: "morinville",
    name: "Morinville",
    region: "edmonton-metro",
    population: 10000,
    status: "planned",
    endpoints: {
      parcels: { url: "https://services1.arcgis.com/vSJSJBCERhofQMUY/arcgis/rest/services/Morinville_Property_Assessments/FeatureServer/0", type: "FeatureServer" },
    },
    fields: {
      assessmentValue: "ASSESSED_VALUE",
      address: "ADDRESS",
      zoning: "ZONE",
    },
    capabilities: ["assessments"],
    filters: {
      assessmentWhere: "ASSESSED_VALUE > 0",
    },
    dataSource: "Town of Morinville ArcGIS",
    description: "Property assessments for Morinville, a growing community north of Edmonton on Highway 2.",
    color: "#f97316",
  },

  {
    slug: "devon",
    name: "Devon",
    region: "edmonton-metro",
    population: 7000,
    status: "planned",
    endpoints: {
      parcels: { url: "https://services1.arcgis.com/vSJSJBCERhofQMUY/arcgis/rest/services/Devon_Property_Assessments/FeatureServer/0", type: "FeatureServer" },
    },
    fields: {
      assessmentValue: "ASSESSED_VALUE",
      address: "ADDRESS",
      zoning: "ZONE",
    },
    capabilities: ["assessments"],
    filters: {
      assessmentWhere: "ASSESSED_VALUE > 0",
    },
    dataSource: "Town of Devon ArcGIS",
    description: "Property assessments for Devon, a riverside town southwest of Edmonton near the Nisku industrial corridor.",
    color: "#84cc16",
  },

  {
    slug: "sturgeon-county",
    name: "Sturgeon County",
    region: "edmonton-metro",
    population: 21000,
    status: "live",
    endpoints: {
      parcels: { url: "https://services.arcgis.com/ix1ny7KGzblW5l6Y/arcgis/rest/services/Sturgeon_PropertyInfo/FeatureServer/1", type: "FeatureServer" },
    },
    fields: {
      address: "FullAddress",
      neighbourhood: "Neighbourhood",
    },
    capabilities: ["zoning"],
    dataSource: "Sturgeon County ArcGIS",
    description: "24,500 parcels with addresses, neighbourhoods, and property codes. North of Edmonton along Highway 2.",
    color: "#166534",
    notes: ["No dollar-value assessments available via public API"],
  },

  {
    slug: "leduc-county",
    name: "Leduc County",
    region: "edmonton-metro",
    population: 14000,
    status: "live",
    endpoints: {
      parcels: { url: "https://services1.arcgis.com/sBJkLg2JQW8aX6Ct/ArcGIS/rest/services/PARCEL_HTTPS/FeatureServer/0", type: "FeatureServer" },
    },
    fields: {
      address: "ADDRESS",
      zoning: "zoning",
    },
    capabilities: ["zoning"],
    dataSource: "Leduc County ArcGIS",
    description: "11,740 parcels with zoning, area structure plans, and school districts. South of Edmonton, includes Nisku area.",
    color: "#be185d",
    notes: ["No dollar-value assessments available via public API"],
  },

  // ── CALGARY METRO ──────────────────────────────────────────

  {
    slug: "calgary",
    name: "Calgary",
    region: "calgary-metro",
    population: 1340000,
    status: "live",
    endpoints: {
      parcels: { url: "https://data.calgary.ca/resource/4bsw-nn7w.json", type: "FeatureServer" },
      permits: { url: "https://data.calgary.ca/resource/c2es-76ed.json", type: "FeatureServer" },
      businesses: { url: "https://data.calgary.ca/resource/vdjc-pybd.json", type: "FeatureServer" },
      devPermits: { url: "https://data.calgary.ca/resource/6933-unw5.json", type: "FeatureServer" },
    },
    fields: {
      assessmentValue: "assessed_value",
      address: "address",
      zoning: "land_use_designation",
      neighbourhood: "comm_name",
      propertyClass: "assessment_class",
      permitType: "workclassgroup",
      permitStatus: "statusname",
      permitDate: "issueddate",
      permitDescription: "description",
      permitAddress: "originaladdress",
      permitValue: "estprojectcost",
      businessName: "tradename",
      businessCategory: "licencetypes",
      businessAddress: "address",
    },
    capabilities: ["assessments", "permits", "businesses", "zoning", "dev_permits"],
    filters: {
      assessmentWhere: "assessed_value > 0",
    },
    dataSource: "City of Calgary Open Data (Socrata)",
    description: "Alberta's largest city — 600K+ property assessments, building permits, business licences, and development permits via open data portal.",
    color: "#dc2626",
    notes: ["Uses Socrata API (same as Edmonton)", "Assessment and permit data"],
  },

  {
    slug: "airdrie",
    name: "Airdrie",
    region: "calgary-metro",
    population: 80000,
    status: "planned",
    endpoints: {
      parcels: { url: "https://services.arcgis.com/xUhfOfxKjn65QCmh/arcgis/rest/services/Assessment_Current/FeatureServer/0", type: "FeatureServer" },
    },
    fields: {
      assessmentValue: "TOTAL_ASSESSMENT",
      address: "ADDRESS",
      zoning: "ZONE",
      neighbourhood: "NEIGHBOURHOOD",
    },
    capabilities: ["assessments"],
    filters: {
      assessmentWhere: "TOTAL_ASSESSMENT > 0",
    },
    dataSource: "City of Airdrie ArcGIS",
    description: "Fast-growing city north of Calgary. Property assessments with neighbourhood breakdowns.",
    color: "#0ea5e9",
  },

  {
    slug: "cochrane",
    name: "Cochrane",
    region: "calgary-metro",
    population: 36000,
    status: "planned",
    endpoints: {
      parcels: { url: "https://services.arcgis.com/xUhfOfxKjn65QCmh/arcgis/rest/services/Cochrane_Assessments/FeatureServer/0", type: "FeatureServer" },
    },
    fields: {
      assessmentValue: "ASSESSED_VALUE",
      address: "ADDRESS",
      zoning: "ZONE",
      neighbourhood: "AREA",
    },
    capabilities: ["assessments"],
    filters: {
      assessmentWhere: "ASSESSED_VALUE > 0",
    },
    dataSource: "Town of Cochrane ArcGIS",
    description: "Rapidly growing town west of Calgary in the foothills. Property assessment data.",
    color: "#6366f1",
  },

  {
    slug: "okotoks",
    name: "Okotoks",
    region: "calgary-metro",
    population: 33000,
    status: "planned",
    endpoints: {
      parcels: { url: "https://services.arcgis.com/xUhfOfxKjn65QCmh/arcgis/rest/services/Okotoks_Assessments/FeatureServer/0", type: "FeatureServer" },
    },
    fields: {
      assessmentValue: "TOTAL_ASSESSMENT",
      address: "ADDRESS",
      neighbourhood: "NEIGHBOURHOOD",
    },
    capabilities: ["assessments"],
    filters: {
      assessmentWhere: "TOTAL_ASSESSMENT > 0",
    },
    dataSource: "Town of Okotoks ArcGIS",
    description: "Community south of Calgary along the Sheep River. Property assessment data.",
    color: "#ec4899",
  },

  {
    slug: "chestermere",
    name: "Chestermere",
    region: "calgary-metro",
    population: 24000,
    status: "planned",
    endpoints: {
      parcels: { url: "https://services.arcgis.com/xUhfOfxKjn65QCmh/arcgis/rest/services/Chestermere_Assessments/FeatureServer/0", type: "FeatureServer" },
    },
    fields: {
      assessmentValue: "ASSESSED_VALUE",
      address: "ADDRESS",
      neighbourhood: "NEIGHBOURHOOD",
    },
    capabilities: ["assessments"],
    filters: {
      assessmentWhere: "ASSESSED_VALUE > 0",
    },
    dataSource: "City of Chestermere ArcGIS",
    description: "Lakeside community east of Calgary. Property assessments and neighbourhood data.",
    color: "#2dd4bf",
  },

  {
    slug: "strathmore",
    name: "Strathmore",
    region: "calgary-metro",
    population: 18000,
    status: "live",
    endpoints: {
      assessments: { url: "https://gis.strathmore.ca/arcgis/rest/services/Property_Parcels/FeatureServer/0", type: "FeatureServer" },
      zoning: { url: "https://gis.strathmore.ca/arcgis/rest/services/Land_Use/FeatureServer/0", type: "FeatureServer" },
    },
    fields: {
      assessmentValue: "AssessValue",
      address: "Short_Legal",
      zoning: "LandUse",
      neighbourhood: "Census Zone",
      yearBuilt: "Year_Built",
      salePrice: "Consideration_amount",
    },
    capabilities: ["assessments", "zoning"],
    filters: {
      assessmentWhere: "AssessValue > 0",
    },
    dataSource: "Town of Strathmore ArcGIS",
    description: "6,900+ parcels with assessments, tax rates, sale prices, and land use data. One of Alberta's richest public datasets.",
    color: "#7c3aed",
  },

  {
    slug: "canmore",
    name: "Canmore",
    region: "calgary-metro",
    population: 15000,
    status: "live",
    endpoints: {
      zoning: { url: "https://services.arcgis.com/USaXRc3mZF0nhsUu/arcgis/rest/services/Canmore_Land_Use_Districts/FeatureServer/0", type: "FeatureServer" },
    },
    fields: {
      zoning: "LUC_CODE",
      zoningDescription: "DESCRIPTIO",
    },
    capabilities: ["zoning"],
    dataSource: "Town of Canmore Open Data",
    description: "305 land use districts in the Bow Valley. Zoning and land use data for one of Alberta's premier mountain communities.",
    color: "#0d9488",
    notes: ["No assessment values or parcel boundaries available via public API"],
  },

  // ── CENTRAL ALBERTA ────────────────────────────────────────

  {
    slug: "red-deer",
    name: "Red Deer",
    region: "central",
    population: 105000,
    status: "planned",
    endpoints: {
      parcels: { url: "https://services.arcgis.com/jTADFmGdo0XlHBdx/arcgis/rest/services/Property_Assessment/FeatureServer/0", type: "FeatureServer" },
    },
    fields: {
      assessmentValue: "ASSESSED_VALUE",
      address: "ADDRESS",
      zoning: "ZONE",
      neighbourhood: "NEIGHBOURHOOD",
      propertyClass: "PROPERTY_CLASS",
    },
    capabilities: ["assessments", "zoning"],
    filters: {
      assessmentWhere: "ASSESSED_VALUE > 0",
    },
    dataSource: "City of Red Deer ArcGIS",
    description: "Central Alberta's largest city — midpoint between Edmonton and Calgary. Property assessments with neighbourhood and zoning data.",
    color: "#b91c1c",
  },

  {
    slug: "camrose",
    name: "Camrose",
    region: "central",
    population: 19000,
    status: "live",
    endpoints: {
      assessments: { url: "https://services1.arcgis.com/2MfbdEdZ9gZBFEPt/arcgis/rest/services/PropertyInfo2026/FeatureServer/0", type: "FeatureServer" },
    },
    fields: {
      assessmentValue: "Total_Assessed_Value",
      address: "Address",
      zoning: "Zone_Code",
      yearBuilt: "Year_Built",
    },
    capabilities: ["assessments", "zoning"],
    filters: {
      assessmentWhere: "Total_Assessed_Value > 0",
    },
    dataSource: "City of Camrose ArcGIS",
    description: "8,600+ parcels with 2026 assessments, zoning, and year built. Historical assessment data available back to 2016.",
    color: "#0369a1",
  },

  {
    slug: "lloydminster",
    name: "Lloydminster",
    region: "central",
    population: 32000,
    status: "live",
    endpoints: {
      parcels: { url: "https://geo.lloydminster.ca/server/rest/services/Parcel_Basemap/MapServer/1", type: "MapServer" },
    },
    fields: {
      address: "Address",
      subdivision: "Subdivision",
      yearBuilt: "YearBuilt",
    },
    capabilities: ["zoning"],
    dataSource: "City of Lloydminster ArcGIS",
    description: "13,000 parcels on the Alberta/Saskatchewan border. Year built, subdivisions, and lot data.",
    color: "#ca8a04",
    notes: ["No dollar-value assessments available via public API"],
  },

  // ── SOUTHERN ALBERTA ───────────────────────────────────────

  {
    slug: "lethbridge",
    name: "Lethbridge",
    region: "south",
    population: 104000,
    status: "planned",
    endpoints: {
      parcels: { url: "https://opendata.lethbridge.ca/resource/assessment.json", type: "FeatureServer" },
    },
    fields: {
      assessmentValue: "assessed_value",
      address: "address",
      neighbourhood: "neighbourhood",
      propertyClass: "property_class",
    },
    capabilities: ["assessments"],
    filters: {
      assessmentWhere: "assessed_value > 0",
    },
    dataSource: "City of Lethbridge Open Data",
    description: "Southern Alberta's largest city. Property assessments with neighbourhood breakdowns.",
    color: "#059669",
    notes: ["Socrata endpoint not verified — may use ArcGIS Hub instead"],
  },

  {
    slug: "medicine-hat",
    name: "Medicine Hat",
    region: "south",
    population: 65000,
    status: "planned",
    endpoints: {
      parcels: { url: "https://services.arcgis.com/s2Ma2kMGCLsXMKot/arcgis/rest/services/Property_Assessment/FeatureServer/0", type: "FeatureServer" },
    },
    fields: {
      assessmentValue: "ASSESSED_VALUE",
      address: "ADDRESS",
      neighbourhood: "NEIGHBOURHOOD",
    },
    capabilities: ["assessments"],
    filters: {
      assessmentWhere: "ASSESSED_VALUE > 0",
    },
    dataSource: "City of Medicine Hat ArcGIS",
    description: "The Gas City — southeastern Alberta's hub with its own natural gas utility. Property assessment data.",
    color: "#d97706",
  },

  // ── NORTHERN ALBERTA ───────────────────────────────────────

  {
    slug: "grande-prairie",
    name: "Grande Prairie",
    region: "north",
    population: 69000,
    status: "planned",
    endpoints: {
      parcels: { url: "https://services.arcgis.com/bJpkR4sFBZZsmJMW/arcgis/rest/services/Property_Assessment/FeatureServer/0", type: "FeatureServer" },
    },
    fields: {
      assessmentValue: "ASSESSED_VALUE",
      address: "ADDRESS",
      neighbourhood: "NEIGHBOURHOOD",
    },
    capabilities: ["assessments"],
    filters: {
      assessmentWhere: "ASSESSED_VALUE > 0",
    },
    dataSource: "City of Grande Prairie ArcGIS",
    description: "Peace Country's economic hub. Property assessments for northwestern Alberta's largest city.",
    color: "#15803d",
  },

  {
    slug: "wood-buffalo",
    name: "Wood Buffalo (Fort McMurray)",
    region: "northeast",
    population: 75000,
    status: "planned",
    endpoints: {
      parcels: { url: "https://services.arcgis.com/SmKQbwDrtQGamLAC/arcgis/rest/services/Property_Assessment/FeatureServer/0", type: "FeatureServer" },
    },
    fields: {
      assessmentValue: "ASSESSED_VALUE",
      address: "ADDRESS",
      neighbourhood: "NEIGHBOURHOOD",
    },
    capabilities: ["assessments"],
    filters: {
      assessmentWhere: "ASSESSED_VALUE > 0",
    },
    dataSource: "Regional Municipality of Wood Buffalo ArcGIS",
    description: "Heart of the oil sands — Fort McMurray and surrounding communities. Property assessment data.",
    color: "#854d0e",
  },
];

// ============================================================
// Registry helpers
// ============================================================

export function getMunicipality(slug: string): MunicipalityConfig | undefined {
  return MUNICIPALITY_REGISTRY.find((m) => m.slug === slug);
}

export function getMunicipalitiesByRegion(): Record<MunicipalityRegion, MunicipalityConfig[]> {
  const result: Record<string, MunicipalityConfig[]> = {};
  for (const m of MUNICIPALITY_REGISTRY) {
    if (!result[m.region]) result[m.region] = [];
    result[m.region].push(m);
  }
  return result as Record<MunicipalityRegion, MunicipalityConfig[]>;
}

export function getLiveMunicipalities(): MunicipalityConfig[] {
  return MUNICIPALITY_REGISTRY.filter((m) => m.status === "live");
}

export const REGION_LABELS: Record<MunicipalityRegion, string> = {
  "edmonton-metro": "Edmonton Metro",
  "calgary-metro": "Calgary Metro",
  "central": "Central Alberta",
  "south": "Southern Alberta",
  "north": "Northern Alberta",
  "northwest": "Northwestern Alberta",
  "northeast": "Northeastern Alberta",
};

// Order for display
export const REGION_ORDER: MunicipalityRegion[] = [
  "edmonton-metro",
  "calgary-metro",
  "central",
  "south",
  "north",
  "northwest",
  "northeast",
];
