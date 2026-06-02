"use client";

/**
 * SampleSizeBadge — renders when n < 30 to flag low-sample conditions.
 *
 * Amber text + hairline border when the warning is active.
 * Renders nothing when n >= 30 (no UI noise on healthy samples).
 * Amber is reserved for data-signal state only (not UI affordance).
 */

interface SampleSizeBadgeProps {
  n: number;
}

export function SampleSizeBadge({ n }: SampleSizeBadgeProps) {
  if (n >= 30) return null;

  return (
    <span
      className="inline-flex items-center border border-[var(--hairline)] px-1.5 py-0.5 text-[10px] tracking-[0.12em] uppercase"
      style={{
        fontFamily: "var(--font-mono)",
        color: "var(--amber)",
        borderColor: "var(--amber)",
      }}
    >
      n={n} · small sample
    </span>
  );
}
