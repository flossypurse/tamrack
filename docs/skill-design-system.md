# Skill: Tamrack Design System

(Historically "Alberta Pulse". Rebrand in progress.)

Enforce visual consistency across all Tamrack webui pages. Every page must follow these rules exactly.

## When to use
- Creating a new page
- Editing an existing page's layout or headers
- Reviewing pages for visual consistency
- Adding new sections to an existing page

## Category Identity

Each page belongs to one category. Categories have unique accent colors that create visual identity when switching between sections.

| Category | Token | Light | Dark | Used by |
|----------|-------|-------|------|---------|
| Overview | `--cat-overview` | `#c06a2b` | `#d4863a` | Dashboard, Signals, Briefings |
| Economy | `--cat-economy` | `#16803c` | `#22c55e` | Energy, Drilling, Cycle, Diversification, Labour, Migration, Agriculture |
| Real Estate | `--cat-realestate` | `#2563eb` | `#60a5fa` | Market, Pipeline, Rental, Prospects, Commercial, Neighbourhoods |
| Intelligence | `--cat-intelligence` | `#7c3aed` | `#a78bfa` | Benchmarks, Corridors, Risk, Invest, Compare |
| Environment | `--cat-environment` | `#0d9488` | `#2dd4bf` | Weather, Air Quality, Water, Wildfire |
| Safety | `--cat-safety` | `#b45309` | `#f59e0b` | Traffic, Seismic, Emergencies, Elections |
| Municipalities | `--cat-municipalities` | `#c06a2b` | `#d4863a` | Municipality directory, coverage, individual pages |
| Tools | `--cat-tools` | `#64748b` | `#94a3b8` | Learn, Docs, Sources, Account, Billing, Admin |

Colors are defined in `src/app/globals.css` as CSS custom properties and registered in the `@theme inline` block as `--color-cat-*` for Tailwind usage.

## Components

### PageHeader (`src/components/page-header.tsx`)

Every page (except landing, pricing, login) MUST use `<PageHeader>` for its top-level title.

```tsx
import { PageHeader } from "@/components/page-header";

<PageHeader
  title="Energy Markets"
  description="Oil, gas, and commodity data for Alberta."
  category="economy"
  icon={<Flame size={20} />}
>
  {/* Optional: badges, filters, extra controls */}
</PageHeader>
```

**What it renders:**
- 2px top border in category color
- Subtle gradient wash from category color (5% opacity)
- Category pill (uppercase, mono, 10px) in category color
- Icon (colored by category) + h1 (`text-xl font-semibold tracking-tight`)
- Description (`text-sm text-muted max-w-2xl`)
- Optional children slot below

**Never do this:**
```tsx
// WRONG — raw h1 with ad-hoc styling
<h1 className="text-2xl font-bold">Energy Markets</h1>

// WRONG — inconsistent sizing
<h1 className="text-xl sm:text-2xl font-bold tracking-tight">...</h1>
```

### SectionHeader (`src/components/section-header.tsx`)

Every section divider (h2) MUST use `<SectionHeader>`.

```tsx
import { SectionHeader } from "@/components/section-header";

<SectionHeader
  title="Oil & Gas Production"
  icon={<Factory size={16} />}
  category="economy"
/>
```

**What it renders:**
- Icon (colored by category) + h2 (`text-sm font-medium text-muted uppercase tracking-wider`)
- `mb-3` spacing below

**Never do this:**
```tsx
// WRONG — non-standard section header
<h2 className="text-lg font-semibold flex items-center gap-2 mb-3">...</h2>

// WRONG — raw h2 without component
<div className="flex items-center gap-2 mb-3">
  <Icon size={16} className="text-muted" />
  <h2 className="text-sm font-medium text-muted uppercase tracking-wider">Title</h2>
</div>
```

## Typography Scale (Locked)

| Element | Classes | Size | Weight |
|---------|---------|------|--------|
| Page title (h1) | `text-xl font-semibold tracking-tight` | 1.25rem | 600 |
| Section header (h2) | `text-sm font-medium text-muted uppercase tracking-wider` | 0.875rem | 500 |
| Card title (h3) | `text-sm font-medium text-foreground` | 0.875rem | 500 |
| Category pill | `text-[10px] font-mono uppercase tracking-widest` | 10px | 400 |
| Large metric | `text-2xl font-semibold tracking-tight` | 1.5rem | 600 |
| Body | `text-sm` | 0.875rem | 400 |
| Label | `text-xs text-muted` | 0.75rem | 400 |
| Micro label | `text-[10px] text-muted/60 font-mono` | 10px | 400 |

**Do not invent new text sizes or weights.** If something doesn't fit this scale, use the closest match.

## Card Pattern (Locked)

```tsx
import { Card, CardHeader, MetricCard } from "@/components/card";

// Standard card
<Card>
  <CardHeader title="Title" subtitle="Optional" badge="LIVE" />
  {/* content */}
</Card>

// Metric card
<MetricCard
  title="Policy Rate"
  value="3.25%"
  change="-0.25%"
  changeLabel="vs last month"
  source="Bank of Canada"
/>
```

Card structure: `bg-card border border-card-border rounded-xl p-3 sm:p-5`

## Page Container (Locked)

**Data pages** (dashboards, charts, tables):
```tsx
<main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
  <PageHeader ... />
  {/* sections */}
</main>
```

**Category index pages** (prose-heavy overviews that list sub-pages):
```tsx
<main className="min-h-screen p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
  <PageHeader ... />
  {/* explainer card + page list + jargon box */}
</main>
```

**Briefing sub-pages** (narrative reading):
```tsx
<main className="min-h-screen p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
```

The three widths: `max-w-7xl` (data), `max-w-5xl` (index), `max-w-3xl` (narrative). Spacing is always `space-y-6`. Never use `space-y-8`.

## Grid Patterns

```tsx
// Metric row (2 cols mobile, 4 desktop)
<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

// Content cards (1-2-3 responsive)
<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">

// Two-column split
<div className="grid lg:grid-cols-2 gap-4">
```

Gap is always `gap-4` (16px). Do not use `gap-3`, `gap-6`, or other values for grid gaps.

## Status Badges

```tsx
// Live data
<span className="text-[9px] px-1.5 py-0.5 rounded bg-accent-green/10 text-accent-green">LIVE</span>

// Planned
<span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-500/20 text-muted">PLANNED</span>

// Source tag
<span className="text-[9px] bg-card-border/50 text-muted px-1.5 py-0.5 rounded">{source}</span>
```

## Semantic Colors

- Positive/growth: `text-accent-green`
- Negative/decline: `text-accent-red`
- Warning/caution: `text-accent-amber`
- Neutral/muted: `text-muted`
- Primary action: `text-accent` / `bg-accent`

Do NOT use raw Tailwind colors (like `text-green-500`) for semantic meaning. Use the design tokens.

## Checklist for New Pages

1. Import `PageHeader` and optionally `SectionHeader`
2. Determine the correct `category` for the page
3. Use `PageHeader` as the first child of `<main>`
4. Use `SectionHeader` for every h2-level divider
5. Use `Card` / `CardHeader` / `MetricCard` for all data containers
6. Follow the typography scale exactly
7. Use `gap-4` for all grids
8. Use semantic color tokens, not raw Tailwind colors for status indicators
