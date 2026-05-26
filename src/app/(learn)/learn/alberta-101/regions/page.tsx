import type { Metadata } from "next";
import {
  Prose,
  BigQuestion,
  LessonSection,
  Insight,
  Expandable,
  SoWhat,
  LessonNav,
} from "@/components/learn-lesson";
import { LessonCompleteButton } from "@/components/learn-lesson-complete";

export const metadata: Metadata = {
  title: "The Regions — Alberta 101",
  description:
    "Edmonton Metro, Calgary Metro, and the economic geography of Alberta's distinct regions.",
};

export default function RegionsLessonPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
      <BigQuestion>Why does it matter where in Alberta?</BigQuestion>

      <Prose>
        <p>
          Alberta is often talked about as if it were a single economy. It is
          not. The province contains at least six distinct economic regions,
          each with different industries, different demographics, and different
          responses to the same macroeconomic forces. An oil price drop hits
          Fort McMurray immediately but barely registers in Lethbridge. A
          federal interest rate hike hammers Calgary real estate but is
          irrelevant to a grain farmer near Vulcan.
        </p>
        <p>
          Understanding these regions is essential for reading the data on this
          dashboard. Provincial averages hide more than they reveal.
        </p>
      </Prose>

      {/* --------------------------------------------------------------- */}
      <LessonSection title="Edmonton Metropolitan Region">
        <Prose>
          <p>
            <strong>Population:</strong> ~1.6 million (metro) &middot;{" "}
            <strong>Role:</strong> Provincial capital, government, oil field
            services, petrochemicals, logistics
          </p>
          <p>
            Edmonton is the gateway to northern Alberta. It is where the oil
            sands service companies are headquartered, where refining and
            petrochemical processing happens (Strathcona County&apos;s
            Industrial Heartland is one of the largest hydrocarbon processing
            clusters in North America), and where provincial government
            employment provides a stabilizing economic base.
          </p>
          <p>
            The Edmonton metro area includes satellite communities like
            St. Albert, Sherwood Park (Strathcona County), Spruce Grove,
            Stony Plain, Leduc, Beaumont, and Fort Saskatchewan. Each has
            its own economic character: Fort Saskatchewan is heavy industrial,
            Leduc benefits from airport proximity, St. Albert is residential
            and professional.
          </p>
          <p>
            Edmonton&apos;s economy is more diversified than most people think.
            Government (University of Alberta, provincial agencies), health
            care, and logistics (the city is a major rail and highway hub)
            provide ballast when energy cycles turn down. This diversification
            shows up in the data: Edmonton&apos;s unemployment rate is
            typically more stable than Calgary&apos;s during oil busts.
          </p>
        </Prose>
      </LessonSection>

      {/* --------------------------------------------------------------- */}
      <LessonSection title="Calgary Metropolitan Region">
        <Prose>
          <p>
            <strong>Population:</strong> ~1.7 million (metro) &middot;{" "}
            <strong>Role:</strong> Corporate headquarters, finance, tech,
            energy company head offices
          </p>
          <p>
            Calgary is Alberta&apos;s largest city and its corporate centre.
            Most major energy companies (Suncor, CNRL, Cenovus, Imperial Oil,
            TC Energy) are headquartered here. The downtown office towers were
            purpose-built for the energy sector, which is why Calgary
            experienced the country&apos;s worst downtown office vacancy crisis
            after the 2015 oil crash — at one point over 30% of downtown
            office space sat empty.
          </p>
          <p>
            But Calgary is also leading Alberta&apos;s tech diversification.
            Companies like Benevity, Shareworks, and a growing number of
            startups have established a presence. The Calgary metro area
            includes Airdrie, Cochrane, Chestermere, and Okotoks — all fast-
            growing bedroom communities driven by relatively affordable housing
            compared to the city core.
          </p>
          <p>
            Calgary&apos;s economy is more volatile than Edmonton&apos;s
            because it is more directly tied to energy sector corporate
            decisions. When oil companies cut capital budgets, the layoffs
            happen in Calgary head offices first. This makes Calgary&apos;s
            real estate and employment data among the most cyclical in Canada.
          </p>
        </Prose>

        <Insight>
          The &ldquo;two Albertas&rdquo; are not just urban and rural. Even
          within urban Alberta, Edmonton and Calgary have fundamentally
          different economic profiles. Edmonton is steadied by government and
          services. Calgary swings with corporate energy. Their housing
          markets, employment figures, and business formation data tell
          different stories — and comparing them is one of the most useful
          analytical tools on this dashboard.
        </Insight>
      </LessonSection>

      {/* --------------------------------------------------------------- */}
      <LessonSection title="Central Alberta">
        <Prose>
          <p>
            <strong>Hub:</strong> Red Deer (~110,000) &middot;{" "}
            <strong>Character:</strong> Agriculture, logistics, light
            manufacturing, oil field services
          </p>
          <p>
            Central Alberta is the corridor between Edmonton and Calgary,
            centered on Red Deer. It sits in the Parkland natural region —
            some of the most fertile agricultural land in western Canada.
            The region serves as a logistics and distribution hub (it is
            equidistant from both major cities on the QEII highway) and has
            a significant oil field services sector.
          </p>
          <p>
            Red Deer&apos;s economy is a microcosm of Alberta: part
            agriculture, part energy, part services. This makes it sensitive
            to both oil price swings and agricultural commodity cycles. The
            Lacombe and Ponoka communities nearby are more purely
            agricultural.
          </p>
        </Prose>
      </LessonSection>

      {/* --------------------------------------------------------------- */}
      <LessonSection title="Southern Alberta">
        <Prose>
          <p>
            <strong>Hubs:</strong> Lethbridge (~105,000), Medicine Hat
            (~65,000), Brooks (~15,000) &middot;{" "}
            <strong>Character:</strong> Irrigated agriculture, food
            processing, renewable energy
          </p>
          <p>
            Southern Alberta is agricultural Alberta. The irrigation districts
            here — fed by the Oldman, St. Mary, and Bow rivers — produce a
            huge share of Canada&apos;s sugar beets, potatoes, canola, and
            specialty crops. Brooks is home to one of Canada&apos;s largest
            meat processing plants (JBS).
          </p>
          <p>
            Lethbridge has a more diversified base thanks to the University of
            Lethbridge, a growing tech presence, and proximity to both
            agricultural land and the U.S. border (Coutts crossing). Medicine
            Hat is notable for having its own natural gas reserves — the city
            literally sits on a gas field, giving it some of the lowest
            utility costs in the country.
          </p>
          <p>
            Southern Alberta is also becoming a renewable energy corridor. The
            wind and solar resources in the Grassland and Foothills regions are
            excellent, and the area has seen significant investment in wind
            farms and solar installations.
          </p>
        </Prose>
      </LessonSection>

      {/* --------------------------------------------------------------- */}
      <LessonSection title="Northern Alberta">
        <Prose>
          <p>
            <strong>Hub:</strong> Fort McMurray (Wood Buffalo, ~75,000) &middot;{" "}
            <strong>Character:</strong> Oil sands extraction, fly-in/fly-out
            workforce, Indigenous communities
          </p>
          <p>
            Northern Alberta is where most of the province&apos;s energy
            wealth is physically extracted. The Athabasca oil sands near Fort
            McMurray represent one of the largest petroleum reserves on Earth.
            The Peace River region to the northwest has conventional oil, gas,
            and increasingly, grain farming as the climate warms.
          </p>
          <p>
            Fort McMurray (officially the Regional Municipality of Wood
            Buffalo) is perhaps the most extreme boom-bust community in
            Canada. Its population can swing by thousands in a single year
            depending on oil sands investment decisions. Housing prices have
            seen 50%+ swings. The 2016 wildfire that forced the evacuation of
            the entire city added climate risk to an already volatile picture.
          </p>
          <p>
            Much of northern Alberta is also home to First Nations and Metis
            communities. Their economic participation in resource development
            — through impact benefit agreements, Indigenous-owned businesses,
            and land stewardship — is an increasingly important part of the
            regional story.
          </p>
        </Prose>

        <Expandable title="The fly-in/fly-out economy">
          <Prose>
            <p>
              A significant portion of the oil sands workforce does not live
              in Fort McMurray at all. They fly in from Edmonton, Calgary,
              Newfoundland, or even the Philippines for two-week rotations in
              work camps, then fly home. This means Fort McMurray&apos;s
              official population understates the actual economic activity
              happening there, and it means that oil sands spending flows
              outward to other communities through wages spent elsewhere.
            </p>
            <p>
              This fly-in/fly-out pattern also makes housing and services
              data for Fort McMurray uniquely tricky to interpret. The census
              population and the &ldquo;working population&rdquo; at any
              given time can differ by tens of thousands.
            </p>
          </Prose>
        </Expandable>
      </LessonSection>

      {/* --------------------------------------------------------------- */}
      <LessonSection title="Mountain Communities">
        <Prose>
          <p>
            <strong>Hubs:</strong> Banff, Jasper, Canmore &middot;{" "}
            <strong>Character:</strong> Tourism, parks, recreation, second
            homes
          </p>
          <p>
            Alberta&apos;s Rocky Mountain communities are tourism-driven
            economies. Banff National Park alone receives over 4 million
            visitors per year. Canmore, just outside the park boundary, has
            become one of the most expensive real estate markets in Alberta,
            driven by a combination of tourism, remote workers, and wealthy
            second-home buyers.
          </p>
          <p>
            Jasper suffered a devastating wildfire in 2024 that destroyed a
            significant portion of the townsite, adding another dimension to
            the mountain economy story — climate-driven physical risk to the
            built environment.
          </p>
          <p>
            The mountain communities have very different data patterns from
            the rest of Alberta. Unemployment is seasonal (tourism peaks in
            summer and winter ski season). Housing is constrained by national
            park boundaries and municipal growth limits. Average incomes can
            be misleading because they blend high-earning professionals with
            seasonal hospitality workers.
          </p>
        </Prose>
      </LessonSection>

      {/* --------------------------------------------------------------- */}
      <LessonSection title="Why This Matters for Reading Data">
        <Insight variant="warning">
          The biggest mistake people make when reading Alberta economic data is
          treating the province as a single unit. A provincial unemployment
          rate of 6% could mean 4% in Edmonton and 10% in Fort McMurray. A
          provincial average home price blends $800,000 Canmore condos with
          $250,000 Medicine Hat houses. Always ask: &ldquo;Which Alberta is
          this data about?&rdquo;
        </Insight>

        <SoWhat>
          <p>
            Alberta has at least six distinct economic regions, each responding
            differently to the same forces. Edmonton is government-steadied.
            Calgary swings with corporate energy. Central Alberta bridges
            agriculture and oil services. The south is agricultural and
            renewable. The north is extraction-dependent. The mountains are
            tourism-driven.
          </p>
          <p>
            When you explore the municipality pages on this dashboard, you are
            not looking at variations of the same economy — you are looking at
            fundamentally different economies that happen to share a provincial
            government. That understanding is the single most important thing
            you can take from Alberta 101.
          </p>
        </SoWhat>
      </LessonSection>

      <LessonNav
        prev={{ href: "/learn/alberta-101/people", label: "The People" }}
        next={{ href: "/learn/alberta-101/quiz", label: "Module Quiz" }}
      />

      <LessonCompleteButton moduleSlug="alberta-101" lessonSlug="regions" />
    </main>
  );
}
