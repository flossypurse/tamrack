/**
 * "What Alberta is asking" — the shared-corpus de-silo feed.
 *
 * Server component. Renders the collective view of popular questions across all
 * (non-private) accounts, ranked by distinct askers then total views. Each row
 * links to the canonical dashboard for that question (most-viewed, tie-break
 * most-recent). This is the read side of the query corpus: accounts exist for
 * auth/billing, but the questions are common ground.
 *
 * Logged-in surface only (rendered inside /account). The question text is shown
 * verbatim — that's acceptable here because the feed stays behind sign-in and
 * the "make private" carve-out keeps genuinely sensitive questions out.
 */
import Link from "next/link";

import {
  listSharedQuestions,
  type SharedQuestion,
} from "@/lib/smart-ui/persistence";
import { fallbackTitle } from "@/lib/smart-ui/title";

const FEED_LIMIT = 12;

function askerLabel(askers: number): string {
  return askers === 1 ? "1 person" : `${askers} people`;
}

export async function WhatAlbertaIsAsking({
  currentSlug,
}: {
  currentSlug?: string;
}) {
  let items: SharedQuestion[] = [];
  try {
    items = await listSharedQuestions({ limit: FEED_LIMIT });
  } catch (err) {
    // Never break the rail if the aggregate fails — it's a secondary surface.
    // Log so a persistent failure (e.g. the deploy window before the `private`
    // column lands) shows up in server logs rather than vanishing silently.
    console.error("WhatAlbertaIsAsking: listSharedQuestions failed", err);
    items = [];
  }

  if (items.length === 0) return null;

  return (
    <aside aria-label="What Alberta is asking" className="flex flex-col gap-3">
      <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--mid)]">
        what alberta is asking
      </p>

      <ul className="flex flex-col">
        {items.map((item) => {
          const isActive = currentSlug && item.slug === currentSlug;
          const label = item.title?.trim() || fallbackTitle(item.query);
          return (
            <li key={item.queryHash}>
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
                  {askerLabel(item.askers)}
                  {item.views > 0 && ` · ${item.views} views`}
                  {item.truthScore !== null && item.truthPass === false && (
                    <span
                      className="ml-2 text-[var(--amber)]/70"
                      title="Data quality flag: this dashboard may not fully answer the question"
                    >
                      ⚑ flagged
                    </span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
