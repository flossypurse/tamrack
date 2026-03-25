import type { Metadata } from "next";
import { Suspense } from "react";
import { Card } from "@/components/card";
import {
  fetchStatCanTimeSeries,
  STATSCAN_SERIES,
  type TimeSeriesPoint,
} from "@/lib/data-sources";
import {
  Prose,
  BigQuestion,
  LiveDataPoint,
  DataGrid,
  Insight,
  Expandable,
  LessonSection,
  SoWhat,
} from "@/components/learn-lesson";
import {
  Globe,
  Landmark,
  Users,
  Home,
  TrendingUp,
  Flame,
  Shield,
} from "lucide-react";
import { LessonCompleteButton } from "@/components/learn-lesson-complete";

// ============================================================
// Metadata
// ============================================================

export const metadata: Metadata = {
  title: "Economic Development — Community Levers — Pulse Learn",
  description:
    "Attracting investment, building economic resilience beyond oil, and the personal dashboard — what indicators to watch for your situation.",
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
// Helper
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
// LeverCard
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
// Dashboard link
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
// Economic Resilience live data
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
        sentimentality — it is measurable economics. Local businesses hire
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
            isn&apos;t to replace energy — it&apos;s to build enough
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

export default function EconomicDevelopmentPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
      <BigQuestion>How does a community build economic resilience?</BigQuestion>

      <Prose>
        <p>
          Alberta&apos;s economy has been through multiple boom-bust cycles
          driven by global energy prices. You learned in previous lessons how
          oil prices cascade through employment, housing, and safety. The
          question now is: what levers exist to build resilience against the
          next cycle?
        </p>
      </Prose>

      {/* ===== Economic Resilience ===== */}
      <LessonSection title="Economic Resilience — Beyond Oil">
        <Suspense fallback={<LoadingCard />}>
          <EconomicResilienceSection />
        </Suspense>
      </LessonSection>

      {/* ===== Your Personal Dashboard ===== */}
      <LessonSection title="Your Personal Dashboard">
        <Prose>
          <p>
            You don&apos;t need to watch everything. Based on what matters most
            to you, here are the indicators that deserve your attention — and
            where to find them on the dashboard.
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
                  <span>BoC policy rate and 5-year fixed mortgage rate — </span>
                  <DashboardLink label="Interest Rates" href="/economy/interest-rates" />
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-muted shrink-0">&#x2022;</span>
                  <span>Housing starts and building permits — </span>
                  <DashboardLink label="Housing Starts" href="/real-estate/housing" />
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-muted shrink-0">&#x2022;</span>
                  <span>Municipal assessment base (is the tax base growing?) — </span>
                  <DashboardLink label="Municipality Explorer" href="/municipalities" />
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-muted shrink-0">&#x2022;</span>
                  <span>Population growth and immigration — </span>
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
                  <span>Vacancy rate and average rents by unit type — </span>
                  <DashboardLink label="Rental Market" href="/real-estate/rental" />
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-muted shrink-0">&#x2022;</span>
                  <span>Housing completions (new supply entering the market) — </span>
                  <DashboardLink label="Housing Starts" href="/real-estate/housing" />
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-muted shrink-0">&#x2022;</span>
                  <span>Population growth (demand pressure) — </span>
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
                  <span>Business licences and new registrations — </span>
                  <DashboardLink label="Municipality Explorer" href="/municipalities" />
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-muted shrink-0">&#x2022;</span>
                  <span>Employment rate and weekly earnings — </span>
                  <DashboardLink label="Labour Market" href="/community/labour" />
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-muted shrink-0">&#x2022;</span>
                  <span>Population growth and net migration — </span>
                  <DashboardLink label="People & Growth" href="/economy/population" />
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-muted shrink-0">&#x2022;</span>
                  <span>Energy prices (if resource-linked) — </span>
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
                  <span>Unemployment rate and trend direction — </span>
                  <DashboardLink label="Labour Market" href="/community/labour" />
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-muted shrink-0">&#x2022;</span>
                  <span>Building permits and business formation (leading indicators of hiring) — </span>
                  <DashboardLink label="Municipality Explorer" href="/municipalities" />
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-muted shrink-0">&#x2022;</span>
                  <span>Energy prices — when oil rises, Alberta hiring accelerates 3-6 months later — </span>
                  <DashboardLink label="Energy Economy" href="/economy/energy" />
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-muted shrink-0">&#x2022;</span>
                  <span>Major infrastructure projects in your region — </span>
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
                  <span>Crime Severity Index — </span>
                  <DashboardLink label="Safety" href="/community/crime" />
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-muted shrink-0">&#x2022;</span>
                  <span>Life expectancy (the ultimate community health metric) — </span>
                  <DashboardLink label="Health" href="/community/health/overview" />
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-muted shrink-0">&#x2022;</span>
                  <span>Assessment base and building permits (is your community investing in itself?) — </span>
                  <DashboardLink label="Municipality Explorer" href="/municipalities" />
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-muted shrink-0">&#x2022;</span>
                  <span>Wildfire risk and environmental conditions — </span>
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
          for the patterns — and you&apos;ll see shifts before they make
          the news.
        </Insight>
      </LessonSection>

      <SoWhat>
        <p>
          The patterns are not destiny. Every pattern you&apos;ve seen in these
          lessons has levers — some you can pull yourself, some you can
          influence by showing up. The dashboard gives you the data. The data
          gives you the questions. The questions give you power.
        </p>
        <p className="mt-2">
          That&apos;s the point.
        </p>
        <p className="mt-2">
          The people who shape communities are not the ones with the most
          information. They&apos;re the ones who show up. Budget consultations,
          zoning hearings, council meetings, neighbourhood associations —
          these are small rooms where big decisions get made, and most seats
          are empty.
        </p>
        <p className="mt-2 font-medium text-foreground">
          Fill a seat. Pull a lever. The data says it matters.
        </p>
      </SoWhat>

      <LessonCompleteButton moduleSlug="community-levers" lessonSlug="economic-development" />

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Alberta Pulse Check &mdash; Economic Development &mdash; All data from
        free public APIs
      </footer>
    </main>
  );
}
