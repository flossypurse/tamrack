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
  title: "The Land — Alberta 101",
  description:
    "Alberta's six natural regions, 661,848 km² of land, and why geography shapes everything from jobs to housing prices.",
};

export default function GeographyLessonPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
      <BigQuestion>What makes Alberta... Alberta?</BigQuestion>

      <Prose>
        <p>
          Before you can read a single chart on this dashboard, you need a mental
          map. Alberta is not one place — it&apos;s at least six very different
          landscapes stitched together inside a single provincial border. The
          economy looks completely different depending on where you stand.
        </p>
      </Prose>

      {/* --------------------------------------------------------------- */}
      <LessonSection title="Size and Borders">
        <Prose>
          <p>
            Alberta covers <strong>661,848 km&sup2;</strong> of land area. To
            put that in perspective, it is larger than France (643,801 km&sup2;),
            larger than Texas (695,662 km&sup2; minus water), and roughly the
            size of Afghanistan. From the Montana border in the south to the 60th
            parallel in the north is about 1,200 km — a 13-hour drive if you
            don&apos;t stop.
          </p>
          <p>
            The province is bordered by British Columbia to the west (along the
            Rocky Mountain continental divide), Saskatchewan to the east, the
            Northwest Territories to the north, and the U.S. state of Montana to
            the south. That southern border matters more than you might think: it
            is the gateway for pipeline routes, cross-border trade, and the
            movement of goods along the CANAMEX corridor connecting Alberta to
            Mexico.
          </p>
        </Prose>

        <Insight>
          Alberta is larger than France. You could fit the Netherlands inside it
          about 16 times. This vast scale means that &ldquo;Alberta data&rdquo;
          often hides enormous regional variation — a fact that becomes critical
          when you start reading economic indicators.
        </Insight>
      </LessonSection>

      {/* --------------------------------------------------------------- */}
      <LessonSection title="Six Natural Regions">
        <Prose>
          <p>
            Alberta is officially divided into six natural regions, each defined
            by climate, vegetation, and landform. These regions are not just
            geography trivia — they directly determine what kind of economic
            activity happens where.
          </p>
        </Prose>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="border border-card-border rounded-lg p-4 space-y-1">
            <h4 className="text-sm font-semibold text-foreground">Grassland</h4>
            <p className="text-xs text-muted leading-relaxed">
              The southeastern corner. Dry, flat, and treeless. This is cattle
              country and irrigated agriculture — Lethbridge, Medicine Hat, and
              Brooks. Irrigation districts here produce a disproportionate share
              of Alberta&apos;s crop value.
            </p>
          </div>
          <div className="border border-card-border rounded-lg p-4 space-y-1">
            <h4 className="text-sm font-semibold text-foreground">Parkland</h4>
            <p className="text-xs text-muted leading-relaxed">
              A crescent-shaped transition zone wrapping through central Alberta.
              Rich soils, mixed farming, and the corridor between Edmonton and
              Calgary. Red Deer sits right in the heart of it. This is some of
              Canada&apos;s most productive agricultural land.
            </p>
          </div>
          <div className="border border-card-border rounded-lg p-4 space-y-1">
            <h4 className="text-sm font-semibold text-foreground">Foothills</h4>
            <p className="text-xs text-muted leading-relaxed">
              The rolling hills where the prairies meet the mountains.
              Ranching, forestry, and natural gas extraction. Communities like
              Sundre, Rocky Mountain House, and Pincher Creek are Foothills
              towns. Wind energy is booming here too.
            </p>
          </div>
          <div className="border border-card-border rounded-lg p-4 space-y-1">
            <h4 className="text-sm font-semibold text-foreground">Rocky Mountain</h4>
            <p className="text-xs text-muted leading-relaxed">
              The western spine. Banff, Jasper, Canmore, Kananaskis. Economically
              dominated by tourism, parks, and recreation. Very little resource
              extraction but enormous cultural and brand value for Alberta. Also
              the headwaters for most of Alberta&apos;s rivers.
            </p>
          </div>
          <div className="border border-card-border rounded-lg p-4 space-y-1">
            <h4 className="text-sm font-semibold text-foreground">Boreal Forest</h4>
            <p className="text-xs text-muted leading-relaxed">
              The giant. The Boreal covers roughly the entire northern half of
              the province — from Athabasca to Fort McMurray to Peace River.
              Oil sands, forestry, and Indigenous communities. This is where
              most of Alberta&apos;s energy wealth is physically extracted.
            </p>
          </div>
          <div className="border border-card-border rounded-lg p-4 space-y-1">
            <h4 className="text-sm font-semibold text-foreground">Canadian Shield</h4>
            <p className="text-xs text-muted leading-relaxed">
              A tiny sliver in the far northeast corner — part of the ancient
              Precambrian rock that underlies most of central Canada. Mostly
              wilderness, very few residents, and almost no economic activity.
              But it connects Alberta geologically to the rest of the Shield
              provinces.
            </p>
          </div>
        </div>

        <Expandable title="Why do natural regions matter for economics?">
          <Prose>
            <p>
              Natural regions determine what the land can support. You cannot
              grow irrigated crops on the Canadian Shield. You cannot build a
              ski resort in the Grasslands. Oil sands only exist beneath the
              Boreal. When economists talk about &ldquo;regional
              diversification,&rdquo; they are really talking about what each
              natural region can sustain.
            </p>
            <p>
              This is why provincial averages can be misleading. An average
              unemployment rate for all of Alberta blends Fort McMurray (boom
              and bust with oil) and Lethbridge (steady agricultural base).
              Those are fundamentally different economies, and natural regions
              are the reason why.
            </p>
          </Prose>
        </Expandable>
      </LessonSection>

      {/* --------------------------------------------------------------- */}
      <LessonSection title="Water: The Hidden Infrastructure">
        <Prose>
          <p>
            Alberta&apos;s rivers flow from west to east, born in Rocky
            Mountain glaciers and snowpack. The North Saskatchewan feeds
            Edmonton. The Bow and Elbow feed Calgary. The Oldman and its
            tributaries feed southern irrigation districts. The Athabasca
            flows north through the oil sands.
          </p>
          <p>
            Water allocation is one of the most important — and least
            understood — economic constraints in the province. Southern
            Alberta already faces water scarcity. The Bow River basin is
            essentially fully allocated, meaning no new water licences are
            being issued. This has direct implications for where new
            development can happen: if there is no water, there is no growth.
          </p>
        </Prose>

        <Insight variant="watch">
          Water scarcity in southern Alberta is already constraining
          development. The South Saskatchewan River Basin is closed to new
          allocations. Watch for water transfer markets and irrigation
          district investments — they signal where growth is possible and
          where it is not.
        </Insight>
      </LessonSection>

      {/* --------------------------------------------------------------- */}
      <LessonSection title="Climate and Extremes">
        <Prose>
          <p>
            Alberta has a continental climate with extreme temperature swings.
            Edmonton averages &minus;10.4&deg;C in January and +17.7&deg;C in
            July. Calgary is similar but benefits from Chinook winds — warm,
            dry gusts that can raise winter temperatures by 20&deg;C in a few
            hours.
          </p>
          <p>
            These extremes affect everything. Construction seasons are
            compressed into roughly May through October in most of the
            province, which is why housing starts data is so seasonal.
            Energy demand spikes in winter (heating) and summer
            (air conditioning in newer buildings). Agricultural yields depend
            on a short frost-free season of about 100 to 120 days.
          </p>
          <p>
            Wildfire is the other constant. Northern Alberta&apos;s Boreal
            Forest is fire-adapted, and major wildfire seasons (like 2016 in
            Fort McMurray and 2023 across the province) can disrupt oil
            production, displace thousands, and send smoke across the
            continent.
          </p>
        </Prose>
      </LessonSection>

      {/* --------------------------------------------------------------- */}
      <LessonSection title="Putting It Together">
        <SoWhat>
          <p>
            Geography is not background information — it is the foundation of
            Alberta&apos;s economy. The Boreal holds the oil. The Grasslands
            grow the food. The Mountains attract the tourists. The Parkland
            corridor connects the two major cities. And water ties it all
            together (or limits it).
          </p>
          <p>
            Every chart you see on Tamrack is shaped by these physical
            realities. When you see a spike in construction permits in
            Lethbridge, it makes more sense when you know Lethbridge sits in
            irrigated agricultural country with reliable water. When Fort
            McMurray&apos;s population swings wildly, it makes more sense
            when you know the Boreal economy runs on a single commodity.
          </p>
        </SoWhat>
      </LessonSection>

      <LessonNav
        prev={{ href: "/learn", label: "Course Overview" }}
        next={{ href: "/learn/alberta-101/people", label: "The People" }}
      />

      <LessonCompleteButton moduleSlug="alberta-101" lessonSlug="geography" />
    </main>
  );
}
