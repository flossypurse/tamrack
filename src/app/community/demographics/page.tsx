import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import {
  HeartPulse,
  Users,
  Baby,
  Skull,
  MapPin,
  Stethoscope,
} from "lucide-react";
import {
  fetchLifeExpectancy,
  fetchBirthsAndDeaths,
  type LifeExpectancyPoint,
  type BirthDeathPoint,
} from "@/lib/data-sources-health";

// ============================================================
// Metadata
// ============================================================

export const metadata: Metadata = {
  title: "Alberta Health Demographics — Life Expectancy, Births & Deaths",
  description:
    "Life expectancy by municipality, births and deaths across Alberta. Data from the Alberta Regional Dashboard covering ~340 municipalities.",
  alternates: {
    canonical: "https://albertapulsecheck.ca/community/demographics",
  },
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
// Key Metrics
// ============================================================

async function KeyMetrics() {
  const [lifeExpData, birthDeathData] = await Promise.all([
    fetchLifeExpectancy().catch(() => [] as LifeExpectancyPoint[]),
    fetchBirthsAndDeaths().catch(() => [] as BirthDeathPoint[]),
  ]);

  // Calculate province average life expectancy (latest period, "Both Sexes" or all)
  const latestLifeExp = getLatestPerMunicipality(lifeExpData);
  const avgLifeExp =
    latestLifeExp.length > 0
      ? (latestLifeExp.reduce((sum, pt) => sum + pt.value, 0) / latestLifeExp.length).toFixed(1)
      : "—";

  // Get latest year births and deaths totals
  const latestBD = getLatestBirthDeathPeriod(birthDeathData);
  const totalBirths = latestBD
    .filter((pt) => pt.type.toLowerCase().includes("birth"))
    .reduce((sum, pt) => sum + pt.value, 0);
  const totalDeaths = latestBD
    .filter((pt) => pt.type.toLowerCase().includes("death"))
    .reduce((sum, pt) => sum + pt.value, 0);

  // Count unique municipalities with data
  const municipalities = new Set(lifeExpData.map((pt) => pt.municipality));

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <MetricCard
        title="Avg. Life Expectancy"
        value={avgLifeExp === "—" ? "—" : `${avgLifeExp} yrs`}
        source="Alberta Regional Dashboard"
      />
      <MetricCard
        title="Total Births (Latest Year)"
        value={totalBirths > 0 ? totalBirths.toLocaleString() : "—"}
        source="Alberta Regional Dashboard"
      />
      <MetricCard
        title="Total Deaths (Latest Year)"
        value={totalDeaths > 0 ? totalDeaths.toLocaleString() : "—"}
        source="Alberta Regional Dashboard"
      />
      <MetricCard
        title="Municipalities Tracked"
        value={municipalities.size > 0 ? municipalities.size.toLocaleString() : "—"}
        source="Alberta Regional Dashboard"
      />
    </div>
  );
}

// ============================================================
// Life Expectancy Table
// ============================================================

async function LifeExpectancyTable() {
  const data = await fetchLifeExpectancy().catch(() => [] as LifeExpectancyPoint[]);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader
          title="Life Expectancy by Municipality"
          subtitle="No data available from Alberta Regional Dashboard"
        />
      </Card>
    );
  }

  // Get latest period per municipality, prefer "Both Sexes" gender
  const latestPerMuni = getLatestPerMunicipality(data);

  // Sort by value descending (highest life expectancy first)
  const sorted = [...latestPerMuni].sort((a, b) => b.value - a.value);
  const top20 = sorted.slice(0, 20);

  return (
    <Card>
      <CardHeader
        title="Life Expectancy by Municipality"
        subtitle={`Top 20 of ${sorted.length} municipalities — highest first`}
        freshness="daily"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr className="text-left text-muted border-b border-card-border">
              <th className="pb-2 pr-3">#</th>
              <th className="pb-2 pr-3">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Municipality
                </span>
              </th>
              <th className="pb-2 pr-3 text-right">Life Expectancy (yrs)</th>
              <th className="pb-2 text-right">Period</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-card-border/50">
            {top20.map((pt, i) => (
              <tr key={`${pt.municipality}-${i}`} className="hover:bg-card-border/20 transition-colors">
                <td className="py-2 pr-3 text-muted font-mono text-xs">{i + 1}</td>
                <td className="py-2 pr-3 text-foreground">{pt.municipality}</td>
                <td className="py-2 pr-3 text-right font-mono font-semibold text-foreground">
                  {pt.value.toFixed(1)}
                </td>
                <td className="py-2 text-right text-muted font-mono text-xs">{pt.period}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ============================================================
// Births & Deaths Table
// ============================================================

async function BirthsDeathsTable() {
  const data = await fetchBirthsAndDeaths().catch(() => [] as BirthDeathPoint[]);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader
          title="Births & Deaths by Municipality"
          subtitle="No data available from Alberta Regional Dashboard"
        />
      </Card>
    );
  }

  // Get latest period, aggregate births and deaths per municipality
  const latestBD = getLatestBirthDeathPeriod(data);

  const muniMap = new Map<string, { births: number; deaths: number; period: string }>();
  for (const pt of latestBD) {
    const existing = muniMap.get(pt.municipality) || { births: 0, deaths: 0, period: pt.period };
    if (pt.type.toLowerCase().includes("birth")) {
      existing.births += pt.value;
    } else if (pt.type.toLowerCase().includes("death")) {
      existing.deaths += pt.value;
    }
    existing.period = pt.period;
    muniMap.set(pt.municipality, existing);
  }

  // Convert to sorted array (by total births + deaths descending)
  const sorted = [...muniMap.entries()]
    .map(([municipality, { births, deaths, period }]) => ({
      municipality,
      births,
      deaths,
      naturalIncrease: births - deaths,
      period,
    }))
    .sort((a, b) => (b.births + b.deaths) - (a.births + a.deaths));

  const top20 = sorted.slice(0, 20);

  return (
    <Card>
      <CardHeader
        title="Births & Deaths by Municipality"
        subtitle={`Top 20 of ${sorted.length} municipalities by volume`}
        freshness="daily"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr className="text-left text-muted border-b border-card-border">
              <th className="pb-2 pr-3">#</th>
              <th className="pb-2 pr-3">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Municipality
                </span>
              </th>
              <th className="pb-2 pr-3 text-right">
                <span className="inline-flex items-center gap-1">
                  <Baby className="w-3 h-3" /> Births
                </span>
              </th>
              <th className="pb-2 pr-3 text-right">
                <span className="inline-flex items-center gap-1">
                  <Skull className="w-3 h-3" /> Deaths
                </span>
              </th>
              <th className="pb-2 pr-3 text-right">Natural Increase</th>
              <th className="pb-2 text-right">Period</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-card-border/50">
            {top20.map((row, i) => (
              <tr key={`${row.municipality}-${i}`} className="hover:bg-card-border/20 transition-colors">
                <td className="py-2 pr-3 text-muted font-mono text-xs">{i + 1}</td>
                <td className="py-2 pr-3 text-foreground">{row.municipality}</td>
                <td className="py-2 pr-3 text-right font-mono text-foreground">
                  {row.births > 0 ? row.births.toLocaleString() : "—"}
                </td>
                <td className="py-2 pr-3 text-right font-mono text-foreground">
                  {row.deaths > 0 ? row.deaths.toLocaleString() : "—"}
                </td>
                <td
                  className={`py-2 pr-3 text-right font-mono font-semibold ${
                    row.naturalIncrease > 0
                      ? "text-accent-green"
                      : row.naturalIncrease < 0
                        ? "text-accent-red"
                        : "text-muted"
                  }`}
                >
                  {row.naturalIncrease > 0 ? "+" : ""}
                  {row.naturalIncrease.toLocaleString()}
                </td>
                <td className="py-2 text-right text-muted font-mono text-xs">{row.period}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ============================================================
// Coming Soon
// ============================================================

function ComingSoonCard() {
  return (
    <Card className="opacity-70">
      <div className="flex items-start gap-3">
        <Stethoscope size={18} className="text-muted shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-medium text-foreground">More Health Demographics Coming</h3>
          <p className="text-sm text-muted mt-1 leading-relaxed">
            We are working on integrating additional health demographic data including CIHI
            physician supply and distribution data, and AHS regional healthcare capacity
            metrics. AHS wait times data is currently locked behind Power BI dashboards
            and cannot be programmatically accessed.
          </p>
        </div>
      </div>
    </Card>
  );
}

// ============================================================
// Helpers
// ============================================================

/**
 * Gets the latest period data per municipality for life expectancy.
 * Prefers "Both Sexes" gender if available.
 */
function getLatestPerMunicipality(data: LifeExpectancyPoint[]): LifeExpectancyPoint[] {
  const muniMap = new Map<string, LifeExpectancyPoint>();

  for (const pt of data) {
    const existing = muniMap.get(pt.municipality);

    // Prefer "Both Sexes" over gender-specific entries
    const isBothSexes =
      pt.gender.toLowerCase().includes("both") || pt.gender.toLowerCase() === "total";
    const existingIsBothSexes =
      existing &&
      (existing.gender.toLowerCase().includes("both") ||
        existing.gender.toLowerCase() === "total");

    if (!existing) {
      muniMap.set(pt.municipality, pt);
    } else if (pt.period > existing.period) {
      muniMap.set(pt.municipality, pt);
    } else if (pt.period === existing.period && isBothSexes && !existingIsBothSexes) {
      muniMap.set(pt.municipality, pt);
    }
  }

  return [...muniMap.values()];
}

/**
 * Gets birth/death data for the latest period across all municipalities.
 */
function getLatestBirthDeathPeriod(data: BirthDeathPoint[]): BirthDeathPoint[] {
  if (data.length === 0) return [];

  // Find the latest period
  const periods = [...new Set(data.map((pt) => pt.period))].sort();
  const latestPeriod = periods[periods.length - 1];

  return data.filter((pt) => pt.period === latestPeriod);
}

// ============================================================
// Page
// ============================================================

export default function HealthDemographicsPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Health Demographics"
        description="Life expectancy, births, and deaths by municipality across Alberta."
        category="health"
        icon={<HeartPulse size={20} />}
      />

      {/* Key Metrics */}
      <Suspense fallback={<LoadingCard />}>
        <KeyMetrics />
      </Suspense>

      {/* Life Expectancy */}
      <SectionHeader
        title="Life Expectancy by Municipality"
        icon={<Users size={16} />}
        category="health"
      />
      <Suspense fallback={<LoadingCard />}>
        <LifeExpectancyTable />
      </Suspense>

      {/* Births & Deaths */}
      <SectionHeader
        title="Births & Deaths by Municipality"
        icon={<Baby size={16} />}
        category="health"
      />
      <Suspense fallback={<LoadingCard />}>
        <BirthsDeathsTable />
      </Suspense>

      {/* Coming Soon */}
      <ComingSoonCard />
    </main>
  );
}
