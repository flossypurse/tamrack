/**
 * Thin nav strip for /account sub-pages.
 *
 * Server-component-friendly (no usePathname) — callers pass the active key
 * explicitly. Four items max: chat / api keys / mcp token / sign out.
 * Mono-caps T3 chrome, amber accent for the active item.
 */
import Link from "next/link";

type AccountTab = "home" | "chat" | "keys" | "mcp";

const TABS: ReadonlyArray<{ key: AccountTab; label: string; href: string }> = [
  { key: "home", label: "account", href: "/account" },
  { key: "chat", label: "ask", href: "/account/chat" },
  { key: "keys", label: "api key", href: "/account/keys" },
  { key: "mcp", label: "mcp token", href: "/account/mcp" },
];

export function AccountSubnav({ active }: { active: AccountTab }) {
  return (
    <nav className="flex items-center justify-between border-b border-[var(--hairline)] pb-3">
      <div className="flex flex-wrap items-center gap-1">
        {TABS.map((tab) => {
          const isActive = tab.key === active;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={
                "border px-3 py-1.5 font-mono text-[10px] tracking-[0.18em] uppercase " +
                (isActive
                  ? "border-[var(--amber)] bg-[var(--amber)]/10 text-[var(--amber)]"
                  : "border-transparent text-[var(--mid)] hover:border-[var(--hairline)] hover:text-[var(--ink)]")
              }
              style={{ transitionDuration: "var(--dur-instant)" }}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
      <form action="/api/auth/sign-out" method="POST">
        <button
          type="submit"
          className="border border-transparent px-3 py-1.5 font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--mid)] hover:border-[var(--hairline)] hover:text-[var(--accent-red)]"
          style={{ transitionDuration: "var(--dur-instant)" }}
        >
          sign out
        </button>
      </form>
    </nav>
  );
}
