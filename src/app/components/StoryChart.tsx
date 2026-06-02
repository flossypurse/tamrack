"use client";

/**
 * StoryChart — Vega-Lite story renderer.
 *
 * Wraps vega-embed with renderer:"svg" (mandatory — Canvas softens edges,
 * SVG preserves the sharp-edge brand requirement). The chart fills its
 * container width via Vega-Lite "width": "container".
 *
 * This component only renders the chart area. Trust disclosure and null
 * states are handled by sibling components (StoryDisclosureRow, NullStateCard).
 */

import { useEffect, useRef } from "react";

interface StoryChartProps {
  /** Assembled Vega-Lite spec. Null triggers the null-state path. */
  spec: Record<string, unknown> | null;
  /** Accessible label for the chart container. */
  ariaLabel?: string;
}

export function StoryChart({ spec, ariaLabel }: StoryChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Track the current vega-embed view for cleanup.
  const viewRef = useRef<{ finalize: () => void } | null>(null);

  useEffect(() => {
    if (!spec || !containerRef.current) return;

    let cancelled = false;

    async function embed() {
      // Dynamic import keeps vega-embed out of the server bundle.
      const { default: vegaEmbed } = await import("vega-embed");
      if (cancelled || !containerRef.current) return;

      // Finalize any existing view before mounting a new one.
      if (viewRef.current) {
        viewRef.current.finalize();
        viewRef.current = null;
      }

      try {
        const result = await vegaEmbed(containerRef.current, spec as object, {
          renderer: "svg",
          actions: false,
          // Let the chart fill the container width per brand convention.
          width: "container" as unknown as number,
          config: {
            background: "transparent",
            font: "var(--font-mono)",
            axis: {
              labelFont: "var(--font-mono)",
              titleFont: "var(--font-mono)",
              gridColor: "var(--hairline)",
              tickColor: "var(--hairline)",
              domainColor: "var(--hairline)",
              labelColor: "var(--mid)",
              titleColor: "var(--mid)",
            },
            legend: {
              labelFont: "var(--font-mono)",
              titleFont: "var(--font-mono)",
              labelColor: "var(--mid)",
              titleColor: "var(--mid)",
            },
            title: {
              font: "var(--font-mono)",
              color: "var(--ink)",
            },
          },
        });
        if (!cancelled) {
          viewRef.current = result.view;
        } else {
          result.view.finalize();
        }
      } catch {
        // Render errors are non-fatal; the caller's null-state path handles
        // missing / malformed specs before reaching this component.
      }
    }

    void embed();

    return () => {
      cancelled = true;
      if (viewRef.current) {
        viewRef.current.finalize();
        viewRef.current = null;
      }
    };
  }, [spec]);

  if (!spec) return null;

  return (
    <div
      ref={containerRef}
      aria-label={ariaLabel}
      className="w-full overflow-hidden"
      style={{ fontFamily: "var(--font-mono)" }}
    />
  );
}
