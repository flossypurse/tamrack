import { Suspense } from "react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import {
  TimeSeriesAreaChart,
  TimeSeriesBarChart,
  MultiSeriesLineChart,
  type MultiSeriesPoint,
} from "@/components/chart";
import {
  Wheat,
  TrendingUp,
  DollarSign,
  BarChart3,
  Sprout,
} from "lucide-react";
import {
  fetchBoCTimeSeries,
  fetchStatCanTimeSeries,
  BOC_SERIES,
  STATSCAN_SERIES,
  type TimeSeriesPoint,
} from "@/lib/data-sources";

// ============================================================
// Data fetching
// ============================================================

async function getAgricultureMetrics() {
  const [agGdp, farmReceipts, agCommodity, cropReceipts, livestockReceipts] =
    await Promise.all([
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_GDP_AGRICULTURE.tableId,
        STATSCAN_SERIES.AB_GDP_AGRICULTURE.coordinate,
        4
      ).catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_FARM_CASH_RECEIPTS.tableId,
        STATSCAN_SERIES.AB_FARM_CASH_RECEIPTS.coordinate,
        4
      ).catch(() => []),
      fetchBoCTimeSeries(BOC_SERIES.BCPI_AGRICULTURE, 2).catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_FARM_CROP_RECEIPTS.tableId,
        STATSCAN_SERIES.AB_FARM_CROP_RECEIPTS.coordinate,
        4
      ).catch(() => []),
      fetchStatCanTimeSeries(
        STATSCAN_SERIES.AB_FARM_LIVESTOCK_RECEIPTS.tableId,
        STATSCAN_SERIES.AB_FARM_LIVESTOCK_RECEIPTS.coordinate,
        4
      ).catch(() => []),
    ]);

  const gdpLatest = agGdp.at(-1);
  const gdpPrev = agGdp.at(-2);
  const gdpChange = gdpLatest && gdpPrev
    ? ((gdpLatest.value - gdpPrev.value) / gdpPrev.value * 100).toFixed(1)
    : null;

  const receiptsLatest = farmReceipts.at(-1);
  const agIndex = agCommodity.at(-1);

  return {
    agGdp: gdpLatest
      ? `$${(gdpLatest.value / 1_000).toFixed(1)}B`
      : "—",
    gdpChange: gdpChange
      ? `${parseFloat(gdpChange) >= 0 ? "+" : ""}${gdpChange}%`
      : undefined,
    farmReceipts: receiptsLatest
      ? `$${(receiptsLatest.value / 1_000).toFixed(1)}B`
      : "—",
    agCommodityIndex: agIndex
      ? agIndex.value.toFixed(1)
      : "—",
    cropReceipts: cropReceipts.at(-1)
      ? `$${(cropReceipts.at(-1)!.value / 1_000).toFixed(1)}B`
      : "—",
  };
}

// ============================================================
// Sections
// ============================================================

async function AgricultureMetrics() {
  const m = await getAgricultureMetrics();
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Agriculture GDP"
        value={m.agGdp}
        change={m.gdpChange}
        changeLabel="vs prev period"
        source="StatsCan 36-10-0402"
      />
      <MetricCard
        title="Farm Cash Receipts"
        value={m.farmReceipts}
        source="StatsCan 32-10-0359"
      />
      <MetricCard
        title="Ag Commodity Index"
        value={m.agCommodityIndex}
        source="BoC BCPI Agriculture"
      />
      <MetricCard
        title="Crop Receipts"
        value={m.cropReceipts}
        source="StatsCan 32-10-0359"
      />
    </div>
  );
}

async function AgCommodityChart() {
  const data = await fetchBoCTimeSeries(BOC_SERIES.BCPI_AGRICULTURE, 240);
  return (
    <Card>
      <CardHeader
        title="BoC Agriculture Commodity Price Index"
        subtitle="Tracks prices of Canadian agricultural exports — grains, oilseeds, livestock"
        badge="LIVE"
      />
      <TimeSeriesAreaChart data={data} color="#f59e0b" height={280} />
      <p className="text-[10px] text-muted/60 mt-2">
        Alberta is Canada&apos;s largest beef producer and a major canola/wheat exporter.
        This index tracks the prices farmers receive — drives farm income, rural spending, and land values.
      </p>
    </Card>
  );
}

async function AgGdpChart() {
  const { tableId, coordinate } = STATSCAN_SERIES.AB_GDP_AGRICULTURE;
  const data = await fetchStatCanTimeSeries(tableId, coordinate, 40);
  return (
    <Card>
      <CardHeader
        title="Agriculture GDP — Alberta"
        subtitle="Real GDP for agriculture, forestry, fishing & hunting (chained 2017$)"
        badge="LIVE"
      />
      <TimeSeriesAreaChart data={data} color="#10b981" compact height={250} />
    </Card>
  );
}

async function FarmCashReceiptsChart() {
  const { tableId, coordinate } = STATSCAN_SERIES.AB_FARM_CASH_RECEIPTS;
  const data = await fetchStatCanTimeSeries(tableId, coordinate, 40);
  return (
    <Card>
      <CardHeader
        title="Farm Cash Receipts — Alberta"
        subtitle="Total farm revenue from crops, livestock, and direct payments"
        badge="LIVE"
      />
      <TimeSeriesBarChart data={data} color="#f59e0b" compact height={250} />
    </Card>
  );
}

async function CropVsLivestockChart() {
  const [crop, livestock] = await Promise.all([
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_FARM_CROP_RECEIPTS.tableId,
      STATSCAN_SERIES.AB_FARM_CROP_RECEIPTS.coordinate,
      40
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_FARM_LIVESTOCK_RECEIPTS.tableId,
      STATSCAN_SERIES.AB_FARM_LIVESTOCK_RECEIPTS.coordinate,
      40
    ).catch(() => []),
  ]);

  const dateMap = new Map<string, MultiSeriesPoint>();
  for (const p of crop) {
    dateMap.set(p.date, { date: p.date, crop: p.value, livestock: 0 });
  }
  for (const p of livestock) {
    const existing = dateMap.get(p.date);
    if (existing) existing.livestock = p.value;
  }
  const merged = Array.from(dateMap.values())
    .filter((p) => p.crop || p.livestock)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  return (
    <Card>
      <CardHeader
        title="Crop vs Livestock Receipts"
        subtitle="The two pillars of Alberta agriculture — do they move together?"
        badge="LIVE"
      />
      <MultiSeriesLineChart
        data={merged}
        series={[
          { key: "crop", label: "Crop Receipts", color: "#f59e0b" },
          { key: "livestock", label: "Livestock Receipts", color: "#ef4444" },
        ]}
        height={300}
      />
    </Card>
  );
}

async function AgVsEnergyChart() {
  const [agIndex, energyIndex] = await Promise.all([
    fetchBoCTimeSeries(BOC_SERIES.BCPI_AGRICULTURE, 120).catch(() => []),
    fetchBoCTimeSeries(BOC_SERIES.BCPI_ENERGY, 120).catch(() => []),
  ]);

  const dateMap = new Map<string, MultiSeriesPoint>();
  for (const p of agIndex) {
    dateMap.set(p.date, { date: p.date, agriculture: p.value, energy: 0 });
  }
  for (const p of energyIndex) {
    const existing = dateMap.get(p.date);
    if (existing) existing.energy = p.value;
  }
  const merged = Array.from(dateMap.values())
    .filter((p) => p.agriculture && p.energy)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  return (
    <Card>
      <CardHeader
        title="Agriculture vs Energy Commodity Prices"
        subtitle="When both are strong, Alberta booms hard. When they diverge, interesting dynamics emerge."
        badge="LIVE"
      />
      <MultiSeriesLineChart
        data={merged}
        series={[
          { key: "agriculture", label: "Agriculture", color: "#f59e0b", yAxisId: "left" },
          { key: "energy", label: "Energy", color: "#f97316", yAxisId: "right" },
        ]}
        height={300}
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
// Context
// ============================================================

function AgricultureContext() {
  return (
    <Card>
      <h3 className="text-sm font-medium mb-3">Alberta&apos;s Other Pillar</h3>
      <div className="space-y-3 text-xs text-muted">
        <p>
          Agriculture is a $15B+ industry in Alberta — second only to energy. It runs on
          completely different cycles: weather, global commodity markets, trade policy, and
          exchange rates. This creates interesting dynamics in the Parkland County area.
        </p>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="border border-card-border rounded-lg p-3">
            <p className="font-medium text-foreground mb-1">Key Products</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Beef cattle (#1 in Canada)</li>
              <li>Canola (major exporter)</li>
              <li>Wheat & barley</li>
              <li>Pulse crops (peas, lentils)</li>
              <li>Greenhouse & nursery</li>
            </ul>
          </div>
          <div className="border border-card-border rounded-lg p-3">
            <p className="font-medium text-foreground mb-1">Parkland County Impact</p>
            <p>Parkland County straddles the urban-rural divide. Agricultural land values
            are influenced by both farming economics AND suburban development pressure.
            When both energy AND agriculture are strong, rural land prices surge.</p>
          </div>
          <div className="border border-card-border rounded-lg p-3">
            <p className="font-medium text-foreground mb-1">Emerging: AgriTech</p>
            <p>AI-driven precision agriculture is a growing Alberta niche. Wyvern (Edmonton)
            does hyperspectral satellite imaging. Strong institutional support from U of A
            and NAIT. Potential SaaS opportunity for small/mid farms.</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ============================================================
// Page
// ============================================================

export default function AgriculturePage() {
  return (
    <main className="min-h-screen p-6 max-w-7xl mx-auto space-y-6">
      <header>
        <div className="flex items-center gap-2 mb-1">
          <Wheat size={20} className="text-amber-400" />
          <h1 className="text-xl font-semibold tracking-tight">
            The Other Pillar
          </h1>
        </div>
        <p className="text-sm text-muted">
          Agriculture is Alberta&apos;s second economic engine — $15B+ in farm cash receipts,
          running on different cycles than energy. When both are strong, Alberta booms hard.
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
          <AgricultureMetrics />
        </Suspense>
      </section>

      {/* Hero: Commodity Index */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={16} className="text-amber-400" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Agricultural Commodity Prices
          </h2>
        </div>
        <Suspense fallback={<LoadingCard />}>
          <AgCommodityChart />
        </Suspense>
      </section>

      {/* GDP & Revenue */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <DollarSign size={16} className="text-emerald-400" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Output &amp; Revenue
          </h2>
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <AgGdpChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <FarmCashReceiptsChart />
          </Suspense>
        </div>
      </section>

      {/* Breakdown */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 size={16} className="text-red-400" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Crop vs Livestock
          </h2>
        </div>
        <Suspense fallback={<LoadingCard />}>
          <CropVsLivestockChart />
        </Suspense>
      </section>

      {/* Ag vs Energy */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Sprout size={16} className="text-orange-400" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Agriculture vs Energy
          </h2>
        </div>
        <Suspense fallback={<LoadingCard />}>
          <AgVsEnergyChart />
        </Suspense>
      </section>

      {/* Context */}
      <section>
        <AgricultureContext />
      </section>

      {/* Coming Soon */}
      <section>
        <Card>
          <h3 className="text-sm font-medium mb-2">Coming Soon</h3>
          <div className="grid sm:grid-cols-2 gap-3 text-xs text-muted">
            <div className="flex items-start gap-2">
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
                PLANNED
              </span>
              <div>
                <p className="font-medium text-foreground">Alberta Crop Report</p>
                <p>Weekly crop condition summaries during growing season (April-October). Real-time agricultural health monitoring.</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
                PLANNED
              </span>
              <div>
                <p className="font-medium text-foreground">Commodity Futures</p>
                <p>Canola, wheat, and cattle futures prices — forward-looking signals for farm income.</p>
              </div>
            </div>
          </div>
        </Card>
      </section>

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Alberta Pulse Check &mdash; Agriculture &mdash; All data from free public APIs
      </footer>
    </main>
  );
}
