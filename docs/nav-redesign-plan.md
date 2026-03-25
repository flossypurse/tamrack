# Navigation Redesign Plan

## Problem
135 pages across 11 sidebar categories. The single global sidebar doesn't scale — too many items, overlapping categories (Economy vs Intelligence, Health vs Safety vs Environment), and municipalities alone could fill the entire panel.

## Solution: Two-tier nav with contextual sidebar

### Desktop
- **Top bar**: 7 persistent section links + search (Cmd+K) + user avatar menu
- **Contextual left sidebar**: Only shows pages for the active section. Sub-headers group items within a section.
- **User avatar menu**: Account, Billing, Sign Out (removed from main nav)
- **Tools** (API docs, Data Sources): Linked from avatar menu or sidebar footer, not top-level nav

### Mobile
- **Bottom tab bar**: 5 icons (Home, Economy, Real Estate, Community, More)
- **"More" tab**: Environment, Governance, Municipalities, Tools, Account
- **Hub pages**: Each section's overview page becomes the primary discovery mechanism — cards that route deeper. No giant nav drawer.
- **Municipalities**: Search/filter picker, not a scrollable list

### Admin
- No change. Admin pages already use separate `AdminNav` component with their own layout.

---

## Information Architecture (7 top-level sections)

### Home (`/home`)
- Dashboard (`/home/dashboard`)
- Signals (`/home/signals`)
- Briefings (`/home/briefings`)
- Learn landing (`/home/learn`)
  - The Housing Machine (`/home/learn/housing-machine`)
  - Energy Engine (`/home/learn/energy-economy`)
  - Reading Signals (`/home/learn/reading-the-signals`)
  - Your Tax Dollars (`/home/learn/your-tax-dollars`)
  - People & Growth (`/home/learn/people-and-growth`)
  - Safety & Prosperity (`/home/learn/safety-and-prosperity`)
  - Community Levers (`/home/learn/community-levers`)

### Economy (`/economy`)
*Absorbs former Intelligence section*
- Overview (`/economy`)
- Energy (`/economy/energy`)
- Drilling (`/economy/drilling`)
- Boom-Bust Cycle (`/economy/boom-bust`)
- Diversification (`/economy/diversification`)
- Agriculture (`/economy/agriculture`)
- Cannabis (`/economy/cannabis`)
- Retail Trade (`/economy/retail`)
- Business Dynamics (`/economy/businesses`)
- Employers (`/economy/employers`)
- **Analysis** *(sub-header)*
- Benchmarks (`/economy/benchmarks`)
- Growth Corridors (`/economy/corridors`)
- Market Risk (`/economy/risk`)
- Cycle Position (`/economy/cycle-position`)
- Investment Thesis (`/economy/invest`)
- Compare (`/economy/compare`)

### Real Estate (`/real-estate`)
*No structural changes*
- Overview (`/real-estate`)
- Market Intel (`/real-estate/market`)
- Prospect Leads (`/real-estate/prospects`)
- Neighbourhoods (`/real-estate/neighbourhoods`)
- Dev Pipeline (`/real-estate/pipeline`)
- Rental Intel (`/real-estate/rental`)
- Assessments (`/real-estate/assessments`)
- Commercial (`/real-estate/commercial`)

### Community (`/community`)
*Merges former Health + Safety sections, adds Labour + Immigration from Economy*
- Overview (`/community`)
- Demographics (`/community/demographics`)
- Immigration (`/community/immigration`)
- Labour (`/community/labour`)
- Health (`/community/health`)
- Mortality (`/community/mortality`)
- **Safety** *(sub-header)*
- Crime (`/community/crime`)
- Fire Response (`/community/fire-response`)
- Traffic & Roads (`/community/traffic`)
- Seismic (`/community/seismic`)
- Emergencies (`/community/emergencies`)

### Environment (`/environment`)
*No structural changes*
- Overview (`/environment`)
- Weather (`/environment/weather`)
- Air Quality (`/environment/air-quality`)
- Water & Rivers (`/environment/water`)
- Wildfire (`/environment/wildfire`)
- Emissions (`/environment/emissions`)

### Governance (`/governance`)
*Renamed from Politics*
- Overview (`/governance`)
- Legislature (`/governance/legislature`)
- Federal (`/governance/federal`)
- Elections (`/governance/elections`)
- Campaign Finance (`/governance/campaign-finance`)
- Gov Spending (`/governance/spending`)
- Transfers (`/governance/transfers`)
- Legislation (`/governance/legislation`)

### Municipalities (`/municipalities`)
*No structural changes — explorer-first approach*
- Explorer (`/municipalities`)
- Data Coverage (`/municipalities/coverage`)
- Individual pages (`/m/[slug]`) — accessed via search/explorer, not listed in sidebar

---

## Slug changes summary

| Old | New |
|-----|-----|
| `/dashboard` | `/home/dashboard` |
| `/overview/signals` | `/home/signals` |
| `/overview/briefing` | `/home/briefings` |
| `/learn/*` | `/home/learn/*` |
| `/economy/cycle` | `/economy/boom-bust` |
| `/economy/labour` | `/community/labour` |
| `/economy/migration` | `/community/immigration` |
| `/intelligence/benchmarks` | `/economy/benchmarks` |
| `/intelligence/corridors` | `/economy/corridors` |
| `/intelligence/risk` | `/economy/risk` |
| `/intelligence/cycle` | `/economy/cycle-position` |
| `/intelligence/invest` | `/economy/invest` |
| `/intelligence/compare` | `/economy/compare` |
| `/health` | `/community/health` |
| `/health/demographics` | `/community/demographics` |
| `/health/mortality` | `/community/mortality` |
| `/safety` | `/community` |
| `/safety/crime` | `/community/crime` |
| `/safety/fire-response` | `/community/fire-response` |
| `/safety/traffic` | `/community/traffic` |
| `/safety/seismic` | `/community/seismic` |
| `/safety/emergencies` | `/community/emergencies` |
| `/politics/*` | `/governance/*` |
| `/tools/*` | moved to avatar menu / sidebar footer |

No redirects needed (no existing users).

---

## Migration steps

1. Reorganize route directories to match new IA
2. Build top bar component
3. Build contextual sidebar component
4. Build mobile bottom tab bar
5. Enhance overview/hub pages as landing pages with card grids
6. Wire user avatar menu (Account, Billing, Tools)
7. Remove old global sidebar
8. Delete orphaned routes (e.g., `/safety/elections` redirect)
