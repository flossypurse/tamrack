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
import { Users } from "lucide-react";
import { LessonCompleteButton } from "@/components/learn-lesson-complete";

// ============================================================
// Metadata
// ============================================================

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Crime & Economics — Safety & Prosperity — Pulse Learn",
  description:
    "How crime, health, and economic conditions move together with predictable time lags. The Crime Severity Index explained, the economy-crime connection traced with live data.",
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
// Section: Crime Severity Index
// ============================================================

async function CrimeSeveritySection() {
  const csiRaw = await fetchRegionalIndicator("Crime Severity Index").catch(() => []);

  const csiData: RegionalPoint[] = csiRaw.map((d) => ({
    municipality: d.municipality,
    period: d.period,
    value: d.value,
  }));

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
// Section: Economy-Crime Connection
// ============================================================

async function EconomyCrimeSection() {
  const [unemployment, weeklyEarnings, csiRaw] = await Promise.all([
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
    fetchRegionalIndicator("Crime Severity Index").catch(() => []),
  ]);

  const unempTimeRange = computeTimeRange(unemployment);
  const unempTrend = computeDirection(unemployment);
  const earningsTrend = computeDirection(weeklyEarnings);

  const edmontonCsi = csiRaw
    .filter((d) => d.municipality.toLowerCase() === "edmonton")
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((d) => ({ date: d.period, value: d.value }));

  const csiByYear = new Map<string, number>();
  for (const d of edmontonCsi) {
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
          timeLag="3-6 months"
        />
        <ChainStep
          number={3}
          title="Social disorder increases"
          description="Substance use escalates, homelessness becomes more visible, disorder calls to police rise. Mental health services see growing demand. Community spaces feel different."
          timeLag="6-9 months"
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
// Page
// ============================================================

export default function CrimeEconomicsPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
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

      {/* Crime Severity Index */}
      <LessonSection title="The Crime Severity Index — What It Actually Measures">
        <Suspense fallback={<LoadingCard />}>
          <CrimeSeveritySection />
        </Suspense>
      </LessonSection>

      {/* Economy-Crime Connection */}
      <LessonSection title="The Economy-Crime Connection">
        <Suspense fallback={<LoadingCard />}>
          <EconomyCrimeSection />
        </Suspense>
      </LessonSection>

      <SoWhat>
        Crime is a lagging indicator of economic health. The CSI tells you what
        already happened. Employment data tells you what is about to happen to
        crime — with a 6-12 month lag. If you want to predict safety trends,
        watch the economy first.
      </SoWhat>

      <LessonCompleteButton moduleSlug="safety-prosperity" lessonSlug="crime-economics" />

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Alberta Pulse Check &mdash; Crime &amp; Economics &mdash; All data
        from free public APIs
      </footer>
    </main>
  );
}
