"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import {
  CATEGORY_LABELS,
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
      {/* Search + filter bar — sharp, instrument-panel register */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search
            size={14}
            aria-hidden="true"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mid)]"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search the catalogue — e.g. housing, gdp, calgary"
            aria-label="Search charts"
            className="w-full pl-9 pr-9 py-2.5 bg-[var(--surface-elevated)] border border-[var(--hairline)] text-sm text-[var(--ink)] placeholder:text-[var(--mid)]/70 font-mono focus:outline-none focus:border-[var(--amber)] transition-colors"
            style={{ transitionDuration: "var(--dur-instant)" }}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--mid)] hover:text-[var(--ink)] transition-colors"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div
          role="tablist"
          aria-label="Filter charts by category"
          className="flex gap-px overflow-x-auto scrollbar-none border border-[var(--hairline)] bg-[var(--hairline)]"
        >
          <button
            role="tab"
            aria-selected={!selectedCategory}
            onClick={() => setSelectedCategory(null)}
            className={`shrink-0 font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-2.5 transition-colors ${
              !selectedCategory
                ? "bg-[var(--ink)] text-[var(--ink-inv)]"
                : "bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-elevated)]"
            }`}
            style={{ transitionDuration: "var(--dur-instant)" }}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              role="tab"
              aria-selected={selectedCategory === cat}
              onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
              className={`shrink-0 font-mono text-[10px] tracking-[0.18em] uppercase px-3 py-2.5 transition-colors ${
                selectedCategory === cat
                  ? "bg-[var(--ink)] text-[var(--ink-inv)]"
                  : "bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-elevated)]"
              }`}
              style={{ transitionDuration: "var(--dur-instant)" }}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Results count — mono meta line */}
      <p className="font-mono text-[11px] tracking-[0.14em] uppercase text-[var(--mid)] mb-8">
        {filtered.length === charts.length
          ? `showing all ${charts.length} charts`
          : `${filtered.length} / ${charts.length} charts`}
      </p>

      {/* Chart grid by category */}
      {filtered.length === 0 ? (
        <div className="border border-[var(--hairline)] py-16 text-center">
          <p className="font-mono text-[11px] tracking-[0.18em] uppercase text-[var(--mid)] mb-3">
            no matches
          </p>
          <button
            onClick={() => {
              setQuery("");
              setSelectedCategory(null);
            }}
            className="text-sm text-[var(--ink)] hover:text-[var(--amber)] underline underline-offset-4 decoration-[var(--hairline)] hover:decoration-[var(--amber)] transition-colors"
            style={{ transitionDuration: "var(--dur-instant)" }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-14">
          {Array.from(grouped.entries()).map(([category, subcats]) => {
            const sectionCount = Array.from(subcats.values()).reduce(
              (sum, arr) => sum + arr.length,
              0,
            );
            return (
              <section key={category} id={category} className="scroll-mt-16">
                {/* Section header — terminal eyebrow + display weight + count */}
                <div className="border-t border-[var(--hairline)] pt-6 mb-6">
                  <div className="flex items-baseline justify-between gap-4 flex-wrap">
                    <h2 className="font-mono font-extrabold text-xl sm:text-2xl tracking-tight text-[var(--ink)]">
                      <span className="text-[var(--amber)]">&gt;</span>{" "}
                      {CATEGORY_LABELS[category].toLowerCase()}
                    </h2>
                    <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-[var(--mid)]">
                      {sectionCount.toString().padStart(3, "0")} charts
                    </span>
                  </div>
                </div>

                {Array.from(subcats.entries()).map(([subcategory, subCharts]) => (
                  <div key={subcategory} className="mb-10 last:mb-0">
                    <h3 className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--mid)] mb-3 border-l-2 border-[var(--hairline)] pl-3">
                      {subcategory}
                    </h3>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-[var(--hairline)] border border-[var(--hairline)]">
                      {subCharts.map((chart) => (
                        <Link
                          key={chart.id}
                          href={`/charts/${chart.id}`}
                          className="group bg-[var(--surface)] hover:bg-[var(--surface-elevated)] p-4 transition-colors"
                          style={{ transitionDuration: "var(--dur-instant)" }}
                        >
                          <h4 className="font-mono text-sm font-medium text-[var(--ink)] leading-tight group-hover:text-[var(--amber)] transition-colors mb-2">
                            {chart.title}
                          </h4>
                          <p className="text-xs text-[var(--mid)] leading-relaxed mb-3 line-clamp-2">
                            {chart.description}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-[var(--mid)]">
                              {CATEGORY_LABELS[chart.category]}
                            </span>
                            <span className="font-mono text-[10px] text-[var(--mid)]">
                              {FREQUENCY_LABELS[chart.updateFrequency] || chart.updateFrequency}
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
