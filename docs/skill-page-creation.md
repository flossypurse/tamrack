# Skill: Creating New Tamrack Pages

(Historically "Alberta Pulse". Rebrand in progress.)

Step-by-step guide for adding a new data page to the Tamrack dashboard. Follow this exactly to maintain visual and structural consistency.

## When to use
- Adding a new page to any category
- Creating a new municipality page template
- Adding a new briefing role

## Step 1: Determine the category

Every page belongs to exactly one category:
- `overview` — Dashboard, Signals, Briefings
- `economy` — Macro economic indicators (energy, labour, agriculture, etc.)
- `realestate` — Property market data (market, pipeline, rental, etc.)
- `intelligence` — Analytical/synthesis pages (benchmarks, risk, corridors, etc.)
- `environment` — Natural world data (weather, air quality, water, wildfire)
- `safety` — Civic/safety data (traffic, seismic, emergencies, elections)
- `municipalities` — Local community data (directory, coverage, individual pages)
- `tools` — Reference and utility (learn, docs, sources, account, billing)

## Step 2: Create the file

```
src/app/{category-path}/{page-name}/page.tsx
```

## Step 3: Page template

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import { IconName } from "lucide-react";

export const metadata: Metadata = {
  title: "Page Title — Alberta Pulse",
  description: "One sentence for SEO.",
};

// ============================================================
// Server-side data fetching
// ============================================================

async function getData() {
  // Fetch from data-sources.ts
}

// ============================================================
// Loading fallback
// ============================================================

function LoadingCard() {
  return (
    <Card>
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-card-border rounded w-1/3" />
        <div className="h-[200px] bg-card-border/50 rounded" />
      </div>
    </Card>
  );
}

// ============================================================
// Data display components (server components)
// ============================================================

async function MyDataSection() {
  const data = await getData();
  // render cards, charts, tables
}

// ============================================================
// Page
// ============================================================

export default function PageName() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Page Title"
        description="What this page shows and why it matters."
        category="economy"  // ← use correct category
        icon={<IconName size={20} />}
      />

      {/* Key metrics row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Suspense fallback={<LoadingCard />}>
          <MetricCard title="Metric" value="123" source="Source" />
        </Suspense>
      </div>

      {/* Section 1 */}
      <section className="space-y-4">
        <SectionHeader
          title="Section Name"
          icon={<IconName size={16} />}
          category="economy"  // ← same category
        />
        <div className="grid md:grid-cols-2 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <MyDataSection />
          </Suspense>
        </div>
      </section>

      {/* Section 2 */}
      <section className="space-y-4">
        <SectionHeader
          title="Another Section"
          icon={<IconName size={16} />}
          category="economy"
        />
        {/* ... */}
      </section>
    </main>
  );
}
```

## Step 4: Add to navigation

Edit `src/components/nav.tsx` and add the new page to the correct category section.

## Step 5: Data sources

If the page needs new data:
1. Add fetch functions to the appropriate data-sources file:
   - `src/lib/data-sources.ts` (general, BoC, StatsCan, Edmonton)
   - `src/lib/data-sources-regional.ts` (regionaldashboard.alberta.ca)
   - `src/lib/data-sources-cer.ts` (CER pipeline/energy)
   - `src/lib/data-sources-aeso.ts` (AESO electricity)
   - `src/lib/data-sources-ircc.ts` (immigration)
   - `src/lib/data-sources-infrastructure.ts` (infrastructure projects)
2. Add an API route if the data needs client-side fetching: `src/app/api/{name}/route.ts`

## Rules

1. **Always use `PageHeader`** — never write raw h1 tags
2. **Always use `SectionHeader`** — never write raw h2 section dividers
3. **Always use `Card`/`CardHeader`/`MetricCard`** — never write raw card wrappers
4. **Category must be consistent** — PageHeader and all SectionHeaders on the same page use the same category
5. **Typography scale is locked** — see design-system skill for the exact scale
6. **Grid gap is always `gap-4`** — no exceptions
7. **Wrap async sections in `<Suspense>`** with `<LoadingCard />` fallback
8. **Server components by default** — only add `"use client"` if the component needs interactivity
9. **All data fetching must have `.catch(() => fallback)`** — never let a failed API break the page
10. **Source attribution** — use `source` prop on MetricCard or `text-[10px] text-muted/60 font-mono` for inline attribution

## Briefing sub-page template

Briefing pages follow a different structure — they're narrative-focused with signal cards:

```tsx
<main className="min-h-screen p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
  {/* Breadcrumb */}
  <Link href="/overview/briefing" className="text-xs text-muted hover:text-accent">
    ← All Briefings
  </Link>

  <PageHeader
    title="Investor Briefing"
    description="Data-driven market intelligence for investors."
    category="overview"
    icon={<TrendingUp size={20} />}
  >
    <p className="text-[10px] text-muted/60 font-mono">
      Generated {new Date().toLocaleDateString("en-CA")}
    </p>
  </PageHeader>

  {/* Signal cards in single column */}
  <Suspense fallback={<LoadingCard />}>
    <SignalContent />
  </Suspense>
</main>
```

Note: briefing pages use `max-w-3xl` (not `max-w-7xl`) for a narrower reading column.

## Municipality page template

Individual municipality pages (`/municipalities/[slug]`) are config-driven via `src/lib/municipality-registry.ts`. To add a new municipality:

1. Add config to the registry with endpoints, fields, capabilities
2. Set `status: "live"` when endpoints are verified
3. The page at `src/app/municipalities/[slug]/page.tsx` handles rendering automatically
