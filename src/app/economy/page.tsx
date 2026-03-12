import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/card";
import {
  PieChart,
  Flame,
  Pickaxe,
  RefreshCw,
  Users,
  Plane,
  Wheat,
  ArrowRight,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Alberta Economy — Provincial Economic Data & Indicators",
  description:
    "Track Alberta's economy in real time — energy prices, drilling activity, labour markets, migration, diversification, and agriculture. Live data from Statistics Canada, Bank of Canada, and Alberta government sources.",
};

const pages = [
  {
    href: "/economy/energy",
    icon: Flame,
    title: "Energy",
    description:
      "Oil and gas commodity prices, the Bank of Canada's energy price index (BCPI), CAD/USD exchange rate, and mining & oil/gas GDP. This is the heartbeat of Alberta's economy — when energy moves, everything else follows.",
    sources: "Bank of Canada Valet, Statistics Canada",
  },
  {
    href: "/economy/drilling",
    icon: Pickaxe,
    title: "Drilling & Well Activity",
    description:
      "AER (Alberta Energy Regulator) well licence data, drilling trends, and oilfield service activity. Well licences are a leading indicator — companies apply for licences before they spend money, so a spike here signals confidence in future prices.",
    sources: "AER, Statistics Canada",
  },
  {
    href: "/economy/cycle",
    icon: RefreshCw,
    title: "Boom-Bust Cycle",
    description:
      "Where is Alberta in its economic cycle right now? This page cross-references oil prices, employment, migration, and construction against historical boom-bust patterns. Alberta has experienced roughly six major cycles since the 1970s — understanding the pattern helps you avoid buying at the top.",
    sources: "Bank of Canada, Statistics Canada, Alberta Activity Index",
  },
  {
    href: "/economy/diversification",
    icon: PieChart,
    title: "Diversification",
    description:
      "Is Alberta actually diversifying beyond oil and gas? GDP breakdown by industry sector, tech employment growth, and non-energy economic indicators. The provincial government has been pushing diversification since the 1980s — this page shows you what's real and what's still aspirational.",
    sources: "Statistics Canada, Edmonton Open Data",
  },
  {
    href: "/economy/labour",
    icon: Users,
    title: "Labour Market",
    description:
      "Employment count, unemployment rate, participation rate, and average weekly earnings. These come from Statistics Canada's Labour Force Survey (LFS) — a monthly survey of ~100,000 Canadians. The unemployment rate gets the headlines, but participation rate often tells a more honest story.",
    sources: "Statistics Canada LFS",
  },
  {
    href: "/economy/migration",
    icon: Plane,
    title: "Migration & Population",
    description:
      "Who is moving to Alberta and where are they coming from? International immigration (IRCC permanent residents), interprovincial migration (people moving between provinces), and natural population growth. Alberta's population boom is the single biggest driver of housing demand.",
    sources: "Statistics Canada, IRCC",
  },
  {
    href: "/economy/agriculture",
    icon: Wheat,
    title: "Agriculture",
    description:
      "Farm cash receipts, crop vs. livestock revenue split, commodity price indexes, and agriculture's share of provincial GDP. Agriculture is Alberta's second-largest primary industry after energy — it's less volatile but still commodity-dependent and deeply tied to weather, trade policy, and global grain markets.",
    sources: "Statistics Canada, Bank of Canada",
  },
];

export default function EconomyPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
      <PageHeader
        title="Alberta Economy"
        category="economy"
        icon={<PieChart size={22} />}
        description="Provincial economic indicators updated from live government data sources."
      />

      {/* Explainer */}
      <Card>
        <div className="prose-sm space-y-3 text-sm text-muted">
          <p>
            Alberta's economy is <strong className="text-foreground">resource-driven but evolving</strong>.
            Oil and gas still account for roughly a quarter of provincial GDP, which means global energy prices
            ripple through everything — government revenue, employment, migration, housing, and consumer spending.
          </p>
          <p>
            The pages in this section give you a layered view: start with <strong className="text-foreground">Energy</strong> to
            see where commodity prices are, check <strong className="text-foreground">Drilling</strong> for leading-edge capital
            investment signals, then zoom out to <strong className="text-foreground">Labour</strong> and{" "}
            <strong className="text-foreground">Migration</strong> to see how those price signals translate into
            actual jobs and population movement.
          </p>
          <p>
            If you're trying to answer <em>"is now a good time to invest, hire, or expand in Alberta?"</em> —
            these pages give you the raw inputs. The{" "}
            <Link href="/intelligence/invest" className="underline text-foreground hover:text-accent transition-colors">
              Investment Thesis
            </Link>{" "}
            page in Intelligence synthesizes them into a view.
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
            <dt className="font-medium text-foreground inline">BCPI</dt>
            <dd className="text-muted inline">
              {" "}— Bank of Canada Commodity Price Index. Tracks the price of commodities that Canada exports.
              The energy sub-index is especially important for Alberta.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground inline">AER</dt>
            <dd className="text-muted inline">
              {" "}— Alberta Energy Regulator. The provincial body that licences wells, pipelines, and energy projects.
              Their data is a leading indicator of industry confidence.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground inline">LFS</dt>
            <dd className="text-muted inline">
              {" "}— Labour Force Survey. Statistics Canada's monthly employment survey. It produces the unemployment
              rate, employment count, and participation rate you see in headlines.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground inline">Participation rate</dt>
            <dd className="text-muted inline">
              {" "}— The share of working-age people who are either employed or actively looking for work.
              A falling unemployment rate with a falling participation rate can mean people stopped looking,
              not that they found jobs.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground inline">Interprovincial migration</dt>
            <dd className="text-muted inline">
              {" "}— Canadians moving between provinces. When Alberta booms, it draws workers from Ontario,
              B.C., and Atlantic Canada. When it busts, they leave. This is the fastest-reacting population signal.
            </dd>
          </div>
        </dl>
      </Card>
    </main>
  );
}
