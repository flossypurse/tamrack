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
    slug: "edmonton",
    name: "Edmonton",
    region: "edmonton-metro",
    population: 1100000,
    status: "live",
    endpoints: {
      parcels: { url: "https://data.edmonton.ca/resource/q7d6-ambg.json", type: "FeatureServer" },
      permits: { url: "https://data.edmonton.ca/resource/rwuh-apwg.json", type: "FeatureServer" },
      businesses: { url: "https://data.edmonton.ca/resource/qhi4-bdpu.json", type: "FeatureServer" },
      devPermits: { url: "https://data.edmonton.ca/resource/q4gd-6q9r.json", type: "FeatureServer" },
      construction: { url: "https://data.edmonton.ca/resource/7wiq-4rgy.json", type: "FeatureServer" },
    },
    fields: {
      assessmentValue: "assessed_value",
      address: "address",
      neighbourhood: "neighbourhood",
      propertyClass: "tax_class",
      zoning: "zoning",
      permitType: "job_category",
      permitStatus: "status",
      permitDate: "issue_date",
      permitDescription: "description",
      permitAddress: "address",
      permitValue: "construction_value",
      businessName: "trade_name",
      businessCategory: "category",
      businessAddress: "address",
      projectName: "work_reason",
      projectStart: "start_date",
      projectEnd: "finish_date",
      projectLocation: "street_full_name",
    },
    capabilities: ["assessments", "permits", "businesses", "dev_permits", "construction"],
    filters: {
      assessmentWhere: "assessed_value > 0",
    },
    dataSource: "City of Edmonton Open Data (Socrata/SODA)",
    description: "Alberta's capital — 400K+ property assessments, building permits, business licences, development permits, and road construction via open data portal.",
    color: "#2563eb",
    notes: ["Uses Socrata SODA API", "Same architecture as Calgary endpoint"],
  },

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
    status: "live",
    endpoints: {},
    fields: {},
    capabilities: [],
    dataSource: "Alberta Regional Dashboard",
    description: "One of Alberta's fastest-growing bedroom communities south of Edmonton. Provincial indicators via Alberta Regional Dashboard.",
    color: "#8b5cf6",
    notes: ["No public ArcGIS assessment endpoint — regional dashboard indicators only"],
  },

  {
    slug: "fort-saskatchewan",
    name: "Fort Saskatchewan",
    region: "edmonton-metro",
    population: 28000,
    status: "live",
    endpoints: {
      assessments: { url: "https://gisweb.fortsask.ca/gisserver/rest/services/Assessment_Inquiry_MIL1/MapServer/0", type: "MapServer" },
    },
    fields: {
      assessmentValue: "curr_year",
      address: "full_address",
      yearBuilt: "year_built",
    },
    capabilities: ["assessments"],
    filters: {
      assessmentWhere: "curr_year > 0",
    },
    dataSource: "City of Fort Saskatchewan ArcGIS MapServer",
    description: "Heart of Alberta's Industrial Heartland — 15,400+ parcels with 5-year assessment history (2022-2026). Petrochemical corridor community.",
    color: "#3b8fdb",
    notes: ["Assessment data includes 5-year history (2022-2026)"],
  },

  {
    slug: "morinville",
    name: "Morinville",
    region: "edmonton-metro",
    population: 10000,
    status: "live",
    endpoints: {},
    fields: {},
    capabilities: [],
    dataSource: "Alberta Regional Dashboard",
    description: "Growing community north of Edmonton on Highway 2. Provincial indicators via Alberta Regional Dashboard.",
    color: "#f97316",
    notes: ["No public ArcGIS assessment endpoint — regional dashboard indicators only"],
  },

  {
    slug: "devon",
    name: "Devon",
    region: "edmonton-metro",
    population: 7000,
    status: "live",
    endpoints: {},
    fields: {},
    capabilities: [],
    dataSource: "Alberta Regional Dashboard",
    description: "Riverside town southwest of Edmonton near the Nisku industrial corridor. Provincial indicators via Alberta Regional Dashboard.",
    color: "#84cc16",
    notes: ["No public ArcGIS assessment endpoint — regional dashboard indicators only"],
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
    status: "live",
    endpoints: {
      zoning: { url: "https://services1.arcgis.com/bctnJobT0aahg98G/arcgis/rest/services/Airdrie_Land_Use_Districts/FeatureServer/0", type: "FeatureServer" },
      parcels: { url: "https://services1.arcgis.com/bctnJobT0aahg98G/arcgis/rest/services/Airdrie_Address_Points/FeatureServer/0", type: "FeatureServer" },
    },
    fields: {
      address: "ADDRESS",
      zoning: "LAND_USE_DISTRICT",
      zoningDescription: "DESCRIPTION",
    },
    capabilities: ["zoning"],
    dataSource: "City of Airdrie ArcGIS Hub",
    description: "Fast-growing city north of Calgary — land use districts updated weekly.",
    color: "#0ea5e9",
  },

  {
    slug: "cochrane",
    name: "Cochrane",
    region: "calgary-metro",
    population: 36000,
    status: "live",
    endpoints: {
      zoning: { url: "https://services5.arcgis.com/M1SNYuFIW9v2gSO7/arcgis/rest/services/Land_Use/FeatureServer/13", type: "FeatureServer" },
      parcels: { url: "https://services5.arcgis.com/M1SNYuFIW9v2gSO7/arcgis/rest/services/Address_Points/FeatureServer/4", type: "FeatureServer" },
    },
    fields: {
      address: "ADDRESS",
      zoning: "LAND_USE",
      neighbourhood: "NEIGHBOURHOOD",
    },
    capabilities: ["zoning"],
    dataSource: "Town of Cochrane GeoHub",
    description: "Rapidly growing town west of Calgary — 30+ datasets including population by neighbourhood.",
    color: "#6366f1",
  },

  {
    slug: "okotoks",
    name: "Okotoks",
    region: "calgary-metro",
    population: 33000,
    status: "live",
    endpoints: {},
    fields: {},
    capabilities: [],
    dataSource: "Alberta Regional Dashboard",
    description: "Community south of Calgary along the Sheep River. Provincial indicators via Alberta Regional Dashboard.",
    color: "#ec4899",
    notes: ["No public ArcGIS assessment endpoint — regional dashboard indicators only"],
  },

  {
    slug: "chestermere",
    name: "Chestermere",
    region: "calgary-metro",
    population: 24000,
    status: "live",
    endpoints: {},
    fields: {},
    capabilities: [],
    dataSource: "Alberta Regional Dashboard",
    description: "Lakeside community east of Calgary. Provincial indicators via Alberta Regional Dashboard.",
    color: "#2dd4bf",
    notes: ["No public ArcGIS assessment endpoint — regional dashboard indicators only"],
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

  {
    slug: "banff",
    name: "Banff",
    region: "calgary-metro",
    population: 9000,
    status: "live",
    endpoints: {
      parcels: { url: "https://maps.banff.ca/arcgis/rest/services/BanffOpenData/BanffOpenData/FeatureServer/1", type: "FeatureServer" },
      zoning: { url: "https://maps.banff.ca/arcgis/rest/services/BanffOpenData/BanffOpenData/FeatureServer/2", type: "FeatureServer" },
      devPermits: { url: "https://maps.banff.ca/arcgis/rest/services/DevelopmentPermitViewer/DevelopmentPermitViewer/MapServer/0", type: "MapServer" },
    },
    fields: {
      address: "ADDRESS",
      zoning: "LU_CODE",
      zoningDescription: "LU_DESC",
    },
    capabilities: ["zoning", "dev_permits"],
    dataSource: "Town of Banff ArcGIS",
    description: "Premier mountain community — 12 open data layers plus real-time parking and traffic counters.",
    color: "#14b8a6",
  },

  // ── CENTRAL ALBERTA ────────────────────────────────────────

  {
    slug: "red-deer",
    name: "Red Deer",
    region: "central",
    population: 105000,
    status: "live",
    endpoints: {},
    fields: {},
    capabilities: [],
    dataSource: "Alberta Regional Dashboard",
    description: "Central Alberta's largest city — midpoint between Edmonton and Calgary. Provincial indicators via Alberta Regional Dashboard.",
    color: "#b91c1c",
    notes: ["No public ArcGIS assessment endpoint — regional dashboard indicators only"],
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

  {
    slug: "sylvan-lake",
    name: "Sylvan Lake",
    region: "central",
    population: 16000,
    status: "live",
    endpoints: {
      zoning: { url: "https://geo.sylvanlake.ca/server/rest/services/LandUseService/MapServer/0", type: "MapServer" },
      parcels: { url: "https://geo.sylvanlake.ca/server/rest/services/ParcelForTownWebMap/FeatureServer/0", type: "FeatureServer" },
      devPermits: { url: "https://geo.sylvanlake.ca/server/rest/services/DevelopmentMapService/MapServer/0", type: "MapServer" },
      construction: { url: "https://geo.sylvanlake.ca/server/rest/services/TownProjects/FeatureServer/0", type: "FeatureServer" },
    },
    fields: {
      zoning: "LAND_USE",
      address: "ADDRESS",
      projectName: "PROJECT_NAME",
      projectPhase: "STATUS",
    },
    capabilities: ["zoning", "dev_permits", "construction"],
    dataSource: "Town of Sylvan Lake ArcGIS",
    description: "Popular lakeside community — comprehensive self-hosted ArcGIS with development, property, and land use data.",
    color: "#0891b2",
  },

  // ── SOUTHERN ALBERTA ───────────────────────────────────────

  {
    slug: "lethbridge",
    name: "Lethbridge",
    region: "south",
    population: 104000,
    status: "live",
    endpoints: {
      assessments: { url: "https://gis.lethbridge.ca/gisopendata/rest/services/OpenData/odl_parcels/MapServer/0", type: "MapServer" },
      parcels: { url: "https://gis.lethbridge.ca/gisopendata/rest/services/OpenData/odl_parcels/MapServer/0", type: "MapServer" },
      zoning: { url: "https://gis.lethbridge.ca/gisopendata/rest/services/OpenData/odl_landuse/MapServer/0", type: "MapServer" },
    },
    fields: {
      assessmentValue: "CurrGrossAssess",
      address: "Address",
      zoning: "Zone",
      zoningDescription: "ZoneDesc",
      neighbourhood: "Neighbourhood",
      subdivision: "Subdivision",
      propertyClass: "TaxClassDesc",
    },
    capabilities: ["assessments", "zoning"],
    filters: {
      assessmentWhere: "CurrGrossAssess > 0",
    },
    dataSource: "City of Lethbridge Open Data (ArcGIS MapServer)",
    description: "Southern Alberta's largest city — 43,900+ parcels with 3-year assessment history, tax data, neighbourhoods, zones, and subdivision info via ArcGIS.",
    color: "#059669",
    notes: ["Parcel data includes 3-year assessment and tax history", "Direct CSV also available: gis.lethbridge.ca/OpenData/DataSets/BuildingPermits.csv"],
  },

  {
    slug: "medicine-hat",
    name: "Medicine Hat",
    region: "south",
    population: 65000,
    status: "live",
    endpoints: {
      assessments: { url: "https://gis.medicinehat.ca/arcgis/rest/services/Assessment/Assessment_Map/MapServer/0", type: "MapServer" },
      construction: { url: "https://gis.medicinehat.ca/arcgis/rest/services/CityProjects/FeatureServer/0", type: "FeatureServer" },
    },
    fields: {
      assessmentValue: "ASSESSED_VALUE",
      address: "ADDRESS",
      projectName: "PROJECT_NAME",
      projectPhase: "STATUS",
    },
    capabilities: ["assessments", "construction"],
    dataSource: "City of Medicine Hat ArcGIS",
    description: "The Gas City — 18 ArcGIS folders covering assessments, electric, gas, fire, police, transit, parks.",
    color: "#d97706",
  },

  {
    slug: "brooks",
    name: "Brooks",
    region: "south",
    population: 15000,
    status: "live",
    endpoints: {
      parcels: { url: "https://gis.orrsc.com/server/rest/services/Brooks/Brooks_Property/MapServer/0", type: "MapServer" },
      zoning: { url: "https://gis.orrsc.com/server/rest/services/Brooks/Brooks_Cadastral/MapServer/0", type: "MapServer" },
    },
    fields: {
      address: "ADDRESS",
      zoning: "ZONE",
    },
    capabilities: ["zoning"],
    dataSource: "Brooks via ORRSC ArcGIS",
    description: "Southeast Alberta — property and infrastructure data hosted by Oldman River Regional Services Commission.",
    color: "#a16207",
  },

  // ── NORTHERN ALBERTA ───────────────────────────────────────

  {
    slug: "grande-prairie",
    name: "Grande Prairie",
    region: "north",
    population: 69000,
    status: "live",
    endpoints: {
      assessments: { url: "https://services.gpgis.com/server/rest/services/Assessment_Taxation/Assessment_Values/FeatureServer/0", type: "FeatureServer" },
      parcels: { url: "https://services.gpgis.com/server/rest/services/Property/Parcels_with_Address_Info/FeatureServer/0", type: "FeatureServer" },
      permits: { url: "https://services.gpgis.com/server/rest/services/Permitting_May_2022_MIL1/MapServer/2", type: "MapServer" },
      businesses: { url: "https://services.gpgis.com/server/rest/services/Hosted/City_of_Grande_Prairie_Business_Licenses/FeatureServer/0", type: "FeatureServer" },
      construction: { url: "https://services.gpgis.com/server/rest/services/Capital_Projects_Communications/Capital_Projects_Areas/FeatureServer/0", type: "FeatureServer" },
    },
    fields: {
      assessmentValue: "ASSESSED_VALUE",
      address: "ADDRESS",
      neighbourhood: "NEIGHBOURHOOD",
      projectName: "PROJECT_NAME",
      projectPhase: "STATUS",
      projectLocation: "LOCATION",
      permitType: "PermitType",
      permitStatus: "PermitStatus",
      permitDate: "DateIssued",
      permitDescription: "PermitDescription",
      permitValue: "Valuation",
      permitAddress: "Address",
      businessName: "business_name",
      businessCategory: "business_type",
      businessAddress: "physical_location",
    },
    capabilities: ["assessments", "permits", "businesses", "construction"],
    dataSource: "City of Grande Prairie ArcGIS",
    description: "Peace Country's economic hub — 24,400+ permits, 3,100+ business licences with NAICS codes and employee counts, assessments, and capital projects across 46 GIS data folders.",
    color: "#15803d",
  },

  {
    slug: "wood-buffalo",
    name: "Wood Buffalo (Fort McMurray)",
    region: "northeast",
    population: 75000,
    status: "live",
    endpoints: {},
    fields: {},
    capabilities: [],
    dataSource: "Alberta Regional Dashboard",
    description: "Heart of the oil sands — Fort McMurray and surrounding communities. Provincial indicators via Alberta Regional Dashboard.",
    color: "#854d0e",
    notes: ["No public ArcGIS assessment endpoint — regional dashboard indicators only"],
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
