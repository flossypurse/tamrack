import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import { PageHeader } from "@/components/page-header";
import { Building, MapPin, Mail, ExternalLink } from "lucide-react";
import {
  fetchAlbertaFederalMPs,
  fetchParliamentVotes,
  fetchAlbertaDebates,
  type FederalMP,
  type ParliamentVote,
  type ParliamentDebate,
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

// ============================================================
// Party colors (federal)
// ============================================================

function fedPartyColor(party: string): string {
  const p = party.toLowerCase();
  if (p.includes("conservative")) return "text-blue-500";
  if (p.includes("liberal")) return "text-red-400";
  if (p.includes("ndp") || p.includes("new democratic")) return "text-orange-400";
  if (p.includes("bloc")) return "text-cyan-400";
  if (p.includes("green")) return "text-green-400";
  return "text-muted";
}

function fedPartyBg(party: string): string {
  const p = party.toLowerCase();
  if (p.includes("conservative")) return "bg-blue-500";
  if (p.includes("liberal")) return "bg-red-400";
  if (p.includes("ndp") || p.includes("new democratic")) return "bg-orange-400";
  if (p.includes("bloc")) return "bg-cyan-400";
  if (p.includes("green")) return "bg-green-400";
  return "bg-muted";
}

// ============================================================
// Federal MPs Section
// ============================================================

async function FederalMPsSection() {
  const mps = await fetchAlbertaFederalMPs().catch(() => [] as FederalMP[]);

  if (mps.length === 0) {
    return (
      <Card>
        <CardHeader title="Alberta's Federal MPs" subtitle="Members of Parliament representing Alberta ridings" />
        <p className="text-sm text-muted">No MP data available.</p>
      </Card>
    );
  }

  const partyCounts: Record<string, number> = {};
  for (const mp of mps) {
    const party = mp.party || "Unknown";
    partyCounts[party] = (partyCounts[party] || 0) + 1;
  }
  const sorted = Object.entries(partyCounts).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard title="Total MPs" value={String(mps.length)} source="Represent API" />
        {sorted.slice(0, 3).map(([party, count]) => (
          <MetricCard
            key={party}
            title={party.length > 20 ? party.slice(0, 18) + "..." : party}
            value={String(count)}
            source="Represent API"
          />
        ))}
      </div>

      <Card>
        <CardHeader
          title="Party Breakdown"
          subtitle="Alberta's seats in the House of Commons"
          badge={`${mps.length} MPs`}
        />
        <div className="space-y-3">
          {sorted.map(([party, count]) => {
            const pct = ((count / mps.length) * 100).toFixed(1);
            return (
              <div key={party}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-medium ${fedPartyColor(party)}`}>{party}</span>
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

      <Card>
        <CardHeader
          title="Alberta's Members of Parliament"
          subtitle="Federal representatives sorted by riding"
          badge={`${mps.length} MPs`}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border text-left">
                <th className="pb-2 pr-4 text-xs font-medium text-muted">Name</th>
                <th className="pb-2 pr-4 text-xs font-medium text-muted">Party</th>
                <th className="pb-2 pr-4 text-xs font-medium text-muted">Riding</th>
                <th className="pb-2 text-xs font-medium text-muted">Email</th>
              </tr>
            </thead>
            <tbody>
              {[...mps]
                .sort((a, b) => a.riding.localeCompare(b.riding))
                .map((mp, i) => (
                  <tr key={`${mp.name}-${i}`} className="border-b border-card-border/50 last:border-0">
                    <td className="py-2 pr-4 text-foreground font-medium">{mp.name}</td>
                    <td className={`py-2 pr-4 ${fedPartyColor(mp.party)}`}>{mp.party}</td>
                    <td className="py-2 pr-4 text-muted">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {mp.riding}
                      </span>
                    </td>
                    <td className="py-2 text-muted">
                      {mp.email ? (
                        <a href={`mailto:${mp.email}`} className="flex items-center gap-1 text-accent hover:underline">
                          <Mail className="w-3 h-3" />
                          {mp.email}
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
    </>
  );
}

// ============================================================
// Recent Votes
// ============================================================

async function RecentVotesSection() {
  const votes = await fetchParliamentVotes(20).catch(() => [] as ParliamentVote[]);

  if (votes.length === 0) {
    return (
      <Card>
        <CardHeader title="Recent House of Commons Votes" subtitle="Latest parliamentary votes" />
        <p className="text-sm text-muted">No vote data available. OpenParliament may be temporarily unavailable.</p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Recent House of Commons Votes"
        subtitle="Latest parliamentary votes — all parties, national scope"
        badge={`${votes.length} votes`}
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-card-border text-left">
              <th className="pb-2 pr-4 text-xs font-medium text-muted">Date</th>
              <th className="pb-2 pr-4 text-xs font-medium text-muted">Vote #</th>
              <th className="pb-2 pr-4 text-xs font-medium text-muted">Description</th>
              <th className="pb-2 pr-4 text-xs font-medium text-muted">Yea/Nay</th>
              <th className="pb-2 text-xs font-medium text-muted">Result</th>
            </tr>
          </thead>
          <tbody>
            {votes.map((v, i) => (
              <tr key={`${v.number}-${i}`} className="border-b border-card-border/50 last:border-0">
                <td className="py-2 pr-4 text-muted whitespace-nowrap">{v.date}</td>
                <td className="py-2 pr-4 text-foreground">#{v.number}</td>
                <td className="py-2 pr-4 text-foreground max-w-xs truncate">
                  {v.description || "—"}
                </td>
                <td className="py-2 pr-4 text-muted whitespace-nowrap">
                  <span className="text-green-500">{v.yea}</span>
                  {" / "}
                  <span className="text-red-400">{v.nay}</span>
                </td>
                <td className="py-2 text-xs">
                  <span
                    className={`px-2 py-0.5 rounded-full ${
                      v.result.toLowerCase().includes("agreed")
                        ? "bg-green-500/10 text-green-500"
                        : "bg-red-400/10 text-red-400"
                    }`}
                  >
                    {v.result}
                  </span>
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
// Debates Mentioning Alberta
// ============================================================

async function AlbertaDebatesSection() {
  const debates = await fetchAlbertaDebates(15).catch(() => [] as ParliamentDebate[]);

  if (debates.length === 0) {
    return (
      <Card>
        <CardHeader title="Federal Debates Mentioning Alberta" subtitle="Recent parliamentary discussions" />
        <p className="text-sm text-muted">No debate data available.</p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Federal Debates Mentioning Alberta"
        subtitle="Recent House of Commons speeches referencing Alberta"
        badge={`${debates.length} mentions`}
      />
      <div className="space-y-4">
        {debates.map((d, i) => (
          <div key={`${d.date}-${i}`} className="border-l-2 border-indigo-500/30 pl-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-muted">{d.date}</span>
              {d.speaker && (
                <span className="text-xs font-medium text-foreground">{d.speaker}</span>
              )}
              {d.topic && (
                <span className="text-xs text-muted/60 truncate max-w-xs">
                  &mdash; {d.topic}
                </span>
              )}
            </div>
            <p className="text-sm text-muted leading-relaxed line-clamp-3">
              {d.content || "No excerpt available."}
            </p>
            {d.url && (
              <a
                href={`https://openparliament.ca${d.url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent hover:underline flex items-center gap-1 mt-1"
              >
                <ExternalLink className="w-3 h-3" />
                Read full debate
              </a>
            )}
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
  title: "Alberta Federal Representation — MPs, Votes & Debates",
  description:
    "Alberta's Members of Parliament, House of Commons voting records, and federal debates mentioning Alberta.",
};

export default function FederalPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Federal Representation"
        description="Alberta's Members of Parliament, how they vote, and what's being said about Alberta in the House of Commons."
        category="politics"
        icon={<Building size={20} />}
      />

      <Suspense fallback={<LoadingCard />}>
        <FederalMPsSection />
      </Suspense>

      <Suspense fallback={<LoadingCard />}>
        <RecentVotesSection />
      </Suspense>

      <Suspense fallback={<LoadingCard />}>
        <AlbertaDebatesSection />
      </Suspense>

      <p className="text-center text-xs text-muted/60 font-mono pt-4">
        Alberta Pulse Check — Federal — Data from Represent API &amp; OpenParliament.ca
      </p>
    </main>
  );
}
