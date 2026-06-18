import type { Metadata } from "next";
import {
  CHART_REGISTRY,
  CATEGORY_LABELS,
  type ChartCategory,
} from "@/lib/chart-registry";
import { ChartCatalogueFilter } from "./catalogue-filter";
import { SITE_URL } from "@/lib/constants/site";

export const metadata: Metadata = {
  title: "Chart Catalogue — Tamrack",
  description:
    "Browse 110+ live data charts covering Alberta's economy, real estate, community, and environment. Free to embed, share, and explore.",
  alternates: { canonical: `${SITE_URL}/charts` },
  openGraph: {
    title: "Chart Catalogue — Tamrack",
    description:
      "Browse 110+ live data charts covering Alberta's economy, real estate, community, and environment.",
    images: [
      {
        url: "/api/og?title=Chart+Catalogue&subtitle=110%2B+live+Alberta+data+charts",
        width: 1200,
        height: 630,
      },
    ],
  },
};

function getCategoryStats(): { category: ChartCategory; label: string; count: number }[] {
  const stats = new Map<ChartCategory, number>();
  for (const c of CHART_REGISTRY) {
    stats.set(c.category, (stats.get(c.category) || 0) + 1);
  }
  return Array.from(stats.entries()).map(([category, count]) => ({
    category,
    label: CATEGORY_LABELS[category],
    count,
  }));
}

export default function ChartCataloguePage() {
  const categoryStats = getCategoryStats();
  const sourceCount = new Set(CHART_REGISTRY.map((c) => c.source)).size;

  return (
    <main className="px-4 sm:px-6 py-10 sm:py-14 max-w-6xl mx-auto">
      {/* Header — T3 terminal voice, matches landing-page register */}
      <header className="mb-10 sm:mb-12 space-y-5">
        <p className="font-mono text-[11px] tracking-[0.18em] uppercase text-[var(--mid)]">
          tamrack · catalogue · v0
        </p>
        <h1 className="font-mono font-extrabold text-3xl sm:text-4xl leading-[1.0] tracking-tight text-[var(--ink)]">
          <span className="text-[var(--amber)]">&gt;</span> the catalogue.
        </h1>
        <p className="text-[var(--ink)]/85 text-base sm:text-lg leading-relaxed max-w-2xl">
          {CHART_REGISTRY.length} live data charts pulled from {sourceCount}+ government
          sources.{" "}
          <span className="text-[var(--mid)]">
            This is the open layer — every chart here is public, free to embed
            and free to share. The agent that turns a plain-English question
            into a chart like these is invite-only.
          </span>
        </p>
      </header>

      {/* Hairline section break + jump index */}
      <div className="border-t border-[var(--hairline)] pt-6 mb-8">
        <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--mid)] mb-3">
          jump to section
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {categoryStats.map((s) => (
            <a
              key={s.category}
              href={`#${s.category}`}
              className="group inline-flex items-baseline gap-2 text-sm text-[var(--ink)] underline underline-offset-4 decoration-[var(--hairline)] hover:decoration-[var(--ink)] transition-colors"
              style={{ transitionDuration: "var(--dur-instant)" }}
            >
              <span className="font-medium">{s.label}</span>
              <span className="font-mono text-[11px] text-[var(--mid)]">
                {s.count.toString().padStart(3, "0")}
              </span>
            </a>
          ))}
        </div>
      </div>

      <ChartCatalogueFilter charts={CHART_REGISTRY} />
    </main>
  );
}
