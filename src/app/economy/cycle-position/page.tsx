import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader } from "@/components/card";
import { ChartCard } from "@/components/chart-card";
import { computeTimeRange } from "@/lib/time-range";
import {
  CycleRadarChart,
  CycleTimelineChart,
  type RadarDataPoint,
  type MultiSeriesPoint,
  type CyclePeriodRegion,
} from "@/components/chart";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import { Clock, Radar, TrendingUp, History, BookOpen } from "lucide-react";
import {
  computeCyclePosition,
  CYCLE_PERIODS,
  CYCLE_INDICATORS,
  type CyclePositionResult,
} from "@/lib/cycle-engine";
import { SITE_URL } from "@/lib/constants/site";

export const metadata: Metadata = {
  title: "Cycle Positioning — Where Is Alberta Right Now?",
  description:
    "10-dimension economic fingerprint compared against five historical Alberta periods. See which era today most resembles and what happened next.",
  alternates: {
    canonical: `${SITE_URL}/economy/cycle-position`,
  },
};

// ============================================================
// Signal colors (reused from risk page pattern)
// ============================================================

const matchColors: Record<string, string> = {
  "boom-2005-2008": "text-green-400",
  "crash-2008-2009": "text-red-400",
  "oil-crash-2014-2016": "text-orange-400",
  "covid-2020-2021": "text-purple-400",
  "recovery-2022-2024": "text-blue-400",
};

const matchBg: Record<string, string> = {
  "boom-2005-2008": "bg-green-400/10",
  "crash-2008-2009": "bg-red-400/10",
  "oil-crash-2014-2016": "bg-orange-400/10",
  "covid-2020-2021": "bg-purple-400/10",
  "recovery-2022-2024": "bg-blue-400/10",
};

// ============================================================
// Async server components
// ============================================================

async function CycleOverview() {
  const result = await computeCyclePosition();
  const best = result.bestMatch;
  const similarityPct = Math.round(best.similarity * 100);

  return (
    <div className="space-y-4">
      {/* Hero card */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <p className="text-xs text-muted mb-1">Current conditions most resemble</p>
            <h3 className={`text-xl font-bold ${matchColors[best.period.id] || "text-foreground"}`}>
              {best.period.label}
            </h3>
            <p className="text-sm text-muted mt-1 max-w-lg">{best.period.description}</p>
          </div>
          <div className="text-right shrink-0">
            <div className={`text-4xl font-bold ${matchColors[best.period.id] || "text-foreground"}`}>
              {similarityPct}%
            </div>
            <p className="text-xs text-muted">similarity</p>
          </div>
        </div>

        {/* What happened next callout */}
        <div className={`rounded-lg p-3 ${matchBg[best.period.id] || "bg-accent/10"}`}>
          <p className="text-xs font-medium text-foreground mb-1">What happened next:</p>
          <p className="text-sm text-muted">{best.period.whatHappenedNext}</p>
        </div>
      </Card>

      {/* Period similarity cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {result.matches.map((match) => {
          const pct = Math.round(match.similarity * 100);
          const isBest = match.period.id === best.period.id;
          return (
            <Card key={match.period.id} className={isBest ? "ring-1 ring-accent/30" : ""}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium truncate">{match.period.shortLabel}</p>
                {isBest && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-mono">
                    BEST
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className={`text-xl font-bold ${matchColors[match.period.id] || "text-foreground"}`}>
                  {pct}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-card-border rounded-full overflow-hidden mb-2">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: match.period.color }}
                />
              </div>
              <p className="text-[10px] text-muted">{match.period.startDate} – {match.period.endDate}</p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

async function RadarOverlay() {
  const result = await computeCyclePosition();
  const best = result.bestMatch;

  const radarData: RadarDataPoint[] = CYCLE_INDICATORS.map((ind, i) => ({
    indicator: ind.shortLabel,
    current: result.current.zScores[i],
    historical: best.periodFingerprint.zScores[i],
  }));

  return (
    <Card>
      <CardHeader
        title="Economic Fingerprint"
        subtitle={`Current Alberta economy (blue) overlaid with ${best.period.shortLabel} average (orange). Each axis is a z-score: 0 = historical mean, ±2 = two standard deviations. Built from 10 BoC and StatsCan indicators with 20 years of monthly history.`}
        badge="LIVE"
        freshness="daily"
      />
      <CycleRadarChart
        data={radarData}
        currentLabel="Today"
        historicalLabel={best.period.shortLabel}
        currentColor="#3b82f6"
        historicalColor={best.period.color}
        height={380}
      />
    </Card>
  );
}

async function WhatHappenedNextTable() {
  const result = await computeCyclePosition();
  const best = result.bestMatch;
  const rows = result.whatHappenedNext;

  function formatDelta(base: number | null, future: number | null, unit: string): string {
    if (base == null || future == null) return "—";
    const diff = future - base;
    const sign = diff >= 0 ? "+" : "";
    if (unit === "%" || unit === "idx") return `${sign}${diff.toFixed(1)}`;
    if (unit === "$" || unit === "$K") return `${sign}$${Math.round(diff).toLocaleString()}`;
    return `${sign}${Math.round(diff).toLocaleString()}`;
  }

  function deltaColor(base: number | null, future: number | null, indicator: string): string {
    if (base == null || future == null) return "text-muted";
    const diff = future - base;
    // For unemployment, higher = bad. For most others, higher = good.
    const isInverse = indicator.includes("Unemp") || indicator.includes("Mortgage");
    if (diff === 0) return "text-muted";
    if (isInverse) return diff > 0 ? "text-accent-red" : "text-accent-green";
    return diff > 0 ? "text-accent-green" : "text-accent-red";
  }

  return (
    <Card>
      <CardHeader
        title={`After the ${best.period.shortLabel}`}
        subtitle="What happened to each indicator 6, 12, and 18 months after this period ended."
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-card-border">
              <th className="text-left text-xs text-muted font-medium py-2 pr-4">Indicator</th>
              <th className="text-right text-xs text-muted font-medium py-2 px-2">At End</th>
              <th className="text-right text-xs text-muted font-medium py-2 px-2">+6mo</th>
              <th className="text-right text-xs text-muted font-medium py-2 px-2">+12mo</th>
              <th className="text-right text-xs text-muted font-medium py-2 px-2">+18mo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.indicator} className="border-b border-card-border/50">
                <td className="py-2 pr-4 text-xs font-medium">{row.shortLabel}</td>
                <td className="py-2 px-2 text-right text-xs text-muted font-mono">
                  {row.valueAtEnd != null ? row.valueAtEnd.toFixed(1) : "—"}
                </td>
                <td className={`py-2 px-2 text-right text-xs font-mono ${deltaColor(row.valueAtEnd, row.valueAfter6mo, row.shortLabel)}`}>
                  {formatDelta(row.valueAtEnd, row.valueAfter6mo, row.unit)}
                </td>
                <td className={`py-2 px-2 text-right text-xs font-mono ${deltaColor(row.valueAtEnd, row.valueAfter12mo, row.shortLabel)}`}>
                  {formatDelta(row.valueAtEnd, row.valueAfter12mo, row.unit)}
                </td>
                <td className={`py-2 px-2 text-right text-xs font-mono ${deltaColor(row.valueAtEnd, row.valueAfter18mo, row.shortLabel)}`}>
                  {formatDelta(row.valueAtEnd, row.valueAfter18mo, row.unit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted/60 mt-3">
        Deltas show change from period end. Green = improvement, red = deterioration (inverted for unemployment &amp; mortgage rate).
      </p>
    </Card>
  );
}

async function TimelineChart() {
  const result = await computeCyclePosition();

  // Build merged data: unemployment + energy index on dual axis
  const unempSeries = result.historicalSeries["unemployment"] || [];
  const energySeries = result.historicalSeries["energy_index"] || [];

  const dateMap = new Map<string, MultiSeriesPoint>();
  for (const p of energySeries) {
    const month = p.date.slice(0, 7);
    dateMap.set(month, { date: `${month}-01`, energy: p.value, unemployment: 0 });
  }
  for (const p of unempSeries) {
    const month = p.date.slice(0, 7);
    const existing = dateMap.get(month);
    if (existing) {
      existing.unemployment = p.value;
    } else {
      dateMap.set(month, { date: `${month}-01`, energy: 0, unemployment: p.value });
    }
  }
  const merged = Array.from(dateMap.values())
    .filter(
      (p) =>
        typeof p.energy === "number" &&
        typeof p.unemployment === "number" &&
        (p.energy as number) > 0 &&
        (p.unemployment as number) > 0
    )
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const periodRegions: CyclePeriodRegion[] = CYCLE_PERIODS.map((p) => ({
    id: p.id,
    startDate: `${p.startDate}-01`,
    endDate: `${p.endDate}-01`,
    color: p.color,
    label: p.shortLabel,
  }));

  const timeRange = computeTimeRange(merged);

  return (
    <ChartCard
      chartId="cycle-timeline"
      title="Alberta Economic Cycle Timeline"
      timeRange={timeRange}
      source="Bank of Canada / StatsCan"
    >
      <Card>
        <CardHeader
          title="You Are Here"
          subtitle="Energy commodity index vs unemployment rate with historical periods shaded. Each colored band is one of the five reference periods."
          badge="LIVE"
        />
        <CycleTimelineChart
          data={merged}
          series={[
            { key: "energy", label: "Energy Index", color: "#f97316", yAxisId: "left" },
            {
              key: "unemployment",
              label: "Unemployment %",
              color: "#ef4444",
              suffix: "%",
              yAxisId: "right",
            },
          ]}
          periods={periodRegions}
          height={320}
          dualAxis
        />
        {/* Period legend */}
        <div className="flex flex-wrap gap-3 mt-3">
          {CYCLE_PERIODS.map((p) => (
            <div key={p.id} className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: p.color, opacity: 0.5 }}
              />
              <span className="text-[10px] text-muted">{p.shortLabel}</span>
            </div>
          ))}
        </div>
      </Card>
    </ChartCard>
  );
}

async function CurrentValues() {
  const result = await computeCyclePosition();

  return (
    <Card>
      <CardHeader
        title="Current Indicator Values"
        subtitle="The 10 indicators that make up today's economic fingerprint, with their z-scores."
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {CYCLE_INDICATORS.map((ind, i) => {
          const raw = result.current.rawValues[i];
          const z = result.current.zScores[i];
          const zColor =
            Math.abs(z) > 2 ? "text-accent-red" :
            Math.abs(z) > 1 ? "text-amber-400" :
            "text-accent-green";

          return (
            <div key={ind.id} className="border border-card-border rounded-lg p-2.5">
              <p className="text-[10px] text-muted mb-1 truncate">{ind.shortLabel}</p>
              <p className="text-sm font-semibold font-mono">
                {ind.unit === "%" ? `${raw.toFixed(1)}%` :
                 ind.unit === "$" ? `$${Math.round(raw).toLocaleString()}` :
                 ind.unit === "$K" ? `$${(raw / 1000).toFixed(1)}K` :
                 ind.unit === "K" ? `${(raw / 1000).toFixed(1)}K` :
                 raw.toFixed(1)}
              </p>
              <p className={`text-[10px] font-mono ${zColor}`}>
                z = {z >= 0 ? "+" : ""}{z.toFixed(2)}
              </p>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-muted/60 mt-3">
        Z-score: 0 = historical mean. Green = within 1σ (normal). Amber = 1-2σ (notable). Red = &gt;2σ (extreme).
      </p>
    </Card>
  );
}

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
// Page
// ============================================================

export default function CyclePositionPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Cycle Positioning"
        description="A 10-dimension fingerprint of Alberta's economy compared against five historical periods. See which era today most resembles — and what happened next."
        category="intelligence"
        icon={<Clock size={20} />}
      >
        <div className="flex flex-wrap gap-2">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-mono">INVESTORS</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 font-mono">DEVELOPERS</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 font-mono">ANALYSTS</span>
        </div>
      </PageHeader>

      {/* Cycle Position Overview */}
      <section>
        <SectionHeader title="Where Are We?" icon={<Clock size={16} />} category="intelligence" />
        <Suspense
          fallback={
            <div className="space-y-4">
              <LoadingCard />
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                {[...Array(5)].map((_, i) => (
                  <Card key={i}>
                    <div className="animate-pulse space-y-2">
                      <div className="h-3 bg-card-border rounded w-1/2" />
                      <div className="h-7 bg-card-border rounded w-1/3" />
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          }
        >
          <CycleOverview />
        </Suspense>
      </section>

      {/* Radar Chart */}
      <section>
        <SectionHeader title="Fingerprint Overlay" icon={<Radar size={16} />} category="intelligence" />
        <Suspense fallback={<LoadingCard />}>
          <RadarOverlay />
        </Suspense>
      </section>

      {/* Current Values */}
      <section>
        <SectionHeader title="Today's Readings" icon={<TrendingUp size={16} />} category="intelligence" />
        <Suspense fallback={<LoadingCard />}>
          <CurrentValues />
        </Suspense>
      </section>

      {/* What Happened Next */}
      <section>
        <SectionHeader title="Historical Outcome" icon={<History size={16} />} category="intelligence" />
        <Suspense fallback={<LoadingCard />}>
          <WhatHappenedNextTable />
        </Suspense>
      </section>

      {/* Timeline */}
      <section>
        <SectionHeader title="20-Year Timeline" icon={<TrendingUp size={16} />} category="intelligence" />
        <Suspense fallback={<LoadingCard />}>
          <TimelineChart />
        </Suspense>
      </section>

      {/* Methodology */}
      <section>
        <SectionHeader title="Methodology" icon={<BookOpen size={16} />} category="intelligence" />
        <Card>
          <h3 className="text-sm font-medium mb-2">How This Works</h3>
          <div className="text-xs text-muted space-y-2">
            <p>The cycle engine computes a <strong className="text-foreground">10-dimension fingerprint</strong> of Alberta&apos;s economy using live data from the Bank of Canada and Statistics Canada:</p>
            <ol className="list-decimal pl-4 space-y-1">
              <li>Fetch 20 years of monthly data for each indicator (BoC Valet + StatsCan WDS)</li>
              <li>Compute the historical mean and standard deviation for each indicator</li>
              <li>Convert the current 3-month average to <strong className="text-foreground">z-scores</strong> (standard deviations from the mean)</li>
              <li>Compute the average z-score vector for each of the five historical periods</li>
              <li>Measure <strong className="text-foreground">cosine similarity</strong> between today&apos;s vector and each historical vector</li>
              <li>For the best match, look up what happened to each indicator 6/12/18 months after that period ended</li>
            </ol>
            <p className="mt-2"><strong className="text-foreground">The 10 indicators:</strong></p>
            <ul className="list-disc pl-4 space-y-0.5">
              {CYCLE_INDICATORS.map((ind) => (
                <li key={ind.id}>{ind.label} ({ind.source === "boc" ? "Bank of Canada" : "Statistics Canada"})</li>
              ))}
            </ul>
            <p className="mt-2"><strong className="text-foreground">Important caveats:</strong></p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Historical patterns are informative, not predictive. Alberta&apos;s economy has structural differences today (TMX operational, immigration at record levels, diversification progress).</li>
              <li>Cosine similarity measures directional resemblance — which indicators are high/low relative to their history — not exact magnitude.</li>
              <li>GDP data is quarterly and interpolated. All other indicators are monthly.</li>
            </ul>
            <p className="text-muted/60 mt-2">Data refreshes hourly. All sources are public and free.</p>
          </div>
        </Card>
      </section>
    </main>
  );
}
