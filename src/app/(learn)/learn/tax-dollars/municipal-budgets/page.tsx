import type { Metadata } from "next";
import { Suspense } from "react";
import { Card } from "@/components/card";
import {
  fetchRegionalIndicatorForMunicipality,
  REGIONAL_INDICATORS,
  type RegionalDataPoint,
} from "@/lib/data-sources-regional";
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
  title: "Municipal Budgets — Your Tax Dollars",
  description:
    "Where your property tax dollars go — police, fire, transit, parks, infrastructure — and why Alberta municipalities cannot run deficits.",
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
// Helpers
// ============================================================

const MUNICIPALITIES = [
  "Edmonton",
  "Calgary",
  "St. Albert",
  "Spruce Grove",
  "Parkland County",
  "Lethbridge",
];

function latestRegional(data: RegionalDataPoint[]): number {
  if (data.length === 0) return 0;
  const sorted = [...data].sort((a, b) => a.period.localeCompare(b.period));
  return sorted.at(-1)?.value ?? 0;
}

function latestPeriod(data: RegionalDataPoint[]): string {
  if (data.length === 0) return "";
  const sorted = [...data].sort((a, b) => a.period.localeCompare(b.period));
  return sorted.at(-1)?.period ?? "";
}

function filterByDimension(data: RegionalDataPoint[], dimensionValue: string): RegionalDataPoint[] {
  return data.filter((pt) =>
    pt.dimensions.some((d) => d.value === dimensionValue)
  );
}

function fmt(n: number, opts?: { prefix?: string; suffix?: string; decimals?: number }): string {
  const { prefix = "", suffix = "", decimals } = opts ?? {};
  const formatted =
    decimals !== undefined
      ? n.toLocaleString("en-CA", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      : n.toLocaleString("en-CA");
  return `${prefix}${formatted}${suffix}`;
}

function fmtDollars(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString("en-CA")}`;
}

async function fetchForAll(
  indicator: string
): Promise<Map<string, RegionalDataPoint[]>> {
  const results = new Map<string, RegionalDataPoint[]>();
  const fetches = MUNICIPALITIES.map(async (muni) => {
    const data = await fetchRegionalIndicatorForMunicipality(indicator, muni).catch(() => []);
    results.set(muni, data);
  });
  await Promise.all(fetches);
  return results;
}

// ============================================================
// Section 1: Where The Money Goes
// ============================================================

async function SpendingBreakdownSection() {
  const projectsMap = await fetchForAll(
    REGIONAL_INDICATORS["Major Projects"]
  );

  return (
    <LessonSection title="Where The Money Goes — Services & Infrastructure">
      <Prose>
        <p>
          Alberta municipalities cannot run deficits. Every dollar spent must
          come from property taxes, user fees, grants, or reserves. There is no
          borrowing to cover operating shortfalls. This constraint is written
          into the Municipal Government Act and it means that budget decisions
          have immediate, visible consequences.
        </p>
        <p>
          A typical Alberta municipal budget breaks down roughly like this:
        </p>
      </Prose>

      {/* Budget breakdown visual */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { label: "Protective Services", pct: "25-30%", desc: "Police, fire, bylaw, emergency management", color: "border-red-500/20 bg-red-500/5" },
          { label: "Transportation", pct: "15-20%", desc: "Roads, transit, snow removal, traffic signals", color: "border-blue-500/20 bg-blue-500/5" },
          { label: "Utilities & Environment", pct: "12-18%", desc: "Water, wastewater, waste collection, recycling", color: "border-cyan-500/20 bg-cyan-500/5" },
          { label: "Recreation & Culture", pct: "10-15%", desc: "Parks, arenas, libraries, community programs", color: "border-green-500/20 bg-green-500/5" },
          { label: "General Government", pct: "8-12%", desc: "Administration, council, IT, finance, HR", color: "border-gray-500/20 bg-gray-500/5" },
          { label: "Planning & Development", pct: "5-8%", desc: "Land use planning, building inspection, economic development", color: "border-amber-500/20 bg-amber-500/5" },
        ].map((item) => (
          <div
            key={item.label}
            className={`border ${item.color} rounded-lg p-3`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-foreground">
                {item.label}
              </span>
              <span className="text-xs font-mono text-muted">{item.pct}</span>
            </div>
            <p className="text-xs text-muted leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>

      <Prose>
        <p>
          Notice how protective services (police and fire) consistently take the
          largest share. This is not a choice that municipalities can easily
          change — staffing levels for police and fire are partly mandated by
          provincial standards, and labour costs in these services grow faster
          than inflation due to collective agreements.
        </p>
        <p>
          Transportation is the second-largest item because Alberta&apos;s
          climate is brutal on roads. Freeze-thaw cycles, heavy snowfall, and
          the sheer geographic size of many municipalities mean that road
          maintenance alone can consume hundreds of millions of dollars in
          Edmonton or Calgary.
        </p>
      </Prose>
    </LessonSection>
  );
}

// ============================================================
// Section 2: Capital vs Operating
// ============================================================

async function CapitalSection() {
  const projectsMap = await fetchForAll(
    REGIONAL_INDICATORS["Major Projects"]
  );

  return (
    <LessonSection title="Capital vs Operating — Two Different Budgets">
      <Prose>
        <p>
          Municipal budgets have two distinct parts that serve very different
          purposes. Understanding the difference is essential for interpreting
          any budget discussion.
        </p>
      </Prose>

      <div className="space-y-0">
        <ChainStep
          number={1}
          title="Operating Budget"
          description="Day-to-day expenses: salaries, fuel, supplies, utilities, contracts. Must be balanced every year — no deficit allowed. Funded primarily by property taxes and user fees."
        />
        <ChainStep
          number={2}
          title="Capital Budget"
          description="Long-term investments: new roads, water treatment plants, rec centres, transit lines. Can use debentures (long-term borrowing) because the assets last decades. Also funded by provincial/federal grants and reserves."
        />
      </div>

      <Prose>
        <p>
          The operating budget is like your household monthly expenses — it must
          be covered by income. The capital budget is like a mortgage — you can
          borrow because the asset lasts long enough to justify spreading the
          cost. Alberta municipalities CAN borrow for capital projects, but they
          CANNOT borrow to pay salaries or cover operating shortfalls.
        </p>
        <p>
          On the capital side, municipalities invest in major projects —
          infrastructure that lasts decades. Here is what some Alberta
          communities are building:
        </p>
      </Prose>

      <DataGrid>
        {MUNICIPALITIES.map((muni) => {
          const data = projectsMap.get(muni) ?? [];
          const val = latestRegional(data);
          const period = latestPeriod(data);
          return val > 0 ? (
            <LiveDataPoint
              key={muni}
              label={`${muni} Major Projects${period ? ` (${period})` : ""}`}
              value={fmt(val)}
              source="AB Regional Dashboard"
            />
          ) : null;
        })}
      </DataGrid>

      <Insight variant="insight">
        Alberta municipalities cannot run deficits. Every dollar spent must come
        from taxes, transfers, or fees. This is not a suggestion — it is
        provincial law. When your council proposes a new recreation centre or
        transit expansion, the question is not &ldquo;can we afford it&rdquo;
        but &ldquo;what are we willing to tax for it, and what do we cut to make
        room?&rdquo;
      </Insight>
    </LessonSection>
  );
}

// ============================================================
// Section 3: Revenue Sources Beyond Property Tax
// ============================================================

function RevenueMixSection() {
  return (
    <LessonSection title="Beyond Property Tax — The Full Revenue Picture">
      <Prose>
        <p>
          Property tax is the largest single revenue source for Alberta
          municipalities, but it is not the only one. Understanding the full
          revenue mix explains why some municipalities are more fiscally
          resilient than others.
        </p>
      </Prose>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { label: "Property Tax", pct: "40-55%", desc: "The foundation — municipal + education requisition", color: "border-emerald-500/20 bg-emerald-500/5" },
          { label: "User Fees & Charges", pct: "15-25%", desc: "Water/sewer rates, rec centre fees, transit fares, permits", color: "border-blue-500/20 bg-blue-500/5" },
          { label: "Provincial Grants", pct: "10-20%", desc: "MSI (Municipal Sustainability Initiative), policing grants, transit funding", color: "border-purple-500/20 bg-purple-500/5" },
          { label: "Federal Grants", pct: "2-8%", desc: "Gas tax fund, infrastructure programs, housing accelerator", color: "border-red-500/20 bg-red-500/5" },
          { label: "Franchise Fees", pct: "3-6%", desc: "Fees from utility companies for right to operate in the municipality", color: "border-orange-500/20 bg-orange-500/5" },
          { label: "Investment Income & Other", pct: "3-8%", desc: "Returns on reserves, land sales, fines, licences", color: "border-gray-500/20 bg-gray-500/5" },
        ].map((item) => (
          <div
            key={item.label}
            className={`border ${item.color} rounded-lg p-3`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-foreground">
                {item.label}
              </span>
              <span className="text-xs font-mono text-muted">{item.pct}</span>
            </div>
            <p className="text-xs text-muted leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>

      <Prose>
        <p>
          The Municipal Sustainability Initiative (MSI) is Alberta&apos;s
          primary grant program for municipalities. It provides funding for
          infrastructure, but the amount fluctuates with provincial revenues —
          which means it fluctuates with energy prices. When oil drops,
          provincial grants shrink, and municipalities must either raise property
          taxes or defer infrastructure investment.
        </p>
        <p>
          This is the hidden connection between global oil prices and your local
          pothole repair schedule. The chain goes: oil price drops, royalties
          decline, provincial revenue falls, MSI grants are cut, your
          municipality defers road resurfacing.
        </p>
      </Prose>

      <Insight variant="watch">
        Watch for the phrase &ldquo;infrastructure deficit&rdquo; in municipal
        budget discussions. It means the municipality has been deferring
        maintenance and capital investment — usually because grant funding
        dropped during an energy downturn. Every year of deferral makes the
        eventual cost higher. This is how a global oil price decline shows up as
        a crumbling road in your neighbourhood five years later.
      </Insight>

      <Expandable title="What is the Municipal Sustainability Initiative (MSI)?">
        <Prose>
          <p>
            MSI was introduced in 2007 when oil revenues were high. It provides
            capital and operating grants to all Alberta municipalities, allocated
            by a formula based on population and other factors. At its peak, MSI
            distributed over $1 billion per year. It has since been replaced by
            the Local Government Fiscal Framework (LGFF), which ties funding to
            provincial revenue growth. The principle is the same: when the
            province does well, municipalities get more; when it struggles, they
            get less.
          </p>
        </Prose>
      </Expandable>
    </LessonSection>
  );
}

// ============================================================
// Section 4: Comparing Your Community
// ============================================================

async function ComparisonSection() {
  const [populationMap, rawAssessmentMap, taxRateMap] = await Promise.all([
    fetchForAll(REGIONAL_INDICATORS["Population"]),
    fetchForAll(REGIONAL_INDICATORS["Total Equalized Assessment"]),
    fetchForAll(REGIONAL_INDICATORS["Municipal Tax Rates"]),
  ]);
  const assessmentMap = new Map<string, RegionalDataPoint[]>();
  for (const [muni, data] of rawAssessmentMap) {
    assessmentMap.set(muni, filterByDimension(data, "Grand Total"));
  }

  const rows = MUNICIPALITIES.map((muni) => {
    const pop = latestRegional(populationMap.get(muni) ?? []);
    const assessment = latestRegional(assessmentMap.get(muni) ?? []);
    const rate = latestRegional(taxRateMap.get(muni) ?? []);
    const perCapita = pop > 0 && assessment > 0 ? assessment / pop : 0;
    return { muni, pop, assessment, rate, perCapita };
  });

  return (
    <LessonSection title="Comparing Your Community">
      <Prose>
        <p>
          The same property tax system plays out very differently depending on
          the size of the municipality, its economic base, and how many people
          share the cost. Here is a side-by-side comparison with live data.
        </p>
      </Prose>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-card-border">
              <th className="text-left py-2 pr-3 text-muted font-medium">
                Municipality
              </th>
              <th className="text-right py-2 px-3 text-muted font-medium">
                Population
              </th>
              <th className="text-right py-2 px-3 text-muted font-medium">
                Assessment Base
              </th>
              <th className="text-right py-2 px-3 text-muted font-medium">
                Per Capita
              </th>
              <th className="text-right py-2 pl-3 text-muted font-medium">
                Tax Rate
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.muni}
                className="border-b border-card-border/50 hover:bg-foreground/[0.02]"
              >
                <td className="py-2 pr-3 font-medium text-foreground">
                  {row.muni}
                </td>
                <td className="py-2 px-3 text-right text-foreground/80">
                  {row.pop > 0 ? fmt(row.pop) : "N/A"}
                </td>
                <td className="py-2 px-3 text-right text-foreground/80">
                  {row.assessment > 0 ? fmtDollars(row.assessment) : "N/A"}
                </td>
                <td className="py-2 px-3 text-right text-foreground/80">
                  {row.perCapita > 0 ? fmtDollars(row.perCapita) : "N/A"}
                </td>
                <td className="py-2 pl-3 text-right text-foreground/80">
                  {row.rate > 0 ? fmt(row.rate, { decimals: 4 }) : "N/A"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Prose>
        <p>
          Edmonton has a massive assessment base spread across over a million
          people. Parkland County has a smaller base but also far fewer
          residents. The rate tells you about spending and efficiency, not about
          how much you personally pay.
        </p>
        <p>
          Per-capita assessment is the most revealing number in this table. It
          tells you how much assessed property value exists for every resident.
          Higher per-capita assessment means each person&apos;s share of the tax
          burden is diluted across more property value — which generally means
          more room for services without crushing tax bills.
        </p>
      </Prose>
    </LessonSection>
  );
}

// ============================================================
// Page Component
// ============================================================

export default function MunicipalBudgetsPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
      <BigQuestion>Where does my property tax actually go?</BigQuestion>

      <Prose>
        <p>
          Your property tax funds the services you interact with every single
          day — the roads you drive on, the fire department that responds to
          emergencies, the water that comes out of your tap, and the parks your
          kids play in. This lesson breaks down how Alberta municipalities
          budget, what the spending categories look like, and why the no-deficit
          rule shapes every decision your council makes.
        </p>
      </Prose>

      <Suspense fallback={<LoadingCard />}>
        <SpendingBreakdownSection />
      </Suspense>

      <Suspense fallback={<LoadingCard />}>
        <CapitalSection />
      </Suspense>

      <RevenueMixSection />

      <Suspense fallback={<LoadingCard />}>
        <ComparisonSection />
      </Suspense>

      <SoWhat>
        Your property tax is the most direct connection between you and your
        municipal government. Federal taxes disappear into Ottawa. Provincial
        taxes fund province-wide programs. But property tax funds the roads you
        drive on, the fire department that protects your home, the parks your
        kids play in, and the water that comes out of your tap. Understanding
        how the budget works means you can ask better questions at council
        meetings and understand what is actually being proposed when tax
        changes are discussed.
      </SoWhat>

      <LessonCompleteButton moduleSlug="tax-dollars" lessonSlug="municipal-budgets" />

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Tamrack &mdash; Municipal Budgets &mdash; All data from free
        public APIs
      </footer>
    </main>
  );
}
