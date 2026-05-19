import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, MetricCard } from "@/components/card";
import { SectionHeader } from "@/components/section-header";
import { HubCard, HubGrid, type HubCardItem } from "@/components/hub-card";
import {
  PieChart,
  Flame,
  Pickaxe,
  RefreshCw,
  Users,
  Plane,
  Wheat,
  Cannabis,
  ShoppingCart,
  Building2,
  HardHat,
  Scale,
  Rocket,
  ShieldAlert,
  TrendingUp,
  GitCompare,
} from "lucide-react";
import {
  fetchBoCObservations,
  fetchStatCanTimeSeries,
  BOC_SERIES,
  STATSCAN_SERIES,
} from "@/lib/data-sources";
import { SITE_URL } from "@/lib/constants/site";

export const metadata: Metadata = {
  title: "Alberta Economy — Provincial Economic Data & Indicators",
  description:
    "Track Alberta's economy in real time — energy prices, drilling activity, labour markets, migration, diversification, and agriculture. Live data from Statistics Canada, Bank of Canada, and Alberta government sources.",
  alternates: {
    canonical: `${SITE_URL}/economy`,
  },
};

// ============================================================
// Loading fallback
// ============================================================

function MetricsLoading() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <div className="animate-pulse space-y-2">
            <div className="h-3 bg-card-border rounded w-2/3" />
            <div className="h-7 bg-card-border/50 rounded w-1/2" />
          </div>
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// Headline metrics
// ============================================================

async function EconomyMetrics() {
  const [policyRateData, cadUsdData, unemploymentData, gdpData] =
    await Promise.all([
      fetchBoCObservations(BOC_SERIES.POLICY_RATE, 1).catch(() => null),
      fetchBoCObservations(BOC_SERIES.CAD_USD, 2).catch(() => null),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.tableId,
        STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.coordinate,
        2
      ).catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_GDP.tableId,
        STATSCAN_SERIES.AB_GDP.coordinate,
        2
      ).catch(() => []),
    ]);

  const policyRate =
    policyRateData?.observations?.[0]?.[BOC_SERIES.POLICY_RATE]?.v;
  const cadUsdCurrent =
    cadUsdData?.observations?.at(-1)?.[BOC_SERIES.CAD_USD]?.v;
  const cadUsdPrev =
    cadUsdData?.observations?.at(-2)?.[BOC_SERIES.CAD_USD]?.v;
  const cadUsdChange =
    cadUsdCurrent && cadUsdPrev
      ? ((Number(cadUsdCurrent) - Number(cadUsdPrev)) * 100).toFixed(2)
      : undefined;

  const unemploymentCurrent = (unemploymentData as Array<{ value: number }>)?.at(-1)?.value;
  const unemploymentPrev = (unemploymentData as Array<{ value: number }>)?.at(-2)?.value;
  const unemploymentChange =
    unemploymentCurrent && unemploymentPrev
      ? (unemploymentCurrent - unemploymentPrev).toFixed(1)
      : undefined;

  const gdpCurrent = (gdpData as Array<{ value: number }>)?.at(-1)?.value;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <MetricCard
        title="BoC Policy Rate"
        value={policyRate ? `${policyRate}%` : "—"}
        source="Bank of Canada"
      />
      <MetricCard
        title="CAD/USD"
        value={cadUsdCurrent ? `$${Number(cadUsdCurrent).toFixed(4)}` : "—"}
        change={cadUsdChange ? `${Number(cadUsdChange) >= 0 ? "+" : ""}${cadUsdChange}¢` : undefined}
        source="Bank of Canada"
      />
      <MetricCard
        title="AB Unemployment"
        value={unemploymentCurrent ? `${unemploymentCurrent}%` : "—"}
        change={
          unemploymentChange
            ? `${Number(unemploymentChange) >= 0 ? "+" : ""}${unemploymentChange}pp`
            : undefined
        }
        source="Statistics Canada"
      />
      <MetricCard
        title="AB GDP"
        value={gdpCurrent ? `$${(gdpCurrent / 1000).toFixed(0)}B` : "—"}
        source="Statistics Canada"
      />
    </div>
  );
}

// ============================================================
// Page cards
// ============================================================

const industryPages: HubCardItem[] = [
  {
    href: "/economy/energy",
    icon: Flame,
    title: "Energy",
    description:
      "Oil & gas prices, BCPI energy index, CAD/USD, and mining GDP. The heartbeat of Alberta's economy.",
    sources: "Bank of Canada, Statistics Canada",
  },
  {
    href: "/economy/drilling",
    icon: Pickaxe,
    title: "Drilling",
    description:
      "AER well licences, drilling trends, and oilfield service activity. A leading indicator of capital confidence.",
    sources: "AER, Statistics Canada",
  },
  {
    href: "/economy/boom-bust",
    icon: RefreshCw,
    title: "Boom-Bust Cycle",
    description:
      "Where is Alberta in its economic cycle? Cross-referencing oil, employment, migration, and construction.",
    sources: "Bank of Canada, Statistics Canada",
  },
  {
    href: "/economy/diversification",
    icon: PieChart,
    title: "Diversification",
    description:
      "GDP by industry sector, tech employment, and non-energy indicators. Is Alberta actually diversifying?",
    sources: "Statistics Canada, Edmonton Open Data",
  },
  {
    href: "/economy/agriculture",
    icon: Wheat,
    title: "Agriculture",
    description:
      "Farm cash receipts, crop vs. livestock revenue, and ag's share of provincial GDP.",
    sources: "Statistics Canada, Bank of Canada",
  },
  {
    href: "/economy/cannabis",
    icon: Cannabis,
    title: "Cannabis",
    description:
      "Monthly retail sales, growth trends, and market share. Alberta leads with 900+ licensed stores.",
    sources: "Statistics Canada, AGLC",
  },
  {
    href: "/economy/retail",
    icon: ShoppingCart,
    title: "Retail Trade",
    description:
      "Retail sales by subsector, e-commerce trends, and food services revenue.",
    sources: "Statistics Canada",
  },
  {
    href: "/economy/businesses",
    icon: Building2,
    title: "Business Dynamics",
    description:
      "Business openings & closures by NAICS sector, licence trends in Edmonton and Calgary.",
    sources: "Statistics Canada, Municipal Open Data",
  },
  {
    href: "/economy/employers",
    icon: HardHat,
    title: "Employers",
    description:
      "WCB employer records, non-profits, corporate tax stats, and GHG facility emissions.",
    sources: "WCB, CRA, ECCC",
  },
];

const analysisPages: HubCardItem[] = [
  {
    href: "/economy/benchmarks",
    icon: Scale,
    title: "Benchmarks",
    description:
      "Alberta vs. national and provincial benchmarks across key economic indicators.",
    sources: "Statistics Canada",
  },
  {
    href: "/economy/corridors",
    icon: Rocket,
    title: "Growth Corridors",
    description:
      "Identify Alberta's fastest-growing regions by permits, population, and business activity.",
    sources: "Statistics Canada, Municipal Data",
  },
  {
    href: "/economy/risk",
    icon: ShieldAlert,
    title: "Market Risk",
    description:
      "Municipal risk scores factoring wildfire, flood, economic concentration, and volatility.",
    sources: "Multiple sources",
  },
  {
    href: "/economy/cycle-position",
    icon: RefreshCw,
    title: "Cycle Position",
    description:
      "Composite indicator tracking where Alberta sits in the macro cycle right now.",
    sources: "Statistics Canada, Bank of Canada",
  },
  {
    href: "/economy/invest",
    icon: TrendingUp,
    title: "Investment Thesis",
    description:
      "Synthesized view: is now a good time to invest, hire, or expand in Alberta?",
    sources: "Multiple sources",
  },
  {
    href: "/economy/compare",
    icon: GitCompare,
    title: "Compare",
    description:
      "Side-by-side comparison of municipalities across economic indicators.",
    sources: "Regional Dashboard",
  },
];

const crossLinks: HubCardItem[] = [
  {
    href: "/community/labour",
    icon: Users,
    title: "Labour Market",
    description:
      "Employment, unemployment, participation rate, and average earnings from the LFS.",
    sources: "Statistics Canada",
  },
  {
    href: "/community/immigration",
    icon: Plane,
    title: "Migration & Population",
    description:
      "Immigration, interprovincial migration, and population growth — Alberta's demand driver.",
    sources: "Statistics Canada, IRCC",
  },
];

export default function EconomyPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Alberta Economy"
        category="economy"
        icon={<PieChart size={22} />}
        description="Provincial economic indicators updated from live government data sources."
      />

      {/* Headline metrics */}
      <Suspense fallback={<MetricsLoading />}>
        <EconomyMetrics />
      </Suspense>

      {/* Explainer */}
      <Card>
        <div className="prose-sm space-y-3 text-sm text-muted">
          <p>
            Alberta's economy is <strong className="text-foreground">resource-driven but evolving</strong>.
            Oil and gas still account for roughly a quarter of provincial GDP, which means global energy prices
            ripple through everything — government revenue, employment, migration, housing, and consumer spending.
          </p>
          <p>
            Start with <strong className="text-foreground">Energy</strong> to see where commodity prices are,
            check <strong className="text-foreground">Drilling</strong> for leading-edge capital investment signals,
            then zoom out to{" "}
            <Link href="/community/labour" className="underline text-foreground hover:text-accent transition-colors">
              Labour
            </Link>{" "}
            and{" "}
            <Link href="/community/immigration" className="underline text-foreground hover:text-accent transition-colors">
              Migration
            </Link>{" "}
            to see how those price signals translate into jobs and population movement.
          </p>
        </div>
      </Card>

      {/* Industries */}
      <SectionHeader title="Industries" icon={<Flame size={16} />} category="economy" />
      <HubGrid>
        {industryPages.map((item) => (
          <HubCard key={item.href} item={item} />
        ))}
      </HubGrid>

      {/* Analysis */}
      <SectionHeader title="Analysis" icon={<TrendingUp size={16} />} category="economy" />
      <HubGrid>
        {analysisPages.map((item) => (
          <HubCard key={item.href} item={item} />
        ))}
      </HubGrid>

      {/* Cross-links */}
      <SectionHeader title="Related" icon={<Users size={16} />} category="economy" />
      <HubGrid columns={2}>
        {crossLinks.map((item) => (
          <HubCard key={item.href} item={item} />
        ))}
      </HubGrid>

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
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground inline">LFS</dt>
            <dd className="text-muted inline">
              {" "}— Labour Force Survey. Statistics Canada's monthly employment survey.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground inline">Participation rate</dt>
            <dd className="text-muted inline">
              {" "}— The share of working-age people who are either employed or actively looking for work.
            </dd>
          </div>
        </dl>
      </Card>
    </main>
  );
}
