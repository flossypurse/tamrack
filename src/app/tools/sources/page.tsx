import type { Metadata } from "next";
import { Card } from "@/components/card";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import {
  Database,
  Globe,
  Building2,
  Landmark,
  Fuel,
  Wheat,
  HardHat,
  Users,
  TrendingUp,
  BarChart3,
  MapPin,
  Truck,
  ShoppingCart,
  GraduationCap,
  Zap,
  ExternalLink,
} from "lucide-react";
import { SITE_URL } from "@/lib/constants/site";

// ============================================================
// Every data source we're looking at, explained in plain English
// ============================================================

interface DataSource {
  name: string;
  url: string;
  access: "API" | "Download" | "Web Only" | "Paid";
  frequency: string;
  geo: string;
  what: string; // plain English explanation
  why: string; // why it matters for making money decisions
  examples: string[]; // specific data points available
  indicator: "Leading" | "Coincident" | "Lagging";
}

interface Category {
  name: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  description: string;
  sources: DataSource[];
}

const categories: Category[] = [
  {
    name: "Money & Interest Rates",
    icon: Landmark,
    description:
      "The Bank of Canada sets the cost of borrowing money. When rates go up, mortgages cost more, businesses borrow less, and the economy slows. When rates go down, the opposite happens. These numbers affect everything from house prices to whether a new business can afford to open.",
    sources: [
      {
        name: "Bank of Canada Policy Rate",
        url: "https://www.bankofcanada.ca/valet/docs",
        access: "API",
        frequency: "8 times/year (scheduled announcements)",
        geo: "National",
        what: "The overnight interest rate set by the Bank of Canada. This is THE number that controls the cost of borrowing in Canada. Every bank sets their mortgage rates, loan rates, and savings rates based on this number.",
        why: "When this drops, borrowing gets cheaper — more people buy houses, businesses expand, construction picks up. When it rises, everything tightens. If you're thinking about real estate or starting a business, this is the single most important number to watch.",
        examples: [
          "Current policy rate",
          "Historical rate going back decades",
          "Rate announcements and dates",
        ],
        indicator: "Leading",
      },
      {
        name: "Posted Mortgage Rates (5Y Fixed, 5Y Variable)",
        url: "https://www.bankofcanada.ca/valet/docs",
        access: "API",
        frequency: "Weekly",
        geo: "National",
        what: "The standard mortgage rates that major banks advertise. The 5-year fixed rate is what most Canadians get on their mortgage — it's locked in for 5 years regardless of what happens to rates. The variable rate moves with the BoC policy rate.",
        why: "Directly determines how much house people can afford. A 1% rate drop can increase buying power by ~10%. In a growing market like Edmonton, rate drops can trigger buying frenzies. Rate increases can stall the market overnight.",
        examples: [
          "5-year fixed conventional mortgage rate",
          "5-year variable mortgage rate",
          "Historical mortgage rate trends",
        ],
        indicator: "Leading",
      },
      {
        name: "CAD/USD Exchange Rate",
        url: "https://www.bankofcanada.ca/valet/docs",
        access: "API",
        frequency: "Daily",
        geo: "National",
        what: "How much one Canadian dollar is worth in US dollars. When the CAD is weak (say $0.70 USD), Canadian exports are cheap for Americans to buy. When it's strong ($0.80+), imports are cheaper for us.",
        why: "Alberta's economy is heavily tied to oil, which is priced in USD. A weak CAD means Alberta oil companies earn more in Canadian dollars even if oil prices don't move. It also makes Alberta real estate cheaper for foreign investors.",
        examples: [
          "Daily CAD/USD rate",
          "CAD/EUR, CAD/GBP, and other pairs",
          "Effective exchange rate index",
        ],
        indicator: "Coincident",
      },
      {
        name: "Bank of Canada CPI Measures (Trim, Median, Common)",
        url: "https://www.bankofcanada.ca/valet/docs",
        access: "API",
        frequency: "Monthly",
        geo: "National",
        what: "Three different ways the Bank of Canada measures 'core inflation' — the underlying trend in prices, stripping out volatile stuff like gas and food. CPI-trim removes extreme price movements, CPI-median takes the middle price change, CPI-common extracts what's common across all categories.",
        why: "These are what the Bank of Canada actually watches when deciding interest rates. If core inflation is above 3%, rates stay high or go higher. If it's dropping toward 2%, rate cuts are coming. This predicts future rate decisions.",
        examples: [
          "CPI-trim annual rate",
          "CPI-median annual rate",
          "CPI-common annual rate",
        ],
        indicator: "Leading",
      },
    ],
  },
  {
    name: "Population & Demographics",
    icon: Users,
    description:
      "People are the foundation of every market. More people = more demand for housing, food, services, jobs. WHO those people are matters too — young families need different things than retirees, immigrants have different needs than established residents. Edmonton is currently Canada's fastest-growing metro area.",
    sources: [
      {
        name: "Statistics Canada Population Estimates",
        url: "https://www150.statcan.gc.ca/t1/wds/rest",
        access: "API",
        frequency: "Quarterly (CMA level), Annual (municipality level)",
        geo: "Down to individual municipalities — Edmonton CMA, Parkland County, Spruce Grove, Stony Plain",
        what: "Official population counts between census years. StatsCan estimates how many people live in each area by tracking births, deaths, immigration, and people moving between provinces. This is as close to 'ground truth' as you get.",
        why: "Edmonton CMA is adding 50,000+ people per year. That's an entire small city worth of new residents annually who need housing, services, jobs, schools. Knowing WHERE they're going (which municipalities, which neighbourhoods) tells you where demand is building.",
        examples: [
          "Population by CMA (quarterly)",
          "Population by Census Subdivision / municipality (annual)",
          "Components of growth: births, deaths, immigration, interprovincial migration",
          "Age and sex distribution",
        ],
        indicator: "Coincident",
      },
      {
        name: "Immigration & Temporary Residents (IRCC)",
        url: "https://open.canada.ca/data/en/dataset",
        access: "Download",
        frequency: "Monthly",
        geo: "Provincial",
        what: "Immigration, Refugees and Citizenship Canada tracks every permanent resident, temporary foreign worker, and international student entering Canada. Monthly datasets show how many came to Alberta, from which countries, in which immigration categories, and in which industries (for workers).",
        why: "Immigration is THE driver of Edmonton's growth right now. These people need housing immediately (rental market), language services, cultural goods, and eventually homes to buy. Knowing the volume and origin tells you what services will be in demand.",
        examples: [
          "Permanent residents by province and immigration category",
          "Temporary Foreign Workers by province and industry (NAICS)",
          "International students by province",
          "Country of citizenship / origin",
        ],
        indicator: "Coincident",
      },
      {
        name: "Federal Census (2021)",
        url: "https://www12.statcan.gc.ca/census-recensement/2021/dp-pd/prof/index.cfm",
        access: "API",
        frequency: "Every 5 years (next: 2026)",
        geo: "Down to Dissemination Area (~400-700 people) — hyper-local",
        what: "The most detailed snapshot of Canada's population. Every person, every household. Income, education, language, occupation, commuting patterns, housing, family structure. You can drill down to tiny geographic areas (a few city blocks).",
        why: "The gold standard for understanding who lives where. Even though it's from 2021, it tells you the baseline — and you can layer more recent estimates on top. Want to know the average income in a specific Parkland County neighbourhood? This has it.",
        examples: [
          "Population by age, sex, language, education, income",
          "Dwelling type, tenure (rent vs own), housing condition",
          "Occupation by NOC code, industry by NAICS code",
          "Commuting mode, distance, and duration",
          "Visible minority, Indigenous identity",
          "Household size, family structure",
        ],
        indicator: "Lagging",
      },
      {
        name: "Edmonton Municipal Census",
        url: "https://data.edmonton.ca/",
        access: "API",
        frequency: "Every 2-5 years (last: 2019)",
        geo: "Neighbourhood level (~400 neighbourhoods in Edmonton)",
        what: "Edmonton conducts its own census separate from StatsCan. It covers population, age, sex, dwelling type by neighbourhood. More granular geographically than StatsCan for Edmonton specifically.",
        why: "Neighbourhood-level data shows you exactly where people are concentrating. You can spot emerging neighbourhoods, areas with young families vs retirees, high-density vs low-density areas.",
        examples: [
          "Population by neighbourhood",
          "Age/sex distribution by neighbourhood",
          "Dwelling units by type and neighbourhood",
        ],
        indicator: "Lagging",
      },
    ],
  },
  {
    name: "Real Estate & Property",
    icon: Building2,
    description:
      "Property is where wealth concentrates in Alberta. Assessment values, zoning changes, development permits — these tell you where money is flowing and where it's about to flow. The tricky part: some of the best data (land titles, MLS sales) is locked behind paywalls.",
    sources: [
      {
        name: "Edmonton Property Assessments",
        url: "https://data.edmonton.ca/",
        access: "API",
        frequency: "Annual (January)",
        geo: "Individual property addresses (~448,000 properties)",
        what: "The City of Edmonton assesses every property's value every year for tax purposes. This dataset has the assessed value, address, neighbourhood, ward, and property type for every single property in Edmonton. Historical data available too.",
        why: "Track property value trends at the neighbourhood level. Find areas where assessments are rising fastest (appreciation) or falling (opportunity or warning). Compare commercial vs residential trends. This is FREE and covers every property.",
        examples: [
          "Current assessed value for any Edmonton property",
          "Historical assessed values (multi-year)",
          "Property type (residential, commercial, industrial)",
          "Assessment by neighbourhood and ward",
        ],
        indicator: "Lagging",
      },
      {
        name: "Edmonton Development Permits",
        url: "https://data.edmonton.ca/",
        access: "API",
        frequency: "Continuously updated",
        geo: "Individual addresses in Edmonton",
        what: "Every time someone wants to build something or change a property's use in Edmonton, they need a development permit. This dataset tracks applications, approvals, and decisions — what's being built, where, and when.",
        why: "Development permits are a LEADING indicator. They tell you what's coming 6-18 months before it exists. A cluster of permits in one area means that area is about to change. Multi-family permits suggest population density increasing. Commercial permits suggest economic activity.",
        examples: [
          "Permit applications and decisions",
          "Location (address, coordinates)",
          "Development type (residential, commercial, mixed-use)",
          "Zoning classification",
        ],
        indicator: "Leading",
      },
      {
        name: "CMHC Housing Data",
        url: "https://www.cmhc-schl.gc.ca/professionals/housing-markets-data-and-research/housing-data/data-tables",
        access: "Download",
        frequency: "Monthly (starts/completions), Annual (rental survey)",
        geo: "Edmonton CMA",
        what: "Canada Mortgage and Housing Corporation tracks every new housing unit from the moment a foundation is dug (a 'start') to when it's finished ('completion') and whether it's been sold or rented ('absorption'). They also survey rental apartments annually for vacancy rates and rents.",
        why: "Housing starts tell you about future supply. If starts are low and population is growing fast (Edmonton's situation), prices will rise. Rental vacancy rates tell you if the rental market is tight. Absorption rates tell you if new builds are selling.",
        examples: [
          "Housing starts by type (single, semi, row, apartment)",
          "Housing completions and under construction",
          "Absorption rates (% of new units sold)",
          "Rental vacancy rates by bedroom count",
          "Average rents by area and unit type",
        ],
        indicator: "Leading",
      },
      {
        name: "Parkland County Assessment / GIS",
        url: "https://opendata.parklandcounty.com/",
        access: "Download",
        frequency: "Annual",
        geo: "Parcel level within Parkland County",
        what: "Parkland County publishes GIS (geographic) data layers including parcel boundaries, land use, zoning, and assessment information. Not as rich as Edmonton's open data, but provides spatial context for the county.",
        why: "See where Parkland County land is zoned for what. Overlay with development activity to spot areas opening up for new uses. Key for understanding the Acheson industrial expansion and data centre zoning near Sundance/Keephills.",
        examples: [
          "Parcel boundaries and zoning",
          "Land use classifications",
          "Municipal infrastructure layers",
          "Assessment data (via GIS)",
        ],
        indicator: "Lagging",
      },
      {
        name: "Crown Mineral Rights Lease Sales",
        url: "https://open.alberta.ca/",
        access: "Download",
        frequency: "Bi-weekly",
        geo: "Provincial (by lease area)",
        what: "The Alberta government auctions mineral rights (the right to drill for oil/gas) bi-weekly. Companies bid on parcels. The sale prices — called 'bonus bids' — reflect how valuable companies think the underground resources are.",
        why: "A leading indicator for energy sector activity. When lease sale prices are high and volumes are up, companies are betting on future drilling. This precedes well licence applications and actual drilling by months. High activity in an area means jobs, service demand, and economic activity coming.",
        examples: [
          "Bonus bid amounts per hectare",
          "Number of parcels sold",
          "Total sale revenue",
          "Geographic location of parcels",
        ],
        indicator: "Leading",
      },
      {
        name: "Land Titles (SPIN2/ARLO) — PAID",
        url: "https://www.spin.gov.ab.ca/",
        access: "Paid",
        frequency: "Real-time",
        geo: "Individual parcels",
        what: "The official Alberta land title registry. Shows ownership, mortgages, liens, caveats (legal claims), and encumbrances on any property. You need this to verify ownership or check for issues before buying.",
        why: "Essential for due diligence on specific properties. But at $10+ per search with no bulk access or API, it's not suitable for data analysis at scale. This is a gap — anyone who could aggregate and analyze this data at scale would have a massive information advantage.",
        examples: [
          "Current owner",
          "Registered mortgages",
          "Liens and caveats",
          "Legal land description",
        ],
        indicator: "Lagging",
      },
    ],
  },
  {
    name: "Business Activity",
    icon: BarChart3,
    description:
      "New businesses opening, old ones closing, licences being issued — these are the vital signs of an economy. More new businesses = optimism and opportunity. More bankruptcies = stress. The patterns tell you which sectors are growing and which are struggling.",
    sources: [
      {
        name: "Edmonton Business Licences",
        url: "https://data.edmonton.ca/",
        access: "API",
        frequency: "Continuously updated",
        geo: "Individual addresses in Edmonton",
        what: "Every business operating in Edmonton needs a licence. This dataset tracks every licence issued — the business name, type, address, issue date, and category. You can see exactly what businesses are opening and where.",
        why: "A real-time pulse on entrepreneurial activity. Spot trends: are more restaurants opening in a particular neighbourhood? Are cannabis shops saturating an area? Is a new commercial corridor emerging? The category breakdown tells you what the economy is doing at street level.",
        examples: [
          "Business name, type, and category",
          "Address and neighbourhood",
          "Issue date and status",
          "Business category (food, retail, service, etc.)",
        ],
        indicator: "Coincident",
      },
      {
        name: "Canadian Business Counts (StatsCan)",
        url: "https://www150.statcan.gc.ca/t1/wds/rest",
        access: "API",
        frequency: "Semi-annual (June and December)",
        geo: "CMA level (Edmonton), can request Census Division",
        what: "StatsCan counts every active business in Canada, classified by industry (NAICS code) and employee size range. This tells you the composition of the business landscape — how many construction firms, restaurants, tech companies, etc. exist in your area.",
        why: "Track the business ecosystem over time. Is the number of construction companies growing? Are retail businesses declining? Compare Edmonton to Calgary or other cities. The size distribution matters too — lots of 1-4 employee firms suggests a gig/contractor economy.",
        examples: [
          "Business counts by NAICS industry code",
          "Business counts by employee size range (1-4, 5-9, 10-19, etc.)",
          "Geographic breakdown (CMA, province)",
          "With/without employees breakdown",
        ],
        indicator: "Coincident",
      },
      {
        name: "Insolvency Filings (OSB)",
        url: "https://open.canada.ca/data/en/dataset",
        access: "Download",
        frequency: "Monthly/Quarterly",
        geo: "Province, CMA, Economic Region",
        what: "The Office of the Superintendent of Bankruptcy tracks every bankruptcy and consumer proposal in Canada. Broken down by province, CMA, industry sector, and type (consumer vs business). Shows financial distress levels.",
        why: "Rising consumer insolvencies signal household financial stress — people can't make payments. Rising business insolvencies by sector tells you which industries are struggling. A sudden spike can precede broader economic trouble. Conversely, falling insolvencies signal recovery.",
        examples: [
          "Consumer bankruptcies and proposals by province/CMA",
          "Business bankruptcies by NAICS sector",
          "Monthly trends and year-over-year comparisons",
          "Debt-to-income ratios",
        ],
        indicator: "Lagging",
      },
      {
        name: "Alberta Major Projects",
        url: "https://majorprojects.alberta.ca/",
        access: "Web Only",
        frequency: "Continuously updated",
        geo: "Provincial (with location details)",
        what: "A list of all major capital projects in Alberta — proposed, under construction, and completed. Includes energy, infrastructure, commercial, and institutional projects over a certain value threshold.",
        why: "Major projects create massive downstream demand: construction workers, materials suppliers, housing for workers, food services, equipment. Knowing what's coming and where lets you position ahead of the demand wave.",
        examples: [
          "Project name, value, and status",
          "Location and type",
          "Estimated start/completion dates",
          "Company/proponent information",
        ],
        indicator: "Leading",
      },
    ],
  },
  {
    name: "Construction & Building Permits",
    icon: HardHat,
    description:
      "Building permits are one of the most reliable leading indicators in economics. When someone applies for a permit, they're committing capital — real money is about to be spent. Permit values tell you HOW MUCH money. The types tell you what kind of economy is being built.",
    sources: [
      {
        name: "Edmonton Building Permits",
        url: "https://data.edmonton.ca/",
        access: "API",
        frequency: "Weekly updates",
        geo: "Individual addresses in Edmonton",
        what: "Every building permit issued in Edmonton — the address, type (new build, renovation, demolition), category (residential, commercial, industrial), job value (how much the construction costs), and status. About 236,000 records available.",
        why: "The single best leading indicator for Edmonton's economy. A permit for a $50M commercial building means jobs, materials, and economic activity for 1-2 years. Track permit values by area to see where investment is concentrating. A spike in residential permits means developers see demand.",
        examples: [
          "Permit type (new, addition, renovation, demolition)",
          "Category (residential, commercial, industrial, institutional)",
          "Job value in dollars",
          "Address, neighbourhood, ward",
          "Issue date and status",
        ],
        indicator: "Leading",
      },
      {
        name: "StatsCan Building Permits by CMA",
        url: "https://www150.statcan.gc.ca/t1/wds/rest",
        access: "API",
        frequency: "Monthly",
        geo: "CMA level (Edmonton, Calgary, etc.)",
        what: "The dollar value of building permits issued, broken down by type (residential, industrial, commercial, institutional/government). This is the aggregate view — total value across the whole metro area each month.",
        why: "Compare Edmonton's permit values to other cities and to its own history. When total permit values are rising, the construction sector is about to boom. When they're falling, a slowdown is coming. The type breakdown tells you what kind of growth (houses vs offices vs factories).",
        examples: [
          "Total residential permit value",
          "Total non-residential permit value (industrial, commercial, institutional)",
          "Number of permits",
          "Monthly time series going back years",
        ],
        indicator: "Leading",
      },
    ],
  },
  {
    name: "Energy Sector",
    icon: Fuel,
    description:
      "Alberta's economy still runs on energy. Oil and gas directly account for ~25% of provincial GDP and indirectly drive much more. Well licences, drilling activity, production volumes, and pipeline capacity tell you the health of Alberta's economic engine. The energy transition (clean energy, carbon capture, data centres) is adding a new layer.",
    sources: [
      {
        name: "AER Well Licences (ST1)",
        url: "https://www.aer.ca/providing-information/data-and-reports/activity-and-data",
        access: "Download",
        frequency: "Daily",
        geo: "Individual well locations across Alberta",
        what: "Every time a company wants to drill a new oil or gas well in Alberta, they need a licence from the Alberta Energy Regulator. This daily list shows every licence issued — the company, the location, the well type, and the target formation.",
        why: "Well licence applications are a LEADING indicator — they show what companies plan to drill 3-12 months from now. A surge in licences means companies are investing, which means jobs, equipment rentals, trucking, accommodations. Especially relevant for areas near Parkland County.",
        examples: [
          "Licensee (company) name",
          "Well location (legal subdivision)",
          "Well type (oil, gas, disposal, etc.)",
          "Target formation/zone",
          "Licence issue date",
        ],
        indicator: "Leading",
      },
      {
        name: "Oil & Gas Production (Petrinex)",
        url: "https://www.petrinex.ca/PD/Pages/APD.aspx",
        access: "Download",
        frequency: "Monthly",
        geo: "Individual wells and facilities across Alberta",
        what: "Petrinex is Alberta's petroleum information system. Public data includes production volumes — how much oil, gas, and water each well produces. Also facility-level data for processing plants, pipelines, and batteries.",
        why: "Production data tells you the current health of the energy sector. Rising production = more revenue, more jobs, more demand for services. Falling production = contraction. Well-level data lets you identify productive areas and declining ones.",
        examples: [
          "Monthly oil production by well (m³)",
          "Monthly gas production by well (10³m³)",
          "Water production volumes",
          "Facility throughput",
        ],
        indicator: "Coincident",
      },
      {
        name: "Pipeline Throughput (CER)",
        url: "https://www.cer-rec.gc.ca/en/data-analysis/",
        access: "Download",
        frequency: "Quarterly",
        geo: "Major Alberta pipelines",
        what: "The Canada Energy Regulator tracks how full major pipelines are — how much oil, gas, and other products flow through them. Includes Trans Mountain, Keystone, NGTL, and others.",
        why: "Pipeline capacity utilization is critical for Alberta. When pipelines are full, oil gets stuck and sells at a discount. When capacity opens up (e.g., TMX expansion), Alberta producers get better prices. This directly affects provincial revenue and energy sector employment.",
        examples: [
          "Throughput by pipeline and commodity",
          "Capacity utilization (%)",
          "Pipeline incidents",
          "Export volumes",
        ],
        indicator: "Coincident",
      },
    ],
  },
  {
    name: "Agriculture",
    icon: Wheat,
    description:
      "Parkland County is in the heart of Alberta's agricultural belt. Farming is a multi-billion dollar industry in the region — crop production, livestock, and increasingly agri-tech. Weather, crop prices, and farmland values are interconnected and cyclical.",
    sources: [
      {
        name: "Alberta Crop Data",
        url: "https://open.alberta.ca/opendata",
        access: "Download",
        frequency: "Annual (production), Weekly during growing season (crop reports)",
        geo: "Provincial and regional",
        what: "Seeded acres, harvested acres, yield per acre, and production (tonnes) for every major crop in Alberta — wheat, canola, barley, oats, peas, etc. The weekly crop reports during growing season give real-time condition updates.",
        why: "Crop yields and prices directly affect farm income, which drives the rural economy around Parkland County. A bumper crop year means farmers spend on equipment, land, and improvements. A drought year means financial stress. Canola is Alberta's #1 crop and its price swings matter hugely.",
        examples: [
          "Seeded and harvested acres by crop",
          "Yield per acre and total production",
          "Weekly crop condition reports",
          "Moisture conditions by region",
          "Seeding and harvest progress",
        ],
        indicator: "Coincident",
      },
      {
        name: "Farm Cash Receipts (StatsCan)",
        url: "https://www150.statcan.gc.ca/t1/wds/rest",
        access: "API",
        frequency: "Quarterly",
        geo: "Provincial",
        what: "Total money farmers receive from selling crops, livestock, and other farm products. Also includes program payments (government support). This is the 'revenue line' for Alberta's farm sector.",
        why: "Directly measures farm sector health. Rising farm cash receipts = prosperous farmers = rural economic activity. Parkland County's economy is partly agricultural, and farm income drives spending on equipment, services, and land.",
        examples: [
          "Crop receipts by type",
          "Livestock receipts",
          "Program payments",
          "Total farm cash receipts",
        ],
        indicator: "Coincident",
      },
      {
        name: "Alberta Climate Information Service (ACIS)",
        url: "https://acis.alberta.ca/",
        access: "Download",
        frequency: "Daily",
        geo: "6,900 interpolated grid points across Alberta (back to 1961)",
        what: "Temperature, precipitation, growing degree days, frost dates, soil moisture, and other climate data for the entire province. Uses station data interpolated to a grid, so you can get historical weather for any location in Alberta.",
        why: "Weather drives agriculture — period. Drought means low yields, excess rain means harvest delays, early frost kills crops. Historical patterns help predict risk. Also relevant for renewable energy (solar and wind resource assessment) and construction scheduling.",
        examples: [
          "Daily temperature (min, max, mean)",
          "Precipitation (rain, snow)",
          "Growing degree days",
          "Frost-free period",
          "Soil moisture estimates",
        ],
        indicator: "Coincident",
      },
    ],
  },
  {
    name: "Labour Market",
    icon: Users,
    description:
      "Jobs are the connective tissue between the economy and people's lives. Job vacancy rates tell you which skills are in demand, wages tell you the price of labour, and unemployment tells you the health of the market. In Alberta, the trades and energy sectors dominate, but tech is growing fast.",
    sources: [
      {
        name: "Labour Force Survey (StatsCan)",
        url: "https://www150.statcan.gc.ca/t1/wds/rest",
        access: "API",
        frequency: "Monthly",
        geo: "CMA (Edmonton), Province (Alberta)",
        what: "The flagship employment survey. Monthly data on employment, unemployment, participation rate, full-time vs part-time, by industry, age, sex, and more. This is what the news reports on 'jobs Friday'.",
        why: "Employment is the most fundamental economic indicator. Edmonton's unemployment rate tells you if the labour market is tight (good for workers, hard for employers) or loose. By-industry breakdowns show which sectors are hiring or shedding jobs.",
        examples: [
          "Employment and unemployment by CMA",
          "Unemployment rate by age and sex",
          "Employment by industry (NAICS)",
          "Full-time vs part-time split",
          "Participation rate",
          "Average hours worked",
        ],
        indicator: "Coincident",
      },
      {
        name: "Job Vacancies (StatsCan)",
        url: "https://www150.statcan.gc.ca/t1/wds/rest",
        access: "API",
        frequency: "Quarterly",
        geo: "Provincial",
        what: "The number of job openings by industry sector across Alberta. Also includes offered wages for vacant positions. This is the 'demand side' of the labour market.",
        why: "Job vacancies tell you what the economy NEEDS. If there are 5,000 open construction jobs in Alberta, that means construction is booming and there's an opportunity gap. Offered wages show what employers are willing to pay — and where labour shortages are creating wage inflation.",
        examples: [
          "Job vacancies by NAICS industry",
          "Offered wage for vacant positions",
          "Job vacancy rate (%)",
          "Duration of vacancies",
        ],
        indicator: "Leading",
      },
      {
        name: "Canada Job Bank Postings",
        url: "https://open.canada.ca/data/en/dataset",
        access: "Download",
        frequency: "Monthly",
        geo: "By location (city level)",
        what: "Actual job postings from the Canada Job Bank — the federal job board. Includes NOC occupation code, location, salary range, hours, and employment terms for each posting.",
        why: "Real-time signal of what employers are hiring for, where, and at what pay. More granular than the aggregate Labour Force Survey. You can track specific occupations (e.g., are AI jobs growing in Edmonton?) and specific companies.",
        examples: [
          "Job title and NOC code",
          "Location (city)",
          "Salary range",
          "Full-time / part-time / contract",
          "Employer name",
        ],
        indicator: "Coincident",
      },
      {
        name: "Alberta Apprenticeship Data",
        url: "https://open.alberta.ca/opendata",
        access: "Download",
        frequency: "Annual",
        geo: "Provincial",
        what: "Registrations and completions in Alberta's apprenticeship programs — electricians, plumbers, pipefitters, welders, heavy equipment operators, etc. Shows the pipeline of skilled tradespeople.",
        why: "The trades are the backbone of Alberta's economy. If apprenticeship registrations are declining in a trade, expect future labour shortages and wage increases in that trade. Rising registrations signal people betting on that sector's future.",
        examples: [
          "Registrations by trade",
          "Completions by trade",
          "Active apprentices",
          "Trends over time",
        ],
        indicator: "Leading",
      },
    ],
  },
  {
    name: "Transportation & Infrastructure",
    icon: Truck,
    description:
      "Goods and people moving around is economic activity in motion. Traffic counts, transit ridership, airport volumes, and freight data show the physical flow of the economy. Infrastructure projects reshape where growth happens.",
    sources: [
      {
        name: "Alberta Highway Traffic Volumes",
        url: "https://open.alberta.ca/opendata",
        access: "Download",
        frequency: "Annual",
        geo: "Count stations across Alberta highways",
        what: "Annual Average Daily Traffic (AADT) counts at stations across Alberta's highway network. Shows how many vehicles pass specific points each day, on average.",
        why: "Traffic volumes on the highway between Edmonton and Parkland County (Highway 16, 16A, 628, etc.) directly indicate commuter growth and commercial activity. Rising counts on routes to Acheson industrial area signal business growth. Useful for any business that depends on drive-by traffic.",
        examples: [
          "AADT by highway and location",
          "Vehicle classification (trucks vs cars)",
          "Historical trends",
        ],
        indicator: "Coincident",
      },
      {
        name: "Edmonton Transit Ridership",
        url: "https://data.edmonton.ca/",
        access: "API",
        frequency: "Monthly",
        geo: "By route and stop within Edmonton",
        what: "Edmonton Transit Service ridership data — how many people ride buses and LRT, broken down by route and time period.",
        why: "Transit ridership tracks economic activity and commuter patterns. The Valley Line West LRT (going toward Parkland County direction) will reshape commuting when complete. Ridership data on west-end routes shows how connected the west corridor is.",
        examples: [
          "Monthly ridership by route",
          "LRT vs bus breakdown",
          "Year-over-year trends",
        ],
        indicator: "Coincident",
      },
      {
        name: "Railway Carloadings (StatsCan)",
        url: "https://www150.statcan.gc.ca/t1/wds/rest",
        access: "API",
        frequency: "Monthly",
        geo: "Regional",
        what: "The volume of goods shipped by rail — broken down by commodity type (grain, oil, manufactured goods, containers). Rail is how most bulk goods move in and out of Alberta.",
        why: "A leading/coincident indicator for trade and industrial activity. If grain carloadings are up, farmers are selling. If intermodal containers are up, consumer goods demand is growing. If crude-by-rail is up, pipeline capacity is tight.",
        examples: [
          "Carloadings by commodity type",
          "Intermodal traffic",
          "Revenue tonne-kilometres",
          "Monthly trends",
        ],
        indicator: "Coincident",
      },
    ],
  },
  {
    name: "Consumer & Retail",
    icon: ShoppingCart,
    description:
      "Consumer spending is ~60% of the economy. What people buy, where they buy it, and how much they spend tells you about confidence, wealth, and changing preferences. Retail sales data is one of the most watched economic indicators.",
    sources: [
      {
        name: "Retail Sales (StatsCan)",
        url: "https://www150.statcan.gc.ca/t1/wds/rest",
        access: "API",
        frequency: "Monthly",
        geo: "Provincial, CMA for some",
        what: "Total retail sales by store type — groceries, clothing, electronics, furniture, vehicles, building materials, etc. Adjusted for seasonality and inflation. This is the definitive measure of consumer spending.",
        why: "Tells you what consumers are buying. Rising building materials sales = people renovating/building. Rising vehicle sales = consumer confidence. Falling discretionary spending (clothing, electronics) = consumers tightening belts. Alberta-specific data shows the local economy's health.",
        examples: [
          "Retail sales by store type (NAICS)",
          "Seasonally adjusted and unadjusted",
          "Year-over-year growth rates",
          "Alberta vs national comparisons",
        ],
        indicator: "Coincident",
      },
      {
        name: "New Motor Vehicle Sales (StatsCan)",
        url: "https://www150.statcan.gc.ca/t1/wds/rest",
        access: "API",
        frequency: "Monthly",
        geo: "Provincial",
        what: "The number and dollar value of new cars and trucks sold in Alberta each month. Broken down by vehicle type (passenger cars, trucks, SUVs).",
        why: "A classic leading indicator of consumer confidence. New vehicles are a major discretionary purchase — people only buy when they feel secure about their income. In Alberta, truck sales specifically correlate with energy sector activity (work trucks).",
        examples: [
          "Units sold by vehicle type",
          "Dollar value of sales",
          "Monthly trends",
          "Alberta vs national",
        ],
        indicator: "Leading",
      },
      {
        name: "Consumer Price Index — Alberta (StatsCan)",
        url: "https://www150.statcan.gc.ca/t1/wds/rest",
        access: "API",
        frequency: "Monthly",
        geo: "Provincial (Alberta), CMA (Edmonton)",
        what: "The price of a standard 'basket of goods' — food, shelter, transportation, clothing, etc. — tracked over time. CPI tells you how fast prices are rising (inflation) in Alberta specifically, which can differ from the national average.",
        why: "Alberta's CPI affects purchasing power. If shelter costs (rents, mortgages) are rising faster than wages, people have less money for other things. CPI by category shows where price pressure is building — shelter inflation in Edmonton has been significant due to population growth.",
        examples: [
          "All-items CPI for Alberta and Edmonton",
          "CPI by category (food, shelter, transport, etc.)",
          "Year-over-year inflation rate",
          "Alberta vs national comparison",
        ],
        indicator: "Lagging",
      },
      {
        name: "Cannabis Retail Sales (StatsCan 20-10-0056)",
        url: "https://www150.statcan.gc.ca/t1/wds/rest",
        access: "API",
        frequency: "Monthly",
        geo: "Provincial (Alberta)",
        what: "Monthly cannabis retail sales in dollars for Alberta, from Statistics Canada's Retail Trade Survey. Covers all licensed cannabis retailers in the province — both brick-and-mortar and online sales. Reported in thousands of dollars, seasonally unadjusted.",
        why: "Cannabis is a billion-dollar-a-year retail sector in Alberta that didn't exist before October 2018. Tracking sales trends shows market maturity, seasonality, and competitive dynamics. As a share of total retail it reveals how much consumer spending has shifted to this new category.",
        examples: [
          "Monthly cannabis retail sales ($)",
          "Year-over-year growth rate",
          "Cannabis as % of total Alberta retail",
          "Seasonal patterns (holiday spikes, summer dips)",
        ],
        indicator: "Coincident",
      },
      {
        name: "Health Canada Cannabis Market Data",
        url: "https://open.canada.ca/data/dataset/1f8d838e-f738-4549-8019-edfc0d931cd7",
        access: "Download",
        frequency: "Monthly",
        geo: "National (Canada)",
        what: "National cannabis inventory and sales data by product type — dried flower, edibles, extracts, topicals, seeds, and plants. Tracks both medical and non-medical (recreational) sales in units and kilograms. Published by Health Canada under the Cannabis Act reporting requirements.",
        why: "Shows the national product mix evolution. Dried flower still dominates but edibles and extracts have grown steadily since legalization in late 2019. Understanding product category trends helps gauge market maturation and consumer preference shifts — relevant for anyone analyzing the cannabis supply chain or retail landscape.",
        examples: [
          "Sales by product type (units and kg)",
          "Medical vs non-medical split",
          "Inventory levels by product category",
          "Monthly and quarterly trends since 2018",
        ],
        indicator: "Coincident",
      },
    ],
  },
  {
    name: "Government & Municipal Finance",
    icon: Landmark,
    description:
      "Government spending, tax rates, and budgets shape the playing field. Municipal finances show you which communities are investing in growth and which are cutting back. Procurement data reveals business opportunities directly.",
    sources: [
      {
        name: "Alberta Municipal Financial/Statistical Returns",
        url: "https://open.alberta.ca/opendata",
        access: "Download",
        frequency: "Annual",
        geo: "Every municipality in Alberta (including Parkland County)",
        what: "Complete financial statements for every municipality — revenue, expenses, debt, reserves, capital spending, tax rates. This is like getting the annual report for every town and county in Alberta.",
        why: "See which municipalities are investing heavily (capital spending up = growth oriented). Compare tax rates to find business-friendly jurisdictions. Track Parkland County's financial health and spending priorities directly. Municipal debt levels signal fiscal room for future projects.",
        examples: [
          "Revenue by source (property tax, grants, fees)",
          "Expenses by function (roads, water, recreation, admin)",
          "Capital expenditures",
          "Long-term debt",
          "Mill rates (property tax rates)",
          "Reserve fund balances",
        ],
        indicator: "Lagging",
      },
      {
        name: "Alberta Municipal Equalized Assessments",
        url: "https://open.alberta.ca/opendata",
        access: "Download",
        frequency: "Annual",
        geo: "Every municipality",
        what: "The total assessed value of all property in each municipality, adjusted (equalized) so they're comparable. Shows the total tax base of each community.",
        why: "A growing assessment base means a community's wealth is increasing — more property, higher values. Shrinking base means decline. Compare Parkland County's trajectory to surrounding municipalities. A municipality with a growing tax base can offer services without raising rates.",
        examples: [
          "Total equalized assessment by municipality",
          "Residential vs non-residential split",
          "Year-over-year changes",
          "Per-capita assessment values",
        ],
        indicator: "Lagging",
      },
    ],
  },
  {
    name: "Education & Workforce Pipeline",
    icon: GraduationCap,
    description:
      "What people are studying tells you what workforce is coming. International student numbers signal immigration trends. Enrollment shifts reveal what skills the market is demanding.",
    sources: [
      {
        name: "Alberta Education Enrollment",
        url: "https://open.alberta.ca/opendata",
        access: "Download",
        frequency: "Annual",
        geo: "School/district level",
        what: "K-12 enrollment by school and school district. Includes total headcounts and demographic breakdowns. Alberta's English-as-an-additional-language (EAL) student population grew 105% recently — a direct measure of immigration impact on communities.",
        why: "School enrollment is a proxy for family migration. If a school in west Edmonton is bursting at the seams, families with children are moving there. New schools being built signal where government sees long-term population growth. EAL growth shows immigrant family concentration.",
        examples: [
          "Enrollment by school and district",
          "EAL student counts",
          "Year-over-year growth by area",
          "Grade-level distribution",
        ],
        indicator: "Coincident",
      },
      {
        name: "Post-Secondary Enrollment (Alberta Advanced Education)",
        url: "https://open.alberta.ca/opendata",
        access: "Download",
        frequency: "Annual",
        geo: "Institution level (U of A, NAIT, MacEwan, etc.)",
        what: "Enrollment at Alberta's universities, colleges, and polytechnics — by program, credential type, domestic vs international. Shows what people are studying and where future graduates will have skills.",
        why: "Rising enrollment in tech programs signals a growing tech workforce pipeline. International student enrollment is a leading indicator of immigration (many students become permanent residents). Program trends show what skills the market values — and what fields might get oversaturated.",
        examples: [
          "Enrollment by institution and program",
          "Domestic vs international students",
          "Credential type (certificate, diploma, degree)",
          "Program area (engineering, business, health, trades, etc.)",
        ],
        indicator: "Leading",
      },
    ],
  },
  {
    name: "Financial Markets & Commodities",
    icon: TrendingUp,
    description:
      "Oil prices, natural gas prices, grain prices, stock markets — these are the financial signals that drive investment decisions. Alberta's economy is especially sensitive to commodity prices. The TSX Energy Index is essentially a bet on Alberta's future.",
    sources: [
      {
        name: "Commodity Prices (via yfinance / Alpha Vantage)",
        url: "https://pypi.org/project/yfinance/",
        access: "API",
        frequency: "Daily (delayed), Minutely (intraday with limits)",
        geo: "Global",
        what: "Market prices for crude oil (WTI), natural gas, gold, wheat, canola, and other commodities. These are futures prices — what the market expects these commodities to be worth at various future dates.",
        why: "WTI crude and natural gas prices directly drive Alberta's economy. When oil is above $70/barrel, the energy sector is profitable and investing. Below $50, layoffs and cutbacks. Natural gas prices affect heating costs and LNG export economics. Grain prices affect farm income around Parkland County.",
        examples: [
          "WTI Crude Oil (CL=F) — daily and historical",
          "Natural Gas (NG=F) — daily and historical",
          "Western Canadian Select (differential to WTI)",
          "Gold (GC=F), Wheat, Canola",
        ],
        indicator: "Leading",
      },
      {
        name: "TSX Sector Performance",
        url: "https://pypi.org/project/yfinance/",
        access: "API",
        frequency: "Daily",
        geo: "National (Canadian market)",
        what: "Performance of Toronto Stock Exchange sector indices — Energy, Financials, Materials, Real Estate, Tech, etc. Also individual company data for Alberta-headquartered companies (Suncor, CNRL, TC Energy, etc.).",
        why: "The TSX Energy Index tells you how the market values Alberta's energy sector. TSX Financials reflects bank health and lending conditions. TSX Real Estate reflects REIT valuations (apartment buildings, commercial space). These are forward-looking — the market prices in expectations.",
        examples: [
          "S&P/TSX Composite Index",
          "S&P/TSX Capped Energy Index",
          "Individual company prices (SU.TO, CNQ.TO, TRP.TO)",
          "Sector comparison charts",
        ],
        indicator: "Leading",
      },
    ],
  },
  {
    name: "Digital & Innovation Economy",
    icon: Zap,
    description:
      "Alberta's tech sector is growing fast — 3x the overall economy. Tracking broadband coverage, patent activity, and venture capital tells you where the innovation economy is heading and where digital infrastructure gaps exist (gaps = opportunities for someone with software skills).",
    sources: [
      {
        name: "CRTC Broadband Coverage",
        url: "https://open.canada.ca/data/en/dataset",
        access: "Download",
        frequency: "Annual",
        geo: "Hexagonal grid cells (~25 km²)",
        what: "Maps showing internet availability across Canada — which areas have high-speed broadband and which don't. Broken down by speed tier and technology type (fibre, cable, wireless, satellite).",
        why: "Alberta has invested $780M in rural broadband expansion. Areas getting new broadband access become viable for remote work, e-commerce, and digital services for the first time. If you know where the gaps are closing, you can be early to serve those communities. Relevant for Parkland County rural areas.",
        examples: [
          "Broadband availability by speed tier",
          "Technology type (fibre, fixed wireless, etc.)",
          "Coverage maps by geography",
          "Underserved area identification",
        ],
        indicator: "Leading",
      },
      {
        name: "CVCA Venture Capital Data",
        url: "https://www.cvca.ca/research-insight/vc-pe-canadian-market-overview",
        access: "Web Only",
        frequency: "Quarterly",
        geo: "Provincial",
        what: "The Canadian Venture Capital & Private Equity Association tracks VC deals — how much money is being invested in Canadian startups, in which sectors, and in which provinces. Alberta surpassed BC in VC funding in 2024.",
        why: "VC money flowing into Alberta signals where smart money sees opportunity. If AI/ML companies in Edmonton are getting funded, that sector is growing. VC-backed companies hire aggressively and create ecosystem demand (office space, talent, services).",
        examples: [
          "Total VC investment by province",
          "Number of deals and average deal size",
          "Sector breakdown (tech, cleantech, health, etc.)",
          "Notable deals and companies",
        ],
        indicator: "Leading",
      },
      {
        name: "Patent Filings (CIPO)",
        url: "https://ised-isde.canada.ca/cipo/",
        access: "Download",
        frequency: "Ongoing",
        geo: "By applicant address (can filter to Alberta)",
        what: "The Canadian Intellectual Property Office's patent database — 2.5M+ documents. Searchable by applicant location, technology class, and filing date. Shows who's inventing what and where.",
        why: "Patent filings signal R&D activity and innovation. Filtering to Alberta applicants shows which companies and universities are producing new technology. Clusters of patents in a specific technology area suggest emerging specialization.",
        examples: [
          "Patent applications by Alberta applicants",
          "Technology classification (IPC codes)",
          "Filing trends over time",
          "Assignee (company/institution) analysis",
        ],
        indicator: "Leading",
      },
    ],
  },
];

// ============================================================
// Page Component
// ============================================================

export const metadata: Metadata = {
  title: "Data Sources — Tamrack",
  description: "Complete list of government data sources powering Tamrack — Bank of Canada, Statistics Canada, Alberta Open Data, and more.",
  alternates: {
    canonical: `${SITE_URL}/tools/sources`,
  },
};

export default function SourcesPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <PageHeader
          title="Data Sources"
          description="Everything Tamrack looks at, explained in plain English. Each data source includes what it is, why it matters for making economic decisions, and how we access it."
          category="tools"
          icon={<Database size={20} />}
        >
          <p className="text-sm text-muted leading-relaxed max-w-3xl">
            Sources marked{" "}
            <span className="text-accent-green font-medium">API</span> can be
            pulled automatically.{" "}
            <span className="text-accent font-medium">Download</span> means we
            fetch files on a schedule.{" "}
            <span className="text-accent-amber font-medium">Web Only</span> means
            manual or scraping required.{" "}
            <span className="text-accent-red font-medium">Paid</span> means it
            costs money per search.
          </p>
        </PageHeader>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <QuickStat
          label="Categories"
          value={String(categories.length)}
        />
        <QuickStat
          label="Data Sources"
          value={String(
            categories.reduce((sum, c) => sum + c.sources.length, 0)
          )}
        />
        <QuickStat
          label="Free APIs"
          value={String(
            categories.reduce(
              (sum, c) =>
                sum + c.sources.filter((s) => s.access === "API").length,
              0
            )
          )}
        />
        <QuickStat
          label="Leading Indicators"
          value={String(
            categories.reduce(
              (sum, c) =>
                sum +
                c.sources.filter((s) => s.indicator === "Leading").length,
              0
            )
          )}
        />
      </div>

      {/* Categories */}
      <div className="space-y-10">
        {categories.map((category) => (
          <section key={category.name}>
            <div className="mb-3">
              <SectionHeader title={category.name} icon={<category.icon size={16} />} category="tools" />
              <p className="text-sm text-muted leading-relaxed ml-6">
                {category.description}
              </p>
            </div>

            <div className="space-y-3 ml-8">
              {category.sources.map((source) => (
                <SourceCard key={source.name} source={source} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Legend */}
      <Card className="mt-10">
        <h3 className="text-sm font-medium mb-3">Understanding Indicator Types</h3>
        <div className="grid sm:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-accent-green font-medium">Leading indicators</span>
            <p className="text-muted text-xs mt-1">
              These move BEFORE the economy changes direction. Building permits,
              well licences, and job vacancies tell you what&apos;s coming 3-12
              months from now. Most valuable for decision-making.
            </p>
          </div>
          <div>
            <span className="text-accent font-medium">Coincident indicators</span>
            <p className="text-muted text-xs mt-1">
              These move WITH the economy. Employment, GDP, retail sales, and
              production volumes tell you what&apos;s happening RIGHT NOW. Good for
              confirming trends.
            </p>
          </div>
          <div>
            <span className="text-accent-amber font-medium">Lagging indicators</span>
            <p className="text-muted text-xs mt-1">
              These move AFTER the economy has already changed. Census data,
              assessed property values, and CPI confirm what already happened.
              Useful as baselines and for validation.
            </p>
          </div>
        </div>
      </Card>
    </main>
  );
}

// ============================================================
// Sub-components
// ============================================================

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="text-center">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted mt-1">{label}</p>
    </Card>
  );
}

function SourceCard({ source }: { source: DataSource }) {
  const accessColors = {
    API: "bg-accent-green/10 text-accent-green",
    Download: "bg-accent/10 text-accent",
    "Web Only": "bg-accent-amber/10 text-accent-amber",
    Paid: "bg-accent-red/10 text-accent-red",
  };

  const indicatorColors = {
    Leading: "text-accent-green",
    Coincident: "text-accent",
    Lagging: "text-accent-amber",
  };

  return (
    <Card>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-medium">{source.name}</h3>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${accessColors[source.access]}`}
          >
            {source.access}
          </span>
          <span
            className={`text-[10px] font-mono ${indicatorColors[source.indicator]}`}
          >
            {source.indicator}
          </span>
        </div>
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted hover:text-accent transition-colors shrink-0"
        >
          <ExternalLink size={14} />
        </a>
      </div>

      <div className="space-y-3 text-sm">
        <div>
          <p className="text-xs text-muted font-medium uppercase tracking-wider mb-1">
            What is this?
          </p>
          <p className="text-foreground/80 leading-relaxed">{source.what}</p>
        </div>

        <div>
          <p className="text-xs text-muted font-medium uppercase tracking-wider mb-1">
            Why does it matter?
          </p>
          <p className="text-foreground/80 leading-relaxed">{source.why}</p>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span>
            <span className="text-foreground/60">Updates:</span>{" "}
            {source.frequency}
          </span>
          <span>
            <span className="text-foreground/60">Geography:</span> {source.geo}
          </span>
        </div>

        <div>
          <p className="text-xs text-muted font-medium uppercase tracking-wider mb-1">
            Specific data available
          </p>
          <div className="flex flex-wrap gap-1.5">
            {source.examples.map((ex) => (
              <span
                key={ex}
                className="text-[11px] bg-card-border/60 text-muted px-2 py-0.5 rounded"
              >
                {ex}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
