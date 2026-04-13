import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader } from "@/components/card";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import { TimeSeriesAreaChart, MultiSeriesLineChart, type MultiSeriesPoint } from "@/components/chart";
import { ChartCard } from "@/components/chart-card";
import { computeTimeRange } from "@/lib/time-range";
import {
  fetchBoCTimeSeries,
  fetchStatCanTimeSeries,
  BOC_SERIES,
  STATSCAN_SERIES,
  type TimeSeriesPoint,
} from "@/lib/data-sources";
import { fetchRegionalIndicator, fetchRegionalIndicatorForMunicipality, REGIONAL_INDICATORS, type RegionalDataPoint } from "@/lib/data-sources-regional";
import {
  Prose,
  BigQuestion,
  ChainStep,
  LiveDataPoint,
  DataGrid,
  Insight,
  Expandable,
  LessonSection,
  LessonNav,
  SoWhat,
} from "@/components/learn-lesson";
import { Landmark, DollarSign, Building2, Wrench, MapPin } from "lucide-react";

// ============================================================
// Metadata
// ============================================================

export const metadata: Metadata = {
  title: "Your Tax Dollars at Work — Learn — Alberta Pulse Check",
  description:
    "How property assessments become municipal budgets become community services. Understand the assessment-rate-budget loop with live data for real Alberta municipalities.",
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

/** Get the latest value from a regional data series */
function latestRegional(data: RegionalDataPoint[]): number {
  if (data.length === 0) return 0;
  const sorted = [...data].sort((a, b) => a.period.localeCompare(b.period));
  return sorted.at(-1)?.value ?? 0;
}

/** Get the latest period label from a regional data series */
function latestPeriod(data: RegionalDataPoint[]): string {
  if (data.length === 0) return "";
  const sorted = [...data].sort((a, b) => a.period.localeCompare(b.period));
  return sorted.at(-1)?.period ?? "";
}

/** Filter regional data to a specific dimension value (e.g. "Grand Total") */
function filterByDimension(data: RegionalDataPoint[], dimensionValue: string): RegionalDataPoint[] {
  return data.filter((pt) =>
    pt.dimensions.some((d) => d.value === dimensionValue)
  );
}

/** Format a large number with commas and optional prefix/suffix */
function fmt(n: number, opts?: { prefix?: string; suffix?: string; decimals?: number }): string {
  const { prefix = "", suffix = "", decimals } = opts ?? {};
  const formatted =
    decimals !== undefined
      ? n.toLocaleString("en-CA", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      : n.toLocaleString("en-CA");
  return `${prefix}${formatted}${suffix}`;
}

/** Format a dollar amount in billions or millions */
function fmtDollars(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString("en-CA")}`;
}

/** Fetch one indicator for all target municipalities, returning a map */
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
// Section 1: It Starts With Your Assessment
// ============================================================

async function AssessmentSection() {
  const rawMap = await fetchForAll(
    REGIONAL_INDICATORS["Total Equalized Assessment"]
  );
  // Filter to "Grand Total" dimension (the API returns rows per property type)
  const assessmentMap = new Map<string, RegionalDataPoint[]>();
  for (const [muni, data] of rawMap) {
    assessmentMap.set(muni, filterByDimension(data, "Grand Total"));
  }

  return (
    <LessonSection title="It Starts With Your Assessment">
      <Prose>
        <p>
          Every year, your municipality estimates the market value of your
          property. This is your property assessment. It is not what your house
          is worth to you, and it is not necessarily what you could sell it for
          tomorrow. It is the municipality&apos;s estimate, based on comparable
          sales data, of your property&apos;s value as of July 1 of the
          previous year.
        </p>
        <p>
          Your assessment serves one purpose: it determines your proportional
          share of the total tax base. If your property is worth 0.01% of the
          total assessed value in your municipality, you pay 0.01% of the tax
          levy. The assessment is the denominator in the equation. Everything
          flows from it.
        </p>
      </Prose>

      <div className="space-y-0">
        <ChainStep
          number={1}
          title="Property Assessment"
          description="The municipality estimates the market value of every property. Your assessed value determines what proportion of the total tax base you represent."
        />
      </div>

      <Prose>
        <p>
          Here is the total assessment base for several Alberta municipalities.
          This is the sum of all assessed property values in each community —
          the total pie from which individual shares are calculated.
        </p>
      </Prose>

      <DataGrid>
        {MUNICIPALITIES.map((muni) => {
          const data = assessmentMap.get(muni) ?? [];
          const val = latestRegional(data);
          const period = latestPeriod(data);
          return (
            <LiveDataPoint
              key={muni}
              label={`${muni}${period ? ` (${period})` : ""}`}
              value={val > 0 ? fmtDollars(val) : "N/A"}
              source="AB Regional Dashboard"
            />
          );
        })}
      </DataGrid>

      <Insight variant="insight">
        If your assessment goes up but everyone else&apos;s goes up by the same
        percentage, your taxes do not change. Your share stays the same. Your
        taxes only increase when (a) the municipality increases total spending,
        or (b) your property&apos;s value goes up faster than the average. The
        assessment determines your share — the budget determines the total.
      </Insight>

      <Expandable title="What if I disagree with my assessment?">
        <Prose>
          <p>
            Every Alberta municipality must send assessment notices by January,
            and you have until March to file a complaint. The complaint goes to
            an independent Assessment Review Board. You will need to show that
            comparable properties sold for less than your assessed value. The
            municipality bears the burden of proof — they must justify their
            number. This is a right worth exercising: your assessment directly
            controls your tax share.
          </p>
        </Prose>
      </Expandable>
    </LessonSection>
  );
}

// ============================================================
// Section 2: The Tax Rate
// ============================================================

async function TaxRateSection() {
  const taxRateMap = await fetchForAll(
    REGIONAL_INDICATORS["Municipal Tax Rates"]
  );

  return (
    <LessonSection title="The Tax Rate — How Municipalities Budget">
      <Prose>
        <p>
          Once the total assessment base is known, the municipality sets its
          budget for the year. The tax rate is the bridge between the two:
        </p>
        <p className="font-mono text-xs bg-foreground/[0.05] rounded-lg p-3 text-center">
          Tax Rate = Total Budget Needed / Total Assessment Base
        </p>
        <p>
          A municipality with a $1 billion assessment base that needs $10
          million in revenue sets a rate of 1% (or 10 mills). A municipality
          with a $100 million base that also needs $10 million must set a rate
          of 10%. Same revenue, ten times the rate — because the base is
          smaller.
        </p>
      </Prose>

      <div className="space-y-0">
        <ChainStep
          number={1}
          title="Total Assessment Base"
          description="Sum of all property values in the municipality. This is the denominator."
        />
        <ChainStep
          number={2}
          title="Municipality Sets Budget"
          description="Council approves the annual operating and capital budgets. This determines the total revenue needed from property taxes."
          timeLag="Annually (Nov-Dec)"
        />
        <ChainStep
          number={3}
          title="Tax Rate Calculated"
          description="Budget divided by assessment base = your tax rate. This rate, multiplied by your individual assessment, is your property tax bill."
        />
      </div>

      <Prose>
        <p>
          Here are the municipal tax rates across Alberta communities. Notice
          the range — smaller municipalities often have higher rates, but that
          does not necessarily mean higher tax bills, because their assessments
          tend to be lower.
        </p>
      </Prose>

      <DataGrid>
        {MUNICIPALITIES.map((muni) => {
          const data = taxRateMap.get(muni) ?? [];
          const val = latestRegional(data);
          const period = latestPeriod(data);
          return (
            <LiveDataPoint
              key={muni}
              label={`${muni}${period ? ` (${period})` : ""}`}
              value={val > 0 ? fmt(val, { decimals: 4 }) : "N/A"}
              source="AB Regional Dashboard"
            />
          );
        })}
      </DataGrid>

      <Insight variant="warning">
        A low tax rate does not mean low taxes. Rate multiplied by assessment
        equals your bill. A home assessed at $500,000 with a 0.7% rate pays
        $3,500. A home assessed at $250,000 with a 1.2% rate pays $3,000. The
        second homeowner has a higher rate but a lower bill. Always look at both
        numbers together.
      </Insight>

      <Expandable title="Municipal vs provincial vs education tax">
        <Prose>
          <p>
            Your property tax bill has multiple components. The municipal portion
            funds city or county services. The education requisition funds K-12
            education (set by the province, collected by the municipality). Some
            areas add a seniors housing levy or library levy. The municipal rate
            shown here is only the municipal portion — typically 50-65% of your
            total bill. The province sets the education rate, and your
            municipality has no control over it.
          </p>
        </Prose>
      </Expandable>
    </LessonSection>
  );
}

// ============================================================
// Section 3: Residential vs Commercial
// ============================================================

async function ResidentialShareSection() {
  const residentialMap = await fetchForAll(
    REGIONAL_INDICATORS["Residential Share of Property Assessments"]
  );

  return (
    <LessonSection title="Residential vs Commercial — The Balance">
      <Prose>
        <p>
          The split between residential and commercial/industrial assessment is
          one of the most important dynamics in municipal finance. Every dollar
          of commercial assessment in the base means one less dollar that
          homeowners need to carry.
        </p>
        <p>
          When a new commercial development arrives — a warehouse, an office
          tower, a retail complex — it adds to the total assessment base without
          adding a household. The budget gets divided across a larger pie, and
          the residential share shrinks. This is why municipalities compete
          fiercely for commercial and industrial development.
        </p>
      </Prose>

      <div className="space-y-0">
        <ChainStep
          number={1}
          title="New Businesses Arrive"
          description="Commercial and industrial properties are added to the assessment base."
        />
        <ChainStep
          number={2}
          title="Assessment Base Grows"
          description="The total pie gets bigger. More assessed value to spread the tax burden across."
        />
        <ChainStep
          number={3}
          title="Residential Share Drops"
          description="Homeowners carry a smaller percentage of the total tax load. Lower pressure on residential tax bills."
        />
      </div>

      <Prose>
        <p>
          Here is the residential share of total property assessments. A lower
          percentage means the municipality has a stronger commercial and
          industrial base supporting the tax load.
        </p>
      </Prose>

      <DataGrid>
        {MUNICIPALITIES.map((muni) => {
          const data = residentialMap.get(muni) ?? [];
          const val = latestRegional(data);
          const period = latestPeriod(data);
          return (
            <LiveDataPoint
              key={muni}
              label={`${muni}${period ? ` (${period})` : ""}`}
              value={val > 0 ? fmt(val, { suffix: "%", decimals: 1 }) : "N/A"}
              source="AB Regional Dashboard"
            />
          );
        })}
      </DataGrid>

      <Insight variant="lever">
        This is why municipalities compete for businesses. Every new commercial
        building reduces the tax load on existing residents. A municipality with
        a 60% residential share has significant commercial support. One with 90%
        residential share means homeowners are carrying almost everything. When
        your council talks about &ldquo;economic development,&rdquo; this is the
        mechanism — they are trying to grow the non-residential assessment base.
      </Insight>

      <Expandable title="Why do commercial properties pay higher rates?">
        <Prose>
          <p>
            Most Alberta municipalities set different tax rates for residential
            and non-residential properties. Commercial and industrial properties
            typically face rates 2-4 times higher than residential. This is a
            policy choice: businesses consume fewer services per dollar of
            assessment (no schools, fewer recreational demands) but can bear a
            higher rate. The gap is called the &ldquo;tax ratio.&rdquo; If the
            ratio gets too high, it discourages business investment — a constant
            balancing act for municipal councils.
          </p>
        </Prose>
      </Expandable>
    </LessonSection>
  );
}

// ============================================================
// Section 4: Where The Money Goes
// ============================================================

async function SpendingSection() {
  const projectsMap = await fetchForAll(
    REGIONAL_INDICATORS["Major Projects"]
  );

  return (
    <LessonSection title="Where The Money Goes — Infrastructure & Services">
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
          On the capital side, municipalities also invest in major projects —
          infrastructure that lasts decades. These are funded through a mix of
          property taxes, reserves, debentures (long-term borrowing for capital
          only), and provincial/federal grants.
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
// Section 5: Comparing Your Community
// ============================================================

async function ComparisonSection() {
  const [populationMap, rawAssessmentMap, taxRateMap] = await Promise.all([
    fetchForAll(REGIONAL_INDICATORS["Population"]),
    fetchForAll(REGIONAL_INDICATORS["Total Equalized Assessment"]),
    fetchForAll(REGIONAL_INDICATORS["Municipal Tax Rates"]),
  ]);
  // Filter to "Grand Total" dimension
  const assessmentMap = new Map<string, RegionalDataPoint[]>();
  for (const [muni, data] of rawAssessmentMap) {
    assessmentMap.set(muni, filterByDimension(data, "Grand Total"));
  }

  // Build comparison rows
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

      {/* Comparison table */}
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
          how much you personally pay. A high rate with a low assessment can
          still mean a lower bill than a low rate with a high assessment.
        </p>
        <p>
          Per-capita assessment is the most revealing number in this table. It
          tells you how much assessed property value exists for every resident.
          Higher per-capita assessment means each person&apos;s share of the tax
          burden is diluted across more property value — which generally means
          more room for services without crushing tax bills.
        </p>
      </Prose>

      <SoWhat>
        When your tax notice arrives, here is how to read it: find your assessed
        value, find the municipal tax rate, and multiply. That is the municipal
        portion of your bill. Then check whether your assessment changed more or
        less than the average for your municipality. If it changed less, your
        share actually shrank — even if the total bill went up because of a
        budget increase. The assessment tells you about your share. The rate
        tells you about total spending. Both matter, but they measure different
        things.
      </SoWhat>
    </LessonSection>
  );
}

// ============================================================
// Page Component
// ============================================================

export default function YourTaxDollarsPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
      <PageHeader
        title="Your Tax Dollars at Work"
        description="How property assessments become municipal budgets become community services — with live data for real Alberta municipalities."
        category="learn"
        icon={<Landmark size={20} />}
      />

      {/* Opening */}
      <BigQuestion>Where does my property tax actually go?</BigQuestion>

      <Prose>
        <p>
          Most Albertans pay property tax every year without knowing how it is
          calculated. The bill arrives, you pay it, and you hope it was fair.
          But property tax is not a mystery — it is a simple equation with
          publicly available inputs. This lesson walks through the entire
          system, from how your property is assessed to how that assessment
          becomes a budget that funds the services you use every day.
        </p>
        <p>
          Everything below uses live data from the Alberta Regional Dashboard.
          These are the real numbers for real municipalities — not textbook
          examples.
        </p>
      </Prose>

      {/* Section 1: Assessment */}
      <Suspense fallback={<LoadingCard />}>
        <AssessmentSection />
      </Suspense>

      {/* Section 2: Tax Rate */}
      <Suspense fallback={<LoadingCard />}>
        <TaxRateSection />
      </Suspense>

      {/* Section 3: Residential vs Commercial */}
      <Suspense fallback={<LoadingCard />}>
        <ResidentialShareSection />
      </Suspense>

      {/* Section 4: Where the Money Goes */}
      <Suspense fallback={<LoadingCard />}>
        <SpendingSection />
      </Suspense>

      {/* Section 5: Comparing Your Community */}
      <Suspense fallback={<LoadingCard />}>
        <ComparisonSection />
      </Suspense>

      {/* Closing */}
      <SoWhat>
        Your property tax is the most direct connection between you and your
        municipal government. Federal taxes disappear into Ottawa. Provincial
        taxes fund province-wide programs. But property tax funds the roads you
        drive on, the fire department that protects your home, the parks your
        kids play in, and the water that comes out of your tap. Understanding
        the assessment-rate-budget loop means you can ask better questions at
        council meetings and understand what is actually being proposed when tax
        changes are discussed. You are not just paying a bill — you are funding
        a community. Now you know exactly how.
      </SoWhat>

      <Insight variant="lever">
        Community levers you can pull: Attend assessment review hearings if your
        number seems wrong — it is your right and the process is designed for
        regular homeowners, not just lawyers. Advocate for commercial and
        industrial development in your municipality — every new business reduces
        the residential share. Support infrastructure investments that grow the
        assessment base over time. Show up at budget deliberations (usually
        November-December) — that is when the actual spending decisions happen,
        not when the tax notice arrives in May.
      </Insight>

      <LessonNav
        prev={{ href: "/home/learn/reading-the-signals", label: "Reading the Signals" }}
        next={{ href: "/home/learn/people-and-growth", label: "People & Growth" }}
      />
    </main>
  );
}
