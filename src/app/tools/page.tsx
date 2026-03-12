import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/card";
import {
  Wrench,
  GraduationCap,
  BookOpen,
  Database,
  ArrowRight,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Tools — Learn, API Docs & Data Sources",
  description:
    "Educational tools, API documentation, and a complete data source reference for Alberta Pulse Check.",
};

const pages = [
  {
    href: "/tools/learn",
    icon: GraduationCap,
    title: "Learn Alberta Economics",
    description:
      "Interactive educational content that uses live dashboard data to teach economic concepts — how interest rates work, what drives Alberta's boom-bust cycle, how to read labour statistics, and what leading vs. lagging indicators mean in practice. Designed for anyone who wants to go from \"I see the numbers\" to \"I understand what they mean.\"",
    sources: "Bank of Canada, Statistics Canada, Edmonton Open Data",
  },
  {
    href: "/tools/docs",
    icon: BookOpen,
    title: "API Documentation",
    description:
      "Interactive documentation for Alberta Pulse Check's API endpoints. If you're a developer building on top of this data — or want to integrate it into your own tools, dashboards, or analysis pipelines — this page lets you explore endpoints, see request/response shapes, and test queries live.",
    sources: "Internal API reference",
  },
  {
    href: "/tools/sources",
    icon: Database,
    title: "Data Sources",
    description:
      "A complete, transparent catalogue of every external data source powering this dashboard — Bank of Canada, Statistics Canada, Alberta Open Data, CMHC, AER, Environment Canada, municipal ArcGIS servers, and more. Each entry includes the source URL, update frequency, and what we use it for. If you want to verify a number or go deeper, start here.",
    sources: "Reference page — no live data",
  },
];

export default function ToolsPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Tools & Reference"
        category="tools"
        icon={<Wrench size={22} />}
        description="Learn, build, and verify — educational content, API access, and source transparency."
      />

      {/* Explainer */}
      <Card>
        <div className="prose-sm space-y-3 text-sm text-muted">
          <p>
            This section is about <strong className="text-foreground">understanding and extending</strong> the data
            in the rest of the dashboard.
          </p>
          <p>
            <strong className="text-foreground">Learn</strong> is for building economic literacy — whether you're
            a realtor who wants to explain interest rate impacts to clients, an investor trying to understand
            the boom-bust cycle, or anyone who wants to be more fluent with the numbers on the other pages.
            It uses the same live data as the rest of the dashboard, so the examples are always current.
          </p>
          <p>
            <strong className="text-foreground">API Docs</strong> is for developers. Alberta Pulse Check
            exposes its data through REST API endpoints — if you want to pull this data into your own tools,
            that's where to start.
          </p>
          <p>
            <strong className="text-foreground">Data Sources</strong> is our commitment to transparency.
            Every number on this dashboard comes from a public government source, and this page tells you
            exactly which one. No proprietary data, no black boxes. If you see something that looks wrong,
            you can trace it back to the original source and verify it yourself.
          </p>
        </div>
      </Card>

      {/* Page grid */}
      <div className="space-y-3">
        {pages.map((page) => (
          <Link key={page.href} href={page.href} className="group block">
            <Card className="transition-colors hover:border-accent/30">
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5">
                  <page.icon
                    size={18}
                    className="text-muted group-hover:text-accent transition-colors"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-foreground group-hover:text-accent transition-colors">
                      {page.title}
                    </h3>
                    <ArrowRight
                      size={14}
                      className="text-muted group-hover:text-accent transition-colors"
                    />
                  </div>
                  <p className="text-sm text-muted mt-1 leading-relaxed">
                    {page.description}
                  </p>
                  <p className="text-[10px] font-mono text-muted/60 mt-2">
                    {page.sources}
                  </p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
