import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import { PageHeader } from "@/components/page-header";
import { GitCompare } from "lucide-react";
import {
  fetchFederalTransfers,
  fetchFederalContractsAB,
  fetchFederalGrantsAB,
  type FederalTransfer,
  type FederalContract,
  type FederalGrant,
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
// Federal Transfers Section
// ============================================================

async function TransfersSection() {
  const transfers = await fetchFederalTransfers().catch(
    () => [] as FederalTransfer[]
  );

  if (transfers.length === 0) {
    return (
      <Card>
        <CardHeader
          title="Federal Transfers to Alberta"
          subtitle="CHT, CST, Equalization, and other transfers"
        />
        <p className="text-sm text-muted">
          No transfer data available. The federal open data portal may be temporarily unreachable.
        </p>
      </Card>
    );
  }

  // Group by transfer type
  const byType: Record<string, FederalTransfer[]> = {};
  for (const t of transfers) {
    if (!byType[t.transferType]) byType[t.transferType] = [];
    byType[t.transferType].push(t);
  }

  // Latest year totals
  const latestYear = Math.max(...transfers.map((t) => t.year));
  const latestTransfers = transfers.filter((t) => t.year === latestYear);
  const latestTotal = latestTransfers.reduce((s, t) => s + t.amount, 0);

  // All years
  const byYear: Record<number, number> = {};
  for (const t of transfers) {
    if (t.year > 0) {
      byYear[t.year] = (byYear[t.year] || 0) + t.amount;
    }
  }
  const sortedYears = Object.entries(byYear)
    .map(([y, v]) => ({ year: parseInt(y), total: v }))
    .sort((a, b) => a.year - b.year);

  // Determine if amounts are in millions (common for federal data)
  const isMils = latestTotal > 1_000_000;
  const formatAmt = (n: number) =>
    isMils
      ? `$${(n / 1_000_000).toFixed(0)}M`
      : `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          title={`${latestYear} Total`}
          value={formatAmt(latestTotal)}
          source="open.canada.ca"
        />
        <MetricCard
          title="Transfer Types"
          value={String(Object.keys(byType).length)}
          source="open.canada.ca"
        />
        <MetricCard
          title="Years of Data"
          value={String(sortedYears.length)}
          source="open.canada.ca"
        />
        <MetricCard
          title="Equalization"
          value="$0 (net contributor)"
          source="Dept of Finance"
        />
      </div>

      {/* Transfer breakdown for latest year */}
      <Card>
        <CardHeader
          title={`Federal Transfers to Alberta — ${latestYear}`}
          subtitle="Breakdown by transfer program"
          badge={formatAmt(latestTotal)}
        />
        <div className="space-y-3">
          {latestTransfers
            .sort((a, b) => b.amount - a.amount)
            .map((t, i) => (
              <div key={`${t.transferType}-${i}`} className="flex items-center gap-3">
                <span className="text-xs text-foreground flex-1 truncate">
                  {t.transferType}
                </span>
                <span className="text-xs text-muted w-20 text-right">
                  {formatAmt(t.amount)}
                </span>
              </div>
            ))}
        </div>
      </Card>

      {/* Historical trend */}
      {sortedYears.length > 1 && (
        <Card>
          <CardHeader
            title="Total Federal Transfers Over Time"
            subtitle="All transfer programs combined — Alberta"
          />
          <div className="space-y-1">
            {sortedYears.slice(-20).map(({ year, total }) => {
              const max = Math.max(...sortedYears.map((y) => y.total));
              const pct = max > 0 ? ((total / max) * 100).toFixed(1) : "0";
              return (
                <div key={year} className="flex items-center gap-3">
                  <span className="text-xs text-muted w-12">{year}</span>
                  <div className="flex-1 bg-card-border/30 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-indigo-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted w-16 text-right">
                    {formatAmt(total)}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </>
  );
}

// ============================================================
// Federal Contracts in Alberta
// ============================================================

async function FederalContractsSection() {
  const contracts = await fetchFederalContractsAB(200).catch(
    () => [] as FederalContract[]
  );

  if (contracts.length === 0) {
    return (
      <Card>
        <CardHeader
          title="Federal Contracts Awarded in Alberta"
          subtitle="Proactive disclosure of federal procurement"
        />
        <p className="text-sm text-muted">No contract data available.</p>
      </Card>
    );
  }

  const totalValue = contracts.reduce((s, c) => s + c.value, 0);

  // Top vendors
  const byVendor: Record<string, number> = {};
  for (const c of contracts) {
    const vendor = c.vendor || "Unknown";
    byVendor[vendor] = (byVendor[vendor] || 0) + c.value;
  }
  const topVendors = Object.entries(byVendor)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  // By department
  const byDept: Record<string, number> = {};
  for (const c of contracts) {
    const dept = c.department || "Unknown";
    byDept[dept] = (byDept[dept] || 0) + c.value;
  }
  const topDepts = Object.entries(byDept)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return (
    <>
      <Card>
        <CardHeader
          title="Federal Contracts Awarded in Alberta"
          subtitle="Proactive disclosure — contracts with Alberta vendors"
          badge={`${contracts.length} contracts`}
        />
        <div className="space-y-2 mb-4">
          <p className="text-xs text-muted">
            Total value: <strong className="text-foreground">${(totalValue / 1_000_000).toFixed(1)}M</strong>
          </p>
        </div>
        <div className="space-y-2">
          {topDepts.map(([dept, value]) => {
            const max = topDepts[0][1];
            const pct = max > 0 ? ((value / max) * 100).toFixed(1) : "0";
            return (
              <div key={dept} className="flex items-center gap-3">
                <span className="text-xs text-foreground w-40 truncate" title={dept}>
                  {dept}
                </span>
                <div className="flex-1 bg-card-border/30 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-indigo-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-muted w-16 text-right">
                  ${(value / 1_000_000).toFixed(1)}M
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Top Vendors (Alberta)"
          subtitle="Largest federal contract recipients in Alberta"
          badge={`Top ${topVendors.length}`}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border text-left">
                <th className="pb-2 pr-4 text-xs font-medium text-muted">#</th>
                <th className="pb-2 pr-4 text-xs font-medium text-muted">Vendor</th>
                <th className="pb-2 text-xs font-medium text-muted text-right">Total Value</th>
              </tr>
            </thead>
            <tbody>
              {topVendors.map(([vendor, value], i) => (
                <tr key={`${vendor}-${i}`} className="border-b border-card-border/50 last:border-0">
                  <td className="py-2 pr-4 text-muted text-xs">{i + 1}</td>
                  <td className="py-2 pr-4 text-foreground">{vendor}</td>
                  <td className="py-2 text-muted text-right">
                    ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
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
// Federal Grants in Alberta
// ============================================================

async function FederalGrantsSection() {
  const grants = await fetchFederalGrantsAB(200).catch(
    () => [] as FederalGrant[]
  );

  if (grants.length === 0) {
    return (
      <Card>
        <CardHeader
          title="Federal Grants & Contributions to Alberta"
          subtitle="Proactive disclosure of federal funding"
        />
        <p className="text-sm text-muted">No grant data available.</p>
      </Card>
    );
  }

  const totalValue = grants.reduce((s, g) => s + g.value, 0);

  // Top recipients
  const byRecipient: Record<string, number> = {};
  for (const g of grants) {
    const name = g.recipient || "Unknown";
    byRecipient[name] = (byRecipient[name] || 0) + g.value;
  }
  const topRecipients = Object.entries(byRecipient)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  return (
    <Card>
      <CardHeader
        title="Federal Grants & Contributions to Alberta"
        subtitle="Federal funding to Alberta organizations and municipalities"
        badge={`${grants.length} grants — $${(totalValue / 1_000_000).toFixed(1)}M`}
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-card-border text-left">
              <th className="pb-2 pr-4 text-xs font-medium text-muted">#</th>
              <th className="pb-2 pr-4 text-xs font-medium text-muted">Recipient</th>
              <th className="pb-2 pr-4 text-xs font-medium text-muted">Program</th>
              <th className="pb-2 text-xs font-medium text-muted text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            {topRecipients.map(([name, value], i) => (
              <tr key={`${name}-${i}`} className="border-b border-card-border/50 last:border-0">
                <td className="py-2 pr-4 text-muted text-xs">{i + 1}</td>
                <td className="py-2 pr-4 text-foreground">{name}</td>
                <td className="py-2 pr-4 text-muted text-xs">—</td>
                <td className="py-2 text-muted text-right">
                  ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
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
// Main page
// ============================================================

export const metadata: Metadata = {
  title: "Federal-Provincial Transfers — Alberta's Fiscal Relationship with Ottawa",
  description:
    "Federal transfers to Alberta (CHT, CST, Equalization), federal contracts awarded in the province, and grants to Alberta organizations.",
};

export default function TransfersPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Federal Transfers"
        description="Money flowing between Ottawa and Alberta. Health transfers, social transfers, equalization, federal contracts, and grants."
        category="politics"
        icon={<GitCompare size={20} />}
      />

      <Card>
        <div className="prose-sm text-sm text-muted">
          <p>
            Alberta is a <strong className="text-foreground">net contributor</strong> to the federal
            fiscal balance. While it receives billions in CHT and CST transfers for health and social
            programs, Albertans pay more in federal taxes than the province receives back in transfers
            and services. Alberta has{" "}
            <strong className="text-foreground">never received equalization payments</strong>.
          </p>
          <p>
            Beyond the big transfer programs, the federal government also awards contracts to Alberta
            businesses and provides grants to Alberta organizations, municipalities, and Indigenous
            communities. This page tracks all three channels.
          </p>
        </div>
      </Card>

      <Suspense fallback={<LoadingCard />}>
        <TransfersSection />
      </Suspense>

      <Suspense fallback={<LoadingCard />}>
        <FederalContractsSection />
      </Suspense>

      <Suspense fallback={<LoadingCard />}>
        <FederalGrantsSection />
      </Suspense>

      <p className="text-center text-xs text-muted/60 font-mono pt-4">
        Tamrack — Transfers — Data from open.canada.ca, Dept of Finance
      </p>
    </main>
  );
}
