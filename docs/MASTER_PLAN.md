# Alberta Pulse — Master Plan

## Vision

Alberta Pulse is not one product. It is a **data platform** that powers multiple focused products, each serving a specific audience with a specific value proposition. The shared foundation is a catalogue of live Alberta public data. The products are opinionated views of that data, tailored to how each audience actually works.

## Products

| Product | Audience | Price | Status |
|---------|----------|-------|--------|
| **Pulse Charts** | General public, media, bloggers, researchers | Free | Phase 1 — 1.3 COMPLETE |
| **Pulse EDO** | Municipal economic development officers | $299/mo per municipality | Phase 2 — 2.5 COMPLETE |
| **Pulse Realtor** | Alberta realtors & brokerages | $49/mo per seat | Phase 3 — 3.3 COMPLETE |
| **Pulse Learn** | Students, newcomers, curious Albertans | Free (brand play) | Phase 4 — 4.1 COMPLETE |

## Architecture Principle

One Next.js app. One data layer. Multiple product surfaces distinguished by route prefix and middleware gating:

```
/                        → Landing page (public)
/charts/*                → Pulse Charts catalogue (public, SEO)
/edo/*                   → Pulse EDO (authenticated, $299/mo)
/realtor/*               → Pulse Realtor (authenticated, $49/mo)
/learn/*                 → Pulse Learn (public)
/embed/[chartId]         → Embeddable charts (public, no chrome)
/admin/*                 → Admin (role-gated)
/account, /billing       → User management
/api/*                   → Data API
/pricing                 → Pricing (public)
/login                   → Auth (public)
```

Each product surface gets its own layout, nav, and onboarding. The shared data layer (`src/lib/data-sources-*.ts`) serves all of them.

---

## Phase 1 — Pulse Charts (The Free Catalogue)

**Goal**: Repackage existing charts as a public, searchable, shareable catalogue. This is the top-of-funnel that drives SEO traffic, social sharing, and brand awareness. Every chart is a marketing asset.

**What it is**: A clean grid of every data visualization in the system. Each chart gets its own permalink page with: the chart itself, data source citation, last-updated timestamp, embed code, share buttons, and a "Powered by Alberta Pulse" watermark. No story, no editorial — just beautiful, trustworthy, up-to-date Alberta data.

**Think**: Unsplash for Alberta data charts.

### Phase 1.0 — Foundation & Route Restructure
> Restructure the app to support the multi-product architecture.

**1.0.1 — Create product route groups**
- Create route group directories: `src/app/(charts)/`, `src/app/(edo)/`, `src/app/(realtor)/`, `src/app/(learn)/`
- Each route group gets its own `layout.tsx`
- Move existing pages into appropriate route groups (most go to `(charts)` for now)
- Keep `/admin`, `/account`, `/billing`, `/login`, `/pricing`, `/embed` at the top level

**1.0.2 — Build the top bar component**
- New component: `src/components/top-bar.tsx`
- 7 section links for charts product: Home, Economy, Real Estate, Community, Environment, Governance, Municipalities
- Search trigger (Cmd+K) — reuse existing command palette
- User avatar menu (Account, Billing, Sign Out) — replaces these from sidebar
- Responsive: collapses to hamburger on mobile
- Active section highlighting based on current route

**1.0.3 — Build the contextual sidebar component**
- New component: `src/components/section-sidebar.tsx`
- Reads current top-level section from URL
- Renders only the sub-pages for that section
- Supports sub-headers within sections (e.g., "Industries" / "Analysis" under Economy)
- Collapsible on desktop (persisted to localStorage)
- Hidden on mobile (hub pages handle discovery instead)

**1.0.4 — Build mobile bottom tab bar**
- New component: `src/components/mobile-tabs.tsx`
- 5 tabs: Home, Economy, Real Estate, Community, More
- "More" opens a sheet/drawer with: Environment, Governance, Municipalities, Account
- Only renders on mobile (hidden on md+ breakpoints)
- Active tab highlighting

**1.0.5 — Update app-shell for multi-product layouts**
- Modify `src/components/app-shell.tsx` to detect product context from route
- Charts product: top bar + contextual sidebar + mobile tabs
- EDO product: EDO-specific nav (built in Phase 2)
- Realtor product: Realtor-specific nav (built in Phase 3)
- Learn product: Learn-specific nav (built in Phase 4)
- Public routes (landing, login, pricing): no nav, same as today

**1.0.6 — Reorganize page routes**
Move and rename routes per the nav redesign plan (`docs/nav-redesign-plan.md`):
- `/dashboard` → `/home/dashboard`
- `/overview/signals` → `/home/signals`
- `/overview/briefing` → `/home/briefings`
- `/learn/*` → `/home/learn/*`
- `/economy/cycle` → `/economy/boom-bust`
- `/economy/labour` → `/community/labour`
- `/economy/migration` → `/community/immigration`
- `/intelligence/*` → `/economy/{benchmarks,corridors,risk,cycle-position,invest,compare}`
- `/health/*` → `/community/{health,demographics,mortality}`
- `/safety/*` → `/community/{crime,fire-response,traffic,seismic,emergencies}`
- `/politics/*` → `/governance/*`
- Delete `/safety/elections` redirect (orphaned)
- Update all internal links, nav config, and middleware route lists

**1.0.7 — Update middleware for new routes**
- Update public route prefixes in `src/middleware.ts`
- Update free vs gated page lists
- Add product-level gating logic (prepare for EDO/Realtor routes)

### Phase 1.1 — Chart Catalogue
> Build the public chart catalogue that turns every visualization into a shareable, embeddable asset.

**1.1.1 — Create chart registry**
- New file: `src/lib/chart-registry.ts`
- Catalogue every chart in the app: ID, title, description, category, data source, component reference
- Extend existing embed chart registry if possible
- Each entry: `{ id, title, description, category, subcategory, dataSource, sourceUrl, component, tags }`

**1.1.2 — Build chart catalogue page**
- Route: `/charts`
- Searchable, filterable grid of all charts
- Filter by category (Economy, Real Estate, Community, Environment, Governance)
- Filter by municipality (if applicable)
- Search by keyword
- Card shows: chart thumbnail/preview, title, category badge, last updated
- Public, SEO-optimized, no auth required

**1.1.3 — Build individual chart pages**
- Route: `/charts/[chartId]`
- Full-size chart rendering
- Metadata panel: data source name + link, update frequency, last refreshed timestamp
- Embed code snippet (copy button) — reuses existing embed system
- Share buttons (copy link, Twitter/X, LinkedIn)
- "More charts in [category]" sidebar or footer
- "Powered by Alberta Pulse" branding
- Public, SEO-optimized

**1.1.4 — Wire chart pages to existing data**
- Each chart page fetches data using existing data source functions
- Reuse existing chart components (Recharts-based)
- Add `lastUpdated` metadata to data source responses where not already present

**1.1.5 — Update landing page**
- Add "Browse the Chart Catalogue" section
- Show 6-8 featured charts as a preview grid
- Link to `/charts`
- Update hero copy to emphasize the catalogue

**1.1.6 — SEO & social sharing**
- OpenGraph images for each chart (can use existing `/api/og` route pattern)
- Structured data (Dataset schema) for each chart page
- Sitemap generation including all chart pages
- Meta descriptions per chart

### Phase 1.2 — Enhanced Hub Pages
> Make each section's overview page a rich landing page so mobile users can navigate without a sidebar.

**1.2.1 — Design hub page template**
- Card grid layout showing all sub-pages in the section
- Each card: title, one-line description, mini chart preview or icon, link
- Works as primary navigation on mobile
- Desktop users can use sidebar OR hub page

**1.2.2 — Build hub pages for each section**
- `/home` — Dashboard highlights + links to signals, briefings, learn
- `/economy` — Key macro indicators + cards for all economy sub-pages
- `/real-estate` — Market snapshot + cards for sub-pages
- `/community` — Population/safety headlines + cards for sub-pages
- `/environment` — Current conditions + cards for sub-pages
- `/governance` — Legislature status + cards for sub-pages
- `/municipalities` — Search/filter explorer (already exists, enhance)

### Phase 1.3 — Landing Page Platform Repositioning
> Reposition the landing page from a single-product dashboard pitch to a multi-product data platform. The visitor should understand within 5 seconds: Alberta Pulse is a platform with free charts, paid products for EDOs and realtors, and a learning hub. The background animation (HeroVisualization), live ticker, and sparkline bar are preserved unchanged.

**1.3.1 — Rewrite hero section copy and CTAs**
- Change headline from "Community intelligence built in Alberta, for Alberta" to platform-oriented copy (e.g., "Alberta's data platform" with "Charts. Intelligence. Reports." as secondary line)
- Change subtitle from single "185+ live data feeds" pitch to a platform value prop: multiple products built on one data foundation
- Replace the two CTAs ("Try it free for 14 days" + "Explore the dashboard") with:
  - Primary CTA: "Browse free charts" → `/charts` (top-of-funnel)
  - Secondary CTA: "See products" → `#products` (anchor to products section)
  - Tertiary: "Sign in" → `/login` (small text, not a button)
- Remove "No credit card required" (the free product IS free, no trial framing needed)
- Keep ThemeToggle, Activity icon + brand mark, and maple leaf exactly as-is

**1.3.2 — Build products showcase section**
- New section between scale stats bar and chart catalogue CTA, with `id="products"`
- Responsive grid: 1 col mobile, 2 col tablet, 4 col desktop
- Each card: product icon (lucide), name, price badge, 2-3 line value prop, audience tagline, status ("Available now" or "Coming soon"), CTA link
- Products: Pulse Charts (BarChart3, Free, → `/charts`), Pulse EDO (Building2, $299/mo, → `/pricing`), Pulse Realtor (Home, $49/mo, → `/pricing`), Pulse Learn (GraduationCap, Free, → `/home/learn`)
- Use existing card styling: `bg-card border border-card-border rounded-xl`

**1.3.3 — Reframe scale stats bar as platform stats**
- Keep "185+ Live data feeds" and "30 Municipalities"
- Change "54 Regional indicators" → "100+ Charts" (computed from `CHART_REGISTRY.length`)
- Change "18 Government sources" → "4 Products" or keep sources and add charts as 5th stat

**1.3.4 — Brand the chart catalogue section as lead product**
- Add "Pulse Charts" product badge/pill above heading
- Add "Free forever. No account required." line
- Keep category cards and CTA as-is

**1.3.5 — Replace "Built for your role" with product-audience mapping**
- Replace 8 role cards with 4 product-audience cards:
  - EDOs and municipal staff → Pulse EDO
  - Realtors and brokerages → Pulse Realtor
  - Researchers, media, public → Pulse Charts
  - Students and newcomers → Pulse Learn
- 2-column grid: paid products top, free products bottom
- Each card: icon, product name, audience, 2-line value prop, CTA link, price badge

**1.3.6 — Reframe "The full picture" as platform capabilities**
- Reframe heading to "One data foundation, four products" or similar
- Keep 10 capability cards but add subtle product badge (Charts/EDO/Realtor/Learn) showing which product each feeds into

**1.3.7 — Rewrite bottom CTA section**
- Headline: "Start with free charts. Upgrade when you're ready."
- Subtext: "100+ live Alberta data charts, free forever. Purpose-built products for EDOs and realtors coming soon."
- Primary CTA: "Browse the chart catalogue" → `/charts`
- Secondary CTA: "See all products" → `/pricing`

**1.3.8 — Update pricing page to 4-product model**
- Restructure from 3 tiers (Free/Pro/EDO) to 4 products matching master plan wireframe
- Pulse Charts (Free), Pulse EDO ($299/mo per muni), Pulse Realtor ($49/mo per seat), Pulse Learn (Free)
- EDO and Realtor show "Coming soon" with waitlist CTA
- Update FAQ to cover new product structure, remove Pro references

**1.3.9 — Update metadata and OG tags**
- Title: "Alberta Pulse — Alberta's Data Platform"
- Description: mention multi-product platform (charts, EDO tools, realtor intelligence, learning)
- Update OG image subtitle

**1.3.10 — Update footer links**
- Add `/charts` link and product section links
- Keep Terms, Privacy, Pricing, Sign in

**1.3.11 — Mobile responsiveness pass**
- Test at 375px, 428px, 768px, 1024px+
- Products grid must stack cleanly (no horizontal overflow)
- Verify HeroVisualization canvas is completely untouched
- Verify live ticker still scrolls horizontally on mobile

**Implementation notes:**
- `HeroVisualization` (`src/components/hero-viz.tsx`) must NOT be modified
- `LivePulseBar`, `PulseBarFallback`, and `getPulseData()` must NOT be modified
- Reuse `HubCard`/`HubGrid` from `src/components/hub-card.tsx` where appropriate
- The `dataSources` array, `regions` array, and `totalFeeds` remain as-is
- Run `npm run build` before and after

---

## Phase 2 — Pulse EDO ($299/mo)

**Goal**: A focused product for municipal Economic Development Officers. Automated community profiles, peer comparison, trend alerts, and council-ready reports. This is the first revenue product.

**Prerequisite**: Phase 1.0 (route restructure) must be complete. Phase 1.1-1.2 can run in parallel.

### Phase 2.0 — EDO Product Foundation

**2.0.1 — EDO route group and layout**
- Create `src/app/(edo)/edo/layout.tsx`
- EDO-specific nav: simpler than charts, focused on their municipality
- Nav items: My Municipality, Compare, Alerts, Reports, Profile Builder, Settings
- Top bar shows: municipality name, plan status, account

**2.0.2 — EDO subscription tier**
- Add "edo" plan to subscription model
- Update `src/lib/auth.ts` JWT to include plan type
- Update middleware: `/edo/*` requires `plan === 'edo'`
- Update billing page to show EDO plan option
- Stripe product/price for $299/mo

**2.0.3 — Municipality binding**
- EDO account is bound to one (or more) municipalities
- Add `municipality_id` to user/subscription model
- EDO onboarding flow: select your municipality after signup

### Phase 2.1 — Community Profile Generator

**2.1.1 — Profile data aggregator**
- New file: `src/lib/edo/profile-data.ts`
- Pulls all available data for a given municipality into a structured object
- Sources: regional dashboard indicators, StatCan, assessments, permits, business counts, WCB, demographics
- Returns: `CommunityProfile` type with sections (overview, economy, demographics, housing, labour, infrastructure)

**2.1.2 — Profile dashboard page**
- Route: `/edo/profile`
- Visual dashboard showing all key indicators for the EDO's municipality
- Organized by section: Overview, Economy, Demographics, Housing, Labour
- Each section: 3-5 key metrics with sparkline trends
- "Last updated" timestamps per data source

**2.1.3 — PDF export**
- "Export as PDF" button on profile page
- Generates branded one-pager or multi-page PDF
- Uses: municipality name, logo placeholder, all key metrics, charts, data citations
- Technology: React-PDF or server-side Puppeteer rendering

**2.1.4 — Printable community profile**
- Print-optimized CSS for the profile page
- Alternative to PDF for quick sharing

### Phase 2.2 — Peer Comparison

**2.2.1 — Comparison engine**
- New file: `src/lib/edo/compare.ts`
- Select 2-5 municipalities to compare across any available indicators
- Returns normalized data for side-by-side rendering

**2.2.2 — Comparison dashboard**
- Route: `/edo/compare`
- Municipality picker (search + region filter)
- Indicator picker (checkboxes by category)
- Side-by-side bar charts, tables, and sparklines
- Export comparison as PDF

### Phase 2.3 — Trend Alerts

**2.3.1 — Alert rule engine**
- New file: `src/lib/edo/alerts.ts`
- Define alert rules: metric + threshold + direction (e.g., "assessment base drops > 3% QoQ")
- Built-in default rules for common EDO concerns
- Custom rule builder for power users

**2.3.2 — Alert evaluation (cron or webhook)**
- Scheduled job that evaluates alert rules against latest data
- Stores triggered alerts in DB
- Sends email digest (weekly or on-trigger, configurable)

**2.3.3 — Alerts dashboard**
- Route: `/edo/alerts`
- List of triggered alerts with severity, metric, change amount, date
- Configure alert preferences
- Mute/acknowledge alerts

### Phase 2.4 — Council Reports

**2.4.1 — Report template system**
- New file: `src/lib/edo/reports.ts`
- Predefined report templates: Monthly Update, Quarterly Review, Annual Summary
- Template = ordered list of sections, each pulling specific data + charts

**2.4.2 — Report builder page**
- Route: `/edo/reports`
- Select template, date range, comparison peers
- Preview report in-browser
- Export as PDF or PowerPoint-compatible format

**2.4.3 — Report history**
- Save generated reports
- View past reports to track changes over time

### Phase 2.5 — Investment Pitch Kit

**2.5.1 — Pitch kit data assembler**
- Pulls: labour force, transportation access, land/assessment values, tax rates, utilities, growth trajectory, nearby amenities (Google Maps), top employers
- Formats into an investor-facing narrative

**2.5.2 — Pitch kit page**
- Route: `/edo/pitch`
- Visual pitch kit with sections an investor cares about
- Export as PDF
- Shareable link (public, time-limited)

---

## Phase 3 — Pulse Realtor ($49/mo)

**Goal**: A focused product for Alberta realtors. Market intel, prospect generation, neighbourhood analysis, and listing presentation tools.

**Prerequisite**: Phase 1.0 complete. Can begin during or after Phase 2.

### Phase 3.0 — Realtor Product Foundation

**3.0.1 — Realtor route group and layout**
- Create `src/app/(realtor)/realtor/layout.tsx`
- Realtor-specific nav: Market, Prospects, Neighbourhoods, Listings, Reports
- Simpler, action-oriented UI (realtors want answers fast)

**3.0.2 — Realtor subscription tier**
- Add "realtor" plan to subscription model
- Stripe product/price for $49/mo
- Update middleware for `/realtor/*` gating

### Phase 3.1 — Market Dashboard

**3.1.1 — Realtor market overview**
- Route: `/realtor/market`
- Municipality picker (where they operate)
- Key metrics: median price, days on market, inventory, price/sqft trends
- Comparison to provincial averages

### Phase 3.2 — Prospect Intelligence

**3.2.1 — Development permit tracker**
- Route: `/realtor/prospects`
- New development permits = new home buyers/sellers
- Filter by municipality, permit type, date range
- Alert on new permits in their target area

**3.2.2 — Neighbourhood deep-dives**
- Route: `/realtor/neighbourhoods`
- Assessment trends, demographics, school proximity, amenities
- "Neighbourhood snapshot" exportable for listing presentations

### Phase 3.3 — Listing Presentation Tools

**3.3.1 — Market report generator**
- Route: `/realtor/reports`
- Branded market report for a specific neighbourhood or municipality
- Charts, trends, comparables context
- Export as PDF for client meetings

---

## Phase 4 — Pulse Learn (Free)

**Goal**: A gamified educational experience that teaches Alberta economics end-to-end. Free, brand-building, drives awareness to paid products.

**Prerequisite**: None technically, but should be built after revenue products are live.

### Phase 4.0 — Learning Platform Foundation

**4.0.1 — Learn route group and layout**
- Create `src/app/(learn)/learn/layout.tsx`
- Course-style nav: modules on the left, progress bar at top
- Clean, distraction-free reading/quiz UI

**4.0.2 — Progress tracking**
- Track module completion per user (DB or localStorage for anonymous)
- Progress bar showing % complete
- Resume where you left off

### Phase 4.1 — Course Content

**4.1.1 — Course structure**
Migrate and expand existing Learn content into a structured curriculum:
- Module 1: Alberta 101 — Geography, population, regions
- Module 2: The Energy Engine — Oil, gas, pipelines, royalties
- Module 3: The Housing Machine — Real estate economics, assessments, zoning
- Module 4: Your Tax Dollars — Municipal/provincial/federal fiscal flows
- Module 5: People & Growth — Immigration, labour, demographics
- Module 6: Reading the Signals — How to interpret economic indicators
- Module 7: Community Levers — What municipalities can actually control
- Module 8: Safety & Prosperity — Crime, health, environment as economic factors

Each module: 3-5 lessons, each lesson: content + embedded live charts from Pulse Charts + quiz

**4.1.2 — Quiz system**
- Multiple choice and short-answer questions per lesson
- Immediate feedback with explanations
- Score tracking per module
- Must pass quiz (70%+) to advance

**4.1.3 — Certificate of completion**
- Generated PDF certificate: "Alberta Economic Literacy Certificate"
- Shareable on LinkedIn
- Issued when all 8 modules completed with passing quiz scores

---

## Phase 5+ — Future Products

Ideas to evaluate once Phases 1-3 are generating revenue:

- **Pulse Energy**: Deep energy sector dashboard for small operators, landmen, consultants ($149/mo)
- **Pulse Journalist**: Story-finding tools, data download, citation generator (free or $19/mo)
- **Pulse API**: Standalone data API product for developers ($49/mo, higher rate limits)
- **Pulse Investor**: Out-of-province capital looking at Alberta opportunities ($199/mo)
- **White-label municipal dashboards**: Hosted dashboard a municipality puts on their own website ($499/mo)

---

## Pricing Page Redesign

The pricing page should present the product suite clearly:

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  "Alberta data, purpose-built for how you work"         │
│                                                         │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │  Charts  │  │   EDO    │  │ Realtor  │  │  Learn  │ │
│  │   Free   │  │ $299/mo  │  │  $49/mo  │  │  Free   │ │
│  │          │  │per muni  │  │ per seat │  │         │ │
│  │ Browse & │  │Community │  │ Market   │  │ Alberta │ │
│  │ embed    │  │profiles, │  │intel,    │  │economics│ │
│  │ 200+     │  │peer comp,│  │prospects,│  │course + │ │
│  │ charts   │  │alerts,   │  │listings  │  │cert     │ │
│  │          │  │council   │  │reports   │  │         │ │
│  │          │  │reports   │  │          │  │         │ │
│  └─────────┘  └──────────┘  └──────────┘  └─────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Technical Notes for Agents

### Shared infrastructure (do not duplicate)
- Data source modules: `src/lib/data-sources-*.ts` — all products share these
- Chart components: `src/components/charts/` — reuse across products
- Auth: `src/lib/auth.ts` + `src/middleware.ts` — extend, don't replace
- Database: PostgreSQL (hosted on Railway) — extend schema as needed
- Embed system: `/embed/[chartId]` — already works, extend registry

### Key files to read before any phase
- `docs/MASTER_PLAN.md` — this file (you are here)
- `docs/nav-redesign-plan.md` — the navigation restructure details
- `src/components/nav-config.ts` — centralized nav data (single source of truth for all sections)
- `src/components/top-bar.tsx` — desktop top bar (7 section links + search + avatar menu)
- `src/components/section-sidebar.tsx` — contextual sidebar (shows sub-pages for active section)
- `src/components/mobile-tabs.tsx` — mobile bottom tab bar (5 tabs + "More" sheet)
- `src/components/nav.tsx` — nav orchestrator (command palette + mobile drawer)
- `src/components/app-shell.tsx` — layout wrapper (detects product context, applies nav)
- `src/middleware.ts` — route protection logic
- `src/lib/auth.ts` — auth configuration
- `src/lib/municipality-registry.ts` — municipality config

### Agent handoff protocol
Each phase and sub-phase is designed to be picked up by a fresh agent. When starting work:
1. Read this plan
2. Read the specific phase/sub-phase you're working on
3. Read the key files listed above
4. Check git log for recent changes
5. Run `npm run build` to verify clean state before and after your work
6. Update this plan with any decisions made or scope changes

### Branch strategy
- `main` — production (auto-deploys to Railway)
- Feature work: branch per phase (e.g., `phase-1.0-route-restructure`)
- Merge to main when phase is complete and builds clean

---

## Progress Log

### Phase 1.0 — Foundation & Route Restructure ✅ COMPLETE (2026-03-14)

**What was done:**
- Reorganized all routes into 7 top-level sections: Home, Economy, Real Estate, Community, Environment, Governance, Municipalities
- Intelligence section absorbed into Economy (under "Analysis" sub-header)
- Health + Safety merged into Community (under "People" and "Safety" sub-headers)
- Politics renamed to Governance
- Learn + Dashboard + Signals + Briefings moved under Home
- Built new two-tier navigation: top bar (desktop) + contextual sidebar + mobile bottom tabs
- Created `nav-config.ts` as single source of truth for all navigation data
- Updated middleware, sitemap, breadcrumbs, login, pricing, landing page
- Updated all internal links across ~60 page files
- Build compiles clean

**New route structure:**
- `/home/dashboard`, `/home/signals`, `/home/briefings/*`, `/home/learn/*`
- `/economy/*` (includes absorbed intelligence: benchmarks, corridors, risk, cycle-position, invest, compare)
- `/economy/boom-bust` (was `/economy/cycle`)
- `/real-estate/*` (unchanged)
- `/community/*` (demographics, immigration, labour, health, mortality, crime, fire-response, traffic, seismic, emergencies)
- `/environment/*` (unchanged)
- `/governance/*` (was `/politics/*`)
- `/municipalities/*` (unchanged)

**Next up:** ~~Phase 1.1 — Chart Catalogue~~ DONE

### Phase 1.1 — Chart Catalogue ✅ COMPLETE (2026-03-15)

**What was done:**
- Created `src/lib/chart-registry.ts` — metadata catalogue of 100+ charts with ID, title, description, category, subcategory, data source, update frequency, tags, and page href
- Created `src/lib/chart-resolver.ts` — extracted chart render logic from embed page into shared module (used by both `/embed/[chartId]` and `/charts/[chartId]`)
- Built `/charts` catalogue page — searchable, filterable grid of all charts. Filter by category, search by keyword. Cards show title, description, category badge, update frequency
- Built `/charts/[chartId]` individual chart pages — full-size chart with Suspense loading, metadata sidebar (source, frequency, category, tags), embed code panel, share buttons (copy link, X, LinkedIn), related charts section, "view in context" link
- All chart pages are public (no auth required) — added `/charts` and `/charts/` to middleware public routes
- SEO: structured data (Schema.org Dataset) on each chart page, OpenGraph images, meta descriptions, canonical URLs
- Sitemap: added `/charts` index + all individual chart pages to sitemap.ts
- Updated landing page with "Browse the Chart Catalogue" section — category cards with featured charts and CTA
- Added "Charts" link to top bar navigation (with BarChart3 icon, active state highlighting)
- Refactored embed page to use shared `chart-resolver.ts` (removed ~770 lines of duplicated code)
- Static generation with ISR (1 hour) for all chart pages via `generateStaticParams`
- Build compiles clean

**New routes:**
- `/charts` — searchable catalogue index
- `/charts/[chartId]` — 100+ individual chart pages (pre-rendered)

**Files created:**
- `src/lib/chart-registry.ts` — chart metadata registry
- `src/lib/chart-resolver.ts` — shared chart render logic
- `src/app/charts/page.tsx` — catalogue page
- `src/app/charts/catalogue-filter.tsx` — client-side search/filter component
- `src/app/charts/[chartId]/page.tsx` — individual chart page
- `src/app/charts/[chartId]/chart-actions.tsx` — embed/share actions (client component)

**Files modified:**
- `src/app/embed/[chartId]/page.tsx` — refactored to use shared resolver
- `src/middleware.ts` — added /charts to public routes
- `src/app/sitemap.ts` — added chart entries
- `src/app/page.tsx` — added catalogue section to landing page
- `src/components/top-bar.tsx` — added Charts nav link

**Next up:** ~~Phase 1.2 — Enhanced Hub Pages~~ DONE

### Phase 1.2 — Enhanced Hub Pages ✅ COMPLETE (2026-03-15)

**What was done:**
- Created reusable `HubCard` and `HubGrid` components (`src/components/hub-card.tsx`) for compact, mobile-first navigation card grids
- Enhanced all 6 section overview pages with headline metrics + responsive card grids:
  - `/economy` — 4 metrics (BoC rate, CAD/USD, unemployment, GDP), 3 sub-sections (Industries, Analysis, Related) in card grids
  - `/real-estate` — 4 metrics (Edmonton/Calgary housing starts + vacancy rates), 7 page cards in grid
  - `/community` — 4 metrics (population, unemployment, immigration, regions), 2 sub-sections (People, Safety) in grids
  - `/environment` — 3 metrics (active wildfires, area burned, 511 alerts), 5 page cards in grid
  - `/governance` — Already had metrics (MLAs, MPs, seat charts), converted page cards to grid layout
- Created new `/home` hub page with quick metrics (policy rate, unemployment, CPI), core tools (Dashboard, Signals, Briefings), Learn section, and section navigation cards
- All overview pages now use `Suspense` with loading skeletons for async metric fetching
- Updated nav-config: Home section now points to `/home` hub page, added "Hub" link to sidebar
- Card descriptions shortened for grid format while keeping full context in explainer cards
- Mobile-first: 1 column on small screens, 2 on tablet, 3 on desktop
- Build compiles clean

**New files:**
- `src/components/hub-card.tsx` — HubCard + HubGrid reusable components
- `src/app/home/page.tsx` — Home hub page

**Modified files:**
- `src/app/economy/page.tsx` — Added metrics, converted to card grid with sub-sections
- `src/app/real-estate/page.tsx` — Added metrics, converted to card grid
- `src/app/community/page.tsx` — Added metrics, converted to card grid with sub-sections
- `src/app/environment/page.tsx` — Added metrics, converted to card grid
- `src/app/governance/page.tsx` — Converted page cards to grid layout
- `src/components/nav-config.ts` — Updated Home href, added Hub sidebar link

**Next up:** ~~Phase 2.0 — EDO Product Foundation~~ DONE

### Phase 2.0 — EDO Product Foundation ✅ COMPLETE (2026-03-15)

**What was done:**
- Created EDO route group `src/app/(edo)/edo/` with dedicated layout, nav, and 7 pages
- EDO-specific navigation: sidebar (desktop) + bottom tabs (mobile) + top bar with municipality name and plan badge
- Indigo accent color for EDO product (distinct from charts blue)
- Added `plan` and `municipality_id` to JWT/session (auth.ts type augmentation)
- DB schema: added `municipality_id TEXT` column to subscriptions table
- Middleware: `/edo/*` routes require `plan === 'edo'` + active subscription (admins bypass)
- Middleware redirects EDO users without municipality binding to `/edo/onboarding`
- Stripe: `createCheckoutSession()` now accepts plan parameter, uses `STRIPE_EDO_PRICE_ID` for EDO
- Webhook handler persists plan type from checkout metadata
- EDO onboarding page: searchable municipality picker (30 municipalities), binds selection to subscription
- API route `/api/edo` for municipality binding
- Billing page: shows EDO plan details for EDO users, upsell card for non-EDO users
- Pricing page: expanded to 3-column layout (Free / Pro / EDO) with EDO features list
- AppShell: EDO routes bypass charts nav (EDO has its own layout)
- Build compiles clean

**New routes:**
- `/edo` — EDO dashboard (municipality overview + quick actions)
- `/edo/onboarding` — municipality selection flow
- `/edo/compare` — peer comparison (Phase 2.2 placeholder)
- `/edo/alerts` — trend alerts (Phase 2.3 placeholder)
- `/edo/reports` — council reports (Phase 2.4 placeholder)
- `/edo/profile-builder` — community profile generator (Phase 2.1 placeholder)
- `/edo/settings` — municipality binding + account settings
- `/api/edo` — municipality binding API

**Files created:**
- `src/app/(edo)/edo/layout.tsx` — EDO layout with sidebar, top bar, mobile nav
- `src/app/(edo)/edo/page.tsx` — EDO dashboard
- `src/app/(edo)/edo/onboarding/page.tsx` — municipality selection
- `src/app/(edo)/edo/compare/page.tsx` — peer comparison placeholder
- `src/app/(edo)/edo/alerts/page.tsx` — alerts placeholder
- `src/app/(edo)/edo/reports/page.tsx` — reports placeholder
- `src/app/(edo)/edo/profile-builder/page.tsx` — profile builder placeholder
- `src/app/(edo)/edo/settings/page.tsx` — EDO settings
- `src/app/api/edo/route.ts` — municipality binding API

**Files modified:**
- `src/lib/db.ts` — added `municipality_id` column + indexes
- `src/lib/auth.ts` — JWT/session includes `plan` and `municipalityId`
- `src/lib/stripe.ts` — plan-aware checkout, EDO price ID, plan in webhook metadata
- `src/middleware.ts` — EDO route gating with municipality binding redirect
- `src/app/api/billing/route.ts` — passes plan to checkout
- `src/app/billing/page.tsx` — EDO plan display + upsell card
- `src/app/pricing/page.tsx` — 3-column layout with EDO plan
- `src/components/app-shell.tsx` — EDO routes bypass charts nav

**Env vars needed:**
- `STRIPE_EDO_PRICE_ID` — Stripe price ID for EDO $299/mo subscription

**Next up:** ~~Phase 1.3 — Landing Page Platform Repositioning~~ DONE

### Phase 1.3 — Landing Page Platform Repositioning ✅ COMPLETE (2026-03-15)

**What was done:**
- 1.3.1: Rewrote hero section — platform-oriented headline ("Alberta's data platform / Charts. Intelligence. Reports."), new CTAs (Browse free charts → /charts, See products → #products, Sign in text link), removed trial language
- 1.3.2: Built products showcase section with id="products" — 4-card responsive grid (1→2→4 cols): Pulse Charts (free, available now), Pulse EDO ($299/mo, coming soon), Pulse Realtor ($49/mo, coming soon), Pulse Learn (free, coming soon)
- 1.3.3: Updated scale stats bar — replaced "54 Regional indicators" with dynamic chart count from CHART_REGISTRY.length
- 1.3.4: Branded chart catalogue section with "Pulse Charts" product badge and "Free forever. No account required." tagline
- 1.3.5: Replaced 8 role-based briefing cards with 4 product-audience mapping cards (EDO, Realtor, Charts, Learn) in 2-column grid
- 1.3.6: Reframed "The full picture" as "One data foundation, four products" — added product badges (Charts/EDO/Realtor/Learn) to all 10 capability cards
- 1.3.7: Rewrote bottom CTA — "Start with free charts. Upgrade when you're ready." with chart catalogue + pricing CTAs
- 1.3.8: Restructured pricing page from 3 tiers (Free/Pro/EDO) to 4 products (Charts free, EDO $299/mo, Realtor $49/mo, Learn free). Killed "Pro" tier. EDO and Realtor show "Coming soon" with waitlist CTA. Updated FAQ
- 1.3.9: Updated metadata — title to "Alberta Pulse — Alberta's Data Platform", new OG tags
- 1.3.10: Added /charts link to footer
- 1.3.11: All new sections use responsive grid classes (grid-cols-1 sm:grid-cols-2 lg:grid-cols-4), flex-col sm:flex-row for CTA buttons, works at 375px+

**Files modified:**
- `src/app/page.tsx` — hero, stats, products showcase, chart catalogue branding, product-audience cards, capabilities with badges, bottom CTA, footer, metadata
- `src/app/pricing/page.tsx` — complete rewrite to 4-product model

**Note:** Build has pre-existing Turbopack chunk-loading race conditions (recharts SSR, buildManifest.js.tmp ENOENT). Compilation succeeds, TypeScript checks pass, errors are in unmodified pages during static export phase.

**Next up:** ~~Phase 2.1 — Community Profile Generator~~ DONE

### Phase 2.1 — Community Profile Generator ✅ COMPLETE (2026-03-15)

**What was done:**
- 2.1.1: Created `src/lib/edo/profile-data.ts` — profile data aggregator that pulls 26 regional indicators + ArcGIS data into a typed `CommunityProfile` object with 6 sections (overview, economy, demographics, housing, labour, infrastructure). Each metric includes latest value, formatted string, change %, and 10-point trend series. Also exports `fetchHeadlineMetrics()` for lightweight dashboard use.
- 2.1.2: Replaced placeholder at `/edo/profile-builder` with full visual dashboard — headline metrics row (population, assessment base, permits, businesses) with sparkline trends, 6 section cards with metric grids, Suspense loading skeletons, data source citations with timestamps.
- 2.1.3: Built PDF export via `@react-pdf/renderer` — server-side API route at `/api/edo/profile-pdf` generates branded LETTER-size PDF with headline metrics, all sections, color-coded change indicators, and footer with data citations. Client-side ExportButton triggers download. Auth-gated to EDO subscribers for their bound municipality.
- 2.1.4: Wired EDO dashboard (`/edo`) with real data — replaced placeholder metrics with live `fetchHeadlineMetrics()` call using Suspense boundaries. Shows population, assessment base, building permits, business count with sparkline trends and period-over-period change.
- Print button added for quick browser printing.

**New files:**
- `src/lib/edo/profile-data.ts` — profile data aggregator + headline metrics
- `src/app/(edo)/edo/profile-builder/profile-section.tsx` — client components: Sparkline, MetricCard, ProfileSectionCard, HeadlineMetrics
- `src/app/(edo)/edo/profile-builder/export-button.tsx` — PDF download trigger
- `src/app/(edo)/edo/profile-builder/print-button.tsx` — browser print trigger
- `src/app/api/edo/profile-pdf/route.tsx` — server-side PDF generation

**Files modified:**
- `src/app/(edo)/edo/profile-builder/page.tsx` — full rewrite from placeholder to live dashboard
- `src/app/(edo)/edo/page.tsx` — replaced placeholder metrics with live data via Suspense
- `package.json` — added `@react-pdf/renderer`

**Next up:** ~~Phase 2.2 — Peer Comparison~~ DONE

### Phase 2.2 — Peer Comparison ✅ COMPLETE (2026-03-15)

**What was done:**
- 2.2.1: Created `src/lib/edo/compare.ts` (server-side engine) + `src/lib/edo/compare-shared.ts` (client-safe types/constants). Comparison engine fetches any combination of 2–5 municipalities across 26 curated indicators organized in 6 categories (overview, economy, demographics, housing, labour, infrastructure). Reuses `fetchRegionalTimeSeries()` — no duplicated fetch logic. Parallel fetching of all municipality × indicator combinations.
- 2.2.2: Replaced placeholder at `/edo/compare` with full interactive dashboard:
  - **Municipality picker**: searchable, grouped by region (7 regions), collapsible sections, color-coded selection dots, user's bound municipality pinned and pre-selected, max 5 selection enforced
  - **Indicator picker**: 26 indicators in 6 categories with checkboxes, collapsible category sections, selection count badges, "reset to defaults" button
  - **Charts view**: side-by-side bar charts (Recharts) for each selected indicator with change indicators, plus overlay trend charts showing historical time series for all selected municipalities
  - **Table view**: responsive comparison table with sticky indicator column, color-coded municipality headers, formatted values with change percentages
  - **View toggle**: switch between Charts and Table views
  - **PDF export**: branded LETTER-size PDF via `@react-pdf/renderer` at `/api/edo/compare-pdf` — shows municipality legend, tables grouped by category with formatted values and color-coded change indicators
- Split shared types/constants into `compare-shared.ts` to avoid server-only imports (pg/tls) leaking into client bundle
- Build compiles clean

**New files:**
- `src/lib/edo/compare.ts` — server-side comparison engine + fetcher
- `src/lib/edo/compare-shared.ts` — client-safe types, constants, formatters (26 indicators, 6 categories)
- `src/app/(edo)/edo/compare/compare-client.tsx` — full client-side comparison UI (pickers, charts, table, export)
- `src/app/api/edo/compare/route.ts` — comparison data API (auth-gated)
- `src/app/api/edo/compare-pdf/route.tsx` — comparison PDF export (auth-gated)

**Files modified:**
- `src/app/(edo)/edo/compare/page.tsx` — replaced placeholder with server component that passes municipality data to CompareClient

**New API routes:**
- `/api/edo/compare?m=slug1&m=slug2&i=indicator1&i=indicator2` — returns comparison JSON
- `/api/edo/compare-pdf?m=slug1&m=slug2&i=indicator1&i=indicator2` — returns branded PDF

**Next up:** ~~Phase 2.3 — Trend Alerts~~ DONE

### Phase 2.3 — Trend Alerts ✅ COMPLETE (2026-03-15)

**What was done:**
- 2.3.1: Created `src/lib/edo/alerts.ts` (server-side engine) + `src/lib/edo/alerts-shared.ts` (client-safe types/constants). Alert rule engine defines 16 default rules across 5 categories (overview, economy, demographics, housing, labour) covering common EDO concerns: population decline, assessment base drops, unemployment spikes, permit slowdowns, crime increases, etc. Each rule: metric + threshold % + direction (up/down/either) + base severity. Severity auto-escalates (info→warning→critical) if change exceeds 2x or 3x threshold. Reuses `fetchRegionalTimeSeries()` — no duplicated fetch logic. All rules evaluated in parallel.
- 2.3.2: Created `/api/edo/alerts` route — auth-gated, evaluates all active rules for a municipality and returns triggered alerts sorted by severity (critical first). Accepts disabled rule IDs and custom rules via query params. Each alert includes: severity, indicator name, change %, direction, period, human-readable description, and 10-point sparkline trend.
- 2.3.3: Replaced placeholder at `/edo/alerts` with full interactive dashboard:
  - **Alert cards**: severity badge (color-coded red/amber/blue), indicator name, change description, direction icon, percentage change, sparkline trend, period range
  - **Summary bar**: counts of critical/warning/info alerts, or "All clear" when none triggered
  - **Configuration panel** (collapsible): toggle default rules on/off by category, add custom threshold rules (pick indicator, threshold %, direction, severity, category), remove custom rules
  - **Preferences**: stored in localStorage (disabled rule IDs + custom rules), persisted across sessions
  - **Refresh**: manual re-evaluation button
  - **Empty state**: encouraging "all clear" message with link to adjust thresholds
- Split shared types/constants into `alerts-shared.ts` (follows `compare-shared.ts` pattern to avoid pg/tls client bundle issues)
- Build compiles clean

**New files:**
- `src/lib/edo/alerts.ts` — server-side alert evaluation engine
- `src/lib/edo/alerts-shared.ts` — client-safe types, constants, 16 default rules, severity config, formatters
- `src/app/(edo)/edo/alerts/alerts-client.tsx` — full client-side alerts dashboard (cards, config panel, custom rule builder)
- `src/app/api/edo/alerts/route.ts` — alert evaluation API (auth-gated)

**Files modified:**
- `src/app/(edo)/edo/alerts/page.tsx` — replaced placeholder with server component that passes municipality slug to AlertsClient

**New API route:**
- `/api/edo/alerts?m=slug&disabled=ruleId&custom=[json]` — returns triggered alerts JSON

**Default alert rules (16):**
- Overview: Population Decline (>1%), Assessment Base Drop (>3%), Crime Severity Spike (>10%)
- Economy: Median Income Decline (>3%), Bankruptcies Surge (>15%), New Business Surge (>10%), Tax Rate Increase (>5%)
- Demographics: Net Migration Decline (>20%), Immigration Surge (>15%)
- Housing: Permit Slowdown (>15%), Housing Starts Decline (>15%), Vacancy Rate Spike (>20%), Home Price Surge (>10%)
- Labour: Unemployment Spike (>15%), Labour Force Decline (>3%), EI Claims Surge (>15%)

**Next up:** ~~Phase 2.4 — Council Reports~~ DONE

### Phase 2.4 — Council Reports ✅ COMPLETE (2026-03-15)

**What was done:**
- 2.4.1: Created `src/lib/edo/reports.ts` (server-side engine) + `src/lib/edo/reports-shared.ts` (client-safe types/constants/templates). Report generation engine assembles data from three existing modules: `buildCommunityProfile()` for profile sections, `fetchComparison()` for peer comparison, `evaluateAlerts()` for trend alerts. No duplicated fetch logic. Three predefined templates:
  - **Monthly Update** (6 sections): headline metrics, economy, housing, alerts, peer comparison (4 indicators), citations
  - **Quarterly Review** (8 sections): headline, overview, economy, housing, labour, alerts, peer comparison (8 indicators), citations
  - **Annual Summary** (10 sections): headline, all 6 profile sections, alerts, peer comparison (12 indicators), citations
- 2.4.2: Replaced placeholder at `/edo/reports` with full interactive report builder:
  - **Template picker**: 3 template cards with description, section count, section preview tags
  - **Report builder**: 3-column layout — left side: date range picker (month/quarter/year options), peer municipality picker (searchable, region-grouped, max peers per template); right side: numbered section preview, config summary, generate button
  - **Report preview**: full in-browser rendering of all sections — headline metrics with sparklines, profile sections with metric cards, peer comparison table (color-coded municipalities, formatted values, change indicators), alerts summary (severity-colored badges), data citations
  - **PDF export**: "Export PDF" button triggers server-side `@react-pdf/renderer` generation via `/api/edo/reports-pdf` — branded LETTER-size PDF with all sections, color-coded comparison table, severity badges, data citations, Alberta Pulse footer
- 2.4.3: Report history stored in localStorage:
  - "Recent Reports" section on template picker view showing saved reports with template name, municipality, date range, generation timestamp
  - Click to re-view cached report data (no re-fetch needed)
  - Delete individual reports
  - Max 20 reports stored, oldest trimmed automatically
- Split shared types/constants into `reports-shared.ts` (follows `compare-shared.ts` / `alerts-shared.ts` pattern to avoid pg/tls client bundle issues)
- Build compiles clean

**New files:**
- `src/lib/edo/reports.ts` — server-side report generation engine
- `src/lib/edo/reports-shared.ts` — client-safe types, constants, 3 templates, date range helpers, localStorage helpers
- `src/app/(edo)/edo/reports/reports-client.tsx` — full client-side report builder (template picker, config, preview, history)
- `src/app/api/edo/reports/route.ts` — report data API (auth-gated)
- `src/app/api/edo/reports-pdf/route.tsx` — report PDF export (auth-gated)

**Files modified:**
- `src/app/(edo)/edo/reports/page.tsx` — replaced placeholder with server component that passes municipality data to ReportsClient

**New API routes:**
- `/api/edo/reports?template=monthly&m=slug&peer=slug2&sm=3&sy=2026&em=3&ey=2026&label=March%202026` — returns generated report JSON
- `/api/edo/reports-pdf?template=monthly&m=slug&peer=slug2&...` — returns branded PDF

**Next up:** ~~Phase 2.5 — Investment Pitch Kit~~ DONE

### Phase 2.5 — Investment Pitch Kit ✅ COMPLETE (2026-03-15)

**What was done:**
- 2.5.1: Created `src/lib/edo/pitch.ts` (server-side engine) + `src/lib/edo/pitch-shared.ts` (client-safe types/constants). Pitch kit data assembler pulls investor-facing data from three existing modules in parallel: `buildCommunityProfile()` for core municipality metrics across 6 profile sections, `fetchComparison()` for peer benchmarking across 10 key indicators, Google Maps `searchNearbyPlaces()` for 10 amenity categories within 10 km radius. Auto-generates narrative text for each section from the data. Returns structured `PitchKit` type with 7 sections: overview, workforce, real estate, infrastructure, growth, competitive position, amenities. No duplicated fetch logic.
- 2.5.2: Created `/edo/pitch` with full interactive pitch kit builder:
  - **Config view**: peer municipality picker (searchable, region-grouped, max 4 peers for benchmarking), numbered section preview showing all 7 pitch sections with icons and descriptions, summary panel, generate button
  - **Preview view**: full in-browser rendering of all 7 investor-facing sections:
    - **Community Overview**: population, median income, assessment base, business count, crime severity with sparkline trends and auto-generated narrative
    - **Workforce & Talent**: labour force, unemployment rate, avg weekly earnings, K-9 and high school enrolment with narrative on education pipeline
    - **Real Estate & Land**: assessment base, avg sale price, housing starts, vacancy rate, avg rent, municipal tax rate, residential assessment share
    - **Infrastructure & Connectivity**: parcels tracked, business categories, zoning districts, dwelling units
    - **Growth Story**: population trend, building permits, incorporations, net migration, permanent residents with trend charts
    - **Competitive Position**: benchmarking table vs peer averages across 10 indicators (population, income, unemployment, assessment base, permits, starts, sale price, vacancy, labour force, tax rate). Green highlighting when municipality outperforms peers.
    - **Nearby Amenities**: 10 categories (restaurants, schools, hospitals, pharmacies, supermarkets, gas stations, banks, gyms, parks, libraries) with counts and top-rated places
  - **PDF export**: branded LETTER-size PDF via `@react-pdf/renderer` at `/api/edo/pitch-pdf` — all sections with metrics, narrative text, benchmarking table, amenity counts, data citations, Alberta Pulse footer
  - **Pitch kit history**: localStorage-based (max 10), view cached data, delete individual entries
  - **Data citations section**: lists all data sources (regionaldashboard, Google Maps, ArcGIS, StatsCan)
- Added "Pitch Kit" nav item to EDO sidebar and mobile nav (Presentation icon, between Reports and Profile Builder)
- Split shared types/constants into `pitch-shared.ts` (follows established pattern to avoid pg/tls client bundle issues)
- Build compiles clean

**New files:**
- `src/lib/edo/pitch.ts` — server-side pitch kit data assembler + narrative generators
- `src/lib/edo/pitch-shared.ts` — client-safe types, constants, section definitions, localStorage helpers
- `src/app/(edo)/edo/pitch/page.tsx` — server component wrapper
- `src/app/(edo)/edo/pitch/pitch-client.tsx` — full client-side pitch kit UI (config, preview, history, all 7 section renderers)
- `src/app/api/edo/pitch/route.ts` — pitch data API (auth-gated)
- `src/app/api/edo/pitch-pdf/route.tsx` — pitch PDF export (auth-gated)

**Files modified:**
- `src/app/(edo)/edo/layout.tsx` — added Pitch Kit nav item with Presentation icon

**New API routes:**
- `/api/edo/pitch?m=slug&peer=slug2&peer=slug3` — returns pitch kit JSON
- `/api/edo/pitch-pdf?m=slug&peer=slug2&peer=slug3` — returns branded PDF

**Next up:** ~~Phase 3.0 — Realtor Product Foundation~~ DONE

### Phase 3.0 — Realtor Product Foundation ✅ COMPLETE (2026-03-15)

**What was done:**
- 3.0.1: Created Realtor route group `src/app/(realtor)/realtor/` with dedicated layout, nav, and 7 pages
- Realtor-specific navigation: sidebar (desktop) + bottom tabs (mobile) + top bar with operating area and plan badge
- Teal accent color for Realtor product (distinct from EDO indigo and Charts blue)
- Nav items: Market, Prospects, Neighbourhoods, Listings, Reports, Settings
- 3.0.2: Added `realtor` plan support to auth/middleware/stripe:
  - JWT/session includes `operatingArea` (string array of municipality slugs)
  - DB schema: added `operating_area TEXT` column to subscriptions table (JSON array)
  - Middleware: `/realtor/*` routes require `plan === 'realtor'` + active subscription (admins bypass)
  - Middleware redirects realtor users without operating area to `/realtor/onboarding`
  - Stripe: `STRIPE_REALTOR_PRICE_ID` support, plan-aware checkout redirects to realtor onboarding
  - Webhook handler persists realtor plan type from checkout metadata
- 3.0.3: Operating area binding (multi-select, unlike EDO single-select):
  - Realtor onboarding page: searchable municipality picker with checkboxes (30 municipalities), multi-select
  - API route `/api/realtor` for operating area binding (validates all slugs, stores as JSON)
  - Settings page shows selected municipalities with change link
- 3.0.4: Updated pricing and billing pages:
  - Pricing page: Realtor changed from "Coming soon" to active with teal accent and sign-up CTA
  - Billing page: shows Realtor plan details ($49/mo per seat) for realtor users
  - Billing page: Realtor upsell card for non-realtor users (teal accent)
  - Billing page: "Go to Realtor Dashboard" button for active realtor subscribers
- AppShell: Realtor routes bypass charts nav (Realtor has its own layout)
- Updated FAQ on pricing page re: Realtor launch status
- Build compiles clean

**New routes:**
- `/realtor/market` — market intelligence dashboard (placeholder)
- `/realtor/prospects` — prospect tracker (placeholder)
- `/realtor/neighbourhoods` — neighbourhood deep dives (placeholder)
- `/realtor/listings` — listing presentation tools (placeholder)
- `/realtor/reports` — client report generator (placeholder)
- `/realtor/settings` — operating area + account settings
- `/realtor/onboarding` — multi-select municipality area picker
- `/api/realtor` — operating area binding API

**Files created:**
- `src/app/(realtor)/realtor/layout.tsx` — Realtor layout with sidebar, top bar, mobile nav (teal accent)
- `src/app/(realtor)/realtor/market/page.tsx` — market intelligence placeholder
- `src/app/(realtor)/realtor/prospects/page.tsx` — prospect tracker placeholder
- `src/app/(realtor)/realtor/neighbourhoods/page.tsx` — neighbourhood deep dives placeholder
- `src/app/(realtor)/realtor/listings/page.tsx` — listing tools placeholder
- `src/app/(realtor)/realtor/reports/page.tsx` — report generator placeholder
- `src/app/(realtor)/realtor/settings/page.tsx` — Realtor settings
- `src/app/(realtor)/realtor/onboarding/page.tsx` — operating area selection (multi-select)
- `src/app/api/realtor/route.ts` — operating area binding API

**Files modified:**
- `src/lib/db.ts` — added `operating_area` column to subscriptions
- `src/lib/auth.ts` — JWT/session includes `operatingArea` (string array), type augmentation updated
- `src/lib/stripe.ts` — realtor price ID support, plan-aware success URL
- `src/middleware.ts` — Realtor route gating with operating area binding redirect
- `src/app/billing/page.tsx` — Realtor plan display + upsell card + dashboard link
- `src/app/pricing/page.tsx` — Realtor active with teal accent and CTA (was "Coming soon")
- `src/components/app-shell.tsx` — Realtor routes bypass charts nav

**Env vars needed:**
- `STRIPE_REALTOR_PRICE_ID` — Stripe price ID for Realtor $49/mo subscription

**Next up:** ~~Phase 3.1 — Market Intelligence~~ DONE

### Phase 3.1 — Market Intelligence Dashboard ✅ COMPLETE (2026-03-15)

**What was done:**
- 3.1.1: Created `src/lib/realtor/market-data.ts` — multi-municipality market data aggregator. Pulls from 4 existing data source modules (regional dashboard, CMHC, UAlberta, ArcGIS/Socrata permits). Returns typed `RealtorMarketSnapshot` with: 6 headline metrics (avg sale price, building permits, vacancy rate, housing starts, population, median income), per-municipality breakdown, permit activity from ArcGIS/Socrata, CMHC rental market (vacancy rates + rents by unit type for Edmonton/Calgary), UAlberta assessment trends. Aggregation: averages prices/rates across operating area, sums permits/starts/population.
- 3.1.2: Replaced placeholder at `/realtor/market` with full live dashboard:
  - **Headline metrics row**: 6 cards (avg sale price, building permits, vacancy rate, housing starts, population, median income) each with sparkline trend, period-over-period change indicator, and latest period label
  - **Per-municipality breakdown table**: side-by-side comparison of all municipalities in operating area (avg sale price, permits, starts, assessment base) — only shown when 2+ municipalities selected
  - **Permit activity section**: ArcGIS/Socrata permit summaries grouped by type with counts and dollar values
  - **Rental market section**: CMHC vacancy rate chart (Edmonton vs Calgary area chart) and average rents bar chart (bachelor/1-bed/2-bed/3-bed)
  - **Assessment trends**: UAlberta neighbourhood assessment trend chart (Edmonton vs Calgary)
  - Suspense boundaries with loading skeletons matching EDO pattern
  - Server component page → client component (`MarketDashboard`) for Recharts interactivity
  - Teal accent color throughout
  - Data source citations in footer
- 3.1.3: Created `/api/realtor/market?areas=slug1,slug2` API route — auth-gated to realtor subscribers (admins bypass). Validates area slugs against municipality registry. Returns full `RealtorMarketSnapshot` JSON.

**New files:**
- `src/lib/realtor/market-data.ts` — market data aggregator (types + `buildMarketSnapshot()`)
- `src/app/(realtor)/realtor/market/market-client.tsx` — client components: HeadlineCard, Sparkline, MunicipalityBreakdown, PermitActivity, RentalMarket, AssessmentTrends, MarketDashboard
- `src/app/api/realtor/market/route.ts` — market data API (auth-gated)

**Files modified:**
- `src/app/(realtor)/realtor/market/page.tsx` — replaced placeholder with server component using Suspense + auth + data fetching

**New API routes:**
- `/api/realtor/market?areas=slug1,slug2` — returns market snapshot JSON

**Data sources used (all pre-existing, no new integrations):**
- regionaldashboard.alberta.ca: avg sale price, building permits, housing starts, vacancy rates, population, median income, assessment base
- StatsCan via CMHC: vacancy rates, average rents by unit type (Edmonton + Calgary CMAs)
- UAlberta Open Data: neighbourhood assessment trends (Edmonton + Calgary)
- Municipal ArcGIS/Socrata: development permits, building permits (for municipalities with endpoints)

**Next up:** Phase 3.2 — Prospect Intelligence (development permit tracker)

### Session 19 — Phase 3.2: Prospect Intelligence & Neighbourhood Deep Dives (2026-03-15)

**Phase 3.2 COMPLETE** — Prospect tracking and neighbourhood analysis for Pulse Realtor.

- 3.2.1: Created `src/lib/realtor/prospect-data.ts` — prospect data aggregator (`buildProspectSnapshot()`). Pulls from existing data sources (no new API integrations):
  - Recent individual permits from ArcGIS/Socrata (via new `fetchRecentPermits()` in `municipality-data.ts`)
  - Permit volume trends from regional dashboard ("Building Permits" indicator)
  - Permit breakdown by type per municipality (via existing `fetchPermitsByGroup()`)
  - Construction projects from municipalities with construction endpoints (via existing `fetchConstructionProjects()`)
  - Assessment base trends from regional dashboard per municipality
  - Housing starts trends from regional dashboard
  - Hot zones: composite activity score ranking municipalities by permit count, construction projects, and assessment changes
  - All scoped to user's `operatingArea` (string[] of municipality slugs)

- 3.2.2: Built prospects dashboard at `/realtor/prospects` with live data:
  - **Hot zones**: municipalities ranked by composite activity score (permits + construction + assessment growth)
  - **Permit volume chart**: aggregated building permit trend across operating area (area chart)
  - **Recent permits feed**: scrollable list of individual development permits with type, address, date, value, municipality
  - **Permits by type**: horizontal bar chart showing top permit types across all municipalities
  - **Housing starts chart**: aggregated housing starts trend (area chart, amber color)
  - **Construction activity**: active construction projects per municipality with phase/location
  - **Assessment base table**: per-municipality assessment base with YoY change indicators
  - Server component page → client component (`ProspectsDashboard`), Suspense with skeletons, teal accent

- 3.2.3: Created `/api/realtor/prospects?areas=slug1,slug2` API route — auth-gated to realtor subscribers (admins bypass). Validates area slugs against municipality registry. Returns full `ProspectSnapshot` JSON.

- 3.2.4: Built neighbourhood deep-dives at `/realtor/neighbourhoods` with live data:
  - Created `src/lib/realtor/neighbourhood-data.ts` — neighbourhood data aggregator (`buildNeighbourhoodSnapshot()`)
  - **Edmonton & Calgary**: UAlberta neighbourhood assessment data with year-over-year changes, property counts, lot sizes, avg year built. Card grid showing top 30 neighbourhoods ranked by average assessment.
  - **Other municipalities**: assessment-by-zoning breakdown from ArcGIS with horizontal bar chart + table showing zone, property count, avg assessment, min-max range. Falls back to neighbourhood grouping when available.
  - **Municipality selector**: dropdown to switch between municipalities in operating area
  - Server component page → client component (`NeighbourhoodsDashboard`), Suspense with skeletons, teal accent

**New files:**
- `src/lib/realtor/prospect-data.ts` — prospect data aggregator (types + `buildProspectSnapshot()`)
- `src/lib/realtor/neighbourhood-data.ts` — neighbourhood data aggregator (types + `buildNeighbourhoodSnapshot()`)
- `src/app/(realtor)/realtor/prospects/prospects-client.tsx` — client components: RecentPermitsFeed, PermitVolumeChart, HousingStartsChart, ConstructionActivity, HotZones, AssessmentTrendsTable, PermitBreakdown, ProspectsDashboard
- `src/app/(realtor)/realtor/neighbourhoods/neighbourhoods-client.tsx` — client components: MunicipalitySelector, NeighbourhoodCards, ZoningBreakdown, NeighbourhoodsDashboard
- `src/app/api/realtor/prospects/route.ts` — prospect data API (auth-gated)

**Files modified:**
- `src/lib/municipality-data.ts` — added `RecentPermit` type and `fetchRecentPermits()` function for individual permit records
- `src/app/(realtor)/realtor/prospects/page.tsx` — replaced placeholder with server component using Suspense + auth + data fetching
- `src/app/(realtor)/realtor/neighbourhoods/page.tsx` — replaced placeholder with server component using Suspense + auth + data fetching

**New API routes:**
- `/api/realtor/prospects?areas=slug1,slug2` — returns prospect snapshot JSON

**Data sources used (all pre-existing, no new integrations):**
- Municipal ArcGIS/Socrata: development permits (individual records + grouped summaries), construction projects, assessment-by-zoning
- regionaldashboard.alberta.ca: building permits, assessment base, housing starts
- UAlberta Open Data: neighbourhood-level assessments (Edmonton 2015-2023, Calgary 2023)

**Next up:** ~~Phase 3.3 — Listing Presentation Tools~~ DONE

### Phase 3.3 — Listing Presentation Tools ✅ COMPLETE (2026-03-15)

**Phase 3.3 COMPLETE** — Report generation and listing intelligence for Pulse Realtor.

- 3.3.1: Created `src/lib/realtor/report-data.ts` — single-municipality report data aggregator (`buildReportSnapshot()`). Pulls from existing data sources (no new API integrations):
  - Regional dashboard: avg sale price, building permits, housing starts, vacancy rate, assessment base, population (with trend + change)
  - ArcGIS/Socrata: permit activity summary (top 10 permit types)
  - UAlberta: neighbourhood assessments with YoY changes (Edmonton/Calgary), zoning breakdown (other municipalities)
  - CMHC: vacancy rates and average rents by unit type (Edmonton/Calgary)
  - Returns typed `ReportSnapshot` scoped to a single municipality slug

- 3.3.2: Replaced placeholder at `/realtor/reports` with full live dashboard:
  - **Municipality selector**: dropdown within operating area
  - **Neighbourhood selector**: pick specific neighbourhood for Edmonton/Calgary (or view top 20)
  - **Headline metrics**: 6 cards (avg sale price, permits, starts, vacancy rate, assessment base, population) with sparklines and change indicators
  - **Neighbourhood assessments**: card grid for Edmonton/Calgary with YoY changes, property counts, lot sizes, year built
  - **Zoning breakdown**: bar chart + table for non-Edmonton/Calgary municipalities
  - **Permit activity summary**: permit types with counts and dollar values
  - **Rental snapshot**: CMHC vacancy rate chart + rents table (Edmonton vs Calgary)
  - **Print-friendly layout**: `@media print` CSS — hidden interactive elements, visible print header with branding and date, print-optimized borders
  - **Print Report button**: triggers `window.print()` for browser print/PDF export
  - Server component page → client component (`ReportsDashboard`), Suspense with skeletons, teal accent

- 3.3.3: Replaced placeholder at `/realtor/listings` with full listing intelligence dashboard:
  - **Municipality selector**: dropdown within operating area
  - **Top assessed properties table**: top 20 properties per municipality showing address, assessment value, zoning, neighbourhood, year built (via existing `fetchTopProperties()`)
  - **Assessment by neighbourhood chart**: horizontal bar chart showing avg assessment by neighbourhood/zoning (via existing `fetchAssessmentsByGroup()`)
  - **Vacant lots summary**: zoning breakdown of vacant lots with counts and avg assessment (via existing `fetchVacantLots()`)
  - Server component page → client component (`ListingsDashboard`), Suspense with skeletons, teal accent

- Also fixed: created missing `/edo/settings` placeholder page that was causing build failures.

**New files:**
- `src/lib/realtor/report-data.ts` — report data aggregator (types + `buildReportSnapshot()`)
- `src/app/(realtor)/realtor/reports/reports-client.tsx` — client components: MunicipalitySelector, NeighbourhoodSelector, HeadlineCard, PermitSummaryCard, NeighbourhoodCard, ZoningBreakdownChart, RentalSnapshot, ReportsDashboard
- `src/app/(realtor)/realtor/listings/listings-client.tsx` — client components: MunicipalitySelector, TopPropertiesTable, AssessmentBreakdownChart, VacantLotsSummary, ListingsDashboard
- `src/app/(edo)/edo/settings/page.tsx` — EDO settings placeholder

**Files modified:**
- `src/app/(realtor)/realtor/reports/page.tsx` — replaced placeholder with server component using Suspense + auth + data fetching
- `src/app/(realtor)/realtor/listings/page.tsx` — replaced placeholder with server component using Suspense + auth + data fetching

**Data sources used (all pre-existing, no new integrations):**
- regionaldashboard.alberta.ca: avg sale price, building permits, housing starts, vacancy rates, assessment base, population
- StatsCan via CMHC: vacancy rates, average rents by unit type (Edmonton + Calgary CMAs)
- UAlberta Open Data: neighbourhood-level assessments (Edmonton/Calgary)
- Municipal ArcGIS/Socrata: top properties, assessment-by-neighbourhood, vacant lots, permit summaries

**Next up:** All 4 product phases complete. Focus on marketing, user acquisition, and iteration.

---

### Session 18 — Phase 4: Pulse Learn (2026-03-25)

**Phase 4.0 — Learning Platform Foundation (COMPLETE)**

4.0.1: Created `src/app/(learn)/learn/layout.tsx` — course-style layout with:
- Module list sidebar with lesson sub-items, checkmark completion indicators, lock icons for locked modules
- Progress bar at top showing % complete across all 8 modules
- Amber accent color throughout (distinct from teal/indigo/blue)
- Mobile bottom nav + hamburger menu sidebar overlay
- Top bar with "Pulse Learn" branding, progress bar, FREE badge, and "Back to Pulse" link
- Follows same pattern as EDO/Realtor layouts (bypasses AppShell)

4.0.2: Progress tracking via localStorage:
- `src/lib/learn-progress.ts` — full progress system: load/save, mark lesson complete, save quiz results, module unlock logic (sequential), overall progress calculation, resume point detection, certificate tracking
- `src/lib/learn-course.ts` — course structure: 8 modules with 3-6 lessons each, navigation helpers (getNextLesson, getPrevLesson)
- `src/components/learn-lesson-complete.tsx` — "Mark Lesson Complete" button + auto-advance to next lesson
- Anonymous users (localStorage), no auth required

**Phase 4.1 — Course Content (COMPLETE)**

4.1.1: 8 modules, 33 lessons total:
- Module 1: Alberta 101 (3 lessons + quiz) — NEW content: geography, people, regions
- Module 2: The Energy Engine (5 lessons + quiz) — migrated from /home/learn/energy-economy
- Module 3: The Housing Machine (4 lessons + quiz) — migrated from /home/learn/housing-machine
- Module 4: Your Tax Dollars (3 lessons + quiz) — migrated from /home/learn/your-tax-dollars
- Module 5: People & Growth (3 lessons + quiz) — migrated from /home/learn/people-and-growth
- Module 6: Reading the Signals (3 lessons + quiz) — migrated from /home/learn/reading-the-signals
- Module 7: Community Levers (3 lessons + quiz) — migrated from /home/learn/community-levers
- Module 8: Safety & Prosperity (3 lessons + quiz) — migrated from /home/learn/safety-and-prosperity

All lessons embed live charts from existing data sources (BoC, StatsCan, CMHC, Regional Dashboard, etc.). Each lesson has a "Mark Complete" button and navigation to next lesson.

4.1.2: Quiz system:
- `src/lib/learn-quizzes.ts` — 5 multiple-choice questions per module (40 total) with explanations
- `src/components/learn-quiz.tsx` — interactive quiz UI: select answer → check → explanation → next, progress bar, score tracking, retry capability, pass/fail (70% threshold), previous result display
- Must pass quiz (70%+) to advance to next module
- Sequential module unlocking enforced

4.1.3: Certificate of completion:
- `src/app/api/learn/certificate-pdf/route.tsx` — server-side PDF generation using @react-pdf/renderer
- `src/app/(learn)/learn/certificate/page.tsx` — certificate page with module checklist, name input, download button
- Landscape A4 PDF with amber accent, module badges, certificate ID, verify URL
- Unlocked only when all 8 modules complete with passing quiz scores

**Learn hub page:** `src/app/(learn)/learn/page.tsx` — module grid with progress, resume button, "What You'll Learn" section, certificate teaser

**Infrastructure updates:**
- `src/components/app-shell.tsx` — added /learn route bypass (Learn has its own layout)
- `src/middleware.ts` — added /learn and /api/learn to public routes (no auth required)
- `src/app/home/briefings/developer/page.tsx` — added force-dynamic to fix pre-existing build failure

**Files created (core):**
- `src/lib/learn-course.ts` — course structure and navigation
- `src/lib/learn-progress.ts` — localStorage progress tracking
- `src/lib/learn-quizzes.ts` — 40 quiz questions with explanations
- `src/components/learn-quiz.tsx` — interactive quiz component
- `src/components/learn-lesson-complete.tsx` — lesson completion button
- `src/app/(learn)/learn/layout.tsx` — Learn product layout
- `src/app/(learn)/learn/page.tsx` — Learn hub/landing
- `src/app/(learn)/learn/certificate/page.tsx` — certificate page
- `src/app/api/learn/certificate-pdf/route.tsx` — PDF certificate generation
- 33 lesson pages across 8 module directories under `src/app/(learn)/learn/`

**Data sources used (all pre-existing, no new integrations):**
- Bank of Canada Valet API (policy rate, mortgage rates, BCPI Energy, CAD/USD)
- StatsCan WDS (unemployment, CPI, population, GDP by sector, immigration, migration, housing starts/completions, employment, weekly earnings)
- CMHC via StatsCan (housing starts, vacancy rates, rent comparison)
- regionaldashboard.alberta.ca (municipal indicators, property assessments, population)
- Edmonton/Calgary Socrata (permits, business licences, crime)
