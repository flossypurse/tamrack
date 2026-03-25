import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardHeader } from "@/components/card";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import { TimeSeriesAreaChart, type MultiSeriesPoint } from "@/components/chart";
import { computeTimeRange } from "@/lib/time-range";
import {
  fetchBoCTimeSeries,
  fetchStatCanTimeSeries,
  BOC_SERIES,
  STATSCAN_SERIES,
  type TimeSeriesPoint,
} from "@/lib/data-sources";
import {
  Prose,
  BigQuestion,
  ChainStep,
  LiveDataPoint,
  DataGrid,
  Insight,
  Expandable,
  LessonSection,
  LessonNav,
  SoWhat,
} from "@/components/learn-lesson";
import { Wrench, Globe, Landmark, Users, Home, Flame, Shield, TrendingUp, Lightbulb } from "lucide-react";

// ============================================================
// Metadata
// ============================================================

export const metadata: Metadata = {
  title: "The Community Levers — Learn — Alberta Pulse Check",
  description:
    "What can you actually change? A synthesis of every pattern from the Learn series, mapped to the levers that shift them — federal, municipal, and community.",
};

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
// Helper: compute direction from recent data
// ============================================================

function computeDirection(
  data: TimeSeriesPoint[],
  months = 3
): { direction: "up" | "down" | "flat"; latest: number; change: string } {
  if (data.length < months * 2)
    return { direction: "flat", latest: data.at(-1)?.value ?? 0, change: "" };
  const recent =
    data.slice(-months).reduce((s, p) => s + p.value, 0) / months;
  const prior =
    data.slice(-months * 2, -months).reduce((s, p) => s + p.value, 0) / months;
  if (prior === 0)
    return { direction: "flat", latest: data.at(-1)?.value ?? 0, change: "" };
  const pct = ((recent - prior) / Math.abs(prior)) * 100;
  return {
    direction: pct > 2 ? "up" : pct < -2 ? "down" : "flat",
    latest: data.at(-1)?.value ?? 0,
    change: `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`,
  };
}

// ============================================================
// Lever Card — reusable component for the three-tier lever list
// ============================================================

function LeverCard({
  icon,
  iconColor,
  title,
  items,
}: {
  icon: React.ReactNode;
  iconColor: string;
  title: string;
  items: string[];
}) {
  return (
    <Card>
      <div className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className={iconColor}>{icon}</span>
          <h4 className="text-sm font-medium text-foreground">{title}</h4>
        </div>
        <ul className="text-xs text-foreground/80 space-y-1.5 ml-1">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-muted shrink-0">&#x2022;</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

// ============================================================
// Dashboard Link Card — for the "Your Personal Dashboard" section
// ============================================================

function DashboardLink({
  label,
  href,
}: {
  label: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="text-xs text-accent hover:text-accent/80 underline underline-offset-2 transition-colors"
    >
      {label}
    </a>
  );
}

// ============================================================
// Section 2: Housing — What Actually Moves the Needle
// ============================================================

async function HousingLeversSection() {
  const [policyRate, housingStarts] = await Promise.all([
    fetchBoCTimeSeries(BOC_SERIES.POLICY_RATE, 24).catch(() => []),
    fetchStatCanTimeSeries(
      STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.tableId,
      STATSCAN_SERIES.EDMONTON_HOUSING_STARTS.coordinate,
      36
    ).catch(() => []),
  ]);

  const rateTrend = computeDirection(policyRate);
  const startsTrend = computeDirection(housingStarts);

  return (
    <div className="space-y-4">
      <Prose>
        <p>
          Housing affordability is the issue that touches the most people in
          Alberta. And it is shaped by forces at every level — federal monetary
          policy, provincial regulation, municipal zoning, and what you choose
          to support (or oppose) at a public hearing. Here is the lever map:
        </p>
      </Prose>

      <DataGrid>
        <LiveDataPoint
          label="BoC Policy Rate"
          value={`${rateTrend.latest.toFixed(2)}%`}
          change={rateTrend.change}
          direction={rateTrend.direction}
          source="Bank of Canada"
        />
        <LiveDataPoint
          label="Edmonton Housing Starts"
          value={startsTrend.latest.toFixed(0)}
          change={startsTrend.change}
          direction={startsTrend.direction}
          source="StatsCan"
        />
      </DataGrid>

      <div className="space-y-3">
        <LeverCard
          icon={<Globe size={16} />}
          iconColor="text-red-400"
          title="Can't Control (but can anticipate)"
          items={[
            "Bank of Canada interest rate \u2014 sets the cost of every mortgage",
            "Federal immigration targets \u2014 drives demand for housing",
            "Global capital flows \u2014 investment dollars seeking Canadian real estate",
          ]}
        />
        <LeverCard
          icon={<Landmark size={16} />}
          iconColor="text-amber-400"
          title="Can Influence (through votes and advocacy)"
          items={[
            "Municipal zoning \u2014 the single biggest supply-side lever",
            "Development permit approval speed \u2014 slow approvals kill projects",
            "Infrastructure investment to enable new development",
            "Rental regulations and tenant protections",
            "Provincial building code and energy efficiency standards",
          ]}
        />
        <LeverCard
          icon={<Users size={16} />}
          iconColor="text-green-400"
          title="Can Do (direct community action)"
          items={[
            "Support infill and density proposals in your neighbourhood",
            "Attend public hearings on zoning changes \u2014 show up, not just NIMBY voices",
            "Advocate for missing middle housing (duplexes, row houses, small apartments)",
            "Support community land trusts and cooperative housing models",
          ]}
        />
      </div>

      <Insight variant="lever">
        The single biggest municipal lever for housing affordability is zoning
        reform. Every community that has loosened zoning restrictions has seen
        more supply built. The data is unambiguous: restrictive zoning
        constrains supply, and constrained supply drives up prices. This is the
        lever most within reach of local action.
      </Insight>

      <div className="space-y-0">
        <ChainStep
          number={1}
          title="Zoning change approved"
          description="Council votes to allow duplexes, row houses, or small apartments in previously single-family-only zones. This is the unlock."
          timeLag="Political timeline"
        />
        <ChainStep
          number={2}
          title="Development permits increase"
          description="Builders apply for permits on parcels that were previously restricted. More permit applications mean more projects in the pipeline."
          timeLag="3\u20136 months"
        />
        <ChainStep
          number={3}
          title="Construction begins"
          description="Approved projects break ground. Housing starts rise. This is the signal that supply is actually being added."
          timeLag="6\u201318 months"
        />
        <ChainStep
          number={4}
          title="New supply enters the market"
          description="Completed units are listed for sale or rent. More options for buyers and renters. Competition among landlords increases."
          timeLag="18\u201330 months"
        />
        <ChainStep
          number={5}
          title="Rents stabilize or decline"
          description="When supply grows faster than demand, the math works in renters' favour. This is the affordability payoff \u2014 but it takes 2-4 years from the initial zoning change."
          timeLag="2\u20134 years total"
        />
      </div>

      <Expandable title="Why does zoning matter more than interest rates for local affordability?">
        <Prose>
          <p>
            Interest rates affect demand \u2014 how much people can borrow. But
            they apply uniformly across the entire country. Zoning affects
            supply \u2014 how much gets built in YOUR specific community. Two
            municipalities with the same interest rate environment can have
            wildly different affordability outcomes based solely on how much
            new housing their zoning allows. You cannot change interest rates.
            You can change zoning by showing up to council meetings.
          </p>
        </Prose>
      </Expandable>
    </div>
  );
}

// ============================================================
// Section 3: Economic Resilience — Beyond Oil
// ============================================================

async function EconomicResilienceSection() {
  const gdp = await fetchStatCanTimeSeries(
    STATSCAN_SERIES.AB_GDP.tableId,
    STATSCAN_SERIES.AB_GDP.coordinate,
    24
  ).catch(() => []);

  const gdpTrend = computeDirection(gdp);

  return (
    <div className="space-y-4">
      <Prose>
        <p>
          Alberta&apos;s economy has been through multiple boom-bust cycles
          driven by global energy prices. You learned in previous lessons how
          oil prices cascade through employment, housing, and safety. The
          question now is: what levers exist to build resilience against the
          next cycle?
        </p>
      </Prose>

      {gdp.length > 0 && (
        <DataGrid>
          <LiveDataPoint
            label="Alberta GDP"
            value={`$${(gdpTrend.latest / 1000).toFixed(1)}B`}
            change={gdpTrend.change}
            direction={gdpTrend.direction}
            source="StatsCan"
          />
        </DataGrid>
      )}

      <div className="space-y-3">
        <LeverCard
          icon={<Globe size={16} />}
          iconColor="text-red-400"
          title="Can't Control"
          items={[
            "Global oil and gas prices",
            "Technology disruption (AI, automation, energy transition)",
            "International trade agreements and tariffs",
          ]}
        />
        <LeverCard
          icon={<Landmark size={16} />}
          iconColor="text-amber-400"
          title="Can Influence"
          items={[
            "Provincial tax competitiveness \u2014 Alberta's no-PST advantage is real",
            "University research funding and tech transfer programs",
            "Startup grants, incubators, and accelerators",
            "Trade missions and international investment attraction",
            "Municipal business licence fees and red tape reduction",
          ]}
        />
        <LeverCard
          icon={<Users size={16} />}
          iconColor="text-green-400"
          title="Can Do"
          items={[
            "Buy local \u2014 every dollar at a local business circulates 2-3x more in your community",
            "Support and patronize local businesses over national chains",
            "Start a business \u2014 the cost to launch has never been lower",
            "Mentor entrepreneurs and participate in startup communities",
            "Join your local economic development committee",
          ]}
        />
      </div>

      <Insight>
        Every dollar you spend at a local business circulates 2-3x more in your
        community than a dollar spent at a national chain. This is not
        sentimentality \u2014 it is measurable economics. Local businesses hire
        locally, source locally, and pay local taxes. The cumulative effect of
        spending decisions across a community is one of the most powerful
        economic levers that exists.
      </Insight>

      <Expandable title="Is economic diversification actually happening in Alberta?">
        <Prose>
          <p>
            Yes, but slowly. Alberta&apos;s tech sector has grown significantly
            since 2015, and professional/scientific/technical services now
            represent a larger share of GDP than a decade ago. But oil and gas
            still dominates, and will for the foreseeable future. The goal
            isn&apos;t to replace energy \u2014 it&apos;s to build enough
            non-energy economic activity that the next oil price crash doesn&apos;t
            devastate the entire province the way 2015-16 did. That requires
            both policy (provincial incentives) and community action (supporting
            non-energy businesses).
          </p>
        </Prose>
      </Expandable>
    </div>
  );
}

// ============================================================
// Page
// ============================================================

export default function CommunityLeversLesson() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
      <PageHeader
        title="The Community Levers"
        description="What can you actually change? Every pattern from the Learn series, mapped to the levers that shift it \u2014 federal, municipal, and community."
        category="learn"
        icon={<Wrench size={20} />}
      />

      {/* ===== Opening ===== */}
      <BigQuestion>What can we actually change?</BigQuestion>

      <Prose>
        <p>
          You&apos;ve seen the data. Interest rates, oil prices, immigration
          policy \u2014 these are forces that move your community, but you
          don&apos;t control them. So what DO you control?
        </p>
        <p>
          More than you think. This lesson maps every pattern you&apos;ve
          learned to the levers that can shift it. Some levers are beyond your
          reach. Some you can influence by showing up. And some you can pull
          yourself, starting today.
        </p>
      </Prose>

      {/* ===== Section 1: Three Types of Levers ===== */}
      <LessonSection title="1. Three Types of Levers">
        <Prose>
          <p>
            Every force that shapes your community operates through one of three
            types of levers. Understanding which type you&apos;re dealing with
            is the difference between frustration and effectiveness.
          </p>
        </Prose>

        <div className="space-y-3">
          <Card>
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Globe size={16} className="text-red-400" />
                <h4 className="text-sm font-medium text-foreground">
                  Federal &amp; Bank of Canada Levers
                </h4>
                <span className="text-[10px] bg-red-500/10 text-red-400 rounded-full px-2 py-0.5 font-medium">
                  CAN&apos;T CONTROL
                </span>
              </div>
              <Prose>
                <p>
                  Interest rates, immigration targets, trade policy, carbon
                  pricing, federal transfer payments. These set the boundary
                  conditions for everything else. You can&apos;t change them
                  directly, but you can <em>anticipate</em> them. That&apos;s
                  what the dashboard is for \u2014 watching the signals so
                  you&apos;re not surprised when the effects arrive.
                </p>
              </Prose>
            </div>
          </Card>

          <Card>
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Landmark size={16} className="text-amber-400" />
                <h4 className="text-sm font-medium text-foreground">
                  Provincial &amp; Municipal Levers
                </h4>
                <span className="text-[10px] bg-amber-500/10 text-amber-400 rounded-full px-2 py-0.5 font-medium">
                  CAN INFLUENCE
                </span>
              </div>
              <Prose>
                <p>
                  Zoning rules, property tax rates, infrastructure spending,
                  business incentives, school funding, policing priorities,
                  transit investment, recreation facilities. These are decided by
                  elected officials at your provincial legislature and municipal
                  council. You influence them through votes, advocacy, public
                  hearings, and budget consultations. Most of these decisions are
                  made in rooms with fewer than 50 people present. Your voice
                  carries more weight than you think.
                </p>
              </Prose>
            </div>
          </Card>

          <Card>
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-green-400" />
                <h4 className="text-sm font-medium text-foreground">
                  Community Levers
                </h4>
                <span className="text-[10px] bg-green-500/10 text-green-400 rounded-full px-2 py-0.5 font-medium">
                  CAN DO
                </span>
              </div>
              <Prose>
                <p>
                  Where you spend your money, what businesses you support,
                  whether you attend council meetings, starting a business,
                  volunteering, coaching, mentoring, joining your neighbourhood
                  association. These are the levers you pull directly \u2014 no
                  election required, no policy change needed. Individually
                  small. Collectively transformative.
                </p>
              </Prose>
            </div>
          </Card>
        </div>

        <Insight>
          Most people focus on the levers they can&apos;t control (federal and
          Bank of Canada) and ignore the ones they can (municipal and
          community). This is backwards. The levers closest to you are the ones
          with the highest return on your time and energy.
        </Insight>
      </LessonSection>

      {/* ===== Section 2: Housing ===== */}
      <LessonSection title="2. Housing \u2014 What Actually Moves the Needle">
        <Suspense fallback={<LoadingCard />}>
          <HousingLeversSection />
        </Suspense>
      </LessonSection>

      {/* ===== Section 3: Economic Resilience ===== */}
      <LessonSection title="3. Economic Resilience \u2014 Beyond Oil">
        <Suspense fallback={<LoadingCard />}>
          <EconomicResilienceSection />
        </Suspense>
      </LessonSection>

      {/* ===== Section 4: Safety & Wellbeing ===== */}
      <LessonSection title="4. Safety &amp; Wellbeing \u2014 Upstream vs. Downstream">
        <Prose>
          <p>
            You learned in the previous lesson that economic conditions lead
            safety outcomes by 6-12 months. But there&apos;s a deeper pattern:
            most community safety spending is <strong>downstream</strong> \u2014
            police, courts, incarceration. The evidence consistently shows
            that <strong>upstream</strong> spending is more effective per dollar.
          </p>
          <p>
            Upstream means addressing root causes before they become criminal
            justice problems: youth programs, mental health services, addiction
            treatment, housing stability, and economic opportunity. This
            isn&apos;t soft idealism \u2014 it&apos;s what the data says works.
          </p>
        </Prose>

        <div className="space-y-3">
          <LeverCard
            icon={<Globe size={16} />}
            iconColor="text-red-400"
            title="Can't Control"
            items={[
              "Federal sentencing guidelines and criminal code changes",
              "Drug supply chains and cross-border trafficking",
              "National mental health funding levels",
            ]}
          />
          <LeverCard
            icon={<Landmark size={16} />}
            iconColor="text-amber-400"
            title="Can Influence"
            items={[
              "Municipal policing priorities \u2014 community policing vs. enforcement-only",
              "Bylaw enforcement approach \u2014 punitive vs. compliance-oriented",
              "Social service funding and mental health supports",
              "Municipal housing-first programs for chronic homelessness",
              "Provincial addiction treatment and harm reduction funding",
            ]}
          />
          <LeverCard
            icon={<Users size={16} />}
            iconColor="text-green-400"
            title="Can Do"
            items={[
              "Organize and participate in neighbourhood watch programs",
              "Host community events that build social cohesion \u2014 block parties, clean-ups, potlucks",
              "Support local nonprofits working on root causes",
              "Volunteer with youth programs, mentorship, and after-school activities",
              "Know your neighbours \u2014 social connection is the most underrated safety intervention",
            ]}
          />
        </div>

        <Insight variant="lever">
          Communities with strong social cohesion \u2014 where neighbours know
          each other \u2014 consistently have lower crime rates regardless of
          income level. This is one of the most robust findings in
          criminology. You don&apos;t need a policy change or a budget line
          to build social cohesion. You need a barbecue and an invitation.
        </Insight>

        <Expandable title="What does 'upstream spending' actually look like?">
          <Prose>
            <p>
              For every dollar spent on youth intervention programs, communities
              save $7-10 in downstream justice and healthcare costs. Upstream
              looks like: a mental health crisis team that responds to 911 calls
              instead of armed officers. A housing-first program that gives
              chronically homeless people stable housing before requiring
              sobriety. A youth drop-in centre with evening hours. An addiction
              treatment bed that&apos;s available when someone is ready, not
              after a 6-month waitlist. These are not theoretical \u2014
              they&apos;re programs running in Alberta municipalities right now,
              and the ones that measure outcomes consistently show returns.
            </p>
          </Prose>
        </Expandable>
      </LessonSection>

      {/* ===== Section 5: Infrastructure & Growth ===== */}
      <LessonSection title="5. Infrastructure &amp; Growth \u2014 Building for Tomorrow">
        <Prose>
          <p>
            Infrastructure decisions made today shape communities for 30-50
            years. A highway interchange, a transit line, a school, a recreation
            centre \u2014 these are the bones of a community, and once
            they&apos;re built (or not built), the effects compound for decades.
          </p>
        </Prose>

        <div className="space-y-3">
          <LeverCard
            icon={<Globe size={16} />}
            iconColor="text-red-400"
            title="Can't Control"
            items={[
              "Federal infrastructure funding timelines and priorities",
              "Provincial highway and major road investments",
              "Interest rates on municipal borrowing",
            ]}
          />
          <LeverCard
            icon={<Landmark size={16} />}
            iconColor="text-amber-400"
            title="Can Influence"
            items={[
              "Municipal capital plans \u2014 where the next 10 years of investment go",
              "Transit routes and frequency \u2014 ridership data drives funding decisions",
              "School siting decisions \u2014 where schools are built shapes development patterns",
              "Recreation facility priorities \u2014 what gets built and where",
              "Climate resilience infrastructure \u2014 flood mitigation, wildfire protection",
            ]}
          />
          <LeverCard
            icon={<Users size={16} />}
            iconColor="text-green-400"
            title="Can Do"
            items={[
              "Use public transit \u2014 ridership numbers directly drive funding decisions",
              "Participate in municipal budget consultations (they're public and often poorly attended)",
              "Advocate for specific infrastructure in your community",
              "Read your municipality's 3-year capital plan \u2014 it's public and tells you where growth is headed",
              "Support active transportation infrastructure (bike lanes, sidewalks, trails)",
            ]}
          />
        </div>

        <Insight variant="lever">
          Alberta municipalities publish their capital budgets publicly. Reading
          a 3-year capital plan tells you more about where your community is
          headed than any news article. It shows you exactly where the money is
          going \u2014 and where it isn&apos;t. This is freely available
          information that almost nobody reads.
        </Insight>
      </LessonSection>

      {/* ===== Section 6: Your Personal Dashboard ===== */}
      <LessonSection title="6. Your Personal Dashboard">
        <Prose>
          <p>
            You don&apos;t need to watch everything. Based on what matters most
            to you, here are the indicators that deserve your attention \u2014
            and where to find them on the dashboard.
          </p>
        </Prose>

        <div className="space-y-3">
          <Card>
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Home size={16} className="text-blue-400" />
                <h4 className="text-sm font-medium text-foreground">
                  If You Own a Home
                </h4>
              </div>
              <ul className="text-xs text-foreground/80 space-y-1.5 ml-1">
                <li className="flex items-center gap-2">
                  <span className="text-muted shrink-0">&#x2022;</span>
                  <span>BoC policy rate and 5-year fixed mortgage rate \u2014 </span>
                  <DashboardLink label="Interest Rates" href="/economy/interest-rates" />
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-muted shrink-0">&#x2022;</span>
                  <span>Housing starts and building permits \u2014 </span>
                  <DashboardLink label="Housing Starts" href="/real-estate/housing" />
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-muted shrink-0">&#x2022;</span>
                  <span>Municipal assessment base (is the tax base growing?) \u2014 </span>
                  <DashboardLink label="Municipality Explorer" href="/municipalities" />
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-muted shrink-0">&#x2022;</span>
                  <span>Population growth and immigration \u2014 </span>
                  <DashboardLink label="People & Growth" href="/economy/population" />
                </li>
              </ul>
            </div>
          </Card>

          <Card>
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Home size={16} className="text-purple-400" />
                <h4 className="text-sm font-medium text-foreground">
                  If You Rent
                </h4>
              </div>
              <ul className="text-xs text-foreground/80 space-y-1.5 ml-1">
                <li className="flex items-center gap-2">
                  <span className="text-muted shrink-0">&#x2022;</span>
                  <span>Vacancy rate and average rents by unit type \u2014 </span>
                  <DashboardLink label="Rental Market" href="/real-estate/rental" />
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-muted shrink-0">&#x2022;</span>
                  <span>Housing completions (new supply entering the market) \u2014 </span>
                  <DashboardLink label="Housing Starts" href="/real-estate/housing" />
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-muted shrink-0">&#x2022;</span>
                  <span>Population growth (demand pressure) \u2014 </span>
                  <DashboardLink label="People & Growth" href="/economy/population" />
                </li>
              </ul>
            </div>
          </Card>

          <Card>
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-green-400" />
                <h4 className="text-sm font-medium text-foreground">
                  If You Own a Business
                </h4>
              </div>
              <ul className="text-xs text-foreground/80 space-y-1.5 ml-1">
                <li className="flex items-center gap-2">
                  <span className="text-muted shrink-0">&#x2022;</span>
                  <span>Business licences and new registrations \u2014 </span>
                  <DashboardLink label="Municipality Explorer" href="/municipalities" />
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-muted shrink-0">&#x2022;</span>
                  <span>Employment rate and weekly earnings \u2014 </span>
                  <DashboardLink label="Labour Market" href="/community/labour" />
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-muted shrink-0">&#x2022;</span>
                  <span>Population growth and net migration \u2014 </span>
                  <DashboardLink label="People & Growth" href="/economy/population" />
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-muted shrink-0">&#x2022;</span>
                  <span>Energy prices (if resource-linked) \u2014 </span>
                  <DashboardLink label="Energy Economy" href="/economy/energy" />
                </li>
              </ul>
            </div>
          </Card>

          <Card>
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Flame size={16} className="text-orange-400" />
                <h4 className="text-sm font-medium text-foreground">
                  If You&apos;re Job Hunting
                </h4>
              </div>
              <ul className="text-xs text-foreground/80 space-y-1.5 ml-1">
                <li className="flex items-center gap-2">
                  <span className="text-muted shrink-0">&#x2022;</span>
                  <span>Unemployment rate and trend direction \u2014 </span>
                  <DashboardLink label="Labour Market" href="/community/labour" />
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-muted shrink-0">&#x2022;</span>
                  <span>Building permits and business formation (leading indicators of hiring) \u2014 </span>
                  <DashboardLink label="Municipality Explorer" href="/municipalities" />
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-muted shrink-0">&#x2022;</span>
                  <span>Energy prices \u2014 when oil rises, Alberta hiring accelerates 3-6 months later \u2014 </span>
                  <DashboardLink label="Energy Economy" href="/economy/energy" />
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-muted shrink-0">&#x2022;</span>
                  <span>Major infrastructure projects in your region \u2014 </span>
                  <DashboardLink label="Overview" href="/" />
                </li>
              </ul>
            </div>
          </Card>

          <Card>
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-indigo-400" />
                <h4 className="text-sm font-medium text-foreground">
                  If You Care About Community Health
                </h4>
              </div>
              <ul className="text-xs text-foreground/80 space-y-1.5 ml-1">
                <li className="flex items-center gap-2">
                  <span className="text-muted shrink-0">&#x2022;</span>
                  <span>Crime Severity Index \u2014 </span>
                  <DashboardLink label="Safety" href="/community/crime" />
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-muted shrink-0">&#x2022;</span>
                  <span>Life expectancy (the ultimate community health metric) \u2014 </span>
                  <DashboardLink label="Health" href="/community/health/overview" />
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-muted shrink-0">&#x2022;</span>
                  <span>Assessment base and building permits (is your community investing in itself?) \u2014 </span>
                  <DashboardLink label="Municipality Explorer" href="/municipalities" />
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-muted shrink-0">&#x2022;</span>
                  <span>Wildfire risk and environmental conditions \u2014 </span>
                  <DashboardLink label="Wildfire" href="/environment/wildfire" />
                </li>
              </ul>
            </div>
          </Card>
        </div>

        <Insight variant="watch">
          You don&apos;t need to check the dashboard every day. Set a rhythm:
          once a month, spend 10 minutes looking at the 3-4 indicators that
          matter to your situation. Over time, you&apos;ll develop an intuition
          for the patterns \u2014 and you&apos;ll see shifts before they make
          the news.
        </Insight>
      </LessonSection>

      {/* ===== Closing ===== */}
      <SoWhat>
        <p>
          The patterns are not destiny. Every pattern you&apos;ve seen in these
          lessons has levers \u2014 some you can pull yourself, some you can
          influence by showing up. The dashboard gives you the data. The data
          gives you the questions. The questions give you power.
        </p>
        <p className="mt-2">
          That&apos;s the point.
        </p>
        <p className="mt-2">
          You now know how interest rates cascade through housing. How oil
          prices move employment. How population growth creates opportunity and
          pressure. How economic conditions lead safety outcomes by months. And
          you know which levers exist at every level \u2014 federal, provincial,
          municipal, and personal.
        </p>
        <p className="mt-2">
          The people who shape communities are not the ones with the most
          information. They&apos;re the ones who show up. Budget consultations,
          zoning hearings, council meetings, neighbourhood associations \u2014
          these are small rooms where big decisions get made, and most seats
          are empty.
        </p>
        <p className="mt-2 font-medium text-foreground">
          Fill a seat. Pull a lever. The data says it matters.
        </p>
      </SoWhat>

      <LessonNav
        prev={{ href: "/home/learn/safety-and-prosperity", label: "Safety & Prosperity" }}
        next={{ href: "/home/learn", label: "Back to All Lessons" }}
      />

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Alberta Pulse Check &mdash; The Community Levers &mdash; All data from
        free public APIs
      </footer>
    </main>
  );
}
