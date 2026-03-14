import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/card";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import {
  GraduationCap,
  Home,
  Flame,
  TrendingUp,
  Landmark,
  Users,
  Shield,
  Wrench,
  ArrowRight,
  Zap,
  Brain,
  BookOpen,
  TrendingDown,
  Minus,
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
// Metadata
// ============================================================

export const metadata: Metadata = {
  title: "Learn — Alberta Pulse Check",
  description:
    "Understand how your community works. Guided explorations using live Alberta data — housing, energy, taxes, immigration, safety, and the levers that shift outcomes.",
};

// ============================================================
// Lesson Card
// ============================================================

interface LessonCardProps {
  href: string;
  number: number;
  title: string;
  question: string;
  description: string;
  icon: React.ReactNode;
  dataSources: string[];
  color: string;
}

function LessonCard({
  href,
  number,
  title,
  question,
  description,
  icon,
  dataSources,
  color,
}: LessonCardProps) {
  return (
    <Link href={href} className="group block">
      <div className="border border-card-border rounded-lg p-5 hover:border-accent/30 hover:bg-accent/[0.02] transition-all duration-200 h-full flex flex-col">
        <div className="flex items-start gap-3 mb-3">
          <div
            className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${color}15`, color }}
          >
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted uppercase tracking-wider">
              Lesson {number}
            </p>
            <h3 className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors">
              {title}
            </h3>
          </div>
          <ArrowRight
            size={14}
            className="text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all mt-1"
          />
        </div>
        <p className="text-xs text-foreground/70 italic mb-2">
          &ldquo;{question}&rdquo;
        </p>
        <p className="text-xs text-muted leading-relaxed flex-1">
          {description}
        </p>
        <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-card-border">
          {dataSources.map((ds) => (
            <span
              key={ds}
              className="text-[9px] text-muted/60 bg-foreground/[0.04] rounded px-1.5 py-0.5"
            >
              {ds}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

// ============================================================
// "The Story Right Now" — live data narrative (moved from /tools/learn)
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

function trend(
  data: TimeSeriesPoint[],
  months = 3
): { direction: "up" | "down" | "flat"; pct: number; latest: number } {
  if (data.length < months * 2)
    return { direction: "flat", pct: 0, latest: data.at(-1)?.value ?? 0 };
  const recent =
    data.slice(-months).reduce((s, p) => s + p.value, 0) / months;
  const prior =
    data.slice(-months * 2, -months).reduce((s, p) => s + p.value, 0) / months;
  if (prior === 0)
    return { direction: "flat", pct: 0, latest: data.at(-1)?.value ?? 0 };
  const pct = ((recent - prior) / Math.abs(prior)) * 100;
  return {
    direction: pct > 2 ? "up" : pct < -2 ? "down" : "flat",
    pct,
    latest: data.at(-1)?.value ?? 0,
  };
}

function buildNarrative(d: StoryData) {
  const rate = trend(d.policyRate);
  const mortgage = trend(d.mortgage5y);
  const cad = trend(d.cadUsd);
  const unemp = trend(d.unemployment);
  const cpiTrend = trend(d.cpi);
  const pop = trend(d.population, 2);
  const permits = trend(d.permits);
  const devP = trend(d.devPermits);
  const lic = trend(d.licences);
  const starts = trend(d.housingStarts);
  const completions = trend(d.housingCompletions);

  const sections: {
    title: string;
    body: string;
    signal: "positive" | "negative" | "neutral";
    learnMore: string;
  }[] = [];

  // 1. The Money Story
  {
    let body = `The BoC policy rate is ${rate.latest}%. `;
    if (rate.direction === "down") {
      body += `Trending down — borrowing is getting cheaper. `;
    } else if (rate.direction === "up") {
      body += `Trending up — the BoC is fighting inflation. `;
    } else {
      body += `Holding steady. `;
    }
    body += `5-year fixed mortgage: ${mortgage.latest.toFixed(2)}%. `;
    body += `CAD at $${cad.latest.toFixed(4)} USD.`;
    sections.push({
      title: "The Money Story",
      body,
      signal:
        rate.direction === "down"
          ? "positive"
          : rate.direction === "up"
          ? "negative"
          : "neutral",
      learnMore: "/learn/housing-machine",
    });
  }

  // 2. Construction Pipeline
  {
    let body = "";
    if (permits.direction === "up") {
      body += `Building permits rising (${permits.pct > 0 ? "+" : ""}${permits.pct.toFixed(0)}%). `;
    } else if (permits.direction === "down") {
      body += `Building permits falling (${permits.pct.toFixed(0)}%). `;
    } else {
      body += `Building permits stable. `;
    }
    if (starts.latest > 0 && completions.latest > 0) {
      if (starts.latest > completions.latest * 1.2) {
        body += `Starts outpacing completions — new supply coming in 12-18mo.`;
      } else if (completions.latest > starts.latest * 1.2) {
        body += `Completions outpacing starts — future supply will tighten.`;
      } else {
        body += `Pipeline is balanced.`;
      }
    }
    sections.push({
      title: "Construction Pipeline",
      body,
      signal:
        permits.direction === "up"
          ? "positive"
          : permits.direction === "down"
          ? "negative"
          : "neutral",
      learnMore: "/learn/housing-machine",
    });
  }

  // 3. Jobs & Business
  {
    let body = `Unemployment: ${unemp.latest}%. `;
    if (unemp.direction === "up") {
      body += `Rising — job market softening. `;
    } else if (unemp.direction === "down") {
      body += `Falling — job market tightening. `;
    }
    if (lic.direction === "up") {
      body += `New business licences trending up.`;
    } else if (lic.direction === "down") {
      body += `New business licences trending down.`;
    }
    sections.push({
      title: "Jobs & Business",
      body,
      signal:
        unemp.direction === "down"
          ? "positive"
          : unemp.direction === "up"
          ? "negative"
          : "neutral",
      learnMore: "/learn/reading-the-signals",
    });
  }

  // 4. Big Picture
  {
    let body = "";
    if (cpiTrend.direction === "up") {
      body += `Inflation rising — pressure to keep rates high. `;
    } else if (cpiTrend.direction === "down") {
      body += `Inflation cooling — room for rate cuts. `;
    } else {
      body += `Inflation stable. `;
    }
    if (pop.latest > 0) {
      body += `Population: ${(pop.latest / 1_000_000).toFixed(2)}M`;
      if (pop.direction === "up") body += ` and growing.`;
      else body += `.`;
    }
    const positiveSignals = [
      rate.direction === "down",
      permits.direction === "up",
      unemp.direction === "down",
      lic.direction === "up",
      pop.direction === "up",
    ].filter(Boolean).length;

    if (positiveSignals >= 4) {
      body += ` Multiple indicators aligned positively.`;
    } else if (positiveSignals >= 2) {
      body += ` Mixed signals — economy in transition.`;
    } else {
      body += ` Several indicators flashing caution.`;
    }

    sections.push({
      title: "The Big Picture",
      body,
      signal:
        positiveSignals >= 4
          ? "positive"
          : positiveSignals >= 2
          ? "neutral"
          : "negative",
      learnMore: "/learn/reading-the-signals",
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
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.tableId,
      STATSCAN_SERIES.AB_UNEMPLOYMENT_RATE.coordinate,
      24
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_CPI.tableId,
      STATSCAN_SERIES.AB_CPI.coordinate,
      24
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_POPULATION.tableId,
      STATSCAN_SERIES.AB_POPULATION.coordinate,
      10
    ).catch(() => []),
    fetchEdmontonPermitsSummary().catch(() => []),
    fetchEdmontonDevPermits().catch(() => []),
    fetchEdmontonBusinessLicences().catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.EDMONTON_CMA_RES_UNITS.tableId,
      STATSCAN_SERIES.EDMONTON_CMA_RES_UNITS.coordinate,
      24
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.tableId,
      STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.coordinate,
      24
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.EDMONTON_HOUSING_COMPLETIONS.tableId,
      STATSCAN_SERIES.EDMONTON_HOUSING_COMPLETIONS.coordinate,
      24
    ).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.AB_GDP.tableId,
      STATSCAN_SERIES.AB_GDP.coordinate,
      24
    ).catch(() => []),
  ]);

  const { sections } = buildNarrative({
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
  });

  const signalColor = {
    positive: "border-accent-green/20 bg-accent-green/5",
    negative: "border-accent-red/20 bg-accent-red/5",
    neutral: "border-card-border bg-card",
  };

  const signalIcon = {
    positive: <TrendingUp size={14} className="text-accent-green" />,
    negative: <TrendingDown size={14} className="text-accent-red" />,
    neutral: <Minus size={14} className="text-muted" />,
  };

  return (
    <div className="space-y-2">
      {sections.map((s, i) => (
        <div
          key={i}
          className={`p-3 rounded-lg border ${signalColor[s.signal]}`}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              {signalIcon[s.signal]}
              <h3 className="text-xs font-medium">{s.title}</h3>
            </div>
            <Link
              href={s.learnMore}
              className="text-[10px] text-accent hover:text-accent/80 transition-colors"
            >
              Learn why &rarr;
            </Link>
          </div>
          <p className="text-xs text-foreground/80 leading-relaxed">{s.body}</p>
        </div>
      ))}
      <p className="text-[10px] text-muted text-center pt-1">
        Live data from Bank of Canada, StatsCan, Edmonton Open Data. Refreshes
        hourly.
      </p>
    </div>
  );
}

function StoryLoading() {
  return (
    <div className="space-y-2">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="animate-pulse p-3 rounded-lg border border-card-border"
        >
          <div className="h-3 bg-card-border rounded w-1/4 mb-2" />
          <div className="space-y-1.5">
            <div className="h-2.5 bg-card-border/50 rounded w-full" />
            <div className="h-2.5 bg-card-border/50 rounded w-4/6" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Lessons Data
// ============================================================

const lessons: LessonCardProps[] = [
  {
    href: "/learn/housing-machine",
    number: 1,
    title: "The Housing Machine",
    question: "Why did my rent go up?",
    description:
      "Follow a Bank of Canada rate decision all the way to your rent cheque. Every step in the chain, with live data showing where Alberta is right now.",
    icon: <Home size={18} />,
    dataSources: ["BoC Valet", "CMHC", "StatsCan", "Edmonton Open Data"],
    color: "#3b82f6",
  },
  {
    href: "/learn/energy-economy",
    number: 2,
    title: "Alberta's Energy Engine",
    question: "What happens when oil prices drop?",
    description:
      "Trace how energy prices ripple through every corner of the province — jobs, government revenue, housing, migration. And why diversification matters.",
    icon: <Flame size={18} />,
    dataSources: ["CER", "AESO", "StatsCan", "Regional Dashboard"],
    color: "#f97316",
  },
  {
    href: "/learn/reading-the-signals",
    number: 3,
    title: "Reading the Signals",
    question: "How do I know what's coming next?",
    description:
      "The difference between leading and lagging indicators. Learn to read the dashboard like an economist — permits predict construction, construction predicts supply.",
    icon: <TrendingUp size={18} />,
    dataSources: ["All Sources", "13 Live Indicators"],
    color: "#8b5cf6",
  },
  {
    href: "/learn/your-tax-dollars",
    number: 4,
    title: "Your Tax Dollars at Work",
    question: "Where does my property tax actually go?",
    description:
      "From your property assessment to municipal budgets to the roads you drive on. See how 30 Alberta municipalities compare on tax rates, spending, and outcomes.",
    icon: <Landmark size={18} />,
    dataSources: ["Regional Dashboard", "Infrastructure Canada", "AB Major Projects"],
    color: "#10b981",
  },
  {
    href: "/learn/people-and-growth",
    number: 5,
    title: "People & Growth",
    question: "Is Alberta actually growing?",
    description:
      "Immigration, interprovincial migration, births, deaths. Who's coming, where they're going, what they need, and whether communities are keeping up.",
    icon: <Users size={18} />,
    dataSources: ["IRCC", "StatsCan", "Regional Dashboard", "CMHC"],
    color: "#ec4899",
  },
  {
    href: "/learn/safety-and-prosperity",
    number: 6,
    title: "Safety & Prosperity",
    question: "Is my neighbourhood getting safer or worse?",
    description:
      "Crime, health outcomes, and economic conditions move together — with time lags. Learn to read safety data as an early warning system for community health.",
    icon: <Shield size={18} />,
    dataSources: [
      "Regional Dashboard",
      "Calgary Socrata",
      "Edmonton Fire/EMS",
    ],
    color: "#ef4444",
  },
  {
    href: "/learn/community-levers",
    number: 7,
    title: "The Community Levers",
    question: "What can we actually change?",
    description:
      "The capstone. Which patterns are forces of nature and which have handles we can grab? Policy levers, market levers, and community action — with evidence.",
    icon: <Wrench size={18} />,
    dataSources: ["All Sources", "Cross-Indicator Analysis"],
    color: "#6366f1",
  },
];

// ============================================================
// Page
// ============================================================

export default function LearnHub() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-6xl mx-auto space-y-8">
      <PageHeader
        title="Learn"
        description="Understand the patterns that shape your community. Not theory — live data from Alberta, explained in plain English, with the levers you can actually pull."
        category="tools"
        icon={<GraduationCap size={20} />}
      />

      {/* Right Now Summary */}
      <section>
        <Card>
          <CardHeader
            title="Right Now in Alberta"
            subtitle="What the live data is saying — and where to go deeper"
            badge="LIVE"
            freshness="hourly"
          />
          <Suspense fallback={<StoryLoading />}>
            <StoryRightNow />
          </Suspense>
        </Card>
      </section>

      {/* Lesson Grid */}
      <section>
        <SectionHeader
          title="Guided Explorations"
          icon={<BookOpen size={16} />}
          category="tools"
        />
        <p className="text-xs text-muted mb-4">
          Each lesson opens with a question you&apos;ve probably asked, walks
          through the answer using live Alberta data, and ends with signals you
          can monitor yourself.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lessons.map((lesson) => (
            <LessonCard key={lesson.href} {...lesson} />
          ))}
        </div>
      </section>

      {/* Reference Tools */}
      <section>
        <SectionHeader
          title="Reference Tools"
          icon={<Brain size={16} />}
          category="tools"
        />
        <p className="text-xs text-muted mb-4">
          Quick-reference tools from the original Learn page — quiz yourself,
          look up any indicator, or explore cause-and-effect chains.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader
              title="Self-Assessment"
              subtitle="10 diagnostic questions to find your knowledge gaps"
            />
            <SelfAssessment />
          </Card>
          <Card>
            <CardHeader
              title="Indicator Encyclopedia"
              subtitle="Deep dives on every dashboard metric"
            />
            <IndicatorDeepDives />
          </Card>
          <Card>
            <CardHeader
              title="Chain Reactions"
              subtitle="Step through cause-and-effect with time lags"
            />
            <ChainReactions />
          </Card>
        </div>
      </section>

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Alberta Pulse Check &mdash; Learn &mdash; All data from free public APIs
      </footer>
    </main>
  );
}
