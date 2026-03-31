import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import { Users, Factory, HardHat, AlertTriangle } from "lucide-react";
import {
  fetchWCBByIndustry,
  fetchWCBEmployers,
  fetchStatCanBusinessBySector,
  fetchCRAT2Stats,
  type WCBEmployer,
  type BusinessCountByIndustry,
} from "@/lib/data-sources-business";

export const metadata: Metadata = {
  title: "Alberta Employers & Industry — WCB, StatsCan & CRA Data",
  description:
    "Track Alberta's largest employer industries via WCB records. Industry establishment counts from StatsCan. Corporate tax statistics from CRA.",
};

// ============================================================
// Metrics
// ============================================================

async function EmployerMetrics() {
  const [wcbData, sectors] = await Promise.all([
    fetchWCBByIndustry().catch(() => [] as { industry: string; employers: number; claims: number }[]),
    fetchStatCanBusinessBySector().catch(() => [] as BusinessCountByIndustry[]),
  ]);

  const totalWCBEmployers = wcbData.reduce((s, d) => s + d.employers, 0);
  const totalClaims = wcbData.reduce((s, d) => s + d.claims, 0);
  const totalEstablishments = sectors.reduce((s, d) => s + d.establishments, 0);
  const topIndustry = wcbData[0];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="WCB Registered Employers"
        value={totalWCBEmployers > 0 ? totalWCBEmployers.toLocaleString() : "—"}
        source="Alberta WCB"
      />
      <MetricCard
        title="Total WCB Claims"
        value={totalClaims > 0 ? totalClaims.toLocaleString() : "—"}
        source="Alberta WCB"
      />
      <MetricCard
        title="StatsCan Establishments"
        value={totalEstablishments > 0 ? totalEstablishments.toLocaleString() : "—"}
        source="StatsCan 33-10-0170"
      />
      <MetricCard
        title="Top Employer Industry"
        value={topIndustry?.industry || "—"}
        change={topIndustry ? `${topIndustry.employers.toLocaleString()} employers` : undefined}
        source="Alberta WCB"
      />
    </div>
  );
}

// ============================================================
// WCB Employers by Industry
// ============================================================

async function WCBIndustryTable() {
  const data = await fetchWCBByIndustry().catch(
    () => [] as { industry: string; employers: number; claims: number }[]
  );

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader title="Employers by Industry (WCB)" />
        <p className="text-sm text-muted">No data available — WCB XLSX may be temporarily unavailable</p>
      </Card>
    );
  }

  const totalEmployers = data.reduce((s, d) => s + d.employers, 0);
  const totalClaims = data.reduce((s, d) => s + d.claims, 0);

  return (
    <Card>
      <CardHeader
        title="Alberta Employers by Industry"
        subtitle={`${totalEmployers.toLocaleString()} employers, ${totalClaims.toLocaleString()} claims`}
        badge="WCB"
        freshness="daily"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-card-border text-muted">
              <th className="text-left py-2 pr-4">#</th>
              <th className="text-left py-2 pr-4">Industry</th>
              <th className="text-right py-2 pr-4">Employers</th>
              <th className="text-right py-2 pr-4">Claims</th>
              <th className="text-right py-2 pr-4">Claims/Employer</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr
                key={row.industry}
                className="border-b border-card-border/50 hover:bg-card-border/20"
              >
                <td className="py-2 pr-4 text-muted">{i + 1}</td>
                <td className="py-2 pr-4 font-medium">{row.industry}</td>
                <td className="py-2 pr-4 text-right font-mono">
                  {row.employers.toLocaleString()}
                </td>
                <td className="py-2 pr-4 text-right font-mono">
                  {row.claims.toLocaleString()}
                </td>
                <td className="py-2 pr-4 text-right font-mono text-muted">
                  {row.employers > 0
                    ? (row.claims / row.employers).toFixed(2)
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted/60 mt-3">
        Source: Alberta Workers&apos; Compensation Board — Employer Industry Records (Open Data)
      </p>
    </Card>
  );
}

// ============================================================
// WCB Detailed Records
// ============================================================

async function WCBDetailTable() {
  const data = await fetchWCBEmployers().catch(() => [] as WCBEmployer[]);

  if (data.length === 0) return null;

  // Show top sub-industries by employer count
  const bySubIndustry = new Map<string, { employers: number; claims: number; fatalities: number }>();
  for (const row of data) {
    const key = row.subIndustry || row.industry;
    const existing = bySubIndustry.get(key) || { employers: 0, claims: 0, fatalities: 0 };
    existing.employers += row.employerCount;
    existing.claims += row.claimsCount;
    existing.fatalities += row.fatalitiesCount;
    bySubIndustry.set(key, existing);
  }

  const sorted = [...bySubIndustry.entries()]
    .map(([industry, stats]) => ({ industry, ...stats }))
    .sort((a, b) => b.employers - a.employers)
    .slice(0, 25);

  if (sorted.length === 0) return null;

  return (
    <Card>
      <CardHeader
        title="Top Sub-Industries by Employer Count"
        subtitle="Detailed WCB breakdown"
        badge="WCB"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-card-border text-muted">
              <th className="text-left py-2 pr-4">#</th>
              <th className="text-left py-2 pr-4">Sub-Industry</th>
              <th className="text-right py-2 pr-4">Employers</th>
              <th className="text-right py-2 pr-4">Claims</th>
              <th className="text-right py-2 pr-4">Fatalities</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr
                key={row.industry}
                className="border-b border-card-border/50 hover:bg-card-border/20"
              >
                <td className="py-2 pr-4 text-muted">{i + 1}</td>
                <td className="py-2 pr-4 font-medium">{row.industry}</td>
                <td className="py-2 pr-4 text-right font-mono">
                  {row.employers.toLocaleString()}
                </td>
                <td className="py-2 pr-4 text-right font-mono">
                  {row.claims.toLocaleString()}
                </td>
                <td className={`py-2 pr-4 text-right font-mono ${row.fatalities > 0 ? "text-red-400" : "text-muted"}`}>
                  {row.fatalities > 0 ? row.fatalities : "—"}
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
// CRA T2 Corporate Stats
// ============================================================

async function CRAT2Table() {
  const data = await fetchCRAT2Stats().catch(
    () => [] as { sector: string; corporations: number; totalRevenue: number; totalAssets: number }[]
  );

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader title="Corporate Tax Statistics by Sector" />
        <p className="text-sm text-muted">CRA T2 data not currently available</p>
      </Card>
    );
  }

  const totalCorps = data.reduce((s, d) => s + d.corporations, 0);

  return (
    <Card>
      <CardHeader
        title="Corporate Tax Statistics by Sector"
        subtitle={`${totalCorps.toLocaleString()} corporations filing T2 returns`}
        badge="CRA"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-card-border text-muted">
              <th className="text-left py-2 pr-4">Sector</th>
              <th className="text-right py-2 pr-4">Corporations</th>
              <th className="text-right py-2 pr-4">Revenue</th>
              <th className="text-right py-2 pr-4">Assets</th>
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 20).map((row) => (
              <tr
                key={row.sector}
                className="border-b border-card-border/50 hover:bg-card-border/20"
              >
                <td className="py-2 pr-4 font-medium max-w-[200px] truncate">
                  {row.sector}
                </td>
                <td className="py-2 pr-4 text-right font-mono">
                  {row.corporations.toLocaleString()}
                </td>
                <td className="py-2 pr-4 text-right font-mono">
                  {row.totalRevenue > 0
                    ? `$${(row.totalRevenue / 1_000_000).toFixed(0)}M`
                    : "—"}
                </td>
                <td className="py-2 pr-4 text-right font-mono">
                  {row.totalAssets > 0
                    ? `$${(row.totalAssets / 1_000_000).toFixed(0)}M`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted/60 mt-3">
        Source: Canada Revenue Agency — T2 Corporate Income Tax Statistics
      </p>
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

export default function EmployersPage() {
  return (
    <>
      <PageHeader
        title="Alberta Employers & Industry"
        category="economy"
        icon={<Users size={20} />}
        description="WCB employer records, StatsCan establishment counts, and CRA corporate tax statistics. Track who employs Alberta."
      />

      <Suspense fallback={<LoadingCard />}>
        <EmployerMetrics />
      </Suspense>

      <SectionHeader title="WCB Employer Records" category="economy" />
      <Suspense fallback={<LoadingCard />}>
        <WCBIndustryTable />
      </Suspense>

      <Suspense fallback={<LoadingCard />}>
        <WCBDetailTable />
      </Suspense>

      <SectionHeader title="Corporate Tax Statistics" category="economy" />
      <Suspense fallback={<LoadingCard />}>
        <CRAT2Table />
      </Suspense>
    </>
  );
}
