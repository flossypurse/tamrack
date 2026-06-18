"use client";

/**
 * StalenessStamp — "Data as of [date]" temporal validity marker.
 *
 * Stale condition: signal_period is more than 90 days before today.
 * When stale: amber left-border + amber text (data-signal color).
 * When fresh: var(--mid) text, no border.
 * No transitions — brand rule prohibits animations on disclosure elements.
 */

interface StalenessStampProps {
  /** ISO date string of the signal period (e.g. "2026-05-01"). */
  period: string;
}

const STALE_THRESHOLD_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

function isStale(period: string): boolean {
  const periodMs = Date.parse(period);
  if (!Number.isFinite(periodMs)) return false;
  return Date.now() - periodMs > STALE_THRESHOLD_MS;
}

function formatPeriod(period: string): string {
  const d = new Date(period);
  if (Number.isNaN(d.getTime())) return period;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function StalenessStamp({ period }: StalenessStampProps) {
  const stale = isStale(period);

  return (
    <span
      className="text-[10px] tracking-[0.10em] pl-1.5"
      style={{
        fontFamily: "var(--font-mono)",
        color: stale ? "var(--amber)" : "var(--mid)",
        borderLeft: stale ? "2px solid var(--amber)" : "none",
      }}
    >
      Data as of {formatPeriod(period)}
      {stale && " · may be outdated"}
    </span>
  );
}
