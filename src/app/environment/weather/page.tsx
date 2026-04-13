import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import { ChartCard } from "@/components/chart-card";
import { computeTimeRange } from "@/lib/time-range";
import { TimeSeriesAreaChart } from "@/components/chart";
import {
  CloudSun,
  Thermometer,
  Eye,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import {
  fetchAlbertaWeather,
  fetchClimateMonthly,
  type CurrentWeather,
  type TimeSeriesPoint,
} from "@/lib/data-sources";

// ============================================================
// Server-side data fetching
// ============================================================

async function CurrentConditionsTable() {
  const stations = await fetchAlbertaWeather().catch(() => [] as CurrentWeather[]);

  if (!stations.length) {
    return (
      <Card>
        <p className="text-sm text-muted">No weather data available.</p>
      </Card>
    );
  }

  const displayed = stations.slice(0, 25);

  return (
    <Card>
      <CardHeader
        title="Current Conditions Across Alberta"
        subtitle={`${stations.length} stations reporting`}
        badge="LIVE"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-card-border text-left text-muted">
              <th className="py-2 pr-3 font-medium">City</th>
              <th className="py-2 pr-3 font-medium">Temp (&deg;C)</th>
              <th className="py-2 pr-3 font-medium">Condition</th>
              <th className="py-2 pr-3 font-medium">Humidity (%)</th>
              <th className="py-2 pr-3 font-medium">Wind (km/h)</th>
              <th className="py-2 pr-3 font-medium">Wind Chill</th>
              <th className="py-2 pr-3 font-medium">Pressure (kPa)</th>
              <th className="py-2 font-medium">Visibility (km)</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((s, i) => (
              <tr
                key={`${s.station}-${i}`}
                className="border-b border-card-border/50 hover:bg-card-border/20"
              >
                <td className="py-1.5 pr-3 font-medium">{s.station}</td>
                <td
                  className={`py-1.5 pr-3 font-mono ${
                    s.temperature !== null && s.temperature < 0
                      ? "text-blue-400"
                      : s.temperature !== null && s.temperature > 25
                        ? "text-red-400"
                        : ""
                  }`}
                >
                  {s.temperature !== null ? s.temperature.toFixed(1) : "—"}
                </td>
                <td className="py-1.5 pr-3">{s.condition || "—"}</td>
                <td className="py-1.5 pr-3 font-mono">
                  {s.humidity !== null ? s.humidity : "—"}
                </td>
                <td className="py-1.5 pr-3 font-mono">
                  {s.windSpeed !== null ? s.windSpeed : "—"}
                </td>
                <td className="py-1.5 pr-3 font-mono">
                  {s.windChill !== null ? s.windChill : "—"}
                </td>
                <td className="py-1.5 pr-3 font-mono">
                  {s.pressure !== null ? s.pressure : "—"}
                </td>
                <td className="py-1.5 font-mono">
                  {s.visibility !== null ? s.visibility : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

async function WeatherMetrics() {
  const stations = await fetchAlbertaWeather().catch(() => [] as CurrentWeather[]);

  const withTemp = stations.filter((s) => s.temperature !== null);
  const warmest = withTemp.length
    ? withTemp.reduce((a, b) => (a.temperature! > b.temperature! ? a : b))
    : null;
  const coldest = withTemp.length
    ? withTemp.reduce((a, b) => (a.temperature! < b.temperature! ? a : b))
    : null;
  const avgTemp = withTemp.length
    ? (withTemp.reduce((sum, s) => sum + s.temperature!, 0) / withTemp.length).toFixed(1)
    : "—";

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Warmest Station"
        value={warmest ? `${warmest.temperature!.toFixed(1)}°C` : "—"}
        changeLabel={warmest?.station}
        source="ECCC GeoMet"
      />
      <MetricCard
        title="Coldest Station"
        value={coldest ? `${coldest.temperature!.toFixed(1)}°C` : "—"}
        changeLabel={coldest?.station}
        source="ECCC GeoMet"
      />
      <MetricCard
        title="Average Temp"
        value={avgTemp !== "—" ? `${avgTemp}°C` : "—"}
        changeLabel="across all stations"
        source="ECCC GeoMet"
      />
      <MetricCard
        title="Stations Reporting"
        value={String(stations.length)}
        source="ECCC GeoMet"
      />
    </div>
  );
}

async function EdmontonClimateChart() {
  const data: TimeSeriesPoint[] = await fetchClimateMonthly("3012216", 120).catch(
    () => [] as TimeSeriesPoint[]
  );
  const timeRange = computeTimeRange(data);
  return (
    <ChartCard chartId="weather-edmonton-climate" title="Edmonton Monthly Mean Temperature" timeRange={timeRange} source="ECCC GeoMet">
      <Card>
        <CardHeader
          title="Edmonton Monthly Mean Temperature"
          subtitle="Blatchford station — 10-year monthly history"
          badge="LIVE"
        />
        <TimeSeriesAreaChart data={data} color="#f97316" height={280} />
      </Card>
    </ChartCard>
  );
}

async function CalgaryClimateChart() {
  const data: TimeSeriesPoint[] = await fetchClimateMonthly("3031093", 120).catch(
    () => [] as TimeSeriesPoint[]
  );
  const timeRange = computeTimeRange(data);
  return (
    <ChartCard chartId="weather-calgary-climate" title="Calgary Monthly Mean Temperature" timeRange={timeRange} source="ECCC GeoMet">
      <Card>
        <CardHeader
          title="Calgary Monthly Mean Temperature"
          subtitle="Calgary Int'l station — 10-year monthly history"
          badge="LIVE"
        />
        <TimeSeriesAreaChart data={data} color="#3b82f6" height={280} />
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

export const metadata: Metadata = {
  title: "Alberta Weather Conditions",
  description: "Real-time weather conditions across Alberta — temperature, wind, humidity, and visibility from Environment Canada monitoring stations.",
  alternates: {
    canonical: "https://albertapulsecheck.ca/environment/weather",
  },
};

export default function WeatherPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Alberta Weather"
        description="Real-time weather conditions across Alberta — temperature, wind, humidity, and visibility from Environment and Climate Change Canada stations."
        category="environment"
        icon={<CloudSun size={20} />}
      />

      {/* Key Metrics */}
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
          <WeatherMetrics />
        </Suspense>
      </section>

      {/* Current Conditions Table */}
      <section>
        <SectionHeader title="Current Conditions" icon={<Thermometer size={16} />} category="environment" />
        <Suspense fallback={<LoadingCard />}>
          <CurrentConditionsTable />
        </Suspense>
      </section>

      {/* Climate History */}
      <section>
        <SectionHeader title="Climate History" icon={<Eye size={16} />} category="environment" />
        <div className="grid md:grid-cols-2 gap-4">
          <Suspense fallback={<LoadingCard />}>
            <EdmontonClimateChart />
          </Suspense>
          <Suspense fallback={<LoadingCard />}>
            <CalgaryClimateChart />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
