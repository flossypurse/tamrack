import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader } from "@/components/card";
import {
  MultiSeriesLineChart,
  type MultiSeriesPoint,
} from "@/components/chart";
import { ChartCard } from "@/components/chart-card";
import { computeTimeRange } from "@/lib/time-range";
import { fetchVacancyRates, fetchRentComparison } from "@/lib/data-sources-cmhc";
import {
  Prose,
  ChainStep,
  LiveDataPoint,
  DataGrid,
  Insight,
  Expandable,
  LessonSection,
  SoWhat,
} from "@/components/learn-lesson";
import { LessonCompleteButton } from "@/components/learn-lesson-complete";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vacancy & Rent — The Housing Machine — Pulse Learn",
  description:
    "When supply meets demand — the 3% tipping point. Vacancy rates and rent data for Edmonton and Calgary.",
};

// ============================================================
// Loading fallback
// ============================================================

function LoadingCard() {
  return (
    <div className="animate-pulse space-y-3 border border-card-border rounded-xl p-4">
      <div className="h-4 bg-card-border rounded w-1/3" />
      <div className="h-[200px] bg-card-border/50 rounded" />
    </div>
  );
}

// ============================================================
// Vacancy & Rent Section
// ============================================================

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
    <div className="space-y-4">
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

      {/* Closing: The Full Chain */}
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
    </div>
  );
}

// ============================================================
// Page
// ============================================================

export default function VacancyRentLessonPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
      <LessonSection title="Step 6 — Supply Meets Demand: Vacancy & Rent">
        <Suspense fallback={<LoadingCard />}>
          <VacancyRentSection />
        </Suspense>
      </LessonSection>

      <LessonCompleteButton moduleSlug="housing-machine" lessonSlug="vacancy-rent" />
    </main>
  );
}
