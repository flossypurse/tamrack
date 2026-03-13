/**
 * DataFreshness — shows "Data as of X ago" badge for live data sections.
 *
 * Server component. Computes staleness based on known revalidation windows.
 * The `fetchedAt` prop should be Date.now() captured at fetch time.
 * If not provided, renders a static label with the revalidation window.
 */

type Tier = "realtime" | "hourly" | "daily";

const TIER_LABELS: Record<Tier, string> = {
  realtime: "Updates every 5 min",
  hourly: "Updates hourly",
  daily: "Updates daily",
};

const TIER_COLORS: Record<Tier, string> = {
  realtime: "bg-accent-green/15 text-accent-green",
  hourly: "bg-accent/15 text-accent",
  daily: "bg-muted/15 text-muted",
};

function timeAgo(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function DataFreshness({
  fetchedAt,
  tier,
  className = "",
}: {
  fetchedAt?: number;
  tier: Tier;
  className?: string;
}) {
  const age = fetchedAt ? timeAgo(Date.now() - fetchedAt) : null;

  return (
    <span
      className={`inline-flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded-full ${TIER_COLORS[tier]} ${className}`}
      title={TIER_LABELS[tier]}
    >
      <span className="w-1 h-1 rounded-full bg-current opacity-60" />
      {age ? `${age}` : TIER_LABELS[tier]}
    </span>
  );
}
