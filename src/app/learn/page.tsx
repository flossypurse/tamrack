import { Suspense } from "react";
import { Card, CardHeader } from "@/components/card";
import {
  GraduationCap,
  Brain,
  BookOpen,
  Zap,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
} from "lucide-react";
import {
  SelfAssessment,
  IndicatorDeepDives,
  ChainReactions,
} from "@/components/learn";
import {
  fetchBoCTimeSeries,
  fetchStatCanTimeSeries,
  fetchEdmontonPermitsSummary,
  fetchEdmontonBusinessLicences,
  fetchEdmontonDevPermits,
  BOC_SERIES,
  STATSCAN_SERIES,
  type TimeSeriesPoint,
} from "@/lib/data-sources";

// ============================================================
// "The Story Right Now" — live data → plain English narrative
// ============================================================

interface StoryData {
  policyRate: TimeSeriesPoint[];
  cadUsd: TimeSeriesPoint[];
  mortgage5y: TimeSeriesPoint[];
  unemployment: TimeSeriesPoint[];
  cpi: TimeSeriesPoint[];
  population: TimeSeriesPoint[];
  permits: TimeSeriesPoint[];
  devPermits: TimeSeriesPoint[];
  licences: TimeSeriesPoint[];
  cmaUnits: TimeSeriesPoint[];
  housingStarts: TimeSeriesPoint[];
  housingCompletions: TimeSeriesPoint[];
  gdp: TimeSeriesPoint[];
}

function trend(data: TimeSeriesPoint[], months = 3): { direction: "up" | "down" | "flat"; pct: number; latest: number } {
  if (data.length < months * 2) return { direction: "flat", pct: 0, latest: data.at(-1)?.value ?? 0 };
  const recent = data.slice(-months).reduce((s, p) => s + p.value, 0) / months;
  const prior = data.slice(-months * 2, -months).reduce((s, p) => s + p.value, 0) / months;
  if (prior === 0) return { direction: "flat", pct: 0, latest: data.at(-1)?.value ?? 0 };
  const pct = ((recent - prior) / Math.abs(prior)) * 100;
  return {
    direction: pct > 2 ? "up" : pct < -2 ? "down" : "flat",
    pct,
    latest: data.at(-1)?.value ?? 0,
  };
}

function buildNarrative(d: StoryData): { sections: { title: string; icon: string; body: string; signal: "positive" | "negative" | "neutral" }[] } {
  const rate = trend(d.policyRate);
  const mortgage = trend(d.mortgage5y);
  const cad = trend(d.cadUsd);
  const unemp = trend(d.unemployment);
  const cpiTrend = trend(d.cpi);
  const pop = trend(d.population, 2);
  const permits = trend(d.permits);
  const devP = trend(d.devPermits);
  const lic = trend(d.licences);
  const cma = trend(d.cmaUnits);
  const starts = trend(d.housingStarts);
  const completions = trend(d.housingCompletions);
  const gdp = trend(d.gdp);

  const sections: { title: string; icon: string; body: string; signal: "positive" | "negative" | "neutral" }[] = [];

  // 1. The Money Story
  {
    let body = `The Bank of Canada's policy rate is currently ${rate.latest}%. `;
    if (rate.direction === "down") {
      body += `It's been trending DOWN — the BoC is actively cutting to stimulate the economy. This means borrowing is getting cheaper. `;
    } else if (rate.direction === "up") {
      body += `It's been trending UP — the BoC is fighting inflation by making borrowing more expensive. `;
    } else {
      body += `It's been holding steady — the BoC is in 'wait and see' mode. `;
    }
    body += `The 5-year fixed mortgage rate is at ${mortgage.latest.toFixed(2)}%`;
    if (mortgage.direction === "down") {
      body += `, and it's been dropping — good news for buyers and refinancers. `;
    } else if (mortgage.direction === "up") {
      body += `, and it's been rising — squeezing buyer affordability. `;
    } else {
      body += `. `;
    }
    body += `The Canadian dollar is at $${cad.latest.toFixed(4)} USD`;
    if (cad.direction === "down") {
      body += ` and weakening — good for Alberta's oil revenue, bad for cross-border purchases.`;
    } else if (cad.direction === "up") {
      body += ` and strengthening — could pressure oil sector profits.`;
    } else {
      body += `.`;
    }

    sections.push({
      title: "The Money Story",
      icon: "money",
      body,
      signal: rate.direction === "down" ? "positive" : rate.direction === "up" ? "negative" : "neutral",
    });
  }

  // 2. The Construction Pipeline
  {
    let body = "";
    if (permits.direction === "up") {
      body += `Building permits are RISING (${permits.pct > 0 ? "+" : ""}${permits.pct.toFixed(0)}% vs 3 months ago) — developers are planning more construction. `;
    } else if (permits.direction === "down") {
      body += `Building permits are FALLING (${permits.pct.toFixed(0)}% vs 3 months ago) — developers are pulling back. `;
    } else {
      body += `Building permits are stable. `;
    }

    if (devP.direction === "up") {
      body += `Development permits are also trending up — early-stage planning is active. `;
    } else if (devP.direction === "down") {
      body += `Development permits are trending down — even early-stage planning is slowing. `;
    }

    if (starts.latest > 0 && completions.latest > 0) {
      if (starts.latest > completions.latest * 1.2) {
        body += `Housing starts (${starts.latest.toLocaleString()}) are outpacing completions (${completions.latest.toLocaleString()}) — a big pipeline is building. New supply is coming, but not for 12-18 months. `;
      } else if (completions.latest > starts.latest * 1.2) {
        body += `Completions (${completions.latest.toLocaleString()}) are outpacing new starts (${starts.latest.toLocaleString()}) — the pipeline is draining. Future supply will tighten. `;
      } else {
        body += `Starts and completions are roughly balanced — the pipeline is steady. `;
      }
    }

    const pipelineDirection = permits.direction === "up" && devP.direction !== "down" ? "positive" :
      permits.direction === "down" && devP.direction === "down" ? "negative" : "neutral";

    sections.push({
      title: "The Construction Pipeline",
      icon: "construction",
      body,
      signal: pipelineDirection,
    });
  }

  // 3. Jobs & Business
  {
    let body = `Alberta's unemployment rate is ${unemp.latest}%. `;
    if (unemp.direction === "up") {
      body += `It's been rising — the job market is softening. More people are competing for fewer positions. `;
    } else if (unemp.direction === "down") {
      body += `It's been falling — the job market is tightening. Good for workers, potentially inflationary. `;
    } else {
      body += `It's been steady. `;
    }

    if (lic.direction === "up") {
      body += `New business licences in Edmonton are trending up — entrepreneurial confidence is growing. `;
    } else if (lic.direction === "down") {
      body += `New business licences are trending down — entrepreneurs are hesitant. `;
    }

    if (unemp.direction === "down" && lic.direction === "up") {
      body += `Both signals point the same way: the local economy is expanding.`;
    } else if (unemp.direction === "up" && lic.direction === "down") {
      body += `Both signals are concerning: rising unemployment and falling business creation suggest a real slowdown.`;
    } else if (unemp.direction === "up" && lic.direction === "up") {
      body += `Interesting divergence: unemployment is rising but new businesses are still forming — the economy may be restructuring rather than purely contracting.`;
    }

    sections.push({
      title: "Jobs & Business Climate",
      icon: "jobs",
      body,
      signal: unemp.direction === "down" ? "positive" : unemp.direction === "up" ? "negative" : "neutral",
    });
  }

  // 4. The Big Picture
  {
    let body = "";

    if (cpiTrend.direction === "up") {
      body += `Alberta CPI is rising — inflation is active. This puts pressure on the BoC to keep rates higher for longer, which constrains housing affordability. `;
    } else if (cpiTrend.direction === "down") {
      body += `Inflation is cooling — this gives the BoC room to cut rates further, which would eventually boost housing demand. `;
    } else {
      body += `Inflation is stable — the BoC has breathing room. `;
    }

    if (pop.latest > 0) {
      body += `Alberta's population is at ${(pop.latest / 1_000_000).toFixed(2)} million`;
      if (pop.direction === "up") {
        body += ` and GROWING — this is the fundamental driver of housing demand. Every new person needs somewhere to live. `;
      } else {
        body += `. `;
      }
    }

    // Overall assessment
    const positiveSignals = [
      rate.direction === "down",
      permits.direction === "up",
      unemp.direction === "down",
      lic.direction === "up",
      pop.direction === "up",
    ].filter(Boolean).length;

    if (positiveSignals >= 4) {
      body += `OVERALL: Multiple indicators are aligned positively — the Edmonton metro economy is in expansion mode. This is when opportunities appear fastest, but also when competition heats up.`;
    } else if (positiveSignals >= 2) {
      body += `OVERALL: The picture is mixed — some indicators are positive, others are cautious. This is typical of a transitioning economy. Watch for which direction the mixed signals resolve.`;
    } else {
      body += `OVERALL: Several indicators are flashing caution. This doesn't mean crisis, but it means being selective and defensive with any investments or business decisions.`;
    }

    sections.push({
      title: "The Big Picture",
      icon: "big-picture",
      body,
      signal: positiveSignals >= 4 ? "positive" : positiveSignals >= 2 ? "neutral" : "negative",
    });
  }

  return { sections };
}

async function StoryRightNow() {
  const [
    policyRate,
    cadUsd,
    mortgage5y,
    unemployment,
    cpi,
    population,
    permits,
    devPermits,
    licences,
    cmaUnits,
    housingStarts,
    housingCompletions,
    gdp,
  ] = await Promise.all([
    fetchBoCTimeSeries(BOC_SERIES.POLICY_RATE, 24).catch(() => []),
    fetchBoCTimeSeries(BOC_SERIES.CAD_USD, 24).catch(() => []),
    fetchBoCTimeSeries(BOC_SERIES.MORTGAGE_5Y_FIXED, 24).catch(() => []),
    fetchStatCanTimeSeries(STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.tableId, STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.coordinate, 24).catch(() => []),
    fetchStatCanTimeSeries(STATSCAN_SERIES.AB_CPI.tableId, STATSCAN_SERIES.AB_CPI.coordinate, 24).catch(() => []),
    fetchStatCanTimeSeries(STATSCAN_SERIES.AB_POPULATION.tableId, STATSCAN_SERIES.AB_POPULATION.coordinate, 10).catch(() => []),
    fetchEdmontonPermitsSummary().catch(() => []),
    fetchEdmontonDevPermits().catch(() => []),
    fetchEdmontonBusinessLicences().catch(() => []),
    fetchStatCanTimeSeries(STATSCAN_SERIES.EDMONTON_CMA_RES_UNITS.tableId, STATSCAN_SERIES.EDMONTON_CMA_RES_UNITS.coordinate, 24).catch(() => []),
    fetchStatCanTimeSeries(STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.tableId, STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.coordinate, 24).catch(() => []),
    fetchStatCanTimeSeries(STATSCAN_SERIES.EDMONTON_HOUSING_COMPLETIONS.tableId, STATSCAN_SERIES.EDMONTON_HOUSING_COMPLETIONS.coordinate, 24).catch(() => []),
    fetchStatCanTimeSeries(STATSCAN_SERIES.AB_GDP.tableId, STATSCAN_SERIES.AB_GDP.coordinate, 24).catch(() => []),
  ]);

  const { sections } = buildNarrative({
    policyRate, cadUsd, mortgage5y: mortgage5y, unemployment, cpi,
    population, permits, devPermits, licences, cmaUnits,
    housingStarts, housingCompletions, gdp,
  });

  const signalColor = {
    positive: "border-accent-green/20 bg-accent-green/5",
    negative: "border-accent-red/20 bg-accent-red/5",
    neutral: "border-card-border bg-card",
  };

  const signalIcon = {
    positive: <TrendingUp size={16} className="text-accent-green" />,
    negative: <TrendingDown size={16} className="text-accent-red" />,
    neutral: <Minus size={16} className="text-muted" />,
  };

  return (
    <div className="space-y-3">
      {sections.map((s, i) => (
        <div
          key={i}
          className={`p-4 rounded-lg border ${signalColor[s.signal]}`}
        >
          <div className="flex items-center gap-2 mb-2">
            {signalIcon[s.signal]}
            <h3 className="text-sm font-medium">{s.title}</h3>
          </div>
          <p className="text-sm text-foreground/85 leading-relaxed">{s.body}</p>
        </div>
      ))}
      <p className="text-[10px] text-muted text-center">
        Generated from live data — Bank of Canada, StatsCan, Edmonton Open Data. Refreshes hourly.
      </p>
    </div>
  );
}

// ============================================================
// Loading fallback
// ============================================================

function StoryLoading() {
  return (
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="animate-pulse p-4 rounded-lg border border-card-border">
          <div className="h-4 bg-card-border rounded w-1/4 mb-3" />
          <div className="space-y-2">
            <div className="h-3 bg-card-border/50 rounded w-full" />
            <div className="h-3 bg-card-border/50 rounded w-5/6" />
            <div className="h-3 bg-card-border/50 rounded w-4/6" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Page
// ============================================================

export default function LearnPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
      <header>
        <div className="flex items-center gap-2 mb-1">
          <GraduationCap size={20} className="text-accent" />
          <h1 className="text-xl font-semibold tracking-tight">Learn</h1>
        </div>
        <p className="text-sm text-muted">
          Understand the data before you act on it. Work through these tools at
          your own pace — they use your live dashboard data to make everything
          concrete.
        </p>
      </header>

      {/* Section 1: Self-Assessment */}
      <section>
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Brain size={16} className="text-accent" />
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
              Where Are You?
            </h2>
          </div>
          <p className="text-xs text-muted mb-4">
            10 questions to pinpoint your knowledge gaps. Not a test — a
            diagnostic. Every wrong answer comes with a detailed explanation
            that teaches the concept.
          </p>
          <SelfAssessment />
        </Card>
      </section>

      {/* Section 2: The Story Right Now */}
      <section>
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Zap size={16} className="text-accent-amber" />
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
              The Story Right Now
            </h2>
          </div>
          <p className="text-xs text-muted mb-4">
            Your dashboard has 20+ indicators. Here&apos;s what they&apos;re
            saying, translated to plain English, using the actual live data.
          </p>
          <Suspense fallback={<StoryLoading />}>
            <StoryRightNow />
          </Suspense>
        </Card>
      </section>

      {/* Section 3: Indicator Deep Dives */}
      <section>
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <BookOpen size={16} className="text-accent-green" />
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
              Indicator Deep Dives
            </h2>
          </div>
          <p className="text-xs text-muted mb-4">
            Click any indicator to learn: what it measures, what drives it, how
            to read it, what it connects to, and what to watch out for.
          </p>
          <IndicatorDeepDives />
        </Card>
      </section>

      {/* Section 4: Chain Reactions */}
      <section>
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <ArrowRight size={16} className="text-accent" />
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
              Chain Reactions
            </h2>
          </div>
          <p className="text-xs text-muted mb-4">
            Economics is about chains of cause and effect. Pick a trigger event
            and step through what happens next — each step shows the typical
            time lag so you know when to watch for the effect.
          </p>
          <ChainReactions />
        </Card>
      </section>

      {/* Footer */}
      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Alberta Pulse Check &mdash; Learn &mdash; Built for self-directed economic
        education
      </footer>
    </main>
  );
}
