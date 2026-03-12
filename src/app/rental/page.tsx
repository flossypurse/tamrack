import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader, MetricCard } from "@/components/card";

export const metadata: Metadata = {
  title: "Alberta Rental Market Intelligence",
  description: "CMHC rental vacancy rates, average rents by unit type, and rental market trends across Alberta census metropolitan areas.",
};
import {
  TimeSeriesAreaChart,
  MultiSeriesLineChart,
  type MultiSeriesPoint,
} from "@/components/chart";
import {
  Home,
  TrendingDown,
  DollarSign,
  BarChart3,
} from "lucide-react";
import {
  fetchStatCanTimeSeries,
  STATSCAN_SERIES,
  type TimeSeriesPoint,
} from "@/lib/data-sources";

// ============================================================
// Server-side data fetching
// ============================================================

async function getRentalMetrics() {
  const [vacancy, bachelor, oneBed, twoBed, threeBed] = await Promise.all([
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.EDMONTON_VACANCY_RATE.tableId,
      STATSCAN_SERIES.EDMONTON_VACANCY_RATE.coordinate,
      2
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.EDMONTON_RENT_BACHELOR.tableId,
      STATSCAN_SERIES.EDMONTON_RENT_BACHELOR.coordinate,
      2
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.EDMONTON_RENT_1BED.tableId,
      STATSCAN_SERIES.EDMONTON_RENT_1BED.coordinate,
      2
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.EDMONTON_RENT_2BED.tableId,
      STATSCAN_SERIES.EDMONTON_RENT_2BED.coordinate,
      2
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.EDMONTON_RENT_3BED.tableId,
      STATSCAN_SERIES.EDMONTON_RENT_3BED.coordinate,
      2
    ).catch(() => []),
  ]);

  const latest = (pts: TimeSeriesPoint[]) => pts.at(-1)?.value;
  const prev = (pts: TimeSeriesPoint[]) => pts.at(-2)?.value;
  const pctChange = (pts: TimeSeriesPoint[]) => {
    const l = latest(pts);
    const p = prev(pts);
    if (l == null || p == null || p === 0) return undefined;
    const ch = ((l - p) / p * 100).toFixed(1);
    return `${parseFloat(ch) >= 0 ? "+" : ""}${ch}%`;
  };

  return {
    vacancyRate: latest(vacancy) != null ? `${latest(vacancy)!.toFixed(1)}%` : "—",
    vacancyChange: pctChange(vacancy),
    rentBachelor: latest(bachelor) != null ? `$${latest(bachelor)!.toFixed(0)}` : "—",
    rent1Bed: latest(oneBed) != null ? `$${latest(oneBed)!.toFixed(0)}` : "—",
    rent2Bed: latest(twoBed) != null ? `$${latest(twoBed)!.toFixed(0)}` : "—",
    rent2BedChange: pctChange(twoBed),
    rent3Bed: latest(threeBed) != null ? `$${latest(threeBed)!.toFixed(0)}` : "—",
  };
}

// ============================================================
// Dashboard sections
// ============================================================

async function RentalMetrics() {
  const m = await getRentalMetrics();
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      <MetricCard
        title="Vacancy Rate"
        value={m.vacancyRate}
        change={m.vacancyChange}
        changeLabel="vs prev year"
        source="CMHC 34-10-0127"
      />
      <MetricCard
        title="Bachelor Rent"
        value={m.rentBachelor}
        source="CMHC 34-10-0133"
      />
      <MetricCard
        title="1-Bedroom Rent"
        value={m.rent1Bed}
        source="CMHC 34-10-0133"
      />
      <MetricCard
        title="2-Bedroom Rent"
        value={m.rent2Bed}
        change={m.rent2BedChange}
        changeLabel="vs prev year"
        source="CMHC 34-10-0133"
      />
      <MetricCard
        title="3-Bedroom Rent"
        value={m.rent3Bed}
        source="CMHC 34-10-0133"
      />
    </div>
  );
}

async function VacancyChart() {
  const data = await fetchStatCanTimeSeries(
    STATSCAN_SERIES.EDMONTON_VACANCY_RATE.tableId,
    STATSCAN_SERIES.EDMONTON_VACANCY_RATE.coordinate,
    20
  );
  return (
    <Card>
      <CardHeader
        title="Rental Vacancy Rate — Edmonton CMA"
        subtitle="CMHC October survey. Below 3% = tight market, above 5% = tenant's market."
        badge="LIVE"
      />
      <TimeSeriesAreaChart data={data} color="#ef4444" height={280} valueSuffix="%" />
      <p className="text-[10px] text-muted/60 mt-2">
        A healthy market sits between 3-5%. Below 3% puts upward pressure on rents and signals investor opportunity. Above 5% signals oversupply risk.
      </p>
    </Card>
  );
}

async function RentTrendsChart() {
  const [bachelor, oneBed, twoBed, threeBed] = await Promise.all([
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.EDMONTON_RENT_BACHELOR.tableId,
      STATSCAN_SERIES.EDMONTON_RENT_BACHELOR.coordinate,
      20
    ),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.EDMONTON_RENT_1BED.tableId,
      STATSCAN_SERIES.EDMONTON_RENT_1BED.coordinate,
      20
    ),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.EDMONTON_RENT_2BED.tableId,
      STATSCAN_SERIES.EDMONTON_RENT_2BED.coordinate,
      20
    ),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.EDMONTON_RENT_3BED.tableId,
      STATSCAN_SERIES.EDMONTON_RENT_3BED.coordinate,
      20
    ),
  ]);

  const dateMap = new Map<string, MultiSeriesPoint>();
  for (const p of bachelor) {
    dateMap.set(p.date, { date: p.date, bachelor: p.value, oneBed: 0, twoBed: 0, threeBed: 0 });
  }
  for (const p of oneBed) {
    const ex = dateMap.get(p.date);
    if (ex) ex.oneBed = p.value;
  }
  for (const p of twoBed) {
    const ex = dateMap.get(p.date);
    if (ex) ex.twoBed = p.value;
  }
  for (const p of threeBed) {
    const ex = dateMap.get(p.date);
    if (ex) ex.threeBed = p.value;
  }
  const merged = Array.from(dateMap.values()).sort((a, b) =>
    String(a.date).localeCompare(String(b.date))
  );

  return (
    <Card>
      <CardHeader
        title="Average Rents by Unit Type — Edmonton CMA"
        subtitle="Annual CMHC rent survey — tracks existing tenancies, not asking rents"
        badge="LIVE"
      />
      <MultiSeriesLineChart
        data={merged}
        series={[
          { key: "bachelor", label: "Bachelor", color: "#94a3b8", prefix: "$" },
          { key: "oneBed", label: "1-Bed", color: "#3b82f6", prefix: "$" },
          { key: "twoBed", label: "2-Bed", color: "#10b981", prefix: "$" },
          { key: "threeBed", label: "3-Bed", color: "#f59e0b", prefix: "$" },
        ]}
        height={300}
      />
    </Card>
  );
}

async function VacancyVsStartsChart() {
  const [vacancy, starts] = await Promise.all([
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.EDMONTON_VACANCY_RATE.tableId,
      STATSCAN_SERIES.EDMONTON_VACANCY_RATE.coordinate,
      15
    ),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.tableId,
      STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.coordinate,
      60
    ),
  ]);

  // Vacancy is annual (October), starts are monthly — aggregate starts to annual
  const annualStarts = new Map<string, number>();
  for (const p of starts) {
    const year = p.date.slice(0, 4);
    annualStarts.set(year, (annualStarts.get(year) || 0) + p.value);
  }

  const merged: MultiSeriesPoint[] = [];
  for (const v of vacancy) {
    const year = v.date.slice(0, 4);
    const yearStarts = annualStarts.get(year);
    if (yearStarts != null) {
      merged.push({ date: v.date, vacancy: v.value, annualStarts: yearStarts });
    }
  }
  merged.sort((a, b) => String(a.date).localeCompare(String(b.date)));

  return (
    <Card>
      <CardHeader
        title="Vacancy Rate vs Housing Starts"
        subtitle="When starts surge and vacancy drops — expect rent increases. When both rise — oversupply."
        badge="LIVE"
      />
      <MultiSeriesLineChart
        data={merged}
        series={[
          { key: "vacancy", label: "Vacancy %", color: "#ef4444", suffix: "%", yAxisId: "left" },
          { key: "annualStarts", label: "Annual Starts", color: "#3b82f6", yAxisId: "right" },
        ]}
        height={280}
        dualAxis
      />
    </Card>
  );
}

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

export default function RentalPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <header>
        <div className="flex items-center gap-2 mb-1">
          <Home size={20} className="text-red-400" />
          <h1 className="text-xl font-semibold tracking-tight">
            Rental Intelligence
          </h1>
        </div>
        <p className="text-sm text-muted">
          Vacancy rates, average rents by unit type, and the relationship between new supply and rental tightness.
          Edmonton CMA data from CMHC annual surveys.
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 font-mono">LENDERS</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-mono">INVESTORS</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-mono">PROPERTY MANAGERS</span>
        </div>
      </header>

      {/* Key Metrics */}
      <section>
        <Suspense
          fallback={
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {[...Array(5)].map((_, i) => (
                <Card key={i}>
                  <div className="animate-pulse space-y-2">
                    <div className="h-3 bg-card-border rounded w-1/2" />
                    <div className="h-7 bg-card-border rounded w-2/3" />
                  </div>
                </Card>
              ))}
            </div>
          }
        >
          <RentalMetrics />
        </Suspense>
      </section>

      {/* Vacancy Rate */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <TrendingDown size={16} className="text-red-400" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Market Tightness
          </h2>
        </div>
        <Suspense fallback={<LoadingCard />}>
          <VacancyChart />
        </Suspense>
      </section>

      {/* Rent Trends */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <DollarSign size={16} className="text-emerald-400" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Rent Levels
          </h2>
        </div>
        <Suspense fallback={<LoadingCard />}>
          <RentTrendsChart />
        </Suspense>
      </section>

      {/* Vacancy vs Starts */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 size={16} className="text-blue-400" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Supply vs Tightness
          </h2>
        </div>
        <Suspense fallback={<LoadingCard />}>
          <VacancyVsStartsChart />
        </Suspense>
      </section>

      {/* Context */}
      <section>
        <Card>
          <h3 className="text-sm font-medium mb-2">Who Uses This</h3>
          <div className="grid sm:grid-cols-3 gap-3 text-xs text-muted">
            <div>
              <p className="font-medium text-foreground mb-1">Mortgage Lenders</p>
              <p>Low vacancy = strong rental demand = lower default risk on investment properties. Track vacancy alongside your portfolio geography.</p>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">Rental Investors</p>
              <p>Compare rent growth to assessment growth for yield signals. Falling vacancy + rising rents = time to acquire.</p>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">Property Managers</p>
              <p>Set competitive rents using CMHC actuals. If your 2-bed is above the CMA average and you have vacancy — you&apos;re priced too high.</p>
            </div>
          </div>
        </Card>
      </section>

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Alberta Pulse Check &mdash; Rental Intelligence &mdash; CMHC via StatsCan 34-10-0127, 34-10-0133
      </footer>
    </main>
  );
}
