"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
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
} from "lucide-react";
import { useTheme } from "next-themes";
import {
  getLiveMunicipalities,
  getMunicipalitiesByRegion,
  REGION_LABELS,
  REGION_ORDER,
} from "@/lib/municipality-registry";

// ============================================================
// Nav structure — add new pages here
// ============================================================

type NavItem = { href: string; label: string; icon: React.ElementType };
type NavSection = { label: string; icon: React.ElementType; items: NavItem[] };

// Build municipality nav items grouped by region (only live municipalities)
function buildMunicipalityNav(): NavSection[] {
  const byRegion = getMunicipalitiesByRegion();
  const live = getLiveMunicipalities();
  const sections: NavSection[] = [];

  // "Explore All" link
  sections.push({
    label: "Municipalities",
    icon: Globe,
    items: [
      { href: "/municipalities", label: `All (${live.length} live)`, icon: Globe },
      { href: "/coverage", label: "Data Coverage", icon: Database },
      // Edmonton (special — uses SODA, not registry)
      { href: "/dashboard", label: "Edmonton", icon: Building2 },
    ],
  });

  for (const region of REGION_ORDER) {
    const municipalities = (byRegion[region] || []).filter((m) => m.status === "live");
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
    ],
  },
  {
    label: "Economy",
    icon: PieChart,
    items: [
      { href: "/energy", label: "Energy", icon: Flame },
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

const toolsSections: NavSection[] = [
  {
    label: "Tools",
    icon: GraduationCap,
    items: [
      { href: "/learn", label: "Learn", icon: GraduationCap },
      { href: "/docs", label: "API Docs", icon: BookOpen },
      { href: "/sources", label: "Data Sources", icon: Database },
    ],
  },
];

// ============================================================
// Sidebar Nav
// ============================================================

export function Nav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Build full section list (municipalities are dynamic from registry)
  const municipalitySections = buildMunicipalityNav();
  const allSections = [...coreSections, ...municipalitySections, ...toolsSections];

  // Auto-collapse municipality regions by default (keep core sections open)
  useEffect(() => {
    const defaults: Record<string, boolean> = {};
    for (const region of REGION_ORDER) {
      const label = REGION_LABELS[region];
      // Collapse regions that don't have the active page
      const section = municipalitySections.find((s) => s.label === label);
      if (section && !section.items.some((item) => pathname.startsWith(item.href))) {
        defaults[label] = true;
      }
    }
    setCollapsed((prev) => ({ ...defaults, ...prev }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close mobile nav on route change
  useEffect(() => {
    setMobileOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile nav is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const toggleSection = (label: string) => {
    setCollapsed((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/municipalities") return pathname === "/municipalities";
    return pathname.startsWith(href);
  };

  const isSectionActive = (section: NavSection) =>
    section.items.some((item) => isActive(item.href));

  const isAdmin = session?.user?.role === "admin";
  const isTrialing = session?.user?.subscriptionStatus === "trialing";
  const trialEnd = session?.user?.trialEnd ? new Date(session.user.trialEnd) : null;
  const daysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;

  // Shared nav content
  const navContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-card-border flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <Activity size={22} className="text-accent shrink-0" />
          <span className="text-base font-semibold tracking-tight">
            Alberta Pulse Check
          </span>
        </Link>
        {mounted && (
          <button
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="p-1.5 rounded-lg hover:bg-foreground/[0.05] text-muted hover:text-foreground transition-colors"
            aria-label="Toggle theme"
          >
            {resolvedTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        )}
      </div>

      {/* Trial banner */}
      {isTrialing && daysLeft <= 7 && (
        <Link href="/billing" className="mx-2 mt-2 px-3 py-2 bg-accent-amber/10 border border-accent-amber/20 rounded-lg text-xs text-accent-amber hover:bg-accent-amber/15 transition-colors">
          {daysLeft} day{daysLeft !== 1 ? "s" : ""} left in trial — <span className="font-medium">Subscribe</span>
        </Link>
      )}

      {/* Sections */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {allSections.map((section) => {
          const isOpen = !collapsed[section.label];
          const sectionActive = isSectionActive(section);

          return (
            <div key={section.label}>
              {/* Section header */}
              <button
                onClick={() => toggleSection(section.label)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium uppercase tracking-wider transition-colors ${
                  sectionActive
                    ? "text-foreground"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <section.icon size={14} className={sectionActive ? "text-accent" : ""} />
                <span className="flex-1 text-left">{section.label}</span>
                <ChevronDown
                  size={12}
                  className={`transition-transform duration-200 ${
                    isOpen ? "" : "-rotate-90"
                  }`}
                />
              </button>

              {/* Section items */}
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
                        className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                          active
                            ? "bg-accent/10 text-accent font-medium"
                            : "text-muted hover:text-foreground hover:bg-foreground/[0.05]"
                        }`}
                      >
                        <item.icon size={14} className={active ? "text-accent" : ""} />
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

      {/* User section */}
      <div className="border-t border-card-border">
        {isAdmin && (
          <Link
            href="/admin"
            className={`flex items-center gap-2.5 mx-2 mt-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
              pathname === "/admin"
                ? "bg-accent/10 text-accent font-medium"
                : "text-muted hover:text-foreground hover:bg-foreground/[0.05]"
            }`}
          >
            <Shield size={14} />
            Admin
          </Link>
        )}
        <div className="relative px-2 py-2">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-foreground/[0.05] transition-colors text-left"
          >
            <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
              <User size={14} className="text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{session?.user?.name || session?.user?.email || "Account"}</p>
              <p className="text-[10px] text-muted/60 truncate">{session?.user?.email}</p>
            </div>
            <ChevronDown size={12} className={`text-muted transition-transform ${userMenuOpen ? "rotate-180" : ""}`} />
          </button>

          {/* User dropdown */}
          {userMenuOpen && (
            <div className="absolute bottom-full left-2 right-2 mb-1 bg-card border border-card-border rounded-lg shadow-lg overflow-hidden z-50">
              <Link
                href="/account"
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-muted hover:text-foreground hover:bg-foreground/[0.05] transition-colors"
              >
                <User size={14} />
                Account
              </Link>
              <Link
                href="/billing"
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-muted hover:text-foreground hover:bg-foreground/[0.05] transition-colors"
              >
                <CreditCard size={14} />
                Billing & API Keys
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-accent-red/70 hover:text-accent-red hover:bg-accent-red/5 transition-colors"
              >
                <LogOut size={14} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Mobile top bar ── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-b border-card-border">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Activity size={18} className="text-accent" />
            <span className="text-sm font-semibold">Alberta Pulse Check</span>
          </Link>
          <div className="flex items-center gap-1">
            {mounted && (
              <button
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                className="p-1.5 rounded-lg hover:bg-foreground/[0.05] text-muted hover:text-foreground transition-colors"
                aria-label="Toggle theme"
              >
                {resolvedTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
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

      {/* ── Mobile drawer backdrop ── */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Mobile drawer ── */}
      <div
        className={`lg:hidden fixed top-0 left-0 z-50 h-full w-64 bg-card border-r border-card-border transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {navContent}
      </div>

      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-56 bg-card border-r border-card-border z-30">
        {navContent}
      </aside>
    </>
  );
}
