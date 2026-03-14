import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, MetricCard } from "@/components/card";
import {
  Landmark,
  Building2,
  Building,
  CreditCard,
  Scale,
  GitCompare,
  BookOpen,
  Shield,
  ArrowRight,
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
  const topFedParty = Object.entries(fedParties).sort((a, b) => b[1] - a[1])[0];

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

const pages = [
  {
    href: "/politics/legislature",
    icon: Building2,
    title: "Legislature",
    description:
      "Alberta's 87 MLAs, party breakdown, electoral districts, and current government composition. Live data from the Represent API.",
    sources: "Represent API (Open North)",
  },
  {
    href: "/politics/federal",
    icon: Building,
    title: "Federal Representation",
    description:
      "Alberta's Members of Parliament, how they vote in the House of Commons, and federal debates mentioning Alberta. Tracks parliamentary activity relevant to the province.",
    sources: "Represent API, OpenParliament.ca",
  },
  {
    href: "/politics/elections",
    icon: Shield,
    title: "Election History",
    description:
      "Historical election results for Alberta — provincial and federal. Poll-by-poll data, seat trends, vote share by party, and swing analysis across electoral cycles.",
    sources: "Elections Canada, Elections Alberta",
  },
  {
    href: "/politics/campaign-finance",
    icon: CreditCard,
    title: "Campaign Finance",
    description:
      "Political donations and party financial statements. Who is funding Alberta's political parties? Contributions over $250 are publicly disclosed.",
    sources: "Elections Alberta, Elections Canada",
  },
  {
    href: "/politics/spending",
    icon: Scale,
    title: "Government Spending",
    description:
      "Where Alberta's government spends its money. Grant disclosures by ministry and recipient, Blue Book expenditure by payee (every payment >$10K), and public sector compensation.",
    sources: "Alberta Open Data (CKAN)",
  },
  {
    href: "/politics/transfers",
    icon: GitCompare,
    title: "Federal Transfers",
    description:
      "Money flowing between Ottawa and Alberta. Canada Health Transfer, Canada Social Transfer, equalization data since 1957, plus federal contracts and grants awarded in the province.",
    sources: "open.canada.ca, Dept of Finance",
  },
  {
    href: "/politics/legislation",
    icon: BookOpen,
    title: "Legislation",
    description:
      "Federal bills and votes tracked through the House of Commons. See how Alberta MPs vote on key legislation and track committee activity.",
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
        description="Provincial legislature, federal representation, elections, campaign finance, government spending, and federal-provincial fiscal flows."
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
            Political decisions — zoning changes, infrastructure investments, tax policy, immigration
            targets — are upstream of every economic outcome. This section connects the people, the money,
            and the votes. Who represents Alberta, how they vote, who funds them, and where the government
            spends.
          </p>
          <p>
            <strong className="text-foreground">Legislature</strong> and{" "}
            <strong className="text-foreground">Federal</strong> show who holds power.{" "}
            <strong className="text-foreground">Campaign Finance</strong> shows who funds that power.{" "}
            <strong className="text-foreground">Gov Spending</strong> and{" "}
            <strong className="text-foreground">Transfers</strong> show where the money goes — from
            provincial grants to the federal equalization narrative.
          </p>
        </div>
      </Card>

      {/* Page grid */}
      <div className="space-y-3">
        {pages.map((page) => (
          <Link key={page.href} href={page.href} className="group block">
            <Card className="transition-colors hover:border-accent/30">
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5">
                  <page.icon
                    size={18}
                    className="text-muted group-hover:text-accent transition-colors"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-foreground group-hover:text-accent transition-colors">
                      {page.title}
                    </h3>
                    <ArrowRight
                      size={14}
                      className="text-muted group-hover:text-accent transition-colors"
                    />
                  </div>
                  <p className="text-sm text-muted mt-1 leading-relaxed">
                    {page.description}
                  </p>
                  <p className="text-[10px] font-mono text-muted/60 mt-2">
                    {page.sources}
                  </p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Jargon box */}
      <Card>
        <h3 className="text-xs font-medium text-foreground uppercase tracking-wider mb-3">
          Common terms in this section
        </h3>
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="font-medium text-foreground inline">MLA</dt>
            <dd className="text-muted inline">
              {" "}— Member of the Legislative Assembly. Alberta&apos;s 87 provincial elected representatives
              in the unicameral legislature (no senate).
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground inline">MP</dt>
            <dd className="text-muted inline">
              {" "}— Member of Parliament. Alberta&apos;s representatives in the federal House of Commons in Ottawa.
              Alberta has 34 federal ridings.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground inline">CHT / CST</dt>
            <dd className="text-muted inline">
              {" "}— Canada Health Transfer / Canada Social Transfer. Federal block transfers to provinces
              for healthcare and social programs. Alberta receives ~$9B annually.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground inline">Equalization</dt>
            <dd className="text-muted inline">
              {" "}— A federal program that redistributes tax revenue from &ldquo;have&rdquo; to &ldquo;have-not&rdquo;
              provinces. Alberta has never been a recipient — it is a net contributor to the federal fiscal balance.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground inline">Blue Book</dt>
            <dd className="text-muted inline">
              {" "}— Alberta&apos;s annual report of government expenditure by payee. Every payment over $10K
              from the General Revenue Fund, searchable by department and recipient.
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
