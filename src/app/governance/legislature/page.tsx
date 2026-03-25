import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import { PageHeader } from "@/components/page-header";
import { Building2, MapPin, Mail, Shield } from "lucide-react";
import {
  fetchAlbertaMLAs,
  fetchAlbertaElectoralDistricts,
  type ElectedOfficial,
  type ElectoralDistrict,
} from "@/lib/data-sources-politics";

// ============================================================
// Loading fallback
// ============================================================

function LoadingCard() {
  return (
    <Card>
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-card-border rounded w-1/3" />
        <div className="h-[200px] bg-card-border/50 rounded" />
      </div>
    </Card>
  );
}

// ============================================================
// Party color helper
// ============================================================

function partyColor(party: string): string {
  const p = party.toLowerCase();
  if (p.includes("united conservative") || p === "ucp") return "text-blue-500";
  if (p.includes("new democratic") || p === "ndp") return "text-orange-400";
  if (p.includes("alberta party")) return "text-teal-400";
  if (p.includes("liberal")) return "text-red-400";
  if (p.includes("independent")) return "text-gray-400";
  return "text-muted";
}

function partyBgColor(party: string): string {
  const p = party.toLowerCase();
  if (p.includes("united conservative") || p === "ucp") return "bg-blue-500";
  if (p.includes("new democratic") || p === "ndp") return "bg-orange-400";
  if (p.includes("alberta party")) return "bg-teal-400";
  if (p.includes("liberal")) return "bg-red-400";
  if (p.includes("independent")) return "bg-gray-400";
  return "bg-muted";
}

// ============================================================
// Party Breakdown (server component)
// ============================================================

async function PartyBreakdown() {
  const mlas = await fetchAlbertaMLAs().catch(() => [] as ElectedOfficial[]);

  if (mlas.length === 0) {
    return (
      <Card>
        <CardHeader title="Party Breakdown" subtitle="Seats by party in Alberta Legislature" />
        <p className="text-sm text-muted">No MLA data available.</p>
      </Card>
    );
  }

  const partyCounts: Record<string, number> = {};
  for (const mla of mlas) {
    const party = mla.party || "Unknown";
    partyCounts[party] = (partyCounts[party] || 0) + 1;
  }

  const sorted = Object.entries(partyCounts).sort((a, b) => b[1] - a[1]);
  const total = mlas.length;

  const ucpCount = sorted.find(([p]) => p.toLowerCase().includes("united conservative"))?.[1] || 0;
  const ndpCount = sorted.find(([p]) => p.toLowerCase().includes("new democratic"))?.[1] || 0;
  const otherCount = total - ucpCount - ndpCount;

  return (
    <>
      {/* Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          title="Total MLAs"
          value={String(total)}
          source="Represent API"
        />
        <MetricCard
          title="UCP Seats"
          value={String(ucpCount)}
          source="Represent API"
        />
        <MetricCard
          title="NDP Seats"
          value={String(ndpCount)}
          source="Represent API"
        />
        <MetricCard
          title="Other"
          value={String(otherCount)}
          source="Represent API"
        />
      </div>

      {/* Party Breakdown Bar */}
      <Card>
        <CardHeader
          title="Party Breakdown"
          subtitle="Seats by party in Alberta Legislature"
          badge={`${total} seats`}
        />
        <div className="space-y-3">
          {sorted.map(([party, count]) => {
            const pct = ((count / total) * 100).toFixed(1);
            return (
              <div key={party}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-medium ${partyColor(party)}`}>
                    {party}
                  </span>
                  <span className="text-xs text-muted">
                    {count} seat{count !== 1 ? "s" : ""} ({pct}%)
                  </span>
                </div>
                <div className="w-full bg-card-border/30 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full ${partyBgColor(party)}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}

// ============================================================
// MLAs Table (server component)
// ============================================================

async function MLAsTable() {
  const mlas = await fetchAlbertaMLAs().catch(() => [] as ElectedOfficial[]);

  if (mlas.length === 0) {
    return (
      <Card>
        <CardHeader title="Members of the Legislative Assembly" subtitle="All current Alberta MLAs" />
        <p className="text-sm text-muted">No MLA data available.</p>
      </Card>
    );
  }

  const sorted = [...mlas].sort((a, b) => a.district.localeCompare(b.district));

  return (
    <Card>
      <CardHeader
        title="Members of the Legislative Assembly"
        subtitle="All current Alberta MLAs, sorted by district"
        badge={`${mlas.length} MLAs`}
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-card-border text-left">
              <th className="pb-2 pr-4 text-xs font-medium text-muted">Name</th>
              <th className="pb-2 pr-4 text-xs font-medium text-muted">Party</th>
              <th className="pb-2 pr-4 text-xs font-medium text-muted">District</th>
              <th className="pb-2 text-xs font-medium text-muted">Email</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((mla, i) => (
              <tr
                key={`${mla.name}-${i}`}
                className="border-b border-card-border/50 last:border-0"
              >
                <td className="py-2 pr-4 text-foreground font-medium">
                  {mla.name}
                </td>
                <td className={`py-2 pr-4 ${partyColor(mla.party)}`}>
                  {mla.party}
                </td>
                <td className="py-2 pr-4 text-muted">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {mla.district}
                  </span>
                </td>
                <td className="py-2 text-muted">
                  {mla.email ? (
                    <a
                      href={`mailto:${mla.email}`}
                      className="flex items-center gap-1 text-accent hover:underline"
                    >
                      <Mail className="w-3 h-3" />
                      {mla.email}
                    </a>
                  ) : (
                    <span className="text-muted/50">&mdash;</span>
                  )}
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
// Electoral Districts (server component)
// ============================================================

async function ElectoralDistrictsGrid() {
  const districts = await fetchAlbertaElectoralDistricts().catch(
    () => [] as ElectoralDistrict[]
  );

  if (districts.length === 0) {
    return (
      <Card>
        <CardHeader title="Electoral Districts" subtitle="Alberta's provincial electoral districts" />
        <p className="text-sm text-muted">No district data available.</p>
      </Card>
    );
  }

  const sorted = [...districts].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Card>
      <CardHeader
        title="Electoral Districts"
        subtitle="Alberta's provincial electoral districts"
        badge={`${districts.length} districts`}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {sorted.map((d) => (
          <div
            key={d.id}
            className="flex items-center gap-2 p-2 rounded-lg bg-card-border/10 hover:bg-card-border/20 transition-colors"
          >
            <Shield className="w-3.5 h-3.5 text-accent shrink-0" />
            <span className="text-sm text-foreground truncate">{d.name}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ============================================================
// Main page
// ============================================================

export const metadata: Metadata = {
  title: "Alberta Legislature — MLAs, Parties & Electoral Districts",
  description: "Alberta's elected MLAs, party breakdown, electoral district data, and current government composition.",
};

export default function LegislaturePage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Alberta Legislature"
        description="Alberta's Members of the Legislative Assembly, party breakdown, and electoral districts. Live data from the Represent API."
        category="politics"
        icon={<Building2 size={20} />}
      />

      {/* Party Breakdown + Metrics */}
      <Suspense fallback={<LoadingCard />}>
        <PartyBreakdown />
      </Suspense>

      {/* Current Government */}
      <Card>
        <CardHeader
          title="Current Government"
          subtitle="Alberta provincial government at a glance"
        />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted mb-0.5">Premier</p>
            <p className="font-medium text-foreground">Danielle Smith</p>
            <p className="text-xs text-blue-500">UCP</p>
          </div>
          <div>
            <p className="text-xs text-muted mb-0.5">Legislature Seats</p>
            <p className="font-medium text-foreground">87</p>
          </div>
          <div>
            <p className="text-xs text-muted mb-0.5">Last Election</p>
            <p className="font-medium text-foreground">May 2023</p>
          </div>
          <div>
            <p className="text-xs text-muted mb-0.5">Next Election By</p>
            <p className="font-medium text-foreground">May 2027</p>
          </div>
        </div>
      </Card>

      {/* MLAs Table */}
      <Suspense fallback={<LoadingCard />}>
        <MLAsTable />
      </Suspense>

      {/* Electoral Districts */}
      <Suspense fallback={<LoadingCard />}>
        <ElectoralDistrictsGrid />
      </Suspense>

      <p className="text-center text-xs text-muted/60 font-mono pt-4">
        Alberta Pulse Check — Legislature — Data from Represent API (Open North)
      </p>
    </main>
  );
}
