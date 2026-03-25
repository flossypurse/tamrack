import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import {
  Home,
  Building,
  TrendingUp,
  Landmark,
  CreditCard,
  MapPin,
  Flame,
  Newspaper,
  Briefcase,
  ArrowRight,
} from "lucide-react";
import { Card } from "@/components/card";

const roles = [
  {
    slug: "realtor",
    label: "Real Estate Agent",
    icon: Home,
    description: "Prospecting leads, neighbourhood signals, assessment trends, and market timing.",
    ready: true,
    color: "text-accent-green",
    datasets: ["Permits", "Assessments", "Dev Permits", "Business Licences", "Micro Signals"],
  },
  {
    slug: "developer",
    label: "Land Developer / Homebuilder",
    icon: Building,
    description: "Vacant land, development pipeline, absorption rates, permit velocity, and buildable inventory.",
    ready: true,
    color: "text-accent",
    datasets: ["Housing Starts", "Building Permits", "Population", "Dwellings", "Infrastructure"],
  },
  {
    slug: "investor",
    label: "Property Investor",
    icon: TrendingUp,
    description: "Cap rate proxies, rental yield, assessment growth, and macro cycle positioning.",
    ready: true,
    color: "text-accent-amber",
    datasets: ["Vacancy Rates", "Rents", "Assessments", "BoC Rates", "Immigration", "EI Beneficiaries"],
  },
  {
    slug: "edo",
    label: "Economic Development Officer",
    icon: Landmark,
    description: "Municipal benchmarks, investment scorecards, competitor analysis, and council-ready reports.",
    ready: true,
    color: "text-purple-400",
    datasets: ["12 Regional Indicators", "Major Projects", "Tax Rates", "Incorporations"],
  },
  {
    slug: "lender",
    label: "Mortgage Broker / Lender",
    icon: CreditCard,
    description: "Market risk scoring, vacancy trends, employment diversity, and rate sensitivity.",
    ready: true,
    color: "text-red-400",
    datasets: ["Vacancy Rates", "Assessments", "Unemployment", "Bankruptcies"],
  },
  {
    slug: "site-selection",
    label: "Site Selection / Franchise",
    icon: MapPin,
    description: "Competition density, trade area demographics, growth corridors, and gap analysis.",
    ready: true,
    color: "text-cyan-400",
    datasets: ["Business Licences", "Population", "Assessments", "Permits"],
  },
  {
    slug: "energy",
    label: "Energy Sector",
    icon: Flame,
    description: "Drilling activity, production trends, well counts, commodity prices, and service deployment.",
    ready: true,
    color: "text-orange-400",
    datasets: ["Well Count", "Oil/Gas Production", "Commodity Index", "Major Projects"],
  },
  {
    slug: "journalist",
    label: "Journalist / Researcher",
    icon: Newspaper,
    description: "Auto-generated data stories, flexible comparisons, embeddable charts, and trend detection.",
    ready: true,
    color: "text-emerald-400",
    datasets: ["All Indicators", "Snapshot Diffs", "Compare Tool"],
  },
];

export const metadata: Metadata = {
  title: "Alberta Intelligence Briefings",
  description: "Role-specific intelligence reports for Alberta decision-makers — realtors, investors, developers, and economic development officers.",
};

export default function BriefingPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Briefings"
        description="Intelligence reports tailored to how you make decisions. Pick your role — get the data that matters, pre-analysed, with action items."
        category="overview"
        icon={<Briefcase size={20} />}
      />

      <div className="grid gap-3">
        {roles.map((role) => {
          const Icon = role.icon;
          const inner = (
            <Card
              key={role.slug}
              className={`group transition-colors ${
                role.ready
                  ? "hover:border-accent/40 cursor-pointer"
                  : "opacity-60"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`mt-0.5 ${role.color}`}>
                  <Icon size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-sm font-medium">{role.label}</h2>
                    {role.ready ? (
                      <span className="text-[9px] font-mono bg-accent-green/15 text-accent-green px-1.5 py-0.5 rounded-full uppercase">
                        Live
                      </span>
                    ) : (
                      <span className="text-[9px] font-mono bg-muted/20 text-muted px-1.5 py-0.5 rounded-full uppercase">
                        Coming soon
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted leading-relaxed">{role.description}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {role.datasets.map((ds) => (
                      <span
                        key={ds}
                        className="text-[9px] bg-card-border/50 text-muted px-1.5 py-0.5 rounded"
                      >
                        {ds}
                      </span>
                    ))}
                  </div>
                </div>
                {role.ready && (
                  <ArrowRight
                    size={16}
                    className="text-muted group-hover:text-accent transition-colors mt-1 shrink-0"
                  />
                )}
              </div>
            </Card>
          );

          if (role.ready) {
            return (
              <Link key={role.slug} href={`/home/briefings/${role.slug}`} className="block">
                {inner}
              </Link>
            );
          }
          return <div key={role.slug}>{inner}</div>;
        })}
      </div>

      <Card className="text-center">
        <p className="text-xs text-muted">
          Briefings pull live data from the same sources that power the dashboard.
          They don&apos;t replace the deep-dive pages — they link into them.
        </p>
        <p className="text-[10px] text-muted/60 mt-1">
          More roles rolling out as we wire additional datasets.
        </p>
      </Card>
    </main>
  );
}
