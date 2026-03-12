"use client";

import { useState, useMemo } from "react";
import { Card, CardHeader } from "@/components/card";
import {
  Scale,
  Check,
  X,
  MapPin,
  Users,
  Building2,
  ChevronRight,
  FileText,
  Store,
  Landmark,
  Construction,
  Map,
  Layers,
} from "lucide-react";
import {
  getLiveMunicipalities,
  REGION_LABELS,
  REGION_ORDER,
  type MunicipalityConfig,
  type MunicipalityRegion,
  type DataCapability,
} from "@/lib/municipality-registry";
import Link from "next/link";

const MAX_COMPARE = 5;

const CAPABILITY_LABELS: Record<DataCapability, { label: string; icon: typeof Check }> = {
  assessments: { label: "Assessments", icon: Landmark },
  permits: { label: "Permits", icon: FileText },
  businesses: { label: "Businesses", icon: Store },
  vacant_lots: { label: "Vacant Lots", icon: Map },
  construction: { label: "Construction", icon: Construction },
  zoning: { label: "Zoning", icon: Layers },
  development_stages: { label: "Dev Stages", icon: Building2 },
  dev_permits: { label: "Dev Permits", icon: FileText },
};

const ALL_CAPABILITIES: DataCapability[] = [
  "assessments",
  "permits",
  "businesses",
  "dev_permits",
  "zoning",
  "vacant_lots",
  "construction",
  "development_stages",
];

export default function ComparePage() {
  const allMunicipalities = useMemo(() => getLiveMunicipalities(), []);
  const [selected, setSelected] = useState<string[]>([]);

  // Group live municipalities by region
  const byRegion = useMemo(() => {
    const grouped: Partial<Record<MunicipalityRegion, MunicipalityConfig[]>> = {};
    for (const m of allMunicipalities) {
      if (!grouped[m.region]) grouped[m.region] = [];
      grouped[m.region]!.push(m);
    }
    return grouped;
  }, [allMunicipalities]);

  const selectedMunicipalities = useMemo(
    () => allMunicipalities.filter((m) => selected.includes(m.slug)),
    [allMunicipalities, selected]
  );

  function toggle(slug: string) {
    setSelected((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, slug];
    });
  }

  function clearAll() {
    setSelected([]);
  }

  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <header>
        <div className="flex items-center gap-2 mb-1">
          <Scale size={20} className="text-accent" />
          <h1 className="text-xl font-semibold tracking-tight">
            Compare Municipalities
          </h1>
        </div>
        <p className="text-sm text-muted">
          Select up to 5 municipalities and compare key metrics side-by-side.
          Built for journalists, researchers, and economic development officers.
        </p>
      </header>

      {/* Selected pills */}
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">
            {selected.length}/{MAX_COMPARE} selected
          </span>
          {selectedMunicipalities.map((m) => (
            <button
              key={m.slug}
              onClick={() => toggle(m.slug)}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: m.color }}
              />
              {m.name}
              <X size={12} />
            </button>
          ))}
          <button
            onClick={clearAll}
            className="text-xs text-muted hover:text-foreground transition-colors underline underline-offset-2"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Municipality Selector */}
      <section>
        <Card>
          <CardHeader
            title="Select Municipalities"
            subtitle={`Choose up to ${MAX_COMPARE} from ${allMunicipalities.length} live municipalities`}
          />
          <div className="space-y-5">
            {REGION_ORDER.map((region) => {
              const municipalities = byRegion[region];
              if (!municipalities || municipalities.length === 0) return null;
              return (
                <div key={region}>
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin size={12} className="text-muted" />
                    <h4 className="text-xs font-medium text-muted uppercase tracking-wider">
                      {REGION_LABELS[region]}
                    </h4>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {municipalities.map((m) => {
                      const isSelected = selected.includes(m.slug);
                      const isDisabled =
                        !isSelected && selected.length >= MAX_COMPARE;
                      return (
                        <button
                          key={m.slug}
                          onClick={() => toggle(m.slug)}
                          disabled={isDisabled}
                          className={`
                            flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-all
                            border
                            ${
                              isSelected
                                ? "border-accent bg-accent/10 text-foreground"
                                : isDisabled
                                  ? "border-card-border bg-card text-muted/40 cursor-not-allowed"
                                  : "border-card-border bg-card text-foreground hover:border-accent/40 hover:bg-accent/5"
                            }
                          `}
                        >
                          <span
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                              isSelected
                                ? "bg-accent border-accent"
                                : "border-card-border"
                            }`}
                          >
                            {isSelected && (
                              <Check size={12} className="text-white" />
                            )}
                          </span>
                          <span className="truncate">{m.name}</span>
                          {m.population && (
                            <span className="text-[10px] text-muted ml-auto shrink-0">
                              {m.population >= 1_000_000
                                ? `${(m.population / 1_000_000).toFixed(1)}M`
                                : `${(m.population / 1_000).toFixed(0)}K`}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      {/* Comparison Table */}
      {selectedMunicipalities.length > 0 && (
        <section>
          <Card>
            <CardHeader
              title="Comparison"
              subtitle={`${selectedMunicipalities.length} municipalities selected`}
            />
            <div className="overflow-x-auto -mx-3 sm:-mx-5 px-3 sm:px-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-card-border">
                    <th className="text-left text-xs text-muted font-medium py-2 pr-4 min-w-[140px]">
                      Metric
                    </th>
                    {selectedMunicipalities.map((m) => (
                      <th
                        key={m.slug}
                        className="text-left text-xs font-medium py-2 px-3 min-w-[120px]"
                      >
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: m.color }}
                          />
                          <span className="text-foreground truncate">
                            {m.name}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-card-border/50">
                  {/* Region */}
                  <tr>
                    <td className="py-2.5 pr-4 text-xs text-muted">Region</td>
                    {selectedMunicipalities.map((m) => (
                      <td key={m.slug} className="py-2.5 px-3 text-xs">
                        {REGION_LABELS[m.region]}
                      </td>
                    ))}
                  </tr>

                  {/* Population */}
                  <tr>
                    <td className="py-2.5 pr-4 text-xs text-muted">
                      <span className="flex items-center gap-1.5">
                        <Users size={12} />
                        Population
                      </span>
                    </td>
                    {selectedMunicipalities.map((m) => (
                      <td key={m.slug} className="py-2.5 px-3 text-xs font-medium">
                        {m.population
                          ? m.population.toLocaleString()
                          : <span className="text-muted">--</span>}
                      </td>
                    ))}
                  </tr>

                  {/* Data Source */}
                  <tr>
                    <td className="py-2.5 pr-4 text-xs text-muted">
                      Data Source
                    </td>
                    {selectedMunicipalities.map((m) => (
                      <td
                        key={m.slug}
                        className="py-2.5 px-3 text-[10px] text-muted font-mono"
                      >
                        {m.dataSource}
                      </td>
                    ))}
                  </tr>

                  {/* Capabilities */}
                  {ALL_CAPABILITIES.map((cap) => {
                    // Only show rows where at least one selected municipality has this capability
                    const anyHas = selectedMunicipalities.some((m) =>
                      m.capabilities.includes(cap)
                    );
                    if (!anyHas) return null;
                    const capInfo = CAPABILITY_LABELS[cap];
                    const Icon = capInfo.icon;
                    return (
                      <tr key={cap}>
                        <td className="py-2.5 pr-4 text-xs text-muted">
                          <span className="flex items-center gap-1.5">
                            <Icon size={12} />
                            {capInfo.label}
                          </span>
                        </td>
                        {selectedMunicipalities.map((m) => {
                          const has = m.capabilities.includes(cap);
                          return (
                            <td key={m.slug} className="py-2.5 px-3">
                              {has ? (
                                <Check
                                  size={14}
                                  className="text-accent-green"
                                />
                              ) : (
                                <X size={14} className="text-muted/30" />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}

                  {/* Total Capabilities Count */}
                  <tr>
                    <td className="py-2.5 pr-4 text-xs text-muted font-medium">
                      Total Data Points
                    </td>
                    {selectedMunicipalities.map((m) => (
                      <td
                        key={m.slug}
                        className="py-2.5 px-3 text-sm font-semibold"
                      >
                        {m.capabilities.length}
                      </td>
                    ))}
                  </tr>

                  {/* Deep Dive Link */}
                  <tr>
                    <td className="py-2.5 pr-4 text-xs text-muted">
                      Deep Dive
                    </td>
                    {selectedMunicipalities.map((m) => (
                      <td key={m.slug} className="py-2.5 px-3">
                        <Link
                          href={`/municipalities/${m.slug}`}
                          className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                        >
                          View
                          <ChevronRight size={12} />
                        </Link>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Notes */}
            {selectedMunicipalities.some((m) => m.notes && m.notes.length > 0) && (
              <div className="mt-4 pt-3 border-t border-card-border/50">
                <p className="text-[10px] text-muted/60 font-medium uppercase tracking-wider mb-1">
                  Notes
                </p>
                <ul className="space-y-0.5">
                  {selectedMunicipalities
                    .filter((m) => m.notes && m.notes.length > 0)
                    .map((m) =>
                      m.notes!.map((note, i) => (
                        <li
                          key={`${m.slug}-${i}`}
                          className="text-[10px] text-muted/60"
                        >
                          <span className="font-medium text-muted">
                            {m.name}:
                          </span>{" "}
                          {note}
                        </li>
                      ))
                    )}
                </ul>
              </div>
            )}
          </Card>
        </section>
      )}

      {/* Empty state */}
      {selected.length === 0 && (
        <section>
          <Card className="text-center py-12">
            <Scale size={32} className="mx-auto text-muted/30 mb-3" />
            <p className="text-sm text-muted">
              Select municipalities above to start comparing
            </p>
            <p className="text-xs text-muted/60 mt-1">
              Click any municipality to add it to the comparison table
            </p>
          </Card>
        </section>
      )}

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Alberta Pulse Check &mdash; Compare &mdash; All data from free public APIs
      </footer>
    </main>
  );
}
