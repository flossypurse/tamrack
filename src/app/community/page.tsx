import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, MetricCard } from "@/components/card";
import { SectionHeader } from "@/components/section-header";
import { HubCard, HubGrid, type HubCardItem } from "@/components/hub-card";
import {
  Users,
  Plane,
  HardHat,
  HeartPulse,
  Shield,
  Flame,
  Car,
  Activity,
  Siren,
} from "lucide-react";
import {
  fetchStatCanTimeSeries,
  STATSCAN_SERIES,
} from "@/lib/data-sources";
import { fetchImmigrationTimeSeries } from "@/lib/data-sources-ircc";
import { SITE_URL } from "@/lib/constants/site";

export const metadata: Metadata = {
  title: "Alberta Community — People, Health, Safety & Demographics",
  description:
    "Alberta community data — demographics, immigration, labour market, health indicators, crime, fire response, traffic, seismic activity, and emergency alerts.",
  alternates: {
    canonical: `${SITE_URL}/community`,
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

async function CommunityMetrics() {
  const [populationData, unemploymentData, immigrationData] =
    await Promise.all([
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_POPULATION.tableId,
        STATSCAN_SERIES.AB_POPULATION.coordinate,
        2
      ).catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.tableId,
        STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.coordinate,
        1
      ).catch(() => []),
      fetchImmigrationTimeSeries("Alberta").catch(() => []),
    ]);

  const popCurrent = (populationData as Array<{ value: number }>)?.at(-1)?.value;
  const popPrev = (populationData as Array<{ value: number }>)?.at(-2)?.value;
  const popChange =
    popCurrent && popPrev
      ? `+${((popCurrent - popPrev) / 1000).toFixed(0)}K`
      : undefined;

  const unemployment = (unemploymentData as Array<{ value: number }>)?.at(-1)?.value;

  const immigrationLatest = (immigrationData as Array<{ value: number }>)?.at(-1)?.value;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <MetricCard
        title="AB Population"
        value={popCurrent ? `${(popCurrent / 1_000_000).toFixed(2)}M` : "—"}
        change={popChange}
        changeLabel="vs prior"
        source="Statistics Canada"
      />
      <MetricCard
        title="Unemployment"
        value={unemployment ? `${unemployment}%` : "—"}
        source="Statistics Canada"
      />
      <MetricCard
        title="Annual PRs"
        value={
          immigrationLatest
            ? immigrationLatest.toLocaleString()
            : "—"
        }
        source="IRCC"
      />
      <MetricCard
        title="AB Regions"
        value="7"
        source="Alberta Regional Dashboard"
      />
    </div>
  );
}

// ============================================================
// Page cards
// ============================================================

const peoplePages: HubCardItem[] = [
  {
    href: "/community/demographics",
    icon: Users,
    title: "Demographics",
    description:
      "Population distribution, age structure, and growth trends across Alberta municipalities.",
    sources: "Statistics Canada, Alberta Regional Dashboard",
  },
  {
    href: "/community/immigration",
    icon: Plane,
    title: "Immigration",
    description:
      "IRCC permanent residents by category, CMA, age, and occupation. Alberta's population engine.",
    sources: "IRCC, Statistics Canada",
  },
  {
    href: "/community/labour",
    icon: HardHat,
    title: "Labour Market",
    description:
      "Employment, unemployment rate, participation rate, and average weekly earnings.",
    sources: "Statistics Canada LFS",
  },
  {
    href: "/community/health",
    icon: HeartPulse,
    title: "Health",
    description:
      "Life expectancy, births, deaths, and leading causes of mortality across Alberta.",
    sources: "Alberta Regional Dashboard, CKAN",
  },
  {
    href: "/community/mortality",
    icon: HeartPulse,
    title: "Mortality",
    description:
      "Leading causes of death by age group and sex. Provincial trend analysis.",
    sources: "Alberta CKAN",
  },
];

const safetyPages: HubCardItem[] = [
  {
    href: "/community/crime",
    icon: Shield,
    title: "Crime & Safety",
    description:
      "Crime Severity Index across 200+ jurisdictions plus Calgary community-level stats.",
    sources: "Alberta Regional Dashboard, Calgary Open Data",
  },
  {
    href: "/community/fire-response",
    icon: Flame,
    title: "Fire Response",
    description:
      "Edmonton fire/EMS incidents (927K+ records), active wildfires, and 511 alerts.",
    sources: "Edmonton Open Data, CWFIS, Alberta 511",
  },
  {
    href: "/community/traffic",
    icon: Car,
    title: "Traffic & Roads",
    description:
      "Real-time highway conditions, road closures, and traffic events across 31,000+ km.",
    sources: "Alberta 511",
  },
  {
    href: "/community/seismic",
    icon: Activity,
    title: "Seismic Activity",
    description:
      "Earthquake data filtered to Alberta. Mostly induced seismicity from energy operations.",
    sources: "Natural Resources Canada",
  },
  {
    href: "/community/emergencies",
    icon: Siren,
    title: "Emergencies",
    description:
      "Real-time Alert Ready warnings: tornadoes, extreme cold, AMBER alerts, wildfire evacuations.",
    sources: "Alert Ready",
  },
];

export default function CommunityPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Community"
        category="safety"
        icon={<Users size={22} />}
        description="Demographics, labour, health, public safety, and emergency data across Alberta."
      />

      {/* Headline metrics */}
      <Suspense fallback={<MetricsLoading />}>
        <CommunityMetrics />
      </Suspense>

      {/* Explainer */}
      <Card>
        <div className="prose-sm space-y-3 text-sm text-muted">
          <p>
            This section covers the <strong className="text-foreground">human side of Alberta's economy</strong> —
            who lives here, where they come from, how healthy and safe their communities are, and the emergency
            infrastructure that supports them.
          </p>
          <p>
            <strong className="text-foreground">People</strong> pages track demographics, immigration, and
            employment. <strong className="text-foreground">Safety</strong> pages cover crime, fire response,
            traffic, and emergency alerts — the non-economic factors that materially affect property values,
            insurance costs, and business operations.
          </p>
        </div>
      </Card>

      {/* People */}
      <SectionHeader title="People" icon={<Users size={16} />} category="safety" />
      <HubGrid>
        {peoplePages.map((item) => (
          <HubCard key={item.href} item={item} />
        ))}
      </HubGrid>

      {/* Safety */}
      <SectionHeader title="Safety" icon={<Shield size={16} />} category="safety" />
      <HubGrid>
        {safetyPages.map((item) => (
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
            <dt className="font-medium text-foreground inline">Crime Severity Index (CSI)</dt>
            <dd className="text-muted inline">
              {" "}— Combines volume and severity of police-reported crime. Canada's baseline is 100 (2006).
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground inline">LFS</dt>
            <dd className="text-muted inline">
              {" "}— Labour Force Survey. Statistics Canada's monthly employment survey.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground inline">Alert Ready</dt>
            <dd className="text-muted inline">
              {" "}— Canada's national emergency alerting system for imminent threats to life.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground inline">Induced seismicity</dt>
            <dd className="text-muted inline">
              {" "}— Earthquakes caused by human activity, usually hydraulic fracturing or wastewater injection.
            </dd>
          </div>
        </dl>
      </Card>
    </main>
  );
}
