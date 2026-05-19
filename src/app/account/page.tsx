/**
 * /account — post-login launchpad.
 *
 * Three tiles for the three things an invited Tamrack user can do:
 *  1. Chat with the agent (primary surface, prominent tile)
 *  2. View / mint an HTTP API key
 *  3. View / mint an MCP token
 *
 * Profile + plan + sign-out live in a quiet footer strip. No links to the
 * legacy Alberta Pulse surfaces (realtor dashboard, EDO, tools, data
 * sources, admin) — those are accessible through the top-bar avatar menu
 * for users that still have them, but this page does not advertise them.
 */
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { signOutAction } from "@/app/actions/auth";
import { AccountSubnav } from "@/components/account-subnav";
import { TKey, TArrowRight } from "@/components/icons/t3";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account");
  }

  const user = session.user;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <AccountSubnav active="home" />

      <header className="flex flex-col gap-2">
        <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--mid)]">
          account · founder access · stony plain
        </p>
        <h1 className="font-mono text-2xl font-semibold text-[var(--ink)]">
          Welcome back{user.name ? `, ${user.name.split(" ")[0]}` : ""}.
        </h1>
        <p className="text-sm leading-relaxed text-[var(--ink)]/85">
          Three things you can do from here.
        </p>
      </header>

      {/* Primary tile — chat */}
      <Link
        href="/account/chat"
        className="group block border border-[var(--hairline)] bg-[var(--surface-elevated)] p-6 transition-colors hover:border-[var(--amber)]"
        style={{ transitionDuration: "var(--dur-instant)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--amber)]">
              primary · invited product
            </p>
            <h2 className="font-mono text-xl font-semibold text-[var(--ink)]">
              Ask the agent
            </h2>
            <p className="max-w-prose text-sm leading-relaxed text-[var(--ink)]/85">
              Type a question. The agent picks tools, pulls live macro and
              regional data, and composes a dashboard in front of you.
              Single-shot today — multi-turn coming.
            </p>
          </div>
          <TArrowRight
            size={20}
            className="shrink-0 text-[var(--mid)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--amber)]"
          />
        </div>
      </Link>

      {/* Secondary tiles — keys + mcp */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/account/keys"
          className="group flex flex-col gap-2 border border-[var(--hairline)] bg-[var(--surface-elevated)] p-5 transition-colors hover:border-[var(--amber)]"
          style={{ transitionDuration: "var(--dur-instant)" }}
        >
          <div className="flex items-center justify-between">
            <TKey size={14} className="text-[var(--mid)] group-hover:text-[var(--amber)]" />
            <TArrowRight
              size={14}
              className="text-[var(--mid)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--amber)]"
            />
          </div>
          <h3 className="font-mono text-sm font-semibold text-[var(--ink)]">
            API key
          </h3>
          <p className="text-xs leading-relaxed text-[var(--mid)]">
            Bearer token for the HTTP API. Same namespace as MCP; different
            name for clean usage logs.
          </p>
        </Link>

        <Link
          href="/account/mcp"
          className="group flex flex-col gap-2 border border-[var(--hairline)] bg-[var(--surface-elevated)] p-5 transition-colors hover:border-[var(--amber)]"
          style={{ transitionDuration: "var(--dur-instant)" }}
        >
          <div className="flex items-center justify-between">
            <TKey size={14} className="text-[var(--mid)] group-hover:text-[var(--amber)]" />
            <TArrowRight
              size={14}
              className="text-[var(--mid)] transition-transform group-hover:translate-x-1 group-hover:text-[var(--amber)]"
            />
          </div>
          <h3 className="font-mono text-sm font-semibold text-[var(--ink)]">
            MCP token
          </h3>
          <p className="text-xs leading-relaxed text-[var(--mid)]">
            Bearer token for your MCP-capable agent (Claude Code, etc.).
            Streamable HTTP transport.
          </p>
        </Link>
      </div>

      {/* Profile footer — quiet, deliberately last */}
      <footer className="flex flex-col gap-3 border-t border-[var(--hairline)] pt-4">
        <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--mid)]">
          profile · billing · sign out
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1 text-xs text-[var(--mid)]">
            <span>{user.email}</span>
            <span>
              plan:{" "}
              <span className="text-[var(--ink)]">
                {user.plan ?? "—"}
              </span>
              {user.subscriptionStatus && (
                <>
                  {" · status: "}
                  <span className="text-[var(--ink)]">{user.subscriptionStatus}</span>
                </>
              )}
              {user.role === "admin" && (
                <span className="ml-2 border border-[var(--amber)]/40 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-[var(--amber)]">
                  admin
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/billing"
              className="border border-[var(--hairline)] px-3 py-1.5 font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--mid)] hover:border-[var(--ink)] hover:text-[var(--ink)]"
              style={{ transitionDuration: "var(--dur-instant)" }}
            >
              manage billing
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                className="border border-[var(--hairline)] px-3 py-1.5 font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--mid)] hover:border-[var(--accent-red)] hover:text-[var(--accent-red)]"
                style={{ transitionDuration: "var(--dur-instant)" }}
              >
                sign out
              </button>
            </form>
          </div>
        </div>
      </footer>
    </main>
  );
}
