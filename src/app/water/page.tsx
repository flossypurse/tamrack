import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import {
  Waves,
  Droplets,
  Gauge,
  MapPin,
  AlertTriangle,
} from "lucide-react";
import {
  fetchAlbertaWaterLevels,
  type HydrometricReading,
} from "@/lib/data-sources";

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
// Server-side data components
// ============================================================

async function WaterMetrics() {
  const readings = await fetchAlbertaWaterLevels().catch(() => []);

  const totalStations = readings.length;
  const withLevel = readings.filter((r) => r.waterLevel !== null).length;
  const withDischarge = readings.filter((r) => r.discharge !== null).length;

  const dischargeValues = readings
    .filter((r) => r.discharge !== null)
    .map((r) => r.discharge as number);
  const avgDischarge =
    dischargeValues.length > 0
      ? dischargeValues.reduce((a, b) => a + b, 0) / dischargeValues.length
      : null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Stations Reporting"
        value={String(totalStations)}
        source="ECCC Hydrometric"
      />
      <MetricCard
        title="With Water Level Data"
        value={String(withLevel)}
        source="ECCC Hydrometric"
      />
      <MetricCard
        title="With Discharge Data"
        value={String(withDischarge)}
        source="ECCC Hydrometric"
      />
      <MetricCard
        title="Avg Discharge"
        value={avgDischarge !== null ? `${avgDischarge.toFixed(1)} m³/s` : "—"}
        source="ECCC Hydrometric"
      />
    </div>
  );
}

async function WaterLevelsTable() {
  const readings = await fetchAlbertaWaterLevels().catch(
    () => [] as HydrometricReading[]
  );

  const sorted = [...readings].sort((a, b) =>
    a.stationName.localeCompare(b.stationName)
  );

  return (
    <Card>
      <CardHeader
        title="Water Levels by Station"
        subtitle={`${sorted.length} stations reporting`}
        badge="LIVE"
      />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-card-border text-left text-muted">
              <th className="pb-2 pr-4 font-medium">Station Name</th>
              <th className="pb-2 pr-4 font-medium">Station ID</th>
              <th className="pb-2 pr-4 font-medium text-right">
                Water Level (m)
              </th>
              <th className="pb-2 pr-4 font-medium text-right">
                Discharge (m³/s)
              </th>
              <th className="pb-2 pr-4 font-medium">Last Reading</th>
              <th className="pb-2 font-medium">Location</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr
                key={r.stationId}
                className="border-b border-card-border/50 hover:bg-card-border/20"
              >
                <td className="py-2 pr-4 font-medium text-foreground">
                  {r.stationName}
                </td>
                <td className="py-2 pr-4 font-mono text-muted">
                  {r.stationId}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums">
                  {r.waterLevel !== null ? r.waterLevel.toFixed(2) : "—"}
                </td>
                <td className="py-2 pr-4 text-right tabular-nums">
                  {r.discharge !== null ? r.discharge.toFixed(1) : "—"}
                </td>
                <td className="py-2 pr-4 text-muted">
                  {r.date
                    ? new Date(r.date).toLocaleString("en-CA", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </td>
                <td className="py-2 text-muted">
                  {r.latitude.toFixed(2)}°N, {Math.abs(r.longitude).toFixed(2)}
                  °W
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted">
                  No water level data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ============================================================
// Page
// ============================================================

export const metadata: Metadata = {
  title: "Alberta Water Levels & River Monitoring",
  description: "Live monitoring of Alberta's river systems, water levels, and flood risk indicators from government hydrometric stations.",
};

export default function WaterPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <header>
        <div className="flex items-center gap-3 mb-2">
          <Waves size={24} className="text-blue-400" />
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
            Water &amp; Rivers
          </h1>
        </div>
        <p className="text-sm text-muted">
          Monitoring Alberta&apos;s river systems, water levels, and flood risk.
          Real-time hydrometric data from Environment and Climate Change Canada
          stations across the province.
        </p>
      </header>

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
          <WaterMetrics />
        </Suspense>
      </section>

      {/* Water Levels Table */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Gauge size={16} className="text-blue-400" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Station Readings
          </h2>
        </div>
        <Suspense fallback={<LoadingCard />}>
          <WaterLevelsTable />
        </Suspense>
      </section>

      {/* Major Rivers */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <MapPin size={16} className="text-cyan-400" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Major River Basins
          </h2>
        </div>
        <Card>
          <CardHeader
            title="Alberta's Major Rivers"
            subtitle="Key river systems and their significance"
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1">
              <p className="font-medium text-foreground flex items-center gap-1.5">
                <Droplets size={12} className="text-blue-400" />
                North Saskatchewan River
              </p>
              <p className="text-muted">
                Flows through Edmonton. Primary water supply for the capital
                region. Fed by glaciers in the Rocky Mountains — levels peak in
                summer with snowmelt.
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-foreground flex items-center gap-1.5">
                <Droplets size={12} className="text-blue-400" />
                South Saskatchewan River
              </p>
              <p className="text-muted">
                Serves Calgary and Lethbridge. Formed by the confluence of the
                Bow and Oldman rivers. Critical for southern Alberta irrigation
                and agriculture.
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-foreground flex items-center gap-1.5">
                <Droplets size={12} className="text-blue-400" />
                Bow River
              </p>
              <p className="text-muted">
                Runs through Calgary and Banff. The 2013 flood on the Bow caused
                catastrophic damage to downtown Calgary and surrounding
                communities.
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-foreground flex items-center gap-1.5">
                <Droplets size={12} className="text-blue-400" />
                Athabasca River
              </p>
              <p className="text-muted">
                Flows through Fort McMurray and Jasper. Longest undammed river in
                Alberta. Key water source for oil sands operations and northern
                communities.
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-foreground flex items-center gap-1.5">
                <Droplets size={12} className="text-blue-400" />
                Peace River
              </p>
              <p className="text-muted">
                Major river in northwestern Alberta. Site of the W.A.C. Bennett
                Dam in BC, which controls flow into Alberta. Important for
                agriculture in the Peace Country.
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-foreground flex items-center gap-1.5">
                <Droplets size={12} className="text-blue-400" />
                Red Deer River
              </p>
              <p className="text-muted">
                Central Alberta&apos;s main waterway. Flows through Red Deer and
                the Badlands. Important for municipal water supply and
                agricultural irrigation in the region.
              </p>
            </div>
          </div>
        </Card>
      </section>

      {/* Flood Risk Context */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={16} className="text-amber-400" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Flood Risk Context
          </h2>
        </div>
        <Card>
          <CardHeader
            title="Why Water Levels Matter for Property Decisions"
            subtitle="Alberta has significant flood exposure"
          />
          <div className="space-y-3 text-xs text-muted">
            <p>
              Alberta faces significant flood risk, particularly along its major
              river systems. The{" "}
              <span className="text-foreground font-medium">
                2013 Southern Alberta flood
              </span>{" "}
              caused an estimated{" "}
              <span className="text-foreground font-medium">
                $6 billion in damage
              </span>
              , making it the costliest natural disaster in Canadian history at
              the time. Over 100,000 people were displaced across Calgary, High
              River, and surrounding communities.
            </p>
            <p>
              <span className="text-foreground font-medium">
                Spring runoff + heavy rain = flood risk.
              </span>{" "}
              Alberta&apos;s rivers are fed by Rocky Mountain snowpack. A warm
              spring with rapid snowmelt, combined with heavy rainfall, can push
              rivers well above flood stage. The risk window is typically May
              through July, though ice jams can cause winter flooding on
              northern rivers.
            </p>
            <p>
              <span className="text-foreground font-medium">
                Monitoring water levels is essential for property decisions.
              </span>{" "}
              Properties in flood fringe and floodway zones face higher
              insurance costs, potential development restrictions, and real risk
              of damage. Understanding river conditions — current levels,
              discharge rates, and seasonal trends — helps assess both immediate
              risk and long-term property value implications.
            </p>
          </div>
        </Card>
      </section>

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Alberta Pulse Check &mdash; Water &mdash; Data from ECCC Hydrometric API
      </footer>
    </main>
  );
}
