"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, Code, ArrowRight, X } from "lucide-react";
import {
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  type ChartCategory,
  type ChartMeta,
} from "@/lib/chart-registry";

const FREQUENCY_LABELS: Record<string, string> = {
  realtime: "Real-time",
  hourly: "Hourly",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
};

export function ChartCatalogueFilter({ charts }: { charts: ChartMeta[] }) {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ChartCategory | null>(null);

  const filtered = useMemo(() => {
    let result = charts;
    if (selectedCategory) {
      result = result.filter((c) => c.category === selectedCategory);
    }
    if (query.trim()) {
      const terms = query.toLowerCase().trim().split(/\s+/);
      result = result.filter((c) => {
        const haystack = `${c.title} ${c.description} ${c.subcategory} ${c.tags.join(" ")} ${c.source}`.toLowerCase();
        return terms.every((t) => haystack.includes(t));
      });
    }
    return result;
  }, [charts, query, selectedCategory]);

  // Group filtered results by category then subcategory
  const grouped = useMemo(() => {
    const cats = new Map<ChartCategory, Map<string, ChartMeta[]>>();
    for (const c of filtered) {
      if (!cats.has(c.category)) cats.set(c.category, new Map());
      const subs = cats.get(c.category)!;
      if (!subs.has(c.subcategory)) subs.set(c.subcategory, []);
      subs.get(c.subcategory)!.push(c);
    }
    return cats;
  }, [filtered]);

  const categories = Object.keys(CATEGORY_LABELS) as ChartCategory[];

  return (
    <div>
      {/* Search + filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search charts... (e.g. housing, GDP, calgary)"
            className="w-full pl-9 pr-8 py-2.5 bg-card border border-card-border rounded-lg text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent transition-colors"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`shrink-0 text-xs px-3 py-2 rounded-lg border transition-colors ${
              !selectedCategory
                ? "bg-accent/10 text-accent border-accent/30"
                : "text-muted border-card-border hover:border-accent/30"
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
              className={`shrink-0 text-xs px-3 py-2 rounded-lg border transition-colors ${
                selectedCategory === cat
                  ? CATEGORY_COLORS[cat]
                  : "text-muted border-card-border hover:border-accent/30"
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-muted mb-6">
        {filtered.length === charts.length
          ? `Showing all ${charts.length} charts`
          : `${filtered.length} of ${charts.length} charts`}
      </p>

      {/* Chart grid by category */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted text-sm">No charts match your search.</p>
          <button
            onClick={() => {
              setQuery("");
              setSelectedCategory(null);
            }}
            className="text-accent text-sm mt-2 hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-10">
          {Array.from(grouped.entries()).map(([category, subcats]) => (
            <section key={category} id={category}>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${CATEGORY_COLORS[category].split(" ")[0]}`}
                />
                {CATEGORY_LABELS[category]}
                <span className="text-xs text-muted font-normal">
                  {Array.from(subcats.values()).reduce((sum, arr) => sum + arr.length, 0)}
                </span>
              </h2>

              {Array.from(subcats.entries()).map(([subcategory, subCharts]) => (
                <div key={subcategory} className="mb-6">
                  <h3 className="text-xs font-medium text-muted uppercase tracking-wider mb-3">
                    {subcategory}
                  </h3>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {subCharts.map((chart) => (
                      <Link
                        key={chart.id}
                        href={`/charts/${chart.id}`}
                        className="group bg-card border border-card-border rounded-xl p-4 hover:border-accent transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="text-sm font-medium text-foreground leading-tight pr-2 group-hover:text-accent transition-colors">
                            {chart.title}
                          </h4>
                          <ArrowRight
                            size={14}
                            className="text-muted/30 group-hover:text-accent transition-colors shrink-0 mt-0.5"
                          />
                        </div>
                        <p className="text-xs text-muted leading-relaxed mb-3 line-clamp-2">
                          {chart.description}
                        </p>
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[chart.category]}`}
                          >
                            {CATEGORY_LABELS[chart.category]}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted/50 font-mono">
                              {FREQUENCY_LABELS[chart.updateFrequency] || chart.updateFrequency}
                            </span>
                            <Code size={10} className="text-muted/30" />
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
