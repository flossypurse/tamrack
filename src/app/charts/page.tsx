import type { Metadata } from "next";
import Link from "next/link";
import { Activity, Search, BarChart3, ArrowRight } from "lucide-react";
import {
  CHART_REGISTRY,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  type ChartCategory,
  type ChartMeta,
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

// Group charts by subcategory for display
function groupBySubcategory(charts: ChartMeta[]): Map<string, ChartMeta[]> {
  const groups = new Map<string, ChartMeta[]>();
  for (const c of charts) {
    const key = c.subcategory;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }
  return groups;
}

// Category stats
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

  return (
    <main className="px-4 sm:px-6 py-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 size={24} className="text-accent" />
          <h1 className="text-2xl sm:text-3xl font-bold">Chart Catalogue</h1>
        </div>
        <p className="text-muted text-sm max-w-2xl">
          {CHART_REGISTRY.length} live data charts from {new Set(CHART_REGISTRY.map((c) => c.source)).size}+ government
          sources. Every chart is free to view, embed, and share.
        </p>
      </div>

      {/* Category summary pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {categoryStats.map((s) => (
          <a
            key={s.category}
            href={`#${s.category}`}
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors hover:opacity-80 ${CATEGORY_COLORS[s.category]}`}
          >
            {s.label}
            <span className="opacity-60">{s.count}</span>
          </a>
        ))}
      </div>

      {/* Client-side filter */}
      <ChartCatalogueFilter charts={CHART_REGISTRY} />
    </main>
  );
}
