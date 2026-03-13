import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import {
  Skull,
  TrendingUp,
  AlertTriangle,
  Hash,
} from "lucide-react";
import {
  fetchLeadingCausesOfDeath,
  type LeadingCauseOfDeath,
} from "@/lib/data-sources-health";

// ============================================================
// Metadata
// ============================================================

export const metadata: Metadata = {
  title: "Alberta Leading Causes of Death — Mortality Trends",
  description:
    "Leading causes of death in Alberta with historical trends. Province-wide data from Alberta Open Data, 2001-2022.",
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
// No Data Fallback
// ============================================================

function NoDataCard() {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="text-accent-amber shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-medium text-foreground">Data Unavailable</h3>
          <p className="text-sm text-muted mt-1 leading-relaxed">
            The Alberta Open Data CSV for leading causes of death could not be loaded.
            This may be a temporary issue with the data source. The CSV is hosted at{" "}
            <span className="font-mono text-xs">open.alberta.ca</span> and covers
            province-wide mortality data from 2001 to 2022.
          </p>
        </div>
      </div>
    </Card>
  );
}

// ============================================================
// Key Metrics
// ============================================================

async function KeyMetrics() {
  const data = await fetchLeadingCausesOfDeath().catch(() => [] as LeadingCauseOfDeath[]);

  if (data.length === 0) {
    return <NoDataCard />;
  }

  const latestYear = Math.max(...data.map((d) => d.year));
  const latestData = data.filter((d) => d.year === latestYear);
  const totalDeaths = latestData.reduce((sum, d) => sum + d.totalDeaths, 0);
  const topCause = latestData.find((d) => d.ranking === 1);
  const uniqueYears = new Set(data.map((d) => d.year));

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <MetricCard
        title="Latest Year"
        value={latestYear.toString()}
        source="Alberta Open Data"
      />
      <MetricCard
        title="Total Deaths (All Causes)"
        value={totalDeaths > 0 ? totalDeaths.toLocaleString() : "—"}
        source="Alberta Open Data"
      />
      <MetricCard
        title="Leading Cause"
        value={topCause ? truncate(topCause.cause, 30) : "—"}
        source="Alberta Open Data"
      />
      <MetricCard
        title="Years of Data"
        value={`${uniqueYears.size} (${Math.min(...uniqueYears)}–${latestYear})`}
        source="Alberta Open Data"
      />
    </div>
  );
}

// ============================================================
// Top Causes Table (latest year)
// ============================================================

async function TopCausesTable() {
  const data = await fetchLeadingCausesOfDeath().catch(() => [] as LeadingCauseOfDeath[]);

  if (data.length === 0) {
    return <NoDataCard />;
  }

  const latestYear = Math.max(...data.map((d) => d.year));
  const latestData = data
    .filter((d) => d.year === latestYear)
    .sort((a, b) => a.ranking - b.ranking);

  const top20 = latestData.slice(0, 20);
  const maxDeaths = Math.max(...top20.map((d) => d.totalDeaths));

  return (
    <Card>
      <CardHeader
        title={`Top Causes of Death — ${latestYear}`}
        subtitle={`${latestData.length} causes tracked, top 20 shown`}
        freshness="daily"
      />
      <div className="space-y-1.5">
        {top20.map((cause) => (
          <div
            key={cause.ranking}
            className="flex items-center gap-3 text-sm group hover:bg-card-border/20 rounded-lg px-2 py-1.5 transition-colors"
          >
            <span className="text-muted font-mono text-xs w-6 text-right shrink-0">
              {cause.ranking}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-foreground text-sm truncate">
                  {cause.cause}
                </span>
              </div>
              <div className="mt-1 h-2 bg-card-border/30 rounded overflow-hidden">
                <div
                  className="h-full bg-accent-red/50 rounded transition-all"
                  style={{ width: `${(cause.totalDeaths / maxDeaths) * 100}%` }}
                />
              </div>
            </div>
            <span className="text-foreground font-mono font-semibold text-sm w-16 text-right shrink-0">
              {cause.totalDeaths.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ============================================================
// Trend: Top 5 Causes Over Time
// ============================================================

async function TopCausesTrend() {
  const data = await fetchLeadingCausesOfDeath().catch(() => [] as LeadingCauseOfDeath[]);

  if (data.length === 0) {
    return null;
  }

  // Find the top 5 causes from the latest year
  const latestYear = Math.max(...data.map((d) => d.year));
  const top5Causes = data
    .filter((d) => d.year === latestYear)
    .sort((a, b) => a.ranking - b.ranking)
    .slice(0, 5)
    .map((d) => d.cause);

  if (top5Causes.length === 0) return null;

  // Get all years
  const years = [...new Set(data.map((d) => d.year))].sort();

  if (years.length < 3) return null; // Not enough data for a trend

  // Build trend data for each cause
  const trends = top5Causes.map((cause) => {
    const causeData = data.filter((d) => d.cause === cause);
    const yearMap = new Map(causeData.map((d) => [d.year, d.totalDeaths]));
    return {
      cause,
      shortName: truncate(cause, 35),
      values: years.map((y) => ({ year: y, deaths: yearMap.get(y) ?? 0 })),
    };
  });

  // Color palette for the 5 trend lines
  const colors = [
    "text-accent-red",
    "text-accent-amber",
    "text-accent",
    "text-accent-green",
    "text-accent-gold",
  ];

  const bgColors = [
    "bg-accent-red",
    "bg-accent-amber",
    "bg-accent",
    "bg-accent-green",
    "bg-accent-gold",
  ];

  return (
    <Card>
      <CardHeader
        title="Top 5 Causes — Trend Over Time"
        subtitle={`${years[0]}–${years[years.length - 1]}`}
      />

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4">
        {trends.map((trend, i) => (
          <div key={trend.cause} className="flex items-center gap-1.5">
            <div className={`w-3 h-1.5 rounded-full ${bgColors[i]}`} />
            <span className="text-xs text-muted">{trend.shortName}</span>
          </div>
        ))}
      </div>

      {/* Simple table-based trend (server component — no Recharts) */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted border-b border-card-border">
              <th className="pb-2 pr-3 font-medium">Year</th>
              {trends.map((trend, i) => (
                <th key={trend.cause} className={`pb-2 pr-3 text-right font-medium ${colors[i]}`}>
                  {trend.shortName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-card-border/50">
            {years
              .filter((_, idx) => idx % Math.max(1, Math.floor(years.length / 12)) === 0 || idx === years.length - 1)
              .map((year) => (
                <tr key={year} className="hover:bg-card-border/20 transition-colors">
                  <td className="py-1.5 pr-3 font-mono text-muted">{year}</td>
                  {trends.map((trend) => {
                    const val = trend.values.find((v) => v.year === year)?.deaths ?? 0;
                    return (
                      <td key={trend.cause} className="py-1.5 pr-3 text-right font-mono text-foreground">
                        {val > 0 ? val.toLocaleString() : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ============================================================
// Context Card
// ============================================================

function MortalityContext() {
  return (
    <Card>
      <CardHeader
        title="Interpreting Mortality Data"
        subtitle="Context for Alberta's leading causes of death"
      />
      <div className="space-y-3 text-sm text-muted">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-accent-amber shrink-0 mt-0.5" />
          <p>
            <strong className="text-foreground">Organic dementia and Alzheimer&apos;s</strong>{" "}
            have been rising steadily as Alberta&apos;s population ages. This has direct
            implications for healthcare infrastructure demand and long-term care facility
            investment.
          </p>
        </div>
        <div className="flex items-start gap-2">
          <TrendingUp className="w-4 h-4 text-accent shrink-0 mt-0.5" />
          <p>
            <strong className="text-foreground">Accidental poisoning</strong> (which includes
            opioid overdoses) surged dramatically after 2015, reflecting the fentanyl crisis
            that hit Alberta particularly hard. This affects working-age populations and has
            measurable economic impacts on labour supply.
          </p>
        </div>
        <div className="flex items-start gap-2">
          <Hash className="w-4 h-4 text-muted shrink-0 mt-0.5" />
          <p>
            These are <strong className="text-foreground">raw counts, not age-standardized
            rates</strong>. Population growth alone will increase total deaths even if per-capita
            mortality is declining. For comparing across years, rates are more meaningful than
            counts — but counts show the absolute healthcare system burden.
          </p>
        </div>
      </div>
    </Card>
  );
}

// ============================================================
// Helpers
// ============================================================

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1).trimEnd() + "\u2026";
}

// ============================================================
// Page
// ============================================================

export default function MortalityPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Leading Causes of Death"
        description="Province-wide mortality data from Alberta Open Data. Top causes, death counts, and trends over two decades."
        category="health"
        icon={<Skull size={20} />}
      />

      {/* Key Metrics */}
      <Suspense fallback={<LoadingCard />}>
        <KeyMetrics />
      </Suspense>

      {/* Top Causes */}
      <SectionHeader
        title="Top Causes of Death"
        icon={<Skull size={16} />}
        category="health"
      />
      <Suspense fallback={<LoadingCard />}>
        <TopCausesTable />
      </Suspense>

      {/* Context */}
      <MortalityContext />

      {/* Trend */}
      <SectionHeader
        title="Trends Over Time"
        icon={<TrendingUp size={16} />}
        category="health"
      />
      <Suspense fallback={<LoadingCard />}>
        <TopCausesTrend />
      </Suspense>

      {/* Footer */}
      <footer className="text-center text-[10px] text-muted/50 font-mono pt-4 pb-8">
        Alberta Pulse Check — Mortality — Data from Alberta Open Data (open.alberta.ca)
      </footer>
    </main>
  );
}
