import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, MetricCard } from "@/components/card";
import { HubCard, HubGrid, type HubCardItem } from "@/components/hub-card";
import {
  CloudSun,
  Wind,
  Waves,
  TreePine,
  Factory,
} from "lucide-react";
import { fetchCWFISActiveFires, fetch511Alerts } from "@/lib/data-sources-fire";

export const metadata: Metadata = {
  title: "Alberta Environment — Weather, Air, Water & Wildfire",
  description:
    "Real-time environmental monitoring for Alberta — weather conditions, air quality index, river levels, and wildfire tracking from Environment Canada and provincial sources.",
  alternates: {
    canonical: "https://albertapulsecheck.ca/environment",
  },
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
// Headline metrics
// ============================================================

async function EnvironmentMetrics() {
  const [fires, alerts] = await Promise.all([
    fetchCWFISActiveFires().catch(() => []),
    fetch511Alerts().catch(() => []),
  ]);

  const outOfControl = fires.filter(
    (f) => f.stageOfControl?.toLowerCase().includes("out of control") ||
           f.stageOfControl?.toLowerCase() === "oc"
  ).length;

  const totalHectares = fires.reduce((sum, f) => sum + (f.hectares || 0), 0);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <MetricCard
        title="Active Wildfires"
        value={String(fires.length)}
        change={outOfControl > 0 ? `${outOfControl} out of control` : undefined}
        source="CWFIS (NRCan)"
      />
      <MetricCard
        title="Area Burned"
        value={totalHectares > 0 ? `${totalHectares.toLocaleString()} ha` : "0 ha"}
        source="CWFIS (NRCan)"
      />
      <MetricCard
        title="Active 511 Alerts"
        value={String(alerts.length)}
        source="Alberta 511"
      />
    </div>
  );
}

// ============================================================
// Page cards
// ============================================================

const pages: HubCardItem[] = [
  {
    href: "/environment/weather",
    icon: CloudSun,
    title: "Weather",
    description:
      "Real-time conditions from Environment Canada — temperature, wind, humidity, and climate normals.",
    sources: "Environment Canada",
  },
  {
    href: "/environment/air-quality",
    icon: Wind,
    title: "Air Quality",
    description:
      "AQHI readings from monitoring stations across Alberta. Critical during wildfire season.",
    sources: "Alberta Air Quality Network",
  },
  {
    href: "/environment/water",
    icon: Waves,
    title: "Water & Rivers",
    description:
      "Live hydrometric data — water levels, flow rates, and flood risk on major river systems.",
    sources: "Government Hydrometric Stations",
  },
  {
    href: "/environment/wildfire",
    icon: TreePine,
    title: "Wildfire",
    description:
      "Active fires, historical trends, cause analysis, and containment status province-wide.",
    sources: "Alberta Wildfire Service, CWFIS",
  },
  {
    href: "/environment/emissions",
    icon: Factory,
    title: "Emissions",
    description:
      "Facility-level GHG reporting — emissions by company, sector, and facility across Alberta.",
    sources: "ECCC Facility GHG Reporting",
  },
];

export default function EnvironmentPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Environment"
        category="environment"
        icon={<CloudSun size={22} />}
        description="Real-time environmental monitoring from government stations and provincial agencies."
      />

      {/* Headline metrics */}
      <Suspense fallback={<MetricsLoading />}>
        <EnvironmentMetrics />
      </Suspense>

      {/* Explainer */}
      <Card>
        <div className="prose-sm space-y-3 text-sm text-muted">
          <p>
            Environmental data isn't just "nice to have" in Alberta —{" "}
            <strong className="text-foreground">it's economically material</strong>.
            Wildfire smoke shuts down outdoor work. River flooding causes billions in damage.
            Extreme cold shapes the entire economic calendar.
          </p>
          <p>
            These pages pull live data from federal and provincial monitoring networks.
            For the broader economic impact of environmental events, check the{" "}
            <Link href="/economy/risk" className="underline text-foreground hover:text-accent transition-colors">
              Market Risk
            </Link>{" "}
            page, which factors wildfire and flood exposure into municipal risk scores.
          </p>
        </div>
      </Card>

      {/* Page grid */}
      <HubGrid columns={2}>
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
            <dt className="font-medium text-foreground inline">AQHI</dt>
            <dd className="text-muted inline">
              {" "}— Air Quality Health Index. Canadian scale from 1–10+. 1–3 low risk, 7–10 high, 10+ very high.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground inline">PM2.5</dt>
            <dd className="text-muted inline">
              {" "}— Fine particulate matter (&lt;2.5 micrometres). Main pollutant during wildfire smoke events.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground inline">Wildfire-urban interface (WUI)</dt>
            <dd className="text-muted inline">
              {" "}— Where developed areas meet wildland. Elevated wildfire risk and insurance premiums.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground inline">Heating degree days (HDD)</dt>
            <dd className="text-muted inline">
              {" "}— Measure of heating demand. Alberta: 5,000–6,000 HDD/year, roughly double Toronto.
            </dd>
          </div>
        </dl>
      </Card>
    </main>
  );
}
