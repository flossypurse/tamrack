import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/card";
import {
  CloudSun,
  Wind,
  Waves,
  TreePine,
  ArrowRight,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Alberta Environment — Weather, Air, Water & Wildfire",
  description:
    "Real-time environmental monitoring for Alberta — weather conditions, air quality index, river levels, and wildfire tracking from Environment Canada and provincial sources.",
};

const pages = [
  {
    href: "/environment/weather",
    icon: CloudSun,
    title: "Weather",
    description:
      "Real-time weather conditions from Environment Canada monitoring stations across Alberta — temperature, wind, humidity, visibility, and historical climate normals. Weather directly impacts construction timelines, energy demand (heating degree days), agriculture, and transportation logistics. Winter conditions in Alberta are not a footnote — they shape the entire economic calendar.",
    sources: "Environment Canada",
  },
  {
    href: "/environment/air-quality",
    icon: Wind,
    title: "Air Quality",
    description:
      "The Air Quality Health Index (AQHI) from monitoring stations across the province. AQHI is a Canadian-specific scale from 1 (low risk) to 10+ (very high risk), based on three pollutants: fine particulate matter (PM2.5), ozone (O₃), and nitrogen dioxide (NO₂). During wildfire season (May–September), air quality can deteriorate rapidly and affect everything from outdoor work to insurance risk.",
    sources: "Alberta air quality monitoring network",
  },
  {
    href: "/environment/water",
    icon: Waves,
    title: "Water & Rivers",
    description:
      "Live hydrometric data from government monitoring stations on Alberta's river systems. Water levels, flow rates, and flood risk indicators. Alberta's major rivers (North Saskatchewan, Bow, Athabasca, Red Deer) are critical for municipal water supply, agriculture, and energy production. The 2013 Southern Alberta flood caused $6B+ in damage — water level monitoring is not academic here.",
    sources: "Government hydrometric stations",
  },
  {
    href: "/environment/wildfire",
    icon: TreePine,
    title: "Wildfire",
    description:
      "Active and historical wildfire data from the Alberta Wildfire Service. Tracks fire locations, sizes, causes (human vs. lightning), and containment status. The 2016 Fort McMurray fire caused $9.9B in insured losses — the costliest disaster in Canadian history. Wildfire risk is a material factor for insurance pricing, property values, and community planning in forested regions.",
    sources: "Alberta Wildfire Service",
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

      {/* Explainer */}
      <Card>
        <div className="prose-sm space-y-3 text-sm text-muted">
          <p>
            Environmental data isn't just "nice to have" in Alberta —{" "}
            <strong className="text-foreground">it's economically material</strong>.
            Wildfire smoke shuts down outdoor work and tanks air quality for weeks.
            River flooding can cause billions in property damage. Extreme cold affects
            energy demand, construction windows, and infrastructure costs.
          </p>
          <p>
            These pages pull live data from federal and provincial monitoring networks. The data
            updates frequently (hourly for weather and air quality, daily for water levels, near-real-time
            for active wildfires). If you're making decisions about{" "}
            <strong className="text-foreground">construction timing, insurance exposure, or property in
            wildfire-interface zones</strong>, this section gives you the inputs.
          </p>
          <p>
            For the broader economic impact of environmental events, check the{" "}
            <Link href="/intelligence/risk" className="underline text-foreground hover:text-accent transition-colors">
              Market Risk
            </Link>{" "}
            page in Intelligence, which factors wildfire and flood exposure into municipal risk scores.
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
            <dt className="font-medium text-foreground inline">AQHI</dt>
            <dd className="text-muted inline">
              {" "}— Air Quality Health Index. A Canadian scale from 1–10+ that combines PM2.5, ozone, and NO₂
              into a single health-risk number. 1–3 is low risk, 4–6 moderate, 7–10 high, 10+ very high.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground inline">PM2.5</dt>
            <dd className="text-muted inline">
              {" "}— Fine particulate matter, particles smaller than 2.5 micrometres. The main pollutant
              during wildfire smoke events. Small enough to penetrate deep into lungs.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground inline">Hydrometric</dt>
            <dd className="text-muted inline">
              {" "}— Relating to the measurement of water. Hydrometric stations measure river water levels
              and flow rates, usually reported in cubic metres per second (m³/s).
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground inline">Wildfire-urban interface (WUI)</dt>
            <dd className="text-muted inline">
              {" "}— The zone where developed areas meet undeveloped wildland. Properties in the WUI
              face elevated wildfire risk and increasingly higher insurance premiums.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground inline">Heating degree days (HDD)</dt>
            <dd className="text-muted inline">
              {" "}— A measure of how much heating a building needs. Calculated as 18°C minus the
              daily mean temperature. Alberta accumulates 5,000–6,000 HDD per year — roughly double Toronto.
            </dd>
          </div>
        </dl>
      </Card>
    </main>
  );
}
