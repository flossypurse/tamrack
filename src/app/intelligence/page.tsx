import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/card";
import {
  Scale,
  Rocket,
  ShieldAlert,
  TrendingUp,
  GitCompare,
  ArrowRight,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Alberta Intelligence — Benchmarks, Risk & Investment Analysis",
  description:
    "Synthesized intelligence for Alberta — municipal benchmarks, growth corridor ranking, market risk scoring, investment thesis, and side-by-side comparison tools.",
};

const pages = [
  {
    href: "/intelligence/benchmarks",
    icon: Scale,
    title: "Municipal Benchmarks",
    description:
      "Side-by-side comparison of Alberta municipalities on permits, assessments, population, and business activity. Benchmarking normalizes data by population so you can fairly compare a city of 1 million to a town of 15,000. Useful for identifying which communities are punching above their weight.",
    sources: "Municipality registry, regional dashboard, Statistics Canada",
  },
  {
    href: "/intelligence/corridors",
    icon: Rocket,
    title: "Growth Corridors",
    description:
      "Municipalities ranked by a composite growth score that blends population growth, permit volume, business formation, assessment increases, and net migration. The ranking isn't a recommendation — it's a signal of where economic momentum is concentrated right now.",
    sources: "Municipality registry, regional dashboard data",
  },
  {
    href: "/intelligence/risk",
    icon: ShieldAlert,
    title: "Market Risk",
    description:
      "Composite risk scoring for each municipality based on employment concentration (how dependent is the local economy on one employer or sector?), vacancy rates, supply pipeline pressure, interest rate sensitivity, and insolvency trends. Higher risk doesn't mean \"avoid\" — it means price accordingly.",
    sources: "Statistics Canada, Bank of Canada",
  },
  {
    href: "/intelligence/invest",
    icon: TrendingUp,
    title: "Investment Thesis",
    description:
      "The synthesis page. Takes the current macro cycle position, energy outlook, rate environment, and migration momentum and frames them as a coherent investment view. This page is opinionated — it tells you where we are in the cycle and what that historically means for real estate timing.",
    sources: "Bank of Canada, Statistics Canada",
  },
  {
    href: "/intelligence/compare",
    icon: GitCompare,
    title: "Compare",
    description:
      "Pick any two or more municipalities and compare them head-to-head across every data dimension we track — permits, assessments, population, business formation, and more. Useful when you're choosing between markets or trying to spot divergences between similar communities.",
    sources: "Municipality registry, all municipal data sources",
  },
];

export default function IntelligencePage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Intelligence"
        category="intelligence"
        icon={<Scale size={22} />}
        description="Analysis and synthesis layers built on top of the raw economic and real estate data."
      />

      {/* Explainer */}
      <Card>
        <div className="prose-sm space-y-3 text-sm text-muted">
          <p>
            The pages in{" "}
            <Link href="/economy" className="underline text-foreground hover:text-accent transition-colors">Economy</Link> and{" "}
            <Link href="/real-estate" className="underline text-foreground hover:text-accent transition-colors">Real Estate</Link>{" "}
            show you raw data. This section <strong className="text-foreground">synthesizes it into views that support decisions</strong>.
          </p>
          <p>
            <strong className="text-foreground">Benchmarks</strong> and{" "}
            <strong className="text-foreground">Compare</strong> help you evaluate municipalities relative to each other.{" "}
            <strong className="text-foreground">Growth Corridors</strong> ranks them by momentum.{" "}
            <strong className="text-foreground">Market Risk</strong> scores them by downside exposure.{" "}
            <strong className="text-foreground">Investment Thesis</strong> pulls it all together into a macro view.
          </p>
          <p>
            A note on methodology: every score and ranking on these pages is{" "}
            <strong className="text-foreground">transparent and derived from public data</strong>.
            We show you the inputs and the weighting. Nothing is a black box.
            Reasonable people can disagree on the weights — the value is in the consistent framework, not the specific number.
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

      {/* Jargon box */}
      <Card>
        <h3 className="text-xs font-medium text-foreground uppercase tracking-wider mb-3">
          Common terms in this section
        </h3>
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="font-medium text-foreground inline">Composite score</dt>
            <dd className="text-muted inline">
              {" "}— A single number derived by blending multiple indicators with assigned weights.
              Useful for ranking, but always check the underlying components before acting on it.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground inline">Per-capita normalization</dt>
            <dd className="text-muted inline">
              {" "}— Dividing a metric by population to make municipalities comparable.
              Edmonton issuing 500 permits means something different than Sylvan Lake issuing 500.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground inline">Leading vs. lagging indicator</dt>
            <dd className="text-muted inline">
              {" "}— Leading indicators (permits, well licences, migration intent) move before the economy
              changes direction. Lagging indicators (unemployment, GDP) confirm what already happened.
              This section emphasizes leading indicators where possible.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground inline">Employment concentration</dt>
            <dd className="text-muted inline">
              {" "}— How dependent a local economy is on a small number of employers or industries.
              High concentration means a single plant closure or commodity crash can devastate the local market.
            </dd>
          </div>
        </dl>
      </Card>
    </main>
  );
}
