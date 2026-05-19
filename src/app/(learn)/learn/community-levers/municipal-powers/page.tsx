import type { Metadata } from "next";
import { Card } from "@/components/card";
import {
  Prose,
  BigQuestion,
  Insight,
  Expandable,
  LessonSection,
  SoWhat,
} from "@/components/learn-lesson";
import { Globe, Landmark, Users } from "lucide-react";
import { LessonCompleteButton } from "@/components/learn-lesson-complete";

// ============================================================
// Metadata
// ============================================================

export const metadata: Metadata = {
  title: "Municipal Powers — Community Levers — Pulse Learn",
  description:
    "What can you actually change? The three types of levers that shape your community — federal, provincial/municipal, and community — and which ones you can pull.",
};

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
// Page
// ============================================================

export default function MunicipalPowersPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
      <BigQuestion>What can we actually change?</BigQuestion>

      <Prose>
        <p>
          You&apos;ve seen the data. Interest rates, oil prices, immigration
          policy — these are forces that move your community, but you
          don&apos;t control them. So what DO you control?
        </p>
        <p>
          More than you think. This lesson maps every pattern you&apos;ve
          learned to the levers that can shift it. Some levers are beyond your
          reach. Some you can influence by showing up. And some you can pull
          yourself, starting today.
        </p>
      </Prose>

      {/* ===== Three Types of Levers ===== */}
      <LessonSection title="Three Types of Levers">
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
                  what the dashboard is for — watching the signals so
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
                  association. These are the levers you pull directly — no
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

      {/* ===== Safety & Wellbeing Levers ===== */}
      <LessonSection title="Safety &amp; Wellbeing — Upstream vs. Downstream">
        <Prose>
          <p>
            You learned in a previous module that economic conditions lead
            safety outcomes by 6-12 months. But there&apos;s a deeper pattern:
            most community safety spending is <strong>downstream</strong> —
            police, courts, incarceration. The evidence consistently shows
            that <strong>upstream</strong> spending is more effective per dollar.
          </p>
          <p>
            Upstream means addressing root causes before they become criminal
            justice problems: youth programs, mental health services, addiction
            treatment, housing stability, and economic opportunity. This
            isn&apos;t soft idealism — it&apos;s what the data says works.
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
          Communities with strong social cohesion — where neighbours know
          each other — consistently have lower crime rates regardless of
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
              after a 6-month waitlist. These are not theoretical —
              they&apos;re programs running in Alberta municipalities right now,
              and the ones that measure outcomes consistently show returns.
            </p>
          </Prose>
        </Expandable>
      </LessonSection>

      <SoWhat>
        Not all levers are created equal. Federal and global forces set the
        boundary conditions, but municipal and community levers are where your
        time and energy have the highest return. The next two lessons explore the
        two most powerful municipal levers: zoning and economic development.
      </SoWhat>

      <LessonCompleteButton moduleSlug="community-levers" lessonSlug="municipal-powers" />

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Tamrack &mdash; Municipal Powers &mdash; All data from
        free public APIs
      </footer>
    </main>
  );
}
