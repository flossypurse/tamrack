# Tamrack

Alberta-data platform — HTTP API, MCP server, and Smart UI (chat-first dashboard builder). Public brand: **Tamrack** at [tamrack.ca](https://tamrack.ca).

## Status

Deployed live. Invite-only access. Focus is on growing early-access usage.

## Stack

- Next.js 16, React 19, TypeScript
- Tailwind 4, Recharts
- PostgreSQL (Crunchy Bridge, `ca-central-1`) via `pg`; better-sqlite3 for local-dev fallback
- Deployed on Fly.io — app `tamrack-webui`, region `yyz` (Toronto)
- Durable data-collection worker on Fly.io — app `tamrack-collector-worker`, region `yyz`

## Hosting

| Service | Platform | App name | Region |
|---------|----------|----------|--------|
| webui (this dir) | Fly.io | `tamrack-webui` | `yyz` |
| collector worker | Fly.io | `tamrack-collector-worker` | `yyz` |
| Resonate server | Fly.io (separate repo) | — | `yyz` |
| Database | Crunchy Bridge | — | `ca-central-1` |

**Deploy flow:** `flyctl deploy --local-only` (remote builder OOMs on this app — use `--local-only` with Docker Desktop). Config at `fly.toml` (webui) and `fly.worker.toml` (worker).

**Key env vars (set as Fly secrets):** `DATABASE_URL`, `AUTH_SECRET`, `STRIPE_SECRET_KEY`, `ANTHROPIC_TAMRACK_API_TOKEN`, `RESONATE_URL`, `RESONATE_TOKEN`, `MAILGUN_API_KEY`, `ADMIN_EMAIL`, `NEXT_PUBLIC_*` vars.

**Health check:** `GET /api/health` (120 s timeout, max 3 retries).

### Deploy = git sync (READ THIS BEFORE DEPLOYING)

There is **no deploy CI**. `flyctl deploy --local-only` builds the image from your **local working tree**, not from a git ref — so nothing keeps git and production in sync except discipline. The invariants:

- **The deploy line is `fly-migration`, NOT `main`.** (AGENT.md elsewhere says "merge to main goes live" — that is aspirational; ignore it. `main` is far behind and only used as the GitHub default branch for scheduled Actions.) Deploy from `fly-migration` (or a branch you immediately fast-forward it to).
- **Always deploy from a clean tree at a committed SHA**, and **deploy webui AND worker together** — they share `src/lib/collector.ts`, `src/lib/db.ts`, `package.json`, and the lockfile, so a half-deploy splits the code across the two apps.
- **After deploying, immediately `git push origin fly-migration`** so `origin/fly-migration` == the deployed source. A direct push to `fly-migration` triggers no CI (build.yml only runs on PRs targeting it), so it is safe.

**Deploy checklist (run in order):**
```bash
git status                                  # MUST be clean
git rev-parse --abbrev-ref HEAD             # on fly-migration (or FF it after)
npx tsc --noEmit                            # type gate
# If you changed dependencies: re-sync the lockfile or `npm ci` fails in Docker:
npm install --package-lock-only && git add package-lock.json && git commit -m "build: sync lockfile"
flyctl deploy --local-only -c fly.toml        -a tamrack-webui         --build-arg GIT_SHA=$(git rev-parse HEAD)
flyctl deploy --local-only -c fly.worker.toml -a tamrack-collector-worker --build-arg GIT_SHA=$(git rev-parse HEAD)
curl -s https://tamrack-webui.fly.dev/api/health    # {"status":"ok",...}
git push origin fly-migration               # origin now == deployed
```

**To VERIFY git matches what's running:**

Definitive check — one command:
```bash
curl -s https://tamrack-webui.fly.dev/api/health
# compare git_sha to: git rev-parse origin/fly-migration
```
If `git_sha` matches `origin/fly-migration` the deployed image is in sync. If it differs (or is `null` on an old image), fall back to:
1. `git rev-parse HEAD` must equal `git rev-parse origin/fly-migration` and the tree must be clean.
2. `flyctl releases -a tamrack-webui` / `-a tamrack-collector-worker` — the latest release time should be ≥ the latest `fly-migration` commit time. An older release ⇒ unpushed/undeployed local commits exist.

## Auth

Email-only magic-link via NextAuth v5 + Mailgun (no SMTP). Google OAuth optional (`GOOGLE_CLIENT_ID` env). Landing page at `/login` is the only public-facing auth surface.

**Access control:** `EARLY_ACCESS=true` (default) blocks self-signup. New users arrive via invite tokens (`tinv_*` prefix, 30-day expiry, one-time-use). Flow: admin issues token at `/admin/invites` → user visits `/invite/<token>` → enters email → magic-link → account + `tk_*` API key created on first sign-in.

Self-serve password reset: not applicable — magic-link only (no passwords).

## Account workspace (`/account`)

Full-screen three-column shell. Auth enforced at the layout level — every sub-page is gated.

- **Left rail** — API key management (reveal, revoke) + MCP token management (mint, list, revoke, copy install snippet) + sign-out.
- **Center** — chat (`/account/chat`): ask a question, the Smart UI agent picks tools, pulls live data, streams a composed dashboard back. Saved dashboards land at `/d/<slug>`.
- **Right rail** — recent Q&A history; clicking an entry opens `/d/<slug>`.
- `/account/keys` and `/account/mcp` are redirect aliases → `/account/chat`.
- On `< lg` the rails collapse into bottom-bar drawers.

## Smart UI

Two-pass LLM pipeline (both passes use `claude-sonnet-4-6` with prompt caching):

1. **Planner** (`src/lib/smart-ui/planner.ts`) — translates a natural-language question into a `QueryPlan`: intent, card titles, ordered list of MCP tool calls (up to 7 tools in v1.1: `tamrack_macro`, `tamrack_regional`, `tamrack_housing`, `tamrack_energy`, `tamrack_business`, `tamrack_municipality`, `tamrack_catalog`).
2. **Composer** (`src/lib/smart-ui/composer.ts`) — receives the plan + tool results and produces a `DashboardConfig` (card array: `line`, `scorecard` types).

Saved dashboards persist in `smart_dashboards` table; telemetry in `smart_query_events`.

## MCP Server

Hosted endpoint at `/api/mcp` — Streamable HTTP transport, Bearer auth (`tk_*` keys). Twelve live tools: `tamrack_catalog`, `tamrack_municipality`, `tamrack_regional`, `tamrack_real_estate`, `tamrack_macro`, `tamrack_housing`, `tamrack_business`, `tamrack_energy`, `tamrack_search`, `tamrack_entities`, `tamrack_opportunities`, `tamrack_hiring`. Seven more are catalogued as `"deferred"`.

`tamrack_opportunities` (scope `tamrack:economy:read`) is the demand-side feed: CanadaBuys federal open tenders (IT/software/AI/data) read from the `opportunities` table. Also reachable via `GET /api/opportunities?type=tenders[&open=1&closing_before=YYYY-MM-DD&limit=N]`.

`tamrack_hiring` (scope `tamrack:economy:read`) is the latent-demand feed: Canada Job Bank Alberta postings for automatable back-office roles, read from `jobbank_postings`/`jobbank_monthly` with NOC/sector/city breakdowns + month-over-month momentum. Also `GET /api/hiring?type=signals[&month=YYYY-MM]`. Aggregate strain signal (no employer name in source), not per-company leads.

See [src/app/api/mcp/AGENT.md](src/app/api/mcp/AGENT.md) for registration command, token issuance, scope taxonomy, and tool details.

## Data Collection Worker

`worker.ts` runs 12 collection phases as a Resonate durable workflow (`dailyCollection`) on a `0 6 * * *` (6 AM UTC) schedule. Each phase is a separate `ctx.run` step; regional indicators are further split one step per indicator for fault isolation. Step IDs are date-scoped to prevent Resonate's resolved-step cache from replaying stale results on a new day's fire.

Phases: `regional` (per-indicator), `energy`, `municipalities`, `wells`, `immigration`, `projects`, `macro`, `housing`, `procurement`, `jobbank`, `spruce-grove-proxy`, `stony-plain-entities`.

The `spruce-grove-proxy` phase (`collectSpruceGroveProxy`) derives Spruce Grove licence-proxy observation series (dev-permit counts + incorporations) into `substrate.observations`; `stony-plain-entities` (`collectStonyPlainEntities`) upserts the Stony Plain ArcGIS business directory into `substrate.entities`. Both pass `since=yesterday` in daily use; a one-time full backfill (no `--since`) seeds history.

The `procurement` phase (`collectProcurementData`) fetches the CanadaBuys open-tender CSV and UPSERTs IT/software/AI/data-relevant, nationally-deliverable notices into the `opportunities` table (`src/lib/data-sources-procurement.ts`). Stores all statuses (open + closed) keyed on `(reference_number, publication_date)`; the read layer derives open-vs-closed at query time.

The `jobbank` phase (`collectJobBankData`) fetches the latest Canada Job Bank monthly snapshot, stores Alberta Tier-B postings (automatable back-office roles) in `jobbank_postings` plus a monthly aggregate in `jobbank_monthly` (`src/lib/data-sources-jobbank.ts`). Each month accumulates as a distinct snapshot to build month-over-month hiring momentum.

Resonate client: `ttl: 30 * 60 * 1000` (30 min — energy phase can take 8–23 min).

## Substrate Data Model

`substrate` schema — three orthogonal axes stored in Postgres:

- `substrate.sources` — upstream data provider registry
- `substrate.geo_dimension` — political/administrative geography (province, municipality, neighbourhood)
- `substrate.entities` — slow-changing dimensions located within a geo (businesses, parcels, projects, wells); `first_seen`/`last_seen` track presence
- `substrate.series_metadata` — named time-series with domain, cadence, unit, derivation lineage
- `substrate.observations` — time-series fact table, partitioned by `period` (monthly), with NULLS NOT DISTINCT unique constraint on `(series_id, period, geo_id, entity_id)`
- `substrate.latest_observations` — materialized view (latest row per series × geo × entity); refreshed via `substrate.refresh_latest_observations()` which takes an advisory lock to serialize concurrent callers
- `substrate.major_projects_versioned` — versioned project stage tracking with `substrate.upsert_major_project()` procedure
- `signals.licence_dietary_taxonomy` — G4 dietary classification cache for Edmonton business licences

Legacy tables (`neighbourhood_metrics`, `macro_metrics`, `regional_indicators`, `energy_throughput`, `energy_production`, `well_licences`, `immigration_records`, `major_projects`, etc.) remain active and are still used by the data-collection worker and API routes.

## Key Paths

| Path | Contents |
|------|----------|
| `src/app/account/` | Chat workspace shell + left/right rails |
| `src/app/api/mcp/` | MCP server route, tool files, registry, catalog |
| `src/app/` | Public dashboard pages (economy, energy, real estate, community, environment, governance, municipalities, learn, tools) |
| `src/lib/data-sources*.ts` | 16+ data fetcher modules (StatsCan, BoC, CKAN, ArcGIS, CER, IRCC, CMHC, ECCC, WCB, Socrata, etc.) |
| `src/lib/smart-ui/` | Planner, composer, MCP client, persistence, types |
| `src/lib/db.ts` | `getDb()` — pool init + boot-time DDL migration (one transaction) |
| `src/lib/auth.ts` | NextAuth v5 config (magic-link + optional Google) |
| `src/lib/invites.ts` | Invite token issuance, lookup, atomic redemption |
| `src/lib/municipality-registry.ts` | Config-driven registry for 30 municipalities across 7 regions |
| `src/lib/collector.ts` | Collection phase functions called by `worker.ts` |
| `worker.ts` | Resonate durable worker (daily collection workflow) |
| `fly.toml` | Fly.io config for webui (app `tamrack-webui`, `yyz`) |
| `fly.worker.toml` | Fly.io config for collector worker (app `tamrack-collector-worker`, `yyz`) |
| `docs/skill-page-creation.md` | Step-by-step guide for adding new dashboard pages |
| `docs/skill-design-system.md` | Component patterns, category colors, typography scale |

## Run

```bash
npm run dev
```

Owner prefers to start dev servers themselves — don't auto-start.

## Rules

- This is a **public, deployed application**. Every change goes live on merge to `main`.
- Don't break the build. Run `npx tsc --noEmit` to type-check; the full `npm run build` is run by CI.
- Don't hardcode municipality data. Use the registry (`src/lib/municipality-registry.ts`).
- Prefer live API calls over static data. If an upstream is down, that's what the fallback layer is for.
- All writes must use UPSERT (`ON CONFLICT ... DO UPDATE`), not plain INSERT — a UNIQUE violation under Resonate retry loops forever.
- `substrate.observations` uses `NULLS NOT DISTINCT` on the unique constraint. Bulk inserts with multiple NULL-entity rows for the same `(series_id, period, geo_id)` will conflict; dedupe before inserting or use per-row inserts for the NULL-entity case.

## Privacy

CI workflow at `.github/workflows/privacy.yml` enforces no credentials or internal references on push and PR. Pre-commit hook (gitleaks + workspace-crumbs check) runs locally via `core.hooksPath`.

Never put private financial data, credentials, or PII into this codebase.
