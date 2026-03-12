import { Suspense } from "react";
import Link from "next/link";
import {
  Newspaper,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  ChevronRight,
  BarChart3,
  Database,
  Search,
  Lightbulb,
  MapPin,
  Code,
} from "lucide-react";
import { Card, CardHeader, MetricCard } from "@/components/card";
import {
  fetchRegionalIndicator,
  REGIONAL_INDICATORS,
  type RegionalDataPoint,
} from "@/lib/data-sources-regional";

// ============================================================
// Helpers
// ============================================================

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatMoney(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function SignalBadge({ signal }: { signal: string }) {
  const colors: Record<string, string> = {
    hot: "bg-red-500/15 text-red-400",
    warming: "bg-amber-500/15 text-amber-400",
    stable: "bg-blue-500/15 text-blue-400",
    cooling: "bg-cyan-500/15 text-cyan-400",
    strong: "bg-green-500/15 text-green-400",
    caution: "bg-orange-500/15 text-orange-400",
    positive: "bg-green-500/15 text-green-400",
    negative: "bg-red-500/15 text-red-400",
    neutral: "bg-gray-500/15 text-gray-400",
    anomaly: "bg-purple-500/15 text-purple-400",
    spike: "bg-red-500/15 text-red-400",
    drop: "bg-cyan-500/15 text-cyan-400",
  };
  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-mono ${colors[signal] ?? colors.neutral}`}>
      {signal}
    </span>
  );
}

function latestForMuni(data: RegionalDataPoint[], muni: string): number | null {
  const rows = data
    .filter((d) => d.municipality.toLowerCase() === muni.toLowerCase())
    .sort((a, b) => b.period.localeCompare(a.period));
  return rows.length > 0 ? rows[0].value : null;
}

// ============================================================
// Section 1: Quick Stats (meta about the platform)
// ============================================================

async function QuickStats() {
  // Fetch a sample indicator to count municipalities
  const populationRaw = await fetchRegionalIndicator("Population").catch(() => []);

  const uniqueMunis = new Set(populationRaw.map((p) => p.municipality));
  const totalIndicators = Object.keys(REGIONAL_INDICATORS).length;

  // Find most recent data period
  const periods = populationRaw.map((p) => p.period).sort();
  const latestPeriod = periods.at(-1) ?? "—";

  // Data sources count (approximation of distinct sources wired)
  const dataSources = 12; // BoC, StatsCan, Edmonton SODA, Calgary Socrata, Regional Dashboard, CER, AER, IRCC, Infrastructure Canada, AB Major Projects, AESO, CKAN

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      <MetricCard
        title="Municipalities"
        value={uniqueMunis.size > 0 ? uniqueMunis.size.toString() : "—"}
        source="Regional Dashboard"
      />
      <MetricCard
        title="Data Sources"
        value={dataSources.toString()}
        source="APIs + Open Data"
      />
      <MetricCard
        title="Latest Data"
        value={latestPeriod}
        source="Most recent period"
      />
      <MetricCard
        title="Regional Indicators"
        value={totalIndicators.toString()}
        source="Alberta Regional"
      />
    </div>
  );
}

// ============================================================
// Section 2: Story Leads (auto-detected anomalies)
// ============================================================

async function StoryLeads() {
  const [populationRaw, incorporationsRaw, bankruptcyRaw, vacancyRaw, eiRaw, wellCountRaw, permitsRaw] =
    await Promise.all([
      fetchRegionalIndicator("Population").catch(() => []),
      fetchRegionalIndicator("Incorporations").catch(() => []),
      fetchRegionalIndicator("Bankruptcies").catch(() => []),
      fetchRegionalIndicator("Vacancy Rates").catch(() => []),
      fetchRegionalIndicator("Employment Insurance Beneficiaries").catch(() => []),
      fetchRegionalIndicator("Well Count").catch(() => []),
      fetchRegionalIndicator("Building Permits").catch(() => []),
    ]);

  interface StoryLead {
    headline: string;
    detail: string;
    municipality: string;
    signal: "anomaly" | "spike" | "drop" | "hot" | "caution";
    dataPoints: string[];
  }

  const stories: StoryLead[] = [];

  // Detect anomaly: high incorporations + high vacancy = interesting
  const muniSet = new Set<string>();
  for (const pt of incorporationsRaw) muniSet.add(pt.municipality);

  for (const muni of muniSet) {
    const incorp = latestForMuni(incorporationsRaw, muni);
    const vacancy = latestForMuni(vacancyRaw, muni);
    const bankruptcies = latestForMuni(bankruptcyRaw, muni);
    const ei = latestForMuni(eiRaw, muni);
    const permits = latestForMuni(permitsRaw, muni);

    // High incorporations + high vacancy = churn story
    if (incorp != null && incorp > 100 && vacancy != null && vacancy > 5) {
      stories.push({
        headline: `${muni}: Businesses forming despite high vacancy`,
        detail: `${Math.round(incorp)} new incorporations while vacancy sits at ${vacancy.toFixed(1)}%. New entrants may be displacing incumbents, or a market shift is underway.`,
        municipality: muni,
        signal: "anomaly",
        dataPoints: [`Incorporations: ${Math.round(incorp)}`, `Vacancy: ${vacancy.toFixed(1)}%`],
      });
    }

    // High bankruptcies + active building = divergence story
    if (bankruptcies != null && bankruptcies > 500 && permits != null && permits > 200) {
      stories.push({
        headline: `${muni}: Building boom meets bankruptcy wave`,
        detail: `${Math.round(bankruptcies)} bankruptcies alongside ${Math.round(permits)} building permits. Two economies in one municipality — growth and distress coexisting.`,
        municipality: muni,
        signal: "anomaly",
        dataPoints: [`Bankruptcies: ${Math.round(bankruptcies)}`, `Building Permits: ${Math.round(permits)}`],
      });
    }

    // High EI + low vacancy = labour market under stress but housing tight
    if (ei != null && ei > 2000 && vacancy != null && vacancy < 3) {
      stories.push({
        headline: `${muni}: Labour stress but housing tight`,
        detail: `${Math.round(ei).toLocaleString()} EI beneficiaries yet vacancy at only ${vacancy.toFixed(1)}%. Workers are struggling but not leaving — housing lock-in effect?`,
        municipality: muni,
        signal: "caution",
        dataPoints: [`EI Beneficiaries: ${Math.round(ei).toLocaleString()}`, `Vacancy: ${vacancy.toFixed(1)}%`],
      });
    }

    // Extreme well count + low population = resource town dynamics
    const pop = latestForMuni(populationRaw, muni);
    const wells = latestForMuni(wellCountRaw, muni);
    if (wells != null && wells > 5000 && pop != null && pop < 20000) {
      stories.push({
        headline: `${muni}: Resource intensity off the charts`,
        detail: `${formatNum(wells)} wells for a population of ${formatNum(pop)} (${(wells / pop * 1000).toFixed(0)} wells per 1K residents). Economic dependency worth investigating.`,
        municipality: muni,
        signal: "hot",
        dataPoints: [`Well Count: ${formatNum(wells)}`, `Population: ${formatNum(pop)}`],
      });
    }
  }

  // Sort by signal priority
  const signalOrder: Record<string, number> = { anomaly: 0, hot: 1, caution: 2, spike: 3, drop: 4 };
  stories.sort((a, b) => (signalOrder[a.signal] ?? 5) - (signalOrder[b.signal] ?? 5));
  const topStories = stories.slice(0, 8);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Lightbulb size={14} className="text-purple-400" />
        <span className="text-xs font-medium uppercase tracking-wide">Auto-Detected Story Leads</span>
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 font-mono uppercase">
          {topStories.length} found
        </span>
      </div>
      <p className="text-[10px] text-muted">
        Algorithmically detected anomalies — municipalities where data points diverge from expected patterns.
        Each is a potential story worth investigating.
      </p>

      {topStories.length > 0 ? (
        <div className="space-y-2">
          {topStories.map((story, i) => (
            <div
              key={i}
              className="p-3 rounded-lg border border-purple-500/20 bg-purple-500/5"
            >
              <div className="flex items-start justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{story.headline}</span>
                  <SignalBadge signal={story.signal} />
                </div>
              </div>
              <p className="text-xs text-foreground/70 leading-relaxed mb-2">{story.detail}</p>
              <div className="flex flex-wrap gap-2">
                {story.dataPoints.map((dp, j) => (
                  <span key={j} className="text-[10px] bg-card-border/50 text-muted px-1.5 py-0.5 rounded">
                    {dp}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-4 rounded-lg border border-card-border bg-card/50 text-center">
          <p className="text-xs text-muted">No strong anomalies detected in current data. Check back as new data arrives.</p>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Link href="/compare" className="text-[10px] text-accent hover:underline flex items-center gap-1">
          Compare municipalities <ChevronRight size={10} />
        </Link>
        <Link href="/signals" className="text-[10px] text-accent hover:underline flex items-center gap-1">
          Signal trends <ChevronRight size={10} />
        </Link>
      </div>
    </div>
  );
}

// ============================================================
// Section 3: Data Quick-Reference
// ============================================================

function DataReference() {
  const datasets = [
    {
      name: "Bank of Canada",
      indicators: ["Policy Rate", "5Y Fixed/Variable Mortgage", "CAD/USD", "CPI", "BCPI Commodity Indexes"],
      pages: ["/dashboard", "/economy/rates"],
      count: 12,
    },
    {
      name: "Statistics Canada",
      indicators: ["Unemployment", "Employment", "CPI", "Population", "Building Permits (CMA)"],
      pages: ["/dashboard", "/economy/jobs"],
      count: 8,
    },
    {
      name: "Alberta Regional Dashboard",
      indicators: ["54 indicators", "Population", "Housing Starts", "Vacancy", "Income", "Business Counts", "Well Count", "and more"],
      pages: ["/compare", "/municipalities"],
      count: 54,
    },
    {
      name: "Edmonton Open Data",
      indicators: ["Building Permits", "Dev Permits", "Business Licences", "Assessments", "Road Construction"],
      pages: ["/micro", "/signals"],
      count: 6,
    },
    {
      name: "Calgary Open Data",
      indicators: ["Assessments", "Building Permits", "Business Licences", "Dev Permits"],
      pages: ["/micro", "/signals"],
      count: 4,
    },
    {
      name: "Canada Energy Regulator",
      indicators: ["Pipeline Throughput", "Crude Production", "Pipeline Incidents", "Apportionment"],
      pages: ["/energy"],
      count: 16,
    },
    {
      name: "AER / Infrastructure",
      indicators: ["Well Licences", "Major Projects (>$5M)", "Wildfire Historical"],
      pages: ["/drilling", "/energy"],
      count: 5,
    },
    {
      name: "IRCC Immigration",
      indicators: ["PR by Category", "PR by CMA", "PR by Occupation", "PR by Age"],
      pages: ["/immigration"],
      count: 5,
    },
  ];

  const totalEndpoints = datasets.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Database size={14} className="text-emerald-400" />
        <span className="text-xs font-medium uppercase tracking-wide">Data Quick-Reference</span>
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-mono uppercase">
          ~{totalEndpoints} endpoints
        </span>
      </div>
      <p className="text-[10px] text-muted mb-2">
        All data is pulled live from public APIs — no manual data entry.
        Every number links back to a verifiable source.
      </p>

      <div className="space-y-2">
        {datasets.map((ds) => (
          <div
            key={ds.name}
            className="p-2.5 rounded-lg border border-card-border bg-card/50"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">{ds.name}</span>
              <span className="text-[10px] font-mono text-muted">{ds.count} endpoints</span>
            </div>
            <div className="flex flex-wrap gap-1 mb-1.5">
              {ds.indicators.slice(0, 5).map((ind) => (
                <span key={ind} className="text-[9px] bg-card-border/50 text-muted px-1.5 py-0.5 rounded">
                  {ind}
                </span>
              ))}
              {ds.indicators.length > 5 && (
                <span className="text-[9px] text-muted/60">+{ds.indicators.length - 5} more</span>
              )}
            </div>
            <div className="flex gap-2">
              {ds.pages.map((page) => (
                <Link key={page} href={page} className="text-[10px] text-accent hover:underline">
                  {page}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-2">
        <Link href="/sources" className="text-[10px] text-accent hover:underline flex items-center gap-1">
          Full source list <ChevronRight size={10} />
        </Link>
        <Link href="/embed" className="text-[10px] text-accent hover:underline flex items-center gap-1">
          Embeddable charts <ChevronRight size={10} />
        </Link>
      </div>
    </div>
  );
}

// ============================================================
// Loading fallbacks
// ============================================================

function LoadingSection() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-16 rounded-lg bg-card-border/30 animate-pulse" />
      ))}
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-20 rounded-xl bg-card-border/30 animate-pulse" />
      ))}
    </div>
  );
}

// ============================================================
// Page
// ============================================================

export default function JournalistBriefingPage() {
  const today = new Date().toLocaleDateString("en-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <header>
        <div className="flex items-center gap-2 text-[10px] text-muted mb-2">
          <Link href="/briefing" className="hover:text-accent">Briefings</Link>
          <ChevronRight size={10} />
          <span>Journalist</span>
        </div>
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-lg bg-emerald-500/10">
            <Newspaper size={20} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Journalist Briefing</h1>
            <p className="text-xs text-muted">{today}</p>
          </div>
        </div>
        <p className="text-sm text-muted mt-2">
          Auto-detected anomalies, data-backed story leads, and a complete
          reference to every dataset — ready for investigation.
        </p>
      </header>

      {/* Quick Stats */}
      <Suspense fallback={<LoadingGrid />}>
        <QuickStats />
      </Suspense>

      {/* Story Leads */}
      <Card>
        <CardHeader
          title="Story Leads"
          subtitle="Auto-detected anomalies — where the data diverges from expectations"
          badge="LIVE"
        />
        <Suspense fallback={<LoadingSection />}>
          <StoryLeads />
        </Suspense>
      </Card>

      {/* Data Quick-Reference */}
      <Card>
        <CardHeader
          title="Data Quick-Reference"
          subtitle="Every dataset available on the platform with counts and deep-dive links"
        />
        <DataReference />
      </Card>

      {/* Deep Dive Links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {[
          { href: "/compare", label: "Compare", icon: BarChart3, desc: "Side-by-side" },
          { href: "/sources", label: "Sources", icon: Database, desc: "All data" },
          { href: "/embed", label: "Embeds", icon: Code, desc: "For articles" },
          { href: "/municipalities", label: "Municipalities", icon: MapPin, desc: "Deep-dives" },
        ].map((link) => {
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href}>
              <Card className="group hover:border-accent/40 transition-colors h-full">
                <Icon size={16} className="text-muted group-hover:text-accent mb-1.5" />
                <p className="text-xs font-medium">{link.label}</p>
                <p className="text-[10px] text-muted">{link.desc}</p>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Footer */}
      <Card className="text-center">
        <p className="text-[10px] text-muted">
          All data is pulled live from public APIs: Bank of Canada, Statistics Canada,
          Alberta Regional Dashboard, CER, AER, IRCC, Edmonton + Calgary Open Data.
        </p>
        <p className="text-[10px] text-muted/60 mt-1">
          Story leads are algorithmically detected — cross-referencing multiple indicators to find divergent patterns.
        </p>
      </Card>
    </main>
  );
}
