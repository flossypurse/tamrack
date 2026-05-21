// ============================================================
// Chart Registry — metadata for every chart in the app
// Used by: /charts catalogue, /charts/[chartId] pages, sitemap, SEO
// Render logic lives in src/app/embed/[chartId]/page.tsx (resolveChart)
// ============================================================

export type ChartCategory =
  | "economy"
  | "real-estate"
  | "community"
  | "environment"
  | "governance"
  | "municipalities";

export type UpdateFrequency = "realtime" | "hourly" | "daily" | "weekly" | "monthly" | "quarterly" | "annual";

export interface ChartMeta {
  id: string;
  title: string;
  description: string;
  category: ChartCategory;
  subcategory: string;
  source: string;
  sourceUrl?: string;
  updateFrequency: UpdateFrequency;
  tags: string[];
  /** The page where this chart appears in context */
  pageHref: string;
}

// ============================================================
// Registry
// ============================================================

export const CHART_REGISTRY: ChartMeta[] = [
  // ──────────────────────────────────────────────────
  // ECONOMY — Energy
  // ──────────────────────────────────────────────────
  {
    id: "macro-energy-price",
    title: "BoC Energy Commodity Price Index",
    description: "Bank of Canada's energy commodity price index tracking oil, gas, and coal prices over 20 years.",
    category: "economy",
    subcategory: "Energy",
    source: "Bank of Canada Valet API",
    sourceUrl: "https://www.bankofcanada.ca/rates/price-indexes/bcpi/",
    updateFrequency: "daily",
    tags: ["energy", "commodities", "oil", "gas", "prices"],
    pageHref: "/economy/energy",
  },
  {
    id: "macro-all-commodities",
    title: "BoC All Commodities Index",
    description: "Broad commodity price index from Bank of Canada covering energy, metals, agriculture, and forestry.",
    category: "economy",
    subcategory: "Energy",
    source: "Bank of Canada Valet API",
    sourceUrl: "https://www.bankofcanada.ca/rates/price-indexes/bcpi/",
    updateFrequency: "daily",
    tags: ["commodities", "prices", "index"],
    pageHref: "/economy/energy",
  },
  {
    id: "macro-energy-vs-cad",
    title: "Energy Price vs CAD/USD",
    description: "Dual-axis comparison of energy commodity prices against the Canadian dollar exchange rate.",
    category: "economy",
    subcategory: "Energy",
    source: "Bank of Canada Valet API",
    updateFrequency: "daily",
    tags: ["energy", "currency", "cad", "usd", "correlation"],
    pageHref: "/economy/energy",
  },
  {
    id: "macro-non-energy",
    title: "Non-Energy Commodity Index",
    description: "Bank of Canada index for non-energy commodities — agriculture, metals, forestry.",
    category: "economy",
    subcategory: "Energy",
    source: "Bank of Canada Valet API",
    updateFrequency: "daily",
    tags: ["commodities", "non-energy", "agriculture", "metals"],
    pageHref: "/economy/energy",
  },
  {
    id: "macro-oil-gas-gdp",
    title: "Alberta Mining/Oil & Gas GDP",
    description: "GDP contribution from Alberta's mining, oil, and gas extraction sector over time.",
    category: "economy",
    subcategory: "Energy",
    source: "Statistics Canada 36-10-0402",
    sourceUrl: "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3610040201",
    updateFrequency: "quarterly",
    tags: ["gdp", "oil", "gas", "mining", "extraction"],
    pageHref: "/economy/energy",
  },
  {
    id: "macro-construction-gdp",
    title: "Alberta Construction GDP",
    description: "GDP contribution from Alberta's construction sector — a leading indicator of economic expansion.",
    category: "economy",
    subcategory: "Energy",
    source: "Statistics Canada 36-10-0402",
    updateFrequency: "quarterly",
    tags: ["gdp", "construction", "building"],
    pageHref: "/economy/energy",
  },
  {
    id: "macro-cad-usd",
    title: "CAD/USD Exchange Rate",
    description: "Canadian dollar vs US dollar exchange rate — a key variable for Alberta's export-driven economy.",
    category: "economy",
    subcategory: "Energy",
    source: "Bank of Canada Valet API",
    updateFrequency: "daily",
    tags: ["currency", "exchange", "cad", "usd", "dollar"],
    pageHref: "/economy/energy",
  },

  // ──────────────────────────────────────────────────
  // ECONOMY — Drilling
  // ──────────────────────────────────────────────────
  {
    id: "drilling-energy-index",
    title: "Energy Price Trends",
    description: "Energy commodity price trends informing drilling activity levels across Alberta.",
    category: "economy",
    subcategory: "Drilling",
    source: "Bank of Canada Valet API",
    updateFrequency: "daily",
    tags: ["energy", "drilling", "prices"],
    pageHref: "/economy/drilling",
  },
  {
    id: "drilling-oil-gas-gdp",
    title: "Oil & Gas GDP Trend",
    description: "Mining and oil & gas extraction GDP trend driving drilling investment.",
    category: "economy",
    subcategory: "Drilling",
    source: "Statistics Canada 36-10-0402",
    updateFrequency: "quarterly",
    tags: ["drilling", "gdp", "oil", "gas"],
    pageHref: "/economy/drilling",
  },
  {
    id: "drilling-energy-vs-cad",
    title: "Energy vs CAD/USD Correlation",
    description: "How energy commodity prices correlate with the Canadian dollar exchange rate.",
    category: "economy",
    subcategory: "Drilling",
    source: "Bank of Canada Valet API",
    updateFrequency: "daily",
    tags: ["drilling", "energy", "currency", "correlation"],
    pageHref: "/economy/drilling",
  },
  {
    id: "drilling-construction-gdp",
    title: "Construction Activity",
    description: "Construction sector GDP as a proxy for drilling infrastructure investment.",
    category: "economy",
    subcategory: "Drilling",
    source: "Statistics Canada 36-10-0402",
    updateFrequency: "quarterly",
    tags: ["drilling", "construction", "gdp"],
    pageHref: "/economy/drilling",
  },

  // ──────────────────────────────────────────────────
  // ECONOMY — Boom-Bust Cycle
  // ──────────────────────────────────────────────────
  {
    id: "macro-energy-vs-unemployment",
    title: "Energy Price vs Unemployment",
    description: "Alberta's boom-bust cycle visualized: energy commodity prices vs unemployment rate.",
    category: "economy",
    subcategory: "Boom-Bust Cycle",
    source: "Bank of Canada / Statistics Canada",
    updateFrequency: "monthly",
    tags: ["boom-bust", "energy", "unemployment", "cycle"],
    pageHref: "/economy/boom-bust",
  },
  {
    id: "macro-energy-vs-housing",
    title: "Energy Price vs Housing Starts",
    description: "How energy price swings drive housing construction activity in Alberta.",
    category: "economy",
    subcategory: "Boom-Bust Cycle",
    source: "Bank of Canada / CMHC",
    updateFrequency: "monthly",
    tags: ["boom-bust", "energy", "housing", "starts"],
    pageHref: "/economy/boom-bust",
  },
  {
    id: "macro-gdp",
    title: "Alberta Real GDP",
    description: "Alberta's real gross domestic product — the broadest measure of economic output.",
    category: "economy",
    subcategory: "Boom-Bust Cycle",
    source: "Statistics Canada 36-10-0402",
    updateFrequency: "quarterly",
    tags: ["gdp", "economy", "output"],
    pageHref: "/economy/boom-bust",
  },
  {
    id: "macro-cpi",
    title: "Alberta CPI (All Items)",
    description: "Consumer price index for Alberta — tracks inflation across goods and services.",
    category: "economy",
    subcategory: "Boom-Bust Cycle",
    source: "Statistics Canada 18-10-0004",
    updateFrequency: "monthly",
    tags: ["cpi", "inflation", "prices", "consumer"],
    pageHref: "/economy/boom-bust",
  },
  {
    id: "macro-aax",
    title: "Alberta Activity Index (AAX)",
    description: "Alberta Treasury Board's composite economic activity index — monthly pulse of the province.",
    category: "economy",
    subcategory: "Boom-Bust Cycle",
    source: "Alberta Open Data",
    updateFrequency: "monthly",
    tags: ["activity", "composite", "index", "aax"],
    pageHref: "/economy/boom-bust",
  },

  // ──────────────────────────────────────────────────
  // ECONOMY — Diversification
  // ──────────────────────────────────────────────────
  {
    id: "macro-gdp-by-industry",
    title: "GDP by Industry — Alberta",
    description: "Multi-line comparison of GDP across 6 major Alberta industries: oil/gas, construction, manufacturing, tech, real estate, agriculture.",
    category: "economy",
    subcategory: "Diversification",
    source: "Statistics Canada 36-10-0402",
    updateFrequency: "quarterly",
    tags: ["gdp", "industry", "diversification", "sectors"],
    pageHref: "/economy/diversification",
  },
  {
    id: "macro-oil-gas-share",
    title: "Oil & Gas Share of GDP",
    description: "What percentage of Alberta's total GDP comes from oil and gas extraction — the diversification metric.",
    category: "economy",
    subcategory: "Diversification",
    source: "Statistics Canada 36-10-0402",
    updateFrequency: "quarterly",
    tags: ["oil", "gas", "gdp", "share", "diversification"],
    pageHref: "/economy/diversification",
  },
  {
    id: "macro-tech-gdp",
    title: "Tech & Professional Services GDP",
    description: "Growth of Alberta's technology and professional services sector GDP.",
    category: "economy",
    subcategory: "Diversification",
    source: "Statistics Canada 36-10-0402",
    updateFrequency: "quarterly",
    tags: ["tech", "professional", "gdp", "diversification"],
    pageHref: "/economy/diversification",
  },
  {
    id: "macro-business-licences",
    title: "Edmonton Business Licences",
    description: "Monthly trend of new business licences issued in Edmonton — a proxy for entrepreneurial activity.",
    category: "economy",
    subcategory: "Diversification",
    source: "Edmonton Open Data",
    updateFrequency: "monthly",
    tags: ["business", "licences", "edmonton", "entrepreneurship"],
    pageHref: "/economy/diversification",
  },
  {
    id: "macro-building-permits",
    title: "Edmonton Building Permits",
    description: "Monthly building permit activity in Edmonton — leading indicator of construction growth.",
    category: "economy",
    subcategory: "Diversification",
    source: "Edmonton Open Data",
    updateFrequency: "monthly",
    tags: ["permits", "building", "edmonton", "construction"],
    pageHref: "/economy/diversification",
  },

  // ──────────────────────────────────────────────────
  // ECONOMY — Agriculture
  // ──────────────────────────────────────────────────
  {
    id: "macro-ag-commodity",
    title: "BoC Agriculture Commodity Price Index",
    description: "Bank of Canada price index for agricultural commodities — wheat, canola, cattle, and more.",
    category: "economy",
    subcategory: "Agriculture",
    source: "Bank of Canada Valet API",
    updateFrequency: "daily",
    tags: ["agriculture", "commodities", "prices", "farming"],
    pageHref: "/economy/agriculture",
  },
  {
    id: "macro-ag-gdp",
    title: "Agriculture GDP — Alberta",
    description: "Alberta's agriculture sector GDP contribution over time.",
    category: "economy",
    subcategory: "Agriculture",
    source: "Statistics Canada 36-10-0402",
    updateFrequency: "quarterly",
    tags: ["agriculture", "gdp", "farming"],
    pageHref: "/economy/agriculture",
  },
  {
    id: "macro-farm-receipts",
    title: "Farm Cash Receipts — Alberta",
    description: "Total farm cash receipts for Alberta — the income side of agriculture.",
    category: "economy",
    subcategory: "Agriculture",
    source: "Statistics Canada 32-10-0045",
    updateFrequency: "quarterly",
    tags: ["agriculture", "farm", "receipts", "income"],
    pageHref: "/economy/agriculture",
  },
  {
    id: "macro-crop-vs-livestock",
    title: "Crop vs Livestock Receipts",
    description: "Side-by-side comparison of Alberta's crop and livestock farm cash receipts.",
    category: "economy",
    subcategory: "Agriculture",
    source: "Statistics Canada 32-10-0045",
    updateFrequency: "quarterly",
    tags: ["agriculture", "crop", "livestock", "receipts"],
    pageHref: "/economy/agriculture",
  },
  {
    id: "macro-ag-vs-energy",
    title: "Agriculture vs Energy Commodity Prices",
    description: "Dual-axis comparison showing how agriculture and energy commodity prices move together.",
    category: "economy",
    subcategory: "Agriculture",
    source: "Bank of Canada Valet API",
    updateFrequency: "daily",
    tags: ["agriculture", "energy", "commodities", "correlation"],
    pageHref: "/economy/agriculture",
  },

  // ──────────────────────────────────────────────────
  // ECONOMY — Macro (policy, rates)
  // ──────────────────────────────────────────────────
  {
    id: "macro-policy-rate",
    title: "BoC Policy Rate",
    description: "Bank of Canada's overnight target rate — the most important interest rate in Canada.",
    category: "economy",
    subcategory: "Macro",
    source: "Bank of Canada Valet API",
    sourceUrl: "https://www.bankofcanada.ca/rates/interest-rates/key-interest-rates/",
    updateFrequency: "daily",
    tags: ["interest", "rate", "boc", "policy", "overnight"],
    pageHref: "/economy/boom-bust",
  },
  {
    id: "macro-unemployment",
    title: "Alberta Unemployment Rate",
    description: "Monthly unemployment rate for Alberta from the Labour Force Survey.",
    category: "economy",
    subcategory: "Macro",
    source: "Statistics Canada 14-10-0287",
    updateFrequency: "monthly",
    tags: ["unemployment", "labour", "jobs"],
    pageHref: "/community/labour",
  },
  {
    id: "macro-population",
    title: "Alberta Population",
    description: "Alberta's total population estimate — quarterly updates from Statistics Canada.",
    category: "economy",
    subcategory: "Macro",
    source: "Statistics Canada 17-10-0005",
    updateFrequency: "quarterly",
    tags: ["population", "demographics", "growth"],
    pageHref: "/community/immigration",
  },

  // ──────────────────────────────────────────────────
  // ECONOMY — Retail
  // ──────────────────────────────────────────────────
  {
    id: "economy-retail-total-sales",
    title: "Alberta Total Retail Sales",
    description: "Monthly retail trade sales for Alberta across all store types.",
    category: "economy",
    subcategory: "Retail Trade",
    source: "Statistics Canada 20-10-0056",
    updateFrequency: "monthly",
    tags: ["retail", "sales", "consumer", "spending"],
    pageHref: "/economy/retail",
  },
  {
    id: "economy-retail-subsectors",
    title: "Retail Sales by Subsector",
    description: "Alberta retail sales broken down by 11 subsectors — motor vehicles, food, clothing, electronics, and more.",
    category: "economy",
    subcategory: "Retail Trade",
    source: "Statistics Canada 20-10-0056",
    updateFrequency: "monthly",
    tags: ["retail", "subsectors", "categories", "spending"],
    pageHref: "/economy/retail",
  },
  {
    id: "economy-retail-ecommerce-share",
    title: "E-Commerce Share of Retail",
    description: "What percentage of Alberta retail sales happen online vs in-store.",
    category: "economy",
    subcategory: "Retail Trade",
    source: "Statistics Canada 20-10-0056",
    updateFrequency: "monthly",
    tags: ["ecommerce", "online", "retail", "digital"],
    pageHref: "/economy/retail",
  },
  {
    id: "economy-retail-ecommerce-sales",
    title: "E-Commerce Sales Volume",
    description: "Monthly e-commerce retail sales volume for Alberta.",
    category: "economy",
    subcategory: "Retail Trade",
    source: "Statistics Canada 20-10-0056",
    updateFrequency: "monthly",
    tags: ["ecommerce", "online", "sales", "volume"],
    pageHref: "/economy/retail",
  },
  {
    id: "economy-retail-food-services",
    title: "Food Services Revenue Trend",
    description: "Monthly food services and drinking places revenue for Alberta.",
    category: "economy",
    subcategory: "Retail Trade",
    source: "Statistics Canada 21-10-0019",
    updateFrequency: "monthly",
    tags: ["food", "restaurants", "hospitality", "dining"],
    pageHref: "/economy/retail",
  },
  {
    id: "economy-retail-food-services-total",
    title: "Food Services Total Revenue",
    description: "Total food services industry revenue for Alberta — restaurants, cafes, bars.",
    category: "economy",
    subcategory: "Retail Trade",
    source: "Statistics Canada 21-10-0019",
    updateFrequency: "monthly",
    tags: ["food", "restaurants", "revenue", "total"],
    pageHref: "/economy/retail",
  },

  // ──────────────────────────────────────────────────
  // ECONOMY — Cannabis
  // ──────────────────────────────────────────────────
  {
    id: "economy-cannabis-monthly-sales",
    title: "Alberta Cannabis Monthly Sales",
    description: "Monthly legal cannabis retail sales in Alberta.",
    category: "economy",
    subcategory: "Cannabis",
    source: "Statistics Canada",
    updateFrequency: "monthly",
    tags: ["cannabis", "retail", "sales", "marijuana"],
    pageHref: "/economy/cannabis",
  },
  {
    id: "economy-cannabis-sales-trend",
    title: "Cannabis Sales Trend",
    description: "Long-term trend of legal cannabis sales in Alberta since legalization.",
    category: "economy",
    subcategory: "Cannabis",
    source: "Statistics Canada",
    updateFrequency: "monthly",
    tags: ["cannabis", "trend", "growth"],
    pageHref: "/economy/cannabis",
  },
  {
    id: "economy-cannabis-retail-share",
    title: "Cannabis Retail Share",
    description: "Cannabis as a percentage of total Alberta retail sales.",
    category: "economy",
    subcategory: "Cannabis",
    source: "Statistics Canada",
    updateFrequency: "monthly",
    tags: ["cannabis", "retail", "share", "percentage"],
    pageHref: "/economy/cannabis",
  },
  {
    id: "economy-cannabis-product-type",
    title: "Cannabis Sales by Product Type",
    description: "Breakdown of cannabis sales by product category — dried flower, edibles, extracts, accessories.",
    category: "economy",
    subcategory: "Cannabis",
    source: "Statistics Canada",
    updateFrequency: "monthly",
    tags: ["cannabis", "products", "categories"],
    pageHref: "/economy/cannabis",
  },

  // ──────────────────────────────────────────────────
  // ECONOMY — Business Dynamics
  // ──────────────────────────────────────────────────
  {
    id: "economy-biz-all-dynamics",
    title: "Business Openings & Closures — All Industries",
    description: "Monthly business openings vs closures across all NAICS industries in Alberta.",
    category: "economy",
    subcategory: "Business Dynamics",
    source: "Statistics Canada 33-10-0270",
    updateFrequency: "monthly",
    tags: ["business", "openings", "closures", "dynamics"],
    pageHref: "/economy/businesses",
  },
  {
    id: "economy-biz-active-count",
    title: "Active Business Count",
    description: "Total count of active businesses in Alberta over time.",
    category: "economy",
    subcategory: "Business Dynamics",
    source: "Statistics Canada 33-10-0270",
    updateFrequency: "monthly",
    tags: ["business", "count", "active"],
    pageHref: "/economy/businesses",
  },
  {
    id: "economy-biz-retail-dynamics",
    title: "Retail Trade Business Dynamics",
    description: "Business openings and closures in Alberta's retail trade sector.",
    category: "economy",
    subcategory: "Business Dynamics",
    source: "Statistics Canada 33-10-0270",
    updateFrequency: "monthly",
    tags: ["business", "retail", "openings", "closures"],
    pageHref: "/economy/businesses",
  },
  {
    id: "economy-biz-food-dynamics",
    title: "Food Services Business Dynamics",
    description: "Business openings and closures in Alberta's food services and accommodation sector.",
    category: "economy",
    subcategory: "Business Dynamics",
    source: "Statistics Canada 33-10-0270",
    updateFrequency: "monthly",
    tags: ["business", "food", "restaurants", "openings", "closures"],
    pageHref: "/economy/businesses",
  },
  {
    id: "economy-biz-edmonton-licence-trend",
    title: "Edmonton Business Licence Trend",
    description: "Monthly business licence issuance trend in Edmonton by category.",
    category: "economy",
    subcategory: "Business Dynamics",
    source: "Edmonton Open Data",
    updateFrequency: "monthly",
    tags: ["business", "licences", "edmonton", "trend"],
    pageHref: "/economy/businesses",
  },

  // ──────────────────────────────────────────────────
  // ECONOMY — Benchmarks
  // ──────────────────────────────────────────────────
  {
    id: "bench-avg-assessment",
    title: "Average Assessment by Municipality",
    description: "Side-by-side comparison of average property assessment values across Alberta municipalities.",
    category: "economy",
    subcategory: "Benchmarks",
    source: "Municipal ArcGIS",
    updateFrequency: "annual",
    tags: ["assessment", "property", "comparison", "municipalities"],
    pageHref: "/economy/benchmarks",
  },
  {
    id: "bench-parcel-count",
    title: "Total Parcels by Municipality",
    description: "Property parcel counts compared across Alberta municipalities.",
    category: "economy",
    subcategory: "Benchmarks",
    source: "Municipal ArcGIS",
    updateFrequency: "annual",
    tags: ["parcels", "property", "comparison", "count"],
    pageHref: "/economy/benchmarks",
  },
  {
    id: "bench-vacant-lots",
    title: "Vacant Lots by Municipality",
    description: "Vacant lot counts compared across Alberta municipalities — a proxy for development capacity.",
    category: "economy",
    subcategory: "Benchmarks",
    source: "Municipal ArcGIS",
    updateFrequency: "annual",
    tags: ["vacant", "lots", "development", "capacity"],
    pageHref: "/economy/benchmarks",
  },
  {
    id: "bench-businesses",
    title: "Active Businesses by Municipality",
    description: "Active business counts compared across Alberta municipalities.",
    category: "economy",
    subcategory: "Benchmarks",
    source: "Municipal ArcGIS",
    updateFrequency: "annual",
    tags: ["business", "count", "comparison", "municipalities"],
    pageHref: "/economy/benchmarks",
  },

  // ──────────────────────────────────────────────────
  // ECONOMY — Risk & Investment
  // ──────────────────────────────────────────────────
  {
    id: "risk-unemployment",
    title: "Alberta Unemployment Rate — Risk View",
    description: "Unemployment rate with risk-scoring thresholds for market timing.",
    category: "economy",
    subcategory: "Market Risk",
    source: "Statistics Canada 14-10-0287",
    updateFrequency: "monthly",
    tags: ["risk", "unemployment", "analysis"],
    pageHref: "/economy/risk",
  },
  {
    id: "risk-rate-vs-starts",
    title: "Policy Rate vs Housing Starts",
    description: "Dual-axis chart showing how BoC rate changes affect housing start volumes.",
    category: "economy",
    subcategory: "Market Risk",
    source: "Bank of Canada / Statistics Canada",
    updateFrequency: "monthly",
    tags: ["risk", "interest", "rate", "housing", "starts"],
    pageHref: "/economy/risk",
  },
  {
    id: "risk-energy-vs-unemployment",
    title: "Energy Index vs Unemployment — Risk",
    description: "Energy price movements as a leading indicator of unemployment risk.",
    category: "economy",
    subcategory: "Market Risk",
    source: "Bank of Canada / Statistics Canada",
    updateFrequency: "monthly",
    tags: ["risk", "energy", "unemployment", "leading"],
    pageHref: "/economy/risk",
  },
  {
    id: "cycle-timeline",
    title: "Economic Cycle Timeline",
    description: "Alberta's economic cycles visualized with historical boom/bust period overlays.",
    category: "economy",
    subcategory: "Cycle Position",
    source: "Bank of Canada / Statistics Canada",
    updateFrequency: "monthly",
    tags: ["cycle", "timeline", "boom", "bust", "history"],
    pageHref: "/economy/cycle-position",
  },

  // ──────────────────────────────────────────────────
  // ECONOMY — Investment Thesis
  // ──────────────────────────────────────────────────
  {
    id: "invest-policy-rate",
    title: "BoC Policy Rate Trend — Investment View",
    description: "Policy rate trend for investment timing analysis.",
    category: "economy",
    subcategory: "Investment",
    source: "Bank of Canada Valet API",
    updateFrequency: "daily",
    tags: ["investment", "rate", "policy", "boc"],
    pageHref: "/economy/invest",
  },
  {
    id: "invest-energy-index",
    title: "Energy Commodity Index — Investment View",
    description: "Energy commodity price index for Alberta investment thesis analysis.",
    category: "economy",
    subcategory: "Investment",
    source: "Bank of Canada Valet API",
    updateFrequency: "daily",
    tags: ["investment", "energy", "commodities"],
    pageHref: "/economy/invest",
  },
  {
    id: "invest-energy-vs-cad",
    title: "Energy vs CAD/USD — Investment View",
    description: "Energy-currency correlation for cross-border investment analysis.",
    category: "economy",
    subcategory: "Investment",
    source: "Bank of Canada Valet API",
    updateFrequency: "daily",
    tags: ["investment", "energy", "currency"],
    pageHref: "/economy/invest",
  },
  {
    id: "invest-employment",
    title: "Alberta Employment — Investment View",
    description: "Employment trend for assessing labour market strength.",
    category: "economy",
    subcategory: "Investment",
    source: "Statistics Canada 14-10-0287",
    updateFrequency: "monthly",
    tags: ["investment", "employment", "labour"],
    pageHref: "/economy/invest",
  },
  {
    id: "invest-migration",
    title: "Net Interprovincial Migration — Investment View",
    description: "Migration flows as a demand signal for Alberta investment.",
    category: "economy",
    subcategory: "Investment",
    source: "Statistics Canada 17-10-0008",
    updateFrequency: "quarterly",
    tags: ["investment", "migration", "demand"],
    pageHref: "/economy/invest",
  },
  {
    id: "invest-housing-starts",
    title: "Edmonton CMA Housing Starts — Investment View",
    description: "Housing starts as a construction cycle indicator.",
    category: "economy",
    subcategory: "Investment",
    source: "Statistics Canada",
    updateFrequency: "monthly",
    tags: ["investment", "housing", "starts", "construction"],
    pageHref: "/economy/invest",
  },
  {
    id: "invest-permit-value",
    title: "Edmonton CMA Residential Permit Value",
    description: "Total value of residential building permits — a forward-looking construction indicator.",
    category: "economy",
    subcategory: "Investment",
    source: "Statistics Canada",
    updateFrequency: "monthly",
    tags: ["investment", "permits", "value", "residential"],
    pageHref: "/economy/invest",
  },

  // ──────────────────────────────────────────────────
  // REAL ESTATE — Market
  // ──────────────────────────────────────────────────
  {
    id: "re-metro-dwelling-units",
    title: "Edmonton CMA — Dwelling Units Created",
    description: "Monthly dwelling unit creation in the Edmonton census metropolitan area.",
    category: "real-estate",
    subcategory: "Market",
    source: "Statistics Canada",
    updateFrequency: "monthly",
    tags: ["housing", "units", "edmonton", "dwelling"],
    pageHref: "/real-estate/market",
  },
  {
    id: "re-metro-permit-value",
    title: "Edmonton CMA — Residential Permit Value",
    description: "Total residential building permit value in Edmonton CMA — a forward indicator of construction.",
    category: "real-estate",
    subcategory: "Market",
    source: "Statistics Canada",
    updateFrequency: "monthly",
    tags: ["permits", "value", "edmonton", "residential"],
    pageHref: "/real-estate/market",
  },
  {
    id: "re-metro-single-family",
    title: "Edmonton CMA — Single-Family Units",
    description: "Single-family dwelling units created in the Edmonton CMA.",
    category: "real-estate",
    subcategory: "Market",
    source: "Statistics Canada",
    updateFrequency: "monthly",
    tags: ["housing", "single-family", "edmonton"],
    pageHref: "/real-estate/market",
  },
  {
    id: "re-edmonton-road-construction-types",
    title: "Edmonton — Construction Permits by Type",
    description: "Breakdown of construction permit types in Edmonton.",
    category: "real-estate",
    subcategory: "Market",
    source: "City of Edmonton",
    updateFrequency: "daily",
    tags: ["permits", "construction", "types", "edmonton"],
    pageHref: "/real-estate/market",
  },
  {
    id: "re-major-projects-sector",
    title: "Major Projects Investment by Sector",
    description: "Alberta major projects ($5M+) broken down by sector — oil/gas, infrastructure, commercial.",
    category: "real-estate",
    subcategory: "Market",
    source: "Alberta Major Projects",
    updateFrequency: "monthly",
    tags: ["projects", "investment", "sectors", "major"],
    pageHref: "/real-estate/market",
  },
  {
    id: "re-edmonton-new-units",
    title: "Edmonton — New Housing Units Permitted",
    description: "Newly permitted housing units in Edmonton by neighbourhood.",
    category: "real-estate",
    subcategory: "Market",
    source: "City of Edmonton",
    updateFrequency: "daily",
    tags: ["housing", "units", "permits", "edmonton"],
    pageHref: "/real-estate/market",
  },
  {
    id: "re-edmonton-hot-zones",
    title: "Edmonton — Where New Homes Are Being Built",
    description: "Top neighbourhoods for new home construction permits in Edmonton.",
    category: "real-estate",
    subcategory: "Market",
    source: "City of Edmonton",
    updateFrequency: "daily",
    tags: ["housing", "construction", "neighbourhoods", "edmonton"],
    pageHref: "/real-estate/market",
  },
  {
    id: "re-edmonton-construction-value",
    title: "Edmonton — Construction $ by Neighbourhood",
    description: "Total construction permit value by neighbourhood in Edmonton.",
    category: "real-estate",
    subcategory: "Market",
    source: "City of Edmonton",
    updateFrequency: "daily",
    tags: ["construction", "value", "neighbourhoods", "edmonton"],
    pageHref: "/real-estate/market",
  },
  {
    id: "re-edmonton-high-assessments",
    title: "Edmonton — Highest Assessed Neighbourhoods",
    description: "Top Edmonton neighbourhoods by average property assessment value.",
    category: "real-estate",
    subcategory: "Market",
    source: "City of Edmonton",
    updateFrequency: "annual",
    tags: ["assessment", "neighbourhoods", "property", "edmonton"],
    pageHref: "/real-estate/market",
  },
  {
    id: "re-edmonton-redeveloping",
    title: "Edmonton — Redeveloping Neighbourhoods",
    description: "Edmonton neighbourhoods with the highest redevelopment activity.",
    category: "real-estate",
    subcategory: "Market",
    source: "City of Edmonton",
    updateFrequency: "daily",
    tags: ["redevelopment", "neighbourhoods", "edmonton"],
    pageHref: "/real-estate/market",
  },
  {
    id: "re-edmonton-renovation",
    title: "Edmonton — Home Improvement Hotspots",
    description: "Edmonton neighbourhoods with the most renovation permit activity.",
    category: "real-estate",
    subcategory: "Market",
    source: "City of Edmonton",
    updateFrequency: "daily",
    tags: ["renovation", "improvement", "permits", "edmonton"],
    pageHref: "/real-estate/market",
  },
  {
    id: "re-strathcona-subdivisions",
    title: "Strathcona County — Hot Subdivisions",
    description: "Top subdivisions by development activity in Strathcona County.",
    category: "real-estate",
    subcategory: "Market",
    source: "Strathcona County",
    updateFrequency: "daily",
    tags: ["subdivisions", "strathcona", "development"],
    pageHref: "/real-estate/market",
  },
  {
    id: "re-strathcona-assessments",
    title: "Strathcona County — Assessments by Type",
    description: "Property assessments by type in Strathcona County.",
    category: "real-estate",
    subcategory: "Market",
    source: "Strathcona County",
    updateFrequency: "annual",
    tags: ["assessment", "strathcona", "property"],
    pageHref: "/real-estate/market",
  },
  {
    id: "re-stalbert-assessments",
    title: "St. Albert — Assessments by Neighbourhood",
    description: "Property assessments by neighbourhood in St. Albert.",
    category: "real-estate",
    subcategory: "Market",
    source: "City of St. Albert",
    updateFrequency: "annual",
    tags: ["assessment", "st-albert", "neighbourhoods"],
    pageHref: "/real-estate/market",
  },

  // ──────────────────────────────────────────────────
  // REAL ESTATE — CMHC Housing
  // ──────────────────────────────────────────────────
  {
    id: "re-cmhc-housing-starts",
    title: "Housing Starts — Edmonton vs Calgary",
    description: "Monthly housing starts compared between Edmonton and Calgary CMAs.",
    category: "real-estate",
    subcategory: "CMHC Housing",
    source: "CMHC",
    updateFrequency: "monthly",
    tags: ["housing", "starts", "edmonton", "calgary", "cmhc"],
    pageHref: "/real-estate/market",
  },
  {
    id: "re-cmhc-completions",
    title: "Housing Completions — Edmonton vs Calgary",
    description: "Monthly housing completions compared between Edmonton and Calgary.",
    category: "real-estate",
    subcategory: "CMHC Housing",
    source: "CMHC",
    updateFrequency: "monthly",
    tags: ["housing", "completions", "edmonton", "calgary"],
    pageHref: "/real-estate/market",
  },
  {
    id: "re-cmhc-under-construction",
    title: "Under Construction — Edmonton vs Calgary",
    description: "Units under construction compared between Edmonton and Calgary.",
    category: "real-estate",
    subcategory: "CMHC Housing",
    source: "CMHC",
    updateFrequency: "monthly",
    tags: ["housing", "construction", "edmonton", "calgary"],
    pageHref: "/real-estate/market",
  },
  {
    id: "re-cmhc-mortgage-rate",
    title: "5-Year Conventional Mortgage Rate",
    description: "CMHC 5-year fixed conventional mortgage rate — the benchmark for homebuyer costs.",
    category: "real-estate",
    subcategory: "CMHC Housing",
    source: "CMHC",
    updateFrequency: "monthly",
    tags: ["mortgage", "rate", "cmhc", "interest"],
    pageHref: "/real-estate/market",
  },

  // ──────────────────────────────────────────────────
  // REAL ESTATE — Pipeline
  // ──────────────────────────────────────────────────
  {
    id: "re-housing-starts",
    title: "Housing Starts — Edmonton CMA",
    description: "Monthly housing starts in the Edmonton census metropolitan area.",
    category: "real-estate",
    subcategory: "Pipeline",
    source: "Statistics Canada",
    updateFrequency: "monthly",
    tags: ["housing", "starts", "edmonton", "pipeline"],
    pageHref: "/real-estate/pipeline",
  },
  {
    id: "re-housing-completions",
    title: "Housing Completions — Edmonton CMA",
    description: "Monthly housing completions in the Edmonton CMA.",
    category: "real-estate",
    subcategory: "Pipeline",
    source: "Statistics Canada",
    updateFrequency: "monthly",
    tags: ["housing", "completions", "edmonton"],
    pageHref: "/real-estate/pipeline",
  },
  {
    id: "re-under-construction",
    title: "Units Under Construction — Edmonton CMA",
    description: "Total units under construction in the Edmonton CMA at any given time.",
    category: "real-estate",
    subcategory: "Pipeline",
    source: "Statistics Canada",
    updateFrequency: "monthly",
    tags: ["housing", "construction", "units", "edmonton"],
    pageHref: "/real-estate/pipeline",
  },
  {
    id: "re-pipeline-overlay",
    title: "Full Pipeline Overlay",
    description: "Multi-series overlay of starts, completions, and under-construction for the Edmonton CMA.",
    category: "real-estate",
    subcategory: "Pipeline",
    source: "Statistics Canada",
    updateFrequency: "monthly",
    tags: ["pipeline", "overlay", "starts", "completions", "construction"],
    pageHref: "/real-estate/pipeline",
  },
  {
    id: "re-starts-vs-permits",
    title: "Housing Starts vs Permit Value",
    description: "Dual-axis chart comparing housing starts with residential permit values.",
    category: "real-estate",
    subcategory: "Pipeline",
    source: "Statistics Canada",
    updateFrequency: "monthly",
    tags: ["starts", "permits", "value", "comparison"],
    pageHref: "/real-estate/pipeline",
  },

  // ──────────────────────────────────────────────────
  // REAL ESTATE — Rental
  // ──────────────────────────────────────────────────
  {
    id: "re-rental-vacancy-compare",
    title: "Rental Vacancy Rate — Edmonton vs Calgary",
    description: "CMHC rental vacancy rates compared between Edmonton and Calgary.",
    category: "real-estate",
    subcategory: "Rental",
    source: "CMHC",
    updateFrequency: "annual",
    tags: ["rental", "vacancy", "edmonton", "calgary"],
    pageHref: "/real-estate/rental",
  },
  {
    id: "re-rent-trends-compare",
    title: "Average Rents — Edmonton vs Calgary",
    description: "Average 1-bed and 2-bed rents compared between Edmonton and Calgary.",
    category: "real-estate",
    subcategory: "Rental",
    source: "CMHC",
    updateFrequency: "annual",
    tags: ["rental", "rents", "average", "edmonton", "calgary"],
    pageHref: "/real-estate/rental",
  },
  {
    id: "re-rent-edm-breakdown",
    title: "Edmonton Rents by Unit Type",
    description: "Average rents in Edmonton broken down by unit type — bachelor, 1-bed, 2-bed, 3-bed+.",
    category: "real-estate",
    subcategory: "Rental",
    source: "CMHC",
    updateFrequency: "annual",
    tags: ["rental", "rents", "edmonton", "unit-type"],
    pageHref: "/real-estate/rental",
  },
  {
    id: "re-rent-cal-breakdown",
    title: "Calgary Rents by Unit Type",
    description: "Average rents in Calgary broken down by unit type.",
    category: "real-estate",
    subcategory: "Rental",
    source: "CMHC",
    updateFrequency: "annual",
    tags: ["rental", "rents", "calgary", "unit-type"],
    pageHref: "/real-estate/rental",
  },
  {
    id: "re-vacancy-vs-starts",
    title: "Edmonton Vacancy Rate vs Housing Starts",
    description: "Dual-axis view showing how vacancy rates relate to new housing starts.",
    category: "real-estate",
    subcategory: "Rental",
    source: "CMHC",
    updateFrequency: "annual",
    tags: ["vacancy", "starts", "housing", "edmonton"],
    pageHref: "/real-estate/rental",
  },

  // ──────────────────────────────────────────────────
  // REAL ESTATE — Assessments
  // ──────────────────────────────────────────────────
  {
    id: "re-assessment-city-trend",
    title: "City-Wide Assessment Trends",
    description: "Multi-year assessment value trends across major Alberta cities.",
    category: "real-estate",
    subcategory: "Assessments",
    source: "UAlberta Open Data Centre",
    updateFrequency: "annual",
    tags: ["assessment", "trends", "cities", "property"],
    pageHref: "/real-estate/assessments",
  },
  {
    id: "re-assessment-edm-top",
    title: "Edmonton — Top Assessed Neighbourhoods",
    description: "Highest average assessment neighbourhoods in Edmonton from UAlberta data.",
    category: "real-estate",
    subcategory: "Assessments",
    source: "UAlberta Open Data Centre",
    updateFrequency: "annual",
    tags: ["assessment", "edmonton", "neighbourhoods", "top"],
    pageHref: "/real-estate/assessments",
  },
  {
    id: "re-assessment-cal-top",
    title: "Calgary — Top Assessed Neighbourhoods",
    description: "Highest average assessment neighbourhoods in Calgary from UAlberta data.",
    category: "real-estate",
    subcategory: "Assessments",
    source: "UAlberta Open Data Centre",
    updateFrequency: "annual",
    tags: ["assessment", "calgary", "neighbourhoods", "top"],
    pageHref: "/real-estate/assessments",
  },

  // ──────────────────────────────────────────────────
  // REAL ESTATE — Commercial
  // ──────────────────────────────────────────────────
  {
    id: "re-commercial-assessments",
    title: "Top Commercial Neighbourhoods by Assessment",
    description: "Edmonton neighbourhoods with the highest total commercial assessment values.",
    category: "real-estate",
    subcategory: "Commercial",
    source: "City of Edmonton",
    updateFrequency: "annual",
    tags: ["commercial", "assessment", "edmonton", "neighbourhoods"],
    pageHref: "/real-estate/commercial",
  },
  {
    id: "re-business-categories",
    title: "Business Licences by Category",
    description: "Edmonton business licences broken down by business category.",
    category: "real-estate",
    subcategory: "Commercial",
    source: "City of Edmonton",
    updateFrequency: "monthly",
    tags: ["business", "licences", "categories", "edmonton"],
    pageHref: "/real-estate/commercial",
  },
  {
    id: "re-business-density",
    title: "Business Density by Neighbourhood",
    description: "Business licence density across Edmonton neighbourhoods.",
    category: "real-estate",
    subcategory: "Commercial",
    source: "City of Edmonton",
    updateFrequency: "monthly",
    tags: ["business", "density", "neighbourhoods", "edmonton"],
    pageHref: "/real-estate/commercial",
  },
  {
    id: "re-commercial-permits",
    title: "Commercial Building Permits — Edmonton",
    description: "Commercial building permit volume and trends in Edmonton.",
    category: "real-estate",
    subcategory: "Commercial",
    source: "City of Edmonton",
    updateFrequency: "daily",
    tags: ["commercial", "permits", "edmonton", "building"],
    pageHref: "/real-estate/commercial",
  },
  {
    id: "re-business-licences",
    title: "New Business Licences — Edmonton",
    description: "Monthly new business licence issuance in Edmonton.",
    category: "real-estate",
    subcategory: "Commercial",
    source: "City of Edmonton",
    updateFrequency: "monthly",
    tags: ["business", "licences", "edmonton", "new"],
    pageHref: "/real-estate/commercial",
  },
  {
    id: "re-retail-sales",
    title: "Alberta Retail Sales",
    description: "Province-wide retail sales trend for commercial market context.",
    category: "real-estate",
    subcategory: "Commercial",
    source: "Statistics Canada 20-10-0056",
    updateFrequency: "monthly",
    tags: ["retail", "sales", "commercial"],
    pageHref: "/real-estate/commercial",
  },

  // ──────────────────────────────────────────────────
  // COMMUNITY — Labour
  // ──────────────────────────────────────────────────
  {
    id: "macro-employment",
    title: "Alberta Employment",
    description: "Total employment in Alberta from the Labour Force Survey.",
    category: "community",
    subcategory: "Labour",
    source: "Statistics Canada 14-10-0287",
    updateFrequency: "monthly",
    tags: ["employment", "labour", "jobs", "workforce"],
    pageHref: "/community/labour",
  },
  {
    id: "macro-participation",
    title: "Participation Rate",
    description: "Alberta's labour force participation rate — what share of working-age adults are in the labour market.",
    category: "community",
    subcategory: "Labour",
    source: "Statistics Canada 14-10-0287",
    updateFrequency: "monthly",
    tags: ["participation", "labour", "workforce"],
    pageHref: "/community/labour",
  },
  {
    id: "macro-employment-vs-unemployment",
    title: "Employment vs Unemployment Rate",
    description: "Dual-axis overlay of total employment against unemployment rate.",
    category: "community",
    subcategory: "Labour",
    source: "Statistics Canada 14-10-0287",
    updateFrequency: "monthly",
    tags: ["employment", "unemployment", "labour", "comparison"],
    pageHref: "/community/labour",
  },
  {
    id: "macro-weekly-earnings",
    title: "Average Weekly Earnings",
    description: "Average weekly earnings for Alberta workers — a wage growth indicator.",
    category: "community",
    subcategory: "Labour",
    source: "Statistics Canada 14-10-0223",
    updateFrequency: "monthly",
    tags: ["wages", "earnings", "income", "labour"],
    pageHref: "/community/labour",
  },
  {
    id: "macro-employment-rate",
    title: "Employment Rate",
    description: "Alberta's employment rate — the percentage of working-age population that is employed.",
    category: "community",
    subcategory: "Labour",
    source: "Statistics Canada 14-10-0287",
    updateFrequency: "monthly",
    tags: ["employment", "rate", "labour"],
    pageHref: "/community/labour",
  },

  // ──────────────────────────────────────────────────
  // COMMUNITY — Immigration
  // ──────────────────────────────────────────────────
  {
    id: "macro-immigration",
    title: "International Immigration to Alberta",
    description: "Quarterly international immigration flows into Alberta.",
    category: "community",
    subcategory: "Immigration",
    source: "Statistics Canada 17-10-0008",
    updateFrequency: "quarterly",
    tags: ["immigration", "international", "population"],
    pageHref: "/community/immigration",
  },
  {
    id: "macro-interprovincial",
    title: "Net Interprovincial Migration",
    description: "Net migration between Alberta and other provinces — positive means more people moving to Alberta.",
    category: "community",
    subcategory: "Immigration",
    source: "Statistics Canada 17-10-0008",
    updateFrequency: "quarterly",
    tags: ["migration", "interprovincial", "population"],
    pageHref: "/community/immigration",
  },
  {
    id: "macro-migration-components",
    title: "Population Growth Components",
    description: "Five-way breakdown: immigration, interprovincial migration, emigration, births, and deaths.",
    category: "community",
    subcategory: "Immigration",
    source: "Statistics Canada 17-10-0008",
    updateFrequency: "quarterly",
    tags: ["migration", "population", "growth", "components"],
    pageHref: "/community/immigration",
  },
  {
    id: "macro-migration-vs-energy",
    title: "Net Migration vs Energy Prices",
    description: "How Alberta's migration patterns track with energy commodity prices — people follow the boom.",
    category: "community",
    subcategory: "Immigration",
    source: "Statistics Canada / Bank of Canada",
    updateFrequency: "quarterly",
    tags: ["migration", "energy", "population", "correlation"],
    pageHref: "/community/immigration",
  },

  // ──────────────────────────────────────────────────
  // COMMUNITY — Safety
  // ──────────────────────────────────────────────────
  {
    id: "safety-calgary-crime-by-category",
    title: "Calgary Crime by Category",
    description: "Crime incidents in Calgary broken down by category — property, persons, drugs, traffic.",
    category: "community",
    subcategory: "Crime",
    source: "Calgary Open Data",
    updateFrequency: "monthly",
    tags: ["crime", "calgary", "categories", "safety"],
    pageHref: "/community/crime",
  },
  {
    id: "safety-calgary-crime-trend",
    title: "Calgary Crime Trend",
    description: "Monthly crime incident trend in Calgary over time.",
    category: "community",
    subcategory: "Crime",
    source: "Calgary Open Data",
    updateFrequency: "monthly",
    tags: ["crime", "calgary", "trend", "safety"],
    pageHref: "/community/crime",
  },
  {
    id: "fire-incidents-by-type",
    title: "Edmonton Fire Incidents by Type",
    description: "Fire and emergency incidents in Edmonton broken down by type — structure fires, alarms, medical.",
    category: "community",
    subcategory: "Fire Response",
    source: "City of Edmonton",
    updateFrequency: "monthly",
    tags: ["fire", "incidents", "emergency", "edmonton"],
    pageHref: "/community/fire-response",
  },
  {
    id: "fire-monthly-trend",
    title: "Edmonton Fire/EMS Monthly Call Volume",
    description: "Monthly call volume trend for Edmonton Fire Rescue Services.",
    category: "community",
    subcategory: "Fire Response",
    source: "City of Edmonton",
    updateFrequency: "monthly",
    tags: ["fire", "ems", "calls", "edmonton", "trend"],
    pageHref: "/community/fire-response",
  },

  // ──────────────────────────────────────────────────
  // ENVIRONMENT — Weather
  // ──────────────────────────────────────────────────
  {
    id: "weather-edmonton-climate",
    title: "Edmonton Monthly Mean Temperature",
    description: "Monthly average temperature in Edmonton from Environment Canada weather stations.",
    category: "environment",
    subcategory: "Weather",
    source: "ECCC GeoMet",
    updateFrequency: "monthly",
    tags: ["weather", "temperature", "edmonton", "climate"],
    pageHref: "/environment/weather",
  },
  {
    id: "weather-calgary-climate",
    title: "Calgary Monthly Mean Temperature",
    description: "Monthly average temperature in Calgary from Environment Canada weather stations.",
    category: "environment",
    subcategory: "Weather",
    source: "ECCC GeoMet",
    updateFrequency: "monthly",
    tags: ["weather", "temperature", "calgary", "climate"],
    pageHref: "/environment/weather",
  },
];

// ============================================================
// Lookup helpers
// ============================================================

const _byId = new Map<string, ChartMeta>();
for (const c of CHART_REGISTRY) _byId.set(c.id, c);

export function getChartById(id: string): ChartMeta | undefined {
  return _byId.get(id);
}

export function getChartsByCategory(category: ChartCategory): ChartMeta[] {
  return CHART_REGISTRY.filter((c) => c.category === category);
}

export function getChartsBySubcategory(subcategory: string): ChartMeta[] {
  return CHART_REGISTRY.filter((c) => c.subcategory === subcategory);
}

export function searchCharts(query: string): ChartMeta[] {
  const q = query.toLowerCase().trim();
  if (!q) return CHART_REGISTRY;
  const terms = q.split(/\s+/);
  return CHART_REGISTRY.filter((c) => {
    const haystack = `${c.title} ${c.description} ${c.subcategory} ${c.tags.join(" ")}`.toLowerCase();
    return terms.every((t) => haystack.includes(t));
  });
}

export function getAllCategories(): ChartCategory[] {
  return [...new Set(CHART_REGISTRY.map((c) => c.category))];
}

export function getAllSubcategories(): string[] {
  return [...new Set(CHART_REGISTRY.map((c) => c.subcategory))];
}

export const CATEGORY_LABELS: Record<ChartCategory, string> = {
  economy: "Economy",
  "real-estate": "Real Estate",
  community: "Community",
  environment: "Environment",
  governance: "Governance",
  municipalities: "Municipalities",
};

// T3 brand discipline: amber is the only chromatic value in the system, and
// it is reserved for signal moments (active state, live dot, focused series).
// Category identity comes from the label text and section grouping, not color.
// All six categories collapse to the same neutral instrument-panel chip.
const CATEGORY_CHIP =
  "bg-transparent text-[var(--mid)] border-[var(--hairline)] font-mono uppercase tracking-[0.14em]";

export const CATEGORY_COLORS: Record<ChartCategory, string> = {
  economy: CATEGORY_CHIP,
  "real-estate": CATEGORY_CHIP,
  community: CATEGORY_CHIP,
  environment: CATEGORY_CHIP,
  governance: CATEGORY_CHIP,
  municipalities: CATEGORY_CHIP,
};
