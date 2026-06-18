# Tamrack — Phase 1 Handoff (Audience Expansion)

(Historically "Alberta Pulse". Rebrand in progress.)

## What Was Built (This Session)

### 6 New Pages

| Page | Route | Access | Data Sources | Target Audiences |
|------|-------|--------|-------------|-----------------|
| **Development Pipeline** | `/pipeline` | Free funnel | StatsCan 34-10-0154 (starts/completions/under construction), 34-10-0292 (permit values) | Developers, lenders, investors |
| **Rental Intelligence** | `/rental` | Free funnel | StatsCan 34-10-0127 (vacancy), 34-10-0133 (rents by unit type) | Lenders, rental investors, property managers |
| **Commercial Pulse** | `/commercial` | Free funnel | Edmonton SODA (commercial assessments, business licences, commercial permits), StatsCan 20-10-0056 (retail sales) | CRE investors, franchise ops, site selection |
| **Municipal Benchmarks** | `/benchmarks` | Paid | Municipality registry (all 20 live ArcGIS endpoints) + StatsCan macro | EDOs, investors, site selection, developers |
| **Market Risk Dashboard** | `/risk` | Paid | BoC (policy rate, energy), StatsCan (unemployment, vacancy, starts/completions) | Lenders, underwriters, risk analysts |
| **Growth Corridors** | `/corridors` | Paid | Municipality registry (all 20 live ArcGIS endpoints) | Investors, developers, EDOs, franchise operators |

### New Data Fetchers (data-sources.ts)

4 new functions added:
- `fetchEdmontonCommercialAssessments(limit)` — Non-residential assessments by neighbourhood
- `fetchEdmontonBusinessCategories(limit)` — Active business licences grouped by category
- `fetchEdmontonBusinessesByNeighbourhood(limit)` — Business count per neighbourhood
- `fetchEdmontonCommercialPermits()` — Monthly commercial building permits

All use existing Edmonton SODA API — no new external dependencies.

### Nav Updates (nav.tsx)

- Added new icons: Building, Store, Scale, ShieldAlert, Rocket
- Real Estate section expanded: +3 items (Pipeline, Rental Intel, Commercial)
- New "Intelligence" section: Benchmarks, Growth Corridors, Market Risk

### Middleware Updates (middleware.ts)

- `/pipeline`, `/rental`, `/commercial` added to `freePages[]` (no subscription required — funnel)
- `/benchmarks`, `/corridors`, `/risk` are gated (require active subscription)

### Bug Fix

- Fixed pre-existing type error in `src/app/traffic/page.tsx` — map callback used wrong field names (importance/description/area → highImportance/message/regions)

---

## Architecture Notes for Next Agent

### Page Pattern
Every page follows the same pattern (see any existing page like `/energy/page.tsx`):
1. Server-side async data fetchers at the top
2. Async React Server Components for each section
3. `<Suspense>` wrappers with loading skeletons
4. Page component composes sections with headers
5. Footer with data source attribution

### Chart Components Available (`src/components/chart.tsx`)
- `TimeSeriesAreaChart` — Single series area with gradient
- `TimeSeriesBarChart` — Single series bar
- `MultiSeriesLineChart` — Multi-line with optional dual Y-axis
- `StackedAreaChart` — Composition/stacked area
- `NeighbourhoodBarChart` — Horizontal bar, sorted

### Data Layer
- **StatsCan**: `fetchStatCanTimeSeries(tableId, coordinate, latestN)` — returns `TimeSeriesPoint[]`
- **BoC**: `fetchBoCTimeSeries(seriesName, recent)` — returns `TimeSeriesPoint[]`
- **Edmonton**: `fetchEdmontonData(datasetId, params)` — raw Socrata SODA
- **Municipalities**: `fetchMunicipalityMetrics(config)` — normalized metrics from ArcGIS
- **Registry**: `getLiveMunicipalities()`, `getMunicipalitiesByRegion()` — config lookup

### Access Control
- Public routes: listed in `publicRoutes[]` in middleware.ts
- Free funnel: listed in `freePages[]` — requires login, no subscription
- Paid: everything else — requires active Stripe subscription or trial
- API: requires Bearer token (`ap_*`) + subscription

---

## What To Build Next (Phase 2)

### Priority Order (from audience-expansion-plan.md)

**Phase 2A: New Data Integrations (add to data-sources.ts)**

1. **AER Well Licences** — Monthly CSV from aer.ca → `fetchAERWellLicences()`. Enables `/drilling` page for energy sector audience.
2. **OSB Insolvency Filings** — Open Canada CKAN API → `fetchInsolvencyFilings()`. Enables risk dashboard enhancement.
3. **WCS Oil Price + TSX Energy Index** — Yahoo Finance or Alberta Energy open data. Quick win for `/energy` and `/risk` pages.
4. **Alberta Wildfire/Flood/Hail Zones** — Geospatial data for insurance underwriter audience. Some wildfire data already scaffolded in data-sources.ts.
5. **CMHC Absorption Rates** — StatsCan 34-10-0153. Quick win — same API pattern as existing CMHC data.
6. **Traffic Counts** — Extend beyond Stony Plain ArcGIS to Alberta Transportation open data.

**Phase 2B: New Screens**

7. **`/drilling`** — Well licences by region/type/operator, rig count trend, production volumes. Energy sector vertical.
8. **`/invest`** — Alberta Investment Thesis page for wealth managers. Macro cycle position + energy outlook + rate environment + migration momentum.
9. **`/compare`** — Flexible comparison tool: any metric × any municipality × any time range. For journalists + researchers.
10. **`/stories`** — Auto-generated data narratives from snapshot diffs. Needs 2+ snapshots in DB.
11. **`/sites`** — Site selector tool for franchise operators. Map-based with scoring.

**Phase 2C: API Expansion**

12. **`GET /api/pipeline`** — Starts, completions, under construction, absorption rate
13. **`GET /api/risk`** — Risk score with components per municipality
14. **`GET /api/benchmarks`** — Comparative data for selected municipalities
15. **`GET /api/corridors`** — Growth corridor rankings with scores
16. **`GET /api/commercial`** — Commercial assessments + business density
17. **`GET /api/rental`** — Vacancy, avg rent, trend, yield proxy

### Suggested Prompt for Next Agent

```
Continue building the Tamrack audience expansion (Phase 2).

Context:
- All pages follow the same pattern — read /energy/page.tsx as the template
- Data sources are in src/lib/data-sources.ts
- Municipality data in src/lib/municipality-data.ts + municipality-registry.ts

Phase 2 priorities:
1. Add AER well licences data fetcher (CSV from aer.ca) + build /drilling page
2. Add WCS oil price fetcher + enhance /energy page
3. Build /compare page (flexible metric × municipality comparison)
4. Build /invest page (Alberta investment thesis for wealth managers)
5. Build API endpoints for the Phase 1 pages (/api/pipeline, /api/risk, /api/benchmarks, /api/corridors, /api/commercial, /api/rental)
6. Add CMHC absorption rates (StatsCan 34-10-0153) to /pipeline page
7. Update nav + middleware for new pages

Do NOT auto-start the dev server — the user prefers to run it themselves.
Build iteratively. Leave a HANDOFF-PHASE2.md when done.
```

---

## Known Issues (Pre-Existing, Not From This Session)

1. **Build chunk errors**: Next.js 16 Turbopack has intermittent chunk generation failures during `next build`. TypeScript compilation passes clean. Dev server (`npm run dev`) works fine. This may resolve with a Next.js update.
2. **API route type errors**: Several API routes (safety, traffic, weather) have return type mismatches where `ApiAuthResult` (a plain object) can be returned instead of `NextResponse`. These predate the current session.
3. **Coverage page reference**: Nav links to `/coverage` page which may not exist yet.
