import type { MetadataRoute } from "next";
import { getLiveMunicipalities } from "@/lib/municipality-registry";
import { CHART_REGISTRY } from "@/lib/chart-registry";
import { SITE_URL as BASE_URL } from "@/lib/constants/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date().toISOString();

  // Core public pages
  const publicPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${BASE_URL}/home/dashboard`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/charts`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/municipalities`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE_URL}/municipalities/coverage`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE_URL}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];

  // Category pages (high SEO value — Alberta-wide data)
  const categoryPages = [
    // Home
    "home/signals",
    // Economy
    "economy/energy", "economy/drilling", "economy/boom-bust", "economy/diversification",
    "economy/agriculture", "economy/cannabis",
    "economy/benchmarks", "economy/corridors", "economy/risk",
    "economy/cycle-position", "economy/invest", "economy/compare",
    // Real Estate
    "real-estate/prospects", "real-estate/market", "real-estate/neighbourhoods",
    "real-estate/pipeline", "real-estate/rental", "real-estate/commercial",
    // Community
    "community/labour", "community/immigration",
    "community/health", "community/demographics", "community/mortality",
    "community/crime", "community/fire-response", "community/traffic",
    "community/seismic", "community/emergencies",
    // Environment
    "environment/weather", "environment/air-quality",
    "environment/water", "environment/wildfire", "environment/emissions",
    // Governance
    "governance/elections",
    // Tools
    "tools/docs", "tools/sources",
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

  // Individual chart pages (SEO gold — each chart is a searchable data asset)
  const chartEntries: MetadataRoute.Sitemap = CHART_REGISTRY.map((c) => ({
    url: `${BASE_URL}/charts/${c.id}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  // Pulse Learn — free public course pages
  const learnPages = [
    "learn",
    "learn/certificate",
    // Alberta 101
    "learn/alberta-101/geography",
    "learn/alberta-101/regions",
    "learn/alberta-101/people",
    "learn/alberta-101/quiz",
    // Energy Engine
    "learn/energy-engine/commodities",
    "learn/energy-engine/gdp-sectors",
    "learn/energy-engine/jobs-shockwave",
    "learn/energy-engine/migration",
    "learn/energy-engine/diversification",
    "learn/energy-engine/quiz",
    // Housing Machine
    "learn/housing-machine/policy-rate",
    "learn/housing-machine/mortgage-rates",
    "learn/housing-machine/construction",
    "learn/housing-machine/vacancy-rent",
    "learn/housing-machine/quiz",
    // People & Growth
    "learn/people-growth/demographics",
    "learn/people-growth/immigration",
    "learn/people-growth/labour-market",
    "learn/people-growth/quiz",
    // Tax Dollars
    "learn/tax-dollars/property-tax",
    "learn/tax-dollars/municipal-budgets",
    "learn/tax-dollars/provincial-federal",
    "learn/tax-dollars/quiz",
    // Community Levers
    "learn/community-levers/municipal-powers",
    "learn/community-levers/zoning-development",
    "learn/community-levers/economic-development",
    "learn/community-levers/quiz",
    // Safety & Prosperity
    "learn/safety-prosperity/crime-economics",
    "learn/safety-prosperity/health-outcomes",
    "learn/safety-prosperity/environment-economy",
    "learn/safety-prosperity/quiz",
    // Reading the Signals
    "learn/reading-signals/leading-lagging",
    "learn/reading-signals/chain-reactions",
    "learn/reading-signals/dashboard-reading",
    "learn/reading-signals/quiz",
  ];
  const learnEntries: MetadataRoute.Sitemap = learnPages.map((slug) => ({
    url: `${BASE_URL}/${slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: slug === "learn" ? 0.8 : 0.6,
  }));

  return [...publicPages, ...categoryEntries, ...municipalityEntries, ...chartEntries, ...learnEntries];
}
