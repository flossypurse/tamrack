import Link from "next/link";
import { Card, MetricCard } from "@/components/card";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import {
  MUNICIPALITY_REGISTRY,
  getLiveMunicipalities,
  getMunicipalitiesByRegion,
  REGION_LABELS,
  REGION_ORDER,
  type MunicipalityConfig,
} from "@/lib/municipality-registry";
import { Globe, Building2, ArrowRight, MapPin } from "lucide-react";
import { SITE_URL } from "@/lib/constants/site";

export const metadata = {
  title: "Alberta Municipalities — Economic Data for 22+ Communities",
  description: "Explore economic data across 22 live Alberta municipalities — building permits, property assessments, business activity, and development trends from Edmonton to Calgary and beyond.",
  alternates: {
    canonical: `${SITE_URL}/municipalities`,
  },
};

function MunicipalityCard({ config }: { config: MunicipalityConfig }) {
  const capLabels = config.capabilities.map((c) => c.replace(/_/g, " "));
  const isLive = config.status === "live";

  const inner = (
    <Card className={`h-full transition-colors ${isLive ? "hover:border-accent/30" : "opacity-60"}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: isLive ? config.color : "#71717a" }}
          />
          <h3 className={`text-sm font-medium ${isLive ? "group-hover:text-accent" : "text-muted"} transition-colors`}>
            {config.name}
          </h3>
          {!isLive && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-zinc-500/20 text-zinc-400">
              PLANNED
            </span>
          )}
        </div>
        {isLive && (
          <ArrowRight
            size={14}
            className="text-muted group-hover:text-accent transition-colors"
          />
        )}
      </div>

      {config.population && (
        <p className="text-xs text-muted mt-1">
          Pop. ~{config.population.toLocaleString()}
        </p>
      )}

      <div className="flex flex-wrap gap-1 mt-3">
        {capLabels.map((cap) => (
          <span
            key={cap}
            className="text-[9px] bg-white/[0.04] text-muted px-1.5 py-0.5 rounded"
          >
            {cap}
          </span>
        ))}
      </div>

      <p className="text-[10px] text-muted/60 mt-2 font-mono">
        {config.dataSource}
      </p>
    </Card>
  );

  if (isLive) {
    return (
      <Link href={`/municipalities/${config.slug}`} className="group">
        {inner}
      </Link>
    );
  }
  return <div>{inner}</div>;
}

export default function MunicipalitiesPage() {
  const all = MUNICIPALITY_REGISTRY;
  const live = getLiveMunicipalities();
  const byRegion = getMunicipalitiesByRegion();

  const totalPop = all.reduce((s, m) => s + (m.population || 0), 0);
  const totalCaps = new Set(live.flatMap((m) => m.capabilities));

  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="All Alberta Municipalities"
        description={`${all.length} municipalities tracked, ${live.length} with live verified data. Free property assessments, permits, businesses, and development data across the province.`}
        category="municipalities"
        icon={<Globe size={22} />}
      />

      {/* Summary metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Municipalities"
          value={String(all.length)}
          source="+ Edmonton via SODA"
        />
        <MetricCard
          title="Combined Population"
          value={`~${(totalPop / 1_000_000).toFixed(1)}M`}
          source="Approximate"
        />
        <MetricCard
          title="Data Types"
          value={String(totalCaps.size)}
          source={Array.from(totalCaps).join(", ").replace(/_/g, " ")}
        />
        <MetricCard
          title="Regions"
          value={String(REGION_ORDER.filter((r) => byRegion[r]?.length > 0).length)}
          source="Province-wide coverage"
        />
      </div>

      {/* Edmonton callout */}
      <Link href="/municipalities/edmonton" className="block group">
        <Card className="hover:border-accent/30 transition-colors bg-gradient-to-r from-card to-accent/[0.03]">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Building2 size={18} className="text-accent" />
                <h2 className="text-base font-semibold group-hover:text-accent transition-colors">
                  Edmonton
                </h2>
                <span className="text-[9px] bg-accent/10 text-accent px-2 py-0.5 rounded-full">
                  FULL COVERAGE
                </span>
              </div>
              <p className="text-xs text-muted mt-1">
                Pop. ~1,100,000 — Building permits, property assessments, business licences, development permits, road construction via Socrata Open Data.
              </p>
            </div>
            <ArrowRight size={16} className="text-muted group-hover:text-accent transition-colors shrink-0" />
          </div>
        </Card>
      </Link>

      {/* Regions */}
      {REGION_ORDER.map((region) => {
        const municipalities = byRegion[region];
        if (!municipalities || municipalities.length === 0) return null;

        return (
          <section key={region}>
            <SectionHeader
              title={`${REGION_LABELS[region]} (${municipalities.length} ${municipalities.length === 1 ? "municipality" : "municipalities"})`}
              icon={<MapPin size={16} />}
              category="municipalities"
            />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {municipalities
                .sort((a, b) => (b.population || 0) - (a.population || 0))
                .map((config) => (
                  <MunicipalityCard key={config.slug} config={config} />
                ))}
            </div>
          </section>
        );
      })}

      {/* Coverage + embed promo */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Link href="/municipalities/coverage" className="group">
          <Card className="h-full hover:border-accent/30 transition-colors text-center py-6">
            <h3 className="text-sm font-medium mb-2 group-hover:text-accent transition-colors">Data Coverage Matrix</h3>
            <p className="text-xs text-muted max-w-md mx-auto">
              See exactly which data types are available for every municipality.
              Detailed breakdown by API source and capability.
            </p>
          </Card>
        </Link>
        <Card className="text-center py-6">
          <h3 className="text-sm font-medium mb-2">Embeddable Charts</h3>
          <p className="text-xs text-muted max-w-md mx-auto">
            Every chart can be embedded on your website.
            Click &quot;Embed&quot; on any chart for iframe code.
          </p>
        </Card>
      </div>
    </main>
  );
}
