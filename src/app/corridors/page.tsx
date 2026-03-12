import { Suspense } from "react";
import { Card, CardHeader } from "@/components/card";
import {
  Rocket,
  TrendingUp,
  Building2,
  Zap,
} from "lucide-react";
import {
  getLiveMunicipalities,
  REGION_LABELS,
} from "@/lib/municipality-registry";
import {
  fetchMunicipalityMetrics,
} from "@/lib/municipality-data";

// ============================================================
// Growth scoring engine
// ============================================================

interface GrowthCorridor {
  name: string;
  slug: string;
  region: string;
  regionLabel: string;
  population: number;
  score: number;
  rank: number;
  signal: "surge" | "growing" | "stable" | "emerging";
  factors: {
    name: string;
    value: string;
    contribution: number;
  }[];
  totalParcels: number;
  avgAssessment: number;
  vacantLots: number;
  businesses: number;
}

async function calculateGrowthCorridors(): Promise<GrowthCorridor[]> {
  const municipalities = getLiveMunicipalities();

  const results = await Promise.allSettled(
    municipalities.map(async (config) => {
      const metrics = await fetchMunicipalityMetrics(config);
      return { config, metrics };
    })
  );

  const corridors: GrowthCorridor[] = [];

  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    const { config, metrics } = result.value;
    if (metrics.totalParcels === 0 && metrics.totalAssessed === 0) continue;

    const factors: { name: string; value: string; contribution: number }[] = [];
    let totalScore = 0;

    // Factor 1: Population (larger = more economic activity, but cap it)
    const pop = config.population || 0;
    const popScore = pop > 100000 ? 20 : pop > 50000 ? 15 : pop > 20000 ? 10 : pop > 10000 ? 7 : 3;
    factors.push({ name: "Population", value: pop > 0 ? pop.toLocaleString() : "—", contribution: popScore });
    totalScore += popScore;

    // Factor 2: Development density (parcels per capita — higher = more built out)
    if (pop > 0 && metrics.totalParcels > 0) {
      const parcelsPerCapita = metrics.totalParcels / pop;
      const densityScore = parcelsPerCapita > 0.5 ? 20 : parcelsPerCapita > 0.3 ? 15 : parcelsPerCapita > 0.15 ? 10 : 5;
      factors.push({ name: "Dev Density", value: `${parcelsPerCapita.toFixed(2)} parcels/person`, contribution: densityScore });
      totalScore += densityScore;
    }

    // Factor 3: Property values (higher = more demand)
    if (metrics.avgAssessment > 0) {
      const assessScore = metrics.avgAssessment > 500000 ? 20 : metrics.avgAssessment > 350000 ? 15 : metrics.avgAssessment > 250000 ? 10 : 5;
      factors.push({ name: "Avg Assessment", value: `$${metrics.avgAssessment.toLocaleString()}`, contribution: assessScore });
      totalScore += assessScore;
    }

    // Factor 4: Vacant land (more = room to grow)
    if (metrics.vacantCount > 0) {
      const vacantScore = metrics.vacantCount > 200 ? 20 : metrics.vacantCount > 100 ? 15 : metrics.vacantCount > 50 ? 10 : 5;
      factors.push({ name: "Vacant Lots", value: metrics.vacantCount.toLocaleString(), contribution: vacantScore });
      totalScore += vacantScore;
    }

    // Factor 5: Business ecosystem (more = commercial maturity)
    if (metrics.businessCount > 0) {
      const bizScore = metrics.businessCount > 300 ? 20 : metrics.businessCount > 150 ? 15 : metrics.businessCount > 50 ? 10 : 5;
      factors.push({ name: "Businesses", value: metrics.businessCount.toLocaleString(), contribution: bizScore });
      totalScore += bizScore;
    }

    const maxPossible = factors.length * 20;
    const normalizedScore = maxPossible > 0 ? Math.round((totalScore / maxPossible) * 100) : 0;

    corridors.push({
      name: config.name,
      slug: config.slug,
      region: config.region,
      regionLabel: REGION_LABELS[config.region as keyof typeof REGION_LABELS] || config.region,
      population: pop,
      score: normalizedScore,
      rank: 0,
      signal: normalizedScore >= 75 ? "surge" : normalizedScore >= 55 ? "growing" : normalizedScore >= 35 ? "stable" : "emerging",
      factors,
      totalParcels: metrics.totalParcels,
      avgAssessment: metrics.avgAssessment,
      vacantLots: metrics.vacantCount,
      businesses: metrics.businessCount,
    });
  }

  // Sort by score and assign ranks
  corridors.sort((a, b) => b.score - a.score);
  corridors.forEach((c, i) => (c.rank = i + 1));

  return corridors;
}

// ============================================================
// Dashboard sections
// ============================================================

const signalConfig = {
  surge: { label: "SURGE", color: "text-accent-green", bg: "bg-accent-green/10" },
  growing: { label: "GROWING", color: "text-blue-400", bg: "bg-blue-400/10" },
  stable: { label: "STABLE", color: "text-amber-400", bg: "bg-amber-400/10" },
  emerging: { label: "EMERGING", color: "text-purple-400", bg: "bg-purple-400/10" },
};

async function CorridorRankings() {
  const corridors = await calculateGrowthCorridors();

  return (
    <div className="space-y-3">
      {corridors.map((c) => {
        const s = signalConfig[c.signal];
        return (
          <Card key={c.slug}>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="text-2xl font-bold text-muted/30 w-8 text-right shrink-0">
                  {c.rank}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <a href={`/m/${c.slug}`} className="font-medium text-foreground hover:text-accent transition-colors">
                      {c.name}
                    </a>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${s.bg} ${s.color}`}>
                      {s.label}
                    </span>
                    <span className="text-[10px] text-muted/60">{c.regionLabel}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted">
                    {c.population > 0 && <span>Pop: {c.population.toLocaleString()}</span>}
                    {c.totalParcels > 0 && <span>Parcels: {c.totalParcels.toLocaleString()}</span>}
                    {c.avgAssessment > 0 && <span>Avg: ${c.avgAssessment.toLocaleString()}</span>}
                    {c.vacantLots > 0 && <span>Vacant: {c.vacantLots.toLocaleString()}</span>}
                    {c.businesses > 0 && <span>Biz: {c.businesses.toLocaleString()}</span>}
                  </div>
                  {/* Factor breakdown */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {c.factors.map((f) => (
                      <span key={f.name} className="text-[9px] px-1.5 py-0.5 rounded bg-foreground/[0.05] text-muted">
                        {f.name}: {f.value} (+{f.contribution})
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0 ml-4">
                <div className={`text-2xl font-bold ${s.color}`}>{c.score}</div>
                <div className="text-[10px] text-muted">/100</div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

async function CorridorSummary() {
  const corridors = await calculateGrowthCorridors();
  const surge = corridors.filter((c) => c.signal === "surge").length;
  const growing = corridors.filter((c) => c.signal === "growing").length;
  const stable = corridors.filter((c) => c.signal === "stable").length;
  const emerging = corridors.filter((c) => c.signal === "emerging").length;
  const topCorridor = corridors[0];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <Card>
        <p className="text-xs text-muted mb-1">Ranked</p>
        <p className="text-2xl font-semibold">{corridors.length}</p>
        <p className="text-[10px] text-muted/60 mt-1">municipalities</p>
      </Card>
      <Card>
        <p className="text-xs text-muted mb-1">Top Corridor</p>
        <p className="text-lg font-semibold">{topCorridor?.name || "—"}</p>
        <p className="text-[10px] text-muted/60 mt-1">score: {topCorridor?.score || 0}/100</p>
      </Card>
      <Card>
        <p className="text-xs text-accent-green mb-1">Surge</p>
        <p className="text-2xl font-semibold text-accent-green">{surge}</p>
      </Card>
      <Card>
        <p className="text-xs text-blue-400 mb-1">Growing</p>
        <p className="text-2xl font-semibold text-blue-400">{growing}</p>
      </Card>
      <Card>
        <p className="text-xs text-amber-400 mb-1">Stable / Emerging</p>
        <p className="text-2xl font-semibold text-amber-400">{stable + emerging}</p>
      </Card>
    </div>
  );
}

function LoadingCard() {
  return (
    <Card>
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-card-border rounded w-1/3" />
        <div className="h-[60px] bg-card-border/50 rounded" />
      </div>
    </Card>
  );
}

// ============================================================
// Page
// ============================================================

export default function CorridorsPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <header>
        <div className="flex items-center gap-2 mb-1">
          <Rocket size={20} className="text-emerald-400" />
          <h1 className="text-xl font-semibold tracking-tight">
            Growth Corridors
          </h1>
        </div>
        <p className="text-sm text-muted">
          Every registered municipality ranked by a composite growth score.
          Where is development energy concentrating? Where&apos;s the next boomtown?
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono">INVESTORS</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-mono">DEVELOPERS</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 font-mono">EDOs</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-mono">FRANCHISES</span>
        </div>
      </header>

      {/* Summary */}
      <section>
        <Suspense
          fallback={
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {[...Array(5)].map((_, i) => (
                <Card key={i}><div className="animate-pulse space-y-2"><div className="h-3 bg-card-border rounded w-1/2" /><div className="h-7 bg-card-border rounded w-1/3" /></div></Card>
              ))}
            </div>
          }
        >
          <CorridorSummary />
        </Suspense>
      </section>

      {/* Rankings */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={16} className="text-emerald-400" />
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
            Full Rankings
          </h2>
        </div>
        <Suspense
          fallback={
            <div className="space-y-3">
              {[...Array(8)].map((_, i) => <LoadingCard key={i} />)}
            </div>
          }
        >
          <CorridorRankings />
        </Suspense>
      </section>

      {/* Methodology */}
      <section>
        <Card>
          <h3 className="text-sm font-medium mb-2">Scoring Methodology</h3>
          <div className="text-xs text-muted space-y-2">
            <p>Each municipality is scored across up to 5 factors, each worth 0-20 points, then normalized to 0-100:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li><strong>Population</strong> — Market size and economic critical mass</li>
              <li><strong>Development Density</strong> — Parcels per capita (higher = more built-out infrastructure)</li>
              <li><strong>Avg Assessment</strong> — Property values as a demand signal</li>
              <li><strong>Vacant Lots</strong> — Room to grow (available buildable land)</li>
              <li><strong>Businesses</strong> — Commercial ecosystem maturity and diversification</li>
            </ul>
            <p className="text-muted/60">
              Signals: Surge (75+), Growing (55-74), Stable (35-54), Emerging (&lt;35).
              Scores will improve as more data sources are added (permits, traffic, development stages).
            </p>
          </div>
        </Card>
      </section>

      {/* Context */}
      <section>
        <Card>
          <h3 className="text-sm font-medium mb-2">Who Uses This</h3>
          <div className="grid sm:grid-cols-2 gap-3 text-xs text-muted">
            <div>
              <p className="font-medium text-foreground mb-1">Developers & Investors</p>
              <p>Find the next Airdrie — towns with strong growth scores but still-affordable assessments. The gap between score and price is your opportunity.</p>
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">Franchise Operators</p>
              <p>&quot;Surge&quot; corridors with high population and business density are ready for expansion. &quot;Emerging&quot; corridors are too early — wait for the infrastructure.</p>
            </div>
          </div>
        </Card>
      </section>

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Alberta Pulse Check &mdash; Growth Corridors &mdash; Live data from {getLiveMunicipalities().length} municipalities
      </footer>
    </main>
  );
}
