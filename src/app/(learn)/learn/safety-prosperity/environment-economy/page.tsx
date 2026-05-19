import type { Metadata } from "next";
import { Suspense } from "react";
import { Card } from "@/components/card";
import {
  fetchStatCanTimeSeries,
  STATSCAN_SERIES,
  type TimeSeriesPoint,
} from "@/lib/data-sources";
import { fetchRegionalIndicator } from "@/lib/data-sources-regional";
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
  title: "Environment & Economy — Safety & Prosperity — Pulse Learn",
  description:
    "Wildfire risk, emissions, and economic resilience. What actually reduces crime — the evidence on upstream vs downstream spending.",
};

// ============================================================
// Constants
// ============================================================

const COMPARISON_CITIES = [
  "Edmonton",
  "Calgary",
  "Lethbridge",
  "Red Deer",
];

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

interface RegionalPoint {
  municipality: string;
  period: string;
  value: number;
}

function extractLatest(
  allData: RegionalPoint[],
  municipality: string
): { value: number; period: string } | null {
  const cityData = allData
    .filter((d) => d.municipality.toLowerCase() === municipality.toLowerCase())
    .sort((a, b) => a.period.localeCompare(b.period));
  const last = cityData.at(-1);
  if (!last) return null;
  return { value: last.value, period: last.period };
}

// ============================================================
// Section: What Actually Reduces Crime
// ============================================================

async function CrimeReductionSection() {
  const [incomeRaw, unemploymentRaw] = await Promise.all([
    fetchRegionalIndicator("Median Household Income").catch(() => []),
    fetchRegionalIndicator("Unemployment Rate").catch(() => []),
  ]);

  const incomeData: RegionalPoint[] = incomeRaw.map((d) => ({
    municipality: d.municipality,
    period: d.period,
    value: d.value,
  }));

  return (
    <div className="space-y-4">
      <Prose>
        <p>
          Decades of criminology research point to the same conclusion: the
          factors that reduce crime are overwhelmingly <em>upstream</em> of
          the criminal justice system. Policing matters, but it is not the
          primary lever. Here is what the evidence actually says, ranked by
          strength of evidence:
        </p>
      </Prose>

      <div className="space-y-0">
        <ChainStep
          number={1}
          title="Economic opportunity (strongest evidence)"
          description="When people have stable jobs and adequate income, crime drops — consistently, across every study, in every country. Employment is the single strongest protective factor against both property and violent crime."
        />
        <ChainStep
          number={2}
          title="Housing stability"
          description="Chronic homelessness is both a symptom and a driver of safety issues. People without stable housing are more likely to be victims of crime AND more likely to engage in survival-driven offences. Every affordable housing unit built has a downstream effect on safety."
        />
        <ChainStep
          number={3}
          title="Community design"
          description="Lighting, walkability, mixed-use neighbourhoods, and active public spaces reduce crime through what criminologists call 'natural surveillance.' When streets have eyes — residents walking, shops open, patios full — crime opportunities shrink."
        />
        <ChainStep
          number={4}
          title="Early intervention"
          description="Youth programs, mental health services, addiction treatment, and crisis intervention teams address the root causes before they become criminal justice problems. For every dollar spent on youth intervention, communities save $7-10 in downstream justice and healthcare costs."
        />
        <ChainStep
          number={5}
          title="Policing (necessary but not sufficient)"
          description="Effective, community-oriented policing is an essential part of public safety. But policing alone cannot solve problems rooted in poverty, addiction, and social disconnection. It is the backstop, not the solution."
        />
      </div>

      <DataGrid>
        {COMPARISON_CITIES.map((city) => {
          const income = extractLatest(incomeData, city);
          return income ? (
            <LiveDataPoint
              key={city}
              label={`${city} Median Income`}
              value={`$${(income.value / 1000).toFixed(0)}K`}
              source={`${income.period}`}
            />
          ) : null;
        })}
      </DataGrid>

      <Insight variant="lever">
        The biggest crime-reduction lever a community has is economic inclusion.
        Every job created, every affordable housing unit built, every youth
        program funded has a downstream effect on safety — measurable in the
        CSI 12 to 24 months later. The communities that invest upstream
        consistently have better safety outcomes downstream.
      </Insight>

      <Expandable title="What about 'tough on crime' policies?">
        <Prose>
          <p>
            The research is clear: incarceration alone does not reduce crime
            rates. Longer sentences have minimal deterrent effect because most
            crimes are committed impulsively, not after careful cost-benefit
            analysis. What DOES work is certainty of consequences (people
            believing they will be caught) combined with rehabilitation and
            reintegration programs. The most effective criminal justice systems
            combine swift, certain consequences with robust support for
            reintegration — housing, employment, and treatment upon release.
          </p>
        </Prose>
      </Expandable>
    </div>
  );
}

// ============================================================
// Section: Environment & Economic Risk
// ============================================================

function EnvironmentRiskSection() {
  return (
    <div className="space-y-4">
      <Prose>
        <p>
          Alberta&apos;s environment and economy are deeply intertwined.
          Wildfires threaten energy infrastructure, forestry revenue, tourism,
          and insurance costs. Emissions regulations shape investment decisions.
          Air and water quality affect health outcomes — which circle back to
          economic productivity.
        </p>
        <p>
          The 2023 wildfire season cost Alberta billions in direct damage,
          evacuation costs, lost economic activity, and insurance claims. It
          demonstrated that environmental risk is economic risk — not a separate
          category.
        </p>
      </Prose>

      <div className="space-y-0">
        <ChainStep
          number={1}
          title="Wildfire season arrives"
          description="Climate conditions, drought, and wind create fire risk. Alberta's boreal forest is one of the most fire-prone landscapes in North America."
        />
        <ChainStep
          number={2}
          title="Energy infrastructure threatened"
          description="Pipelines, processing plants, and wellheads are evacuated or shut down. Production drops. Supply chains are disrupted."
          timeLag="Immediate"
        />
        <ChainStep
          number={3}
          title="Communities evacuated"
          description="Residents displaced, businesses closed, schools shut. The economic toll compounds daily during an active evacuation."
          timeLag="Days to weeks"
        />
        <ChainStep
          number={4}
          title="Insurance and rebuilding costs"
          description="Insurance premiums rise across the province. Rebuilding costs are borne by municipalities, provinces, and the federal disaster assistance program."
          timeLag="Months to years"
        />
        <ChainStep
          number={5}
          title="Long-term economic impact"
          description="Forestry revenue lost for decades (trees take 60-100 years to regrow). Tourism affected. Municipal budgets strained by emergency response costs."
          timeLag="Years to decades"
        />
      </div>

      <Insight variant="watch">
        Wildfire statistics are not just environmental data — they are economic
        risk indicators. A municipality&apos;s wildfire exposure, combined with
        its emergency preparedness budget, tells you something important about
        long-term financial resilience.
      </Insight>

      <Expandable title="How do emissions regulations affect Alberta's economy?">
        <Prose>
          <p>
            Emissions regulations create costs for high-emitting industries
            (primarily oil sands, power generation, and manufacturing). But they
            also create opportunities: clean technology investment, carbon
            capture and storage projects, and renewable energy development are
            all growing sectors in Alberta. The net economic impact depends on
            the pace of transition and the competitiveness of Alberta&apos;s
            technology response. What&apos;s clear from the data is that
            Alberta&apos;s emissions per capita are among the highest in Canada,
            which means the regulatory and market pressure to reduce them will
            continue to intensify.
          </p>
        </Prose>
      </Expandable>
    </div>
  );
}

// ============================================================
// Closing
// ============================================================

async function ClosingSection() {
  const unemployment = await fetchStatCanTimeSeries(
    STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.tableId,
    STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.coordinate,
    12
  ).catch(() => []);

  const trend = computeDirection(unemployment, 3);
  const trendDescription =
    trend.direction === "up"
      ? "Alberta unemployment is trending UP — if this continues, watch for rising property crime in 3-6 months and increased social disorder in 6-9 months"
      : trend.direction === "down"
      ? "Alberta unemployment is trending DOWN — this is the strongest leading indicator that safety conditions will improve, though the effect won't show up in crime stats for another 6-12 months"
      : "Alberta unemployment is relatively flat — safety trends are likely to hold steady in the near term, but watch for changes in employment data as the earliest signal of what comes next";

  return (
    <SoWhat>
      <p>
        Safety data is a <strong>lagging indicator</strong> of community
        health. By the time crime spikes, the economic conditions that caused
        it started 6-12 months earlier. To predict safety trends, watch the
        leading indicators: unemployment, business formation, housing
        stability. The communities that invest in these upstream factors
        consistently have better safety outcomes.
      </p>
      <p className="mt-2">
        Right now, {trendDescription}.
      </p>
      <p className="mt-2">
        The takeaway: if you want to know where safety is heading, don&apos;t
        look at crime statistics — they&apos;re telling you about the past.
        Look at economic data. It&apos;s telling you about the future.
      </p>
    </SoWhat>
  );
}

// ============================================================
// Page
// ============================================================

export default function EnvironmentEconomyPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
      <BigQuestion>How do environment, safety, and the economy connect?</BigQuestion>

      <Prose>
        <p>
          This lesson ties the threads together: what actually reduces crime
          (hint: it is mostly upstream of the justice system), how environmental
          risk is economic risk, and what the current data says about where
          Alberta&apos;s safety and prosperity are heading.
        </p>
      </Prose>

      {/* What Reduces Crime */}
      <LessonSection title="What Actually Reduces Crime">
        <Suspense fallback={<LoadingCard />}>
          <CrimeReductionSection />
        </Suspense>
      </LessonSection>

      {/* Environment & Economic Risk */}
      <LessonSection title="Environment &amp; Economic Risk">
        <EnvironmentRiskSection />
      </LessonSection>

      {/* Closing */}
      <Suspense fallback={<LoadingCard />}>
        <ClosingSection />
      </Suspense>

      <LessonCompleteButton moduleSlug="safety-prosperity" lessonSlug="environment-economy" />

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Tamrack &mdash; Environment &amp; Economy &mdash; All data
        from free public APIs
      </footer>
    </main>
  );
}
