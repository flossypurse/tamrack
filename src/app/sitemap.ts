import type { MetadataRoute } from "next";
import { getLiveMunicipalities } from "@/lib/municipality-registry";

const BASE_URL = "https://albertapulsecheck.ca";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date().toISOString();

  // Core public pages
  const publicPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${BASE_URL}/municipalities`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE_URL}/coverage`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];

  // Macro economy pages (high SEO value — Alberta-wide data)
  const macroPages = [
    "dashboard", "energy", "cycle", "diversification", "labour", "migration",
    "agriculture", "signals", "pipeline", "rental", "commercial", "drilling",
    "compare", "real-estate", "invest", "risk", "weather", "wildfire",
    "air-quality", "water", "earthquakes", "traffic", "elections", "emergencies",
    "corridors", "benchmarks", "learn", "docs", "sources",
  ];
  const macroEntries: MetadataRoute.Sitemap = macroPages.map((slug) => ({
    url: `${BASE_URL}/${slug}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  // Municipality deep-dive pages (long-tail SEO gold)
  const liveMunicipalities = getLiveMunicipalities();
  const municipalityEntries: MetadataRoute.Sitemap = liveMunicipalities.map((m) => ({
    url: `${BASE_URL}/m/${m.slug}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  return [...publicPages, ...macroEntries, ...municipalityEntries];
}
