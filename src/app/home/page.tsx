import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, MetricCard } from "@/components/card";
import { SectionHeader } from "@/components/section-header";
import { HubCard, HubGrid, type HubCardItem } from "@/components/hub-card";
import {
  Activity,
  Radar,
  Briefcase,
  GraduationCap,
  Home,
  Flame,
  TrendingUp,
  Landmark,
  Users,
  Wrench,
  Shield,
  PieChart,
  CloudSun,
  Globe,
} from "lucide-react";
import {
  fetchBoCObservations,
  fetchStatCanTimeSeries,
  BOC_SERIES,
  STATSCAN_SERIES,
} from "@/lib/data-sources";

export const metadata: Metadata = {
  title: "Alberta Pulse — Home",
  description:
    "Your starting point for Alberta economic data — dashboard, signals, briefings, and learning resources.",
};

// ============================================================
// Loading fallback
// ============================================================

function MetricsLoading() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
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
// Quick metrics
// ============================================================

async function HomeMetrics() {
  const [policyRateData, unemploymentData, cpiData] = await Promise.all([
    fetchBoCObservations(BOC_SERIES.POLICY_RATE, 1).catch(() => null),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.tableId,
      STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.coordinate,
      1
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_CPI.tableId,
      STATSCAN_SERIES.AB_CPI.coordinate,
      1
    ).catch(() => []),
  ]);

  const policyRate =
    policyRateData?.observations?.[0]?.[BOC_SERIES.POLICY_RATE]?.v;
  const unemployment = (unemploymentData as Array<{ value: number }>)?.at(-1)?.value;
  const cpi = (cpiData as Array<{ value: number }>)?.at(-1)?.value;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <MetricCard
        title="BoC Policy Rate"
        value={policyRate ? `${policyRate}%` : "—"}
        source="Bank of Canada"
      />
      <MetricCard
        title="AB Unemployment"
        value={unemployment ? `${unemployment}%` : "—"}
        source="Statistics Canada"
      />
      <MetricCard
        title="AB CPI"
        value={cpi ? String(cpi) : "—"}
        source="Statistics Canada"
      />
    </div>
  );
}

// ============================================================
// Page cards
// ============================================================

const corePages: HubCardItem[] = [
  {
    href: "/home/dashboard",
    icon: Activity,
    title: "Dashboard",
    description:
      "Live macro indicators — interest rates, exchange rates, unemployment, CPI, GDP, and retail.",
    sources: "Bank of Canada, Statistics Canada",
  },
  {
    href: "/home/signals",
    icon: Radar,
    title: "Signals",
    description:
      "Micro-level economic signals: permit surges, assessment jumps, new business clusters.",
    sources: "Municipal APIs",
  },
  {
    href: "/home/briefings",
    icon: Briefcase,
    title: "Briefings",
    description:
      "Curated analysis and context on what's moving in Alberta's economy.",
  },
];

const learnPages: HubCardItem[] = [
  {
    href: "/home/learn",
    icon: GraduationCap,
    title: "Overview",
    description: "Start here — introduction to Alberta's economy and how to use this data.",
  },
  {
    href: "/home/learn/housing-machine",
    icon: Home,
    title: "The Housing Machine",
    description: "How Alberta real estate works — assessments, permits, zoning, and market cycles.",
  },
  {
    href: "/home/learn/energy-economy",
    icon: Flame,
    title: "Energy Engine",
    description: "Oil, gas, pipelines, royalties — the engine that drives Alberta's economy.",
  },
  {
    href: "/home/learn/reading-the-signals",
    icon: TrendingUp,
    title: "Reading Signals",
    description: "How to interpret economic indicators and spot trends early.",
  },
  {
    href: "/home/learn/your-tax-dollars",
    icon: Landmark,
    title: "Your Tax Dollars",
    description: "Municipal, provincial, and federal fiscal flows explained.",
  },
  {
    href: "/home/learn/people-and-growth",
    icon: Users,
    title: "People & Growth",
    description: "Immigration, labour, demographics, and population as economic drivers.",
  },
  {
    href: "/home/learn/safety-and-prosperity",
    icon: Shield,
    title: "Safety & Prosperity",
    description: "Crime, health, environment as economic factors in community development.",
  },
  {
    href: "/home/learn/community-levers",
    icon: Wrench,
    title: "Community Levers",
    description: "What municipalities can actually control and how they shape local economies.",
  },
];

const sectionLinks: HubCardItem[] = [
  {
    href: "/economy",
    icon: PieChart,
    title: "Economy",
    description: "Energy, drilling, diversification, labour, agriculture, retail, and business data.",
  },
  {
    href: "/real-estate",
    icon: Home,
    title: "Real Estate",
    description: "Market intel, prospects, neighbourhoods, dev pipeline, rental, and assessments.",
  },
  {
    href: "/community",
    icon: Users,
    title: "Community",
    description: "Demographics, immigration, health, crime, fire response, and emergencies.",
  },
  {
    href: "/environment",
    icon: CloudSun,
    title: "Environment",
    description: "Weather, air quality, water levels, wildfire, and emissions monitoring.",
  },
  {
    href: "/governance",
    icon: Landmark,
    title: "Governance",
    description: "Legislature, elections, campaign finance, spending, and federal transfers.",
  },
  {
    href: "/municipalities",
    icon: Globe,
    title: "Municipalities",
    description: "Explore 30 live Alberta municipalities with permits, assessments, and more.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Alberta Pulse"
        category="overview"
        icon={<Activity size={22} />}
        description="Your starting point for Alberta economic data. Live indicators, signals, briefings, and learning resources."
      />

      {/* Quick metrics */}
      <Suspense fallback={<MetricsLoading />}>
        <HomeMetrics />
      </Suspense>

      {/* Core pages */}
      <SectionHeader title="Tools" icon={<Activity size={16} />} category="overview" />
      <HubGrid>
        {corePages.map((item) => (
          <HubCard key={item.href} item={item} />
        ))}
      </HubGrid>

      {/* Learn */}
      <SectionHeader title="Learn" icon={<GraduationCap size={16} />} category="overview" />
      <HubGrid>
        {learnPages.map((item) => (
          <HubCard key={item.href} item={item} />
        ))}
      </HubGrid>

      {/* Explore sections */}
      <SectionHeader title="Explore by Section" icon={<Globe size={16} />} category="overview" />
      <HubGrid>
        {sectionLinks.map((item) => (
          <HubCard key={item.href} item={item} />
        ))}
      </HubGrid>
    </main>
  );
}
