import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import { ChartCard } from "@/components/chart-card";
import { computeTimeRange } from "@/lib/time-range";

export const metadata: Metadata = {
  title: "Alberta Rental Market Intelligence",
  description: "CMHC rental vacancy rates, average rents by unit type, and rental market trends across Edmonton and Calgary CMAs.",
  alternates: {
    canonical: "https://albertapulsecheck.ca/real-estate/rental",
  },
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
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import {
  fetchStatCanTimeSeries,
  STATSCAN_SERIES,
  type TimeSeriesPoint,
} from "@/lib/data-sources";
import {
  fetchVacancyRates,
  fetchRentComparison,
} from "@/lib/data-sources-cmhc";

// ============================================================
// Server-side data fetching
// ============================================================

async function getRentalMetrics() {
  const [vacancy, rentData] = await Promise.all([
    fetchVacancyRates(2).catch(() => []),
    fetchRentComparison(2).catch(() => []),
  ]);

  const latestVacancy = vacancy.at(-1);
  const prevVacancy = vacancy.at(-2);
  const latestRent = rentData.at(-1);

  const vacancyChange = (latestVacancy && prevVacancy && prevVacancy.edmonton !== 0)
    ? `${((latestVacancy.edmonton - prevVacancy.edmonton) / prevVacancy.edmonton * 100).toFixed(1)}%`
    : undefined;

  return {
    edmVacancy: latestVacancy ? `${latestVacancy.edmonton.toFixed(1)}%` : "—",
    calVacancy: latestVacancy ? `${latestVacancy.calgary.toFixed(1)}%` : "—",
    vacancyChange,
    edmRent2Bed: latestRent ? `$${latestRent.edmontonTwoBed.toFixed(0)}` : "—",
    calRent2Bed: latestRent ? `$${latestRent.calgaryTwoBed.toFixed(0)}` : "—",
    edmRent1Bed: latestRent ? `$${latestRent.edmontonOneBed.toFixed(0)}` : "—",
    calRent1Bed: latestRent ? `$${latestRent.calgaryOneBed.toFixed(0)}` : "—",
  };
}

// ============================================================
// Dashboard sections
// ============================================================

async function RentalMetrics() {
  const m = await getRentalMetrics();
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      <MetricCard
        title="Edmonton Vacancy"
        value={m.edmVacancy}
        change={m.vacancyChange}
        changeLabel="vs prev year"
        source="CMHC 34-10-0127"
      />
      <MetricCard
        title="Calgary Vacancy"
        value={m.calVacancy}
        source="CMHC 34-10-0127"
      />
      <MetricCard
        title="Edm 2-Bed Rent"
        value={m.edmRent2Bed}
        source="CMHC 34-10-0133"
      />
      <MetricCard
        title="Cal 2-Bed Rent"
        value={m.calRent2Bed}
        source="CMHC 34-10-0133"
      />
      <MetricCard
        title="Edm 1-Bed Rent"
        value={m.edmRent1Bed}
        source="CMHC 34-10-0133"
      />
      <MetricCard
        title="Cal 1-Bed Rent"
        value={m.calRent1Bed}
        source="CMHC 34-10-0133"
      />
    </div>
  );
}

async function VacancyComparisonChart() {
  const data = await fetchVacancyRates(20);
  const merged: MultiSeriesPoint[] = data.map((d) => ({
    date: d.date,
    edmonton: d.edmonton,
    calgary: d.calgary,
  }));
  const timeRange = computeTimeRange(merged);
  return (
    <ChartCard chartId="re-rental-vacancy-compare" title="Rental Vacancy Rate — Edmonton vs Calgary" timeRange={timeRange} source="CMHC">
      <Card>
        <CardHeader
          title="Rental Vacancy Rate — Edmonton vs Calgary"
          subtitle="CMHC October survey. Below 3% = tight market, above 5% = tenant's market."
          badge="LIVE"
        />
        <MultiSeriesLineChart
          data={merged}
          series={[
            { key: "edmonton", label: "Edmonton", color: "#3b82f6", suffix: "%" },
            { key: "calgary", label: "Calgary", color: "#ef4444", suffix: "%" },
          ]}
          height={280}
        />
        <p className="text-[10px] text-muted/60 mt-2">
          A healthy market sits between 3-5%. Below 3% puts upward pressure on rents. Above 5% signals oversupply risk.
        </p>
      </Card>
    </ChartCard>
  );
}

async function RentTrendsChart() {
  const rentData = await fetchRentComparison(20);

  const merged: MultiSeriesPoint[] = rentData.map((d) => ({
    date: d.date,
    edmTwoBed: d.edmontonTwoBed,
    calTwoBed: d.calgaryTwoBed,
    edmOneBed: d.edmontonOneBed,
    calOneBed: d.calgaryOneBed,
  }));
  const timeRange = computeTimeRange(merged);

  return (
    <ChartCard chartId="re-rent-trends-compare" title="Average 2-Bed & 1-Bed Rents — Edmonton vs Calgary" timeRange={timeRange} source="CMHC">
      <Card>
        <CardHeader
          title="Average Rents — Edmonton vs Calgary"
          subtitle="Annual CMHC rent survey — tracks existing tenancies, not asking rents"
          badge="LIVE"
        />
        <MultiSeriesLineChart
          data={merged}
          series={[
            { key: "edmTwoBed", label: "Edm 2-Bed", color: "#3b82f6", prefix: "$" },
            { key: "calTwoBed", label: "Cal 2-Bed", color: "#ef4444", prefix: "$" },
            { key: "edmOneBed", label: "Edm 1-Bed", color: "#93c5fd", prefix: "$" },
            { key: "calOneBed", label: "Cal 1-Bed", color: "#fca5a5", prefix: "$" },
          ]}
          height={300}
        />
      </Card>
    </ChartCard>
  );
}

async function EdmontonRentBreakdownChart() {
  const [bachelor, oneBed, twoBed, threeBed] = await Promise.all([
    fetchStatCanTimeSeries(STATSCAN_SERIES.EDMONTON_RENT_BACHELOR.tableId, STATSCAN_SERIES.EDMONTON_RENT_BACHELOR.coordinate, 20),
    fetchStatCanTimeSeries(STATSCAN_SERIES.EDMONTON_RENT_1BED.tableId, STATSCAN_SERIES.EDMONTON_RENT_1BED.coordinate, 20),
    fetchStatCanTimeSeries(STATSCAN_SERIES.EDMONTON_RENT_2BED.tableId, STATSCAN_SERIES.EDMONTON_RENT_2BED.coordinate, 20),
    fetchStatCanTimeSeries(STATSCAN_SERIES.EDMONTON_RENT_3BED.tableId, STATSCAN_SERIES.EDMONTON_RENT_3BED.coordinate, 20),
  ]);

  const dateMap = new Map<string, MultiSeriesPoint>();
  for (const p of bachelor) dateMap.set(p.date, { date: p.date, bachelor: p.value, oneBed: 0, twoBed: 0, threeBed: 0 });
  for (const p of oneBed) { const ex = dateMap.get(p.date); if (ex) ex.oneBed = p.value; }
  for (const p of twoBed) { const ex = dateMap.get(p.date); if (ex) ex.twoBed = p.value; }
  for (const p of threeBed) { const ex = dateMap.get(p.date); if (ex) ex.threeBed = p.value; }
  const merged = Array.from(dateMap.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const timeRange = computeTimeRange(merged);

  return (
    <ChartCard chartId="re-rent-edm-breakdown" title="Edmonton Rents by Unit Type" timeRange={timeRange} source="CMHC">
      <Card>
        <CardHeader
          title="Edmonton Rents by Unit Type"
          subtitle="All unit types — bachelor through 3-bedroom"
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
    </ChartCard>
  );
}

async function CalgaryRentBreakdownChart() {
  const [bachelor, oneBed, twoBed, threeBed] = await Promise.all([
    fetchStatCanTimeSeries(STATSCAN_SERIES.CALGARY_RENT_BACHELOR.tableId, STATSCAN_SERIES.CALGARY_RENT_BACHELOR.coordinate, 20),
    fetchStatCanTimeSeries(STATSCAN_SERIES.CALGARY_RENT_1BED.tableId, STATSCAN_SERIES.CALGARY_RENT_1BED.coordinate, 20),
    fetchStatCanTimeSeries(STATSCAN_SERIES.CALGARY_RENT_2BED.tableId, STATSCAN_SERIES.CALGARY_RENT_2BED.coordinate, 20),
    fetchStatCanTimeSeries(STATSCAN_SERIES.CALGARY_RENT_3BED.tableId, STATSCAN_SERIES.CALGARY_RENT_3BED.coordinate, 20),
  ]);

  const dateMap = new Map<string, MultiSeriesPoint>();
  for (const p of bachelor) dateMap.set(p.date, { date: p.date, bachelor: p.value, oneBed: 0, twoBed: 0, threeBed: 0 });
  for (const p of oneBed) { const ex = dateMap.get(p.date); if (ex) ex.oneBed = p.value; }
  for (const p of twoBed) { const ex = dateMap.get(p.date); if (ex) ex.twoBed = p.value; }
  for (const p of threeBed) { const ex = dateMap.get(p.date); if (ex) ex.threeBed = p.value; }
  const merged = Array.from(dateMap.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const timeRange = computeTimeRange(merged);

  return (
    <ChartCard chartId="re-rent-cal-breakdown" title="Calgary Rents by Unit Type" timeRange={timeRange} source="CMHC">
      <Card>
        <CardHeader
          title="Calgary Rents by Unit Type"
          subtitle="All unit types — bachelor through 3-bedroom"
          badge="LIVE"
        />
        <MultiSeriesLineChart
          data={merged}
          series={[
            { key: "bachelor", label: "Bachelor", color: "#94a3b8", prefix: "$" },
            { key: "oneBed", label: "1-Bed", color: "#ef4444", prefix: "$" },
            { key: "twoBed", label: "2-Bed", color: "#10b981", prefix: "$" },
            { key: "threeBed", label: "3-Bed", color: "#f59e0b", prefix: "$" },
          ]}
          height={300}
        />
      </Card>
    </ChartCard>
  );
}

async function VacancyVsStartsChart() {
  const [vacancy, starts] = await Promise.all([
    fetchVacancyRates(15),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.tableId,
      STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.coordinate,
      60
    ),
  ]);

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
      merged.push({ date: v.date, vacancy: v.edmonton, annualStarts: yearStarts });
    }
  }
  merged.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const timeRange = computeTimeRange(merged);

  return (
    <ChartCard chartId="re-vacancy-vs-starts" title="Edmonton Vacancy Rate vs Housing Starts" timeRange={timeRange} source="CMHC">
      <Card>
        <CardHeader
          title="Edmonton Vacancy vs Housing Starts"
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
    </ChartCard>
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
      <PageHeader
        title="Rental Intelligence"
        description="Vacancy rates, average rents by unit type, and supply dynamics — comparing Edmonton and Calgary CMAs. CMHC annual survey data via StatsCan."
        category="realestate"
        icon={<Home size={20} />}
      >
        <div className="flex flex-wrap gap-2">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 font-mono">LENDERS</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-mono">INVESTORS</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-mono">PROPERTY MANAGERS</span>
        </div>
      </PageHeader>

      {/* Key Metrics */}
      <section>
        <Suspense
          fallback={
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
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

      {/* Vacancy Comparison */}
      <section>
        <SectionHeader title="Market Tightness" icon={<TrendingDown size={16} />} category="realestate" />
        <Suspense fallback={<LoadingCard />}>
          <VacancyComparisonChart />
        </Suspense>
      </section>

      {/* Rent Comparison */}
      <section>
        <SectionHeader title="Rent Comparison" icon={<DollarSign size={16} />} category="realestate" />
        <Suspense fallback={<LoadingCard />}>
          <RentTrendsChart />
        </Suspense>
      </section>

      {/* City breakdowns side-by-side */}
      <section>
        <SectionHeader title="Rent by Unit Type" icon={<DollarSign size={16} />} category="realestate" />
        <div className="grid lg:grid-cols-2 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <EdmontonRentBreakdownChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <CalgaryRentBreakdownChart />
          </Suspense>
        </div>
      </section>

      {/* Vacancy vs Starts */}
      <section>
        <SectionHeader title="Supply vs Tightness" icon={<BarChart3 size={16} />} category="realestate" />
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
              <p>Low vacancy = strong rental demand = lower default risk on investment properties. Compare Edmonton vs Calgary vacancy to allocate portfolio geography.</p>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">Rental Investors</p>
              <p>Compare rent growth to assessment growth for yield signals. Falling vacancy + rising rents = time to acquire. Cross-CMA arbitrage is real.</p>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">Property Managers</p>
              <p>Set competitive rents using CMHC actuals. If your 2-bed is above the CMA average and you have vacancy — you&apos;re priced too high.</p>
            </div>
          </div>
        </Card>
      </section>
    </main>
  );
}
