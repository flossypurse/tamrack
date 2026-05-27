/**
 * Recent-questions sidebar for /account/chat.
 *
 * Server component. Fetches the most recent N (default 20) saved
 * dashboards for the signed-in user and renders them as a vertical list
 * linking to /d/<slug>. Falls back to truncated query text when the
 * Haiku-generated title hasn't landed yet.
 */
import Link from "next/link";

import {
  listDashboardsForUser,
  type DashboardListItem,
} from "@/lib/smart-ui/persistence";
import { fallbackTitle } from "@/lib/smart-ui/title";

const SIDEBAR_LIMIT = 20;

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export async function ChatHistorySidebar({
  userId,
  currentSlug,
}: {
  userId: string;
  currentSlug?: string;
}) {
  let items: DashboardListItem[] = [];
  try {
    items = await listDashboardsForUser(userId, { limit: SIDEBAR_LIMIT });
  } catch {
    // Don't break the page if the recent list fails to load — the
    // primary surface is the chat input below.
    items = [];
  }

  return (
    <aside className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--mid)]">
          recent
        </p>
        <Link
          href="/account/chat"
          className="font-mono text-[10px] tracking-[0.14em] uppercase text-[var(--mid)] hover:text-[var(--amber)]"
          style={{ transitionDuration: "var(--dur-instant)" }}
        >
          + new
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="font-mono text-[10px] leading-relaxed text-[var(--mid)]/70">
          Your past questions will appear here.
        </p>
      ) : (
        <ul className="flex flex-col">
          {items.map((item) => {
            const isActive = currentSlug && item.slug === currentSlug;
            const label = item.title?.trim() || fallbackTitle(item.query);
            return (
              <li key={item.id}>
                <Link
                  href={`/d/${item.slug}`}
                  className={
                    "flex flex-col gap-0.5 border-l-2 px-3 py-2 text-sm leading-snug " +
                    (isActive
                      ? "border-[var(--amber)] bg-[var(--amber)]/5 text-[var(--ink)]"
                      : "border-transparent text-[var(--ink)]/80 hover:border-[var(--hairline)] hover:bg-[var(--surface-elevated)] hover:text-[var(--ink)]")
                  }
                  style={{ transitionDuration: "var(--dur-instant)" }}
                  title={item.query}
                >
                  <span className="line-clamp-2">{label}</span>
                  <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-[var(--mid)]/70">
                    {formatDate(item.created_at)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {items.length > 0 && (
        <Link
          href="/account/chat/history"
          className="font-mono text-[10px] tracking-[0.14em] uppercase text-[var(--mid)] hover:text-[var(--amber)]"
          style={{ transitionDuration: "var(--dur-instant)" }}
        >
          view all →
        </Link>
      )}
    </aside>
  );
}
