"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, BarChart3 } from "lucide-react";
import type { ElementType } from "react";
import { searchCharts } from "@/lib/chart-registry";

export type CommandItem = {
  href: string;
  label: string;
  section: string;
  icon: ElementType;
};

interface CommandPaletteProps {
  items: CommandItem[];
}

export function CommandPalette({ items }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Cmd+K / Ctrl+K to toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Filter items
  const filteredNavItems = query.length === 0
    ? items
    : items.filter((item) => {
        const q = query.toLowerCase();
        return (
          item.label.toLowerCase().includes(q) ||
          item.section.toLowerCase().includes(q)
        );
      });

  // Chart search results (only when query is 2+ chars)
  const chartResults = query.length >= 2
    ? searchCharts(query).slice(0, 10)
    : [];

  const totalResults = filteredNavItems.length + chartResults.length;

  // Clamp selection
  useEffect(() => {
    if (selectedIndex >= totalResults) {
      setSelectedIndex(Math.max(0, totalResults - 1));
    }
  }, [totalResults, selectedIndex]);

  // Scroll selected into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const el = list.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  const getHrefAtIndex = useCallback(
    (index: number): string | undefined => {
      if (index < filteredNavItems.length) {
        return filteredNavItems[index].href;
      }
      const chartIndex = index - filteredNavItems.length;
      if (chartIndex < chartResults.length) {
        return `/charts/${chartResults[chartIndex].id}`;
      }
      return undefined;
    },
    [filteredNavItems, chartResults]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, totalResults - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const href = getHrefAtIndex(selectedIndex);
      if (href) navigate(href);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Panel */}
      <div className="relative w-full max-w-lg mx-4 bg-card border border-card-border rounded-xl shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-card-border">
          <Search size={18} className="text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search pages, charts, municipalities..."
            className="flex-1 bg-transparent text-foreground text-sm outline-none placeholder:text-muted/60"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-foreground/[0.06] text-[10px] text-muted font-mono">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-2">
          {totalResults === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">
              No results for &ldquo;{query}&rdquo;
            </p>
          ) : (
            <>
              {filteredNavItems.length > 0 && (
                <div>
                  {chartResults.length > 0 && (
                    <div className="text-[10px] text-muted/60 uppercase tracking-wider px-4 py-1.5 font-medium">Pages</div>
                  )}
                  {filteredNavItems.map((item, i) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.href}
                        onClick={() => navigate(item.href)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                          i === selectedIndex
                            ? "bg-accent/10 text-accent"
                            : "text-foreground hover:bg-foreground/[0.04]"
                        }`}
                      >
                        <Icon
                          size={16}
                          className={i === selectedIndex ? "text-accent" : "text-muted"}
                        />
                        <span className="flex-1 truncate">{item.label}</span>
                        <span className="text-[11px] text-muted/60 truncate max-w-[120px]">
                          {item.section}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              {chartResults.length > 0 && (
                <div>
                  <div className="text-[10px] text-muted/60 uppercase tracking-wider px-4 py-1.5 font-medium">Charts</div>
                  {chartResults.map((chart, ci) => {
                    const globalIndex = filteredNavItems.length + ci;
                    return (
                      <button
                        key={chart.id}
                        onClick={() => navigate(`/charts/${chart.id}`)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                          globalIndex === selectedIndex
                            ? "bg-accent/10 text-accent"
                            : "text-foreground hover:bg-foreground/[0.04]"
                        }`}
                      >
                        <BarChart3
                          size={16}
                          className={globalIndex === selectedIndex ? "text-accent" : "text-muted"}
                        />
                        <div className="flex-1 min-w-0">
                          <span className="truncate block">{chart.title}</span>
                        </div>
                        <span className="text-[11px] text-muted/60 truncate max-w-[140px]">
                          {chart.subcategory}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Inline search input for mobile drawer */
export function InlineSearch({
  items,
  onNavigate,
}: {
  items: CommandItem[];
  onNavigate: (href: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const filteredNav =
    query.length === 0
      ? []
      : items.filter((item) => {
          const q = query.toLowerCase();
          return (
            item.label.toLowerCase().includes(q) ||
            item.section.toLowerCase().includes(q)
          );
        });

  const inlineChartResults = query.length >= 2
    ? searchCharts(query).slice(0, 8)
    : [];

  const showResults = focused && query.length > 0;
  const hasResults = filteredNav.length > 0 || inlineChartResults.length > 0;

  return (
    <div className="relative px-3 py-3 border-b border-card-border">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-foreground/[0.04] border border-card-border">
        <Search size={14} className="text-muted shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Search pages, charts..."
          className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted/60"
        />
      </div>

      {showResults && (
        <div className="absolute left-3 right-3 top-full mt-1 bg-card border border-card-border rounded-lg shadow-lg max-h-64 overflow-y-auto z-50">
          {!hasResults ? (
            <p className="px-3 py-4 text-xs text-muted text-center">No results</p>
          ) : (
            <>
              {filteredNav.length > 0 && (
                <div>
                  {inlineChartResults.length > 0 && (
                    <div className="text-[10px] text-muted/60 uppercase tracking-wider px-3 py-1 font-medium">Pages</div>
                  )}
                  {filteredNav.slice(0, 8).map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.href}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setQuery("");
                          onNavigate(item.href);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm text-foreground hover:bg-foreground/[0.04] transition-colors"
                      >
                        <Icon size={14} className="text-muted" />
                        <span className="flex-1 truncate">{item.label}</span>
                        <span className="text-[10px] text-muted/60">{item.section}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {inlineChartResults.length > 0 && (
                <div>
                  <div className="text-[10px] text-muted/60 uppercase tracking-wider px-3 py-1 font-medium">Charts</div>
                  {inlineChartResults.map((chart) => (
                    <button
                      key={chart.id}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setQuery("");
                        onNavigate(`/charts/${chart.id}`);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm text-foreground hover:bg-foreground/[0.04] transition-colors"
                    >
                      <BarChart3 size={14} className="text-muted" />
                      <span className="flex-1 truncate">{chart.title}</span>
                      <span className="text-[10px] text-muted/60">{chart.subcategory}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
