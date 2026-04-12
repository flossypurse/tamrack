"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import {
  Activity,
  ChevronDown,
  Menu,
  X,
  User,
  CreditCard,
  LogOut,
  Shield,
  Sun,
  Moon,
  Search,
  Home,
  Building2,
} from "lucide-react";
import { sections, buildMunicipalitySubSections, toolsItems, getAllNavItems } from "./nav-config";
import { CommandPalette, InlineSearch } from "./command-palette";
import type { CommandItem } from "./command-palette";
import { TopBar } from "./top-bar";
import { SectionSidebar } from "./section-sidebar";
import { MobileTabs } from "./mobile-tabs";

// ============================================================
// Build command items from nav config
// ============================================================

function buildCommandItems(): CommandItem[] {
  const items = getAllNavItems();
  return items.map((item) => ({
    href: item.href,
    label: item.label,
    section: getSectionLabel(item.href),
    icon: item.icon,
  }));
}

function getSectionLabel(href: string): string {
  for (const section of sections) {
    if (section.matchPrefixes.some((p) => href.startsWith(p))) {
      return section.label;
    }
  }
  if (href.startsWith("/tools")) return "Tools";
  return "Other";
}

// ============================================================
// Nav Component — orchestrates all navigation pieces
// ============================================================

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Mobile drawer state
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileCollapsed, setMobileCollapsed] = useState<
    Record<string, boolean>
  >({});

  const commandItems = buildCommandItems();
  const isAdmin = session?.user?.role === "admin";
  const isTrialing = session?.user?.subscriptionStatus === "trialing";
  const trialEnd = session?.user?.trialEnd
    ? new Date(session.user.trialEnd)
    : null;
  const daysLeft = trialEnd
    ? Math.max(
        0,
        Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      )
    : 0;

  // Close mobile nav on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile nav open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const toggleMobileSection = (label: string) => {
    setMobileCollapsed((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const handleMobileNavigate = useCallback(
    (href: string) => {
      setMobileOpen(false);
      router.push(href);
    },
    [router]
  );

  const isActive = (href: string) => {
    // Exact match for overview pages
    if (
      href === "/economy" ||
      href === "/real-estate" ||
      href === "/community" ||
      href === "/environment" ||
      href === "/governance" ||
      href === "/municipalities" ||
      href === "/home/dashboard"
    ) {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(href + "/");
  };

  // Build all mobile sections (including dynamic municipalities)
  const muniSubSections = buildMunicipalitySubSections();
  const allMobileSections = sections.map((s) => ({
    ...s,
    subSections:
      s.key === "municipalities" ? muniSubSections : s.subSections,
  }));

  return (
    <>
      {/* Command Palette (shared desktop + mobile) */}
      <CommandPalette items={commandItems} />

      {/* Desktop: Top Bar + Section Sidebar */}
      <TopBar />
      <SectionSidebar />

      {/* ================================================================ */}
      {/* MOBILE: Top bar + Drawer + Bottom Tabs */}
      {/* ================================================================ */}

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-b border-card-border">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <Activity size={18} className="text-accent" />
            <span className="text-sm font-semibold">Alberta Pulse Check</span>
          </Link>
          <div className="flex items-center gap-1">
            {/* Mobile search */}
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
              className="p-1.5 rounded-lg hover:bg-foreground/[0.05] text-muted hover:text-foreground transition-colors"
              aria-label="Search"
            >
              <Search size={16} />
            </button>
            {mounted && (
              <button
                onClick={() =>
                  setTheme(resolvedTheme === "dark" ? "light" : "dark")
                }
                className="p-1.5 rounded-lg hover:bg-foreground/[0.05] text-muted hover:text-foreground transition-colors"
                aria-label="Toggle theme"
              >
                {resolvedTheme === "dark" ? (
                  <Sun size={16} />
                ) : (
                  <Moon size={16} />
                )}
              </button>
            )}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-1.5 rounded-lg hover:bg-foreground/[0.05] text-muted hover:text-foreground transition-colors"
              aria-label="Toggle navigation"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={`lg:hidden fixed top-0 left-0 z-50 h-full w-72 bg-card border-r border-card-border transition-transform duration-300 flex flex-col ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo row */}
        <div className="px-4 py-4 border-b border-card-border flex items-center justify-between shrink-0">
          <Link
            href="/"
            className="flex items-center gap-2.5"
            onClick={() => setMobileOpen(false)}
          >
            <Activity size={20} className="text-accent" />
            <span className="text-sm font-semibold tracking-tight">
              Alberta Pulse Check
            </span>
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1 rounded-lg hover:bg-foreground/[0.05] text-muted"
          >
            <X size={18} />
          </button>
        </div>

        {/* Inline search */}
        <InlineSearch items={commandItems} onNavigate={handleMobileNavigate} />

        {/* Trial banner */}
        {isTrialing && daysLeft <= 7 && (
          <Link
            href="/billing"
            onClick={() => setMobileOpen(false)}
            className="mx-3 mt-2 px-3 py-2 bg-accent-amber/10 border border-accent-amber/20 rounded-lg text-xs text-accent-amber hover:bg-accent-amber/15 transition-colors shrink-0"
          >
            {daysLeft} day{daysLeft !== 1 ? "s" : ""} left in trial &mdash;{" "}
            <span className="font-medium">Subscribe</span>
          </Link>
        )}

        {/* Accordion sections */}
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {allMobileSections.map((section) => {
            const sectionActive = section.matchPrefixes.some((p) =>
              pathname.startsWith(p)
            );
            const isOpen = !mobileCollapsed[section.key];

            return (
              <div key={section.key}>
                <button
                  onClick={() => toggleMobileSection(section.key)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium uppercase tracking-wider transition-colors ${
                    sectionActive
                      ? "text-foreground"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  <section.icon
                    size={14}
                    className={sectionActive ? "text-accent" : ""}
                  />
                  <span className="flex-1 text-left">{section.label}</span>
                  <ChevronDown
                    size={12}
                    className={`transition-transform duration-200 ${
                      isOpen ? "" : "-rotate-90"
                    }`}
                  />
                </button>

                <div
                  className={`overflow-hidden transition-all duration-200 ${
                    isOpen
                      ? "max-h-[800px] opacity-100"
                      : "max-h-0 opacity-0"
                  }`}
                >
                  {section.subSections.map((sub, i) => (
                    <div key={sub.label || i}>
                      {sub.label && (
                        <p className="px-5 pt-2 pb-0.5 text-[10px] font-medium uppercase tracking-wider text-muted/60">
                          {sub.label}
                        </p>
                      )}
                      <div className="ml-2 border-l border-card-border pl-1 space-y-0.5 py-0.5">
                        {sub.items.map((item) => {
                          const active = isActive(item.href);
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setMobileOpen(false)}
                              className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                                active
                                  ? "bg-accent/10 text-accent font-medium"
                                  : "text-muted hover:text-foreground hover:bg-foreground/[0.05]"
                              }`}
                            >
                              <item.icon
                                size={14}
                                className={active ? "text-accent" : ""}
                              />
                              {item.label}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Tools in mobile drawer */}
          <div>
            <p className="px-3 pt-3 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted/60">
              Tools
            </p>
            <div className="ml-2 border-l border-card-border pl-1 space-y-0.5 py-0.5">
              {toolsItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                      active
                        ? "bg-accent/10 text-accent font-medium"
                        : "text-muted hover:text-foreground hover:bg-foreground/[0.05]"
                    }`}
                  >
                    <item.icon
                      size={14}
                      className={active ? "text-accent" : ""}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom: account quick links */}
        <div className="shrink-0 border-t border-card-border p-2 space-y-0.5">
          {session?.user?.plan === "realtor" && session?.user?.subscriptionStatus === "active" && (
            <Link
              href="/realtor/market"
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                pathname.startsWith("/realtor")
                  ? "bg-teal-500/10 text-teal-400 font-medium"
                  : "text-muted hover:text-foreground hover:bg-foreground/[0.05]"
              }`}
            >
              <Home size={14} />
              Realtor Dashboard
            </Link>
          )}
          {session?.user?.plan === "edo" && session?.user?.subscriptionStatus === "active" && (
            <Link
              href="/edo"
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                pathname.startsWith("/edo")
                  ? "bg-indigo-500/10 text-indigo-400 font-medium"
                  : "text-muted hover:text-foreground hover:bg-foreground/[0.05]"
              }`}
            >
              <Building2 size={14} />
              EDO Dashboard
            </Link>
          )}
          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                pathname === "/admin"
                  ? "bg-accent/10 text-accent font-medium"
                  : "text-muted hover:text-foreground hover:bg-foreground/[0.05]"
              }`}
            >
              <Shield size={14} />
              Admin
            </Link>
          )}
          <Link
            href="/account"
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
              pathname === "/account"
                ? "bg-accent/10 text-accent font-medium"
                : "text-muted hover:text-foreground hover:bg-foreground/[0.05]"
            }`}
          >
            <User size={14} />
            Account
          </Link>
          <Link
            href="/billing"
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
              pathname === "/billing"
                ? "bg-accent/10 text-accent font-medium"
                : "text-muted hover:text-foreground hover:bg-foreground/[0.05]"
            }`}
          >
            <CreditCard size={14} />
            Billing
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-accent-red/70 hover:text-accent-red hover:bg-accent-red/5 transition-colors"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </div>

      {/* Mobile bottom tabs */}
      <MobileTabs />
    </>
  );
}
