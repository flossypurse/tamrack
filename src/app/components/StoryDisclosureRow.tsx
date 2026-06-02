"use client";

/**
 * StoryDisclosureRow — mandatory trust-disclosure bar for story cards.
 *
 * All seven elements render in every story block. None are configurable off.
 * Position: below the chart (or below body if chart is null).
 * Brand rules: mono font, var(--mid) default color, hairline borders,
 * amber only for data-signal warnings (n < 30, staleness). No transitions.
 */

import type { StoryTrust } from "@/lib/smart-ui/types";

import { DerivedSignalLabel } from "./disclosure/DerivedSignalLabel";
import { SampleSizeBadge } from "./disclosure/SampleSizeBadge";
import { SourceCitationBlock } from "./disclosure/SourceCitationBlock";
import { StalenessStamp } from "./disclosure/StalenessStamp";

interface StoryDisclosureRowProps {
  trust: StoryTrust;
}

export function StoryDisclosureRow({ trust }: StoryDisclosureRowProps) {
  return (
    <div
      className="mt-3 pt-3 border-t border-[var(--hairline)] flex flex-wrap items-center gap-x-4 gap-y-1.5"
      style={{ fontFamily: "var(--font-mono)" }}
    >
      <SampleSizeBadge n={trust.sample_n} />
      <DerivedSignalLabel signals={trust.derived_signals} />
      <StalenessStamp period={trust.signal_period} />
      <SourceCitationBlock sources={trust.sources} />
    </div>
  );
}
