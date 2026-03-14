import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import { PageHeader } from "@/components/page-header";
import { CreditCard } from "lucide-react";
import {
  fetchElectionsCanadaContributions,
  type PoliticalContribution,
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
// Federal Contributions Section
// ============================================================

async function FederalContributionsSection() {
  const contributions = await fetchElectionsCanadaContributions().catch(
    () => [] as PoliticalContribution[]
  );

  if (contributions.length === 0) {
    return (
      <Card>
        <CardHeader
          title="Federal Political Contributions — Alberta Donors"
          subtitle="Contributions to federal political parties from Alberta"
        />
        <p className="text-sm text-muted">
          No contribution data available. Elections Canada data may be temporarily unreachable.
        </p>
      </Card>
    );
  }

  // Aggregate by party
  const byParty: Record<string, { total: number; count: number }> = {};
  for (const c of contributions) {
    if (!byParty[c.party]) byParty[c.party] = { total: 0, count: 0 };
    byParty[c.party].total += c.amount;
    byParty[c.party].count += 1;
  }
  const sortedParties = Object.entries(byParty).sort(
    (a, b) => b[1].total - a[1].total
  );
  const grandTotal = contributions.reduce((s, c) => s + c.amount, 0);

  // Aggregate by year
  const byYear: Record<number, number> = {};
  for (const c of contributions) {
    if (c.year > 0) {
      byYear[c.year] = (byYear[c.year] || 0) + c.amount;
    }
  }
  const sortedYears = Object.entries(byYear)
    .map(([y, v]) => ({ year: parseInt(y), total: v }))
    .sort((a, b) => b.year - a.year);

  // Top contributors
  const byContributor: Record<string, number> = {};
  for (const c of contributions) {
    const name = c.contributor || "Anonymous";
    byContributor[name] = (byContributor[name] || 0) + c.amount;
  }
  const topContributors = Object.entries(byContributor)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          title="Total Contributions"
          value={`$${(grandTotal / 1000).toFixed(0)}K`}
          source="Elections Canada"
        />
        <MetricCard
          title="Records"
          value={contributions.length.toLocaleString()}
          source="Elections Canada"
        />
        <MetricCard
          title="Parties Funded"
          value={String(sortedParties.length)}
          source="Elections Canada"
        />
        <MetricCard
          title="Years Covered"
          value={sortedYears.length > 0 ? `${sortedYears[sortedYears.length - 1].year}–${sortedYears[0].year}` : "—"}
          source="Elections Canada"
        />
      </div>

      {/* By Party */}
      <Card>
        <CardHeader
          title="Contributions by Party"
          subtitle="Total contributions from Alberta donors to each federal party"
          badge={`$${(grandTotal / 1000).toFixed(0)}K total`}
        />
        <div className="space-y-3">
          {sortedParties.slice(0, 10).map(([party, { total, count }]) => {
            const pct = grandTotal > 0 ? ((total / grandTotal) * 100).toFixed(1) : "0";
            return (
              <div key={party}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-foreground">{party}</span>
                  <span className="text-xs text-muted">
                    ${total.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({count} contributions)
                  </span>
                </div>
                <div className="w-full bg-card-border/30 rounded-full h-2.5">
                  <div
                    className="h-2.5 rounded-full bg-indigo-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* By Year */}
      {sortedYears.length > 0 && (
        <Card>
          <CardHeader
            title="Contributions by Year"
            subtitle="Annual total from Alberta donors"
          />
          <div className="space-y-2">
            {sortedYears.map(({ year, total }) => {
              const maxYear = sortedYears[0].total;
              const pct = maxYear > 0 ? ((total / maxYear) * 100).toFixed(1) : "0";
              return (
                <div key={year} className="flex items-center gap-3">
                  <span className="text-xs text-muted w-12">{year}</span>
                  <div className="flex-1 bg-card-border/30 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-indigo-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted w-16 text-right">
                    ${(total / 1000).toFixed(0)}K
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Top Contributors */}
      {topContributors.length > 0 && (
        <Card>
          <CardHeader
            title="Top Alberta Contributors"
            subtitle="Largest individual contributors (federal)"
            badge={`Top ${topContributors.length}`}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border text-left">
                  <th className="pb-2 pr-4 text-xs font-medium text-muted">#</th>
                  <th className="pb-2 pr-4 text-xs font-medium text-muted">Contributor</th>
                  <th className="pb-2 text-xs font-medium text-muted text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {topContributors.map(([name, total], i) => (
                  <tr
                    key={`${name}-${i}`}
                    className="border-b border-card-border/50 last:border-0"
                  >
                    <td className="py-2 pr-4 text-muted text-xs">{i + 1}</td>
                    <td className="py-2 pr-4 text-foreground">{name}</td>
                    <td className="py-2 text-muted text-right">
                      ${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}

// ============================================================
// Provincial Campaign Finance (coming soon)
// ============================================================

function ProvincialFinanceComingSoon() {
  return (
    <Card>
      <CardHeader
        title="Provincial Campaign Finance"
        subtitle="Alberta political party contributions and financial statements"
      />
      <div className="text-sm text-muted space-y-2">
        <p>
          Elections Alberta publishes{" "}
          <strong className="text-foreground">political contributions over $250</strong> and party
          financial statements through their bulk data extract tool. This data covers all provincial
          parties, constituency associations, and candidates since 2004.
        </p>
        <p className="text-xs text-muted/60">
          Coming soon — we&apos;re wiring the Elections Alberta financial disclosure data.
        </p>
      </div>
    </Card>
  );
}

// ============================================================
// Main page
// ============================================================

export const metadata: Metadata = {
  title: "Alberta Campaign Finance — Political Contributions & Party Fundraising",
  description:
    "Political contributions from Alberta donors. Federal and provincial campaign finance data, party fundraising, and top contributors.",
};

export default function CampaignFinancePage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Campaign Finance"
        description="Who funds Alberta's political parties? Federal contributions from Alberta donors, plus provincial party financials."
        category="politics"
        icon={<CreditCard size={20} />}
      />

      <Card>
        <div className="prose-sm text-sm text-muted">
          <p>
            In Canada, individual contribution limits are{" "}
            <strong className="text-foreground">$1,725/year</strong> (2024) to each registered party,
            with additional limits for leadership contests and nomination races. Corporations and unions
            are prohibited from contributing to federal parties. Provincial limits in Alberta are similar.
            All contributions over $200 (federal) or $250 (provincial) are publicly disclosed.
          </p>
        </div>
      </Card>

      <ProvincialFinanceComingSoon />

      <Suspense fallback={<LoadingCard />}>
        <FederalContributionsSection />
      </Suspense>

      <p className="text-center text-xs text-muted/60 font-mono pt-4">
        Alberta Pulse Check — Campaign Finance — Data from Elections Canada, Elections Alberta
      </p>
    </main>
  );
}
