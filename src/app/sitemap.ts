import type { MetadataRoute } from "next";
import { getLiveMunicipalities } from "@/lib/municipality-registry";

const BASE_URL = "https://albertapulsecheck.ca";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date().toISOString();

  // Core public pages
  const publicPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${BASE_URL}/dashboard`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/municipalities`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE_URL}/municipalities/coverage`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];

  // Category pages (high SEO value — Alberta-wide data)
  const categoryPages = [
    // Overview
    "overview/signals",
    // Economy
    "economy/energy", "economy/drilling", "economy/cycle", "economy/diversification",
    "economy/labour", "economy/migration", "economy/agriculture",
    // Real Estate
    "real-estate/prospects", "real-estate/market", "real-estate/neighbourhoods",
    "real-estate/pipeline", "real-estate/rental", "real-estate/commercial",
    // Intelligence
    "intelligence/benchmarks", "intelligence/corridors", "intelligence/risk",
    "intelligence/invest", "intelligence/compare",
    // Environment
    "environment/weather", "environment/wildfire", "environment/air-quality",
    "environment/water",
    // Safety
    "safety/traffic", "safety/seismic", "safety/elections", "safety/emergencies",
    // Tools
    "tools/learn", "tools/docs", "tools/sources",
  ];
  const categoryEntries: MetadataRoute.Sitemap = categoryPages.map((slug) => ({
    url: `${BASE_URL}/${slug}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  // Municipality deep-dive pages (long-tail SEO gold)
  const liveMunicipalities = getLiveMunicipalities();
  const municipalityEntries: MetadataRoute.Sitemap = liveMunicipalities.map((m) => ({
    url: `${BASE_URL}/municipalities/${m.slug}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  return [...publicPages, ...categoryEntries, ...municipalityEntries];
}
