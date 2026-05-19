# Tamrack — Audience Expansion Plan

(Historically "Alberta Pulse". Rebrand in progress.)

## The Thesis

Tamrack currently serves **realtors and individual investors** with municipal data + macro indicators at $29/mo. But the same underlying data infrastructure — permits, assessments, zoning, business licences, labour, energy, migration — is what **10+ professional segments** pay $5K–$50K/year to access through enterprise platforms. The opportunity is to add targeted datasets, screens, and API endpoints that unlock these audiences without rebuilding the core.

---

## Audience → Dataset → Screen/API Map

### 1. LAND DEVELOPERS & HOMEBUILDERS

**What they need to decide:** Where to buy land, when to break ground, what to build, how fast it'll sell.

**New Datasets:**
| Dataset | Source | Type | Cost |
|---------|--------|------|------|
| CMHC housing starts/completions/under construction | StatsCan 34-10-0154 | Already in data-sources.ts, not yet surfaced | Free |
| CMHC absorption rates (new homes) | StatsCan 34-10-0153 | New table | Free |
| Development permit processing times | Edmonton SODA (calc from permit dates) | Derived from existing data | Free |
| Municipal Development Plans (MDP) | Individual municipality PDFs/sites | Manual curation, link index | Free |
| Land title transfers (volume + price) | Alberta SPIN2 (Service Alberta) | Bulk download, quarterly | ~$0 (FOIP) |
| Subdivision approvals | ArcGIS (Parkland, Stony Plain already have this) | Extend to more municipalities | Free |
| Vacant lot inventory (buildable) | ArcGIS (Stony Plain, Spruce Grove already have this) | Extend to more municipalities | Free |

**New Screens:**
| Screen | Route | What It Shows |
|--------|-------|---------------|
| **Development Pipeline** | `/pipeline` | Housing starts → under construction → completions funnel by municipality. Absorption rates. Months of inventory. "Are we overbuilding?" |
| **Land Bank** | `/land` | Vacant lots across all municipalities, filterable by zoning, size, assessment value. Cross-referenced with nearby permit activity + population growth. "Where's the next subdivision?" |
| **Permit Velocity** | `/permits` (new dedicated page) | Permit processing times, approval rates, permit volume trends by type (residential, commercial, industrial). Municipality comparison. "Which town is fast-tracking development?" |

**New API Endpoints:**
| Endpoint | Returns |
|----------|---------|
| `GET /api/pipeline?municipality=&type=residential` | Starts, completions, under construction, absorption rate, months of inventory |
| `GET /api/land?zoning=R1&min_acres=0.5&municipality=` | Vacant buildable lots with assessment, zoning, nearby activity score |
| `GET /api/permits/velocity?municipality=` | Processing times, volume trends, approval rates |

**Tier:** Pro ($29) for viewing, Business ($149) for API + export

---

### 2. COMMERCIAL REAL ESTATE INVESTORS (Small/Mid)

**What they need to decide:** Where to buy retail/office/industrial, tenant demand signals, cap rate proxies.

**New Datasets:**
| Dataset | Source | Type | Cost |
|---------|--------|------|------|
| Commercial assessment trends | Already have (filter existing assessments by commercial zoning) | Derived | Free |
| Business licence churn (openings vs closures) | Edmonton SODA + StatsCan 33-10-0270 | Already partially wired | Free |
| Commercial vacancy rates | CMHC (rental), Colliers/CBRE reports (manual) | Mix of API + curated | Free–$ |
| Industrial land inventory | ArcGIS (filter zoning=I*) | Derived from existing | Free |
| Retail sales trends (Alberta) | StatsCan 20-10-0056 | Already in data-sources.ts | Free |

**New Screens:**
| Screen | Route | What It Shows |
|--------|-------|---------------|
| **Commercial Pulse** | `/commercial` | Commercial assessments by municipality, business density trends, licence openings/closures by category, retail sales overlay. "Is this strip mall neighbourhood growing or dying?" |
| **Industrial Watch** | `/industrial` | Industrial-zoned land, construction permits (industrial type), manufacturing GDP, pipeline of logistics/warehouse development |

**New API Endpoints:**
| Endpoint | Returns |
|----------|---------|
| `GET /api/commercial?municipality=&category=retail` | Commercial assessments, business density, churn rate, vacancy proxy |
| `GET /api/businesses?municipality=&category=&trend=true` | Business licence trends, openings/closures, category breakdown |

**Tier:** Pro ($29) for viewing, Business ($149) for API

---

### 3. MUNICIPAL ECONOMIC DEVELOPMENT OFFICERS

**What they need to decide:** How to attract investment, what to report to council, how they compare to neighbours.

**New Datasets:**
| Dataset | Source | Type | Cost |
|---------|--------|------|------|
| Municipal financial statements | Alberta Municipal Affairs (annual) | PDF/CSV scrape | Free |
| Tax rates by municipality | Municipal websites (annual) | Manual curation | Free |
| Infrastructure spending | Municipal budgets (annual) | Manual curation | Free |
| Population estimates (sub-provincial) | StatsCan 17-10-0148 | New table | Free |
| Alberta corporate registry (new incorporations by location) | Service Alberta | Bulk data request | ~$0 |
| Building permit values (not just counts) | Already have for Edmonton, extend | Existing + extend | Free |

**New Screens:**
| Screen | Route | What It Shows |
|--------|-------|---------------|
| **Municipal Benchmarks** | `/benchmarks` | Side-by-side comparison of any 2–5 municipalities: permit activity, assessment growth, business formation, population growth, tax rates. Exportable to PDF for council presentations. |
| **Investment Scorecard** | `/scorecard` | Weighted composite score per municipality: growth trajectory, infrastructure investment, business climate, affordability, labour availability. "Rank the towns." |
| **Economic Impact Report** | `/m/[slug]/report` | Auto-generated one-pager per municipality: key metrics, trends, strengths/risks. Designed for embedding in EDO marketing materials. |

**New API Endpoints:**
| Endpoint | Returns |
|----------|---------|
| `GET /api/benchmarks?municipalities=stony-plain,spruce-grove,leduc&metrics=permits,assessments,population` | Comparative data for selected municipalities + metrics |
| `GET /api/scorecard?municipality=` | Composite investment score with breakdown |
| `GET /api/report/[slug]?format=json|pdf` | Auto-generated economic summary |

**Tier:** Business ($149/mo) or annual municipal licence ($2,400/yr)

---

### 4. SITE SELECTION CONSULTANTS & FRANCHISE OPERATORS

**What they need to decide:** Where to open the next location — labour, traffic, competition, demographics, growth.

**New Datasets:**
| Dataset | Source | Type | Cost |
|---------|--------|------|------|
| Traffic counts | Stony Plain ArcGIS (already have), Alberta Transportation open data | Extend | Free |
| Business category density (competition mapping) | Edmonton SODA + ArcGIS business licences | Derived from existing | Free |
| Household income proxies | Assessment values (already have) + StatsCan income tables | Mix | Free |
| Labour force by occupation | StatsCan 14-10-0023 | New table | Free |
| Daytime population estimates | Environics (paid) or derive from business licence density | Derived or paid | Free–$$ |
| Drive-time/catchment areas | OpenRouteService API or Mapbox isochrones | New integration | Free tier available |

**New Screens:**
| Screen | Route | What It Shows |
|--------|-------|---------------|
| **Site Selector** | `/sites` | Map-based tool: pick a location or municipality, see labour availability, competition (business licences by category), traffic, population growth, household spending power (assessment proxy), permit activity (growth signal). Filterable by business category. |
| **Competition Map** | `/competition` | Business licence heatmap by category across municipalities. "How many pizza shops per capita in Spruce Grove vs Leduc?" Gap analysis. |
| **Growth Corridors** | `/corridors` | Municipalities ranked by compound growth signals: population + permits + business formation + assessment growth. "Where's the next Airdrie?" |

**New API Endpoints:**
| Endpoint | Returns |
|----------|---------|
| `GET /api/sites/score?lat=&lng=&category=restaurant&radius=5km` | Site score: labour, competition, traffic, growth, affordability |
| `GET /api/competition?category=restaurant&municipality=` | Business count, density per capita, trend, saturation index |
| `GET /api/corridors?min_population=10000&sort=growth_score` | Ranked growth corridors with composite scores |

**Tier:** Business ($149/mo) with API, or per-report pricing ($49/report)

---

### 5. MORTGAGE BROKERS & LENDERS

**What they need to decide:** Risk assessment on specific municipalities, identify hot/cooling markets, portfolio exposure.

**New Datasets:**
| Dataset | Source | Type | Cost |
|---------|--------|------|------|
| CMHC rental vacancy rates | StatsCan 34-10-0127 | Already in data-sources.ts | Free |
| CMHC average rents by unit type | StatsCan 34-10-0133 | Already in data-sources.ts | Free |
| Mortgage arrears (Alberta) | CMHC/CBA | Quarterly reports | Free |
| Assessment-to-sale price ratios | Stony Plain ArcGIS (has both) | Derived | Free |
| Insolvency filings | OSB Open Canada | New integration | Free |
| Interest rate sensitivity | BoC (already have) + mortgage rate spreads | Derived | Free |

**New Screens:**
| Screen | Route | What It Shows |
|--------|-------|---------------|
| **Market Risk Dashboard** | `/risk` | Municipality-level risk indicators: assessment trend (↑↓), vacancy rate, permit pipeline (oversupply risk), employment dependency (single-industry risk), insolvency trend, mortgage rate sensitivity. Traffic-light system. |
| **Rental Intelligence** | `/rental` | Vacancy rates, average rents by unit type, rent-to-assessment ratio (yield proxy), new rental construction pipeline. By CMA + municipality where available. |

**New API Endpoints:**
| Endpoint | Returns |
|----------|---------|
| `GET /api/risk?municipality=` | Risk score with components: employment, vacancy, supply pipeline, insolvency, rate sensitivity |
| `GET /api/rental?municipality=&unit_type=2bed` | Vacancy, avg rent, trend, yield proxy, new supply |
| `GET /api/insolvency?region=alberta&trend=true` | Consumer + business insolvency filings, trend |

**Tier:** Business ($149/mo)

---

### 6. INSURANCE UNDERWRITERS

**What they need to decide:** Property risk pricing by area, portfolio concentration, replacement cost trends.

**New Datasets:**
| Dataset | Source | Type | Cost |
|---------|--------|------|------|
| Building age distribution | Stony Plain ArcGIS year_built (already have) | Extend to more municipalities | Free |
| Construction cost index | StatsCan 327-0058 or BoC M.MTLS | Already have metals index | Free |
| Wildfire risk zones | Alberta Wildfire (open data) | New integration | Free |
| Flood zone mapping | Alberta Environment (open data) | New integration | Free |
| Hail damage zones | Alberta Severe Weather (ECCC) | New integration | Free |
| Property type distribution | Assessment data (already have property classes) | Derived | Free |

**New Screens:**
| Screen | Route | What It Shows |
|--------|-------|---------------|
| **Property Risk Profile** | `/m/[slug]/risk` | Sub-page per municipality: building age histogram, construction material trends, natural hazard overlay (wildfire/flood/hail zones), replacement cost trends, assessment growth. |

**New API Endpoints:**
| Endpoint | Returns |
|----------|---------|
| `GET /api/property-profile?municipality=&zoning=` | Age distribution, construction types, assessment range, hazard flags |
| `GET /api/hazards?municipality=` | Wildfire, flood, hail risk scores + zone boundaries |

**Tier:** Enterprise ($499/mo) — insurance is low volume, high willingness to pay

---

### 7. WEALTH MANAGERS & FINANCIAL ADVISORS

**What they need to decide:** Alberta exposure advice for clients — real estate vs financial assets, timing, municipality selection.

**New Datasets:**
| Dataset | Source | Type | Cost |
|---------|--------|------|------|
| TSX Energy sub-index | Yahoo Finance or TMX (free delayed) | New integration | Free |
| WCS/WTI oil price spread | Alberta Energy (open data) or BoC | New integration | Free |
| Alberta government revenue/surplus | Alberta Budget (annual) | Manual curation | Free |
| Household debt-to-income | StatsCan 11-10-0024 | New table | Free |
| Net worth by province | StatsCan Survey of Financial Security | Periodic | Free |

**New Screens:**
| Screen | Route | What It Shows |
|--------|-------|---------------|
| **Alberta Investment Thesis** | `/invest` | One-page macro view for advisors: cycle position, energy outlook, rate environment, migration momentum, real estate trajectory. "Should my Alberta clients buy investment property right now?" With historical context (2008, 2014, 2020 busts). |
| **Asset Allocation Signals** | `/allocation` | Energy price → Alberta GDP → employment → real estate leading indicator chain. When energy leads, what follows? Historical correlation analysis. |

**New API Endpoints:**
| Endpoint | Returns |
|----------|---------|
| `GET /api/cycle/position` | Current cycle phase, confidence, key indicators, historical comparison |
| `GET /api/outlook?horizon=6mo|1yr|3yr` | Forward-looking signal composite: energy, labour, migration, construction |

**Tier:** Pro ($29) for screens, Business ($149) for API integration into advisor tools

---

### 8. INFRASTRUCTURE & UTILITY COMPANIES

**What they need to decide:** Where demand is growing, capacity planning, infrastructure investment timing.

**New Datasets:**
| Dataset | Source | Type | Cost |
|---------|--------|------|------|
| Construction permits by type (infrastructure) | Edmonton SODA (already have, filter by type) | Derived | Free |
| Population projections (sub-provincial) | StatsCan 17-10-0057 or Alberta Treasury Board | New table | Free |
| Development stages (lot counts by year) | Spruce Grove ArcGIS (already have) | Extend | Free |
| Water/sewer capacity | Municipal utility reports | Manual curation | Free |
| Road construction projects | Edmonton SODA 7wiq-4rgy (already wired) | Already have | Free |

**New Screens:**
| Screen | Route | What It Shows |
|--------|-------|---------------|
| **Growth Forecast** | `/growth` | Population projections, housing pipeline (starts → completions), development stages, permit velocity → demand forecast by municipality. "Beaumont needs fibre buildout in 18 months." |

**New API Endpoints:**
| Endpoint | Returns |
|----------|---------|
| `GET /api/growth?municipality=&horizon=3yr` | Population projection, housing pipeline, infrastructure demand signals |
| `GET /api/development-stages?municipality=` | Subdivision stages, lot counts, developer info, timelines |

**Tier:** Enterprise ($499/mo)

---

### 9. JOURNALISTS & POLICY RESEARCHERS

**What they need to decide:** Stories to write, policies to evaluate, data to cite.

**New Datasets:**
| Dataset | Source | Type | Cost |
|---------|--------|------|------|
| Historical data comparisons | Snapshot DB (already building) | Already building | Free |
| Alberta budget data | Alberta Open Data | New integration | Free |
| Election boundaries + results | Elections Alberta | New integration | Free |
| Income inequality proxies | Assessment distribution (already have) | Derived | Free |

**New Screens:**
| Screen | Route | What It Shows |
|--------|-------|---------------|
| **Data Stories** | `/stories` | Auto-generated narratives from data changes: "Spruce Grove business licences up 23% YoY", "Edmonton teardown activity at 5-year high". Shareable, embeddable. Powered by snapshot change detection. |
| **Compare Anything** | `/compare` | Flexible comparison tool: any metric × any municipality × any time range. Chart + table + embed code. The journalist's Swiss army knife. |

**New API Endpoints:**
| Endpoint | Returns |
|----------|---------|
| `GET /api/stories?limit=10&category=` | Auto-generated data stories with embed links |
| `GET /api/compare?metric=permits&municipalities=a,b,c&from=2024-01&to=2026-03` | Flexible comparison data |

**Tier:** Media licence ($99/mo) with unlimited embeds + attribution

---

### 10. ENERGY SECTOR (New Vertical)

**What they need to decide:** Where to drill/invest, service company deployment, land acquisition.

**New Datasets:**
| Dataset | Source | Type | Cost |
|---------|--------|------|------|
| AER well licences | AER ST37 (monthly CSV download) | New integration | Free |
| Petrinex production data | Petrinex public (monthly) | New integration | Free |
| WCS oil price | Alberta Energy or financial feeds | New integration | Free |
| Drilling rig count | CAODC (Canadian Association of Oilwell Drilling Contractors) | Web scrape or manual | Free |
| Pipeline capacity utilization | CER open data | New integration | Free |
| Oilfield service company activity | AER + business licences | Derived | Free |

**New Screens:**
| Screen | Route | What It Shows |
|--------|-------|---------------|
| **Drilling Activity** | `/drilling` | Well licences by region/type/operator, rig count trend, production volumes, WCS price overlay. "Is drilling ramping up or down?" |
| **Energy Map** | `/energy-map` | Geographic view of well licences, production, pipeline infrastructure near registered municipalities. "What energy activity is near Drayton Valley?" |

**New API Endpoints:**
| Endpoint | Returns |
|----------|---------|
| `GET /api/wells?region=&operator=&type=oil|gas&period=` | Well licence counts, trends, operator breakdown |
| `GET /api/production?region=&commodity=oil|gas` | Production volumes, trends |

**Tier:** Business ($149/mo) — oilfield services companies are high willingness to pay

---

## Implementation Priority

### Phase 1: Quick Wins (1–2 sessions, mostly surfacing data we already have)

| # | What | Why | Effort |
|---|------|-----|--------|
| 1 | **`/pipeline`** — Housing starts/completions from StatsCan 34-10-0154 (already in data-sources.ts) | Developers + lenders. Data is wired, just needs a screen. | Low |
| 2 | **`/commercial`** — Filter existing assessments/businesses by commercial zoning | CRE investors. Derived from existing data. | Low |
| 3 | **`/rental`** — CMHC vacancy + rents from StatsCan 34-10-0127/0133 (already in data-sources.ts) | Lenders + investors. Data is wired, needs a screen. | Low |
| 4 | **`/benchmarks`** — Side-by-side municipality comparison using existing data | EDOs. Just a comparison UI over existing APIs. | Low |
| 5 | **`/compare`** — Flexible metric × municipality × time tool | Journalists, researchers. Generic comparison over existing data. | Medium |
| 6 | **Auto-generated data stories** from snapshot diffs | Journalists, embeds, SEO. Needs 2+ snapshots. | Medium |

### Phase 2: New Data Integrations (2–3 sessions)

| # | What | Why | Effort |
|---|------|-----|--------|
| 7 | **AER well licences + Petrinex production** | Energy vertical — high-value audience | Medium |
| 8 | **OSB insolvency filings** | Lenders, risk assessment | Medium |
| 9 | **WCS oil price + TSX Energy index** | Wealth managers, energy overlay | Low |
| 10 | **Alberta wildfire/flood/hail zones** | Insurance underwriters | Medium |
| 11 | **Traffic counts** (extend beyond Stony Plain) | Site selection, franchise operators | Medium |
| 12 | **CMHC absorption rates** (StatsCan 34-10-0153) | Developers — how fast are new homes selling? | Low |

### Phase 3: High-Value Screens (3–4 sessions)

| # | What | Why | Effort |
|---|------|-----|--------|
| 13 | **`/risk`** — Market risk dashboard (composite score) | Lenders — this is their daily tool | High |
| 14 | **`/sites`** — Site selector with scoring | Franchise operators, site selection consultants | High |
| 15 | **`/scorecard`** — Investment scorecard per municipality | EDOs, investors — "rank the towns" | Medium |
| 16 | **`/drilling`** — Well licences + production | Energy companies | Medium |
| 17 | **`/invest`** — Alberta investment thesis (advisor view) | Wealth managers | Medium |
| 18 | **`/growth`** — Population + infrastructure forecast | Utilities, infrastructure | Medium |
| 19 | **`/stories`** — Auto-generated data narratives | Journalists, SEO, embeds | Medium |
| 20 | **`/corridors`** — Growth corridor ranking | Everyone — the "leaderboard" | Medium |

### Phase 4: Premium Features

| # | What | Why | Effort |
|---|------|-----|--------|
| 21 | PDF report generation (`/m/[slug]/report`) | EDOs need printable reports for council | Medium |
| 22 | Alert/notification system (email when signals change) | All audiences — retention driver | High |
| 23 | Custom dashboard builder (pick your metrics) | Enterprise — "build your own view" | High |
| 24 | Map visualizations (Mapbox/Leaflet) | Everyone — visual impact | High |

---

## Revised Pricing Tiers

| Tier | Price | Audience | Access |
|------|-------|----------|--------|
| **Explorer** | Free | Everyone | Macro pages, municipalities directory, 3 data stories/month |
| **Pro** | $29/mo | Realtors, individual investors | All screens, municipality deep-dives, alerts (5), basic export |
| **Business** | $149/mo | Brokers, advisors, franchises, energy | API access (10K calls/mo), bulk export, unlimited alerts, embed rights, priority data |
| **Enterprise** | $499/mo | EDOs, utilities, insurance, lenders | Unlimited API, PDF reports, custom municipalities, SLA, multi-seat (5), dedicated support |
| **Media** | $99/mo | Journalists, researchers | All screens + unlimited embeds with attribution, no API |

---

## New StatsCan Tables to Wire

These are free and follow the same WDS API pattern already in `data-sources.ts`:

| Table | What | For |
|-------|------|-----|
| 34-10-0153 | New housing absorption rates | Developers |
| 34-10-0127 | Rental vacancy rates (already referenced) | Lenders, investors |
| 34-10-0133 | Average rents by unit type (already referenced) | Lenders, investors |
| 17-10-0057 | Population projections | Utilities, infrastructure |
| 14-10-0023 | Labour force by occupation | Site selection |
| 11-10-0024 | Household debt-to-income | Wealth managers |
| 327-0058 | Construction cost index | Insurance, developers |

---

## New External Data Sources to Integrate

| Source | URL/Method | Data | For | Effort |
|--------|-----------|------|-----|--------|
| AER ST37 | Monthly CSV from aer.ca | Well licences by operator, type, region | Energy | Medium |
| Petrinex Public | Monthly CSV from petrinex.ca | Oil/gas production by well/area | Energy | Medium |
| OSB Insolvency | Open Canada CKAN API | Consumer + business filings by province | Lenders | Low |
| Alberta Wildfire | Open Alberta CKAN | Wildfire risk zones, historical fires | Insurance | Medium |
| Alberta Flood | Alberta Environment open data | Flood zone mapping | Insurance | Medium |
| ECCC Severe Weather | Open Canada | Hail events, severe storm history | Insurance | Medium |
| CER Pipeline | CER open data | Pipeline capacity, throughput | Energy | Low |
| CAODC Rig Count | Web scrape or manual | Active drilling rigs | Energy | Low |
| Alberta Corporate Registry | Service Alberta bulk | New incorporations by location | EDOs, site selection | Medium |
| TMX/Yahoo Finance | Free API | TSX Energy index, WCS price | Wealth managers | Low |

---

## Summary: What This Gets Us

| Metric | Current | After Phase 1–3 |
|--------|---------|-----------------|
| Target audiences | 2 (realtors, individual investors) | 10+ professional segments |
| Screens | 20 pages | 35+ pages |
| API endpoints | 4 | 15+ |
| Data sources | ~15 | ~25 |
| Price ceiling | $29/mo | $499/mo |
| TAM (Alberta) | ~5,000 realtors × $29 = $1.7M/yr | $1.7M + EDOs ($1.2M) + lenders ($2M) + energy ($3M) + ... |

The core thesis holds: **the data is free, the infrastructure exists, the code to stitch it together is the moat.** Each new audience shares 80% of the same underlying data — the marginal cost of adding a new vertical is just the screen + maybe one new data source.
