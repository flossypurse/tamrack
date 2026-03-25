import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import { PageHeader } from "@/components/page-header";
import { Scale } from "lucide-react";
import {
  fetchAlbertaGrants,
  type GrantRecord,
} from "@/lib/data-sources-fiscal";

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
// Alberta Grants Section
// ============================================================

async function AlbertaGrantsSection() {
  const grants = await fetchAlbertaGrants().catch(() => [] as GrantRecord[]);

  if (grants.length === 0) {
    return (
      <Card>
        <CardHeader
          title="Alberta Government Grant Disclosure"
          subtitle="Provincial grants by ministry, recipient, and program"
        />
        <p className="text-sm text-muted">
          No grant data available. The Alberta Open Data portal may be temporarily unreachable.
        </p>
      </Card>
    );
  }

  const totalAmount = grants.reduce((s, g) => s + g.amount, 0);

  // By ministry
  const byMinistry: Record<string, number> = {};
  for (const g of grants) {
    const ministry = g.ministry || "Unknown";
    byMinistry[ministry] = (byMinistry[ministry] || 0) + g.amount;
  }
  const sortedMinistries = Object.entries(byMinistry)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  // Top recipients
  const byRecipient: Record<string, number> = {};
  for (const g of grants) {
    const recipient = g.recipient || "Unknown";
    byRecipient[recipient] = (byRecipient[recipient] || 0) + g.amount;
  }
  const topRecipients = Object.entries(byRecipient)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  // By fiscal year
  const byFY: Record<string, number> = {};
  for (const g of grants) {
    if (g.fiscalYear) {
      byFY[g.fiscalYear] = (byFY[g.fiscalYear] || 0) + g.amount;
    }
  }
  const sortedFY = Object.entries(byFY).sort((a, b) => b[0].localeCompare(a[0]));

  const maxMinistry = sortedMinistries.length > 0 ? sortedMinistries[0][1] : 1;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          title="Total Grants"
          value={`$${(totalAmount / 1_000_000).toFixed(0)}M`}
          source="Alberta Open Data"
        />
        <MetricCard
          title="Grant Records"
          value={grants.length.toLocaleString()}
          source="Alberta Open Data"
        />
        <MetricCard
          title="Ministries"
          value={String(Object.keys(byMinistry).length)}
          source="Alberta Open Data"
        />
        <MetricCard
          title="Recipients"
          value={Object.keys(byRecipient).length.toLocaleString()}
          source="Alberta Open Data"
        />
      </div>

      {/* By Ministry */}
      <Card>
        <CardHeader
          title="Grants by Ministry"
          subtitle="Total grant disbursements by Alberta government ministry"
          badge={`$${(totalAmount / 1_000_000).toFixed(0)}M total`}
        />
        <div className="space-y-2">
          {sortedMinistries.map(([ministry, amount]) => {
            const pct = ((amount / maxMinistry) * 100).toFixed(1);
            return (
              <div key={ministry} className="flex items-center gap-3">
                <span className="text-xs text-foreground w-48 truncate" title={ministry}>
                  {ministry}
                </span>
                <div className="flex-1 bg-card-border/30 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-indigo-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-muted w-20 text-right">
                  ${(amount / 1_000_000).toFixed(1)}M
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* By Fiscal Year */}
      {sortedFY.length > 1 && (
        <Card>
          <CardHeader
            title="Grants by Fiscal Year"
            subtitle="Annual grant disbursements"
          />
          <div className="space-y-2">
            {sortedFY.map(([fy, amount]) => {
              const maxFY = sortedFY[0][1];
              const pct = maxFY > 0 ? ((amount / maxFY) * 100).toFixed(1) : "0";
              return (
                <div key={fy} className="flex items-center gap-3">
                  <span className="text-xs text-muted w-16">{fy}</span>
                  <div className="flex-1 bg-card-border/30 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-indigo-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted w-16 text-right">
                    ${(amount / 1_000_000).toFixed(0)}M
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Top Recipients */}
      <Card>
        <CardHeader
          title="Top Grant Recipients"
          subtitle="Organizations receiving the most provincial grant funding"
          badge={`Top ${topRecipients.length}`}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border text-left">
                <th className="pb-2 pr-4 text-xs font-medium text-muted">#</th>
                <th className="pb-2 pr-4 text-xs font-medium text-muted">Recipient</th>
                <th className="pb-2 text-xs font-medium text-muted text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {topRecipients.map(([name, amount], i) => (
                <tr
                  key={`${name}-${i}`}
                  className="border-b border-card-border/50 last:border-0"
                >
                  <td className="py-2 pr-4 text-muted text-xs">{i + 1}</td>
                  <td className="py-2 pr-4 text-foreground">{name}</td>
                  <td className="py-2 text-muted text-right">
                    ${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
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
// Blue Book + Sunshine (coming soon)
// ============================================================

function BlueBookComingSoon() {
  return (
    <Card>
      <CardHeader
        title="Blue Book & Sunshine List"
        subtitle="Expenditure by payee and public sector compensation"
      />
      <div className="text-sm text-muted space-y-2">
        <p>
          The <strong className="text-foreground">Blue Book</strong> (General Revenue Fund Details of
          Expenditure by Payee) lists every payment over $10K from the Alberta government, searchable
          by department and recipient. Published quarterly as XLS on Alberta Open Data.
        </p>
        <p>
          The <strong className="text-foreground">Sunshine List</strong> discloses compensation for
          executives at public sector bodies — universities, health authorities, Crown corporations.
        </p>
        <p className="text-xs text-muted/60">
          Coming soon — these sources require XLS parsing which we&apos;re adding.
        </p>
      </div>
    </Card>
  );
}

// ============================================================
// Main page
// ============================================================

export const metadata: Metadata = {
  title: "Alberta Government Spending — Grants, Expenditure & Compensation",
  description:
    "Where Alberta's government spends its money. Grant disclosures by ministry and recipient, expenditure by payee, and public sector compensation.",
};

export default function SpendingPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Government Spending"
        description="Where Alberta's government spends money. Grant disclosures, expenditure by payee, and public sector compensation."
        category="politics"
        icon={<Scale size={20} />}
      />

      <BlueBookComingSoon />

      <Suspense fallback={<LoadingCard />}>
        <AlbertaGrantsSection />
      </Suspense>

      <p className="text-center text-xs text-muted/60 font-mono pt-4">
        Alberta Pulse Check — Gov Spending — Data from Alberta Open Data (CKAN)
      </p>
    </main>
  );
}
