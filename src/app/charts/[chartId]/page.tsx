import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, ArrowRight, Code, ExternalLink } from "lucide-react";
import {
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  getChartById,
  getChartsByCategory,
  type ChartMeta,
} from "@/lib/chart-registry";
import { resolveChart } from "@/lib/chart-resolver";
import { BreadcrumbJsonLd } from "@/components/json-ld";
import { ChartPageActions } from "./chart-actions";
import { SITE_URL } from "@/lib/constants/site";

// Render on demand: chart resolvers call StatsCan / CMHC / Edmonton Socrata
// during render, and prerendering all 110+ chartIds at build time made the CI
// build hostage to upstream uptime. Force-dynamic shifts the cost to the first
// request after deploy; that response is cached at the edge for typical TTLs.
export const dynamic = "force-dynamic";

// ============================================================
// Metadata
// ============================================================

export async function generateMetadata({
  params,
}: {
  params: Promise<{ chartId: string }>;
}): Promise<Metadata> {
  const { chartId } = await params;
  const meta = getChartById(chartId);
  if (!meta) {
    return { title: "Chart Not Found — Tamrack" };
  }

  return {
    title: `${meta.title} — Tamrack`,
    description: meta.description,
    alternates: { canonical: `${SITE_URL}/charts/${chartId}` },
    openGraph: {
      title: `${meta.title} — Tamrack`,
      description: meta.description,
      type: "article",
      images: [
        {
          url: `/api/og?title=${encodeURIComponent(meta.title)}&subtitle=${encodeURIComponent(meta.source)}`,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.description,
    },
  };
}

// ============================================================
// Chart renderer (async server component)
// ============================================================

async function ChartRenderer({ chartId }: { chartId: string }) {
  const chart = resolveChart(chartId);
  if (!chart) {
    return (
      <div className="flex items-center justify-center h-64 text-muted text-sm">
        Chart data unavailable
      </div>
    );
  }

  const rendered = await chart.render();
  return <>{rendered}</>;
}

function ChartLoadingFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-2">
        <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        <span className="text-xs text-muted">Loading chart data...</span>
      </div>
    </div>
  );
}

// ============================================================
// Frequency labels
// ============================================================

const FREQUENCY_LABELS: Record<string, string> = {
  realtime: "Real-time",
  hourly: "Every hour",
  daily: "Every day",
  weekly: "Every week",
  monthly: "Every month",
  quarterly: "Every quarter",
  annual: "Every year",
};

// ============================================================
// Page
// ============================================================

export default async function ChartDetailPage({
  params,
}: {
  params: Promise<{ chartId: string }>;
}) {
  const { chartId } = await params;
  const meta = getChartById(chartId);
  if (!meta) notFound();

  // Related charts: same category, different chart
  const related = getChartsByCategory(meta.category)
    .filter((c) => c.id !== meta.id)
    .slice(0, 6);

  return (
    <main className="px-4 sm:px-6 py-6 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted mb-6">
        <Link href="/charts" className="hover:text-accent transition-colors flex items-center gap-1">
          <ArrowLeft size={12} />
          Chart Catalogue
        </Link>
        <span>/</span>
        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-medium ${CATEGORY_COLORS[meta.category]}`}>
          {CATEGORY_LABELS[meta.category]}
        </span>
        <span>/</span>
        <span className="text-foreground">{meta.subcategory}</span>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        {/* Main column: chart */}
        <div>
          {/* Chart card */}
          <div className="bg-card border border-card-border rounded-xl p-4 sm:p-6 mb-4">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-lg sm:text-xl font-bold">{meta.title}</h1>
                <p className="text-sm text-muted mt-1">{meta.description}</p>
              </div>
              <span className="text-[10px] font-mono bg-accent/10 text-accent px-2 py-0.5 rounded-full shrink-0 ml-3">
                LIVE
              </span>
            </div>

            {/* Chart */}
            <Suspense fallback={<ChartLoadingFallback />}>
              <ChartRenderer chartId={chartId} />
            </Suspense>

            {/* Bottom bar — "View in context" link hidden during EARLY_ACCESS
                because most overview pages (/economy/energy etc.) are auth-walled
                during the invite-only window. Re-enable when the gate lifts. */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-card-border">
              <span className="text-[10px] text-muted/60 font-mono">{meta.source}</span>
              {process.env.EARLY_ACCESS === "false" && (
                <Link
                  href={meta.pageHref}
                  className="text-[10px] text-accent hover:text-accent/80 transition-colors flex items-center gap-1"
                >
                  View in context <ArrowRight size={10} />
                </Link>
              )}
            </div>
          </div>

          {/* Client-side actions: embed, share, export */}
          <ChartPageActions chartId={chartId} title={meta.title} />
        </div>

        {/* Sidebar: metadata */}
        <aside className="space-y-4">
          {/* Data source info */}
          <div className="bg-card border border-card-border rounded-xl p-4">
            <h2 className="text-xs font-medium text-muted uppercase tracking-wider mb-3">
              Data Source
            </h2>
            <dl className="space-y-2.5">
              <div>
                <dt className="text-[10px] text-muted/60 uppercase">Source</dt>
                <dd className="text-sm font-medium">
                  {meta.sourceUrl ? (
                    <a
                      href={meta.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline inline-flex items-center gap-1"
                    >
                      {meta.source} <ExternalLink size={10} />
                    </a>
                  ) : (
                    meta.source
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] text-muted/60 uppercase">Update Frequency</dt>
                <dd className="text-sm">{FREQUENCY_LABELS[meta.updateFrequency]}</dd>
              </div>
              <div>
                <dt className="text-[10px] text-muted/60 uppercase">Category</dt>
                <dd>
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[meta.category]}`}
                  >
                    {CATEGORY_LABELS[meta.category]}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-[10px] text-muted/60 uppercase">Section</dt>
                <dd className="text-sm">{meta.subcategory}</dd>
              </div>
            </dl>
          </div>

          {/* Tags */}
          <div className="bg-card border border-card-border rounded-xl p-4">
            <h2 className="text-xs font-medium text-muted uppercase tracking-wider mb-3">
              Tags
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {meta.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/charts?q=${encodeURIComponent(tag)}`}
                  className="text-[10px] text-muted px-2 py-0.5 bg-background rounded-full border border-card-border hover:border-accent/30 hover:text-accent transition-colors"
                >
                  {tag}
                </Link>
              ))}
            </div>
          </div>

          {/* Breadcrumb structured data */}
          <BreadcrumbJsonLd
            items={[
              { name: "Home", url: SITE_URL },
              { name: "Charts", url: `${SITE_URL}/charts` },
              { name: meta.title, url: `${SITE_URL}/charts/${meta.id}` },
            ]}
          />

          {/* Structured data for SEO */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Dataset",
                name: meta.title,
                description: meta.description,
                url: `${SITE_URL}/charts/${meta.id}`,
                creator: {
                  "@type": "Organization",
                  name: "Tamrack",
                  url: SITE_URL,
                },
                distribution: {
                  "@type": "DataDownload",
                  encodingFormat: "text/html",
                  contentUrl: `${SITE_URL}/embed/${meta.id}`,
                },
                license: `${SITE_URL}/terms`,
                temporalCoverage: "..",
                spatialCoverage: {
                  "@type": "Place",
                  name: "Alberta, Canada",
                },
                variableMeasured: meta.title,
                isAccessibleForFree: true,
              }),
            }}
          />
        </aside>
      </div>

      {/* Related charts */}
      {related.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold mb-4">
            More in {CATEGORY_LABELS[meta.category]}
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {related.map((chart) => (
              <Link
                key={chart.id}
                href={`/charts/${chart.id}`}
                className="group bg-card border border-card-border rounded-xl p-3 hover:border-accent transition-colors"
              >
                <h3 className="text-sm font-medium group-hover:text-accent transition-colors">
                  {chart.title}
                </h3>
                <p className="text-[11px] text-muted mt-1 line-clamp-2">{chart.description}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-muted/50 font-mono">{chart.source}</span>
                  <ArrowRight size={12} className="text-muted/30 group-hover:text-accent transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Powered by */}
      <div className="mt-10 pt-6 border-t border-card-border text-center">
        <p className="text-[10px] text-muted/40">
          Powered by Tamrack — live Alberta data from government sources
        </p>
      </div>
    </main>
  );
}
