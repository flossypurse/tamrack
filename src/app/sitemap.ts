import type { MetadataRoute } from "next";
import { CHART_REGISTRY } from "@/lib/chart-registry";
import { SITE_URL as BASE_URL } from "@/lib/constants/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date().toISOString();

  const publicPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${BASE_URL}/charts`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/access-request`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];

  const chartEntries: MetadataRoute.Sitemap = CHART_REGISTRY.map((c) => ({
    url: `${BASE_URL}/charts/${c.id}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  return [...publicPages, ...chartEntries];
}
