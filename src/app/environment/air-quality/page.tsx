import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import { Wind, AlertTriangle, CheckCircle2, Shield } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import { fetchAlbertaAQHI, type AQHIReading } from "@/lib/data-sources";

// ============================================================
// Helpers
// ============================================================

function aqhiColor(aqhi: number): string {
  if (aqhi <= 3) return "text-green-400";
  if (aqhi <= 6) return "text-yellow-400";
  if (aqhi <= 10) return "text-orange-400";
  return "text-red-400";
}

function aqhiRiskLabel(aqhi: number): string {
  if (aqhi <= 3) return "Low Risk";
  if (aqhi <= 6) return "Moderate Risk";
  if (aqhi <= 10) return "High Risk";
  return "Very High Risk";
}

function aqhiBadgeClasses(aqhi: number): string {
  if (aqhi <= 3) return "bg-green-400/10 text-green-400";
  if (aqhi <= 6) return "bg-yellow-400/10 text-yellow-400";
  if (aqhi <= 10) return "bg-orange-400/10 text-orange-400";
  return "bg-red-400/10 text-red-400";
}

// ============================================================
// Loading state
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
// AQHI Scale Explainer
// ============================================================

function AQHIScaleExplainer() {
  const levels = [
    { range: "1–3", label: "Low Risk", color: "text-green-400", bg: "bg-green-400/10", desc: "Ideal air quality. Enjoy your usual outdoor activities." },
    { range: "4–6", label: "Moderate Risk", color: "text-yellow-400", bg: "bg-yellow-400/10", desc: "Consider reducing outdoor activity if you experience symptoms." },
    { range: "7–10", label: "High Risk", color: "text-orange-400", bg: "bg-orange-400/10", desc: "Reduce or reschedule strenuous outdoor activities." },
    { range: "10+", label: "Very High Risk", color: "text-red-400", bg: "bg-red-400/10", desc: "Avoid strenuous outdoor activities. Stay indoors if possible." },
  ];

  return (
    <Card>
      <CardHeader
        title="AQHI Scale Reference"
        subtitle="Air Quality Health Index — how to read the numbers"
        badge="ECCC"
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {levels.map((l) => (
          <div key={l.range} className="border border-card-border rounded-lg p-3">
            <span className={`inline-block text-xs font-mono px-2 py-0.5 rounded-full ${l.bg} ${l.color} mb-2`}>
              {l.range}
            </span>
            <p className={`text-sm font-medium ${l.color}`}>{l.label}</p>
            <p className="text-xs text-muted mt-1">{l.desc}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ============================================================
// Key Metrics (async server component)
// ============================================================

async function KeyMetrics() {
  const stations = await fetchAlbertaAQHI().catch(() => [] as AQHIReading[]);

  if (stations.length === 0) {
    return (
      <Card>
        <p className="text-sm text-muted">Unable to load AQHI data at this time.</p>
      </Card>
    );
  }

  const avgAqhi = stations.reduce((sum, s) => sum + s.aqhi, 0) / stations.length;
  const sorted = [...stations].sort((a, b) => a.aqhi - b.aqhi);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Stations Reporting"
        value={String(stations.length)}
        source="ECCC AQHI"
      />
      <MetricCard
        title="Average AQHI"
        value={avgAqhi.toFixed(1)}
        source="across all Alberta stations"
      />
      <MetricCard
        title="Best Station"
        value={`${best.aqhi} — ${best.location}`}
        source="lowest current AQHI"
      />
      <MetricCard
        title="Worst Station"
        value={`${worst.aqhi} — ${worst.location}`}
        source="highest current AQHI"
      />
    </div>
  );
}

// ============================================================
// Station Table (async server component)
// ============================================================

async function StationTable() {
  const stations = await fetchAlbertaAQHI().catch(() => [] as AQHIReading[]);

  if (stations.length === 0) {
    return (
      <Card>
        <CardHeader title="Station Readings" />
        <p className="text-sm text-muted">No AQHI data available right now. Try again later.</p>
      </Card>
    );
  }

  const sorted = [...stations].sort((a, b) => b.aqhi - a.aqhi);

  return (
    <Card>
      <CardHeader
        title="Station Readings"
        subtitle="All Alberta AQHI stations — sorted worst to best"
        badge={`${sorted.length} stations`}
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-card-border text-left text-xs text-muted">
              <th className="py-2 pr-4">Location</th>
              <th className="py-2 pr-4">AQHI</th>
              <th className="py-2 pr-4">Risk Level</th>
              <th className="py-2">Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr key={s.locationId} className="border-b border-card-border/50">
                <td className="py-2 pr-4 text-foreground">{s.location}</td>
                <td className={`py-2 pr-4 font-semibold ${aqhiColor(s.aqhi)}`}>
                  {s.aqhi}
                </td>
                <td className="py-2 pr-4">
                  <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${aqhiBadgeClasses(s.aqhi)}`}>
                    {aqhiRiskLabel(s.aqhi)}
                  </span>
                </td>
                <td className="py-2 text-xs text-muted">
                  {s.observationTime
                    ? new Date(s.observationTime).toLocaleString("en-CA", {
                        timeZone: "America/Edmonton",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ============================================================
// What Affects Air Quality
// ============================================================

function WhatAffectsAirQuality() {
  const factors = [
    {
      icon: <AlertTriangle className="w-4 h-4 text-orange-400" />,
      title: "Wildfire Smoke",
      desc: "Alberta's wildfire season (May–September) can push AQHI readings to 10+ across the entire province. Smoke from BC and NWT fires also drifts in regularly.",
    },
    {
      icon: <Shield className="w-4 h-4 text-yellow-400" />,
      title: "Industrial Emissions",
      desc: "Oil sands operations, refineries, and petrochemical plants near Fort McMurray, Edmonton's Industrial Heartland, and Red Deer corridor contribute to baseline pollutant levels.",
    },
    {
      icon: <Wind className="w-4 h-4 text-blue-400" />,
      title: "Winter Inversions",
      desc: "Temperature inversions trap pollutants near ground level during cold Alberta winters, particularly in Edmonton and Calgary valleys. AQHI can spike for days during inversions.",
    },
    {
      icon: <CheckCircle2 className="w-4 h-4 text-green-400" />,
      title: "Agricultural Burning",
      desc: "Fall stubble burning and spring land clearing in rural Alberta temporarily degrades air quality downwind. Affects communities near agricultural areas seasonally.",
    },
  ];

  return (
    <Card>
      <CardHeader
        title="What Affects Air Quality in Alberta"
        subtitle="Key factors that influence AQHI readings across the province"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {factors.map((f) => (
          <div key={f.title} className="flex gap-3">
            <div className="mt-0.5 shrink-0">{f.icon}</div>
            <div>
              <p className="text-sm font-medium text-foreground">{f.title}</p>
              <p className="text-xs text-muted mt-0.5">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ============================================================
// Page
// ============================================================

export const metadata: Metadata = {
  title: "Alberta Air Quality Index (AQHI)",
  description: "Real-time Air Quality Health Index monitoring across Alberta stations. Track particulate matter, ozone, and nitrogen dioxide levels.",
  alternates: {
    canonical: "https://albertapulsecheck.ca/environment/air-quality",
  },
};

export default function AirQualityPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <PageHeader
        title="Air Quality"
        description="Real-time Air Quality Health Index (AQHI) monitoring across Alberta stations"
        category="environment"
        icon={<Wind size={20} />}
      />

      {/* AQHI Scale Explainer */}
      <AQHIScaleExplainer />

      {/* Key Metrics */}
      <Suspense fallback={<LoadingCard />}>
        <KeyMetrics />
      </Suspense>

      {/* Station Table */}
      <Suspense fallback={<LoadingCard />}>
        <StationTable />
      </Suspense>

      {/* What Affects Air Quality */}
      <WhatAffectsAirQuality />

      {/* Footer */}
      <p className="text-center text-xs text-muted/60 font-mono pt-4">
        Alberta Pulse Check — Air Quality — Data from ECCC AQHI API
      </p>
    </main>
  );
}
