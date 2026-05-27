/**
 * /account/chat/history — full list of the signed-in user's past questions.
 *
 * Each row links to /d/<slug>. Server-rendered, paginated 50 per page.
 */
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { AccountSubnav } from "@/components/account-subnav";
import {
  countDashboardsForUser,
  listDashboardsForUser,
} from "@/lib/smart-ui/persistence";
import { fallbackTitle } from "@/lib/smart-ui/title";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

function formatFull(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function ChatHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account/chat/history");
  }
  const userId = session.user.id;

  const params = await searchParams;
  const pageNum = Math.max(parseInt(params.page ?? "1", 10) || 1, 1);
  const offset = (pageNum - 1) * PAGE_SIZE;

  const [items, total] = await Promise.all([
    listDashboardsForUser(userId, { limit: PAGE_SIZE, offset }),
    countDashboardsForUser(userId),
  ]);

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const hasPrev = pageNum > 1;
  const hasNext = pageNum < totalPages;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <AccountSubnav active="chat" />

      <header className="flex flex-col gap-2">
        <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--mid)]">
          tamrack agent · your history
        </p>
        <h1 className="font-mono text-2xl font-semibold text-[var(--ink)]">
          Your past questions
        </h1>
        <p className="text-sm leading-relaxed text-[var(--ink)]/85">
          Every question you ask is saved. Click any entry to replay the
          dashboard.{" "}
          <Link
            href="/account/chat"
            className="underline underline-offset-2 hover:text-[var(--amber)]"
          >
            Ask a new one →
          </Link>
        </p>
      </header>

      {total === 0 ? (
        <p className="border border-[var(--hairline)] bg-[var(--surface-elevated)] p-6 text-sm text-[var(--ink)]/80">
          You haven&rsquo;t asked anything yet.{" "}
          <Link
            href="/account/chat"
            className="underline underline-offset-2 hover:text-[var(--amber)]"
          >
            Start your first question →
          </Link>
        </p>
      ) : (
        <>
          <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--mid)]">
            {total} {total === 1 ? "question" : "questions"} · page {pageNum} of{" "}
            {totalPages}
          </p>

          <ul className="flex flex-col">
            {items.map((item) => {
              const label = item.title?.trim() || fallbackTitle(item.query);
              const showOriginal =
                item.title && item.title.trim() && item.title.trim() !== item.query;
              return (
                <li
                  key={item.id}
                  className="border-b border-[var(--hairline)] last:border-b-0"
                >
                  <Link
                    href={`/d/${item.slug}`}
                    className="flex flex-col gap-1 px-3 py-4 hover:bg-[var(--surface-elevated)]"
                    style={{ transitionDuration: "var(--dur-instant)" }}
                  >
                    <span className="text-base font-medium text-[var(--ink)]">
                      {label}
                    </span>
                    {showOriginal && (
                      <span className="text-sm text-[var(--ink)]/70">
                        {item.query}
                      </span>
                    )}
                    <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-[var(--mid)]">
                      {formatFull(item.created_at)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {(hasPrev || hasNext) && (
            <nav className="flex items-center justify-between border-t border-[var(--hairline)] pt-4">
              {hasPrev ? (
                <Link
                  href={`/account/chat/history?page=${pageNum - 1}`}
                  className="font-mono text-[11px] tracking-[0.14em] uppercase text-[var(--mid)] hover:text-[var(--amber)]"
                  style={{ transitionDuration: "var(--dur-instant)" }}
                >
                  ← newer
                </Link>
              ) : (
                <span />
              )}
              {hasNext ? (
                <Link
                  href={`/account/chat/history?page=${pageNum + 1}`}
                  className="font-mono text-[11px] tracking-[0.14em] uppercase text-[var(--mid)] hover:text-[var(--amber)]"
                  style={{ transitionDuration: "var(--dur-instant)" }}
                >
                  older →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </>
      )}
    </main>
  );
}
