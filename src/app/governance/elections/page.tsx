import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import { PageHeader } from "@/components/page-header";
import { Shield } from "lucide-react";
import {
  fetchFederalElectionResultsAB,
  type ElectionRidingResult,
} from "@/lib/data-sources-politics";

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

function fedPartyColor(party: string): string {
  const p = party.toLowerCase();
  if (p.includes("conservative")) return "text-blue-500";
  if (p.includes("liberal")) return "text-red-400";
  if (p.includes("ndp") || p.includes("new democratic")) return "text-orange-400";
  if (p.includes("green")) return "text-green-400";
  if (p.includes("people")) return "text-purple-400";
  return "text-muted";
}

function fedPartyBg(party: string): string {
  const p = party.toLowerCase();
  if (p.includes("conservative")) return "bg-blue-500";
  if (p.includes("liberal")) return "bg-red-400";
  if (p.includes("ndp") || p.includes("new democratic")) return "bg-orange-400";
  if (p.includes("green")) return "bg-green-400";
  if (p.includes("people")) return "bg-purple-400";
  return "bg-muted";
}

// ============================================================
// Federal Election Results (44th GE — 2021)
// ============================================================

async function FederalResultsSection() {
  const results = await fetchFederalElectionResultsAB().catch(
    () => [] as ElectionRidingResult[]
  );

  if (results.length === 0) {
    return (
      <Card>
        <CardHeader
          title="44th Federal Election — Alberta Results (2021)"
          subtitle="Poll-by-poll results aggregated to riding level"
        />
        <p className="text-sm text-muted">
          No election data available. The Elections Canada CSV may be temporarily unreachable.
        </p>
      </Card>
    );
  }

  // Aggregate to party level
  const winners = results.filter((r) => r.elected);
  const partySeatCounts: Record<string, number> = {};
  for (const w of winners) {
    const party = w.party || "Unknown";
    partySeatCounts[party] = (partySeatCounts[party] || 0) + 1;
  }
  const sortedParties = Object.entries(partySeatCounts).sort(
    (a, b) => b[1] - a[1]
  );
  const totalRidings = new Set(results.map((r) => r.electoralDistrictNumber)).size;

  // Popular vote by party
  const partyVotes: Record<string, number> = {};
  for (const r of results) {
    partyVotes[r.party] = (partyVotes[r.party] || 0) + r.votes;
  }
  const totalVotes = Object.values(partyVotes).reduce((s, v) => s + v, 0);
  const sortedByVote = Object.entries(partyVotes).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          title="Alberta Ridings"
          value={String(totalRidings)}
          source="Elections Canada"
        />
        <MetricCard
          title="Total Votes"
          value={totalVotes.toLocaleString()}
          source="Elections Canada"
        />
        {sortedParties.slice(0, 2).map(([party, seats]) => (
          <MetricCard
            key={party}
            title={party.length > 25 ? party.slice(0, 23) + "..." : party}
            value={`${seats} seats`}
            source="Elections Canada"
          />
        ))}
      </div>

      {/* Seat breakdown */}
      <Card>
        <CardHeader
          title="Seats Won — 44th GE (2021)"
          subtitle="Alberta ridings by winning party"
          badge={`${totalRidings} ridings`}
        />
        <div className="space-y-3">
          {sortedParties.map(([party, count]) => {
            const pct = ((count / totalRidings) * 100).toFixed(1);
            return (
              <div key={party}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-medium ${fedPartyColor(party)}`}>
                    {party}
                  </span>
                  <span className="text-xs text-muted">
                    {count} seat{count !== 1 ? "s" : ""} ({pct}%)
                  </span>
                </div>
                <div className="w-full bg-card-border/30 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full ${fedPartyBg(party)}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Popular vote breakdown */}
      <Card>
        <CardHeader
          title="Popular Vote — Alberta (2021)"
          subtitle="Total votes cast by party across all Alberta ridings"
          badge={`${totalVotes.toLocaleString()} votes`}
        />
        <div className="space-y-3">
          {sortedByVote.slice(0, 8).map(([party, votes]) => {
            const pct = ((votes / totalVotes) * 100).toFixed(1);
            return (
              <div key={party}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-medium ${fedPartyColor(party)}`}>
                    {party}
                  </span>
                  <span className="text-xs text-muted">
                    {votes.toLocaleString()} votes ({pct}%)
                  </span>
                </div>
                <div className="w-full bg-card-border/30 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${fedPartyBg(party)}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Riding-by-riding results table */}
      <Card>
        <CardHeader
          title="Results by Riding"
          subtitle="Winning candidate in each Alberta riding"
          badge={`${winners.length} ridings`}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border text-left">
                <th className="pb-2 pr-4 text-xs font-medium text-muted">Riding</th>
                <th className="pb-2 pr-4 text-xs font-medium text-muted">Winner</th>
                <th className="pb-2 pr-4 text-xs font-medium text-muted">Party</th>
                <th className="pb-2 pr-4 text-xs font-medium text-muted">Votes</th>
                <th className="pb-2 text-xs font-medium text-muted">Share</th>
              </tr>
            </thead>
            <tbody>
              {winners
                .sort((a, b) => a.electoralDistrict.localeCompare(b.electoralDistrict))
                .map((w, i) => (
                  <tr key={`${w.electoralDistrictNumber}-${i}`} className="border-b border-card-border/50 last:border-0">
                    <td className="py-2 pr-4 text-foreground">{w.electoralDistrict}</td>
                    <td className="py-2 pr-4 text-foreground font-medium">{w.candidate}</td>
                    <td className={`py-2 pr-4 ${fedPartyColor(w.party)}`}>{w.party}</td>
                    <td className="py-2 pr-4 text-muted">{w.votes.toLocaleString()}</td>
                    <td className="py-2 text-muted">{w.voteShare.toFixed(1)}%</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

// ============================================================
// Provincial Elections (coming soon — needs scraping)
// ============================================================

function ProvincialElectionsComingSoon() {
  return (
    <Card>
      <CardHeader
        title="Provincial Election History"
        subtitle="Alberta provincial election results"
      />
      <div className="text-sm text-muted space-y-2">
        <p>
          Provincial election data from Elections Alberta is available as HTML tables (not structured
          data). Results go back to 1905, with the most recent being the{" "}
          <strong className="text-foreground">May 2023 general election</strong> where the UCP won 49
          of 87 seats.
        </p>
        <p className="text-xs text-muted/60">
          Coming soon — we&apos;re building a scraper to bring in historical provincial results.
        </p>
      </div>
    </Card>
  );
}

// ============================================================
// Main page
// ============================================================

export const metadata: Metadata = {
  title: "Alberta Election History — Federal & Provincial Results",
  description:
    "Historical election results for Alberta federal and provincial ridings. Vote share, seat counts, and trends.",
};

export default function ElectionsPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Election History"
        description="Historical election results for Alberta — federal and provincial. Poll-by-poll data aggregated to riding level."
        category="politics"
        icon={<Shield size={20} />}
      />

      <ProvincialElectionsComingSoon />

      <Suspense fallback={<LoadingCard />}>
        <FederalResultsSection />
      </Suspense>

      <p className="text-center text-xs text-muted/60 font-mono pt-4">
        Alberta Pulse Check — Elections — Data from Elections Canada Open Data
      </p>
    </main>
  );
}
