import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/card";
import {
  Siren,
  Car,
  Activity,
  Landmark,
  ArrowRight,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Alberta Public Safety — Traffic, Seismic, Emergencies & Politics",
  description:
    "Alberta public safety data — highway conditions, seismic activity, emergency alerts, and political landscape. Real-time data from provincial and federal monitoring systems.",
};

const pages = [
  {
    href: "/safety/traffic",
    icon: Car,
    title: "Traffic & Roads",
    description:
      "Real-time highway conditions, road closures, and traffic events from Alberta 511 and municipal traffic systems. Alberta has over 31,000 km of provincial highways, and winter conditions (October–April) regularly close major corridors. If you're in logistics, construction, or any business that moves product by road, this is your baseline situational awareness.",
    sources: "Alberta 511, Edmonton & Calgary traffic systems",
  },
  {
    href: "/safety/seismic",
    icon: Activity,
    title: "Seismic Activity",
    description:
      "Earthquake data from Natural Resources Canada (NRCan), filtered to Alberta. Most seismic activity in Alberta is induced — caused by hydraulic fracturing (fracking) or wastewater disposal from oil and gas operations, not natural tectonic movement. Events are typically small (magnitude 2–4) but have increased significantly since 2010. Relevant for insurance, infrastructure planning, and understanding the footprint of energy extraction.",
    sources: "Natural Resources Canada",
  },
  {
    href: "/safety/emergencies",
    icon: Siren,
    title: "Emergencies",
    description:
      "Real-time emergency and severe weather alerts from Canada's Alert Ready system, plus traffic alerts. Alert Ready is the national public alerting system — it pushes warnings for tornadoes, extreme cold, AMBER alerts, wildfire evacuations, and other life-safety events. This page shows what's active right now and recent alert history.",
    sources: "Alert Ready, traffic alert systems",
  },
  {
    href: "/safety/elections",
    icon: Landmark,
    title: "Politics",
    description:
      "Alberta's elected officials, electoral district boundaries, and political landscape at the provincial and municipal level. Who represents each area, party affiliations, and the current composition of the legislature. Useful context for understanding local policy priorities — zoning decisions, infrastructure spending, and economic development incentives are all political outcomes.",
    sources: "Alberta government data",
  },
];

export default function SafetyPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
      <PageHeader
        title="Public Safety"
        category="safety"
        icon={<Siren size={22} />}
        description="Real-time alerts, road conditions, seismic monitoring, and political landscape."
      />

      {/* Explainer */}
      <Card>
        <div className="prose-sm space-y-3 text-sm text-muted">
          <p>
            This section covers data that affects <strong className="text-foreground">physical safety and
            operational risk</strong> in Alberta. It might seem like a grab bag — traffic, earthquakes, emergencies,
            politics — but these are the non-economic factors that can materially affect property values,
            insurance costs, and business operations.
          </p>
          <p>
            <strong className="text-foreground">Traffic & Roads</strong> is the most operationally useful — it's
            real-time situational awareness for anyone who depends on Alberta's road network.{" "}
            <strong className="text-foreground">Emergencies</strong> shows you what's happening right now.{" "}
            <strong className="text-foreground">Seismic</strong> is more of a long-term context layer — understanding
            induced seismicity patterns is relevant if you're evaluating property near active well sites.
          </p>
          <p>
            <strong className="text-foreground">Politics</strong> is included here because political decisions —
            zoning changes, infrastructure investments, tax policy — are upstream of many economic outcomes.
            Knowing who represents a given area and what their priorities are can be the difference between
            a development that gets approved and one that doesn't.
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
            <dt className="font-medium text-foreground inline">Induced seismicity</dt>
            <dd className="text-muted inline">
              {" "}— Earthquakes caused by human activity, usually hydraulic fracturing or deep wastewater
              injection from oil and gas operations. Distinct from natural tectonic earthquakes.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground inline">Alert Ready</dt>
            <dd className="text-muted inline">
              {" "}— Canada's national emergency alerting system. Pushes warnings to cell phones, radio,
              and TV for imminent threats to life. Managed jointly by federal, provincial, and territorial
              emergency management agencies.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground inline">Alberta 511</dt>
            <dd className="text-muted inline">
              {" "}— The provincial road information service. Reports highway conditions, closures,
              construction, and incidents across Alberta's highway network. Available at 511.alberta.ca.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground inline">MLA</dt>
            <dd className="text-muted inline">
              {" "}— Member of the Legislative Assembly. Alberta's provincial elected representatives.
              87 MLAs represent electoral districts across the province in the unicameral legislature (no senate).
            </dd>
          </div>
        </dl>
      </Card>
    </main>
  );
}
