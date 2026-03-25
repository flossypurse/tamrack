import type { Metadata } from "next";
import { Suspense } from "react";
import { Card } from "@/components/card";
import {
  fetchBoCTimeSeries,
  fetchStatCanTimeSeries,
  BOC_SERIES,
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
import { Globe, Landmark, Users } from "lucide-react";
import { LessonCompleteButton } from "@/components/learn-lesson-complete";

// ============================================================
// Metadata
// ============================================================

export const metadata: Metadata = {
  title: "Zoning & Development — Community Levers — Pulse Learn",
  description:
    "How zoning bylaws shape housing supply, affordability, and community character. The single biggest municipal lever for housing — traced from council vote to rent.",
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
// Helper
// ============================================================

function computeDirection(
  data: TimeSeriesPoint[],
  months = 3
): { direction: "up" | "down" | "flat"; latest: number; change: string } {
  if (data.length < months * 2)
    return { direction: "flat", latest: data.at(-1)?.value ?? 0, change: "" };
  const recent =
    data.slice(-months).reduce((s, p) => s + p.value, 0) / months;
  const prior =
    data.slice(-months * 2, -months).reduce((s, p) => s + p.value, 0) / months;
  if (prior === 0)
    return { direction: "flat", latest: data.at(-1)?.value ?? 0, change: "" };
  const pct = ((recent - prior) / Math.abs(prior)) * 100;
  return {
    direction: pct > 2 ? "up" : pct < -2 ? "down" : "flat",
    latest: data.at(-1)?.value ?? 0,
    change: `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`,
  };
}

// ============================================================
// LeverCard
// ============================================================

function LeverCard({
  icon,
  iconColor,
  title,
  items,
}: {
  icon: React.ReactNode;
  iconColor: string;
  title: string;
  items: string[];
}) {
  return (
    <Card>
      <div className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className={iconColor}>{icon}</span>
          <h4 className="text-sm font-medium text-foreground">{title}</h4>
        </div>
        <ul className="text-xs text-foreground/80 space-y-1.5 ml-1">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-muted shrink-0">&#x2022;</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

// ============================================================
// Housing Levers — Live Data
// ============================================================

async function HousingLeversSection() {
  const [policyRate, housingStarts] = await Promise.all([
    fetchBoCTimeSeries(BOC_SERIES.POLICY_RATE, 24).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.tableId,
      STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.coordinate,
      36
    ).catch(() => []),
  ]);

  const rateTrend = computeDirection(policyRate);
  const startsTrend = computeDirection(housingStarts);

  return (
    <DataGrid>
      <LiveDataPoint
        label="BoC Policy Rate"
        value={`${rateTrend.latest.toFixed(2)}%`}
        change={rateTrend.change}
        direction={rateTrend.direction}
        source="Bank of Canada"
      />
      <LiveDataPoint
        label="Edmonton Housing Starts"
        value={startsTrend.latest.toFixed(0)}
        change={startsTrend.change}
        direction={startsTrend.direction}
        source="StatsCan"
      />
    </DataGrid>
  );
}

// ============================================================
// Page
// ============================================================

export default function ZoningDevelopmentPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
      <BigQuestion>What is the single biggest lever for housing affordability?</BigQuestion>

      <Prose>
        <p>
          Housing affordability is the issue that touches the most people in
          Alberta. And it is shaped by forces at every level — federal monetary
          policy, provincial regulation, municipal zoning, and what you choose
          to support (or oppose) at a public hearing. This lesson maps those
          levers.
        </p>
      </Prose>

      {/* ===== Live Data ===== */}
      <LessonSection title="The Current State">
        <Suspense fallback={<LoadingCard />}>
          <HousingLeversSection />
        </Suspense>
      </LessonSection>

      {/* ===== Housing Lever Map ===== */}
      <LessonSection title="The Housing Lever Map">
        <div className="space-y-3">
          <LeverCard
            icon={<Globe size={16} />}
            iconColor="text-red-400"
            title="Can't Control (but can anticipate)"
            items={[
              "Bank of Canada interest rate \u2014 sets the cost of every mortgage",
              "Federal immigration targets \u2014 drives demand for housing",
              "Global capital flows \u2014 investment dollars seeking Canadian real estate",
            ]}
          />
          <LeverCard
            icon={<Landmark size={16} />}
            iconColor="text-amber-400"
            title="Can Influence (through votes and advocacy)"
            items={[
              "Municipal zoning \u2014 the single biggest supply-side lever",
              "Development permit approval speed \u2014 slow approvals kill projects",
              "Infrastructure investment to enable new development",
              "Rental regulations and tenant protections",
              "Provincial building code and energy efficiency standards",
            ]}
          />
          <LeverCard
            icon={<Users size={16} />}
            iconColor="text-green-400"
            title="Can Do (direct community action)"
            items={[
              "Support infill and density proposals in your neighbourhood",
              "Attend public hearings on zoning changes \u2014 show up, not just NIMBY voices",
              "Advocate for missing middle housing (duplexes, row houses, small apartments)",
              "Support community land trusts and cooperative housing models",
            ]}
          />
        </div>
      </LessonSection>

      {/* ===== Zoning Chain Reaction ===== */}
      <LessonSection title="The Zoning Chain Reaction">
        <Prose>
          <p>
            When a municipality changes its zoning rules, the effects cascade
            through the housing pipeline over 2-4 years. Here is the full chain:
          </p>
        </Prose>

        <Insight variant="lever">
          The single biggest municipal lever for housing affordability is zoning
          reform. Every community that has loosened zoning restrictions has seen
          more supply built. The data is unambiguous: restrictive zoning
          constrains supply, and constrained supply drives up prices. This is the
          lever most within reach of local action.
        </Insight>

        <div className="space-y-0">
          <ChainStep
            number={1}
            title="Zoning change approved"
            description="Council votes to allow duplexes, row houses, or small apartments in previously single-family-only zones. This is the unlock."
            timeLag="Political timeline"
          />
          <ChainStep
            number={2}
            title="Development permits increase"
            description="Builders apply for permits on parcels that were previously restricted. More permit applications mean more projects in the pipeline."
            timeLag="3\u20136 months"
          />
          <ChainStep
            number={3}
            title="Construction begins"
            description="Approved projects break ground. Housing starts rise. This is the signal that supply is actually being added."
            timeLag="6\u201318 months"
          />
          <ChainStep
            number={4}
            title="New supply enters the market"
            description="Completed units are listed for sale or rent. More options for buyers and renters. Competition among landlords increases."
            timeLag="18\u201330 months"
          />
          <ChainStep
            number={5}
            title="Rents stabilize or decline"
            description="When supply grows faster than demand, the math works in renters' favour. This is the affordability payoff \u2014 but it takes 2-4 years from the initial zoning change."
            timeLag="2\u20134 years total"
          />
        </div>

        <Expandable title="Why does zoning matter more than interest rates for local affordability?">
          <Prose>
            <p>
              Interest rates affect demand — how much people can borrow. But
              they apply uniformly across the entire country. Zoning affects
              supply — how much gets built in YOUR specific community. Two
              municipalities with the same interest rate environment can have
              wildly different affordability outcomes based solely on how much
              new housing their zoning allows. You cannot change interest rates.
              You can change zoning by showing up to council meetings.
            </p>
          </Prose>
        </Expandable>
      </LessonSection>

      {/* ===== Infrastructure & Growth ===== */}
      <LessonSection title="Infrastructure &amp; Growth — Building for Tomorrow">
        <Prose>
          <p>
            Infrastructure decisions made today shape communities for 30-50
            years. A highway interchange, a transit line, a school, a recreation
            centre — these are the bones of a community, and once
            they&apos;re built (or not built), the effects compound for decades.
          </p>
        </Prose>

        <div className="space-y-3">
          <LeverCard
            icon={<Globe size={16} />}
            iconColor="text-red-400"
            title="Can't Control"
            items={[
              "Federal infrastructure funding timelines and priorities",
              "Provincial highway and major road investments",
              "Interest rates on municipal borrowing",
            ]}
          />
          <LeverCard
            icon={<Landmark size={16} />}
            iconColor="text-amber-400"
            title="Can Influence"
            items={[
              "Municipal capital plans \u2014 where the next 10 years of investment go",
              "Transit routes and frequency \u2014 ridership data drives funding decisions",
              "School siting decisions \u2014 where schools are built shapes development patterns",
              "Recreation facility priorities \u2014 what gets built and where",
              "Climate resilience infrastructure \u2014 flood mitigation, wildfire protection",
            ]}
          />
          <LeverCard
            icon={<Users size={16} />}
            iconColor="text-green-400"
            title="Can Do"
            items={[
              "Use public transit \u2014 ridership numbers directly drive funding decisions",
              "Participate in municipal budget consultations (they're public and often poorly attended)",
              "Advocate for specific infrastructure in your community",
              "Read your municipality's 3-year capital plan \u2014 it's public and tells you where growth is headed",
              "Support active transportation infrastructure (bike lanes, sidewalks, trails)",
            ]}
          />
        </div>

        <Insight variant="lever">
          Alberta municipalities publish their capital budgets publicly. Reading
          a 3-year capital plan tells you more about where your community is
          headed than any news article. It shows you exactly where the money is
          going — and where it isn&apos;t. This is freely available
          information that almost nobody reads.
        </Insight>
      </LessonSection>

      <SoWhat>
        Zoning is the most powerful supply-side lever a municipality controls.
        Infrastructure shapes where growth goes for decades. Both are decided in
        public meetings that most people never attend. If you care about housing
        affordability or community growth, these are the rooms to be in.
      </SoWhat>

      <LessonCompleteButton moduleSlug="community-levers" lessonSlug="zoning-development" />

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Alberta Pulse Check &mdash; Zoning &amp; Development &mdash; All data
        from free public APIs
      </footer>
    </main>
  );
}
