"use client";

/**
 * DataBindingPanel — collapsible <details> disclosure for data source info.
 *
 * Rendered in the chart card header right side.
 * Closed by default. Mono summary text. No transitions on disclosure elements.
 * Brand: hairline border, mono font, var(--mid) color.
 */

import type { StoryCard } from "@/lib/smart-ui/types";

interface DataBindingPanelProps {
  card: Pick<StoryCard, "data_ref" | "template_slug" | "trust">;
}

export function DataBindingPanel({ card }: DataBindingPanelProps) {
  return (
    <details
      className="text-[10px]"
      style={{ fontFamily: "var(--font-mono)" }}
    >
      <summary
        className="cursor-pointer tracking-[0.12em] uppercase border border-[var(--hairline)] px-2 py-0.5 list-none select-none"
        style={{ color: "var(--mid)" }}
      >
        data source
      </summary>
      <div
        className="mt-1 border border-[var(--hairline)] p-2 text-[10px] leading-relaxed"
        style={{ color: "var(--mid)" }}
      >
        <div className="flex flex-col gap-0.5">
          <span>
            <span className="uppercase tracking-[0.10em]">template</span>{" "}
            {card.template_slug}
          </span>
          <span>
            <span className="uppercase tracking-[0.10em]">data ref</span>{" "}
            {card.data_ref}
          </span>
          {card.trust.signal_period && (
            <span>
              <span className="uppercase tracking-[0.10em]">period</span>{" "}
              {card.trust.signal_period}
            </span>
          )}
          {card.trust.normalization_note && (
            <span>
              <span className="uppercase tracking-[0.10em]">normalization</span>{" "}
              {card.trust.normalization_note}
            </span>
          )}
          {card.trust.whole_definition && (
            <span>
              <span className="uppercase tracking-[0.10em]">whole</span>{" "}
              {card.trust.whole_definition}
            </span>
          )}
        </div>
      </div>
    </details>
  );
}
