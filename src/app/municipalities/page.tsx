import Link from "next/link";
import { Card, MetricCard } from "@/components/card";
import {
  getLiveMunicipalities,
  getMunicipalitiesByRegion,
  REGION_LABELS,
  REGION_ORDER,
  type MunicipalityConfig,
} from "@/lib/municipality-registry";
import { Globe, Building2, ArrowRight, MapPin } from "lucide-react";

export const metadata = {
  title: "All Municipalities — Alberta Pulse Check",
  description: "Property data for every municipality in Alberta. Assessments, permits, businesses, and development data from free public APIs.",
};

function MunicipalityCard({ config }: { config: MunicipalityConfig }) {
  const capLabels = config.capabilities.map((c) => c.replace(/_/g, " "));

  return (
    <Link href={`/m/${config.slug}`} className="group">
      <Card className="h-full hover:border-accent/30 transition-colors">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: config.color }}
            />
            <h3 className="text-sm font-medium group-hover:text-accent transition-colors">
              {config.name}
            </h3>
          </div>
          <ArrowRight
            size={14}
            className="text-muted group-hover:text-accent transition-colors"
          />
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
    </Link>
  );
}

export default function MunicipalitiesPage() {
  const all = getLiveMunicipalities();
  const byRegion = getMunicipalitiesByRegion();

  const totalPop = all.reduce((s, m) => s + (m.population || 0), 0);
  const totalCaps = new Set(all.flatMap((m) => m.capabilities));

  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <Globe size={22} className="text-accent" />
          All Alberta Municipalities
        </h1>
        <p className="text-sm text-muted mt-1">
          {all.length} municipalities with live data from public APIs.
          Free property assessments, permits, businesses, and development data across the province.
        </p>
      </header>

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
      <Link href="/dashboard" className="block group">
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
            <div className="flex items-center gap-2 mb-3">
              <MapPin size={16} className="text-muted" />
              <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
                {REGION_LABELS[region]}
              </h2>
              <span className="text-[10px] text-muted/60">
                ({municipalities.length} {municipalities.length === 1 ? "municipality" : "municipalities"})
              </span>
            </div>
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

      {/* Embeddable charts promo */}
      <Card className="text-center py-8">
        <h3 className="text-sm font-medium mb-2">Embeddable Charts</h3>
        <p className="text-xs text-muted max-w-md mx-auto">
          Every chart on Alberta Pulse Check can be embedded on your website.
          Click the &quot;Embed&quot; button on any chart to get an iframe code.
          Perfect for municipal websites, news outlets, and real estate blogs.
        </p>
      </Card>

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Alberta Pulse Check — Province-wide municipal data from public APIs
      </footer>
    </main>
  );
}
