import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, MetricCard } from "@/components/card";
import { HubCard, HubGrid, type HubCardItem } from "@/components/hub-card";
import {
  Home,
  Target,
  MapPin,
  Building,
  Building2,
  Store,
} from "lucide-react";
import {
  fetchHousingStarts,
  fetchVacancyRates,
} from "@/lib/data-sources-cmhc";

export const metadata: Metadata = {
  title: "Alberta Real Estate — Market Intelligence & Opportunities",
  description:
    "Alberta real estate data — prospect leads, market intelligence, neighbourhood analysis, development pipeline, rental trends, and commercial activity. Built for agents, investors, and developers.",
  alternates: {
    canonical: "https://albertapulsecheck.ca/real-estate",
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

async function RealEstateMetrics() {
  const [startsData, vacancyData] = await Promise.all([
    fetchHousingStarts(2).catch(() => []),
    fetchVacancyRates().catch(() => []),
  ]);

  type CMAPoint = { date: string; edmonton: number; calgary: number };
  const latestStarts = (startsData as CMAPoint[])?.at(-1);
  const latestVacancy = (vacancyData as CMAPoint[])?.at(-1);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <MetricCard
        title="Edm Housing Starts"
        value={latestStarts?.edmonton ? latestStarts.edmonton.toLocaleString() : "—"}
        source="CMHC via StatsCan"
      />
      <MetricCard
        title="Cal Housing Starts"
        value={latestStarts?.calgary ? latestStarts.calgary.toLocaleString() : "—"}
        source="CMHC via StatsCan"
      />
      <MetricCard
        title="Edm Vacancy Rate"
        value={latestVacancy?.edmonton ? `${latestVacancy.edmonton}%` : "—"}
        source="CMHC via StatsCan"
      />
      <MetricCard
        title="Cal Vacancy Rate"
        value={latestVacancy?.calgary ? `${latestVacancy.calgary}%` : "—"}
        source="CMHC via StatsCan"
      />
    </div>
  );
}

// ============================================================
// Page cards
// ============================================================

const pages: HubCardItem[] = [
  {
    href: "/real-estate/market",
    icon: Home,
    title: "Market Intel",
    description:
      "Housing starts, assessments, permits, mortgage rates, and mill rate trends. The big picture.",
    sources: "Bank of Canada, Statistics Canada, ArcGIS",
  },
  {
    href: "/real-estate/prospects",
    icon: Target,
    title: "Prospect Leads",
    description:
      "Algorithmically-identified opportunities: equity-rich sellers, teardown lots, renovation upside.",
    sources: "ArcGIS, Edmonton Open Data",
  },
  {
    href: "/real-estate/neighbourhoods",
    icon: MapPin,
    title: "Neighbourhoods",
    description:
      "Micro-level signals from permits, development activity, and assessment changes by neighbourhood.",
    sources: "Municipal permit & assessment data",
  },
  {
    href: "/real-estate/pipeline",
    icon: Building,
    title: "Dev Pipeline",
    description:
      "CMHC housing starts, completions, and units under construction for Edmonton and Calgary.",
    sources: "Statistics Canada (CMHC)",
  },
  {
    href: "/real-estate/rental",
    icon: Home,
    title: "Rental Intel",
    description:
      "CMHC vacancy rates and average rents by unit type across Alberta metro areas.",
    sources: "Statistics Canada (CMHC)",
  },
  {
    href: "/real-estate/assessments",
    icon: Building2,
    title: "Assessments",
    description:
      "Property assessment trends by neighbourhood from UAlberta Open Data Centre.",
    sources: "UAlberta, Municipal Data",
  },
  {
    href: "/real-estate/commercial",
    icon: Store,
    title: "Commercial",
    description:
      "Commercial assessments, business formation, retail sales, and commercial zoning activity.",
    sources: "Edmonton Open Data, Statistics Canada",
  },
];

export default function RealEstatePage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Real Estate Intelligence"
        category="realestate"
        icon={<Home size={22} />}
        description="Market data, prospect identification, and development pipeline tracking across Alberta."
      />

      {/* Headline metrics */}
      <Suspense fallback={<MetricsLoading />}>
        <RealEstateMetrics />
      </Suspense>

      {/* Explainer */}
      <Card>
        <div className="prose-sm space-y-3 text-sm text-muted">
          <p>
            Alberta real estate is <strong className="text-foreground">cyclical and data-rich</strong>.
            Unlike many Canadian markets, Alberta municipalities publish granular property assessment, permit,
            and business licence data through open APIs. This section turns that raw data into actionable intelligence.
          </p>
          <p>
            <strong className="text-foreground">Market Intel</strong> gives you the macro read,{" "}
            <strong className="text-foreground">Pipeline</strong> shows incoming supply,{" "}
            <strong className="text-foreground">Neighbourhoods</strong> zooms into micro-trends, and{" "}
            <strong className="text-foreground">Prospects</strong> surfaces specific opportunities.
          </p>
        </div>
      </Card>

      {/* Page grid */}
      <HubGrid>
        {pages.map((item) => (
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
            <dt className="font-medium text-foreground inline">CMHC</dt>
            <dd className="text-muted inline">
              {" "}— Canada Mortgage and Housing Corporation. Publishes housing starts, completions, vacancy rates, and rents.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground inline">Housing starts</dt>
            <dd className="text-muted inline">
              {" "}— New residential units where construction has begun. A leading indicator of future supply.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground inline">Mill rate</dt>
            <dd className="text-muted inline">
              {" "}— Property tax rate, expressed as dollars of tax per $1,000 of assessed value.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground inline">Assessment</dt>
            <dd className="text-muted inline">
              {" "}— The value a municipality assigns to a property for tax purposes.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground inline">MLS</dt>
            <dd className="text-muted inline">
              {" "}— Multiple Listing Service. The database realtors use to list properties for sale.
            </dd>
          </div>
        </dl>
      </Card>
    </main>
  );
}
