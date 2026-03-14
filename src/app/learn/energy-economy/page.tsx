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
import { Flame, Zap, Factory, Users, Home, TrendingUp } from "lucide-react";

// ============================================================
// Metadata
// ============================================================

export const metadata: Metadata = {
  title: "Alberta's Energy Engine — Learn — Alberta Pulse Check",
  description:
    "Trace how energy prices ripple through Alberta's entire economy — jobs, migration, housing, and GDP. Live data from Bank of Canada, StatsCan, and CER.",
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
// Section 1: The Engine — Energy Commodities
// ============================================================

async function EnergyEngine() {
  const [energyIndex, allCommodities, cadUsd] = await Promise.all([
    fetchBoCTimeSeries(BOC_SERIES.BCPI_ENERGY, 240).catch(() => []),
    fetchBoCTimeSeries(BOC_SERIES.BCPI_ALL, 240).catch(() => []),
    fetchBoCTimeSeries(BOC_SERIES.CAD_USD, 240).catch(() => []),
  ]);

  const energyTimeRange = computeTimeRange(energyIndex);
  const cadTimeRange = computeTimeRange(cadUsd);

  // Build dual-axis multi-series data: energy index + CAD/USD
  const dateMap = new Map<string, { energy?: number; cad?: number }>();
  for (const p of energyIndex) {
    const key = p.date.slice(0, 7); // YYYY-MM
    const existing = dateMap.get(key) || {};
    existing.energy = p.value;
    dateMap.set(key, existing);
  }
  for (const p of cadUsd) {
    const key = p.date.slice(0, 7);
    const existing = dateMap.get(key) || {};
    existing.cad = p.value;
    dateMap.set(key, existing);
  }

  const combinedData: MultiSeriesPoint[] = [...dateMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([, v]) => v.energy !== undefined && v.cad !== undefined)
    .map(([date, v]) => ({
      date: `${date}-01`,
      energy: v.energy!,
      cad: v.cad!,
    }));

  const combinedSeries: SeriesConfig[] = [
    { key: "energy", label: "BCPI Energy", color: "#f97316", yAxisId: "left" },
    {
      key: "cad",
      label: "CAD/USD",
      color: "#3b82f6",
      prefix: "$",
      yAxisId: "right",
    },
  ];

  const energyTrend = computeDirection(energyIndex);

  return (
    <div className="space-y-4">
      <Prose>
        <p>
          The Bank of Canada publishes an Energy Commodity Price Index (BCPI
          Energy) that tracks the prices of Canadian energy exports — crude oil,
          natural gas, and refined products — all in a single number. When this
          number moves, Alberta feels it first.
        </p>
        <p>
          Look at the chart below. You can see the major energy cycles of the
          last two decades: the 2008 super-spike before the financial crisis, the
          2014 oil price collapse that gutted Alberta&apos;s provincial budget,
          the 2020 pandemic crash when oil briefly went negative, and the 2022
          energy spike from the Ukraine war. Every one of those events reshaped
          Alberta&apos;s economy for years afterward.
        </p>
      </Prose>

      <Card>
        <CardHeader
          title="Energy Commodities vs. Canadian Dollar"
          subtitle="BCPI Energy Index (left axis) and CAD/USD exchange rate (right axis)"
          badge="LIVE"
          freshness="daily"
        />
        <ChartCard
          chartId="learn-energy-bcpi-cad"
          title="Energy Commodities vs CAD/USD"
          timeRange={energyTimeRange}
          source="Bank of Canada Valet API"
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
          label="BCPI Energy Index"
          value={energyTrend.latest.toFixed(1)}
          change={energyTrend.change}
          direction={energyTrend.direction}
          source="Bank of Canada"
        />
      </DataGrid>

      <Prose>
        <p>
          Notice how the Canadian dollar (blue line) tends to follow energy
          prices? That&apos;s because Canada is a net energy exporter. When oil
          is expensive, global demand for Canadian dollars goes up. But
          here&apos;s the twist that most people miss: when the Canadian dollar is{" "}
          <em>weak</em>, Alberta&apos;s oil revenue actually gets a boost.
          Oil is priced in US dollars, so a weaker loonie means more Canadian
          dollars per barrel. A drop from $0.80 to $0.72 USD/CAD gives
          Alberta&apos;s producers an automatic ~11% raise in Canadian-dollar
          terms.
        </p>
      </Prose>

      <Insight>
        Alberta&apos;s economy doesn&apos;t follow the S&amp;P 500 — it follows
        the BCPI Energy chart. This single index is the best leading indicator
        for what happens next in the province.
      </Insight>

      <Expandable title="What's in the BCPI Energy Index?">
        <Prose>
          <p>
            The BCPI Energy index tracks a weighted basket of Canadian energy
            commodity export prices: Western Canadian Select (WCS) crude oil,
            Brent crude, natural gas (AECO hub price), and refined petroleum
            products. The index is set to 100 at a base year, so a reading of
            200 means energy prices have doubled relative to the base. The Bank
            of Canada updates this weekly.
          </p>
        </Prose>
      </Expandable>
    </div>
  );
}

// ============================================================
// Section 2: GDP — How Deep Does Energy Go?
// ============================================================

async function GDPSection() {
  const [gdpTotal, gdpOilGas, gdpConstruction, gdpTech, gdpRealEstate, gdpAgriculture] =
    await Promise.all([
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_GDP.tableId,
        STATSCAN_SERIES.AB_GDP.coordinate,
        120
      ).catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_GDP_MINING_OIL_GAS.tableId,
        STATSCAN_SERIES.AB_GDP_MINING_OIL_GAS.coordinate,
        120
      ).catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_GDP_CONSTRUCTION.tableId,
        STATSCAN_SERIES.AB_GDP_CONSTRUCTION.coordinate,
        120
      ).catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_GDP_TECH.tableId,
        STATSCAN_SERIES.AB_GDP_TECH.coordinate,
        120
      ).catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_GDP_REAL_ESTATE.tableId,
        STATSCAN_SERIES.AB_GDP_REAL_ESTATE.coordinate,
        120
      ).catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_GDP_AGRICULTURE.tableId,
        STATSCAN_SERIES.AB_GDP_AGRICULTURE.coordinate,
        120
      ).catch(() => []),
    ]);

  // Build multi-series data by aligning on date
  const dateMap = new Map<
    string,
    {
      total?: number;
      oilGas?: number;
      construction?: number;
      tech?: number;
      realEstate?: number;
      agriculture?: number;
    }
  >();

  const addSeries = (data: TimeSeriesPoint[], key: string) => {
    for (const p of data) {
      const d = p.date.slice(0, 7);
      const existing = dateMap.get(d) || {};
      (existing as Record<string, number>)[key] = p.value;
      dateMap.set(d, existing);
    }
  };

  addSeries(gdpOilGas, "oilGas");
  addSeries(gdpConstruction, "construction");
  addSeries(gdpTech, "tech");
  addSeries(gdpRealEstate, "realEstate");
  addSeries(gdpAgriculture, "agriculture");

  const gdpData: MultiSeriesPoint[] = [...dateMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date: `${date}-01`,
      oilGas: v.oilGas ?? 0,
      construction: v.construction ?? 0,
      tech: v.tech ?? 0,
      realEstate: v.realEstate ?? 0,
      agriculture: v.agriculture ?? 0,
    }));

  const gdpSeries: SeriesConfig[] = [
    { key: "oilGas", label: "Mining, Oil & Gas", color: "#f97316" },
    { key: "construction", label: "Construction", color: "#eab308" },
    { key: "realEstate", label: "Real Estate", color: "#3b82f6" },
    { key: "tech", label: "Tech & Information", color: "#10b981" },
    { key: "agriculture", label: "Agriculture", color: "#84cc16" },
  ];

  const timeRange = computeTimeRange(gdpTotal);

  // Calculate oil/gas share of total GDP
  const latestTotal = gdpTotal.at(-1)?.value ?? 0;
  const latestOilGas = gdpOilGas.at(-1)?.value ?? 0;
  const oilGasShare =
    latestTotal > 0 ? ((latestOilGas / latestTotal) * 100).toFixed(1) : "—";

  return (
    <div className="space-y-4">
      <Prose>
        <p>
          Mining, oil, and gas extraction is the single largest sector in
          Alberta&apos;s GDP — roughly {oilGasShare}% of provincial output
          in the most recent data. But the real story isn&apos;t the direct
          percentage. It&apos;s the <strong>multiplier effect</strong>.
        </p>
        <p>
          When an oil company invests $1 billion in a new project, that money
          cascades. Construction firms get contracts. Engineering companies hire.
          Restaurants near work camps fill up. Real estate agents sell houses to
          relocated workers. For every $1 of oil GDP, roughly $2.50 circulates
          through the broader Alberta economy.
        </p>
      </Prose>

      <Card>
        <CardHeader
          title="Alberta GDP by Sector"
          subtitle="Monthly GDP at basic prices ($M) — key sectors compared"
          badge="LIVE"
          freshness="daily"
        />
        <ChartCard
          chartId="learn-energy-gdp-sectors"
          title="Alberta GDP by Sector"
          timeRange={timeRange}
          source="StatsCan 36-10-0402"
        >
          <MultiSeriesLineChart
            data={gdpData}
            series={gdpSeries}
            height={300}
          />
        </ChartCard>
      </Card>

      <Prose>
        <p>
          Watch the sector lines carefully during downturns. When oil and gas
          GDP drops, construction follows within 6 to 12 months — because
          fewer projects mean fewer cranes. Then real estate softens 12 to 18
          months after that — because fewer jobs mean fewer buyers and more
          people leaving the province.
        </p>
        <p>
          The chart makes this cascade visible. Look at 2015-2016: oil GDP
          collapses, construction follows a few quarters later, then real estate
          flattens out. The same pattern played out in 2020. These aren&apos;t
          coincidences — they&apos;re the gears of Alberta&apos;s economic
          machine.
        </p>
      </Prose>

      <Insight>
        For every $1 of oil GDP, approximately $2.50 circulates through the
        Alberta economy. That multiplier is why an oil price drop
        doesn&apos;t just hurt oil companies — it ripples through construction,
        services, retail, and housing.
      </Insight>
    </div>
  );
}

// ============================================================
// Section 3: The Jobs Shockwave
// ============================================================

async function JobsShockwave() {
  const [unemployment, weeklyEarnings, energyIndex] = await Promise.all([
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
    fetchBoCTimeSeries(BOC_SERIES.BCPI_ENERGY, 120).catch(() => []),
  ]);

  // Dual-axis: unemployment + energy index
  const dateMap = new Map<string, { unemployment?: number; energy?: number }>();
  for (const p of unemployment) {
    const key = p.date.slice(0, 7);
    const existing = dateMap.get(key) || {};
    existing.unemployment = p.value;
    dateMap.set(key, existing);
  }
  for (const p of energyIndex) {
    const key = p.date.slice(0, 7);
    const existing = dateMap.get(key) || {};
    existing.energy = p.value;
    dateMap.set(key, existing);
  }

  const jobsData: MultiSeriesPoint[] = [...dateMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([, v]) => v.unemployment !== undefined && v.energy !== undefined)
    .map(([date, v]) => ({
      date: `${date}-01`,
      unemployment: v.unemployment!,
      energy: v.energy!,
    }));

  const jobsSeries: SeriesConfig[] = [
    {
      key: "unemployment",
      label: "Unemployment Rate",
      color: "#ef4444",
      suffix: "%",
      yAxisId: "left",
    },
    {
      key: "energy",
      label: "BCPI Energy",
      color: "#f97316",
      yAxisId: "right",
    },
  ];

  const timeRange = computeTimeRange(unemployment);
  const unempTrend = computeDirection(unemployment);
  const earningsTrend = computeDirection(weeklyEarnings);

  return (
    <div className="space-y-4">
      <Prose>
        <p>
          When energy prices crash, the pain doesn&apos;t show up in the
          unemployment numbers right away. That&apos;s the trap — by the time
          unemployment spikes, the economic damage has been building for months.
          Here&apos;s how the shockwave travels:
        </p>
      </Prose>

      <div className="space-y-0">
        <ChainStep
          number={1}
          title="Oil prices drop"
          description="Global energy prices fall due to oversupply, demand collapse, or geopolitical shifts. Alberta's benchmark (WCS) follows."
          timeLag="Immediate"
        />
        <ChainStep
          number={2}
          title="Drilling stops"
          description="Oil companies slash capital spending. Rig counts plunge. Exploration budgets get shelved. Service companies lose contracts overnight."
          timeLag="1 month"
        />
        <ChainStep
          number={3}
          title="Oil workers laid off"
          description="Field workers, rig crews, pipeline contractors — the direct energy workforce starts getting layoff notices. Camps empty out."
          timeLag="2–3 months"
        />
        <ChainStep
          number={4}
          title="Service sector loses customers"
          description="The workers who used to eat out, buy trucks, and rent apartments are now cutting back or leaving town. Local businesses feel the squeeze."
          timeLag="3–6 months"
        />
        <ChainStep
          number={5}
          title="Restaurants and retail cut hours"
          description="Reduced foot traffic hits the service economy. Part-time workers lose shifts. Small businesses start closing. THIS is when unemployment peaks."
          timeLag="6–9 months"
        />
      </div>

      <Card>
        <CardHeader
          title="Unemployment vs. Energy Prices"
          subtitle="Notice how unemployment LAGS energy price drops by several months"
          badge="LIVE"
          freshness="daily"
        />
        <ChartCard
          chartId="learn-energy-unemployment"
          title="AB Unemployment vs Energy Prices"
          timeRange={timeRange}
          source="StatsCan 14-10-0287, Bank of Canada"
        >
          <MultiSeriesLineChart
            data={jobsData}
            series={jobsSeries}
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
          label="Avg Weekly Earnings"
          value={`$${earningsTrend.latest.toFixed(0)}`}
          change={earningsTrend.change}
          direction={earningsTrend.direction}
          source="StatsCan"
        />
      </DataGrid>

      <Insight variant="watch">
        Unemployment is a <strong>lagging</strong> indicator. By the time it
        spikes, the economic shock started months ago. If you want early
        warning, watch the BCPI Energy chart and rig counts instead — they
        move 3 to 6 months before the job losses show up in the data.
      </Insight>
    </div>
  );
}

// ============================================================
// Section 4: The Migration Effect
// ============================================================

async function MigrationEffect() {
  const [migration, population, energyIndex] = await Promise.all([
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_NET_INTERPROVINCIAL.tableId,
      STATSCAN_SERIES.AB_NET_INTERPROVINCIAL.coordinate,
      80
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_POPULATION.tableId,
      STATSCAN_SERIES.AB_POPULATION.coordinate,
      80
    ).catch(() => []),
    fetchBoCTimeSeries(BOC_SERIES.BCPI_ENERGY, 80).catch(() => []),
  ]);

  const migrationTimeRange = computeTimeRange(migration);

  // Dual-axis: migration + energy
  const dateMap = new Map<string, { migration?: number; energy?: number }>();
  for (const p of migration) {
    const key = p.date.slice(0, 7);
    const existing = dateMap.get(key) || {};
    existing.migration = p.value;
    dateMap.set(key, existing);
  }
  for (const p of energyIndex) {
    const key = p.date.slice(0, 7);
    const existing = dateMap.get(key) || {};
    existing.energy = p.value;
    dateMap.set(key, existing);
  }

  const migrationData: MultiSeriesPoint[] = [...dateMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([, v]) => v.migration !== undefined)
    .map(([date, v]) => ({
      date: `${date}-01`,
      migration: v.migration!,
      ...(v.energy !== undefined ? { energy: v.energy } : {}),
    }));

  const migrationSeries: SeriesConfig[] = [
    {
      key: "migration",
      label: "Net Interprovincial Migration",
      color: "#ec4899",
      yAxisId: "left",
    },
    {
      key: "energy",
      label: "BCPI Energy",
      color: "#f97316",
      yAxisId: "right",
    },
  ];

  const migTrend = computeDirection(migration, 2);
  const popTrend = computeDirection(population, 2);

  return (
    <div className="space-y-4">
      <Prose>
        <p>
          Alberta isn&apos;t like Ontario or BC, where population growth is
          steady and predictable. Alberta&apos;s population swings with the
          energy cycle — dramatically.
        </p>
        <p>
          When oil booms, workers flood in from Ontario, BC, the Maritimes, and
          Saskatchewan. They need housing, so rents spike and house prices
          climb. When oil busts, many of those same workers leave. Apartments
          empty out, house prices soften, and vacancies climb.
        </p>
        <p>
          This creates a <strong>secondary wave</strong> that amplifies the
          original energy shock. Boom means shortage means prices up. Bust means
          vacancy means prices down. It&apos;s the same dollars, moving through
          the system.
        </p>
      </Prose>

      <Card>
        <CardHeader
          title="Interprovincial Migration vs. Energy Prices"
          subtitle="Net people moving to/from Alberta from other provinces"
          badge="LIVE"
          freshness="daily"
        />
        <ChartCard
          chartId="learn-energy-migration"
          title="AB Net Interprovincial Migration vs Energy"
          timeRange={migrationTimeRange}
          source="StatsCan 17-10-0008, Bank of Canada"
        >
          <MultiSeriesLineChart
            data={migrationData}
            series={migrationSeries}
            height={280}
            dualAxis
          />
        </ChartCard>
      </Card>

      <DataGrid>
        <LiveDataPoint
          label="Net Interprovincial Migration"
          value={migTrend.latest.toLocaleString()}
          change={migTrend.change}
          direction={migTrend.direction}
          source="StatsCan"
        />
        <LiveDataPoint
          label="AB Population"
          value={`${(popTrend.latest / 1_000_000).toFixed(2)}M`}
          change={popTrend.change}
          direction={popTrend.direction}
          source="StatsCan"
        />
      </DataGrid>

      <Insight>
        Alberta&apos;s population swings are more volatile than any other
        province because of energy. When you see the BCPI Energy index rising,
        expect housing pressure 12 to 18 months later as workers arrive. When
        it falls, expect the opposite.
      </Insight>
    </div>
  );
}

// ============================================================
// Section 5: The Diversification Question
// ============================================================

async function DiversificationSection() {
  const [gdpTotal, gdpOilGas, gdpTech, gdpRealEstate] = await Promise.all([
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_GDP.tableId,
      STATSCAN_SERIES.AB_GDP.coordinate,
      120
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_GDP_MINING_OIL_GAS.tableId,
      STATSCAN_SERIES.AB_GDP_MINING_OIL_GAS.coordinate,
      120
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_GDP_TECH.tableId,
      STATSCAN_SERIES.AB_GDP_TECH.coordinate,
      120
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_GDP_REAL_ESTATE.tableId,
      STATSCAN_SERIES.AB_GDP_REAL_ESTATE.coordinate,
      120
    ).catch(() => []),
  ]);

  // Compute share of total GDP for each sector over time
  const dateMap = new Map<
    string,
    { total?: number; oilGas?: number; tech?: number; realEstate?: number }
  >();

  for (const p of gdpTotal) {
    const key = p.date.slice(0, 7);
    const existing = dateMap.get(key) || {};
    existing.total = p.value;
    dateMap.set(key, existing);
  }
  for (const p of gdpOilGas) {
    const key = p.date.slice(0, 7);
    const existing = dateMap.get(key) || {};
    existing.oilGas = p.value;
    dateMap.set(key, existing);
  }
  for (const p of gdpTech) {
    const key = p.date.slice(0, 7);
    const existing = dateMap.get(key) || {};
    existing.tech = p.value;
    dateMap.set(key, existing);
  }
  for (const p of gdpRealEstate) {
    const key = p.date.slice(0, 7);
    const existing = dateMap.get(key) || {};
    existing.realEstate = p.value;
    dateMap.set(key, existing);
  }

  const shareData: MultiSeriesPoint[] = [...dateMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([, v]) => v.total && v.total > 0)
    .map(([date, v]) => ({
      date: `${date}-01`,
      oilGasShare: v.total ? ((v.oilGas ?? 0) / v.total) * 100 : 0,
      techShare: v.total ? ((v.tech ?? 0) / v.total) * 100 : 0,
      realEstateShare: v.total ? ((v.realEstate ?? 0) / v.total) * 100 : 0,
    }));

  const shareSeries: SeriesConfig[] = [
    {
      key: "oilGasShare",
      label: "Mining, Oil & Gas %",
      color: "#f97316",
      suffix: "%",
    },
    {
      key: "realEstateShare",
      label: "Real Estate %",
      color: "#3b82f6",
      suffix: "%",
    },
    {
      key: "techShare",
      label: "Tech & Information %",
      color: "#10b981",
      suffix: "%",
    },
  ];

  const timeRange = computeTimeRange(gdpTotal);

  // Check if tech grew during 2015-2016 bust
  const techTrend = computeDirection(gdpTech);

  return (
    <div className="space-y-4">
      <Prose>
        <p>
          &ldquo;Alberta needs to diversify.&rdquo; You&apos;ve heard it a
          thousand times. But is it actually happening? The data says: yes, but
          slowly. Diversification is a decades-long process, not a policy
          announcement.
        </p>
        <p>
          The chart below shows each sector&apos;s share of total Alberta GDP
          over time. Oil and gas still dominates, but watch the green line —
          tech and information services have been growing steadily, even during
          energy downturns. During the brutal 2015-2016 oil crash, when
          oil and gas GDP contracted sharply, tech GDP actually kept growing.
          That&apos;s the definition of diversification: sectors that move
          independently of energy.
        </p>
      </Prose>

      <Card>
        <CardHeader
          title="Sector Share of Alberta GDP"
          subtitle="How the economic pie is shifting over time"
          badge="LIVE"
          freshness="daily"
        />
        <ChartCard
          chartId="learn-energy-diversification"
          title="AB GDP Sector Shares"
          timeRange={timeRange}
          source="StatsCan 36-10-0402"
        >
          <MultiSeriesLineChart
            data={shareData}
            series={shareSeries}
            height={280}
          />
        </ChartCard>
      </Card>

      <DataGrid>
        <LiveDataPoint
          label="Tech GDP Trend"
          value={`$${(techTrend.latest / 1000).toFixed(1)}B`}
          change={techTrend.change}
          direction={techTrend.direction}
          source="StatsCan"
        />
      </DataGrid>

      <Prose>
        <p>
          Real estate&apos;s growing share is partly organic and partly a
          reflection of urbanization — more people living in Edmonton and
          Calgary means more housing transactions, more construction, more
          property management. Tech&apos;s growth reflects deliberate policy
          choices (incentives for AI, gaming, fintech companies to locate in
          Alberta) and market forces (lower cost of living than Vancouver or
          Toronto attracting talent).
        </p>
      </Prose>

      <Insight variant="lever">
        <strong>Policy lever:</strong> Government incentives for tech companies
        to locate in Alberta — tax credits, innovation grants, streamlined
        immigration for tech workers.{" "}
        <strong>Community lever:</strong> Entrepreneurship and retraining
        programs that help displaced energy workers transition into growing
        sectors. Both take years to show up in GDP — but the compounding
        is real.
      </Insight>
    </div>
  );
}

// ============================================================
// Closing: So What + LessonNav
// ============================================================

async function ClosingSection() {
  const energyIndex = await fetchBoCTimeSeries(BOC_SERIES.BCPI_ENERGY, 12).catch(
    () => []
  );

  const trend = computeDirection(energyIndex, 3);
  const trendDescription =
    trend.direction === "up"
      ? "energy prices are trending UP — expect employment strength, migration inflows, and housing pressure in the coming months"
      : trend.direction === "down"
      ? "energy prices are trending DOWN — watch for slowing capital investment, potential layoffs in the oil patch, and housing market softening 6-12 months out"
      : "energy prices are relatively flat — the economy is in a holding pattern, but watch for the next move";

  return (
    <div className="space-y-6">
      <SoWhat>
        <p>
          The energy-jobs-migration-housing chain takes 6 to 18 months to
          play out fully. Right now, {trendDescription}.
        </p>
        <p className="mt-2">
          Watch the BCPI Energy chart — it is 6 months ahead of everything
          else on this dashboard. When it moves, start watching the downstream
          indicators: unemployment, migration, building permits, housing prices.
          They will follow. They always do.
        </p>
      </SoWhat>

      <LessonNav
        prev={{ href: "/learn/housing-machine", label: "The Housing Machine" }}
        next={{
          href: "/learn/reading-the-signals",
          label: "Reading the Signals",
        }}
      />
    </div>
  );
}

// ============================================================
// Page
// ============================================================

export default function EnergyEconomyLesson() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
      <PageHeader
        title="Alberta's Energy Engine"
        description="How energy prices ripple through every corner of the province — jobs, migration, housing, and government revenue. Traced with live data."
        category="learn"
        icon={<Flame size={20} />}
      />

      {/* Opening */}
      <BigQuestion>What happens when oil prices drop?</BigQuestion>

      <Prose>
        <p>
          In Alberta, oil isn&apos;t just an industry — it&apos;s THE industry.
          When energy moves, everything moves with it. But <em>how</em> it
          moves, and how <em>fast</em>, is what most people get wrong.
        </p>
        <p>
          This lesson traces the chain from a barrel of oil all the way to your
          job, your neighbour&apos;s house price, and whether the new family
          down the street stays or leaves. Every chart uses live data. Every
          connection is backed by the numbers.
        </p>
      </Prose>

      {/* Section 1: The Engine */}
      <LessonSection title="1. The Engine — Energy Commodities">
        <Suspense fallback={<LoadingCard />}>
          <EnergyEngine />
        </Suspense>
      </LessonSection>

      {/* Section 2: GDP */}
      <LessonSection title="2. GDP — How Deep Does Energy Go?">
        <Suspense fallback={<LoadingCard />}>
          <GDPSection />
        </Suspense>
      </LessonSection>

      {/* Section 3: Jobs */}
      <LessonSection title="3. The Jobs Shockwave">
        <Suspense fallback={<LoadingCard />}>
          <JobsShockwave />
        </Suspense>
      </LessonSection>

      {/* Section 4: Migration */}
      <LessonSection title="4. The Migration Effect">
        <Suspense fallback={<LoadingCard />}>
          <MigrationEffect />
        </Suspense>
      </LessonSection>

      {/* Section 5: Diversification */}
      <LessonSection title="5. The Diversification Question">
        <Suspense fallback={<LoadingCard />}>
          <DiversificationSection />
        </Suspense>
      </LessonSection>

      {/* Closing */}
      <Suspense fallback={<LoadingCard />}>
        <ClosingSection />
      </Suspense>

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Alberta Pulse Check &mdash; Alberta&apos;s Energy Engine &mdash; All
        data from free public APIs
      </footer>
    </main>
  );
}
