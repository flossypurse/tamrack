# Alberta Pulse

Multi-product SaaS platform tracking Alberta's economy. ~320 pages, 50+ live data sources, 4 product surfaces.

## Status

All 4 product phases complete. Deployed live on Railway (auto-deploy from `main`). Focus is now marketing and user acquisition.

## Stack

- Next.js 16, React 19, TypeScript
- Tailwind 4, Recharts
- better-sqlite3 (local), PostgreSQL (fallback for upstream outages)
- Deployed on Railway from `main` branch

## Products

| Product | Price | Description |
|---------|-------|-------------|
| Pulse Charts | Free | Public dashboard: economy, energy, real estate, environment, governance, municipalities |
| Pulse EDO | $299/mo | Economic development officer tools: community profiles, peer comparison, council reports, pitch kits |
| Pulse Realtor | $49/mo | Real estate agent tools: market intel, prospects, neighbourhoods, listings, reports |
| Pulse Learn | Free | 8-module gamified economics course with quizzes and certificate generation |

## Key Paths

| Path | Contents |
|------|----------|
| `src/app/` | Next.js app router pages (~320 across 7 sections + 4 products) |
| `src/lib/data-sources*.ts` | 16+ data fetcher modules (StatsCan, BoC, Socrata, CKAN, ArcGIS, CER, AESO, IRCC, CMHC, ECCC, WCB, CRA, etc.) |
| `src/lib/municipality-registry.ts` | Config-driven registry for 30 municipalities across 7 regions |
| `src/lib/municipality-data.ts` | Generic municipality data fetcher |
| `src/lib/data-fallback.ts` | PostgreSQL fallback for upstream outages |
| `src/lib/csv-utils.ts` | Shared CSV parsing utilities |
| `src/components/nav-config.ts` | Navigation configuration (two-tier: top bar + contextual sidebar) |
| `docs/MASTER_PLAN.md` | Full 4-phase product strategy (72K) |

## Run

```bash
cd alberta-pulse/webui && npm run dev
```

Owner prefers to start dev servers themselves — don't auto-start.

## API Routes

19 endpoints under `/api/`: permits, assessments, signals, macro, regional, energy, electricity, immigration, projects, wildfire, crime, fire, health-data, housing, rental, retail, business, politics, fiscal.

Health check: `/api/health?deep=1` — probes all upstream sources with response times and record counts.

### MCP server

Hosted MCP endpoint at `/api/mcp` exposes the substrate to AI agents over Streamable HTTP with Bearer auth. See [src/app/api/mcp/AGENT.md](src/app/api/mcp/AGENT.md) for registration command, token issuance, and tool list.

## Data Sources

50+ live sources across 16 fetcher modules. Key upstream providers:
- **Government**: StatsCan WDS, Alberta CKAN (AAX), regionaldashboard.alberta.ca (54 indicators, ~340 municipalities), Edmonton/Calgary Socrata
- **Energy**: CER Open Data (16 CSV endpoints), AESO Electricity API (pool price, supply/demand, forecast)
- **Real Estate**: CMHC via StatsCan, UAlberta Open Data Centre, ArcGIS (20 municipalities), Google Maps Platform
- **Immigration**: IRCC (5 CSV endpoints)
- **Federal**: Infrastructure Canada, Elections Canada, OpenParliament.ca, open.canada.ca

Full data source reference and scouted-but-unwired endpoint inventory are maintained in private workspace notes (not in this repo).

## Municipality Registry

30 municipalities across 7 regions, all live. Config-driven at `src/lib/municipality-registry.ts`. 8 are regional-data-only (no ArcGIS): Beaumont, Fort Saskatchewan, Morinville, Devon, Okotoks, Chestermere, Red Deer, Wood Buffalo.

## Architecture Notes

- **Resilience**: Error boundaries on all major route groups. Regional data fetcher falls back to PostgreSQL snapshots on upstream failure. Embed routes use ISR (1h) instead of force-dynamic.
- **Nav**: Two-tier — top bar (7 sections) + contextual sidebar + mobile bottom tabs. Config in `src/components/nav-config.ts`.
- **Data freshness**: `DataFreshness` component via `CardHeader` `freshness` prop (tiers: realtime/hourly/daily).
- **Concurrency**: Regional fetch concurrency set to 10.
- **Git repo**: This directory (`alberta-pulse/webui/`) is the git root. The parent `alberta-pulse/` also contains the Resonate server and worker, but they're separate concerns.

## Deploy

| Service | Platform | Auto-deploy | Domain |
|---------|----------|-------------|--------|
| webui (this dir) | Railway | `main` → production | albertapulsecheck.ca |
| resonate-server | Railway (Docker) | `main` → production | — |
| worker | Railway (Docker) | `main` → production | — |

**CLI:** `railway` — linked in this directory. Use `railway service <name>` to switch between `web`, `resonate`, `worker`.

**Key env vars (set on Railway, not in code):** `ADMIN_EMAIL`, `AUTH_SECRET`, `DATABASE_URL`, `NEXT_PUBLIC_*` vars.

**Health check:** `/api/health` (120s timeout, max 3 retries on failure).

**Deploy flow:** Push to `main` → Railway auto-builds and deploys. No manual steps needed.

## Rules

- This is a PUBLIC, deployed application. Every change goes live on merge to `main`.
- Don't break the build. Run `npm run build` before considering work done.
- Don't hardcode municipality data. Use the registry.
- Prefer live API calls over static data. If an upstream is down, that's what the fallback layer is for.

## Skills

| File | Skill | Description |
|------|-------|-------------|
| [docs/skill-page-creation.md](docs/skill-page-creation.md) | Page Creation | Step-by-step guide for adding new dashboard pages |
| [docs/skill-design-system.md](docs/skill-design-system.md) | Design System | Component patterns, category colors, typography scale |

## Visibility

**PUBLIC** — deployed live at albertapulsecheck.ca. Never put private financial data, credentials, or PII into this codebase.

## Privacy

Visibility declared in `.privacy` at the project root (parent dir). Trip-wires:

- Workspace pre-commit hook (gitleaks + workspace-crumbs check) runs on every commit. Wired via `core.hooksPath`.
- CI workflow at `.github/workflows/privacy.yml` enforces the same on push and PR.

Workspace contributors: full model and pre-publish checklist live in `PRIVACY.md` at the workspace root.
