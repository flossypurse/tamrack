import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader } from "@/components/card";
import { ChartCard } from "@/components/chart-card";
import { TimeSeriesAreaChart, type MultiSeriesPoint } from "@/components/chart";
import { computeTimeRange } from "@/lib/time-range";
import {
  fetchStatCanTimeSeries,
  STATSCAN_SERIES,
  type TimeSeriesPoint,
} from "@/lib/data-sources";
import {
  Prose,
  BigQuestion,
  ChainStep,
  LiveDataPoint,
  DataGrid,
  Insight,
  Expandable,
  LessonSection,
  SoWhat,
} from "@/components/learn-lesson";
import { LessonCompleteButton } from "@/components/learn-lesson-complete";

// ============================================================
// Metadata
// ============================================================

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Provincial & Federal Fiscal Flows — Your Tax Dollars",
  description:
    "Transfer payments, equalization, and fiscal federalism — how money flows between Ottawa, Edmonton, and your municipality.",
};

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
// Section 1: Alberta's Fiscal Position
// ============================================================

async function FiscalPositionSection() {
  // Fetch Alberta GDP as a proxy for fiscal capacity
  const gdpData = await fetchStatCanTimeSeries(
    STATSCAN_SERIES.AB_GDP.tableId,
    STATSCAN_SERIES.AB_GDP.coordinate,
    120
  ).catch(() => []);

  const timeRange = computeTimeRange(gdpData);
  const latest = gdpData.at(-1);

  return (
    <LessonSection title="Alberta's Fiscal Position — The No-PST Province">
      <Prose>
        <p>
          Alberta is unique in Canada. It is the only province without a
          provincial sales tax (PST). It is the only province that has never
          received equalization payments. And it is one of the few provinces that
          has historically run surpluses rather than deficits — though the energy
          cycle makes that inconsistent.
        </p>
        <p>
          This fiscal position is not an accident. It is a direct consequence of
          energy royalties. When oil and gas companies extract Alberta&apos;s
          resources, they pay royalties to the provincial government. In good
          years, these royalties generate billions — enough to fund schools,
          hospitals, and highways without needing a sales tax. In bad years, the
          shortfall is enormous.
        </p>
      </Prose>

      {gdpData.length > 0 && (
        <Card>
          <CardHeader title="Alberta GDP — Provincial Economic Output" freshness="daily" />
          <ChartCard
            chartId="learn-tax-ab-gdp"
            title="Alberta GDP"
            timeRange={timeRange}
            source="StatsCan"
          >
            <TimeSeriesAreaChart data={gdpData} color="#10b981" height={240} />
          </ChartCard>
        </Card>
      )}

      {latest && (
        <DataGrid>
          <LiveDataPoint
            label="Alberta GDP (latest)"
            value={`$${(latest.value / 1_000_000).toFixed(1)}M`}
            source="StatsCan"
          />
        </DataGrid>
      )}

      <div className="space-y-0">
        <ChainStep
          number={1}
          title="Energy Royalties Flow In"
          description="Oil and gas companies pay royalties based on production and prices. High oil prices = high royalties. Low prices = revenue crisis."
        />
        <ChainStep
          number={2}
          title="Provincial Budget Funded"
          description="Royalties replace the need for a PST. Healthcare, education, infrastructure, and grants to municipalities are all funded from this base."
        />
        <ChainStep
          number={3}
          title="No Sales Tax Required"
          description="Alberta's competitive advantage: residents and businesses pay no PST. This attracts people and investment — but creates vulnerability to energy cycles."
        />
      </div>

      <Insight variant="warning">
        The absence of a PST is not free. It means Alberta&apos;s provincial
        budget is structurally dependent on energy royalties — the most volatile
        revenue source in Canadian public finance. When oil drops from $80 to
        $40, the provincial government can lose $5-10 billion in revenue in a
        single year. That is why Alberta swings from surpluses to deficits
        more dramatically than any other province.
      </Insight>
    </LessonSection>
  );
}

// ============================================================
// Section 2: The Federal Transfer System
// ============================================================

function TransferSystemSection() {
  return (
    <LessonSection title="Federal Transfers — How Ottawa Shares Revenue">
      <Prose>
        <p>
          The federal government collects more tax revenue than it spends on its
          own programs. The surplus is redistributed to provinces through three
          major transfer programs. Understanding these transfers is essential
          because they fund a significant share of healthcare and social
          programs in every province — including Alberta.
        </p>
      </Prose>

      <div className="space-y-0">
        <ChainStep
          number={1}
          title="Canada Health Transfer (CHT)"
          description="The largest federal transfer. Provides roughly $50+ billion per year to all provinces for healthcare. Allocated primarily on a per-capita basis. Alberta receives its population-proportional share — about $6-7 billion per year."
        />
        <ChainStep
          number={2}
          title="Canada Social Transfer (CST)"
          description="Funds post-secondary education, social assistance, and children's programs. Smaller than CHT at roughly $16 billion per year nationally. Also allocated per-capita."
        />
        <ChainStep
          number={3}
          title="Equalization"
          description="The most politically contentious transfer. Provides payments ONLY to provinces with below-average 'fiscal capacity' — the ability to raise revenue. Alberta has never received equalization. Quebec, Manitoba, and the Maritime provinces are the primary recipients."
        />
      </div>

      <Prose>
        <p>
          The key distinction: CHT and CST go to ALL provinces, including
          Alberta. Equalization goes only to provinces with below-average fiscal
          capacity. Alberta&apos;s energy wealth means it always has
          above-average fiscal capacity, so it never qualifies. This is what
          people mean when they say Alberta &ldquo;pays into equalization&rdquo;
          — Albertans pay federal taxes that partially fund equalization
          payments to other provinces, while Alberta never receives them.
        </p>
      </Prose>

      <Insight variant="insight">
        Equalization is NOT a bill that Alberta pays. It is a federal program
        funded from general federal revenue (income tax, GST, corporate tax).
        There is no line item on your tax return that says &ldquo;equalization
        payment.&rdquo; The frustration is structural: Albertans contribute more
        to federal revenue per capita than any other province (because incomes
        are higher), and receive less back through federal transfers. This is
        called the &ldquo;fiscal gap,&rdquo; and it is real — but it is a
        function of having the highest per-capita incomes in Canada, not a
        deliberate punishment.
      </Insight>

      <Expandable title="How equalization is actually calculated">
        <Prose>
          <p>
            The equalization formula compares each province&apos;s ability to
            raise revenue from five sources: personal income tax, business
            income tax, consumption taxes, property taxes, and natural
            resources. If a province&apos;s calculated fiscal capacity is below
            the national average (actually below the average of all ten
            provinces), it receives equalization to bring it up. The formula
            intentionally excludes 50% of natural resource revenue to avoid
            penalizing resource-rich provinces too harshly. Even with this
            exclusion, Alberta&apos;s fiscal capacity remains far above the
            national average. The formula is set by federal legislation and
            renewed roughly every five years.
          </p>
        </Prose>
      </Expandable>
    </LessonSection>
  );
}

// ============================================================
// Section 3: The Three-Layer Cake
// ============================================================

function ThreeLayerSection() {
  return (
    <LessonSection title="The Three-Layer Cake — Municipal, Provincial, Federal">
      <Prose>
        <p>
          Understanding public finance in Alberta means understanding that three
          levels of government each have distinct responsibilities, distinct
          revenue sources, and very different constraints.
        </p>
      </Prose>

      <div className="grid grid-cols-1 gap-3">
        {[
          {
            level: "Federal",
            revenue: "Income tax, GST, corporate tax, customs",
            spending: "Defence, immigration, EI, CPP, Indigenous affairs, transfers to provinces",
            constraint: "Can run deficits (borrows on bond markets)",
            color: "border-red-500/20 bg-red-500/5",
          },
          {
            level: "Provincial",
            revenue: "Energy royalties, income tax, corporate tax, carbon levy, user fees",
            spending: "Healthcare (40%), education, infrastructure, social services, policing, grants to municipalities",
            constraint: "Can run deficits (borrows on bond markets), but politically accountable for them",
            color: "border-purple-500/20 bg-purple-500/5",
          },
          {
            level: "Municipal",
            revenue: "Property tax, user fees, provincial grants, franchise fees",
            spending: "Local roads, water/sewer, police/fire, transit, parks, libraries, planning",
            constraint: "CANNOT run operating deficits. Must balance budget annually (MGA requirement).",
            color: "border-emerald-500/20 bg-emerald-500/5",
          },
        ].map((item) => (
          <div
            key={item.level}
            className={`border ${item.color} rounded-lg p-4`}
          >
            <h4 className="text-sm font-semibold text-foreground mb-2">
              {item.level} Government
            </h4>
            <div className="space-y-1.5">
              <p className="text-xs text-muted">
                <span className="font-medium text-foreground/80">Revenue:</span>{" "}
                {item.revenue}
              </p>
              <p className="text-xs text-muted">
                <span className="font-medium text-foreground/80">Spending:</span>{" "}
                {item.spending}
              </p>
              <p className="text-xs text-muted">
                <span className="font-medium text-foreground/80">Constraint:</span>{" "}
                {item.constraint}
              </p>
            </div>
          </div>
        ))}
      </div>

      <Prose>
        <p>
          The critical asymmetry: municipalities deliver the services citizens
          interact with most directly (roads, water, police, fire), but have the
          weakest revenue tools. They cannot levy income tax. They cannot levy
          sales tax. They are creatures of provincial legislation with no
          constitutional standing. When the province cuts grants, municipalities
          must either raise property taxes or cut services — there is no third
          option.
        </p>
      </Prose>

      <Expandable title="Why don't municipalities have more revenue tools?">
        <Prose>
          <p>
            In Canadian constitutional law, municipalities are not a level of
            government — they are creations of provincial legislation. The
            province can grant or revoke municipal powers at any time. This means
            municipalities can only use the revenue tools the province allows.
            Alberta&apos;s Municipal Government Act gives municipalities property
            tax, user fees, and a few other minor sources. Some provinces have
            experimented with giving cities more tools (Vancouver has a municipal
            fuel tax, for example), but Alberta has not gone this route. The
            result is that Alberta municipalities are highly dependent on
            property tax and provincial grants — both of which have limitations.
          </p>
        </Prose>
      </Expandable>
    </LessonSection>
  );
}

// ============================================================
// Section 4: The Heritage Fund
// ============================================================

function HeritageFundSection() {
  return (
    <LessonSection title="The Heritage Fund — Alberta's Savings Account">
      <Prose>
        <p>
          In 1976, Premier Peter Lougheed created the Alberta Heritage Savings
          Trust Fund. The idea was simple: save a portion of non-renewable
          resource revenue for the future. At its peak in the early 1980s, the
          fund held about $12 billion — which would be over $30 billion in
          today&apos;s dollars.
        </p>
        <p>
          Then governments stopped saving. From 1987 to 2021, contributions
          were minimal or zero. Investment returns were often siphoned into
          general revenue rather than reinvested. By contrast, Norway&apos;s
          sovereign wealth fund — started in 1990, fourteen years AFTER
          Alberta&apos;s — now holds over $1.5 trillion USD.
        </p>
      </Prose>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="border border-amber-500/20 bg-amber-500/5 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-foreground mb-1">
            Alberta Heritage Fund
          </h4>
          <p className="text-2xl font-bold text-amber-500">~$23B</p>
          <p className="text-xs text-muted mt-1">
            After 50 years of oil production (CAD, 2025)
          </p>
        </div>
        <div className="border border-blue-500/20 bg-blue-500/5 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-foreground mb-1">
            Norway Government Pension Fund
          </h4>
          <p className="text-2xl font-bold text-blue-500">~$1.5T USD</p>
          <p className="text-xs text-muted mt-1">
            After 35 years of oil production
          </p>
        </div>
      </div>

      <Prose>
        <p>
          The comparison is sobering. Alberta had a 14-year head start, similar
          resource endowment per capita, and chose to spend current revenue
          rather than save it. The Heritage Fund today is worth roughly $5,000
          per Albertan. Norway&apos;s fund is worth roughly $275,000 per
          Norwegian. This is the opportunity cost of spending royalties on
          current consumption rather than investing them for the future.
        </p>
      </Prose>

      <Insight variant="lever">
        The Heritage Fund debate is not just about the past — it is about the
        future. As Alberta&apos;s energy sector evolves (whether through
        transition or transformation), the question of how to manage resource
        revenue will become more urgent, not less. Whether to increase Heritage
        Fund contributions, invest in diversification, or return money to
        Albertans through lower taxes is one of the most consequential fiscal
        questions the province faces.
      </Insight>
    </LessonSection>
  );
}

// ============================================================
// Page Component
// ============================================================

export default function ProvincialFederalPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
      <BigQuestion>How does money flow between Ottawa, Edmonton, and your community?</BigQuestion>

      <Prose>
        <p>
          Your tax dollars do not stay in one place. Federal taxes flow to
          Ottawa, which sends some back as transfers. Provincial revenue funds
          healthcare and education, with grants flowing down to municipalities.
          And your property tax stays local — funding the services you see every
          day. This lesson maps the entire system so you can see how the pieces
          connect.
        </p>
      </Prose>

      <Suspense fallback={<LoadingCard />}>
        <FiscalPositionSection />
      </Suspense>

      <TransferSystemSection />

      <ThreeLayerSection />

      <HeritageFundSection />

      <SoWhat>
        Alberta&apos;s fiscal position is defined by energy royalties. They
        eliminate the need for a sales tax, make Alberta a net contributor to
        federal transfers, and fund the Heritage Fund (however modestly). But
        they also create volatility — when oil drops, the entire fiscal
        structure strains. Understanding this three-layer system — federal
        transfers, provincial royalties, municipal property tax — is essential
        for making sense of any budget debate, tax policy change, or
        infrastructure announcement in the province.
      </SoWhat>

      <LessonCompleteButton moduleSlug="tax-dollars" lessonSlug="provincial-federal" />

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Tamrack &mdash; Provincial &amp; Federal &mdash; All data
        from free public APIs
      </footer>
    </main>
  );
}
