import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader } from "@/components/card";
import {
  MultiSeriesLineChart,
  type MultiSeriesPoint,
  type SeriesConfig,
} from "@/components/chart";
import { ChartCard } from "@/components/chart-card";
import { computeTimeRange } from "@/lib/time-range";
import { type TimeSeriesPoint } from "@/lib/data-sources";
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
import { Users, Shield, TrendingUp } from "lucide-react";
import { LessonCompleteButton } from "@/components/learn-lesson-complete";

// ============================================================
// Metadata
// ============================================================

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Health & Prosperity — Safety & Prosperity",
  description:
    "Life expectancy as the ultimate community health metric. How to read safety data without falling into common pitfalls. What actually reduces crime.",
};

// ============================================================
// Constants
// ============================================================

const COMPARISON_CITIES = [
  "Edmonton",
  "Calgary",
  "Lethbridge",
  "Red Deer",
  "Grande Prairie",
  "Medicine Hat",
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

function toChartSeries(
  allData: RegionalPoint[],
  municipality: string
): TimeSeriesPoint[] {
  return allData
    .filter((d) => d.municipality.toLowerCase() === municipality.toLowerCase())
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((d) => ({ date: d.period, value: d.value }));
}

// ============================================================
// Section: Life Expectancy
// ============================================================

async function LifeExpectancySection() {
  const lifeExpRaw = await fetchRegionalIndicator("Life Expectancy").catch(() => []);

  const lifeExpData: RegionalPoint[] = lifeExpRaw.map((d) => ({
    municipality: d.municipality,
    period: d.period,
    value: d.value,
  }));

  const dateSet = new Set<string>();
  for (const city of COMPARISON_CITIES) {
    for (const d of lifeExpData.filter(
      (r) => r.municipality.toLowerCase() === city.toLowerCase()
    )) {
      dateSet.add(d.period);
    }
  }

  const sortedDates = [...dateSet].sort();

  const cityMap = new Map<string, Map<string, number>>();
  for (const city of COMPARISON_CITIES) {
    const map = new Map<string, number>();
    for (const d of lifeExpData.filter(
      (r) => r.municipality.toLowerCase() === city.toLowerCase()
    )) {
      map.set(d.period, d.value);
    }
    cityMap.set(city, map);
  }

  const lifeExpChartData: MultiSeriesPoint[] = sortedDates.map((date) => {
    const point: MultiSeriesPoint = { date };
    for (const city of COMPARISON_CITIES) {
      const val = cityMap.get(city)?.get(date);
      if (val !== undefined) {
        point[city.toLowerCase().replace(/\s+/g, "_")] = val;
      }
    }
    return point;
  });

  const lifeExpColors = ["#10b981", "#3b82f6", "#8b5cf6", "#f97316", "#ef4444", "#eab308"];
  const lifeExpSeries: SeriesConfig[] = COMPARISON_CITIES.map((city, i) => ({
    key: city.toLowerCase().replace(/\s+/g, "_"),
    label: city,
    color: lifeExpColors[i],
    suffix: " yrs",
  }));

  const edmontonLE = toChartSeries(lifeExpData, "Edmonton");
  const timeRange = computeTimeRange(edmontonLE);

  return (
    <div className="space-y-4">
      <Prose>
        <p>
          If you could only look at ONE number to understand the health of a
          community, life expectancy is the number. It captures everything:
          income levels, healthcare access, environmental quality, safety,
          nutrition, social cohesion, substance use, housing stability, and
          stress. A community where people live longer is a community where more
          things are going right.
        </p>
        <p>
          The differences between Alberta municipalities are smaller than you
          might expect — typically 2 to 5 years. But those &ldquo;small&rdquo;
          gaps represent enormous differences in underlying conditions. A 2-year
          gap in life expectancy between two cities tells you that residents in
          one community are systematically exposed to worse conditions across
          multiple dimensions.
        </p>
      </Prose>

      <Card>
        <CardHeader
          title="Life Expectancy — Alberta Cities"
          subtitle="Years of expected life at birth — the ultimate community health metric"
          badge="LIVE"
          freshness="daily"
        />
        <ChartCard
          chartId="learn-safety-life-expectancy"
          title="Life Expectancy — Alberta Cities"
          timeRange={timeRange}
          source="Alberta Regional Dashboard"
        >
          <MultiSeriesLineChart
            data={lifeExpChartData}
            series={lifeExpSeries}
            height={280}
          />
        </ChartCard>
      </Card>

      <DataGrid>
        {COMPARISON_CITIES.map((city) => {
          const latest = extractLatest(lifeExpData, city);
          return latest ? (
            <LiveDataPoint
              key={city}
              label={city}
              value={`${latest.value.toFixed(1)} yrs`}
              source={`${latest.period}`}
            />
          ) : null;
        })}
      </DataGrid>

      <Insight>
        A 2-year gap in life expectancy between municipalities tells you more
        about underlying conditions than any single economic indicator. It is
        the sum of every advantage and disadvantage a community offers its
        residents, compressed into a single number. When life expectancy is
        declining, something fundamental is going wrong.
      </Insight>
    </div>
  );
}

// ============================================================
// Section: Reading Safety Data Like an Analyst
// ============================================================

async function ReadingSafetyDataSection() {
  const [populationRaw, csiRaw] = await Promise.all([
    fetchRegionalIndicator("Population").catch(() => []),
    fetchRegionalIndicator("Crime Severity Index").catch(() => []),
  ]);

  const popData: RegionalPoint[] = populationRaw.map((d) => ({
    municipality: d.municipality,
    period: d.period,
    value: d.value,
  }));

  const csiData: RegionalPoint[] = csiRaw.map((d) => ({
    municipality: d.municipality,
    period: d.period,
    value: d.value,
  }));

  return (
    <div className="space-y-4">
      <Prose>
        <p>
          Crime data is routinely misinterpreted — in media, in politics, and
          in daily conversation. Here are the three most common pitfalls and how
          to avoid them:
        </p>
      </Prose>

      <div className="space-y-4">
        <Card>
          <div className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-blue-400" />
              <h4 className="text-sm font-medium text-foreground">
                Pitfall 1: Absolute Numbers vs. Per-Capita Rates
              </h4>
            </div>
            <Prose>
              <p>
                A city of 1 million with 1,000 reported incidents and a town of
                10,000 with 10 incidents have the <em>exact same crime rate</em>.
                But the headline &ldquo;City reports 1,000 crimes&rdquo; sounds
                100x worse than &ldquo;Town reports 10 crimes.&rdquo; Always
                divide by population. Always.
              </p>
            </Prose>
            <DataGrid>
              {["Edmonton", "Medicine Hat"].map((city) => {
                const pop = extractLatest(popData, city);
                const csi = extractLatest(csiData, city);
                return pop && csi ? (
                  <LiveDataPoint
                    key={city}
                    label={`${city}`}
                    value={`Pop: ${(pop.value / 1000).toFixed(0)}K | CSI: ${csi.value.toFixed(0)}`}
                    source="Regional Dashboard"
                  />
                ) : null;
              })}
            </DataGrid>
          </div>
        </Card>

        <Card>
          <div className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-amber-400" />
              <h4 className="text-sm font-medium text-foreground">
                Pitfall 2: Reporting Changes Disguised as Crime Changes
              </h4>
            </div>
            <Prose>
              <p>
                When a municipality hires more police officers or launches a new
                reporting system, <em>more crimes get reported</em>. The CSI goes
                up — not because the community is less safe, but because
                previously unreported incidents are now entering the system. A
                spike in reported crime can actually be a sign of
                <em> better</em> policing, not worse conditions.
              </p>
            </Prose>
          </div>
        </Card>

        <Card>
          <div className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-green-400" />
              <h4 className="text-sm font-medium text-foreground">
                Pitfall 3: Seasonal Patterns
              </h4>
            </div>
            <Prose>
              <p>
                Crime peaks in summer and drops in winter — almost everywhere,
                every year. People are outside more, daylight hours are longer,
                social gatherings are more frequent, and alcohol consumption
                rises. A July crime spike compared to January is not a trend.
                It&apos;s a season. Compare July to the <em>previous</em> July
                to see actual trends.
              </p>
            </Prose>
          </div>
        </Card>
      </div>

      <Insight variant="warning">
        Never compare a city&apos;s absolute crime numbers to a smaller
        municipality without adjusting for population. Per-capita rates are the
        only fair comparison. A small city with 50 violent incidents and 20,000
        residents has a <em>higher</em> violent crime rate than a large city
        with 500 incidents and 1,000,000 residents.
      </Insight>
    </div>
  );
}

// ============================================================
// Page
// ============================================================

export default function HealthOutcomesPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
      <BigQuestion>What is the single best measure of community health?</BigQuestion>

      <Prose>
        <p>
          Health data and safety data are deeply intertwined. Communities with
          strong economies tend to have better health outcomes and lower crime.
          This lesson explores the ultimate outcome measure — life expectancy —
          and teaches you how to read safety data without falling into the most
          common traps.
        </p>
      </Prose>

      {/* Life Expectancy */}
      <LessonSection title="Life Expectancy — The Ultimate Outcome Measure">
        <Suspense fallback={<LoadingCard />}>
          <LifeExpectancySection />
        </Suspense>
      </LessonSection>

      {/* Reading Safety Data */}
      <LessonSection title="Reading Safety Data Like an Analyst">
        <Suspense fallback={<LoadingCard />}>
          <ReadingSafetyDataSection />
        </Suspense>
      </LessonSection>

      <SoWhat>
        Life expectancy is the sum of everything a community does right or
        wrong, compressed into a single number. And crime data is one of
        the most misinterpreted datasets in public life. Per-capita rates,
        not absolute numbers. Year-over-year, not month-over-month. Context
        always — a CSI spike might be one severe incident, not a crime wave.
      </SoWhat>

      <LessonCompleteButton moduleSlug="safety-prosperity" lessonSlug="health-outcomes" />

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Tamrack &mdash; Health &amp; Prosperity &mdash; All data
        from free public APIs
      </footer>
    </main>
  );
}
