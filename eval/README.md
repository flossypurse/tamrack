# Tamrack Eval Harness

**Status:** Design locked. Question history wiped (clean slate). Harness not yet built.
**Last updated:** 2026-06-10

---

## The question this harness answers

> Is Tamrack actually telling us anything?

Tamrack is a thin-ish layer over *public* Alberta data (StatsCan, BoC, CKAN, ArcGIS,
CER, IRCC, CMHC, ECCC, WCB, Socrata, CanadaBuys, Job Bank…). So the only honest test
of whether it's "working" is:

> **Tamrack works only if its MCP endpoint/API returns answers you could NOT get by
> (a) searching the internet, or (b) just pulling the same public data live yourself.**

Everything below operationalizes that one sentence.

---

## The metric: differential insight over a baseline

We don't score Tamrack in a vacuum. We score it *against what you could get without it.*
Three baselines, in increasing strength:

| Baseline | Allowed to use | Maps to Cully's phrase |
|----------|----------------|------------------------|
| **A1** | LLM memory only | (the floor) |
| **A2** | LLM + web search | "searching the internet" |
| **A3** | LLM + web + **live calls to the same public APIs Tamrack uses** | "just pulling live data from" |

**A3 is the bar that matters.** It's a strong, adversarial baseline: an agent allowed
to hit StatsCan/BoC/CKAN/CER directly. Tamrack only has a real moat where it beats A3 —
which should be its *derived* signals (`tamrack_leads` demand-heat, `tamrack_hiring`
month-over-month momentum, the Spruce Grove licence-proxy, cross-domain composites).
Where Tamrack only beats A1/A2, the value is "assembly convenience" — real, but weaker.

---

## Two scoring axes (a question must pass both)

For each question, after running the arms, a judge agent sees the question, every arm's
answer, **and Tamrack's raw tool envelopes**, and scores:

### Axis 1 — Faithfulness (0–1)
Does Tamrack's answer match the data it actually pulled? A beautiful answer with
hallucinated numbers fails here. **Partly built already:** `smart_dashboards.truthfulness_score`
+ `truthfulness_verdict` is a Haiku judge that does exactly this — reuse it
(see `scripts/backfill-truthfulness.ts`).

### Axis 2 — Differential insight (0–3)
- **0** — A baseline answered as well or better. Tamrack added nothing.
- **1** — Tamrack only added freshness/convenience over a *single* public source A could also hit.
- **2** — Tamrack assembled something A couldn't easily: multi-source join, a continuous
  historical series, neighbourhood-level granularity.
- **3** — Tamrack produced a **derived signal** no search can return.

**Pass = faithful ≥ 0.9 AND differential ≥ 2.**
**"Tamrack is working" = median differential ≥ 2 across the set, faithfulness ≥ 0.9.**
Any tool whose questions all land at 0–1 is dead weight — that's the harness earning its keep.

---

## Architecture

```
                    ┌─────────────────────────────┐
   question  ─────▶ │ Arm B: Tamrack MCP only      │ ──▶ answer + raw tool envelopes
                    └─────────────────────────────┘
                    ┌─────────────────────────────┐
              ─────▶ │ Arm A2: web search only      │ ──▶ answer
                    └─────────────────────────────┘
                    ┌─────────────────────────────┐
              ─────▶ │ Arm A3: web + live public API│ ──▶ answer
                    └─────────────────────────────┘
                                  │
                                  ▼
                    ┌─────────────────────────────┐
                    │ Judge: faithfulness +        │ ──▶ {faithful, differential, why}
                    │        differential vs A2/A3 │
                    └─────────────────────────────┘
```

**Evaluate the MCP/API layer first** — the raw data substrate. If the data isn't
differential, no planner/composer polish saves it. Wrapping the full Smart UI pipeline
(planner → composer) is **phase 2**: a separate question — "does the product *surface*
the insight well," not "is the insight there."

Implementation target: `scripts/eval-harness.ts` (or a Workflow for parallel fan-out
across questions × arms) → writes `eval/runs/<date>.json` + a markdown scorecard you can
diff over time as the corpus grows.

---

## The question set (`eval/questions.json` — to build)

The question set *is* the eval; the runner is mechanical once the questions are right.
~40–60 questions, version-controlled, each tagged:

```jsonc
{
  "id": "macro-unemployment-5y",
  "question": "alberta unemployment last 5 years",
  "domain": "macro",
  "expected_tools": ["tamrack_macro"],
  "geography": "province",
  "composition": "single-tool",
  "expected_tier": 1            // honest prior: this is googleable, a trap
}
```

Stratify across:
- **All 19 MCP tools** — so coverage gaps surface (`tamrack_catalog`, `tamrack_municipality`,
  `tamrack_regional`, `tamrack_real_estate`, `tamrack_macro`, `tamrack_housing`,
  `tamrack_business`, `tamrack_energy`, `tamrack_search`, `tamrack_entities`,
  `tamrack_opportunities`, `tamrack_hiring`, `tamrack_leads`, `tamrack_immigration`,
  `tamrack_health`, `tamrack_safety`, `tamrack_politics`, `tamrack_fiscal`, `tamrack_environment`).
- **Geography** — province / region / municipality / neighbourhood (granularity is a real edge).
- **Composition** — single-tool vs multi-tool joins.
- **Deliberate Tier-0/1 traps** — questions a generic LLM nails. If the harness scores
  those *high* differential, the harness is broken, not Tamrack.

---

## Progress log

- **2026-06-10**
  - Mapped the system: "asking Tamrack" = rows in `smart_dashboards` (query, plan, config,
    tool_args, cost, `truthfulness_score`) + `smart_query_events` (telemetry: tokens, cost, outcome).
  - Found only existing eval = the `truthfulness_score` Haiku judge + one normalizer regression
    test. **No differential/baseline eval exists** — that's the gap this harness fills.
  - **Wiped the question history for a clean slate** (authorized: "everything — true clean slate"):
    deleted 8 `smart_query_events` + 6 `smart_dashboards` on prod `postgres`. Verified both at 0.
    Preserved seeded story-template infra (`corpus.narrative_fragments`, `corpus.chart_templates`) —
    those are infrastructure, not questions. `corpus.dashboard_promotions` was already empty.
  - Locked the design above.

### Next
1. **Draft `eval/questions.json`** — the designed question set (the recommended next step;
   the question set is the eval).
2. Build `scripts/eval-harness.ts` — 3 arms + judge, emit dated scorecard.
3. Run once against live Tamrack; read first scorecard; see where it beats A3.
4. Phase 2: wrap the full Smart UI pipeline (planner → composer).

---

## Ops note — running anything against the prod DB

Prod Crunchy Bridge is **firewalled to Fly only** — direct connections from a laptop time
out. Run DB ops from inside the Fly app (node 22 + `pg` live in `/app`,
`DATABASE_URL` is a secret there):

```bash
# pattern: base64 a node script in, decode + run in /app so pg resolves
B64=$(base64 < /tmp/script.js | tr -d '\n')
{ printf '%s\n' "printf '%s' '$B64' | base64 -d > /app/_x.js" \
                "cd /app && node _x.js; rm -f /app/_x.js" "exit"; } \
  | flyctl ssh console -a tamrack-webui
```
