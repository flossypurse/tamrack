# Tamrack — SEO & Funnel Strategy

(Historically "Alberta Pulse Check". Rebrand in progress — domain currently `albertapulsecheck.ca`, flips to `tamrack.ca` at cutover.)

**Date**: March 2026
**Domain**: albertapulsecheck.ca (current); tamrack.ca (post-cutover)

---

## The Problem (Before)

- 0/35 pages had SEO metadata
- No robots.txt, no sitemap.xml, no OpenGraph tags, no JSON-LD
- All valuable content was behind a login wall — Google couldn't index ANY data pages
- Only 7 routes were publicly accessible (landing, login, terms, privacy, pricing, municipalities, coverage)
- Zero analytics — no way to know what's working

**Result**: Invisible to search engines. The only acquisition channel was direct traffic.

---

## What We Fixed (Technical SEO Foundation)

| Component | Status |
|-----------|--------|
| `robots.txt` | Created — allows all, blocks /api/, /admin, /billing, /login |
| `sitemap.xml` | Dynamic generation via `sitemap.ts` — 55+ URLs (public + macro + municipalities) |
| Root metadata | OpenGraph, Twitter Cards, canonical, metadataBase, keywords, robots directives |
| Page metadata | All 35+ pages now have unique title + description (template: `%s \| Alberta Pulse Check`) |
| JSON-LD | Organization, WebSite (with SearchAction), SoftwareApplication (with pricing) |
| JSON-LD components | Reusable `DatasetJsonLd`, `BreadcrumbJsonLd` for page-level structured data |
| Public crawlability | 18 macro/topic pages moved from login-required to public |

---

## The Funnel Architecture

### Layer 1: Google → Public Pages (Top of Funnel)

**These pages are now publicly accessible and indexed:**

| Page | Target Search Queries | Monthly Search Volume (est.) |
|------|----------------------|------------------------------|
| `/dashboard` | "Alberta economy", "Alberta economic data" | 500–1K |
| `/energy` | "Alberta energy prices", "Alberta oil data" | 300–800 |
| `/labour` | "Alberta unemployment rate", "Alberta jobs data" | 1K–3K |
| `/migration` | "Alberta population growth", "moving to Alberta" | 2K–5K |
| `/cycle` | "Alberta boom bust cycle", "Alberta recession" | 200–500 |
| `/diversification` | "Alberta economic diversification" | 100–300 |
| `/agriculture` | "Alberta agriculture data", "Alberta farm economy" | 200–500 |
| `/weather` | "Alberta weather" (extremely competitive) | 50K+ |
| `/wildfire` | "Alberta wildfires", "Alberta fire map" | 5K–20K (seasonal) |
| `/air-quality` | "Alberta air quality" | 1K–3K |
| `/water` | "Alberta river levels", "Alberta flood risk" | 500–2K |
| `/earthquakes` | "Alberta earthquakes" | 200–1K |
| `/traffic` | "Alberta highway conditions" | 5K–10K |
| `/elections` | "Alberta election results" | 1K–5K (event-driven) |
| `/emergencies` | "Alberta emergency alerts" | 1K–5K (event-driven) |
| `/signals` | "Alberta economic indicators" | 100–300 |
| `/municipalities` | "Alberta municipalities data" | 100–500 |

**Total addressable search volume: ~70K–100K+ monthly searches** (conservative)

### Layer 2: Logged-in Free Pages (Middle of Funnel)

These require a free account but no subscription — conversion friction is low:

| Page | Value Proposition |
|------|-------------------|
| `/pipeline` | Housing starts/completions — developers want this |
| `/rental` | Vacancy + rent data — investors need this |
| `/commercial` | Commercial RE pulse — CRE investors |
| `/drilling` | Well activity — energy sector |
| `/compare` | Municipality comparison — everyone wants to compare |
| `/briefing` | Role-specific reports — personalized value |

**Conversion trigger**: "Sign up free to see development pipeline data"

### Layer 3: Paid Municipality Deep-Dives (Bottom of Funnel)

`/m/[slug]` pages require $29/mo subscription. This is where the money is:

| Slug | Target Queries |
|------|---------------|
| `/m/stony-plain` | "Stony Plain building permits", "Stony Plain real estate data" |
| `/m/spruce-grove` | "Spruce Grove development", "Spruce Grove housing" |
| `/m/calgary` | "Calgary permit data", "Calgary assessment data" |
| `/m/airdrie` | "Airdrie growth", "Airdrie real estate" |
| ... | (22 municipalities × 3–5 keyword variations each = 66–110 long-tail queries) |

**Conversion trigger**: "Start 14-day free trial to unlock [Municipality] deep-dive"

### Layer 4: Embeds as Backlink Engine

Every embed on a realtor's website, news article, or report = a backlink:

```html
<iframe src="https://albertapulsecheck.ca/embed/stony-plain-permits" />
<!-- Powered by Alberta Pulse Check — clickable link back -->
```

**Strategy**: Make embeds free. Each embed is a permanent backlink + brand impression.

---

## Audience-Specific Funnels

### Funnel 1: Realtors (Primary — ~6K Edmonton, ~20K Alberta)

**Search behavior**: "Edmonton housing market", "[neighbourhood] real estate", "Alberta real estate trends"

**Funnel**:
1. Google → `/real-estate` or `/migration` or `/pipeline` (public)
2. See permit hotspots, assessment trends → want neighbourhood detail
3. Sign up free → see `/briefing/realtor` (free, requires login)
4. Want municipality deep-dives → $29/mo trial
5. Embed charts on their own website → backlinks

**Best channels**:
- Google organic (long-tail municipal + neighbourhood queries)
- Edmonton Real Estate Board newsletter/forum
- Realtor Facebook groups (Edmonton & Area Association of Realtors)
- Serene's broker network as seed distribution
- Alberta Real Estate Association (AREA) events

**Content strategy**: Write data-driven "market update" blog posts monthly. "Edmonton Metro Permit Activity: March 2026" — these rank extremely well and realtors share them.

### Funnel 2: Land Developers & Builders

**Search behavior**: "Alberta housing starts", "where to build in Alberta", "[city] building permits"

**Funnel**:
1. Google → `/pipeline` or `/m/[slug]` preview
2. Want starts/completions/absorption → free account
3. Want API + bulk data → $149/mo Business tier

**Best channels**:
- Google organic (CMHC data queries)
- Canadian Home Builders' Association – Alberta
- UDI (Urban Development Institute) Edmonton newsletter
- LinkedIn (developer/construction audience)

### Funnel 3: Municipal EDOs (High-Value — $2,400/yr target)

**Search behavior**: "[municipality] economic data", "Alberta municipal comparison", "investment attraction data"

**Funnel**:
1. Google → `/benchmarks` or `/corridors` or `/m/[slug]`
2. See how their municipality compares → want exportable reports
3. → Enterprise tier ($499/mo) or annual licence ($2,400/yr)

**Best channels**:
- Alberta Economic Development and Trade (Ministry contacts)
- EDAC (Economic Developers Association of Canada) Alberta chapter
- Direct outreach (there are ~340 municipalities, ~50 with dedicated EDOs)
- Conference sponsorship: Alberta Municipalities convention

### Funnel 4: Mortgage Brokers & Lenders

**Search behavior**: "Alberta housing risk", "Alberta vacancy rates", "[city] market risk"

**Funnel**:
1. Google → `/risk` or `/rental`
2. Want municipality-level risk scoring → $29/mo
3. Want API integration into their systems → $149/mo

**Best channels**:
- Google organic (risk-related queries)
- Mortgage Professionals Canada Alberta chapter
- LinkedIn (mortgage broker audience)
- CMBA (Canadian Mortgage Brokers Association) newsletter

### Funnel 5: Energy Sector

**Search behavior**: "Alberta well licences", "Alberta drilling activity", "AER data"

**Funnel**:
1. Google → `/drilling` or `/energy`
2. Want operator-level well data → $149/mo Business
3. Want API → Business/Enterprise

**Best channels**:
- Google organic (AER data queries)
- LinkedIn (oil & gas audience is huge in Alberta)
- PSAC (Petroleum Services Association of Canada) events
- Energy industry newsletters

### Funnel 6: Journalists & Researchers

**Search behavior**: "Alberta economic data", "Alberta statistics", "Edmonton growth data"

**Funnel**:
1. Google → any public macro page
2. Want to cite/embed specific data → embed button (free)
3. Want ongoing access + comparison tools → Media tier ($99/mo)

**Best channels**:
- Google organic (general data queries)
- Direct outreach to Alberta politics/economy reporters
- Twitter/X (journalists are active there)
- University research departments (U of A economics, urban planning)

---

## SEO Content Strategy

### Quick Wins (Immediate)

1. **Submit sitemap to Google Search Console** — register albertapulsecheck.ca, submit sitemap.xml
2. **Submit to Bing Webmaster Tools** — secondary but free
3. **Google Business Profile** — register as a software company in Parkland County

### Monthly Content (Ongoing)

Generate SEO-rich pages from the data you already have:

| Content Type | Example | SEO Value |
|-------------|---------|-----------|
| Monthly market reports | "Alberta Economy: March 2026 Snapshot" | Ranks for "[month] Alberta economy" |
| Municipality spotlights | "Airdrie Growth Report Q1 2026" | Long-tail municipal queries |
| Data stories (auto-generated) | "Spruce Grove permits up 23% YoY" | Ranks for specific municipal news |
| Comparison articles | "Edmonton vs Calgary: 2026 Development Pipeline" | City comparison queries |
| Seasonal alerts | "Alberta Wildfire Season 2026: What the Data Shows" | Seasonal search spikes |

### Technical SEO Next Steps

| Priority | Action | Impact |
|----------|--------|--------|
| HIGH | Set up Google Analytics 4 | Understand which pages convert |
| HIGH | Add conversion tracking (sign-up, trial start, subscribe) | Measure funnel effectiveness |
| HIGH | Create OG images per page (use Vercel OG or similar) | Social sharing click-through |
| MEDIUM | Add `<link rel="preconnect">` for external data APIs | Page speed |
| MEDIUM | Add ISR (Incremental Static Regeneration) to macro pages | Faster loads, better Core Web Vitals |
| MEDIUM | Create a `/blog` or `/reports` section for content marketing | Ongoing SEO content |
| LOW | Set up Google Search Console performance monitoring | Track ranking progress |
| LOW | Add hreflang for en-CA vs en-US (if US audience grows) | International SEO |

---

## Funnel Metrics to Track

| Metric | Tool | Target |
|--------|------|--------|
| Organic search impressions | Google Search Console | 10K/mo within 3 months |
| Organic search clicks | Google Search Console | 1K/mo within 3 months |
| Free sign-ups from organic | GA4 conversion events | 50/mo within 3 months |
| Free → trial conversion | GA4 funnel | 20% of free sign-ups |
| Trial → paid conversion | Stripe + GA4 | 30% of trials |
| Embed installations | Server logs or embed API | 20/mo within 6 months |
| Backlinks from embeds | Search Console / Ahrefs | 10 within 6 months |

---

## Competitive Landscape

| Competitor | What They Do | Price | Our Edge |
|------------|-------------|-------|----------|
| CMHC Housing Observer | National housing data reports | Free | We're Alberta-specific with municipal granularity |
| ATB Financial Alberta Outlook | Quarterly macro reports (PDF) | Free | We're real-time, interactive, and municipality-level |
| Altus Group | Commercial RE data | $$$$ | We're 100x cheaper with similar government data |
| Zonda (formerly Meyers) | Housing market intelligence | $$$$ | We serve the same data at $29/mo |
| Real Estate boards (EREB, CREB) | MLS stats | Members only | We cross-reference permits + assessments + macro |
| StatsCan directly | Raw tables | Free | We synthesize and visualize — they serve spreadsheets |

**Our moat**: Nobody stitches together 8+ government data sources at the municipal level for Alberta. The data is free but the integration is hard. We've already done the hard part.

---

## Revenue Projections from SEO Funnel

Conservative model assuming funnel works within 6 months:

| Source | Monthly Volume | Conversion | Revenue |
|--------|---------------|------------|---------|
| Organic → Free sign-up → Pro ($29) | 500 organic visits → 50 sign-ups → 10 trials → 3 paid | 3 × $29 | $87/mo |
| Organic → Free sign-up → Pro (steady-state, 12mo) | Cumulative 36 Pro subs | 36 × $29 | $1,044/mo |
| Direct outreach → EDO Enterprise ($499) | 2 annual licences | 2 × $499 | $998/mo |
| Realtor word-of-mouth → Pro | 5/mo via Serene's network | 5 × $29 | $145/mo |
| **12-month steady-state** | | | **~$2,200/mo** |

This is the baseline. The audience expansion plan (developers, lenders, energy) multiplies this.

---

## Immediate Action Items

1. Register albertapulsecheck.ca in Google Search Console
2. Submit sitemap.xml
3. Register Google Business Profile (Parkland County, AB)
4. Set up GA4 with conversion events (sign-up, trial-start, subscribe)
5. Create OG images (even a simple branded template per page category)
6. Ask Serene to share 3 embed charts on her realtor channels as a test
7. Post the first "Alberta Economy Monthly" data story (auto-generated from snapshot diffs)
8. Join 2–3 Edmonton realtor Facebook groups and share relevant data (not spam — genuine value)
