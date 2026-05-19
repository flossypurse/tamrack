import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import { Factory, Flame, MapPin } from "lucide-react";
import {
  fetchGHGFacilities,
  fetchTopEmittersByCompany,
  type GHGFacility,
} from "@/lib/data-sources-business";
import { SITE_URL } from "@/lib/constants/site";

export const metadata: Metadata = {
  title: "Alberta Industrial Emissions — Facility GHG Reporting (ECCC)",
  description:
    "Track Alberta's largest industrial greenhouse gas emitters by facility and parent company. Source: Environment and Climate Change Canada GHGRP.",
  alternates: {
    canonical: `${SITE_URL}/environment/emissions`,
  },
};

// ============================================================
// Metrics
// ============================================================

async function EmissionsMetrics() {
  const [facilities, byCompany] = await Promise.all([
    fetchGHGFacilities(200).catch(() => [] as GHGFacility[]),
    fetchTopEmittersByCompany(100).catch(
      () => [] as { company: string; totalEmissions: number; facilityCount: number; year: number }[]
    ),
  ]);

  const totalEmissions = facilities.reduce((s, f) => s + f.totalEmissions, 0);
  const year = facilities[0]?.year || 0;
  const topEmitter = byCompany[0];
  const uniqueCities = new Set(facilities.map((f) => f.city).filter(Boolean));

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Reporting Facilities"
        value={facilities.length.toString()}
        change={year ? `${year} data` : undefined}
        source="ECCC GHGRP"
      />
      <MetricCard
        title="Total Emissions"
        value={
          totalEmissions > 0
            ? `${(totalEmissions / 1_000_000).toFixed(1)}Mt CO₂e`
            : "—"
        }
        source="ECCC GHGRP"
      />
      <MetricCard
        title="Top Emitter"
        value={topEmitter?.company?.slice(0, 30) || "—"}
        change={
          topEmitter
            ? `${(topEmitter.totalEmissions / 1_000_000).toFixed(2)}Mt CO₂e`
            : undefined
        }
        source="ECCC"
      />
      <MetricCard
        title="Cities Reporting"
        value={uniqueCities.size.toString()}
        source="ECCC GHGRP"
      />
    </div>
  );
}

// ============================================================
// Top Emitters by Company
// ============================================================

async function TopEmittersTable() {
  const data = await fetchTopEmittersByCompany(30).catch(
    () => [] as { company: string; totalEmissions: number; facilityCount: number; year: number }[]
  );

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader title="Top Emitters by Company" />
        <p className="text-sm text-muted">
          ECCC GHG data not currently available. The dataset is ~20MB and may take time to load.
        </p>
      </Card>
    );
  }

  const totalEmissions = data.reduce((s, d) => s + d.totalEmissions, 0);

  return (
    <Card>
      <CardHeader
        title="Top Emitters by Parent Company"
        subtitle={`${data.length} companies • ${(totalEmissions / 1_000_000).toFixed(1)}Mt total CO₂e (${data[0]?.year || ""})`}
        badge="ECCC"
        freshness="daily"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-card-border text-muted">
              <th className="text-left py-2 pr-4">#</th>
              <th className="text-left py-2 pr-4">Company</th>
              <th className="text-right py-2 pr-4">Emissions (kt CO₂e)</th>
              <th className="text-right py-2 pr-4">Facilities</th>
              <th className="text-right py-2 pr-4">Share</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr
                key={row.company}
                className="border-b border-card-border/50 hover:bg-card-border/20"
              >
                <td className="py-2 pr-4 text-muted">{i + 1}</td>
                <td className="py-2 pr-4 font-medium max-w-[250px] truncate">
                  {row.company}
                </td>
                <td className="py-2 pr-4 text-right font-mono">
                  {(row.totalEmissions / 1_000).toFixed(0)}
                </td>
                <td className="py-2 pr-4 text-right font-mono">
                  {row.facilityCount}
                </td>
                <td className="py-2 pr-4 text-right text-muted">
                  {totalEmissions > 0
                    ? `${((row.totalEmissions / totalEmissions) * 100).toFixed(1)}%`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted/60 mt-3">
        Source: Environment and Climate Change Canada — Greenhouse Gas Reporting Program (GHGRP)
      </p>
    </Card>
  );
}

// ============================================================
// Facility-Level Detail
// ============================================================

async function FacilityTable() {
  const data = await fetchGHGFacilities(50).catch(() => [] as GHGFacility[]);

  if (data.length === 0) return null;

  return (
    <Card>
      <CardHeader
        title="Top 50 Emitting Facilities in Alberta"
        subtitle="Individual facility emissions"
        badge="ECCC"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-card-border text-muted">
              <th className="text-left py-2 pr-4">#</th>
              <th className="text-left py-2 pr-4">Facility</th>
              <th className="text-left py-2 pr-4">Company</th>
              <th className="text-left py-2 pr-4">City</th>
              <th className="text-right py-2 pr-4">Emissions (kt CO₂e)</th>
              <th className="text-right py-2 pr-4">NAICS</th>
            </tr>
          </thead>
          <tbody>
            {data.map((f, i) => (
              <tr
                key={`${f.facilityName}-${i}`}
                className="border-b border-card-border/50 hover:bg-card-border/20"
              >
                <td className="py-2 pr-4 text-muted">{i + 1}</td>
                <td className="py-2 pr-4 font-medium max-w-[200px] truncate">
                  {f.facilityName}
                </td>
                <td className="py-2 pr-4 max-w-[180px] truncate">
                  {f.parentCompany}
                </td>
                <td className="py-2 pr-4 text-muted">{f.city}</td>
                <td className="py-2 pr-4 text-right font-mono">
                  {(f.totalEmissions / 1_000).toFixed(0)}
                </td>
                <td className="py-2 pr-4 text-right font-mono text-muted">
                  {f.naicsCode || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ============================================================
// Page
// ============================================================

function LoadingCard() {
  return (
    <Card>
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-card-border rounded w-1/3" />
        <div className="h-32 bg-card-border/50 rounded" />
      </div>
    </Card>
  );
}

export default function EmissionsPage() {
  return (
    <>
      <PageHeader
        title="Alberta Industrial Emissions"
        category="environment"
        icon={<Factory size={20} />}
        description="Facility-level greenhouse gas emissions reported to Environment and Climate Change Canada. Identifies Alberta's largest industrial emitters by company and facility."
      />

      <Suspense fallback={<LoadingCard />}>
        <EmissionsMetrics />
      </Suspense>

      <SectionHeader title="Top Emitters by Company" category="environment" />
      <Suspense fallback={<LoadingCard />}>
        <TopEmittersTable />
      </Suspense>

      <SectionHeader title="Facility Detail" category="environment" />
      <Suspense fallback={<LoadingCard />}>
        <FacilityTable />
      </Suspense>
    </>
  );
}
