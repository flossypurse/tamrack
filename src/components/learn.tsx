"use client";

import { useState } from "react";
import { Card } from "@/components/card";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  GraduationCap,
  Zap,
  Link2,
} from "lucide-react";

// ============================================================
// Self-Assessment Quiz
// ============================================================

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct: number;
  explanation: string;
  category: "fundamentals" | "indicators" | "connections" | "alberta";
}

const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "leading-1",
    category: "fundamentals",
    question:
      "A 'leading indicator' is one that:",
    options: [
      "Measures what's happening right now in the economy",
      "Changes direction BEFORE the broader economy does",
      "Is more important than other indicators",
      "Only applies to the stock market",
    ],
    correct: 1,
    explanation:
      "Leading indicators change direction before the economy does — they're early warning signals. Building permits are a classic example: a spike in permits today means construction activity (and jobs, spending, housing supply) 6-18 months from now. Coincident indicators move WITH the economy (like unemployment), and lagging indicators confirm what already happened (like corporate profits).",
  },
  {
    id: "boc-1",
    category: "connections",
    question:
      "When the Bank of Canada RAISES its policy rate, what typically happens to housing demand?",
    options: [
      "Housing demand increases because saving is more attractive",
      "Nothing — the BoC rate doesn't affect housing",
      "Housing demand decreases because mortgages get more expensive",
      "Housing demand increases because people rush to buy before rates go higher",
    ],
    correct: 2,
    explanation:
      "Higher BoC rate → banks raise mortgage rates → monthly payments go up → fewer buyers qualify → demand drops → prices cool → fewer permits filed. This chain takes 3-9 months to fully play out. (Option D can happen briefly in the short term — it's called 'panic buying' — but the sustained effect is reduced demand.)",
  },
  {
    id: "cpi-1",
    category: "fundamentals",
    question: "CPI (Consumer Price Index) measures:",
    options: [
      "How much the government is spending",
      "The average change in prices consumers pay for goods and services over time",
      "How much consumers are spending in total",
      "The cost of running a business in Alberta",
    ],
    correct: 1,
    explanation:
      "CPI tracks the price of a fixed 'basket' of goods (food, housing, gas, clothing, etc.) over time. When CPI rises, your dollar buys less — that's inflation. StatsCan's Alberta CPI uses 2002 as the base year (2002 = 100). If it reads 170, prices are 70% higher than in 2002. The RATE of change matters more than the number itself — rising CPI means inflation is accelerating.",
  },
  {
    id: "permits-1",
    category: "indicators",
    question:
      "Edmonton building permit counts dropped 20% last month. This most likely means:",
    options: [
      "The economy is crashing — panic",
      "One month of data isn't enough to draw conclusions — look at the trend over 3-6 months",
      "Edmonton is running out of land to build on",
      "Builders are all on vacation",
    ],
    correct: 1,
    explanation:
      "Single-month swings in permits are NOISY — weather, holidays, permit processing backlogs, and large project timing can all cause spikes or dips. What matters is the 3-6 month trend. A consistent multi-month decline is a real signal. A single bad month is just noise. This applies to most economic indicators — always look at the trend, not the dot.",
  },
  {
    id: "unemployment-1",
    category: "indicators",
    question:
      "Alberta's unemployment rate just hit 7%. What does this number NOT tell you?",
    options: [
      "That about 7 in 100 people actively looking for work can't find it",
      "How many people have given up looking for work entirely",
      "That the labour market is weaker than when it was at 5%",
      "That more people are collecting EI than when it was lower",
    ],
    correct: 1,
    explanation:
      "The unemployment rate only counts people who are ACTIVELY looking for work. People who've given up (the 'discouraged workers') vanish from the statistic. This means the real picture can be worse than the rate suggests. It also doesn't tell you about underemployment — engineers driving Uber, for example. The 'participation rate' (what % of working-age people are in the labour force at all) fills in this gap.",
  },
  {
    id: "cadusd-1",
    category: "connections",
    question:
      "The CAD/USD rate drops from $0.75 to $0.70. For an Albertan, this means:",
    options: [
      "Canadian goods are cheaper for Americans to buy — exports get a boost",
      "It's a great time to book a U.S. vacation",
      "Oil revenue increases because oil is priced in USD",
      "Both A and C are true",
    ],
    correct: 3,
    explanation:
      "A weaker Canadian dollar is a double-edged sword. GOOD: Alberta oil (priced in USD) generates more CAD per barrel, and Canadian exports become cheaper for Americans. BAD: Anything you import from the U.S. costs more — equipment, groceries, vacations, online shopping. For Alberta specifically, the oil revenue boost often outweighs the import costs, making a weaker dollar generally positive for the provincial economy.",
  },
  {
    id: "devpermits-1",
    category: "alberta",
    question:
      "On the Real Estate page, 'REDEV' tagged neighbourhoods are interesting because:",
    options: [
      "They have the newest homes",
      "They're being demolished and rebuilt — signaling neighbourhood transformation",
      "They have the cheapest property taxes",
      "They're in the suburbs",
    ],
    correct: 1,
    explanation:
      "Redeveloping neighbourhoods are where older homes get torn down and replaced — often with duplexes, row housing, or infill. This signals neighbourhood transition: prices are rising enough to justify teardowns. For a realtor, these are goldmines — homeowners in REDEV areas may be sitting on land worth more than their house. That's a seller lead. Buyers looking for new infill construction are buyer leads.",
  },
  {
    id: "cycle-1",
    category: "connections",
    question:
      "In a typical economic cycle, which sequence is correct?",
    options: [
      "Rate cuts → More building → More jobs → Prices rise → Rate hikes",
      "Rate hikes → More building → More jobs → Prices fall → Rate cuts",
      "More jobs → Rate cuts → More building → Prices fall → Rate hikes",
      "Prices rise → More building → Rate cuts → More jobs → Rate hikes",
    ],
    correct: 0,
    explanation:
      "This is the business cycle in a nutshell: Central bank cuts rates to stimulate → Borrowing gets cheap → Construction & investment rise → Jobs get created → Demand rises → Prices rise → Central bank hikes rates to cool things down → The cycle reverses. Alberta is extra sensitive to this cycle because of oil: global demand affects oil prices, which drives provincial revenue, jobs, and migration — layering on top of the interest rate cycle.",
  },
  {
    id: "signals-1",
    category: "indicators",
    question:
      "On the Signals page, you see building permits UP, dev permits UP, business licences UP, but unemployment also UP. What's the most likely explanation?",
    options: [
      "The data must be wrong",
      "Construction is growing but hasn't yet created enough jobs to offset layoffs in other sectors (like oil/gas)",
      "None of these indicators are actually related",
      "The economy is simultaneously booming and crashing",
    ],
    correct: 1,
    explanation:
      "This is actually a common Alberta pattern. The construction sector can be expanding (driven by in-migration and housing demand) while oil & gas is shedding jobs. Remember: these indicators measure DIFFERENT parts of the economy. The power is in reading them TOGETHER — diverging signals tell you the economy is restructuring, not just growing or shrinking uniformly.",
  },
  {
    id: "ab-specific-1",
    category: "alberta",
    question:
      "Edmonton's metro population has been growing rapidly. Which indicators would you watch to see if the city is keeping up with housing demand?",
    options: [
      "CPI only",
      "Building permits, housing starts, housing completions, and units under construction",
      "The BoC policy rate",
      "Business licences",
    ],
    correct: 1,
    explanation:
      "Population growth → housing demand. To see if supply is keeping up, track the PIPELINE: permits (planned), starts (breaking ground), under construction (in progress), and completions (done). If population is growing faster than completions, expect rental vacancy to drop and prices to rise. Your dashboard tracks all four of these — that's the CMHC Housing Pipeline section on the main dashboard.",
  },
];

function getCategoryLabel(cat: QuizQuestion["category"]): string {
  switch (cat) {
    case "fundamentals":
      return "Economic Fundamentals";
    case "indicators":
      return "Reading Indicators";
    case "connections":
      return "How Things Connect";
    case "alberta":
      return "Alberta-Specific";
  }
}

export function SelfAssessment() {
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState<
    { questionId: string; correct: boolean }[]
  >([]);
  const [showExplanation, setShowExplanation] = useState(false);
  const [finished, setFinished] = useState(false);

  const q = QUIZ_QUESTIONS[currentQ];

  function handleSelect(idx: number) {
    if (showExplanation) return;
    setSelected(idx);
    setShowExplanation(true);
    setAnswered((prev) => [
      ...prev,
      { questionId: q.id, correct: idx === q.correct },
    ]);
  }

  function handleNext() {
    if (currentQ < QUIZ_QUESTIONS.length - 1) {
      setCurrentQ((c) => c + 1);
      setSelected(null);
      setShowExplanation(false);
    } else {
      setFinished(true);
    }
  }

  function handleRestart() {
    setCurrentQ(0);
    setSelected(null);
    setAnswered([]);
    setShowExplanation(false);
    setFinished(false);
  }

  if (finished) {
    const score = answered.filter((a) => a.correct).length;
    const total = QUIZ_QUESTIONS.length;
    const pct = Math.round((score / total) * 100);

    const categoryScores = (
      ["fundamentals", "indicators", "connections", "alberta"] as const
    ).map((cat) => {
      const catQs = QUIZ_QUESTIONS.filter((q) => q.category === cat);
      const catCorrect = catQs.filter((q) =>
        answered.find((a) => a.questionId === q.id && a.correct)
      ).length;
      return {
        category: cat,
        label: getCategoryLabel(cat),
        correct: catCorrect,
        total: catQs.length,
      };
    });

    return (
      <div className="space-y-4">
        <div className="text-center py-6">
          <p className="text-4xl font-bold mb-2">
            {score}/{total}
          </p>
          <p className="text-muted text-sm">
            {pct >= 80
              ? "Strong foundation — you're ready to start making connections across indicators."
              : pct >= 50
                ? "Solid start — the deep dives below will fill in the gaps."
                : "Good that you're here — work through the material below and retake this to track your progress."}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {categoryScores.map((cs) => (
            <Card key={cs.category}>
              <p className="text-xs text-muted mb-1">{cs.label}</p>
              <div className="flex items-end gap-2">
                <span className="text-lg font-semibold">
                  {cs.correct}/{cs.total}
                </span>
                <div className="flex-1 h-2 bg-card-border rounded-full overflow-hidden mb-1">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(cs.correct / cs.total) * 100}%`,
                      backgroundColor:
                        cs.correct === cs.total
                          ? "#10b981"
                          : cs.correct > 0
                            ? "#f59e0b"
                            : "#ef4444",
                    }}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>

        <button
          onClick={handleRestart}
          className="flex items-center gap-2 text-sm text-accent hover:text-accent/80 transition-colors mx-auto mt-4"
        >
          <RotateCcw size={14} />
          Retake quiz
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] px-2 py-0.5 rounded bg-accent/10 text-accent">
          {getCategoryLabel(q.category)}
        </span>
        <span className="text-xs text-muted">
          {currentQ + 1} of {QUIZ_QUESTIONS.length}
        </span>
      </div>

      <p className="text-sm font-medium mb-4">{q.question}</p>

      <div className="space-y-2">
        {q.options.map((opt, idx) => {
          let optClass =
            "border border-card-border bg-card hover:border-accent/40 cursor-pointer";
          if (showExplanation) {
            if (idx === q.correct) {
              optClass = "border border-accent-green/50 bg-accent-green/5";
            } else if (idx === selected && idx !== q.correct) {
              optClass = "border border-accent-red/50 bg-accent-red/5";
            } else {
              optClass = "border border-card-border bg-card opacity-50";
            }
          }

          return (
            <button
              key={idx}
              onClick={() => handleSelect(idx)}
              disabled={showExplanation}
              className={`w-full text-left text-sm px-4 py-3 rounded-lg transition-all flex items-start gap-3 ${optClass}`}
            >
              <span className="text-muted text-xs mt-0.5 shrink-0">
                {String.fromCharCode(65 + idx)}
              </span>
              <span>{opt}</span>
              {showExplanation && idx === q.correct && (
                <CheckCircle2
                  size={16}
                  className="text-accent-green shrink-0 mt-0.5 ml-auto"
                />
              )}
              {showExplanation &&
                idx === selected &&
                idx !== q.correct && (
                  <XCircle
                    size={16}
                    className="text-accent-red shrink-0 mt-0.5 ml-auto"
                  />
                )}
            </button>
          );
        })}
      </div>

      {showExplanation && (
        <div className="mt-4 p-4 rounded-lg bg-accent/5 border border-accent/10">
          <p className="text-xs text-muted mb-1 font-medium">WHY</p>
          <p className="text-sm text-foreground/90 leading-relaxed">
            {q.explanation}
          </p>
          <button
            onClick={handleNext}
            className="mt-3 flex items-center gap-1.5 text-sm text-accent hover:text-accent/80 transition-colors"
          >
            {currentQ < QUIZ_QUESTIONS.length - 1
              ? "Next question"
              : "See results"}
            <ArrowRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Indicator Deep Dives
// ============================================================

interface IndicatorInfo {
  id: string;
  name: string;
  type: "leading" | "coincident" | "lagging";
  color: string;
  whatItIs: string;
  whyItMatters: string;
  whatDrivesIt: string[];
  howToRead: string;
  connectsTo: string[];
  gotcha: string;
  dashboardLocation: string;
}

const INDICATORS: IndicatorInfo[] = [
  {
    id: "policy-rate",
    name: "BoC Policy Rate",
    type: "leading",
    color: "#3b82f6",
    whatItIs:
      "The interest rate the Bank of Canada charges other banks for overnight loans. It's the 'master dial' of the Canadian economy — almost every other interest rate is derived from it.",
    whyItMatters:
      "This single number determines how expensive it is to borrow money across the entire country. When it moves, mortgage rates, car loans, business loans, and credit card rates all follow within days to weeks.",
    whatDrivesIt: [
      "Inflation — if CPI is rising too fast, BoC raises the rate to slow spending",
      "Employment — if unemployment is high, BoC may cut to stimulate hiring",
      "Global conditions — U.S. Fed decisions, oil prices, trade disruptions",
      "Housing market — if housing is overheating, it's one tool to cool it",
    ],
    howToRead:
      "Direction matters more than level. A series of cuts signals the BoC is worried about the economy slowing. A series of hikes means they're trying to cool inflation. Pauses mean they're watching. The market often prices in expected moves, so mortgage rates may move BEFORE the BoC actually announces.",
    connectsTo: [
      "Mortgage rates (direct, same direction, days lag)",
      "Housing demand (inverse, 3-6 month lag)",
      "Building permits (inverse, 6-12 month lag)",
      "CAD/USD (higher rates → stronger CAD, usually)",
      "Business investment (inverse — higher rates slow expansion)",
    ],
    gotcha:
      "The BoC rate is a NATIONAL lever but Alberta's economy is driven by oil prices, which the BoC can't control. Alberta can be booming (oil high) while the BoC is hiking rates to cool overheating in Toronto/Vancouver. This creates cross-currents.",
    dashboardLocation: "Dashboard → Monetary & Financial, Signals → Money & Borrowing",
  },
  {
    id: "cad-usd",
    name: "CAD/USD Exchange Rate",
    type: "coincident",
    color: "#10b981",
    whatItIs:
      "How much one Canadian dollar buys in U.S. dollars. If it reads 0.72, one CAD gets you 72 U.S. cents.",
    whyItMatters:
      "Alberta is an export economy (oil, grain, beef). Oil is priced in USD. A weaker CAD means more Canadian dollars per barrel of oil — a direct boost to Alberta's economy. But imports (equipment, food, online shopping) cost more.",
    whatDrivesIt: [
      "Oil prices — oil up → CAD up (Canada is a petrocurrency)",
      "Interest rate differential — if BoC rate > Fed rate, CAD strengthens",
      "Trade balance — more exports than imports → CAD up",
      "Global risk appetite — in uncertainty, investors flee to USD",
    ],
    howToRead:
      "For Alberta, a range of $0.70-$0.76 is the recent normal. Below $0.70 is a very weak loonie — great for oil revenue, bad for imports. Above $0.80 squeezes exporters. Watch for the DIRECTION of the trend, not the absolute level.",
    connectsTo: [
      "Oil revenue (inverse — weaker CAD = more CAD per USD barrel)",
      "Import costs (inverse — weaker CAD = pricier imports)",
      "Cross-border shopping (weaker CAD = fewer Albertans going to Montana)",
      "Immigration (weaker CAD = Canada less attractive for pay-seeking workers)",
    ],
    gotcha:
      "As a U.S. citizen living in Canada, this directly affects your tax situation. Your USD income, investments, and any U.S. assets fluctuate in CAD value. The exchange rate on Dec 31 determines your foreign asset reporting thresholds.",
    dashboardLocation: "Dashboard → Monetary & Financial, Signals → Money & Borrowing",
  },
  {
    id: "mortgage-rates",
    name: "5-Year Fixed Mortgage Rate",
    type: "leading",
    color: "#8b5cf6",
    whatItIs:
      "The posted rate for a conventional 5-year fixed mortgage. Actual rates negotiated are typically 0.5-1.5% lower, but the posted rate sets the benchmark and moves with the market.",
    whyItMatters:
      "This is the single biggest factor in housing affordability. A 1% rate change on a $400K mortgage changes the monthly payment by ~$200. That determines who can buy and who can't.",
    whatDrivesIt: [
      "BoC policy rate (indirect — variable rates follow directly, fixed rates follow bond yields)",
      "5-year Government of Canada bond yield (fixed rates track this closely)",
      "Bank competition (banks may absorb margin to compete for mortgages)",
      "Market expectations of future BoC moves",
    ],
    howToRead:
      "Fixed rates can move BEFORE the BoC does, because they're priced on bond markets that reflect future expectations. If the bond market expects rate cuts, fixed rates may drop even before the BoC announces. Compare the 5Y fixed to the variable rate — when fixed is much higher, the market expects rates to drop (variable will eventually catch up).",
    connectsTo: [
      "Housing affordability (direct — higher rate = less buyers)",
      "Building permits (inverse, 6-12 month lag — expensive mortgages = less building)",
      "Home prices (inverse with lag — high rates cool prices)",
      "Refinancing activity (inverse — lower rates = refi boom)",
    ],
    gotcha:
      "Posted rates are NOT what people actually pay. Real deals are 0.5-1.5% lower. Use posted rates to track the DIRECTION and MAGNITUDE of changes, not to estimate actual mortgage costs.",
    dashboardLocation: "Dashboard → Key Metrics, Real Estate → Key Metrics",
  },
  {
    id: "building-permits",
    name: "Edmonton Building Permits",
    type: "leading",
    color: "#f59e0b",
    whatItIs:
      "The number of building permits issued by the City of Edmonton each month. Covers residential, commercial, and institutional construction.",
    whyItMatters:
      "A permit is the FIRST official step in construction. It means someone has committed money to an architect, engineer, and permit application. It signals construction activity 3-12 months in the future — and the jobs, spending, and housing supply that come with it.",
    whatDrivesIt: [
      "Interest rates (lower rates → more affordable to build → more permits)",
      "Population growth (more people → more housing demand → more permits)",
      "Land availability and zoning changes",
      "Developer confidence and pre-sale conditions",
      "Municipal processing speed (backlogs can create artificial dips)",
    ],
    howToRead:
      "Monthly counts are noisy — always look at 3-6 month trends. Also look at VALUE alongside count: a few large commercial permits can dwarf hundreds of residential ones. The Real Estate page breaks this down by neighbourhood, which is where the real prospecting value is.",
    connectsTo: [
      "Housing starts (direct, 1-6 month lag — permit comes before breaking ground)",
      "Construction employment (direct, 3-12 month lag)",
      "Housing supply (direct, 12-24 month lag — permit to occupancy)",
      "Neighbourhood transformation (cluster of permits = area changing)",
    ],
    gotcha:
      "A permit doesn't guarantee construction. Projects can be permitted and never built (financing falls through, market shifts). Starts and completions tell you what's ACTUALLY happening. Permits tell you what's PLANNED.",
    dashboardLocation: "Dashboard → Development & Business Activity, Signals → Construction Pipeline",
  },
  {
    id: "unemployment",
    name: "Alberta Unemployment Rate",
    type: "coincident",
    color: "#f97316",
    whatItIs:
      "The percentage of Alberta's labour force that is actively looking for work but can't find it. Measured monthly by StatsCan's Labour Force Survey.",
    whyItMatters:
      "It's the most-watched measure of economic health. High unemployment means less consumer spending, more mortgage stress, lower tax revenue, and potentially lower housing demand. But it's a COINCIDENT indicator — it tells you what's happening NOW, not what's coming.",
    whatDrivesIt: [
      "Oil prices (Alberta's #1 employer-driver — oil crash = layoffs)",
      "Interest rates (high rates slow business expansion → fewer hires)",
      "In-migration (people move to Alberta for work — sudden migration can push rate up temporarily)",
      "Seasonal patterns (construction peaks summer, agriculture peaks fall)",
      "Government policy (public sector hiring/cuts)",
    ],
    howToRead:
      "Use the SEASONALLY ADJUSTED rate (which your dashboard shows) to avoid being misled by normal seasonal patterns. Compare to the national rate — Alberta typically runs lower. If Alberta's rate is rising while Canada's is flat, something Alberta-specific is happening (usually oil). A rate under 5% means tight labour market (good for workers, hard for employers). Over 8% signals distress.",
    connectsTo: [
      "Consumer spending (inverse — unemployed people spend less)",
      "Housing demand (inverse — unemployed people don't buy homes)",
      "In-migration (inverse — high unemployment slows people moving to Alberta)",
      "Government revenue (inverse — fewer employed = less income tax collected)",
    ],
    gotcha:
      "The rate can DROP for bad reasons — if people give up looking for work, they leave the denominator. 'Participation rate' is the companion stat that catches this. Also: the rate for Edmonton CMA can differ significantly from the provincial rate.",
    dashboardLocation: "Dashboard → Provincial Economy, Signals → Business & Labour",
  },
  {
    id: "cpi",
    name: "Alberta CPI",
    type: "coincident",
    color: "#a855f7",
    whatItIs:
      "Consumer Price Index — tracks the average price change for a 'basket' of goods and services bought by Alberta consumers. The index uses 2002 as the base year (2002 = 100).",
    whyItMatters:
      "CPI IS inflation. If it's rising fast, your purchasing power is shrinking. The BoC targets 2% annual CPI growth nationally — when Alberta's CPI outpaces that, it means Alberta is running hotter than the rest of the country (common during oil booms).",
    whatDrivesIt: [
      "Energy prices (gasoline, heating — huge weight in Alberta's CPI)",
      "Housing costs (rent, mortgage interest, property taxes)",
      "Food prices (groceries, dining out)",
      "Supply chain conditions (global disruptions → higher import costs)",
      "Wage growth (higher wages → businesses raise prices)",
    ],
    howToRead:
      "The absolute number (e.g., 168.5) is less important than the RATE OF CHANGE. Look at year-over-year change: 2-3% is normal, under 1% signals weak demand, over 5% is concerning inflation. Month-over-month changes are volatile — energy prices can swing CPI dramatically in a single month.",
    connectsTo: [
      "BoC policy rate (high CPI → BoC may hike to cool inflation)",
      "Wage negotiations (workers demand raises matching CPI)",
      "Real estate values (CPI components include shelter costs)",
      "Consumer confidence (high inflation → people feel poorer even if employed)",
    ],
    gotcha:
      "Alberta's CPI is heavily weighted toward energy — a gasoline price spike can push CPI up even if 'core' inflation is fine. The BoC looks at 'CPI-trim' and 'CPI-median' to strip out volatile components. Your dashboard shows headline CPI, which includes energy.",
    dashboardLocation: "Dashboard → Provincial Economy, Signals → Business & Labour",
  },
  {
    id: "housing-starts",
    name: "CMHC Housing Starts / Completions / Under Construction",
    type: "leading",
    color: "#06b6d4",
    whatItIs:
      "CMHC (Canada Mortgage and Housing Corporation) tracks three stages of housing construction: Starts (foundation poured), Under Construction (actively being built), and Completions (ready for occupancy). Measured for the Edmonton CMA (Census Metropolitan Area).",
    whyItMatters:
      "This is the housing PIPELINE. Starts tell you what's coming. Under Construction is the work-in-progress. Completions are the new supply actually hitting the market. If completions can't keep up with population growth, expect rising prices and rents.",
    whatDrivesIt: [
      "Building permits (precedes starts by 1-6 months)",
      "Developer financing conditions (tighter lending = fewer starts)",
      "Labour availability (trades shortage slows starts)",
      "Pre-sale absorption (condos need pre-sales before starting)",
      "Seasonal weather (Alberta winters slow starts dramatically)",
    ],
    howToRead:
      "Compare starts to completions. If starts >> completions, there's a big pipeline building (future supply coming). If completions >> starts, the pipeline is draining (less future supply). Under Construction shows how much is in the middle. For Edmonton CMA, strong starts (>1000/month) indicate a hot market.",
    connectsTo: [
      "Building permits (starts lag permits by 1-6 months)",
      "Construction employment (more starts = more workers needed)",
      "Future housing supply (completions add to available homes in 12-24 months)",
      "Rental market (completions of rentals ease vacancy rates)",
    ],
    gotcha:
      "CMHC data covers the entire Edmonton CMA (Edmonton + surrounding municipalities like Spruce Grove, St. Albert, Sherwood Park, Parkland County) — not just the city of Edmonton. A surge in CMA starts might be mostly Spruce Grove, not Edmonton proper.",
    dashboardLocation: "Dashboard → CMHC Housing Pipeline, Real Estate → Housing Market",
  },
  {
    id: "dev-permits",
    name: "Edmonton Development Permits",
    type: "leading",
    color: "#06b6d4",
    whatItIs:
      "Permission from the City to USE land in a specific way (build a house, open a store, change a building's purpose). Different from building permits — dev permits are about LAND USE, building permits are about CONSTRUCTION.",
    whyItMatters:
      "Dev permits appear even earlier in the pipeline than building permits. A surge of residential dev permits in a neighbourhood means developers are actively planning to transform it. For real estate prospecting, the dev permit feed is the earliest signal of neighbourhood change.",
    whatDrivesIt: [
      "Zoning changes (upzoning allows more density → more dev permit applications)",
      "Land values (when land is valuable enough to justify redevelopment)",
      "Developer speculation (permits filed in anticipation of demand)",
      "City planning initiatives (transit-oriented development, infill policy)",
    ],
    howToRead:
      "The monthly COUNT is useful for overall trend, but the individual permit DETAILS are where prospecting value lives. The Real Estate page shows recent permits with neighbourhood and description — a 'Secondary Suite' permit means a homeowner is investing in their property. A 'Row Housing' permit in an old neighbourhood means infill is happening.",
    connectsTo: [
      "Building permits (dev permit → building permit → construction)",
      "Neighbourhood change (clusters of dev permits = area transforming)",
      "Property values (development activity drives up nearby values)",
      "Zoning policy (dev permits reflect what the zoning allows)",
    ],
    gotcha:
      "Dev permits can be REFUSED — the feed shows applications and decisions. Look at the status column: 'Issued' means approved, 'Refused' means rejected. A high refusal rate in an area might mean the zoning doesn't match what developers want to build, which could signal future zoning fights or policy changes.",
    dashboardLocation: "Dashboard → Development & Business Activity, Real Estate → Dev Permit Feed",
  },
  {
    id: "business-licences",
    name: "Edmonton Business Licences",
    type: "leading",
    color: "#8b5cf6",
    whatItIs:
      "New business licence applications and issuances by the City of Edmonton. Every business operating in Edmonton needs a licence — tracking new ones tells you about entrepreneurial activity.",
    whyItMatters:
      "New business licences are a bet on the future — someone is investing money because they believe there's demand. Rising licences signal growing confidence. Falling licences (especially alongside rising unemployment) signal economic distress.",
    whatDrivesIt: [
      "Economic conditions (good times → more startups)",
      "Population growth (more people → more service demand → more businesses)",
      "Regulatory changes (easier licensing → more applications)",
      "Seasonal patterns (new year planning, spring launches)",
    ],
    howToRead:
      "Look at the 3-6 month trend. Compare to building permits: if both are rising, the local economy is firing on multiple cylinders. If business licences fall while permits are still high, it may mean the construction boom is supply-driven (building even though business demand is cooling) — a warning sign.",
    connectsTo: [
      "Employment (new businesses create jobs)",
      "Commercial real estate (new businesses need space)",
      "Consumer spending (more businesses = more places to spend)",
      "Population growth (correlation — people follow opportunity)",
    ],
    gotcha:
      "Not all licences are equal. A new coffee shop and a new oil services company both get one licence, but their economic impact is vastly different. The raw count doesn't distinguish — treat it as a SENTIMENT indicator, not a precision measure.",
    dashboardLocation: "Dashboard → Development & Business Activity, Signals → Business & Labour",
  },
];

export function IndicatorDeepDives() {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      {INDICATORS.map((ind) => {
        const isOpen = expanded === ind.id;
        return (
          <div
            key={ind.id}
            className="border border-card-border rounded-lg overflow-hidden"
          >
            <button
              onClick={() => setExpanded(isOpen ? null : ind.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-card/50 transition-colors"
            >
              {isOpen ? (
                <ChevronDown size={16} className="text-muted shrink-0" />
              ) : (
                <ChevronRight size={16} className="text-muted shrink-0" />
              )}
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: ind.color }}
              />
              <span className="text-sm font-medium flex-1">{ind.name}</span>
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded ${
                  ind.type === "leading"
                    ? "bg-amber-500/10 text-amber-400"
                    : ind.type === "coincident"
                      ? "bg-blue-500/10 text-blue-400"
                      : "bg-slate-500/10 text-slate-400"
                }`}
              >
                {ind.type.toUpperCase()}
              </span>
            </button>

            {isOpen && (
              <div className="px-4 pb-4 space-y-4 bg-card/30">
                <div>
                  <p className="text-[10px] text-muted uppercase tracking-wider mb-1">
                    What it is
                  </p>
                  <p className="text-sm text-foreground/90 leading-relaxed">
                    {ind.whatItIs}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] text-muted uppercase tracking-wider mb-1">
                    Why it matters for you
                  </p>
                  <p className="text-sm text-foreground/90 leading-relaxed">
                    {ind.whyItMatters}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] text-muted uppercase tracking-wider mb-1">
                    What drives it
                  </p>
                  <ul className="space-y-1">
                    {ind.whatDrivesIt.map((d, i) => (
                      <li
                        key={i}
                        className="text-sm text-foreground/80 flex items-start gap-2"
                      >
                        <span className="text-muted mt-1 shrink-0">-</span>
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="text-[10px] text-muted uppercase tracking-wider mb-1">
                    How to read it
                  </p>
                  <p className="text-sm text-foreground/90 leading-relaxed">
                    {ind.howToRead}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] text-muted uppercase tracking-wider mb-1">
                    Connects to
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {ind.connectsTo.map((c, i) => (
                      <span
                        key={i}
                        className="text-xs px-2 py-1 rounded bg-card border border-card-border text-foreground/70"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-accent-amber/5 border border-accent-amber/10">
                  <p className="text-[10px] text-accent-amber uppercase tracking-wider mb-1">
                    Watch out
                  </p>
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    {ind.gotcha}
                  </p>
                </div>

                <p className="text-[10px] text-muted">
                  Find it: {ind.dashboardLocation}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Chain Reactions — Interactive cause-and-effect
// ============================================================

interface ChainStep {
  label: string;
  detail: string;
  lag?: string;
}

interface Chain {
  id: string;
  title: string;
  trigger: string;
  steps: ChainStep[];
  soWhat: string;
}

const CHAINS: Chain[] = [
  {
    id: "rate-cut",
    title: "BoC Cuts Interest Rates",
    trigger: "Bank of Canada announces a rate cut",
    steps: [
      {
        label: "Banks lower mortgage rates",
        detail:
          "Variable rates drop almost immediately. Fixed rates may have already moved if bond markets anticipated the cut.",
        lag: "Days to weeks",
      },
      {
        label: "More buyers qualify for mortgages",
        detail:
          "Lower rates = lower monthly payments = higher borrowing capacity. A buyer who could afford $350K can now afford $400K.",
        lag: "Immediate",
      },
      {
        label: "Housing demand rises",
        detail:
          "More qualified buyers + sidelined buyers re-entering = increased competition for listings. Multiple offers become more common.",
        lag: "1-3 months",
      },
      {
        label: "Home prices start rising",
        detail:
          "More demand chasing same supply = prices up. Sellers gain leverage. Days-on-market drops.",
        lag: "3-6 months",
      },
      {
        label: "Developers file more permits",
        detail:
          "Rising prices and cheaper borrowing make new projects viable. Building permits and dev permits increase.",
        lag: "6-12 months",
      },
      {
        label: "Construction activity ramps up",
        detail:
          "Permits become starts. More construction workers hired. Materials purchased. Economic multiplier kicks in.",
        lag: "12-18 months",
      },
      {
        label: "New supply eventually arrives",
        detail:
          "Completed homes hit the market 18-24 months after permit. If demand has cooled by then, oversupply risk emerges.",
        lag: "18-24 months",
      },
    ],
    soWhat:
      "For real estate prospecting: rate cuts create a 1-3 month window where buyers are motivated but prices haven't fully adjusted yet. That's the sweet spot for buyer leads. For seller leads, wait until prices have visibly risen (3-6 months) — sellers are motivated by seeing their neighbours sell high.",
  },
  {
    id: "oil-boom",
    title: "Oil Prices Surge",
    trigger: "Global oil prices rise significantly ($80+ WTI)",
    steps: [
      {
        label: "Alberta oil revenue jumps",
        detail:
          "Oil is priced in USD. Higher price + weak CAD = massive revenue boost. Provincial budget goes from deficit to surplus.",
        lag: "Immediate",
      },
      {
        label: "Oil companies increase spending",
        detail:
          "Higher prices make marginal wells profitable. Companies increase drilling, maintenance, and expansion budgets.",
        lag: "1-3 months",
      },
      {
        label: "Workers flood into Alberta",
        detail:
          "Oil jobs pay well. Workers from Atlantic Canada, Ontario, and internationally move to Edmonton, Fort McMurray, and surrounding areas.",
        lag: "3-6 months",
      },
      {
        label: "Housing demand spikes",
        detail:
          "New arrivals need places to live. Rental vacancy drops. Home purchases increase. Edmonton and satellite communities feel the pressure.",
        lag: "3-9 months",
      },
      {
        label: "Service economy follows",
        detail:
          "More people = more restaurants, stores, gyms, daycares. Business licences increase. Commercial real estate tightens.",
        lag: "6-12 months",
      },
      {
        label: "Construction boom",
        detail:
          "Developers build to meet demand. Permits spike. New subdivisions break ground. Existing areas densify through infill.",
        lag: "12-24 months",
      },
      {
        label: "Labour shortage develops",
        detail:
          "Everyone's hiring. Wages rise. It's hard to find tradespeople. Construction timelines stretch. Costs increase.",
        lag: "12-18 months",
      },
    ],
    soWhat:
      "The oil boom cycle is Alberta's superpower and its curse. During a boom, almost everything looks good — but the bust always comes. Smart positioning: during early boom (months 1-6), lock in business relationships and market position. During peak boom, prepare for the downturn. Watch for DIVERGENCE: when oil is high but permits are dropping, it may signal the cycle is turning.",
  },
  {
    id: "population-surge",
    title: "Population Growth Accelerates",
    trigger:
      "Edmonton CMA population growth exceeds 2% annually (as it has recently)",
    steps: [
      {
        label: "Rental market tightens immediately",
        detail:
          "New arrivals rent first, buy later. Vacancy rate drops. Rents rise. Purpose-built rental projects become attractive to developers.",
        lag: "Immediate",
      },
      {
        label: "School enrollment rises",
        detail:
          "Families need schools. Portables appear in parking lots. School boards announce new builds. These are government contracts — large and stable.",
        lag: "6-12 months",
      },
      {
        label: "Retail and services expand",
        detail:
          "More people = more grocery stores, medical clinics, restaurants. Watch business licences for confirmation. New strip malls get built.",
        lag: "6-18 months",
      },
      {
        label: "Housing construction can't keep up",
        detail:
          "If completions < population growth, the gap widens. Prices rise. Overcrowding increases. This is where the housing affordability crisis comes from.",
        lag: "Ongoing",
      },
      {
        label: "Infrastructure strain shows",
        detail:
          "Traffic gets worse. Transit ridership rises. Water/sewer systems hit capacity. Municipal budgets get stressed.",
        lag: "12-24 months",
      },
      {
        label: "Political pressure builds",
        detail:
          "Residents demand action on housing, transit, services. Municipal elections shift. New zoning policies emerge. Provincial government may intervene.",
        lag: "24-48 months",
      },
    ],
    soWhat:
      "Population growth is the most fundamental driver of housing demand. The gap between population growth and housing completions is arguably THE most important metric for real estate — and your dashboard tracks both. If population is growing at 2%+ but completions aren't matching, housing gets tighter every month. That's the core bull case for Edmonton real estate right now.",
  },
  {
    id: "rate-hike",
    title: "BoC Raises Interest Rates",
    trigger: "Bank of Canada announces rate hikes to fight inflation",
    steps: [
      {
        label: "Mortgage rates jump",
        detail:
          "Variable rates rise immediately. Fixed rates may have already risen if bond markets saw it coming.",
        lag: "Days to weeks",
      },
      {
        label: "Buyer purchasing power shrinks",
        detail:
          "Higher rates = higher monthly payments. A buyer who could afford $500K at 4% can only afford $420K at 6%. Many buyers get pushed out entirely.",
        lag: "Immediate",
      },
      {
        label: "Sales volume drops",
        detail:
          "Fewer qualified buyers = fewer transactions. Listings sit longer. Bidding wars disappear. The market feels 'cold' even if prices haven't fallen yet.",
        lag: "1-3 months",
      },
      {
        label: "Prices start to soften",
        detail:
          "Sellers who need to sell start accepting lower offers. Price reductions appear in listings. Year-over-year price comparisons go negative.",
        lag: "3-9 months",
      },
      {
        label: "Developers pull back",
        detail:
          "Fewer permits filed. Projects put on hold. Pre-sales don't hit targets needed to secure construction financing.",
        lag: "6-12 months",
      },
      {
        label: "Renewal shock hits",
        detail:
          "Homeowners who locked in low rates start coming up for renewal at much higher rates. Monthly payments jump 30-50%. Some are forced to sell.",
        lag: "Variable (depends on lock-in date)",
      },
    ],
    soWhat:
      "Rate hikes create a different kind of prospecting opportunity. Forced sellers (renewal shock, job loss) become listing opportunities. The 'pull back' period is when smart buyers get deals. Watch for the permits-to-starts ratio: if permits drop but starts hold steady, developers are finishing existing projects but not starting new ones — a leading signal that future supply will tighten.",
  },
];

export function ChainReactions() {
  const [activeChain, setActiveChain] = useState<string>(CHAINS[0].id);
  const [visibleSteps, setVisibleSteps] = useState(0);

  const chain = CHAINS.find((c) => c.id === activeChain)!;

  function selectChain(id: string) {
    setActiveChain(id);
    setVisibleSteps(0);
  }

  function revealNext() {
    setVisibleSteps((v) => Math.min(v + 1, chain.steps.length));
  }

  function revealAll() {
    setVisibleSteps(chain.steps.length);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {CHAINS.map((c) => (
          <button
            key={c.id}
            onClick={() => selectChain(c.id)}
            className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
              activeChain === c.id
                ? "bg-accent/10 text-accent border border-accent/30"
                : "bg-card border border-card-border text-muted hover:text-foreground"
            }`}
          >
            {c.title}
          </button>
        ))}
      </div>

      <div className="p-4 rounded-lg bg-accent/5 border border-accent/20">
        <p className="text-[10px] text-accent uppercase tracking-wider mb-1">
          Trigger
        </p>
        <p className="text-sm font-medium">{chain.trigger}</p>
      </div>

      <div className="relative space-y-0">
        {chain.steps.map((step, i) => {
          const visible = i < visibleSteps;
          return (
            <div key={i} className="relative">
              {i > 0 && (
                <div className="flex items-center justify-center py-1">
                  <ArrowRight
                    size={14}
                    className={`rotate-90 transition-all duration-300 ${
                      visible ? "text-accent" : "text-card-border"
                    }`}
                  />
                </div>
              )}
              <div
                className={`p-3 rounded-lg border transition-all duration-300 ${
                  visible
                    ? "bg-card border-card-border"
                    : "bg-card/20 border-card-border/30"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <span
                      className={`text-[10px] font-mono mt-0.5 shrink-0 ${
                        visible ? "text-accent" : "text-muted/40"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div>
                      <p
                        className={`text-sm font-medium ${
                          visible ? "" : "text-muted/40"
                        }`}
                      >
                        {step.label}
                      </p>
                      {visible && (
                        <p className="text-xs text-muted mt-1 leading-relaxed">
                          {step.detail}
                        </p>
                      )}
                    </div>
                  </div>
                  {step.lag && visible && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-card-border text-muted shrink-0 whitespace-nowrap">
                      {step.lag}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        {visibleSteps < chain.steps.length && (
          <>
            <button
              onClick={revealNext}
              className="text-xs text-accent hover:text-accent/80 transition-colors flex items-center gap-1"
            >
              What happens next?
              <ArrowRight size={12} />
            </button>
            <button
              onClick={revealAll}
              className="text-xs text-muted hover:text-foreground transition-colors"
            >
              Show all
            </button>
          </>
        )}
      </div>

      {visibleSteps === chain.steps.length && (
        <div className="p-4 rounded-lg bg-accent-green/5 border border-accent-green/10">
          <p className="text-[10px] text-accent-green uppercase tracking-wider mb-1">
            So what does this mean for you?
          </p>
          <p className="text-sm text-foreground/90 leading-relaxed">
            {chain.soWhat}
          </p>
        </div>
      )}
    </div>
  );
}
