/**
 * Realtor Neighbourhood Data Aggregator
 *
 * Provides neighbourhood-level deep dives:
 * - Edmonton & Calgary: UAlberta neighbourhood assessment data (year-over-year)
 * - Other municipalities: Assessment-by-zoning breakdown from ArcGIS
 */

import {
  fetchNeighbourhoodAssessments,
  type NeighbourhoodAssessment,
} from "../data-sources-ualberta";
import {
  getMunicipality,
  type MunicipalityConfig,
} from "../municipality-registry";
import {
  fetchAssessmentsByGroup,
  type AssessmentByGroup,
} from "../municipality-data";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NeighbourhoodRanking {
  neighbourhood: string;
  avgAssessment: number;
  propertyCount: number;
  yoyChange: number | null; // percentage change year-over-year
  avgLotSize: number;
  avgYearBuilt: number;
}

export interface MuniNeighbourhoodData {
  slug: string;
  name: string;
  hasUAlbertaData: boolean;
  latestYear: number | null;
  neighbourhoods: NeighbourhoodRanking[];
  zoningBreakdown: AssessmentByGroup[];
}

export interface NeighbourhoodSnapshot {
  operatingArea: string[];
  municipalityNames: string[];
  generatedAt: string;
  municipalities: MuniNeighbourhoodData[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugToName(slug: string): string {
  const config = getMunicipality(slug);
  if (config) return config.name;
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function buildNeighbourhoodRankings(
  assessments: NeighbourhoodAssessment[],
): { latestYear: number | null; rankings: NeighbourhoodRanking[] } {
  if (assessments.length === 0) return { latestYear: null, rankings: [] };

  const latestYear = Math.max(...assessments.map((a) => a.year));
  const prevYear = latestYear - 1;

  const latestData = assessments.filter((a) => a.year === latestYear);
  const prevData = assessments.filter((a) => a.year === prevYear);

  const prevMap = new Map<string, number>();
  for (const a of prevData) {
    prevMap.set(a.neighbourhood, a.avgAssessment);
  }

  const rankings: NeighbourhoodRanking[] = latestData
    .filter((a) => a.avgAssessment > 0 && a.propertyCount > 0)
    .map((a) => {
      const prevAvg = prevMap.get(a.neighbourhood);
      const yoyChange =
        prevAvg && prevAvg > 0
          ? ((a.avgAssessment - prevAvg) / prevAvg) * 100
          : null;

      return {
        neighbourhood: a.neighbourhood,
        avgAssessment: Math.round(a.avgAssessment),
        propertyCount: a.propertyCount,
        yoyChange: yoyChange !== null ? Math.round(yoyChange * 10) / 10 : null,
        avgLotSize: a.avgLotSize,
        avgYearBuilt: Math.round(a.avgYearBuilt),
      };
    })
    .sort((a, b) => b.avgAssessment - a.avgAssessment);

  return { latestYear, rankings };
}

// ---------------------------------------------------------------------------
// Main aggregator
// ---------------------------------------------------------------------------

export async function buildNeighbourhoodSnapshot(
  operatingArea: string[],
): Promise<NeighbourhoodSnapshot> {
  const names = operatingArea.map(slugToName);

  const municipalities = await Promise.all(
    operatingArea.map(async (slug) => {
      const config = getMunicipality(slug);
      const name = slugToName(slug);

      // Edmonton and Calgary have UAlberta neighbourhood data
      if (slug === "edmonton" || slug === "calgary") {
        const city = slug === "edmonton" ? "Edmonton" : "Calgary";
        const assessments = await fetchNeighbourhoodAssessments(city).catch(() => []);
        const { latestYear, rankings } = buildNeighbourhoodRankings(assessments);

        return {
          slug,
          name,
          hasUAlbertaData: true,
          latestYear,
          neighbourhoods: rankings,
          zoningBreakdown: [],
        };
      }

      // Other municipalities: try assessment-by-zoning or neighbourhood
      if (!config) {
        return {
          slug,
          name,
          hasUAlbertaData: false,
          latestYear: null,
          neighbourhoods: [],
          zoningBreakdown: [],
        };
      }

      // Try neighbourhood grouping first, fall back to zoning
      const hasNeighbourhoodField = !!config.fields.neighbourhood;
      const [zoningData, neighbourhoodData] = await Promise.all([
        fetchAssessmentsByGroup(config, "zoning").catch(() => []),
        hasNeighbourhoodField
          ? fetchAssessmentsByGroup(config, "neighbourhood").catch(() => [])
          : Promise.resolve([]),
      ]);

      // Convert neighbourhood assessment groups to ranking format
      const neighbourhoods: NeighbourhoodRanking[] = neighbourhoodData.map((a) => ({
        neighbourhood: a.group,
        avgAssessment: a.avgAssessment,
        propertyCount: a.count,
        yoyChange: null, // no YoY data from ArcGIS
        avgLotSize: 0,
        avgYearBuilt: 0,
      }));

      return {
        slug,
        name,
        hasUAlbertaData: false,
        latestYear: null,
        neighbourhoods,
        zoningBreakdown: zoningData,
      };
    }),
  );

  return {
    operatingArea,
    municipalityNames: names,
    generatedAt: new Date().toISOString(),
    municipalities,
  };
}
