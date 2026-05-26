"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useTheme } from "next-themes";
// Lucide icons retained here are functional/menu-only (avatar dropdown,
// section icons rendered from nav-config). Brand-bearing icons (search,
// theme toggle) have been swapped to T3. A full Lucide sweep across the
// 50+ remaining pages is tracked as deferred Phase 4 P3 work — see
// brand-phase-4 handoff notes and iconography/rejections.md.
import {
  BarChart3,
  User,
  CreditCard,
  LogIn,
  LogOut,
  Shield,
  ChevronDown,
  Sparkles,
  Key,
  Terminal,
} from "lucide-react";
import { Wordmark } from "./brand/wordmark";
import { TSearch, TSun, TMoon } from "./icons/t3";

export function TopBar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // Close avatar menu on outside click
  useEffect(() => {
    if (!avatarOpen) return;
    const handler = (e: MouseEvent) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarOpen(false);
      }
    };
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [avatarOpen]);

  // Close on route change
  useEffect(() => setAvatarOpen(false), [pathname]);

  const isAdmin = session?.user?.role === "admin";

  return (
    <header className="hidden lg:flex fixed top-0 left-0 right-0 z-40 h-12 bg-[var(--surface)] border-b border-[var(--hairline)] items-center px-4 gap-1">
      {/* Wordmark — T3 custom-cut SVG, not type-set */}
      <Link
        href="/"
        className="flex items-center mr-5 shrink-0 text-[var(--ink)] hover:text-[var(--ink)]"
        aria-label="Tamrack — home"
      >
        <Wordmark height={18} />
      </Link>

      {/* Top-level nav — free product (Charts) + invited product (Chat). The
          old dashboard sections live on at their URLs but are no longer fronted
          here; the agent at /account/chat is the way in. */}
      <nav className="flex items-center gap-0.5 flex-1 min-w-0">
        <Link
          href="/charts"
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors whitespace-nowrap ${
            pathname.startsWith("/charts")
              ? "text-[var(--amber)] font-medium"
              : "text-[var(--mid)] hover:text-[var(--ink)]"
          }`}
          style={{ transitionDuration: "var(--dur-instant)" }}
        >
          <BarChart3 size={15} className="shrink-0" />
          Charts
        </Link>
        {session?.user && (
          <Link
            href="/account/chat"
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors whitespace-nowrap ${
              pathname.startsWith("/account/chat")
                ? "text-[var(--amber)] font-medium"
                : "text-[var(--mid)] hover:text-[var(--ink)]"
            }`}
            style={{ transitionDuration: "var(--dur-instant)" }}
          >
            <Sparkles size={15} className="shrink-0" />
            Ask
          </Link>
        )}
      </nav>

      {/* Right side: search, theme, avatar */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Search trigger */}
        <button
          onClick={() => {
            window.dispatchEvent(
              new KeyboardEvent("keydown", {
                key: "k",
                metaKey: true,
                bubbles: true,
              })
            );
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-[var(--mid)] hover:text-[var(--ink)] transition-colors"
          style={{ transitionDuration: "var(--dur-instant)" }}
          title="Search (⌘K)"
        >
          <TSearch size={15} />
          <span className="font-mono text-[10px] tracking-wider uppercase text-[var(--mid)]/70">⌘K</span>
        </button>

        {/* Theme toggle */}
        {mounted && (
          <button
            onClick={() =>
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
            className="p-2 text-[var(--mid)] hover:text-[var(--amber)] transition-colors"
            style={{ transitionDuration: "var(--dur-instant)" }}
            title={resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
            aria-label={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {resolvedTheme === "dark" ? (
              <TSun size={15} />
            ) : (
              <TMoon size={15} />
            )}
          </button>
        )}

        {/* Avatar menu */}
        <div ref={avatarRef} className="relative">
          <button
            onClick={() => setAvatarOpen(!avatarOpen)}
            className={`flex items-center gap-1 p-2 rounded-md transition-colors ${
              avatarOpen
                ? "bg-foreground/[0.08] text-foreground"
                : "text-muted hover:text-foreground hover:bg-foreground/[0.05]"
            }`}
          >
            <User size={15} />
            <ChevronDown size={12} />
          </button>

          {avatarOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-card-border rounded-lg shadow-lg py-1 z-50">
              {session?.user ? (
                <>
                  {session.user.email && (
                    <div className="px-3 py-2 border-b border-card-border">
                      <p className="text-xs text-muted truncate">
                        {session.user.email}
                      </p>
                    </div>
                  )}
                  <Link
                    href="/account/chat"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-muted hover:text-foreground hover:bg-foreground/[0.05] transition-colors"
                  >
                    <Sparkles size={14} />
                    Ask
                  </Link>
                  <Link
                    href="/account/keys"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-muted hover:text-foreground hover:bg-foreground/[0.05] transition-colors"
                  >
                    <Key size={14} />
                    API key
                  </Link>
                  <Link
                    href="/account/mcp"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-muted hover:text-foreground hover:bg-foreground/[0.05] transition-colors"
                  >
                    <Terminal size={14} />
                    MCP token
                  </Link>
                  <Link
                    href="/billing"
                    className="flex items-center gap-2 px-3 py-2 text-sm text-muted hover:text-foreground hover:bg-foreground/[0.05] transition-colors"
                  >
                    <CreditCard size={14} />
                    Billing
                  </Link>
                  {isAdmin && (
                    <>
                      <div className="border-t border-card-border my-1" />
                      <Link
                        href="/admin"
                        className="flex items-center gap-2 px-3 py-2 text-sm text-muted hover:text-foreground hover:bg-foreground/[0.05] transition-colors"
                      >
                        <Shield size={14} />
                        Admin
                      </Link>
                    </>
                  )}
                  <div className="border-t border-card-border my-1" />
                  <form action="/api/auth/sign-out" method="POST">
                    <button
                      type="submit"
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-accent-red/70 hover:text-accent-red hover:bg-accent-red/5 transition-colors"
                    >
                      <LogOut size={14} />
                      Sign out
                    </button>
                  </form>
                </>
              ) : (
                <Link
                  href="/login"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-muted hover:text-foreground hover:bg-foreground/[0.05] transition-colors"
                >
                  <LogIn size={14} />
                  Sign in
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
