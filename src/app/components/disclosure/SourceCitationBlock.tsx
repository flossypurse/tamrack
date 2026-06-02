"use client";

/**
 * SourceCitationBlock — source chips with hover underline.
 *
 * Renders nothing when sources array is empty.
 * Mono var(--mid); hover shows underline (CSS only, no JS transitions).
 * Each chip is a chip-shaped span (no link if no URL is provided).
 */

interface SourceCitationBlockProps {
  sources: string[];
}

export function SourceCitationBlock({ sources }: SourceCitationBlockProps) {
  if (sources.length === 0) return null;

  return (
    <span
      className="flex flex-wrap items-center gap-1.5"
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {sources.map((source, i) => (
        <span
          key={i}
          className="text-[10px] tracking-[0.10em] border border-[var(--hairline)] px-1.5 py-0.5 cursor-default hover:underline"
          style={{ color: "var(--mid)" }}
        >
          {source}
        </span>
      ))}
    </span>
  );
}
