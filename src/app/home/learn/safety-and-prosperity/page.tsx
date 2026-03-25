import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader } from "@/components/card";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import {
  TimeSeriesAreaChart,
  MultiSeriesLineChart,
  type MultiSeriesPoint,
  type SeriesConfig,
} from "@/components/chart";
import { ChartCard } from "@/components/chart-card";
import { computeTimeRange } from "@/lib/time-range";
import {
  fetchBoCTimeSeries,
  fetchStatCanTimeSeries,
  BOC_SERIES,
  STATSCAN_SERIES,
  type TimeSeriesPoint,
} from "@/lib/data-sources";
import { fetchRegionalIndicator, REGIONAL_INDICATORS } from "@/lib/data-sources-regional";
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
import { Shield, HeartPulse, TrendingUp, AlertTriangle, Users, DollarSign } from "lucide-react";

// ============================================================
// Metadata
// ============================================================

export const metadata: Metadata = {
  title: "Safety & Prosperity — Learn — Alberta Pulse Check",
  description:
    "How crime, health, and economic conditions move together with predictable time lags. Live data from StatsCan, Alberta Regional Dashboard, and Bank of Canada.",
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
// Helper: compute direction from recent data
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
// Helper: extract latest value for a municipality from regional data
// ============================================================

interface RegionalPoint {
  municipality: string;
  period: string;
  value: number;
}

function extractLatest(
  allData: { municipality: string; period: string; value: number }[],
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
// Helper: convert regional data for one municipality to chart format
// ============================================================

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
// Section 1: Crime Severity Index — What It Actually Measures
// ============================================================

async function CrimeSeveritySection() {
  const csiRaw = await fetchRegionalIndicator("Crime Severity Index").catch(() => []);

  // Normalize to simple format
  const csiData: RegionalPoint[] = csiRaw.map((d) => ({
    municipality: d.municipality,
    period: d.period,
    value: d.value,
  }));

  // Build multi-series chart: CSI over time for comparison cities
  const dateSet = new Set<string>();
  for (const city of COMPARISON_CITIES) {
    for (const d of csiData.filter(
      (r) => r.municipality.toLowerCase() === city.toLowerCase()
    )) {
      dateSet.add(d.period);
    }
  }

  const sortedDates = [...dateSet].sort();

  const cityMap = new Map<string, Map<string, number>>();
  for (const city of COMPARISON_CITIES) {
    const map = new Map<string, number>();
    for (const d of csiData.filter(
      (r) => r.municipality.toLowerCase() === city.toLowerCase()
    )) {
      map.set(d.period, d.value);
    }
    cityMap.set(city, map);
  }

  const csiChartData: MultiSeriesPoint[] = sortedDates.map((date) => {
    const point: MultiSeriesPoint = { date };
    for (const city of COMPARISON_CITIES) {
      const val = cityMap.get(city)?.get(date);
      if (val !== undefined) {
        point[city.toLowerCase().replace(/\s+/g, "_")] = val;
      }
    }
    return point;
  });

  const csiColors = ["#ef4444", "#f97316", "#eab308", "#3b82f6", "#8b5cf6", "#10b981"];
  const csiSeries: SeriesConfig[] = COMPARISON_CITIES.map((city, i) => ({
    key: city.toLowerCase().replace(/\s+/g, "_"),
    label: city,
    color: csiColors[i],
  }));

  const edmontonCsi = toChartSeries(csiData, "Edmonton");
  const timeRange = computeTimeRange(edmontonCsi);

  return (
    <div className="space-y-4">
      <Prose>
        <p>
          The Crime Severity Index (CSI) is Canada&apos;s best measure of crime
          intensity. Unlike a simple count of incidents, the CSI weights every
          offence by its severity — derived from actual sentencing data. One
          homicide moves the index more than a hundred shoplifting charges. This
          means a single severe event in a small city can spike the CSI even
          when day-to-day crime is unchanged.
        </p>
        <p>
          Statistics Canada publishes the CSI for every municipality in the
          country. Here&apos;s how Alberta&apos;s major cities compare over time:
        </p>
      </Prose>

      <Card>
        <CardHeader
          title="Crime Severity Index — Alberta Cities"
          subtitle="Higher values indicate more severe crime burden (weighted by sentencing)"
          badge="LIVE"
          freshness="daily"
        />
        <ChartCard
          chartId="learn-safety-csi-comparison"
          title="Crime Severity Index — Alberta Cities"
          timeRange={timeRange}
          source="Alberta Regional Dashboard"
        >
          <MultiSeriesLineChart
            data={csiChartData}
            series={csiSeries}
            height={300}
          />
        </ChartCard>
      </Card>

      <DataGrid>
        {COMPARISON_CITIES.map((city) => {
          const latest = extractLatest(csiData, city);
          return latest ? (
            <LiveDataPoint
              key={city}
              label={`${city} CSI`}
              value={latest.value.toFixed(1)}
              source={`${latest.period}`}
            />
          ) : null;
        })}
      </DataGrid>

      <Insight>
        A rising CSI might mean one severe incident, not a broad crime wave.
        Always look at the underlying breakdown before drawing conclusions. A
        city with a CSI of 120 isn&apos;t necessarily &ldquo;more dangerous&rdquo;
        than one at 80 — the higher number could reflect a single tragic event
        rather than widespread day-to-day risk.
      </Insight>

      <Expandable title="Why not just count crimes?">
        <Prose>
          <p>
            Raw crime counts are misleading in two directions. First, they
            don&apos;t account for population — a city of 1 million with 1,000
            incidents has the same rate as a town of 10,000 with 10. Second,
            they treat all crimes equally. The CSI fixes both problems: it&apos;s
            per-capita AND severity-weighted. A single metric that actually
            reflects how much harm is occurring in a community.
          </p>
        </Prose>
      </Expandable>
    </div>
  );
}

// ============================================================
// Section 2: The Economy-Crime Connection
// ============================================================

async function EconomyCrimeSection() {
  const [unemployment, weeklyEarnings, cpi, csiRaw] = await Promise.all([
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.tableId,
      STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.coordinate,
      120
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_WEEKLY_EARNINGS.tableId,
      STATSCAN_SERIES.AB_WEEKLY_EARNINGS.coordinate,
      120
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_CPI.tableId,
      STATSCAN_SERIES.AB_CPI.coordinate,
      120
    ).catch(() => []),
    fetchRegionalIndicator("Crime Severity Index").catch(() => []),
  ]);

  const unempTimeRange = computeTimeRange(unemployment);
  const unempTrend = computeDirection(unemployment);
  const earningsTrend = computeDirection(weeklyEarnings);

  // Edmonton CSI as a representative series, aligned with unemployment by year
  const edmontonCsi = csiRaw
    .filter((d) => d.municipality.toLowerCase() === "edmonton")
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((d) => ({ date: d.period, value: d.value }));

  // Build dual-axis: unemployment (monthly) vs Edmonton CSI (annual)
  // We'll expand CSI annual values across months for visual alignment
  const csiByYear = new Map<string, number>();
  for (const d of edmontonCsi) {
    // period might be "2019" or "2019-01"
    const year = d.date.slice(0, 4);
    csiByYear.set(year, d.value);
  }

  const dateMap = new Map<string, { unemployment?: number; csi?: number }>();
  for (const p of unemployment) {
    const key = p.date.slice(0, 7);
    const year = p.date.slice(0, 4);
    const existing = dateMap.get(key) || {};
    existing.unemployment = p.value;
    if (csiByYear.has(year)) {
      existing.csi = csiByYear.get(year);
    }
    dateMap.set(key, existing);
  }

  const combinedData: MultiSeriesPoint[] = [...dateMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([, v]) => v.unemployment !== undefined)
    .map(([date, v]) => ({
      date: `${date}-01`,
      unemployment: v.unemployment!,
      ...(v.csi !== undefined ? { csi: v.csi } : {}),
    }));

  const combinedSeries: SeriesConfig[] = [
    {
      key: "unemployment",
      label: "AB Unemployment Rate",
      color: "#3b82f6",
      suffix: "%",
      yAxisId: "left",
    },
    {
      key: "csi",
      label: "Edmonton CSI",
      color: "#ef4444",
      yAxisId: "right",
    },
  ];

  return (
    <div className="space-y-4">
      <Prose>
        <p>
          The link between economic conditions and crime is one of the
          best-documented relationships in criminology. But it doesn&apos;t work
          the way most people assume. Crime doesn&apos;t spike the instant
          unemployment rises. There are predictable <strong>time lags</strong>,
          and understanding them is the difference between reading the data and
          misreading the data.
        </p>
        <p>
          When the economy weakens, the cascade follows a pattern that has
          repeated across every recession in Alberta&apos;s history:
        </p>
      </Prose>

      <div className="space-y-0">
        <ChainStep
          number={1}
          title="Economic downturn begins"
          description="Layoffs start, hours get cut, overtime disappears. Household budgets tighten. Some families fall behind on rent and bills."
          timeLag="Immediate"
        />
        <ChainStep
          number={2}
          title="Property crime rises"
          description="Theft, break-ins, shoplifting, and fraud increase as financial desperation grows. This is the first crime signal — and it typically appears 3-6 months after the economic shock."
          timeLag="3–6 months"
        />
        <ChainStep
          number={3}
          title="Social disorder increases"
          description="Substance use escalates, homelessness becomes more visible, disorder calls to police rise. Mental health services see growing demand. Community spaces feel different."
          timeLag="6–9 months"
        />
        <ChainStep
          number={4}
          title="Violent crime may increase"
          description="Desperation, substance-fueled incidents, and weakened social bonds can push violent crime upward. This is the last domino — and the hardest to reverse."
          timeLag="12+ months"
        />
      </div>

      <Card>
        <CardHeader
          title="Unemployment Rate vs. Crime Severity"
          subtitle="AB unemployment (left) and Edmonton CSI (right) — notice the lag"
          badge="LIVE"
          freshness="daily"
        />
        <ChartCard
          chartId="learn-safety-unemployment-csi"
          title="AB Unemployment vs Edmonton Crime Severity"
          timeRange={unempTimeRange}
          source="StatsCan 14-10-0287, Alberta Regional Dashboard"
        >
          <MultiSeriesLineChart
            data={combinedData}
            series={combinedSeries}
            height={280}
            dualAxis
          />
        </ChartCard>
      </Card>

      <DataGrid>
        <LiveDataPoint
          label="AB Unemployment Rate"
          value={`${unempTrend.latest.toFixed(1)}%`}
          change={unempTrend.change}
          direction={unempTrend.direction}
          source="StatsCan"
        />
        <LiveDataPoint
          label="AB Avg Weekly Earnings"
          value={`$${earningsTrend.latest.toFixed(0)}`}
          change={earningsTrend.change}
          direction={earningsTrend.direction}
          source="StatsCan"
        />
      </DataGrid>

      <Insight variant="watch">
        The reverse is also true. When the economy recovers, crime tends to
        drop — but with the <strong>same lags</strong>. Recovery in crime stats
        is always delayed. If unemployment peaked 6 months ago and is now
        falling, property crime may still be elevated. Patience with the data
        is essential.
      </Insight>

      <Expandable title="Why does property crime lead violent crime?">
        <Prose>
          <p>
            Property crime is an economic act — it rises when people need money
            or resources they can&apos;t obtain through employment. Violent crime
            is driven by different forces: desperation that has deepened over
            months, substance dependencies that have escalated, social bonds that
            have frayed, and mental health crises that went untreated. These take
            longer to develop, which is why violent crime lags property crime by
            6 to 12 additional months.
          </p>
        </Prose>
      </Expandable>
    </div>
  );
}

// ============================================================
// Section 3: Life Expectancy — The Ultimate Outcome Measure
// ============================================================

async function LifeExpectancySection() {
  const lifeExpRaw = await fetchRegionalIndicator("Life Expectancy").catch(() => []);

  const lifeExpData: RegionalPoint[] = lifeExpRaw.map((d) => ({
    municipality: d.municipality,
    period: d.period,
    value: d.value,
  }));

  // Build multi-series chart
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
// Section 4: Reading Safety Data Like an Analyst
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
// Section 5: What Actually Reduces Crime
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

  const unemploymentData: RegionalPoint[] = unemploymentRaw.map((d) => ({
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
        {COMPARISON_CITIES.slice(0, 4).map((city) => {
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
// Closing: So What + LessonNav
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
    <div className="space-y-6">
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

      <LessonNav
        prev={{ href: "/home/learn/people-and-growth", label: "People & Growth" }}
        next={{ href: "/home/learn/community-levers", label: "Community Levers" }}
      />
    </div>
  );
}

// ============================================================
// Page
// ============================================================

export default function SafetyAndProsperityLesson() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
      <PageHeader
        title="Safety & Prosperity"
        description="How crime, health, and economic conditions move together with predictable time lags. Traced with live data from StatsCan, Alberta Regional Dashboard, and Bank of Canada."
        category="learn"
        icon={<Shield size={20} />}
      />

      {/* Opening */}
      <BigQuestion>Is my neighbourhood getting safer or worse?</BigQuestion>

      <Prose>
        <p>
          Crime statistics are one of the most misunderstood data points in
          public discourse. A spike in reported crime doesn&apos;t always mean
          more crime — it can mean better reporting, more police, or changed
          definitions. And most importantly: safety trends and economic trends
          are deeply connected, with predictable time lags that most people
          never learn about.
        </p>
        <p>
          This lesson will show you how to read safety data like an analyst —
          understanding what the numbers actually measure, how they connect to
          the economy, and what drives real, lasting improvements in community
          safety. Every chart uses live data. Every connection is backed by the
          numbers.
        </p>
      </Prose>

      {/* Section 1: Crime Severity Index */}
      <LessonSection title="1. The Crime Severity Index — What It Actually Measures">
        <Suspense fallback={<LoadingCard />}>
          <CrimeSeveritySection />
        </Suspense>
      </LessonSection>

      {/* Section 2: Economy-Crime Connection */}
      <LessonSection title="2. The Economy-Crime Connection">
        <Suspense fallback={<LoadingCard />}>
          <EconomyCrimeSection />
        </Suspense>
      </LessonSection>

      {/* Section 3: Life Expectancy */}
      <LessonSection title="3. Life Expectancy — The Ultimate Outcome Measure">
        <Suspense fallback={<LoadingCard />}>
          <LifeExpectancySection />
        </Suspense>
      </LessonSection>

      {/* Section 4: Reading Safety Data */}
      <LessonSection title="4. Reading Safety Data Like an Analyst">
        <Suspense fallback={<LoadingCard />}>
          <ReadingSafetyDataSection />
        </Suspense>
      </LessonSection>

      {/* Section 5: What Reduces Crime */}
      <LessonSection title="5. What Actually Reduces Crime">
        <Suspense fallback={<LoadingCard />}>
          <CrimeReductionSection />
        </Suspense>
      </LessonSection>

      {/* Closing */}
      <Suspense fallback={<LoadingCard />}>
        <ClosingSection />
      </Suspense>

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Alberta Pulse Check &mdash; Safety &amp; Prosperity &mdash; All data
        from free public APIs
      </footer>
    </main>
  );
}
