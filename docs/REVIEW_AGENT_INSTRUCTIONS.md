# Tamrack — UI/Copy Polish Review

(Historically "Alberta Pulse". Rebrand in progress — public copy still uses the old name until Phase A3 + cutover.)

You are reviewing Tamrack for small, nuanced inconsistencies in copy, UI states, and user-facing messaging. This is not a code quality audit — it's a product polish pass.

## Context

Tamrack is a multi-product SaaS with 4 products at different stages:

| Product | Price | Status |
|---------|-------|--------|
| Pulse Charts | Free | Live |
| Pulse EDO | $299/mo | Live (all 5 features built, settings page placeholder) |
| Pulse Realtor | $49/mo | Live |
| Pulse Learn | Free | Live |

Read `AGENT.md` for full architecture. Key UI paths are under `src/app/`.

## What to look for

### 1. Stale status labels
- "Coming soon", "waitlist", "beta", "preview" on features that are actually built
- Buttons that say "Join waitlist" or "Notify me" for live products
- Placeholder text like "Lorem ipsum" or "TODO"

### 2. Dead or mismatched links
- CTAs pointing to `/waitlist/*` for products that are live (should go to onboarding or the product itself)
- Nav items linking to placeholder pages when real pages exist
- Broken internal links (href to routes that don't exist)

### 3. Copy inconsistencies
- Product names that don't match (e.g., "EDO Tool" vs "Pulse EDO")
- Inconsistent pricing references across pages
- Feature descriptions on marketing pages that don't match what's actually built
- Mismatched municipality counts or data source counts between pages

### 4. Empty states and placeholders
- Pages that render "No data" or empty cards when they should show content
- Skeleton loaders that never resolve (missing data fetch)
- Settings or config pages with only placeholder text

### 5. Auth/subscription gating mismatches
- Pages accessible without login that should be gated
- "Sign up" CTAs shown to already-logged-in users
- Product features visible to wrong subscription tier

### 6. Mobile/responsive issues in copy
- Text that overflows or truncates awkwardly on mobile
- CTAs hidden behind collapsed navs
- Tab labels that disappear on small screens without indication

## How to review

1. Start with the public-facing pages: landing page, pricing page, product marketing sections
2. Then check each product's internal pages (EDO, Realtor, Learn)
3. Cross-reference marketing claims against actual implemented features
4. Check nav configs (`src/components/nav-config.ts`) against actual routes

## Output format

For each finding, report:
- **File**: path and line number
- **Issue**: what's wrong
- **Fix**: specific change to make (exact old → new text when possible)

Group findings by severity:
1. **Misleading** — user-facing copy that's factually wrong (e.g., "coming soon" for live features)
2. **Inconsistent** — copy that contradicts other pages
3. **Rough edge** — not wrong, but could be polished

## What NOT to flag

- Code style, linting, TypeScript strictness — not the point of this review
- Performance optimizations
- Accessibility (important but separate audit)
- Features that should be added — only flag what's already there but wrong/stale
