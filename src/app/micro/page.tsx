import { Suspense } from "react";
import { Card, CardHeader } from "@/components/card";
import {
  Microscope,
  Flame,
  Building2,
  Wrench,
  Store,
  Database,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  AlertTriangle,
} from "lucide-react";
import {
  analyzeTransformationZones,
  analyzeTeardownZones,
  analyzeRenovationROI,
  analyzeBusinessResidentialConvergence,
  type TransformationSignal,
  type TeardownZone,
  type RenovationSignal,
  type ConvergenceSignal,
} from "@/lib/analysis";

// ============================================================
// Signal badge
// ============================================================

function SignalBadge({ signal }: { signal: string }) {
  const colors: Record<string, string> = {
    hot: "bg-red-500/10 text-red-400",
    warming: "bg-amber-500/10 text-amber-400",
    stable: "bg-slate-500/10 text-slate-400",
    cooling: "bg-blue-500/10 text-blue-400",
    strong: "bg-green-500/10 text-green-400",
    moderate: "bg-amber-500/10 text-amber-400",
    caution: "bg-red-500/10 text-red-400",
  };
  return (
    <span
      className={`text-[9px] px-1.5 py-0.5 rounded uppercase ${colors[signal] || "bg-slate-500/10 text-slate-400"}`}
    >
      {signal}
    </span>
  );
}

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

// ============================================================
// Section 1: Transformation Zones
// ============================================================

async function TransformationZonesSection() {
  const data = await analyzeTransformationZones();
  const hot = data.filter((d) => d.signal === "hot").slice(0, 10);
  const warming = data.filter((d) => d.signal === "warming").slice(0, 10);
  const cooling = data.filter((d) => d.signal === "cooling").slice(0, 5);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        Cross-referencing building permits, development permits, renovation
        activity, and property assessments to find neighbourhoods where activity
        outpaces current valuations.
      </p>

      {hot.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Flame size={14} className="text-red-400" />
            <h3 className="text-xs font-medium text-red-400 uppercase tracking-wider">
              Hot — High activity, moderate assessments
            </h3>
          </div>
          <div className="space-y-2">
            {hot.map((z) => (
              <NeighbourhoodCard key={z.neighbourhood} zone={z} />
            ))}
          </div>
        </div>
      )}

      {warming.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpRight size={14} className="text-amber-400" />
            <h3 className="text-xs font-medium text-amber-400 uppercase tracking-wider">
              Warming — Rising renovation + development
            </h3>
          </div>
          <div className="space-y-2">
            {warming.map((z) => (
              <NeighbourhoodCard key={z.neighbourhood} zone={z} />
            ))}
          </div>
        </div>
      )}

      {cooling.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <ArrowDownRight size={14} className="text-blue-400" />
            <h3 className="text-xs font-medium text-blue-400 uppercase tracking-wider">
              Cooling — High assessments, low new activity
            </h3>
          </div>
          <div className="space-y-2">
            {cooling.map((z) => (
              <NeighbourhoodCard key={z.neighbourhood} zone={z} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NeighbourhoodCard({ zone }: { zone: TransformationSignal }) {
  return (
    <div className="p-3 rounded-lg border border-card-border bg-card/50">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{zone.neighbourhood}</span>
            <SignalBadge signal={zone.signal} />
          </div>
          <div className="flex gap-4 mt-1 text-[10px] text-muted">
            <span>Avg: {formatMoney(zone.avgAssessment)}</span>
            <span>{zone.permitCount} permits</span>
            <span>{zone.unitsAdded} units</span>
            <span>{zone.devPermitCount} dev permits</span>
            <span>{zone.renovationCount} renos</span>
          </div>
        </div>
        <span className="text-xs font-mono text-muted">{zone.score}</span>
      </div>
      <p className="text-xs text-foreground/70 leading-relaxed">
        {zone.whyItMatters}
      </p>
    </div>
  );
}

// ============================================================
// Section 2: Teardown Zones
// ============================================================

async function TeardownZonesSection() {
  const data = await analyzeTeardownZones();
  const active = data.filter((z) => z.ratio >= 1).slice(0, 12);
  const emerging = data.filter((z) => z.ratio < 1 && z.devPermits >= 5).slice(0, 8);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        Redeveloping neighbourhoods where older homes are being replaced.
        High construction-to-assessment ratio means new builds are worth
        significantly more than existing homes — a signal that land value
        is driving the economics.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted border-b border-card-border">
              <th className="pb-2 pr-4">Neighbourhood</th>
              <th className="pb-2 pr-4 text-right">Dev Permits</th>
              <th className="pb-2 pr-4 text-right">New Construction</th>
              <th className="pb-2 pr-4 text-right">Avg Assessment</th>
              <th className="pb-2 pr-4 text-right">Avg New Build $</th>
              <th className="pb-2 pr-4 text-right">Ratio</th>
            </tr>
          </thead>
          <tbody>
            {active.map((z) => (
              <tr key={z.neighbourhood} className="border-b border-card-border/30">
                <td className="py-2 pr-4 font-medium">{z.neighbourhood}</td>
                <td className="py-2 pr-4 text-right">{z.devPermits}</td>
                <td className="py-2 pr-4 text-right">{z.newConstructionPermits}</td>
                <td className="py-2 pr-4 text-right">{formatMoney(z.avgAssessment)}</td>
                <td className="py-2 pr-4 text-right">{formatMoney(z.avgConstructionValue)}</td>
                <td className="py-2 pr-4 text-right">
                  <span
                    className={
                      z.ratio >= 1.5
                        ? "text-red-400 font-medium"
                        : z.ratio >= 1
                          ? "text-amber-400"
                          : "text-muted"
                    }
                  >
                    {z.ratio}x
                  </span>
                </td>
              </tr>
            ))}
            {emerging.map((z) => (
              <tr
                key={z.neighbourhood}
                className="border-b border-card-border/30 text-muted"
              >
                <td className="py-2 pr-4">{z.neighbourhood}</td>
                <td className="py-2 pr-4 text-right">{z.devPermits}</td>
                <td className="py-2 pr-4 text-right">{z.newConstructionPermits}</td>
                <td className="py-2 pr-4 text-right">{formatMoney(z.avgAssessment)}</td>
                <td className="py-2 pr-4 text-right">{formatMoney(z.avgConstructionValue)}</td>
                <td className="py-2 pr-4 text-right">{z.ratio}x</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {active.length > 0 && (
        <div className="p-3 rounded-lg bg-accent-amber/5 border border-accent-amber/10">
          <p className="text-[10px] text-accent-amber uppercase tracking-wider mb-1">
            Prospecting angle
          </p>
          <p className="text-xs text-foreground/80 leading-relaxed">
            Homeowners in these areas are sitting on land worth more than their
            house. For a realtor, this is a seller lead goldmine — &quot;Did you
            know your lot is worth more than your assessed value? Developers are
            paying premium for lots in your neighbourhood.&quot; The top {active.length} zones
            above have active teardown economics.
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Section 3: Renovation ROI
// ============================================================

async function RenovationROISection() {
  const data = await analyzeRenovationROI();
  const strong = data.filter((r) => r.signal === "strong").slice(0, 10);
  const caution = data.filter((r) => r.signal === "caution").slice(0, 5);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        Where homeowners are investing in renovations — and whether
        it&apos;s likely to pay off. Cross-references renovation permit
        value against neighbourhood assessment levels.
      </p>

      {strong.length > 0 && (
        <div className="space-y-2">
          {strong.map((r) => (
            <div
              key={r.neighbourhood}
              className="p-3 rounded-lg border border-card-border bg-card/50"
            >
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {r.neighbourhood}
                  </span>
                  <SignalBadge signal={r.signal} />
                </div>
                <span className="text-[10px] text-muted">
                  {r.assessmentPercentile}th pctl
                </span>
              </div>
              <div className="flex gap-4 text-[10px] text-muted mb-1.5">
                <span>{r.renovationPermits} reno permits</span>
                <span>Avg reno: {formatMoney(r.avgRenovationValue)}</span>
                <span>Avg home: {formatMoney(r.avgAssessment)}</span>
                <span>Total: {formatMoney(r.totalRenovationValue)}</span>
              </div>
              <p className="text-xs text-foreground/70 leading-relaxed">
                {r.interpretation}
              </p>
            </div>
          ))}
        </div>
      )}

      {caution.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2 mt-3">
            <AlertTriangle size={14} className="text-red-400" />
            <h3 className="text-xs font-medium text-red-400 uppercase tracking-wider">
              Caution — Low-value renovations
            </h3>
          </div>
          <div className="space-y-2">
            {caution.map((r) => (
              <div
                key={r.neighbourhood}
                className="p-3 rounded-lg border border-card-border/50 bg-card/30"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm text-muted">
                    {r.neighbourhood}
                  </span>
                  <SignalBadge signal={r.signal} />
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  {r.interpretation}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Section 4: Business + Residential Convergence
// ============================================================

async function ConvergenceSection() {
  const data = await analyzeBusinessResidentialConvergence();
  const top = data.slice(0, 15);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        Neighbourhoods with BOTH new businesses AND new residential
        construction. This convergence signals a self-sustaining community
        forming — homes attract businesses, businesses attract more homes.
      </p>

      <div className="space-y-2">
        {top.map((c) => (
          <div
            key={c.neighbourhood}
            className="p-3 rounded-lg border border-card-border bg-card/50"
          >
            <div className="flex items-start justify-between mb-1">
              <span className="text-sm font-medium">{c.neighbourhood}</span>
              <span className="text-xs font-mono text-muted">
                {c.combinedScore}
              </span>
            </div>
            <div className="flex gap-3 mb-1.5">
              {c.businessLicences > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">
                  {c.businessLicences} businesses
                </span>
              )}
              {c.residentialPermits > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">
                  {c.residentialPermits} residential
                </span>
              )}
              {c.devPermits > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400">
                  {c.devPermits} dev permits
                </span>
              )}
            </div>
            <p className="text-xs text-foreground/70 leading-relaxed">
              {c.interpretation}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Loading
// ============================================================

function SectionLoading() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="animate-pulse p-3 rounded-lg border border-card-border">
          <div className="h-4 bg-card-border rounded w-1/3 mb-2" />
          <div className="h-3 bg-card-border/50 rounded w-full mb-1" />
          <div className="h-3 bg-card-border/50 rounded w-2/3" />
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Page
// ============================================================

export default function MicroSignalsPage() {
  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto space-y-6">
      <header>
        <div className="flex items-center gap-2 mb-1">
          <Microscope size={20} className="text-accent" />
          <h1 className="text-xl font-semibold tracking-tight">
            Micro Signals
          </h1>
        </div>
        <p className="text-sm text-muted">
          Neighbourhood-level intelligence from cross-analyzing permits,
          assessments, development activity, renovations, and business
          licences. This is where macro trends meet street-level
          opportunities.
        </p>
        <div className="flex gap-3 mt-3 text-[10px] text-muted">
          <span className="flex items-center gap-1">
            <Database size={10} />
            Run{" "}
            <code className="bg-card-border px-1 rounded font-mono">
              npx tsx scripts/snapshot.ts
            </code>{" "}
            daily to track changes over time
          </span>
        </div>
      </header>

      {/* How to read this page */}
      <Card>
        <p className="text-xs text-muted leading-relaxed">
          <strong className="text-foreground">How this works:</strong> Each
          section below cross-references 2-4 datasets to find patterns that
          no single dataset reveals. A neighbourhood might look quiet in
          permits data alone, but when you combine permits + assessments +
          business licences + renovation activity, the real story emerges.
          The scores and signals are computed live from your API data.
        </p>
      </Card>

      {/* Section 1: Transformation Zones */}
      <section>
        <Card>
          <CardHeader
            title="Transformation Zones"
            subtitle="Activity vs. valuation — where are values lagging behind activity?"
            badge="LIVE"
          />
          <Suspense fallback={<SectionLoading />}>
            <TransformationZonesSection />
          </Suspense>
        </Card>
      </section>

      {/* Section 2: Teardown Zones */}
      <section>
        <Card>
          <CardHeader
            title="Teardown Detector"
            subtitle="Redeveloping areas where land value exceeds building value"
            badge="LIVE"
          />
          <Suspense fallback={<SectionLoading />}>
            <TeardownZonesSection />
          </Suspense>
        </Card>
      </section>

      {/* Section 3: Renovation ROI */}
      <section>
        <Card>
          <CardHeader
            title="Renovation ROI Signals"
            subtitle="Where homeowner investment is likely paying off"
            badge="LIVE"
          />
          <Suspense fallback={<SectionLoading />}>
            <RenovationROISection />
          </Suspense>
        </Card>
      </section>

      {/* Section 4: Convergence */}
      <section>
        <Card>
          <CardHeader
            title="Business + Residential Convergence"
            subtitle="Neighbourhoods building both homes and services simultaneously"
            badge="LIVE"
          />
          <Suspense fallback={<SectionLoading />}>
            <ConvergenceSection />
          </Suspense>
        </Card>
      </section>

      {/* Data freshness */}
      <Card className="text-center">
        <p className="text-[10px] text-muted">
          All analysis computed live from Edmonton Open Data APIs.
          Cross-referencing {4} datasets across {4} analysis dimensions.
          Refreshes hourly.
        </p>
      </Card>

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Alberta Pulse &mdash; Micro Signals &mdash; Neighbourhood-level
        cross-analysis
      </footer>
    </main>
  );
}
