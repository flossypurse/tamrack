import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader } from "@/components/card";
import { PageHeader } from "@/components/page-header";
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
import { fetchHousingStarts, fetchVacancyRates, fetchRentComparison } from "@/lib/data-sources-cmhc";
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
import { Home } from "lucide-react";

export const metadata: Metadata = {
  title: "The Housing Machine — Learn — Alberta Pulse Check",
  description:
    "Trace how a Bank of Canada rate decision flows through mortgage rates, building permits, construction starts, vacancy rates, all the way to your rent.",
};

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Section 1 — The Bank of Canada Sets the Price of Money             */
/* ------------------------------------------------------------------ */

async function PolicyRateSection() {
  const data = await fetchBoCTimeSeries(BOC_SERIES.POLICY_RATE, 240).catch(() => []);
  const latest = data.at(-1);
  const timeRange = computeTimeRange(data);

  const prevYear = data.length > 12 ? data[data.length - 13] : null;
  const direction =
    latest && prevYear
      ? latest.value > prevYear.value
        ? "up" as const
        : latest.value < prevYear.value
        ? "down" as const
        : "flat" as const
      : undefined;
  const change =
    latest && prevYear
      ? `${(latest.value - prevYear.value) > 0 ? "+" : ""}${(latest.value - prevYear.value).toFixed(2)}% vs 1yr ago`
      : undefined;

  return (
    <LessonSection title="Step 1 — The Bank of Canada Sets the Price of Money">
      <ChainStep
        number={1}
        title="The overnight rate"
        description="Eight times a year, the Bank of Canada announces its policy interest rate — the rate at which big banks lend to each other overnight. This single number is the starting domino for the entire housing machine."
      />

      <Prose>
        <p>
          Think of the policy rate as the wholesale price of money. When the BoC
          raises it, borrowing gets more expensive for everyone — banks, businesses,
          and you. When they cut it, money gets cheaper, and people borrow more.
        </p>
        <p>
          The chart below shows 20 years of this rate. Notice the dramatic swings:
          near-zero during COVID, then the fastest hiking cycle in a generation.
          Every peak and valley here ripples through the entire housing market — it
          just takes time to show up.
        </p>
      </Prose>

      <Card>
        <CardHeader title="BoC Policy Rate — 20 Year History" freshness="daily" />
        <ChartCard
          chartId="learn-housing-policy-rate"
          title="BoC Policy Rate"
          timeRange={timeRange}
          source="Bank of Canada"
        >
          <TimeSeriesAreaChart data={data} color="#3b82f6" height={220} valueSuffix="%" />
        </ChartCard>
      </Card>

      <Insight>
        This one number affects every single mortgage in Canada. When it moves by
        even a quarter point, billions of dollars shift between borrowers and
        lenders. It is the most powerful lever in Canadian housing.
      </Insight>

      {latest && (
        <DataGrid>
          <LiveDataPoint
            label="Current Policy Rate"
            value={`${latest.value.toFixed(2)}%`}
            direction={direction}
            change={change}
            source="Bank of Canada"
          />
        </DataGrid>
      )}
    </LessonSection>
  );
}

/* ------------------------------------------------------------------ */
/*  Section 2 — Mortgage Rates Follow                                  */
/* ------------------------------------------------------------------ */

async function MortgageRateSection() {
  const [policyData, fixed5Data, variable5Data] = await Promise.all([
    fetchBoCTimeSeries(BOC_SERIES.POLICY_RATE, 240).catch(() => []),
    fetchBoCTimeSeries(BOC_SERIES.MORTGAGE_5Y_FIXED, 240).catch(() => []),
    fetchBoCTimeSeries(BOC_SERIES.MORTGAGE_5Y_VARIABLE, 240).catch(() => []),
  ]);

  // Merge into MultiSeriesPoint[]
  const dateMap = new Map<string, MultiSeriesPoint>();
  for (const p of policyData) {
    dateMap.set(p.date, { date: p.date, policy: p.value, fixed: 0, variable: 0 });
  }
  for (const p of fixed5Data) {
    const existing = dateMap.get(p.date);
    if (existing) {
      existing.fixed = p.value;
    } else {
      dateMap.set(p.date, { date: p.date, policy: 0, fixed: p.value, variable: 0 });
    }
  }
  for (const p of variable5Data) {
    const existing = dateMap.get(p.date);
    if (existing) {
      existing.variable = p.value;
    } else {
      dateMap.set(p.date, { date: p.date, policy: 0, fixed: 0, variable: p.value });
    }
  }
  const merged = Array.from(dateMap.values()).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const timeRange = computeTimeRange(merged);
  const latestFixed = fixed5Data.at(-1);
  const latestVariable = variable5Data.at(-1);

  return (
    <LessonSection title="Step 2 — Mortgage Rates Follow">
      <ChainStep
        number={2}
        title="Banks set mortgage rates"
        description="Commercial banks take the BoC policy rate and add their margin. The 5-year fixed rate also bakes in bond market expectations about where rates are headed. Your monthly payment is set here."
        timeLag="2–6 weeks"
      />

      <Prose>
        <p>
          There are two flavours of mortgage rate that matter. The variable rate
          moves almost in lockstep with the BoC — when the Bank cuts, your payment
          drops within weeks. The 5-year fixed rate is trickier: it follows the
          bond market, which prices in where traders think rates will be years from
          now.
        </p>
        <p>
          Watch how the blue policy rate line and the green fixed rate line move
          together over time, but the fixed rate often leads — it starts falling
          before the BoC actually cuts, because bond traders are forward-looking.
        </p>
      </Prose>

      <Card>
        <CardHeader title="Policy Rate vs Mortgage Rates" freshness="daily" />
        <ChartCard
          chartId="learn-housing-mortgage-rates"
          title="Policy Rate vs Mortgage Rates"
          timeRange={timeRange}
          source="Bank of Canada"
        >
          <MultiSeriesLineChart
            data={merged}
            series={[
              { key: "policy", label: "BoC Policy Rate", color: "#3b82f6", suffix: "%" },
              { key: "fixed", label: "5yr Fixed Mortgage", color: "#10b981", suffix: "%" },
              { key: "variable", label: "5yr Variable Mortgage", color: "#f97316", suffix: "%" },
            ]}
            height={250}
          />
        </ChartCard>
      </Card>

      <Insight variant="warning">
        Variable rates respond to BoC changes within weeks. Fixed rates can
        actually move in the opposite direction if bond markets disagree with the
        Bank. In late 2023, the BoC held rates steady while 5-year fixed rates
        drifted lower — the bond market was betting on future cuts before the Bank
        made them.
      </Insight>

      <DataGrid>
        {latestFixed && (
          <LiveDataPoint
            label="5yr Fixed Rate"
            value={`${latestFixed.value.toFixed(2)}%`}
            source="Bank of Canada"
          />
        )}
        {latestVariable && (
          <LiveDataPoint
            label="5yr Variable Rate"
            value={`${latestVariable.value.toFixed(2)}%`}
            source="Bank of Canada"
          />
        )}
      </DataGrid>
    </LessonSection>
  );
}

/* ------------------------------------------------------------------ */
/*  Section 3 — Buyers React                                           */
/* ------------------------------------------------------------------ */

function BuyerReactionSection() {
  return (
    <LessonSection title="Step 3 — Buyers React">
      <ChainStep
        number={3}
        title="Mortgage rates drive buyer demand"
        description="When rates drop, buyers can afford more house for the same monthly payment. When rates rise, the opposite happens — budgets shrink, demand cools, and some buyers are priced out entirely."
        timeLag="1–3 months"
      />

      <Prose>
        <p>
          Here is the core affordability equation that every buyer faces, whether
          they know it or not:
        </p>
        <p className="font-mono text-xs bg-foreground/[0.03] border border-card-border rounded-lg p-3 text-center">
          Monthly income &divide; Mortgage rate = Maximum purchase price
        </p>
        <p>
          Your income does not change when the BoC announces a rate cut. But the
          amount a bank will lend you absolutely does. A family earning $120K/year
          might qualify for a $480K mortgage at 6%, but $530K at 5%. Same family,
          same paycheque — $50K more purchasing power from a single percentage point.
        </p>
        <p>
          Multiply that across thousands of buyers in Edmonton and Calgary, and you
          get a wave of demand that hits the market all at once. That is what
          drives bidding wars when rates drop and what causes listings to sit for
          months when rates spike.
        </p>
      </Prose>

      <Insight>
        A rough rule of thumb: every 1% drop in mortgage rates gives buyers about
        10% more purchasing power. That means a move from 6% to 5% does not just
        add a little room — it can push someone from a condo budget into a
        townhouse budget. Small rate moves, big market effects.
      </Insight>

      <Expandable title="Why does buyer demand lag by 1-3 months?">
        <Prose>
          <p>
            People do not check mortgage rates daily. Most buyers start their
            search, get pre-approved, and only then discover what rates look like.
            After a rate cut, it takes a few weeks for media coverage to shift
            sentiment, another few weeks for new pre-approvals to come through, and
            then those buyers need to actually find and close on a property. The
            whole cycle from rate announcement to a spike in sales typically runs
            4-12 weeks.
          </p>
        </Prose>
      </Expandable>
    </LessonSection>
  );
}

/* ------------------------------------------------------------------ */
/*  Section 4 — Developers Read the Tea Leaves                         */
/* ------------------------------------------------------------------ */

async function DeveloperSection() {
  const startsData = await fetchHousingStarts(60).catch(() => []);
  const timeRange = computeTimeRange(startsData);

  const multiData: MultiSeriesPoint[] = startsData.map((p) => ({
    date: p.date,
    edmonton: p.edmonton,
    calgary: p.calgary,
  }));

  const latestStarts = startsData.at(-1);

  return (
    <LessonSection title="Step 4 — Developers Read the Tea Leaves">
      <ChainStep
        number={4}
        title="New construction responds to demand signals"
        description="Developers watch sales volumes, price trends, and — crucially — financing costs. When rates drop and demand heats up, they pull permits and break ground. When rates spike, projects get shelved."
        timeLag="3–12 months after rate changes"
      />

      <Prose>
        <p>
          A developer deciding to build a 200-unit apartment building is making a
          bet that will not pay off for 2-3 years. They borrow millions at today's
          rates, build for 18+ months, and then sell or lease into whatever market
          exists when they finish. So they are incredibly sensitive to interest rates
          — not just today's rates, but where they think rates are headed.
        </p>
        <p>
          Housing starts — the number of new units where construction has actually
          begun — are the clearest signal of what supply will look like in 1-2
          years. Watch how Edmonton and Calgary track each other but are not
          identical: Calgary's boom-bust cycles are sharper because of its heavier
          tilt toward the energy sector.
        </p>
      </Prose>

      <Card>
        <CardHeader title="Housing Starts — Edmonton vs Calgary" freshness="daily" />
        <ChartCard
          chartId="learn-housing-starts-cma"
          title="Housing Starts — Edmonton vs Calgary"
          timeRange={timeRange}
          source="StatsCan / CMHC"
        >
          <MultiSeriesLineChart
            data={multiData}
            series={[
              { key: "edmonton", label: "Edmonton", color: "#3b82f6", suffix: " units" },
              { key: "calgary", label: "Calgary", color: "#f97316", suffix: " units" },
            ]}
            height={250}
          />
        </ChartCard>
      </Card>

      {latestStarts && (
        <DataGrid>
          <LiveDataPoint
            label="Edmonton Starts (latest)"
            value={latestStarts.edmonton.toLocaleString()}
            source="CMHC"
          />
          <LiveDataPoint
            label="Calgary Starts (latest)"
            value={latestStarts.calgary.toLocaleString()}
            source="CMHC"
          />
        </DataGrid>
      )}

      <Expandable title="What about zoning and approvals?">
        <Prose>
          <p>
            Interest rates are only half the story. Municipal zoning, permitting
            timelines, NIMBYism, and construction labour shortages all slow down
            the pipeline. Edmonton recently upzoned the entire city to allow mid-rise
            housing everywhere — that is a structural change that should increase
            supply response over time. But even with perfect zoning, you cannot
            build faster than trades workers can pour concrete.
          </p>
        </Prose>
      </Expandable>
    </LessonSection>
  );
}

/* ------------------------------------------------------------------ */
/*  Section 5 — The Pipeline: Starts to Completions                    */
/* ------------------------------------------------------------------ */

async function PipelineSection() {
  const [startsRaw, completionsRaw] = await Promise.all([
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.tableId,
      STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.coordinate,
      60
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.EDMONTON_HOUSING_COMPLETIONS.tableId,
      STATSCAN_SERIES.EDMONTON_HOUSING_COMPLETIONS.coordinate,
      60
    ).catch(() => []),
  ]);

  const dateMap = new Map<string, MultiSeriesPoint>();
  for (const p of startsRaw) {
    dateMap.set(p.date, { date: p.date, starts: p.value, completions: 0 });
  }
  for (const p of completionsRaw) {
    const existing = dateMap.get(p.date);
    if (existing) {
      existing.completions = p.value;
    } else {
      dateMap.set(p.date, { date: p.date, starts: 0, completions: p.value });
    }
  }
  const merged = Array.from(dateMap.values()).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const timeRange = computeTimeRange(merged);

  return (
    <LessonSection title="Step 5 — The Pipeline: Starts to Completions">
      <ChainStep
        number={5}
        title="Construction takes 12-24 months"
        description="Once ground is broken, it takes 1-2 years before units are ready to occupy. The gap between starts and completions today tells you what supply will look like in 12-18 months."
        timeLag="12–24 months"
      />

      <Prose>
        <p>
          This is the part that most people miss. When starts spike today, those
          units will not hit the market for over a year. If completions are low
          right now, that means we are living with decisions developers made 18
          months ago — before the most recent rate cuts.
        </p>
        <p>
          The chart below shows Edmonton's construction pipeline. When the orange
          completions line is well below the blue starts line, that means a wave of
          new supply is coming. When they converge, the pipeline is draining and
          future supply is thinning out.
        </p>
      </Prose>

      <Card>
        <CardHeader title="Edmonton — Starts vs Completions" freshness="daily" />
        <ChartCard
          chartId="learn-housing-pipeline"
          title="Edmonton Starts vs Completions"
          timeRange={timeRange}
          source="StatsCan / CMHC"
        >
          <MultiSeriesLineChart
            data={merged}
            series={[
              { key: "starts", label: "Housing Starts", color: "#3b82f6", suffix: " units" },
              { key: "completions", label: "Completions", color: "#f97316", suffix: " units" },
            ]}
            height={250}
          />
        </ChartCard>
      </Card>

      <Insight variant="watch">
        The gap between the starts line and the completions line is your crystal
        ball. When starts are running well above completions, that means a flood of
        new supply is in the pipeline and will arrive in 12-18 months. When starts
        collapse, expect tighter supply — and upward pressure on rents — roughly
        18 months later.
      </Insight>
    </LessonSection>
  );
}

/* ------------------------------------------------------------------ */
/*  Section 6 — Supply Meets Demand: Vacancy & Rent                    */
/* ------------------------------------------------------------------ */

async function VacancyRentSection() {
  const [vacancyData, rentData] = await Promise.all([
    fetchVacancyRates(20).catch(() => []),
    fetchRentComparison(20).catch(() => []),
  ]);

  const vacancyMulti: MultiSeriesPoint[] = vacancyData.map((p) => ({
    date: p.date,
    edmonton: p.edmonton,
    calgary: p.calgary,
  }));
  const vacancyTimeRange = computeTimeRange(vacancyData);

  const rentMulti: MultiSeriesPoint[] = rentData.map((p) => ({
    date: p.date,
    edmonton: p.edmontonTwoBed,
    calgary: p.calgaryTwoBed,
  }));
  const rentTimeRange = computeTimeRange(rentData);

  const latestVacancy = vacancyData.at(-1);
  const latestRent = rentData.at(-1);

  return (
    <LessonSection title="Step 6 — Supply Meets Demand: Vacancy & Rent">
      <ChainStep
        number={6}
        title="Completions hit the market, vacancy shifts, rent adjusts"
        description="When new units finally complete and hit the rental market, vacancy rates move. Landlords set rent based on how many empty units are competing for tenants. Below 3% vacancy, landlords have pricing power. Above 5%, tenants do."
        timeLag="6–12 months after completions"
      />

      <Prose>
        <p>
          This is where the chain connects back to the question we started with:
          why did my rent go up? The answer almost always traces back to the
          vacancy rate. When vacancy is tight — say, below 3% — landlords know that
          tenants have few options. They can raise rent and someone will pay it.
          When vacancy climbs above 5%, landlords start offering incentives just to
          fill units.
        </p>
        <p>
          Alberta's two big cities have very different stories. Edmonton has
          historically had higher vacancy (more affordable, more balanced), while
          Calgary has been tighter. But both are subject to the same machine: rates
          drive starts, starts drive supply, supply drives vacancy, vacancy drives
          rent.
        </p>
      </Prose>

      <Card>
        <CardHeader title="Vacancy Rate — Edmonton vs Calgary" freshness="daily" />
        <ChartCard
          chartId="learn-housing-vacancy"
          title="Vacancy Rate — Edmonton vs Calgary"
          timeRange={vacancyTimeRange}
          source="StatsCan / CMHC"
        >
          <MultiSeriesLineChart
            data={vacancyMulti}
            series={[
              { key: "edmonton", label: "Edmonton", color: "#3b82f6", suffix: "%" },
              { key: "calgary", label: "Calgary", color: "#f97316", suffix: "%" },
            ]}
            height={220}
          />
        </ChartCard>
      </Card>

      {latestVacancy && (
        <DataGrid>
          <LiveDataPoint
            label="Edmonton Vacancy"
            value={`${latestVacancy.edmonton.toFixed(1)}%`}
            direction={latestVacancy.edmonton >= 3 ? "up" : "down"}
            source="CMHC"
          />
          <LiveDataPoint
            label="Calgary Vacancy"
            value={`${latestVacancy.calgary.toFixed(1)}%`}
            direction={latestVacancy.calgary >= 3 ? "up" : "down"}
            source="CMHC"
          />
        </DataGrid>
      )}

      <Insight>
        The 3% vacancy mark is widely considered the &quot;balance point.&quot;
        Below 3%, the market favours landlords — expect above-inflation rent
        increases. Above 5%, tenants have real negotiating power. Between 3-5% is
        roughly balanced. Check the current numbers above: which side of 3% is
        your city on?
      </Insight>

      <Card>
        <CardHeader title="Average 2-Bedroom Rent — Edmonton vs Calgary" freshness="daily" />
        <ChartCard
          chartId="learn-housing-rent-2bed"
          title="Average 2-Bedroom Rent"
          timeRange={rentTimeRange}
          source="StatsCan / CMHC"
        >
          <MultiSeriesLineChart
            data={rentMulti}
            series={[
              { key: "edmonton", label: "Edmonton", color: "#3b82f6", prefix: "$" },
              { key: "calgary", label: "Calgary", color: "#f97316", prefix: "$" },
            ]}
            height={220}
          />
        </ChartCard>
      </Card>

      {latestRent && (
        <DataGrid>
          <LiveDataPoint
            label="Edmonton 2-Bed Rent"
            value={`$${latestRent.edmontonTwoBed.toLocaleString()}`}
            source="CMHC"
          />
          <LiveDataPoint
            label="Calgary 2-Bed Rent"
            value={`$${latestRent.calgaryTwoBed.toLocaleString()}`}
            source="CMHC"
          />
        </DataGrid>
      )}
    </LessonSection>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function HousingMachinePage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <PageHeader
        title="The Housing Machine"
        description="How a Bank of Canada rate decision flows through mortgage rates, building permits, construction, vacancy — all the way to your rent cheque."
        category="learn"
        icon={<Home size={20} />}
      />

      {/* Opening question */}
      <BigQuestion>Why did my rent go up?</BigQuestion>

      <Prose>
        <p>
          It is one of the most common questions in Alberta — and the answer is
          not &quot;because landlords are greedy&quot; (though some are). The real
          answer involves a chain of cause and effect that starts in Ottawa, runs
          through bond markets and bank boardrooms, flows into construction sites
          and permitting offices, and takes 2-3 years to fully play out before
          landing on your kitchen table as a rent increase notice.
        </p>
        <p>
          This lesson traces that chain, link by link, using live Alberta data.
          Every chart below updates automatically. By the end, you will be able to
          read the signals and know — months before your landlord does — whether
          rent is likely to rise or fall.
        </p>
      </Prose>

      {/* Step 1: Policy Rate */}
      <Suspense fallback={<LoadingCard />}>
        <PolicyRateSection />
      </Suspense>

      {/* Step 2: Mortgage Rates */}
      <Suspense fallback={<LoadingCard />}>
        <MortgageRateSection />
      </Suspense>

      {/* Step 3: Buyers React (no async data, renders immediately) */}
      <BuyerReactionSection />

      {/* Step 4: Developers */}
      <Suspense fallback={<LoadingCard />}>
        <DeveloperSection />
      </Suspense>

      {/* Step 5: Pipeline */}
      <Suspense fallback={<LoadingCard />}>
        <PipelineSection />
      </Suspense>

      {/* Step 6: Vacancy & Rent */}
      <Suspense fallback={<LoadingCard />}>
        <VacancyRentSection />
      </Suspense>

      {/* The Full Chain — closing summary */}
      <LessonSection title="The Full Chain">
        <SoWhat>
          <p>
            Here is the entire machine, end to end:
          </p>
          <ol className="list-decimal list-inside space-y-1 mt-2 text-sm">
            <li><strong>BoC sets the policy rate</strong> (the price of money)</li>
            <li><strong>Banks adjust mortgage rates</strong> (2-6 weeks later)</li>
            <li><strong>Buyer demand shifts</strong> (1-3 months later)</li>
            <li><strong>Developers respond</strong> — permits and starts (3-12 months later)</li>
            <li><strong>Construction pipeline</strong> — starts become completions (12-24 months later)</li>
            <li><strong>Vacancy shifts</strong> — new supply hits the rental market (6-12 months after completion)</li>
            <li><strong>Rent adjusts</strong> — landlords price based on vacancy</li>
          </ol>
          <p className="mt-3">
            Total lag from rate decision to rent impact: <strong>2-4 years</strong>.
            That is why housing feels disconnected from the news — you are always
            living with the consequences of decisions made years ago.
          </p>
        </SoWhat>

        <Insight variant="watch">
          Right now, based on the live data above, you can trace the chain
          yourself. Look at where the BoC rate is today, check whether starts are
          rising or falling, see the gap between starts and completions, and read
          the vacancy numbers. Each link tells you something about where rent is
          headed over the next 12 months. The signals are there — you just have to
          know where to look.
        </Insight>

        <Expandable title="How to use this for your own decisions">
          <Prose>
            <p>
              <strong>If you are a renter:</strong> Watch the vacancy rate in your city.
              If it is rising, you have leverage to negotiate at renewal time. If it
              is falling, locking in a longer lease might save you money.
            </p>
            <p>
              <strong>If you are a buyer:</strong> Follow starts and completions. A
              wave of completions means more resale inventory 6-12 months later as
              investors flip pre-construction units. More inventory = more bargaining
              power for you.
            </p>
            <p>
              <strong>If you are an investor:</strong> The full chain is your
              competitive advantage. When the BoC starts cutting and starts have
              been depressed, you know supply will be tight 2 years out. When starts
              are booming, be cautious about projects that will deliver into a
              saturated market.
            </p>
          </Prose>
        </Expandable>
      </LessonSection>

      {/* Navigation */}
      <LessonNav
        prev={{ href: "/home/learn", label: "All Lessons" }}
        next={{ href: "/home/learn/energy-economy", label: "Energy Economy" }}
      />
    </div>
  );
}
