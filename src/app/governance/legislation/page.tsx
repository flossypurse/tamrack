import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import { PageHeader } from "@/components/page-header";
import { BookOpen, ExternalLink } from "lucide-react";
import {
  fetchParliamentVotes,
  fetchAlbertaDebates,
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
// Vote Summary Stats
// ============================================================

async function VoteStats() {
  const votes = await fetchParliamentVotes(100).catch(() => [] as ParliamentVote[]);

  const agreed = votes.filter((v) =>
    v.result.toLowerCase().includes("agreed")
  ).length;
  const defeated = votes.length - agreed;
  const avgYea = votes.length
    ? Math.round(votes.reduce((s, v) => s + v.yea, 0) / votes.length)
    : 0;
  const avgNay = votes.length
    ? Math.round(votes.reduce((s, v) => s + v.nay, 0) / votes.length)
    : 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <MetricCard
        title="Recent Votes"
        value={String(votes.length)}
        source="OpenParliament"
      />
      <MetricCard
        title="Agreed"
        value={String(agreed)}
        source="OpenParliament"
      />
      <MetricCard
        title="Defeated"
        value={String(defeated)}
        source="OpenParliament"
      />
      <MetricCard
        title="Avg Yea/Nay"
        value={`${avgYea}/${avgNay}`}
        source="OpenParliament"
      />
    </div>
  );
}

// ============================================================
// Recent Votes with Bill Info
// ============================================================

async function RecentBillVotes() {
  const votes = await fetchParliamentVotes(50).catch(() => [] as ParliamentVote[]);

  // Filter to votes that have a bill reference
  const billVotes = votes.filter((v) => v.billUrl || v.description);

  if (billVotes.length === 0) {
    return (
      <Card>
        <CardHeader title="Recent Bill Votes" subtitle="House of Commons votes on legislation" />
        <p className="text-sm text-muted">No bill vote data available.</p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Recent Bill Votes"
        subtitle="House of Commons votes on legislation"
        badge={`${billVotes.length} votes`}
      />
      <div className="space-y-3">
        {billVotes.map((v, i) => (
          <div
            key={`${v.number}-${i}`}
            className="flex items-start gap-3 p-3 rounded-lg bg-card-border/10"
          >
            <div
              className={`shrink-0 w-1.5 h-full rounded-full ${
                v.result.toLowerCase().includes("agreed")
                  ? "bg-green-500"
                  : "bg-red-400"
              }`}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-foreground">
                  Vote #{v.number}
                </span>
                <span className="text-xs text-muted">{v.date}</span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded ${
                    v.result.toLowerCase().includes("agreed")
                      ? "bg-green-500/10 text-green-500"
                      : "bg-red-400/10 text-red-400"
                  }`}
                >
                  {v.result}
                </span>
              </div>
              <p className="text-sm text-foreground">
                {v.description || "No description available"}
              </p>
              <div className="flex items-center gap-4 mt-1 text-xs text-muted">
                <span>
                  Yea: <span className="text-green-500">{v.yea}</span>
                </span>
                <span>
                  Nay: <span className="text-red-400">{v.nay}</span>
                </span>
                {v.paired > 0 && <span>Paired: {v.paired}</span>}
                {v.billUrl && (
                  <a
                    href={`https://openparliament.ca${v.billUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    View bill
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ============================================================
// Alberta Debate Mentions
// ============================================================

async function AlbertaLegislativeDebates() {
  const debates = await fetchAlbertaDebates(20).catch(
    () => [] as ParliamentDebate[]
  );

  if (debates.length === 0) {
    return (
      <Card>
        <CardHeader
          title="Alberta in Parliament"
          subtitle="Federal debates mentioning Alberta"
        />
        <p className="text-sm text-muted">No debate data available.</p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Alberta in Parliament"
        subtitle="Recent House of Commons speeches mentioning Alberta"
        badge={`${debates.length} mentions`}
      />
      <div className="space-y-4">
        {debates.map((d, i) => (
          <div key={`${d.date}-${i}`} className="border-l-2 border-indigo-500/30 pl-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-muted">{d.date}</span>
              {d.speaker && (
                <span className="text-xs font-medium text-foreground">
                  {d.speaker}
                </span>
              )}
            </div>
            {d.topic && (
              <p className="text-xs text-muted/60 mb-1">{d.topic}</p>
            )}
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
                Full text
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
  title: "Legislation Tracker — Federal Bills, Votes & Alberta Debates",
  description:
    "Track federal legislation through the House of Commons. Bill votes, session activity, and debates mentioning Alberta.",
};

export default function LegislationPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Legislation Tracker"
        description="Federal bills and votes tracked through the House of Commons, plus debates mentioning Alberta."
        category="politics"
        icon={<BookOpen size={20} />}
      />

      <Suspense fallback={<LoadingCard />}>
        <VoteStats />
      </Suspense>

      <Card>
        <div className="prose-sm text-sm text-muted">
          <p>
            This page tracks activity in the <strong className="text-foreground">House of Commons</strong> —
            not the Alberta Legislature (which doesn&apos;t publish structured vote data). All votes shown
            are federal, but the debate search highlights where Alberta is specifically mentioned in
            parliamentary proceedings.
          </p>
        </div>
      </Card>

      <Suspense fallback={<LoadingCard />}>
        <RecentBillVotes />
      </Suspense>

      <Suspense fallback={<LoadingCard />}>
        <AlbertaLegislativeDebates />
      </Suspense>

      <p className="text-center text-xs text-muted/60 font-mono pt-4">
        Tamrack — Legislation — Data from OpenParliament.ca
      </p>
    </main>
  );
}
