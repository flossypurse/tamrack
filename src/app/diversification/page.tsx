import { Suspense } from "react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import {
  TimeSeriesAreaChart,
  MultiSeriesLineChart,
  type MultiSeriesPoint,
} from "@/components/chart";
import {
  GitBranch,
  Factory,
  Building2,
  Briefcase,
  Cpu,
  TrendingUp,
} from "lucide-react";
import {
  fetchStatCanTimeSeries,
  fetchEdmontonBusinessLicences,
  fetchEdmontonPermitsSummary,
  STATSCAN_SERIES,
  type TimeSeriesPoint,
} from "@/lib/data-sources";

// ============================================================
// Data fetching
// ============================================================

async function getDiversificationMetrics() {
  const [totalGdp, oilGasGdp, constructionGdp, agGdp, manufacturingGdp, techGdp] =
    await Promise.all([
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_GDP.tableId,
        STATSCAN_SERIES.AB_GDP.coordinate,
        4
      ).catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_GDP_MINING_OIL_GAS.tableId,
        STATSCAN_SERIES.AB_GDP_MINING_OIL_GAS.coordinate,
        4
      ).catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_GDP_CONSTRUCTION.tableId,
        STATSCAN_SERIES.AB_GDP_CONSTRUCTION.coordinate,
        4
      ).catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_GDP_AGRICULTURE.tableId,
        STATSCAN_SERIES.AB_GDP_AGRICULTURE.coordinate,
        4
      ).catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_GDP_MANUFACTURING.tableId,
        STATSCAN_SERIES.AB_GDP_MANUFACTURING.coordinate,
        4
      ).catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_GDP_TECH.tableId,
        STATSCAN_SERIES.AB_GDP_TECH.coordinate,
        4
      ).catch(() => []),
    ]);

  const total = totalGdp.at(-1)?.value || 0;
  const oilGas = oilGasGdp.at(-1)?.value || 0;
  const construction = constructionGdp.at(-1)?.value || 0;

  const oilGasShare = total > 0 ? ((oilGas / total) * 100).toFixed(1) : "—";
  const constructionShare = total > 0 ? ((construction / total) * 100).toFixed(1) : "—";

  // Compare oil/gas share to previous period
  const prevTotal = totalGdp.at(-2)?.value || 0;
  const prevOilGas = oilGasGdp.at(-2)?.value || 0;
  const prevShare = prevTotal > 0 ? (prevOilGas / prevTotal) * 100 : 0;
  const currentShare = total > 0 ? (oilGas / total) * 100 : 0;
  const shareChange = prevShare > 0
    ? (currentShare - prevShare).toFixed(1)
    : null;

  return {
    totalGdp: total > 0 ? `$${(total / 1_000).toFixed(0)}B` : "—",
    oilGasShare: oilGasShare !== "—" ? `${oilGasShare}%` : "—",
    shareChange: shareChange
      ? `${parseFloat(shareChange) >= 0 ? "+" : ""}${shareChange}pp`
      : undefined,
    constructionShare: constructionShare !== "—" ? `${constructionShare}%` : "—",
    techGdp: techGdp.at(-1)?.value
      ? `$${(techGdp.at(-1)!.value / 1_000).toFixed(1)}B`
      : "—",
  };
}

// ============================================================
// Sections
// ============================================================

async function DiversificationMetrics() {
  const m = await getDiversificationMetrics();
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Alberta GDP"
        value={m.totalGdp}
        source="StatsCan 36-10-0402"
      />
      <MetricCard
        title="Oil/Gas Share of GDP"
        value={m.oilGasShare}
        change={m.shareChange}
        changeLabel="vs prev period"
        source="StatsCan 36-10-0402"
      />
      <MetricCard
        title="Construction Share"
        value={m.constructionShare}
        source="StatsCan 36-10-0402"
      />
      <MetricCard
        title="Tech/Professional GDP"
        value={m.techGdp}
        source="StatsCan 36-10-0402"
      />
    </div>
  );
}

async function GdpByIndustryChart() {
  const [oilGas, construction, agriculture, manufacturing, tech, realEstate] =
    await Promise.all([
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_GDP_MINING_OIL_GAS.tableId,
        STATSCAN_SERIES.AB_GDP_MINING_OIL_GAS.coordinate,
        40
      ).catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_GDP_CONSTRUCTION.tableId,
        STATSCAN_SERIES.AB_GDP_CONSTRUCTION.coordinate,
        40
      ).catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_GDP_AGRICULTURE.tableId,
        STATSCAN_SERIES.AB_GDP_AGRICULTURE.coordinate,
        40
      ).catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_GDP_MANUFACTURING.tableId,
        STATSCAN_SERIES.AB_GDP_MANUFACTURING.coordinate,
        40
      ).catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_GDP_TECH.tableId,
        STATSCAN_SERIES.AB_GDP_TECH.coordinate,
        40
      ).catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_GDP_REAL_ESTATE.tableId,
        STATSCAN_SERIES.AB_GDP_REAL_ESTATE.coordinate,
        40
      ).catch(() => []),
    ]);

  // Merge all by date
  const dateMap = new Map<string, MultiSeriesPoint>();
  const addSeries = (data: TimeSeriesPoint[], key: string) => {
    for (const p of data) {
      if (!dateMap.has(p.date)) {
        dateMap.set(p.date, { date: p.date });
      }
      dateMap.get(p.date)![key] = p.value;
    }
  };
  addSeries(oilGas, "oilGas");
  addSeries(construction, "construction");
  addSeries(agriculture, "agriculture");
  addSeries(manufacturing, "manufacturing");
  addSeries(tech, "tech");
  addSeries(realEstate, "realEstate");

  const merged = Array.from(dateMap.values()).sort((a, b) =>
    String(a.date).localeCompare(String(b.date))
  );

  return (
    <Card>
      <CardHeader
        title="GDP by Industry — Alberta"
        subtitle="Real GDP by major sector (chained 2017$). Is the mix changing?"
        badge="LIVE"
      />
      <MultiSeriesLineChart
        data={merged}
        series={[
          { key: "oilGas", label: "Mining/Oil/Gas", color: "#f97316" },
          { key: "construction", label: "Construction", color: "#3b82f6" },
          { key: "manufacturing", label: "Manufacturing", color: "#8b5cf6" },
          { key: "tech", label: "Tech/Professional", color: "#10b981" },
          { key: "realEstate", label: "Real Estate", color: "#ec4899" },
          { key: "agriculture", label: "Agriculture", color: "#f59e0b" },
        ]}
        height={350}
      />
      <p className="text-[10px] text-muted/60 mt-2">
        If diversification is real, you&apos;d see non-energy lines growing faster than the orange line over time.
      </p>
    </Card>
  );
}

async function OilGasShareChart() {
  const [totalGdp, oilGasGdp] = await Promise.all([
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_GDP.tableId,
      STATSCAN_SERIES.AB_GDP.coordinate,
      40
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_GDP_MINING_OIL_GAS.tableId,
      STATSCAN_SERIES.AB_GDP_MINING_OIL_GAS.coordinate,
      40
    ).catch(() => []),
  ]);

  // Compute share over time
  const shareData: TimeSeriesPoint[] = [];
  const dateValues = new Map<string, number>();
  for (const p of totalGdp) dateValues.set(p.date, p.value);
  for (const p of oilGasGdp) {
    const total = dateValues.get(p.date);
    if (total && total > 0) {
      shareData.push({
        date: p.date,
        value: parseFloat(((p.value / total) * 100).toFixed(1)),
      });
    }
  }

  return (
    <Card>
      <CardHeader
        title="Oil & Gas Share of GDP"
        subtitle="Mining/Oil/Gas as percentage of total Alberta GDP over time"
        badge="LIVE"
      />
      <TimeSeriesAreaChart
        data={shareData}
        color="#f97316"
        valueSuffix="%"
        height={250}
      />
      <p className="text-[10px] text-muted/60 mt-2">
        A declining trend here means Alberta is genuinely diversifying — not just growing energy alongside everything else.
      </p>
    </Card>
  );
}

async function TechGdpChart() {
  const { tableId, coordinate } = STATSCAN_SERIES.AB_GDP_TECH;
  const data = await fetchStatCanTimeSeries(tableId, coordinate, 40);
  return (
    <Card>
      <CardHeader
        title="Tech & Professional Services GDP"
        subtitle="Professional, scientific & technical services — Alberta's tech proxy"
        badge="LIVE"
      />
      <TimeSeriesAreaChart data={data} color="#10b981" compact height={250} />
    </Card>
  );
}

async function BusinessLicencesChart() {
  const data = await fetchEdmontonBusinessLicences();
  return (
    <Card>
      <CardHeader
        title="Edmonton Business Licences"
        subtitle="New business formation — are non-energy businesses growing?"
        badge="LIVE"
      />
      <TimeSeriesAreaChart
        data={data.map((d) => ({ ...d, value: d.value }))}
        color="#8b5cf6"
      />
    </Card>
  );
}

async function BuildingPermitsChart() {
  const data = await fetchEdmontonPermitsSummary();
  return (
    <Card>
      <CardHeader
        title="Edmonton Building Permits"
        subtitle="Monthly permits — construction diversification signal"
        badge="LIVE"
      />
      <TimeSeriesAreaChart
        data={data.map((d) => ({ ...d, value: d.value }))}
        color="#f59e0b"
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
// Context cards
// ============================================================

function DiversificationContext() {
  return (
    <Card>
      <h3 className="text-sm font-medium mb-3">The Diversification Question</h3>
      <div className="space-y-3 text-xs text-muted">
        <p>
          Alberta has been trying to diversify away from energy for decades. The province&apos;s
          current bet: <strong className="text-foreground">$100B in data centre investment</strong>,
          a tech sector growing 3x faster than the overall economy, and aggressive clean energy transition.
        </p>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="border border-card-border rounded-lg p-3">
            <p className="font-medium text-foreground mb-1">Bull Case</p>
            <p>Tech VC funding surpassed BC in 2024. Edmonton AI corridor is real. Data centre
            zoning in Parkland County. Structural shift underway.</p>
          </div>
          <div className="border border-card-border rounded-lg p-3">
            <p className="font-medium text-foreground mb-1">Bear Case</p>
            <p>Every previous diversification push faded when oil recovered. Energy still
            dominates government revenue. Tech gains are from a small base.</p>
          </div>
          <div className="border border-card-border rounded-lg p-3">
            <p className="font-medium text-foreground mb-1">Watch For</p>
            <p>Oil/Gas GDP share declining even during energy booms. Non-energy business
            licences growing faster than population. Tech GDP crossing construction GDP.</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ============================================================
// Page
// ============================================================

export default function DiversificationPage() {
  return (
    <main className="min-h-screen p-6 max-w-7xl mx-auto space-y-6">
      <header>
        <div className="flex items-center gap-2 mb-1">
          <GitBranch size={20} className="text-emerald-400" />
          <h1 className="text-xl font-semibold tracking-tight">
            Is Alberta Actually Changing?
          </h1>
        </div>
        <p className="text-sm text-muted">
          Tracking whether Alberta&apos;s economy is genuinely diversifying away from
          energy, or just growing everything together during a boom.
        </p>
      </header>

      {/* Metrics */}
      <section>
        <Suspense
          fallback={
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
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
          <DiversificationMetrics />
        </Suspense>
      </section>

      {/* Hero: GDP by Industry */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Factory size={16} className="text-orange-400" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Industry Composition
          </h2>
        </div>
        <Suspense fallback={<LoadingCard />}>
          <GdpByIndustryChart />
        </Suspense>
      </section>

      {/* Energy Dependency */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={16} className="text-orange-400" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Energy Dependency
          </h2>
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <OilGasShareChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <TechGdpChart />
          </Suspense>
        </div>
      </section>

      {/* Business Activity */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Briefcase size={16} className="text-purple-400" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Business Activity
          </h2>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <BusinessLicencesChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <BuildingPermitsChart />
          </Suspense>
        </div>
      </section>

      {/* Context */}
      <section>
        <DiversificationContext />
      </section>

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Alberta Pulse &mdash; Diversification &mdash; All data from free public APIs
      </footer>
    </main>
  );
}
