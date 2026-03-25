import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, MetricCard } from "@/components/card";
import { HubCard, HubGrid, type HubCardItem } from "@/components/hub-card";
import {
  Landmark,
  Building2,
  Building,
  CreditCard,
  Scale,
  GitCompare,
  BookOpen,
  Shield,
} from "lucide-react";
import {
  fetchAlbertaMLAs,
  fetchAlbertaFederalMPs,
  type ElectedOfficial,
  type FederalMP,
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
// Key Metrics
// ============================================================

async function PoliticsMetrics() {
  const [mlas, mps] = await Promise.all([
    fetchAlbertaMLAs().catch(() => [] as ElectedOfficial[]),
    fetchAlbertaFederalMPs().catch(() => [] as FederalMP[]),
  ]);

  const ucpMLAs = mlas.filter((m) =>
    m.party.toLowerCase().includes("united conservative")
  ).length;
  const ndpMLAs = mlas.filter((m) =>
    m.party.toLowerCase().includes("new democratic")
  ).length;

  // Federal party counts
  const fedParties: Record<string, number> = {};
  for (const mp of mps) {
    const party = mp.party || "Unknown";
    fedParties[party] = (fedParties[party] || 0) + 1;
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard
          title="Provincial MLAs"
          value={String(mlas.length || 87)}
          source="Represent API"
        />
        <MetricCard
          title="UCP / NDP"
          value={`${ucpMLAs} / ${ndpMLAs}`}
          source="Represent API"
        />
        <MetricCard
          title="Federal MPs (AB)"
          value={String(mps.length || 34)}
          source="Represent API"
        />
        <MetricCard
          title="Next Provincial"
          value="May 2027"
          source="Elections Alberta"
        />
      </div>

      {/* Provincial seat bar */}
      {mlas.length > 0 && (
        <Card>
          <CardHeader
            title="Provincial Legislature"
            subtitle="Party breakdown — Alberta Legislative Assembly"
            badge={`${mlas.length} seats`}
          />
          <div className="flex h-4 rounded-full overflow-hidden">
            {ucpMLAs > 0 && (
              <div
                className="bg-blue-500 transition-all"
                style={{ width: `${(ucpMLAs / mlas.length) * 100}%` }}
                title={`UCP: ${ucpMLAs} seats`}
              />
            )}
            {ndpMLAs > 0 && (
              <div
                className="bg-orange-400 transition-all"
                style={{ width: `${(ndpMLAs / mlas.length) * 100}%` }}
                title={`NDP: ${ndpMLAs} seats`}
              />
            )}
            {mlas.length - ucpMLAs - ndpMLAs > 0 && (
              <div
                className="bg-gray-400 transition-all"
                style={{
                  width: `${((mlas.length - ucpMLAs - ndpMLAs) / mlas.length) * 100}%`,
                }}
                title={`Other: ${mlas.length - ucpMLAs - ndpMLAs} seats`}
              />
            )}
          </div>
          <div className="flex gap-4 mt-2 text-xs text-muted">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" /> UCP {ucpMLAs}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-orange-400" /> NDP {ndpMLAs}
            </span>
            {mlas.length - ucpMLAs - ndpMLAs > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-gray-400" /> Other{" "}
                {mlas.length - ucpMLAs - ndpMLAs}
              </span>
            )}
          </div>
        </Card>
      )}

      {/* Federal seat bar */}
      {mps.length > 0 && (
        <Card>
          <CardHeader
            title="Federal Representation"
            subtitle="Alberta's seats in the House of Commons"
            badge={`${mps.length} MPs`}
          />
          <div className="space-y-2">
            {Object.entries(fedParties)
              .sort((a, b) => b[1] - a[1])
              .map(([party, count]) => (
                <div key={party} className="flex items-center gap-3">
                  <span className="text-xs text-muted w-32 truncate">{party}</span>
                  <div className="flex-1 bg-card-border/30 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-indigo-500"
                      style={{ width: `${(count / mps.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted w-8 text-right">{count}</span>
                </div>
              ))}
          </div>
        </Card>
      )}
    </>
  );
}

// ============================================================
// Page cards
// ============================================================

const pages: HubCardItem[] = [
  {
    href: "/governance/legislature",
    icon: Building2,
    title: "Legislature",
    description:
      "Alberta's 87 MLAs, party breakdown, and electoral district data.",
    sources: "Represent API",
  },
  {
    href: "/governance/federal",
    icon: Building,
    title: "Federal",
    description:
      "Alberta's MPs, how they vote, and federal debates mentioning Alberta.",
    sources: "Represent API, OpenParliament.ca",
  },
  {
    href: "/governance/elections",
    icon: Shield,
    title: "Elections",
    description:
      "Historical results — poll-by-poll data, seat trends, vote share, and swing analysis.",
    sources: "Elections Canada, Elections Alberta",
  },
  {
    href: "/governance/campaign-finance",
    icon: CreditCard,
    title: "Campaign Finance",
    description:
      "Political donations and party financial statements. Who funds Alberta politics?",
    sources: "Elections Alberta, Elections Canada",
  },
  {
    href: "/governance/spending",
    icon: Scale,
    title: "Gov Spending",
    description:
      "Grant disclosures by ministry, Blue Book expenditure, and public sector compensation.",
    sources: "Alberta Open Data (CKAN)",
  },
  {
    href: "/governance/transfers",
    icon: GitCompare,
    title: "Federal Transfers",
    description:
      "CHT, CST, equalization since 1957, plus federal contracts and grants in Alberta.",
    sources: "open.canada.ca, Dept of Finance",
  },
  {
    href: "/governance/legislation",
    icon: BookOpen,
    title: "Legislation",
    description:
      "Federal bills, votes, and committee activity. Track how Alberta MPs vote.",
    sources: "OpenParliament.ca",
  },
];

// ============================================================
// Main page
// ============================================================

export const metadata: Metadata = {
  title: "Alberta Politics — Legislature, Elections, Spending & Federal Relations",
  description:
    "Alberta political data — provincial legislature, federal MPs, election history, campaign finance, government spending, and federal-provincial fiscal transfers.",
};

export default function PoliticsPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Politics & Governance"
        description="Provincial legislature, federal representation, elections, campaign finance, spending, and fiscal flows."
        category="politics"
        icon={<Landmark size={22} />}
      />

      {/* Key metrics */}
      <Suspense fallback={<LoadingCard />}>
        <PoliticsMetrics />
      </Suspense>

      {/* Explainer */}
      <Card>
        <div className="prose-sm space-y-3 text-sm text-muted">
          <p>
            Political decisions — zoning, infrastructure, tax policy, immigration targets — are
            upstream of every economic outcome. This section connects the people, the money, and the votes.
          </p>
          <p>
            <strong className="text-foreground">Legislature</strong> and{" "}
            <strong className="text-foreground">Federal</strong> show who holds power.{" "}
            <strong className="text-foreground">Campaign Finance</strong> shows who funds it.{" "}
            <strong className="text-foreground">Spending</strong> and{" "}
            <strong className="text-foreground">Transfers</strong> show where the money goes.
          </p>
        </div>
      </Card>

      {/* Page grid */}
      <HubGrid>
        {pages.map((item) => (
          <HubCard key={item.href} item={item} />
        ))}
      </HubGrid>

      {/* Jargon box */}
      <Card>
        <h3 className="text-xs font-medium text-foreground uppercase tracking-wider mb-3">
          Common terms in this section
        </h3>
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="font-medium text-foreground inline">MLA</dt>
            <dd className="text-muted inline">
              {" "}— Member of the Legislative Assembly. Alberta&apos;s 87 provincial elected representatives.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground inline">MP</dt>
            <dd className="text-muted inline">
              {" "}— Member of Parliament. Alberta has 34 federal ridings in the House of Commons.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground inline">CHT / CST</dt>
            <dd className="text-muted inline">
              {" "}— Canada Health Transfer / Canada Social Transfer. Federal block transfers for healthcare and social programs.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground inline">Equalization</dt>
            <dd className="text-muted inline">
              {" "}— Federal redistribution from "have" to "have-not" provinces. Alberta is a net contributor.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground inline">Blue Book</dt>
            <dd className="text-muted inline">
              {" "}— Alberta&apos;s annual report of government expenditure by payee. Every payment over $10K.
            </dd>
          </div>
        </dl>
      </Card>

      <p className="text-center text-xs text-muted/60 font-mono pt-4">
        Alberta Pulse Check — Politics — Data from Represent API, OpenParliament, Elections Canada, Alberta Open Data
      </p>
    </main>
  );
}
