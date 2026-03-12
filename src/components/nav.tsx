"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  Activity,
  LayoutDashboard,
  Radar,
  Flame,
  RefreshCw,
  PieChart,
  Users,
  Plane,
  Wheat,
  Home,
  Target,
  MapPin,
  GraduationCap,
  Database,
  ChevronDown,
  Menu,
  X,
  Building2,
  CreditCard,
  User,
  LogOut,
  Shield,
  Globe,
  Sun,
  Moon,
  BookOpen,
  Building,
  Store,
  Scale,
  ShieldAlert,
  Rocket,
  CloudSun,
  Wind,
  Waves,
  Car,
  Siren,
  TreePine,
  Landmark,
  Pickaxe,
  TrendingUp,
  GitCompare,
  Search,
  Wrench,
  Briefcase,
} from "lucide-react";
import { useTheme } from "next-themes";
import {
  getLiveMunicipalities,
  getMunicipalitiesByRegion,
  REGION_LABELS,
  REGION_ORDER,
} from "@/lib/municipality-registry";
import { CommandPalette, InlineSearch } from "./command-palette";
import type { CommandItem } from "./command-palette";

// ============================================================
// Nav structure — add new pages here
// ============================================================

type NavItem = { href: string; label: string; icon: React.ElementType };
type NavSection = {
  label: string;
  icon: React.ElementType;
  items: NavItem[];
};

// Build municipality nav items grouped by region (only live municipalities)
function buildMunicipalityNav(): NavSection[] {
  const byRegion = getMunicipalitiesByRegion();
  const live = getLiveMunicipalities();
  const sections: NavSection[] = [];

  sections.push({
    label: "Municipalities",
    icon: Globe,
    items: [
      { href: "/municipalities", label: `All (${live.length} live)`, icon: Globe },
      { href: "/coverage", label: "Data Coverage", icon: Database },
      { href: "/dashboard", label: "Edmonton", icon: Building2 },
    ],
  });

  for (const region of REGION_ORDER) {
    const municipalities = (byRegion[region] || []).filter(
      (m) => m.status === "live"
    );
    if (municipalities.length === 0) continue;

    sections.push({
      label: REGION_LABELS[region],
      icon: Building2,
      items: municipalities
        .sort((a, b) => (b.population || 0) - (a.population || 0))
        .map((m) => ({
          href: `/m/${m.slug}`,
          label: m.name,
          icon: Building2,
        })),
    });
  }

  return sections;
}

const coreSections: NavSection[] = [
  {
    label: "Overview",
    icon: LayoutDashboard,
    items: [
      { href: "/dashboard", label: "Dashboard", icon: Activity },
      { href: "/signals", label: "Signals", icon: Radar },
      { href: "/briefing", label: "Briefings", icon: Briefcase },
    ],
  },
  {
    label: "Economy",
    icon: PieChart,
    items: [
      { href: "/energy", label: "Energy", icon: Flame },
      { href: "/drilling", label: "Drilling", icon: Pickaxe },
      { href: "/cycle", label: "Boom-Bust Cycle", icon: RefreshCw },
      { href: "/diversification", label: "Diversification", icon: PieChart },
      { href: "/labour", label: "Labour", icon: Users },
      { href: "/migration", label: "Migration", icon: Plane },
      { href: "/agriculture", label: "Agriculture", icon: Wheat },
    ],
  },
  {
    label: "Real Estate",
    icon: Home,
    items: [
      { href: "/prospects", label: "Prospect Leads", icon: Target },
      { href: "/real-estate", label: "Market Intel", icon: Home },
      { href: "/micro", label: "Neighbourhoods", icon: MapPin },
      { href: "/pipeline", label: "Dev Pipeline", icon: Building },
      { href: "/rental", label: "Rental Intel", icon: Home },
      { href: "/commercial", label: "Commercial", icon: Store },
    ],
  },
  {
    label: "Intelligence",
    icon: Scale,
    items: [
      { href: "/benchmarks", label: "Benchmarks", icon: Scale },
      { href: "/corridors", label: "Growth Corridors", icon: Rocket },
      { href: "/risk", label: "Market Risk", icon: ShieldAlert },
      { href: "/invest", label: "Investment Thesis", icon: TrendingUp },
      { href: "/compare", label: "Compare", icon: GitCompare },
    ],
  },
  {
    label: "Environment",
    icon: CloudSun,
    items: [
      { href: "/weather", label: "Weather", icon: CloudSun },
      { href: "/air-quality", label: "Air Quality", icon: Wind },
      { href: "/water", label: "Water & Rivers", icon: Waves },
      { href: "/wildfire", label: "Wildfire", icon: TreePine },
    ],
  },
  {
    label: "Public Safety",
    icon: Siren,
    items: [
      { href: "/traffic", label: "Traffic & Roads", icon: Car },
      { href: "/earthquakes", label: "Seismic", icon: Activity },
      { href: "/emergencies", label: "Emergencies", icon: Siren },
      { href: "/elections", label: "Politics", icon: Landmark },
    ],
  },
];

const toolsSection: NavSection = {
  label: "Tools",
  icon: Wrench,
  items: [
    { href: "/learn", label: "Learn", icon: GraduationCap },
    { href: "/docs", label: "API Docs", icon: BookOpen },
    { href: "/sources", label: "Data Sources", icon: Database },
  ],
};

// ============================================================
// All categories for the rail (core + municipalities + tools)
// ============================================================

type RailCategory = {
  key: string;
  label: string;
  icon: React.ElementType;
  /** Sections to show in the flyout panel */
  sections: NavSection[];
};

function buildCategories(): RailCategory[] {
  const municipalitySections = buildMunicipalityNav();

  return [
    ...coreSections.map((s) => ({
      key: s.label,
      label: s.label,
      icon: s.icon,
      sections: [s],
    })),
    {
      key: "Municipalities",
      label: "Municipalities",
      icon: Globe,
      sections: municipalitySections,
    },
    {
      key: "Tools",
      label: "Tools",
      icon: Wrench,
      sections: [toolsSection],
    },
  ];
}

/** Flatten all nav items into CommandItem[] for the palette */
function buildCommandItems(): CommandItem[] {
  const municipalitySections = buildMunicipalityNav();
  const allSections = [
    ...coreSections,
    ...municipalitySections,
    toolsSection,
  ];
  const seen = new Set<string>();
  const items: CommandItem[] = [];

  for (const section of allSections) {
    for (const item of section.items) {
      if (seen.has(item.href)) continue;
      seen.add(item.href);
      items.push({
        href: item.href,
        label: item.label,
        section: section.label,
        icon: item.icon,
      });
    }
  }
  return items;
}

// ============================================================
// Nav Component
// ============================================================

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ── Desktop state ──
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // ── Mobile state ──
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileCollapsed, setMobileCollapsed] = useState<Record<string, boolean>>({});

  const categories = buildCategories();
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

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/municipalities") return pathname === "/municipalities";
    return pathname.startsWith(href);
  };

  const isCategoryActive = (cat: RailCategory) =>
    cat.sections.some((s) => s.items.some((item) => isActive(item.href)));

  // Close flyout and mobile nav on route change
  useEffect(() => {
    setActiveCategory(null);
    setMobileOpen(false);
  }, [pathname]);

  // Close flyout on outside click
  useEffect(() => {
    if (!activeCategory) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-nav-rail]") || target.closest("[data-nav-panel]")) return;
      setActiveCategory(null);
    };
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [activeCategory]);

  // Prevent body scroll when mobile nav open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
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

  // All sections flat for mobile
  const municipalitySections = buildMunicipalityNav();
  const allMobileSections = [
    ...coreSections,
    ...municipalitySections,
    toolsSection,
  ];

  return (
    <>
      {/* ── Command Palette (shared desktop + mobile) ── */}
      <CommandPalette items={commandItems} />

      {/* ================================================================ */}
      {/* ── DESKTOP: Rail + Flyout Panel ── */}
      {/* ================================================================ */}

      {/* Icon rail */}
      <aside
        data-nav-rail
        className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-14 bg-card border-r border-card-border z-40"
      >
        {/* Logo */}
        <Link
          href="/dashboard"
          className="flex items-center justify-center py-4 border-b border-card-border"
        >
          <Activity size={22} className="text-accent" />
        </Link>

        {/* Category icons */}
        <div className="flex-1 flex flex-col items-center py-2 gap-0.5 overflow-y-auto">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const active = isCategoryActive(cat);
            const isOpen = activeCategory === cat.key;

            return (
              <button
                key={cat.key}
                onClick={() =>
                  setActiveCategory(isOpen ? null : cat.key)
                }
                title={cat.label}
                className={`relative w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
                  isOpen
                    ? "bg-accent/15 text-accent"
                    : active
                    ? "text-accent hover:bg-foreground/[0.05]"
                    : "text-muted hover:text-foreground hover:bg-foreground/[0.05]"
                }`}
              >
                <Icon size={18} />
                {/* Active indicator dot */}
                {active && !isOpen && (
                  <span className="absolute left-0.5 top-1/2 -translate-y-1/2 w-1 h-4 rounded-full bg-accent" />
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom: search trigger, theme, user */}
        <div className="flex flex-col items-center gap-1 py-3 border-t border-card-border">
          {/* Search */}
          <button
            onClick={() => {
              // Simulate Cmd+K
              window.dispatchEvent(
                new KeyboardEvent("keydown", {
                  key: "k",
                  metaKey: true,
                  bubbles: true,
                })
              );
            }}
            title="Search (⌘K)"
            className="w-10 h-10 flex items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-foreground/[0.05] transition-colors"
          >
            <Search size={18} />
          </button>

          {/* Theme toggle */}
          {mounted && (
            <button
              onClick={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
              title="Toggle theme"
              className="w-10 h-10 flex items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-foreground/[0.05] transition-colors"
            >
              {resolvedTheme === "dark" ? (
                <Sun size={18} />
              ) : (
                <Moon size={18} />
              )}
            </button>
          )}

          {/* User avatar */}
          <Link
            href="/account"
            title="Account"
            className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
              pathname === "/account"
                ? "bg-accent/10 text-accent"
                : "text-muted hover:text-foreground hover:bg-foreground/[0.05]"
            }`}
          >
            <User size={18} />
          </Link>

          {isAdmin && (
            <Link
              href="/admin"
              title="Admin"
              className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
                pathname === "/admin"
                  ? "bg-accent/10 text-accent"
                  : "text-muted hover:text-foreground hover:bg-foreground/[0.05]"
              }`}
            >
              <Shield size={18} />
            </Link>
          )}
        </div>
      </aside>

      {/* Flyout panel */}
      {activeCategory && (
        <div
          data-nav-panel
          className="hidden lg:block fixed top-0 bottom-0 left-14 w-60 bg-card border-r border-card-border z-30 overflow-y-auto shadow-lg"
        >
          {(() => {
            const cat = categories.find((c) => c.key === activeCategory);
            if (!cat) return null;

            return (
              <div className="py-3">
                {/* Panel header */}
                <div className="px-4 pb-2 mb-1 border-b border-card-border">
                  <h2 className="text-sm font-semibold text-foreground">
                    {cat.label}
                  </h2>
                </div>

                {/* Trial banner */}
                {isTrialing && daysLeft <= 7 && (
                  <Link
                    href="/billing"
                    className="mx-3 mt-2 mb-1 block px-3 py-2 bg-accent-amber/10 border border-accent-amber/20 rounded-lg text-xs text-accent-amber hover:bg-accent-amber/15 transition-colors"
                  >
                    {daysLeft} day{daysLeft !== 1 ? "s" : ""} left in trial
                    &mdash; <span className="font-medium">Subscribe</span>
                  </Link>
                )}

                {/* Sections */}
                {cat.sections.map((section) => (
                  <div key={section.label} className="px-2 mt-2">
                    {/* Only show sub-headers if multiple sections */}
                    {cat.sections.length > 1 && (
                      <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted/70">
                        {section.label}
                      </p>
                    )}
                    <div className="space-y-0.5">
                      {section.items.map((item) => {
                        const active = isActive(item.href);
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                              active
                                ? "bg-accent/10 text-accent font-medium"
                                : "text-muted hover:text-foreground hover:bg-foreground/[0.05]"
                            }`}
                          >
                            <Icon
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

                {/* Quick links for account/billing in the panel */}
                {cat.key === "Tools" && (
                  <div className="px-2 mt-4 pt-3 border-t border-card-border">
                    <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted/70">
                      Account
                    </p>
                    <div className="space-y-0.5">
                      <Link
                        href="/account"
                        className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
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
                        className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                          pathname === "/billing"
                            ? "bg-accent/10 text-accent font-medium"
                            : "text-muted hover:text-foreground hover:bg-foreground/[0.05]"
                        }`}
                      >
                        <CreditCard size={14} />
                        Billing & API Keys
                      </Link>
                      <button
                        onClick={() => signOut({ callbackUrl: "/" })}
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm text-accent-red/70 hover:text-accent-red hover:bg-accent-red/5 transition-colors"
                      >
                        <LogOut size={14} />
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ================================================================ */}
      {/* ── MOBILE: Top bar + Drawer ── */}
      {/* ================================================================ */}

      {/* Top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-b border-card-border">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Activity size={18} className="text-accent" />
            <span className="text-sm font-semibold">Alberta Pulse Check</span>
          </Link>
          <div className="flex items-center gap-1">
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

      {/* Backdrop */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`lg:hidden fixed top-0 left-0 z-50 h-full w-72 bg-card border-r border-card-border transition-transform duration-300 flex flex-col ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo row */}
        <div className="px-4 py-4 border-b border-card-border flex items-center justify-between shrink-0">
          <Link
            href="/dashboard"
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
            const isOpen = !mobileCollapsed[section.label];
            const sectionActive = section.items.some((item) =>
              isActive(item.href)
            );

            return (
              <div key={section.label}>
                <button
                  onClick={() => toggleMobileSection(section.label)}
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
                    isOpen ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  <div className="ml-2 border-l border-card-border pl-1 space-y-0.5 py-0.5">
                    {section.items.map((item) => {
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
            );
          })}
        </div>

        {/* Bottom: account quick links */}
        <div className="shrink-0 border-t border-card-border p-2 space-y-0.5">
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
    </>
  );
}
