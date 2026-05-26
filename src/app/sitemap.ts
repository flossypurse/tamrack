import type { MetadataRoute } from "next";
import { CHART_REGISTRY } from "@/lib/chart-registry";
import { COURSE_MODULES } from "@/lib/learn-course";
import { SITE_URL as BASE_URL } from "@/lib/constants/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date().toISOString();

  const publicPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${BASE_URL}/charts`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE_URL}/learn`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/access-request`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/sunset`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];

  const chartEntries: MetadataRoute.Sitemap = CHART_REGISTRY.map((c) => ({
    url: `${BASE_URL}/charts/${c.id}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  // Tamrack Learn — every lesson page is public, content-rich, and ranks for
  // long-tail Alberta-economics queries. Skip unlocked-only checks here; the
  // crawler can read every lesson via direct URL.
  const learnEntries: MetadataRoute.Sitemap = COURSE_MODULES.flatMap((mod) =>
    mod.lessons.map((lesson) => ({
      url: `${BASE_URL}/learn/${mod.slug}/${lesson.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  );

  return [...publicPages, ...chartEntries, ...learnEntries];
}
