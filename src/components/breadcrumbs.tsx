"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getMunicipality } from "@/lib/municipality-registry";

/** Map URL slugs → display labels */
const LABELS: Record<string, string> = {
  // Categories
  overview: "Overview",
  economy: "Economy",
  "real-estate": "Real Estate",
  intelligence: "Intelligence",
  environment: "Environment",
  safety: "Public Safety",
  municipalities: "Municipalities",
  tools: "Tools",

  // Overview pages
  signals: "Signals",
  briefing: "Briefings",

  // Economy pages
  energy: "Energy",
  drilling: "Drilling",
  cycle: "Boom-Bust Cycle",
  diversification: "Diversification",
  labour: "Labour",
  migration: "Migration",
  agriculture: "Agriculture",

  // Real Estate pages
  prospects: "Prospect Leads",
  market: "Market Intel",
  neighbourhoods: "Neighbourhoods",
  pipeline: "Dev Pipeline",
  rental: "Rental Intel",
  commercial: "Commercial",

  // Intelligence pages
  benchmarks: "Benchmarks",
  corridors: "Growth Corridors",
  risk: "Market Risk",
  invest: "Investment Thesis",
  compare: "Compare",

  // Environment pages
  weather: "Weather",
  "air-quality": "Air Quality",
  water: "Water & Rivers",
  wildfire: "Wildfire",

  // Safety pages
  traffic: "Traffic & Roads",
  seismic: "Seismic",
  emergencies: "Emergencies",
  elections: "Politics",

  // Municipalities
  coverage: "Data Coverage",

  // Tools pages
  learn: "Learn",
  docs: "API Docs",
  sources: "Data Sources",

  // Utility pages
  dashboard: "Dashboard",
  account: "Account",
  billing: "Billing",
  admin: "Admin",
};

/** Briefing role labels */
const BRIEFING_LABELS: Record<string, string> = {
  investor: "Investor",
  realtor: "Realtor",
  developer: "Developer",
  journalist: "Journalist",
  lender: "Lender",
  edo: "Economic Development",
  energy: "Energy Sector",
  "site-selection": "Site Selection",
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0 || pathname === "/dashboard") return null;

  const crumbs: { label: string; href?: string }[] = [];

  // Categories with sub-pages: use first segment as category breadcrumb
  const category = segments[0];

  // Categories that have their own index page
  const CATEGORY_HREFS: Record<string, string> = {
    economy: "/economy",
    "real-estate": "/real-estate",
    intelligence: "/intelligence",
    environment: "/environment",
    safety: "/safety",
    municipalities: "/municipalities",
    tools: "/tools",
    overview: "/dashboard",
  };

  if (segments.length >= 2 && LABELS[category]) {
    // Category crumb — linked if it has an index page
    crumbs.push({
      label: LABELS[category],
      href: CATEGORY_HREFS[category],
    });

    // Municipality deep-dive: /municipalities/[slug]
    if (category === "municipalities" && segments[1] !== "coverage") {
      const config = getMunicipality(segments[1]);
      crumbs.push({
        label: config?.name || segments[1].split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
      });
    }
    // Briefing sub-pages: /overview/briefing/[role]
    else if (category === "overview" && segments[1] === "briefing" && segments[2]) {
      crumbs.push({ label: "Briefings", href: "/overview/briefing" });
      crumbs.push({ label: BRIEFING_LABELS[segments[2]] || segments[2] });
    }
    // Standard category/page
    else {
      crumbs.push({ label: LABELS[segments[1]] || segments[1] });
    }
  } else {
    // Single-segment pages (dashboard, account, billing, etc.)
    crumbs.push({ label: LABELS[category] || category });
  }

  return (
    <nav className="flex items-center gap-1.5 text-xs text-muted mb-4 px-1">
      <Link
        href="/dashboard"
        className="hover:text-foreground transition-colors"
      >
        Home
      </Link>
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <ChevronRight size={10} className="text-muted/40" />
          {crumb.href ? (
            <Link
              href={crumb.href}
              className="hover:text-foreground transition-colors"
            >
              {crumb.label}
            </Link>
          ) : (
            <span className="text-foreground/70">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
