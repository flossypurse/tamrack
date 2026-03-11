"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
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
  MapPin,
  GraduationCap,
  Database,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";

// ============================================================
// Nav structure — add new pages here
// ============================================================

type NavItem = { href: string; label: string; icon: React.ElementType };
type NavSection = { label: string; icon: React.ElementType; items: NavItem[] };

const sections: NavSection[] = [
  {
    label: "Overview",
    icon: LayoutDashboard,
    items: [
      { href: "/", label: "Dashboard", icon: Activity },
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
      { href: "/real-estate", label: "Market Intel", icon: Home },
      { href: "/micro", label: "Neighbourhoods", icon: MapPin },
    ],
  },
  {
    label: "Tools",
    icon: GraduationCap,
    items: [
      { href: "/learn", label: "Learn", icon: GraduationCap },
      { href: "/sources", label: "Data Sources", icon: Database },
    ],
  },
];

// ============================================================
// Sidebar Nav
// ============================================================

export function Nav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Close mobile nav on route change
  useEffect(() => {
    setMobileOpen(false);
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
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const isSectionActive = (section: NavSection) =>
    section.items.some((item) => isActive(item.href));

  // Shared nav content
  const navContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-card-border">
        <Link href="/" className="flex items-center gap-2.5">
          <Activity size={22} className="text-accent shrink-0" />
          <span className="text-base font-semibold tracking-tight">
            Alberta Pulse Check
          </span>
        </Link>
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {sections.map((section) => {
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
                  isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
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
                            : "text-muted hover:text-foreground hover:bg-white/[0.03]"
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

      {/* Footer */}
      <div className="px-4 py-3 border-t border-card-border">
        <p className="text-[10px] text-muted/50 leading-relaxed">
          Live data from Bank of Canada, StatsCan, Edmonton Open Data &amp; more
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Mobile top bar ── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-b border-card-border">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <Activity size={18} className="text-accent" />
            <span className="text-sm font-semibold">Alberta Pulse Check</span>
          </Link>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-1.5 rounded-lg hover:bg-white/[0.05] text-muted hover:text-foreground transition-colors"
            aria-label="Toggle navigation"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
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
