"use client";

/**
 * Pre-fill skeleton for the Smart UI.
 *
 * The page renders this as soon as the "plan" SSE event arrives — before
 * any tool result comes back. One pulse-block per planned card_title.
 */

interface SkeletonProps {
  intent: string;
  cardTitles: string[];
}

export function SmartUiSkeleton({ intent, cardTitles }: SkeletonProps) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm uppercase tracking-wider text-[var(--muted)]">
          Building dashboard
        </p>
        <h2 className="text-xl font-semibold mt-1">{intent}</h2>
      </div>
      <div className="flex flex-col gap-4">
        {cardTitles.map((title, idx) => (
          <div
            key={idx}
            className="rounded-lg border border-[var(--card-border)] bg-[var(--card)] p-5"
          >
            <div className="text-sm text-[var(--muted)]">{title}</div>
            <div className="mt-3 h-32 w-full animate-pulse rounded bg-[var(--grid)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
