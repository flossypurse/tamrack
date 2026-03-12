import { Card, CardHeader, MetricCard } from "@/components/card";
import { PageHeader } from "@/components/page-header";
import {
  MUNICIPALITY_REGISTRY,
  getLiveMunicipalities,
  getMunicipalitiesByRegion,
  REGION_LABELS,
  REGION_ORDER,
  type DataCapability,
  type MunicipalityConfig,
} from "@/lib/municipality-registry";
import { Database, Globe } from "lucide-react";

export const metadata = {
  title: "Data Coverage Matrix — Alberta Municipality Data Sources",
  description: "Coverage matrix showing which data types are available for each Alberta municipality — assessments, permits, businesses, vacant lots, construction, and zoning data.",
};

const ALL_CAPABILITIES: { key: DataCapability; label: string; icon: string }[] = [
  { key: "assessments", label: "Assessments", icon: "$" },
  { key: "permits", label: "Permits", icon: "P" },
  { key: "businesses", label: "Businesses", icon: "B" },
  { key: "vacant_lots", label: "Vacant", icon: "V" },
  { key: "construction", label: "Construction", icon: "C" },
  { key: "zoning", label: "Zoning", icon: "Z" },
  { key: "dev_permits", label: "Dev Permits", icon: "D" },
  { key: "development_stages", label: "Dev Stages", icon: "S" },
];

const REGIONAL_INDICATORS = [
  "Equalized Assessment",
  "Building Permits",
  "Housing Starts",
  "Businesses",
  "Vacancy Rates",
  "Average Rent",
  "Median Income",
  "Tax Rates",
  "Well Count",
  "Land Titles",
  "Bankruptcies",
  "Incorporations",
];

function StatusIcon({ available }: { available: boolean }) {
  return available ? (
    <span className="text-green-400 text-xs font-bold" title="Available">&#10003;</span>
  ) : (
    <span className="text-zinc-600 text-xs" title="Not available">&mdash;</span>
  );
}

export default function CoveragePage() {
  const all = MUNICIPALITY_REGISTRY;
  const live = getLiveMunicipalities();
  const byRegion = getMunicipalitiesByRegion();

  const totalCapabilities = live.reduce(
    (sum, m) => sum + m.capabilities.length,
    0
  );
  const totalPopulation = all.reduce((sum, m) => sum + (m.population || 0), 0);

  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Data Coverage"
        description="What data is available for every Alberta municipality on the platform."
        category="municipalities"
        icon={<Database size={22} />}
      />

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          title="Total Municipalities"
          value={String(all.length)}
          source="In registry"
        />
        <MetricCard
          title="Live (Verified)"
          value={String(live.length)}
          change={`${Math.round((live.length / all.length) * 100)}% verified`}
          source="Endpoints tested"
        />
        <MetricCard
          title="Planned"
          value={String(all.length - live.length)}
          source="Endpoints unverified"
        />
        <MetricCard
          title="Combined Population"
          value={`~${(totalPopulation / 1_000_000).toFixed(1)}M`}
          source="All registered"
        />
        <MetricCard
          title="Data Connections"
          value={String(totalCapabilities)}
          source="Active API feeds"
        />
      </div>

      {/* Province-wide data note */}
      <Card>
        <div className="flex items-start gap-3">
          <Globe size={18} className="text-cyan-400 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-medium">Province-Wide Data (All Municipalities)</h3>
            <p className="text-xs text-muted mt-1">
              The Alberta Regional Dashboard API provides {REGIONAL_INDICATORS.length} indicators
              for ALL ~340 municipalities: {REGIONAL_INDICATORS.join(", ")}.
              This data appears automatically on every municipality page, even those without
              their own ArcGIS endpoints.
            </p>
          </div>
        </div>
      </Card>

      {/* Coverage Table */}
      <Card>
        <CardHeader
          title="Municipality Data Matrix"
          subtitle="Green = live API feed verified. Dash = not available via direct API."
        />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-card-border text-muted text-left">
                <th className="pb-2 pr-3 font-medium sticky left-0 bg-card z-10">Municipality</th>
                <th className="pb-2 px-1 font-medium text-center">Status</th>
                <th className="pb-2 px-1 font-medium text-center">Pop</th>
                {ALL_CAPABILITIES.map((c) => (
                  <th key={c.key} className="pb-2 px-1 font-medium text-center" title={c.label}>
                    {c.icon}
                  </th>
                ))}
                <th className="pb-2 pl-2 font-medium">Data Source</th>
              </tr>
            </thead>
            <tbody>
              {REGION_ORDER.map((regionKey) => {
                const munis = byRegion[regionKey];
                if (!munis?.length) return null;
                return [
                  <tr key={`region-${regionKey}`}>
                    <td
                      colSpan={ALL_CAPABILITIES.length + 4}
                      className="pt-4 pb-1 text-[10px] font-semibold text-muted uppercase tracking-widest"
                    >
                      {REGION_LABELS[regionKey]}
                    </td>
                  </tr>,
                  ...munis
                    .sort((a, b) => (b.population || 0) - (a.population || 0))
                    .map((m: MunicipalityConfig) => (
                      <tr
                        key={m.slug}
                        className="border-b border-card-border/30 hover:bg-card-border/20"
                      >
                        <td className="py-1.5 pr-3 sticky left-0 bg-card z-10">
                          {m.status === "live" ? (
                            <a
                              href={`/municipalities/${m.slug}`}
                              className="hover:text-accent underline-offset-2 hover:underline"
                              style={{ color: m.color }}
                            >
                              {m.name}
                            </a>
                          ) : (
                            <span className="text-muted">{m.name}</span>
                          )}
                        </td>
                        <td className="py-1.5 px-1 text-center">
                          {m.status === "live" ? (
                            <span className="text-[9px] px-1 py-0.5 rounded bg-green-500/20 text-green-400">LIVE</span>
                          ) : (
                            <span className="text-[9px] px-1 py-0.5 rounded bg-zinc-500/20 text-zinc-400">PLAN</span>
                          )}
                        </td>
                        <td className="py-1.5 px-1 text-center text-muted">
                          {m.population ? `${(m.population / 1000).toFixed(0)}K` : "\u2014"}
                        </td>
                        {ALL_CAPABILITIES.map((c) => (
                          <td key={c.key} className="py-1.5 px-1 text-center">
                            <StatusIcon available={m.capabilities.includes(c.key)} />
                          </td>
                        ))}
                        <td className="py-1.5 pl-2 text-muted truncate max-w-[200px]">
                          {m.dataSource}
                        </td>
                      </tr>
                    )),
                ];
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Legend */}
      <Card>
        <h3 className="text-xs font-medium text-muted mb-2">Column Legend</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-muted">
          {ALL_CAPABILITIES.map((c) => (
            <div key={c.key}>
              <span className="font-mono font-bold text-foreground">{c.icon}</span> = {c.label}
            </div>
          ))}
        </div>
      </Card>

      {/* Data sources summary */}
      <Card>
        <CardHeader
          title="Data Source Types"
          subtitle="APIs and portals powering the platform"
        />
        <div className="grid sm:grid-cols-3 gap-4 text-xs">
          <div>
            <h4 className="font-medium text-accent-green mb-1">Municipal ArcGIS (Direct)</h4>
            <p className="text-muted">
              FeatureServer/MapServer endpoints from individual municipality GIS portals.
              Provides parcel-level assessment, zoning, permit, and business data.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-accent-green mb-1">City Open Data (Socrata)</h4>
            <p className="text-muted">
              Calgary and Edmonton use Socrata-based open data portals with JSON APIs.
              Rich datasets: assessments, permits, business licences, dev permits.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-accent-green mb-1">AB Regional Dashboard</h4>
            <p className="text-muted">
              Province-wide JSON API covering all ~340 municipalities with 12+ indicators:
              assessments, permits, housing, businesses, rents, vacancy, income, and more.
            </p>
          </div>
        </div>
      </Card>

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Alberta Pulse Check — Data Coverage Dashboard
      </footer>
    </main>
  );
}
