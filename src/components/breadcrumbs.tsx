"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

/** Map slugs → display labels for breadcrumbs */
const LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  signals: "Signals",
  energy: "Energy",
  drilling: "Drilling",
  cycle: "Boom-Bust Cycle",
  diversification: "Diversification",
  labour: "Labour",
  migration: "Migration",
  agriculture: "Agriculture",
  prospects: "Prospect Leads",
  "real-estate": "Market Intel",
  micro: "Neighbourhoods",
  pipeline: "Dev Pipeline",
  rental: "Rental Intel",
  commercial: "Commercial",
  benchmarks: "Benchmarks",
  corridors: "Growth Corridors",
  risk: "Market Risk",
  invest: "Investment Thesis",
  compare: "Compare",
  weather: "Weather",
  "air-quality": "Air Quality",
  water: "Water & Rivers",
  wildfire: "Wildfire",
  traffic: "Traffic & Roads",
  earthquakes: "Seismic",
  emergencies: "Emergencies",
  elections: "Politics",
  municipalities: "Municipalities",
  coverage: "Data Coverage",
  m: "Municipality",
  learn: "Learn",
  docs: "API Docs",
  sources: "Data Sources",
  account: "Account",
  billing: "Billing",
  admin: "Admin",
};

/** Section grouping for breadcrumb parent */
const SECTION_MAP: Record<string, string> = {
  energy: "Economy",
  drilling: "Economy",
  cycle: "Economy",
  diversification: "Economy",
  labour: "Economy",
  migration: "Economy",
  agriculture: "Economy",
  prospects: "Real Estate",
  "real-estate": "Real Estate",
  micro: "Real Estate",
  pipeline: "Real Estate",
  rental: "Real Estate",
  commercial: "Real Estate",
  benchmarks: "Intelligence",
  corridors: "Intelligence",
  risk: "Intelligence",
  invest: "Intelligence",
  compare: "Intelligence",
  weather: "Environment",
  "air-quality": "Environment",
  water: "Environment",
  wildfire: "Environment",
  traffic: "Public Safety",
  earthquakes: "Public Safety",
  emergencies: "Public Safety",
  elections: "Public Safety",
  coverage: "Municipalities",
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0 || pathname === "/dashboard") return null;

  const crumbs: { label: string; href?: string }[] = [];

  // Add section parent if applicable
  const firstSegment = segments[0];
  const sectionName = SECTION_MAP[firstSegment];
  if (sectionName) {
    crumbs.push({ label: sectionName });
  }

  // For /m/[slug] routes, add Municipalities parent
  if (firstSegment === "m") {
    crumbs.push({ label: "Municipalities", href: "/municipalities" });
    if (segments[1]) {
      // Capitalize slug for display
      const name = segments[1]
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      crumbs.push({ label: name });
    }
  } else {
    crumbs.push({ label: LABELS[firstSegment] || firstSegment });
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
