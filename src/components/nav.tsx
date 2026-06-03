"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Wordmark } from "./brand/wordmark";
import { TSun, TMoon, TSearch } from "./icons/t3";
import { CommandPalette } from "./command-palette";
import { TopBar } from "./top-bar";
import { MobileTabs } from "./mobile-tabs";

// ============================================================
// Nav — slim chrome for the surviving non-account surfaces
// (charts, saved dashboards, admin). Two doors only: Charts +
// the account workspace. Desktop = TopBar; mobile = a slim top
// bar (logo + search + theme) over the bottom MobileTabs.
// ============================================================

export function Nav() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const openSearch = () =>
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
    );

  return (
    <>
      {/* Command palette — chart search (⌘K), no nav items to index */}
      <CommandPalette items={[]} />

      {/* Desktop */}
      <TopBar />

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-[var(--surface)]/95 backdrop-blur-sm border-b border-[var(--hairline)]">
        <div className="flex items-center justify-between px-4 py-3">
          <Link
            href="/"
            className="flex items-center text-[var(--ink)]"
            aria-label="Tamrack — home"
          >
            <Wordmark height={16} />
          </Link>
          <div className="flex items-center gap-1">
            <button
              onClick={openSearch}
              className="p-1.5 text-[var(--mid)] hover:text-[var(--ink)] transition-colors"
              style={{ transitionDuration: "var(--dur-instant)" }}
              aria-label="Search"
            >
              <TSearch size={16} />
            </button>
            {mounted && (
              <button
                onClick={() =>
                  setTheme(resolvedTheme === "dark" ? "light" : "dark")
                }
                className="p-1.5 text-[var(--mid)] hover:text-[var(--amber)] transition-colors"
                style={{ transitionDuration: "var(--dur-instant)" }}
                aria-label="Toggle theme"
              >
                {resolvedTheme === "dark" ? <TSun size={16} /> : <TMoon size={16} />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile bottom tabs — Charts / Ask / Account */}
      <MobileTabs />
    </>
  );
}
