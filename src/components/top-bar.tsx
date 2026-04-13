"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { signOutAction } from "@/app/actions/auth";
import {
  Activity,
  BarChart3,
  Search,
  Sun,
  Moon,
  User,
  CreditCard,
  LogOut,
  Shield,
  ChevronDown,
  Wrench,
  BookOpen,
  Database,
  Home,
  Building2,
} from "lucide-react";
import { sections } from "./nav-config";

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

  const isSectionActive = (prefixes: string[]) =>
    prefixes.some((p) => pathname.startsWith(p));

  return (
    <header className="hidden lg:flex fixed top-0 left-0 right-0 z-40 h-12 bg-card border-b border-card-border items-center px-4 gap-1">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 mr-4 shrink-0">
        <Activity size={20} className="text-accent" />
        <span className="text-sm font-semibold tracking-tight text-foreground">
          Alberta Pulse Check
        </span>
      </Link>

      {/* Section links */}
      <nav className="flex items-center gap-0.5 flex-1 min-w-0">
        {sections.map((section) => {
          const Icon = section.icon;
          const active = isSectionActive(section.matchPrefixes);
          return (
            <Link
              key={section.key}
              href={section.href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors whitespace-nowrap ${
                active
                  ? "bg-accent/10 text-accent font-medium"
                  : "text-muted hover:text-foreground hover:bg-foreground/[0.05]"
              }`}
            >
              <Icon size={15} className="shrink-0" />
              {section.label}
            </Link>
          );
        })}
        {/* Chart catalogue link */}
        <Link
          href="/charts"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors whitespace-nowrap ${
            pathname.startsWith("/charts")
              ? "bg-accent/10 text-accent font-medium"
              : "text-muted hover:text-foreground hover:bg-foreground/[0.05]"
          }`}
        >
          <BarChart3 size={15} className="shrink-0" />
          Charts
        </Link>
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
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-muted hover:text-foreground hover:bg-foreground/[0.05] transition-colors"
          title="Search (⌘K)"
        >
          <Search size={15} />
          <span className="text-xs text-muted/60">⌘K</span>
        </button>

        {/* Theme toggle */}
        {mounted && (
          <button
            onClick={() =>
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
            className="p-2 rounded-md text-muted hover:text-foreground hover:bg-foreground/[0.05] transition-colors"
            title={resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
          >
            {resolvedTheme === "dark" ? (
              <Sun size={15} />
            ) : (
              <Moon size={15} />
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
              {session?.user?.email && (
                <div className="px-3 py-2 border-b border-card-border">
                  <p className="text-xs text-muted truncate">
                    {session.user.email}
                  </p>
                </div>
              )}
              {session?.user?.plan === "realtor" && session?.user?.subscriptionStatus === "active" && (
                <Link
                  href="/realtor/market"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-teal-400 hover:bg-teal-500/10 transition-colors"
                >
                  <Home size={14} />
                  Real Estate Dashboard
                </Link>
              )}
              {session?.user?.plan === "edo" && session?.user?.subscriptionStatus === "active" && (
                <Link
                  href="/edo"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                >
                  <Building2 size={14} />
                  EDO Dashboard
                </Link>
              )}
              <Link
                href="/account"
                className="flex items-center gap-2 px-3 py-2 text-sm text-muted hover:text-foreground hover:bg-foreground/[0.05] transition-colors"
              >
                <User size={14} />
                Account
              </Link>
              <Link
                href="/billing"
                className="flex items-center gap-2 px-3 py-2 text-sm text-muted hover:text-foreground hover:bg-foreground/[0.05] transition-colors"
              >
                <CreditCard size={14} />
                Billing & API Keys
              </Link>
              <div className="border-t border-card-border my-1" />
              <Link
                href="/tools"
                className="flex items-center gap-2 px-3 py-2 text-sm text-muted hover:text-foreground hover:bg-foreground/[0.05] transition-colors"
              >
                <Wrench size={14} />
                Tools
              </Link>
              <Link
                href="/tools/docs"
                className="flex items-center gap-2 px-3 py-2 text-sm text-muted hover:text-foreground hover:bg-foreground/[0.05] transition-colors"
              >
                <BookOpen size={14} />
                API Docs
              </Link>
              <Link
                href="/tools/sources"
                className="flex items-center gap-2 px-3 py-2 text-sm text-muted hover:text-foreground hover:bg-foreground/[0.05] transition-colors"
              >
                <Database size={14} />
                Data Sources
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
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-accent-red/70 hover:text-accent-red hover:bg-accent-red/5 transition-colors"
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
