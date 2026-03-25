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

export const metadata: Metadata = {
  title: "Property Tax 101 — Your Tax Dollars — Pulse Learn",
  description:
    "How property assessments work, what the mill rate means, and how your tax bill is actually calculated — with live data from Alberta municipalities.",
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

/** Filter regional data to a specific dimension value */
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

/** Fetch one indicator for all target municipalities */
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
    <LessonSection title="The Tax Rate — From Assessment to Bill">
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
// Page Component
// ============================================================

export default function PropertyTaxPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
      <BigQuestion>How is my property tax actually calculated?</BigQuestion>

      <Prose>
        <p>
          Most Albertans pay property tax every year without knowing how it is
          calculated. The bill arrives, you pay it, and you hope it was fair.
          But property tax is not a mystery — it is a simple equation with
          publicly available inputs. This lesson walks through the entire
          system, from how your property is assessed to how that assessment
          becomes a share of the total tax levy.
        </p>
        <p>
          Everything below uses live data from the Alberta Regional Dashboard.
          These are the real numbers for real municipalities — not textbook
          examples.
        </p>
      </Prose>

      <Suspense fallback={<LoadingCard />}>
        <AssessmentSection />
      </Suspense>

      <Suspense fallback={<LoadingCard />}>
        <TaxRateSection />
      </Suspense>

      <Suspense fallback={<LoadingCard />}>
        <ResidentialShareSection />
      </Suspense>

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

      <Insight variant="lever">
        Community levers you can pull: Attend assessment review hearings if your
        number seems wrong — it is your right and the process is designed for
        regular homeowners, not just lawyers. Show up at budget deliberations
        (usually November-December) — that is when the actual spending decisions
        happen, not when the tax notice arrives in May.
      </Insight>

      <LessonCompleteButton moduleSlug="tax-dollars" lessonSlug="property-tax" />

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Alberta Pulse Check &mdash; Property Tax 101 &mdash; All data from free
        public APIs
      </footer>
    </main>
  );
}
