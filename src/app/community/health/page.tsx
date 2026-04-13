import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/card";
import {
  HeartPulse,
  Skull,
  Pill,
  Stethoscope,
  ArrowRight,
  Lock,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Alberta Health Data — Demographics, Mortality & Public Health",
  description:
    "Alberta health data including life expectancy by municipality, leading causes of death, births and deaths trends. Data from Alberta Regional Dashboard and open government sources.",
  alternates: {
    canonical: "https://albertapulsecheck.ca/community/health",
  },
};

const pages = [
  {
    href: "/community/demographics",
    icon: HeartPulse,
    title: "Demographics",
    description:
      "Life expectancy, births, and deaths by municipality across Alberta. These are foundational population health metrics — they tell you whether a community is growing, aging, or declining. Life expectancy varies significantly across Alberta municipalities, often correlating with income levels and proximity to healthcare services. Births minus deaths gives you natural population change, separate from migration.",
    sources: "Alberta Regional Dashboard",
    comingSoon: false,
  },
  {
    href: "/community/mortality",
    icon: Skull,
    title: "Mortality",
    description:
      "Leading causes of death in Alberta, trends over time, and age/gender breakdowns. Cancer and heart disease are consistently the top two causes, but the mix shifts over time — opioid-related deaths surged post-2016, and COVID-19 appeared in 2020. Understanding mortality patterns helps contextualize healthcare demand, insurance costs, and workforce availability.",
    sources: "Alberta Open Data (CKAN)",
    comingSoon: false,
  },
  {
    href: "/community/health",
    icon: Pill,
    title: "Substance Use",
    description:
      "Opioid-related hospitalizations, deaths, and EMS responses from Health Infobase Canada. Alberta has among the highest opioid mortality rates in Canada, with significant regional variation. This data is critical for understanding healthcare system load, labour force impacts, and community resilience.",
    sources: "Health Infobase Canada",
    comingSoon: true,
  },
  {
    href: "/community/health",
    icon: Stethoscope,
    title: "Healthcare Workforce",
    description:
      "Physician supply and distribution from CIHI (Canadian Institute for Health Information). Doctor-to-population ratios vary dramatically across Alberta — rural municipalities often have severe shortages. This data matters for anyone evaluating community livability, real estate potential, or business expansion into underserved areas.",
    sources: "CIHI",
    comingSoon: true,
  },
];

export default function HealthPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Health Data"
        category="health"
        icon={<HeartPulse size={22} />}
        description="Population health metrics, mortality trends, and public health indicators across Alberta."
      />

      {/* Explainer */}
      <Card>
        <div className="prose-sm space-y-3 text-sm text-muted">
          <p>
            Health data might seem peripheral to economic analysis, but it is deeply
            connected. <strong className="text-foreground">Life expectancy</strong> is one of
            the strongest correlates of community economic prosperity.{" "}
            <strong className="text-foreground">Birth and death rates</strong> determine natural
            population growth — the baseline before migration.{" "}
            <strong className="text-foreground">Mortality patterns</strong> reveal healthcare
            system demand and workforce impacts.
          </p>
          <p>
            For real estate investors: municipalities with rising life expectancy and net positive
            births tend to sustain housing demand. For employers: opioid mortality and physician
            shortages directly affect labour availability. For policymakers: these numbers are the
            ground truth beneath every budget line item in healthcare spending.
          </p>
          <p>
            All data here comes from official government sources — the Alberta Regional Dashboard
            (municipality-level demographics) and Alberta Open Data (province-wide mortality
            statistics). Where available, we link to the original datasets.
          </p>
        </div>
      </Card>

      {/* Page grid */}
      <div className="space-y-3">
        {pages.map((page) => (
          <div key={page.title} className="relative">
            {page.comingSoon ? (
              <div className="block">
                <Card className="opacity-60">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 mt-0.5">
                      <page.icon size={18} className="text-muted" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-foreground">
                          {page.title}
                        </h3>
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-muted bg-card-border/50 px-2 py-0.5 rounded-full">
                          <Lock size={10} />
                          Coming Soon
                        </span>
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
              </div>
            ) : (
              <Link href={page.href} className="group block">
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
            )}
          </div>
        ))}
      </div>

      {/* Jargon box */}
      <Card>
        <h3 className="text-xs font-medium text-foreground uppercase tracking-wider mb-3">
          Common terms in this section
        </h3>
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="font-medium text-foreground inline">Life expectancy</dt>
            <dd className="text-muted inline">
              {" "}— The average number of years a person is expected to live, calculated at
              birth. Varies by municipality, gender, and socioeconomic status. Alberta's
              provincial average is typically around 81-82 years.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground inline">Natural increase</dt>
            <dd className="text-muted inline">
              {" "}— Births minus deaths. A positive natural increase means the population is
              growing from births alone, independent of migration. Most Alberta municipalities
              have positive natural increase, but some rural areas are negative.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground inline">Age-standardized rate</dt>
            <dd className="text-muted inline">
              {" "}— A rate adjusted to remove the effect of age differences between
              populations. Essential for comparing mortality between municipalities with
              different age profiles (e.g., a retirement community vs. a young oil town).
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground inline">CKAN</dt>
            <dd className="text-muted inline">
              {" "}— Comprehensive Knowledge Archive Network. The open data platform used by
              the Government of Alberta to publish downloadable datasets. Most Alberta Open
              Data CSVs are hosted on CKAN at open.alberta.ca.
            </dd>
          </div>
        </dl>
      </Card>
    </main>
  );
}
