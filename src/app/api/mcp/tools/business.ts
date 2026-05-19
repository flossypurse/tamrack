/**
 * `tamrack_business` tool registration.
 *
 * Wraps the business + retail fetchers behind one typed surface. The
 * underlying substrate is split across two modules:
 *
 *   - `src/lib/data-sources-business.ts` — Edmonton/Calgary licences
 *     (Socrata SODA), StatsCan business counts (WDS Table 33-10-0170),
 *     ECCC facility GHG (CSV), Alberta WCB employer records (XLSX),
 *     Alberta non-profit listing (XLSX). ISED federal corporation count
 *     is exposed but the substrate returns 0 (bulk XML too large to fetch
 *     at request time) — we keep the category off the enum.
 *
 *   - `src/lib/data-sources-retail.ts` — StatsCan retail subsectors,
 *     e-commerce sales, food services, business dynamics
 *     (active/openings/closures), Edmonton licences by
 *     category/neighbourhood.
 *
 * Each category passes through whatever native row shape the substrate
 * returns. We do NOT flatten across categories — agents branch on
 * `category` (echoed at the payload level) and read the fields for that
 * dataset.
 *
 * Time range:
 *   StatsCan-backed categories accept a `latestN` periods count which we
 *   derive from `time_range` the same way as `tamrack_macro` (D12).
 *   Socrata-backed categories return rolling counts that aren't keyed by
 *   a single date; for those the `time_range` is silently ignored and a
 *   note is set on the envelope. CSV/XLSX one-shot snapshots return the
 *   most recent reporting year.
 *
 * Municipality parameter:
 *   The licence fetchers are inherently per-city — there's no slug to
 *   pass; the city is baked into the category name. Other categories are
 *   Alberta-wide. `municipality` is therefore silently ignored on every
 *   category and surfaced as a note when supplied.
 *
 * Fallback policy:
 *   No `data-fallback.ts` entries exist for the business surface. All
 *   substrate fetchers swallow upstream errors and return []; we degrade
 *   to `served_from: "empty"` rather than crashing.
 *
 * Categories DELIBERATELY excluded:
 *   - `non_profits` / `ised_corp_count` from the original brief enum:
 *     non_profits is exposed via the substrate (`fetchAlbertaNonProfits`)
 *     but the underlying XLSX is large and slow to parse at request time
 *     for a payload that's mostly the same week-to-week — we surface the
 *     two aggregated views (by city / by type) instead. ISED's substrate
 *     returns 0 (substrate comment: "ISED bulk file is >500MB — not
 *     practical for real-time fetch"), so the category is omitted to
 *     avoid advertising a tool input that always answers nothing.
 *   - `osfi`: exposed via the substrate but returns a hardcoded list
 *     rather than a live query, so it's not a meaningful surface here.
 *   - `licences_calgary_count` / `business_count_edmonton` (raw scalar
 *     counts): represented inside `licences_edmonton` /
 *     `licences_calgary` aggregated payloads instead.
 *   - `cra_t2`: the substrate fetcher tries two stale URLs and usually
 *     returns []; omitted until the substrate is updated.
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  fetchCalgaryBusinessByDistrict,
  fetchCalgaryBusinessByType,
  fetchCalgaryBusinessTrend,
  fetchEdmontonBusinessDetailedCategories,
  fetchGHGFacilities,
  fetchNonProfitsByCity,
  fetchNonProfitsByType,
  fetchStatCanBusinessBySector,
  fetchStatCanBusinessCounts,
  fetchTopEmittersByCompany,
  fetchWCBByIndustry,
} from "@/lib/data-sources-business";
import {
  fetchBusinessDynamics,
  fetchEcommerceSales,
  fetchEdmontonLicenceMonthlyTrend,
  fetchEdmontonLicencesByCategory,
  fetchEdmontonLicencesByNeighbourhood,
  fetchFoodBusinessDynamics,
  fetchFoodServices,
  fetchRetailBusinessDynamics,
  fetchRetailSubsectors,
} from "@/lib/data-sources-retail";

import {
  LimitSchema,
  MunicipalitySlugSchema,
  SCHEMA_VERSION,
  TimeRangeSchema,
  type TimeRange,
} from "../schemas";
import { updateToolEntry } from "../registry";
import { requireScopes } from "../lib/auth-context";

const REQUIRED_SCOPES = ["tamrack:economy:read"] as const;

// ---------------------------------------------------------------------------
// Category enum
// ---------------------------------------------------------------------------

const BUSINESS_CATEGORIES = [
  // Licences — Socrata per-city
  "licences_edmonton",
  "licences_calgary",
  // StatsCan business counts
  "business_count_statscan",
  "business_by_sector",
  // GHG / emissions
  "ghg_facilities",
  "top_emitters",
  // WCB
  "wcb",
  // Retail (StatsCan)
  "retail_subsectors",
  "ecommerce",
  "food_services",
  "business_dynamics",
  "retail_business_dynamics",
  "food_business_dynamics",
  // Non-profits (aggregated views only)
  "non_profits_by_city",
  "non_profits_by_type",
  // Edmonton licence aggregates from the retail substrate
  "edmonton_licences_by_category",
  "edmonton_licences_by_neighbourhood",
  "edmonton_licences_trend",
] as const;

type BusinessCategory = (typeof BUSINESS_CATEGORIES)[number];

const BusinessCategorySchema = z
  .enum(BUSINESS_CATEGORIES)
  .describe(
    "Business indicator category. Per-city licence aggregates (licences_edmonton, licences_calgary), StatsCan business counts (business_count_statscan, business_by_sector), GHG (ghg_facilities, top_emitters), WCB (wcb), retail (retail_subsectors, ecommerce, food_services, *_dynamics), non-profits aggregates (non_profits_by_*), and Edmonton licence aggregates (edmonton_licences_*).",
  );

const BusinessInputShape = {
  category: BusinessCategorySchema,
  municipality: MunicipalitySlugSchema.optional(),
  time_range: TimeRangeSchema.optional(),
  limit: LimitSchema.optional(),
};

// ---------------------------------------------------------------------------
// Time range helpers
// ---------------------------------------------------------------------------

function periodsForRange(
  range: TimeRange | undefined,
  defaultPeriods: number,
): number {
  if (!range) return defaultPeriods;
  if (typeof range === "string") {
    switch (range) {
      case "last_30d":
        return Math.max(3, defaultPeriods);
      case "last_year":
        return Math.max(12, defaultPeriods);
      case "last_5y":
        return Math.max(60, defaultPeriods);
      case "ytd": {
        const now = new Date();
        const startOfYear = Date.UTC(now.getUTCFullYear(), 0, 1);
        const months = Math.floor(
          (now.getTime() - startOfYear) / (30 * 86_400_000),
        ) + 1;
        return Math.max(months, defaultPeriods);
      }
    }
  }
  return Math.max(60, defaultPeriods);
}

function withinRange(date: string, range: TimeRange | undefined): boolean {
  if (!range || typeof range === "string") return true;
  if (!date) return true;
  if (range.from && date < range.from) return false;
  if (range.to && date > range.to) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Row schemas (pass-through from the substrate)
// ---------------------------------------------------------------------------

const TimeSeriesPointSchema = z.object({
  date: z.string(),
  value: z.number(),
  label: z.string().optional(),
});

const CalgaryBusinessByTypeSchema = z.object({
  licenceType: z.string(),
  count: z.number(),
});

const CalgaryBusinessByDistrictSchema = z.object({
  district: z.string(),
  districtName: z.string(),
  count: z.number(),
});

const CalgaryTrendPointSchema = z.object({
  date: z.string(),
  value: z.number(),
});

const EdmontonBusinessDetailSchema = z.object({
  category: z.string(),
  totalActive: z.number(),
  newThisYear: z.number(),
});

const BusinessCountByIndustrySchema = z.object({
  naicsCode: z.string(),
  naicsDescription: z.string(),
  establishments: z.number(),
  period: z.string(),
  employmentRange: z.string(),
});

const GHGFacilitySchema = z.object({
  facilityName: z.string(),
  parentCompany: z.string(),
  province: z.string(),
  city: z.string(),
  totalEmissions: z.number(),
  year: z.number(),
  naicsCode: z.string(),
  latitude: z.number(),
  longitude: z.number(),
});

const TopEmitterSchema = z.object({
  company: z.string(),
  totalEmissions: z.number(),
  facilityCount: z.number(),
  year: z.number(),
});

const WCBByIndustrySchema = z.object({
  industry: z.string(),
  employers: z.number(),
  claims: z.number(),
});

const RetailSubsectorPointSchema = z.object({
  date: z.string(),
  total: z.number(),
  motorVehicle: z.number(),
  furniture: z.number(),
  electronics: z.number(),
  buildingMaterials: z.number(),
  foodBeverage: z.number(),
  health: z.number(),
  gasoline: z.number(),
  clothing: z.number(),
  sporting: z.number(),
  generalMerch: z.number(),
});

const FoodServicesPointSchema = z.object({
  date: z.string(),
  total: z.number(),
  fullService: z.number(),
  limitedService: z.number(),
  drinking: z.number(),
});

const BusinessDynamicsPointSchema = z.object({
  date: z.string(),
  active: z.number(),
  openings: z.number(),
  closures: z.number(),
});

const NonProfitsByCitySchema = z.object({
  city: z.string(),
  count: z.number(),
});

const NonProfitsByTypeSchema = z.object({
  type: z.string(),
  count: z.number(),
});

const LicenceCategorySummarySchema = z.object({
  category: z.string(),
  count: z.number(),
});

const LicenceNeighbourhoodSummarySchema = z.object({
  neighbourhood: z.string(),
  count: z.number(),
});

const LicenceTrendSchema = z.object({
  date: z.string(),
  value: z.number(),
});

// ── Payload union ────────────────────────────────────────────────────────

const LicencesEdmontonPayloadSchema = z.object({
  category: z.literal("licences_edmonton"),
  rows: z.array(EdmontonBusinessDetailSchema),
});

const LicencesCalgaryPayloadSchema = z.object({
  category: z.literal("licences_calgary"),
  by_type: z.array(CalgaryBusinessByTypeSchema),
  by_district: z.array(CalgaryBusinessByDistrictSchema),
  trend: z.array(CalgaryTrendPointSchema),
});

const BusinessCountPayloadSchema = z.object({
  category: z.enum(["business_count_statscan", "business_by_sector"]),
  rows: z.array(BusinessCountByIndustrySchema),
});

const GHGFacilitiesPayloadSchema = z.object({
  category: z.literal("ghg_facilities"),
  rows: z.array(GHGFacilitySchema),
});

const TopEmittersPayloadSchema = z.object({
  category: z.literal("top_emitters"),
  rows: z.array(TopEmitterSchema),
});

const WCBPayloadSchema = z.object({
  category: z.literal("wcb"),
  rows: z.array(WCBByIndustrySchema),
});

const RetailSubsectorsPayloadSchema = z.object({
  category: z.literal("retail_subsectors"),
  rows: z.array(RetailSubsectorPointSchema),
});

const EcommercePayloadSchema = z.object({
  category: z.literal("ecommerce"),
  rows: z.array(TimeSeriesPointSchema),
});

const FoodServicesPayloadSchema = z.object({
  category: z.literal("food_services"),
  rows: z.array(FoodServicesPointSchema),
});

const BusinessDynamicsPayloadSchema = z.object({
  category: z.enum([
    "business_dynamics",
    "retail_business_dynamics",
    "food_business_dynamics",
  ]),
  rows: z.array(BusinessDynamicsPointSchema),
});

const NonProfitsByCityPayloadSchema = z.object({
  category: z.literal("non_profits_by_city"),
  rows: z.array(NonProfitsByCitySchema),
});

const NonProfitsByTypePayloadSchema = z.object({
  category: z.literal("non_profits_by_type"),
  rows: z.array(NonProfitsByTypeSchema),
});

const EdmontonLicencesByCategoryPayloadSchema = z.object({
  category: z.literal("edmonton_licences_by_category"),
  rows: z.array(LicenceCategorySummarySchema),
});

const EdmontonLicencesByNeighbourhoodPayloadSchema = z.object({
  category: z.literal("edmonton_licences_by_neighbourhood"),
  rows: z.array(LicenceNeighbourhoodSummarySchema),
});

const EdmontonLicencesTrendPayloadSchema = z.object({
  category: z.literal("edmonton_licences_trend"),
  rows: z.array(LicenceTrendSchema),
});

const BusinessPayloadSchema = z.union([
  LicencesEdmontonPayloadSchema,
  LicencesCalgaryPayloadSchema,
  BusinessCountPayloadSchema,
  GHGFacilitiesPayloadSchema,
  TopEmittersPayloadSchema,
  WCBPayloadSchema,
  RetailSubsectorsPayloadSchema,
  EcommercePayloadSchema,
  FoodServicesPayloadSchema,
  BusinessDynamicsPayloadSchema,
  NonProfitsByCityPayloadSchema,
  NonProfitsByTypePayloadSchema,
  EdmontonLicencesByCategoryPayloadSchema,
  EdmontonLicencesByNeighbourhoodPayloadSchema,
  EdmontonLicencesTrendPayloadSchema,
]);

const BusinessDataSchema = z.object({
  category: BusinessCategorySchema,
  source: z.string(),
  served_from: z.enum(["upstream", "fallback", "empty"]),
  notes: z.string().optional(),
  payload: BusinessPayloadSchema,
});

const BusinessEnvelopeSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  tool: z.literal("tamrack_business"),
  source: z.string(),
  data: BusinessDataSchema,
});
type BusinessEnvelope = z.infer<typeof BusinessEnvelopeSchema>;

// ---------------------------------------------------------------------------
// Per-category metadata
// ---------------------------------------------------------------------------

interface CategoryMeta {
  source: string;
  /** True when time_range filters/affects the response. */
  respectsTimeRange: boolean;
  defaultPeriods: number;
}

const CATEGORY_META: Record<BusinessCategory, CategoryMeta> = {
  licences_edmonton: {
    source: "open.edmonton.ca (Socrata SODA)",
    respectsTimeRange: false,
    defaultPeriods: 0,
  },
  licences_calgary: {
    source: "data.calgary.ca (Socrata SODA)",
    respectsTimeRange: false,
    defaultPeriods: 0,
  },
  business_count_statscan: {
    source: "Statistics Canada WDS (Table 33-10-0170)",
    respectsTimeRange: true,
    defaultPeriods: 5,
  },
  business_by_sector: {
    source: "Statistics Canada WDS (Table 33-10-0170)",
    respectsTimeRange: false,
    defaultPeriods: 1,
  },
  ghg_facilities: {
    source: "ECCC Facility GHG Reporting Program",
    respectsTimeRange: false,
    defaultPeriods: 0,
  },
  top_emitters: {
    source: "ECCC Facility GHG Reporting Program",
    respectsTimeRange: false,
    defaultPeriods: 0,
  },
  wcb: {
    source: "Alberta WCB Employer Industry Records (open.alberta.ca)",
    respectsTimeRange: false,
    defaultPeriods: 0,
  },
  retail_subsectors: {
    source: "Statistics Canada WDS (Table 20-10-0056)",
    respectsTimeRange: true,
    defaultPeriods: 60,
  },
  ecommerce: {
    source: "Statistics Canada WDS",
    respectsTimeRange: true,
    defaultPeriods: 60,
  },
  food_services: {
    source: "Statistics Canada WDS (Table 21-10-0019)",
    respectsTimeRange: true,
    defaultPeriods: 60,
  },
  business_dynamics: {
    source: "Statistics Canada WDS (Table 33-10-0270)",
    respectsTimeRange: true,
    defaultPeriods: 60,
  },
  retail_business_dynamics: {
    source: "Statistics Canada WDS (Table 33-10-0270, retail trade)",
    respectsTimeRange: true,
    defaultPeriods: 60,
  },
  food_business_dynamics: {
    source: "Statistics Canada WDS (Table 33-10-0270, food services)",
    respectsTimeRange: true,
    defaultPeriods: 60,
  },
  non_profits_by_city: {
    source: "Alberta Non-Profit Listing (open.alberta.ca, XLSX)",
    respectsTimeRange: false,
    defaultPeriods: 0,
  },
  non_profits_by_type: {
    source: "Alberta Non-Profit Listing (open.alberta.ca, XLSX)",
    respectsTimeRange: false,
    defaultPeriods: 0,
  },
  edmonton_licences_by_category: {
    source: "open.edmonton.ca (Socrata SODA)",
    respectsTimeRange: false,
    defaultPeriods: 0,
  },
  edmonton_licences_by_neighbourhood: {
    source: "open.edmonton.ca (Socrata SODA)",
    respectsTimeRange: false,
    defaultPeriods: 0,
  },
  edmonton_licences_trend: {
    source: "open.edmonton.ca (Socrata SODA, monthly aggregate)",
    respectsTimeRange: false,
    defaultPeriods: 0,
  },
};

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

const TOOL_NAME = "tamrack_business";

const TOOL_DESCRIPTION =
  "Business indicators for Alberta. Edmonton + Calgary business licence " +
  "aggregates (Socrata), StatsCan business counts and sector breakdowns " +
  "(WDS Table 33-10-0170), ECCC GHG facility emissions and top emitters " +
  "by parent company, Alberta WCB employer/claims summaries by industry, " +
  "StatsCan retail subsectors / e-commerce / food services / business " +
  "dynamics (openings + closures + active), and Alberta non-profit " +
  "aggregates by city/type. Each category returns its native row shape; " +
  "agents branch on the echoed `category` to read fields. `municipality` " +
  "is silently ignored (per-city categories carry the city in the name); " +
  "`time_range` is honoured on StatsCan time-series categories and noted " +
  "as ignored on snapshot categories.";

updateToolEntry(TOOL_NAME, {
  status: "live",
  parameters_summary:
    "category (enum: 18 values — see indicators[]); optional municipality (silently ignored — per-city categories are named e.g. licences_edmonton); optional time_range (honoured on StatsCan time-series categories); optional limit.",
  response_summary:
    "Envelope with schema_version, tool, source (per-category provenance); data.{category, source, served_from, payload}. Payload is a discriminated union keyed by `category`; each variant carries the native substrate row shape (rows[] for most, by_type/by_district/trend for licences_calgary).",
  indicators: [...BUSINESS_CATEGORIES],
  example_invocations: [
    {
      description: "Top 30 Alberta GHG-emitting companies (ECCC).",
      arguments: { category: "top_emitters" },
    },
    {
      description: "Alberta business counts by NAICS sector (StatsCan).",
      arguments: { category: "business_by_sector" },
    },
    {
      description:
        "Edmonton business licences aggregated by neighbourhood (Socrata).",
      arguments: { category: "edmonton_licences_by_neighbourhood" },
    },
  ],
});

export function registerBusinessTool(server: McpServer): void {
  server.registerTool(
    TOOL_NAME,
    {
      title: "Tamrack — Business Indicators",
      description: TOOL_DESCRIPTION,
      inputSchema: BusinessInputShape,
      annotations: {
        title: "Tamrack — Business Indicators",
        readOnlyHint: true,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    async (args) => {
      requireScopes(REQUIRED_SCOPES);
      const category = args.category;
      const meta = CATEGORY_META[category];
      const municipality = args.municipality;
      const timeRange = args.time_range;
      const periods = periodsForRange(timeRange, meta.defaultPeriods);
      const limit = args.limit;

      let payload: z.infer<typeof BusinessPayloadSchema>;
      let servedFrom: "upstream" | "fallback" | "empty" = "empty";
      const notesParts: string[] = [];

      try {
        switch (category) {
          case "licences_edmonton": {
            const rows = await fetchEdmontonBusinessDetailedCategories(
              limit ?? 50,
            );
            servedFrom = rows.length > 0 ? "upstream" : "empty";
            payload = { category: "licences_edmonton", rows };
            break;
          }
          case "licences_calgary": {
            const [byType, byDistrict, trend] = await Promise.all([
              fetchCalgaryBusinessByType(limit ?? 30).catch(() => []),
              fetchCalgaryBusinessByDistrict(limit ?? 30).catch(() => []),
              fetchCalgaryBusinessTrend().catch(() => []),
            ]);
            const filteredTrend = trend.filter((t) =>
              withinRange(t.date, timeRange),
            );
            servedFrom =
              byType.length + byDistrict.length + filteredTrend.length > 0
                ? "upstream"
                : "empty";
            payload = {
              category: "licences_calgary",
              by_type: byType,
              by_district: byDistrict,
              trend: filteredTrend,
            };
            break;
          }
          case "business_count_statscan": {
            void periods; // StatsCan counts substrate ignores periods (latestN=5 hardcoded)
            const rows = await fetchStatCanBusinessCounts();
            const filtered = rows.filter((r) =>
              withinRange(r.period, timeRange),
            );
            const capped = limit != null ? filtered.slice(-limit) : filtered;
            servedFrom = capped.length > 0 ? "upstream" : "empty";
            payload = { category: "business_count_statscan", rows: capped };
            break;
          }
          case "business_by_sector": {
            const rows = await fetchStatCanBusinessBySector();
            const capped = limit != null ? rows.slice(0, limit) : rows;
            servedFrom = capped.length > 0 ? "upstream" : "empty";
            payload = { category: "business_by_sector", rows: capped };
            break;
          }
          case "ghg_facilities": {
            const rows = await fetchGHGFacilities(limit ?? 50);
            servedFrom = rows.length > 0 ? "upstream" : "empty";
            payload = { category: "ghg_facilities", rows };
            break;
          }
          case "top_emitters": {
            const rows = await fetchTopEmittersByCompany(limit ?? 30);
            servedFrom = rows.length > 0 ? "upstream" : "empty";
            payload = { category: "top_emitters", rows };
            break;
          }
          case "wcb": {
            const rows = await fetchWCBByIndustry();
            const capped = limit != null ? rows.slice(0, limit) : rows;
            servedFrom = capped.length > 0 ? "upstream" : "empty";
            payload = { category: "wcb", rows: capped };
            break;
          }
          case "retail_subsectors": {
            const rows = await fetchRetailSubsectors(periods);
            const filtered = rows.filter((r) => withinRange(r.date, timeRange));
            const capped = limit != null ? filtered.slice(-limit) : filtered;
            servedFrom = capped.length > 0 ? "upstream" : "empty";
            payload = { category: "retail_subsectors", rows: capped };
            break;
          }
          case "ecommerce": {
            const rows = await fetchEcommerceSales(periods);
            const filtered = rows.filter((r) => withinRange(r.date, timeRange));
            const capped = limit != null ? filtered.slice(-limit) : filtered;
            servedFrom = capped.length > 0 ? "upstream" : "empty";
            payload = { category: "ecommerce", rows: capped };
            break;
          }
          case "food_services": {
            const rows = await fetchFoodServices(periods);
            const filtered = rows.filter((r) => withinRange(r.date, timeRange));
            const capped = limit != null ? filtered.slice(-limit) : filtered;
            servedFrom = capped.length > 0 ? "upstream" : "empty";
            payload = { category: "food_services", rows: capped };
            break;
          }
          case "business_dynamics": {
            const rows = await fetchBusinessDynamics(periods);
            const filtered = rows.filter((r) => withinRange(r.date, timeRange));
            const capped = limit != null ? filtered.slice(-limit) : filtered;
            servedFrom = capped.length > 0 ? "upstream" : "empty";
            payload = { category: "business_dynamics", rows: capped };
            break;
          }
          case "retail_business_dynamics": {
            const rows = await fetchRetailBusinessDynamics(periods);
            const filtered = rows.filter((r) => withinRange(r.date, timeRange));
            const capped = limit != null ? filtered.slice(-limit) : filtered;
            servedFrom = capped.length > 0 ? "upstream" : "empty";
            payload = { category: "retail_business_dynamics", rows: capped };
            break;
          }
          case "food_business_dynamics": {
            const rows = await fetchFoodBusinessDynamics(periods);
            const filtered = rows.filter((r) => withinRange(r.date, timeRange));
            const capped = limit != null ? filtered.slice(-limit) : filtered;
            servedFrom = capped.length > 0 ? "upstream" : "empty";
            payload = { category: "food_business_dynamics", rows: capped };
            break;
          }
          case "non_profits_by_city": {
            const rows = await fetchNonProfitsByCity(limit ?? 20);
            servedFrom = rows.length > 0 ? "upstream" : "empty";
            payload = { category: "non_profits_by_city", rows };
            break;
          }
          case "non_profits_by_type": {
            const rows = await fetchNonProfitsByType();
            const capped = limit != null ? rows.slice(0, limit) : rows;
            servedFrom = capped.length > 0 ? "upstream" : "empty";
            payload = { category: "non_profits_by_type", rows: capped };
            break;
          }
          case "edmonton_licences_by_category": {
            const rows = await fetchEdmontonLicencesByCategory();
            const capped = limit != null ? rows.slice(0, limit) : rows;
            servedFrom = capped.length > 0 ? "upstream" : "empty";
            payload = {
              category: "edmonton_licences_by_category",
              rows: capped,
            };
            break;
          }
          case "edmonton_licences_by_neighbourhood": {
            const rows = await fetchEdmontonLicencesByNeighbourhood();
            const capped = limit != null ? rows.slice(0, limit) : rows;
            servedFrom = capped.length > 0 ? "upstream" : "empty";
            payload = {
              category: "edmonton_licences_by_neighbourhood",
              rows: capped,
            };
            break;
          }
          case "edmonton_licences_trend": {
            const rows = await fetchEdmontonLicenceMonthlyTrend();
            const filtered = rows.filter((r) => withinRange(r.date, timeRange));
            const capped = limit != null ? filtered.slice(-limit) : filtered;
            servedFrom = capped.length > 0 ? "upstream" : "empty";
            payload = { category: "edmonton_licences_trend", rows: capped };
            break;
          }
        }
      } catch (err) {
        // Substrate fetchers swallow their own errors and return [], so
        // reaching here means something further upstream threw. Degrade
        // to an empty envelope rather than crashing.
        console.warn(
          `[mcp:${TOOL_NAME}] unexpected throw for ${category}:`,
          err,
        );
        servedFrom = "empty";
        notesParts.push(
          `substrate fetcher threw for ${category}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        payload = emptyPayloadFor(category);
      }

      if (municipality != null) {
        notesParts.push(
          `municipality parameter is silently ignored — per-city categories carry the city in the category name (e.g. licences_edmonton)`,
        );
      }
      if (timeRange != null && !meta.respectsTimeRange) {
        notesParts.push(
          `time_range is silently ignored for category "${category}" (substrate returns a snapshot / aggregated view, not a time series)`,
        );
      }

      const envelope: BusinessEnvelope = {
        schema_version: SCHEMA_VERSION,
        tool: TOOL_NAME,
        source: meta.source,
        data: {
          category,
          source: meta.source,
          served_from: servedFrom,
          notes: notesParts.length > 0 ? notesParts.join("; ") : undefined,
          payload,
        },
      };

      const parsed = BusinessEnvelopeSchema.parse(envelope);

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(parsed, null, 2) },
        ],
        structuredContent: parsed as unknown as Record<string, unknown>,
      };
    },
  );
}

function emptyPayloadFor(
  category: BusinessCategory,
): z.infer<typeof BusinessPayloadSchema> {
  switch (category) {
    case "licences_edmonton":
      return { category: "licences_edmonton", rows: [] };
    case "licences_calgary":
      return {
        category: "licences_calgary",
        by_type: [],
        by_district: [],
        trend: [],
      };
    case "business_count_statscan":
    case "business_by_sector":
      return { category, rows: [] };
    case "ghg_facilities":
      return { category: "ghg_facilities", rows: [] };
    case "top_emitters":
      return { category: "top_emitters", rows: [] };
    case "wcb":
      return { category: "wcb", rows: [] };
    case "retail_subsectors":
      return { category: "retail_subsectors", rows: [] };
    case "ecommerce":
      return { category: "ecommerce", rows: [] };
    case "food_services":
      return { category: "food_services", rows: [] };
    case "business_dynamics":
    case "retail_business_dynamics":
    case "food_business_dynamics":
      return { category, rows: [] };
    case "non_profits_by_city":
      return { category: "non_profits_by_city", rows: [] };
    case "non_profits_by_type":
      return { category: "non_profits_by_type", rows: [] };
    case "edmonton_licences_by_category":
      return { category: "edmonton_licences_by_category", rows: [] };
    case "edmonton_licences_by_neighbourhood":
      return { category: "edmonton_licences_by_neighbourhood", rows: [] };
    case "edmonton_licences_trend":
      return { category: "edmonton_licences_trend", rows: [] };
  }
}
