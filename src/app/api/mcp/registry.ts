/**
 * Tool + domain registry for the Alberta Pulse MCP server.
 *
 * This is the single source of truth that both `catalog.ts` and the per-tool
 * registration files read from. When Parcels 3–5 add typed tools, they
 * flip their entry's `status` from `"planned"` to `"live"` and fill in the
 * indicator inventory and concrete parameter summary — they do NOT
 * restructure the registry.
 *
 * Three statuses:
 *
 *   - "live"     — tool is registered with the MCP server and callable now.
 *   - "planned"  — scheduled in v1, registration lands in a later parcel.
 *                  Advertised in the catalog so agents can see what's
 *                  coming, but `tools/call` against it returns
 *                  "method not found" until that parcel ships.
 *   - "deferred" — explicitly deferred to v2 per the design doc. Listed
 *                  so callers can plan around their availability without
 *                  asking us out-of-band.
 *
 * No tool registration logic lives here — that's `tools/<name>.ts`. Keep
 * this file declarative: data, not behaviour.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ToolStatus = "live" | "planned" | "deferred";

export type ToolDomain =
  | "discovery"
  | "macro"
  | "regional"
  | "real_estate"
  | "housing"
  | "business"
  | "energy"
  | "search"
  | "municipality"
  // v2-deferred domains follow
  | "entities"
  | "safety"
  | "immigration"
  | "politics"
  | "fiscal"
  | "environment"
  | "health"
  | "signals";

export interface ToolExample {
  /** One-line natural-language description of the invocation. */
  description: string;
  /** Arguments the agent should pass to `tools/call`. */
  arguments: Record<string, unknown>;
}

export interface ToolEntry {
  name: string;
  status: ToolStatus;
  domain: ToolDomain;
  /**
   * One- or two-sentence description aimed at the calling agent. Mention
   * upstream provenance (StatsCan, BoC, CMHC, AESO, CER, etc.) when known
   * so the agent can cite sources downstream.
   */
  description: string;
  /**
   * Human-readable summary of the input parameters. Parcels 3–5 fill this
   * in with the concrete shape; v2-deferred tools may leave it as a
   * placeholder.
   */
  parameters_summary: string;
  /** Human-readable summary of the response payload. */
  response_summary: string;
  /**
   * Indicator / dataset inventory for this tool's domain. Catalog uses this
   * directly. May be:
   *   - `string[]` — flat list of enum-like names.
   *   - `{ count_indicative, note }` — placeholder while the real list
   *     hasn't been wired in yet (Parcel 3 fills regional).
   *   - `null` — domain has no inventory (e.g. catalog itself).
   */
  indicators:
    | string[]
    | { count_indicative: number; note: string }
    | null;
  /**
   * At least one example invocation for live tools. Catalog also has a
   * top-level set of cross-tool examples — these are tool-specific.
   */
  example_invocations: ToolExample[];
}

export interface DomainDescriptor {
  name: ToolDomain;
  description: string;
}

// ---------------------------------------------------------------------------
// Domains
// ---------------------------------------------------------------------------

export const TOOL_DOMAINS: DomainDescriptor[] = [
  {
    name: "discovery",
    description:
      "Catalog + tool/indicator/municipality discovery. Call tamrack_catalog first when you don't know what's available.",
  },
  {
    name: "macro",
    description:
      "Province- and country-level macro indicators (BoC policy rate, CAD/USD, mortgage rates, StatsCan unemployment / CPI / GDP / housing starts, Alberta Activity Index).",
  },
  {
    name: "regional",
    description:
      "Alberta Regional Dashboard — 54 socioeconomic indicators across ~340 municipalities (population, labour force, building permits, sale prices, vacancy, migration, etc.).",
  },
  {
    name: "real_estate",
    description:
      "Municipal real estate data — property assessments, building permits, development permits via ArcGIS / Socrata feeds (Edmonton, Calgary, St. Albert, Strathcona, Parkland, Stony Plain, Spruce Grove, plus others in the registry).",
  },
  {
    name: "housing",
    description:
      "CMHC Housing Market Information — starts, completions, under-construction, vacancy, rents, absorptions, conventional mortgage rate.",
  },
  {
    name: "business",
    description:
      "Business indicators — Edmonton/Calgary licences, StatsCan business counts, GHG facilities + top emitters, WCB, non-profits, ISED corporate counts.",
  },
  {
    name: "energy",
    description:
      "AESO pool price / supply-demand / forecast, CER pipeline throughput / incidents / apportionment, Alberta oil production.",
  },
  {
    name: "search",
    description:
      "Alberta CKAN dataset search — long-tail escape hatch when none of the typed tools fit. Returns ranked open.alberta.ca datasets.",
  },
  {
    name: "municipality",
    description:
      "Municipality registry entries — population, region, capabilities, available datasets — for any Alberta municipality in the registry.",
  },
  // Deferred to v2 — the domains exist conceptually so the catalog can
  // advertise them and so Parcel 6's docs read coherently.
  {
    name: "entities",
    description:
      "(v2) Named-entity intelligence — tri-region operators and other curated entity data. Requires a Postgres migration before this can ship.",
  },
  {
    name: "safety",
    description:
      "(v2) Crime, fire, wildfire, and 511 alerts.",
  },
  {
    name: "immigration",
    description:
      "(v2) IRCC immigration data — by category, CMA, occupation, and trend.",
  },
  {
    name: "politics",
    description:
      "(v2) MLAs, MPs, electoral districts, votes, debates, and election results.",
  },
  {
    name: "fiscal",
    description:
      "(v2) Provincial grants, federal transfers, federal contracts and grants.",
  },
  {
    name: "environment",
    description:
      "(v2) Water levels, AQHI air quality, earthquakes, climate.",
  },
  {
    name: "health",
    description:
      "(v2) Life expectancy, births/deaths, causes of death.",
  },
  {
    name: "signals",
    description:
      "(v2) Cross-domain signal mining — shape depends on what proves useful once v1 has run.",
  },
];

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

/**
 * Macro indicators — the contract Parcel 3 implements. Listed here so
 * `tamrack_catalog` can advertise them before `tamrack_macro` is wired up.
 */
export const MACRO_INDICATORS = [
  "policy_rate",
  "cad_usd",
  "mortgage_5y",
  "unemployment",
  "cpi",
  "gdp",
  "housing_starts",
  "aax",
] as const;

export type MacroIndicator = (typeof MACRO_INDICATORS)[number];

/**
 * Registry of every v1 + v2 tool, keyed by tool name. Order matters for the
 * catalog payload's `tools[]` array (catalog first, then v1 typed, then
 * v2-deferred). Use `getToolEntries()` instead of iterating this directly
 * when you want a stable order.
 */
const TOOL_ENTRIES_BY_NAME: Record<string, ToolEntry> = {
  // ── Discovery ─────────────────────────────────────────────
  tamrack_catalog: {
    name: "tamrack_catalog",
    status: "live",
    domain: "discovery",
    description:
      "Returns the full Tamrack MCP inventory: tools, domains, indicators per domain, live municipalities, and example invocations. Call this first when you don't already know what's available — it's a single call, no parameters, no upstream fetches.",
    parameters_summary: "No parameters.",
    response_summary:
      "JSON object with schema_version, tools[], domains[], municipalities[], indicators_by_domain, and example_invocations[].",
    indicators: null,
    example_invocations: [
      {
        description:
          "Discover the full Tamrack MCP inventory before issuing any data query.",
        arguments: {},
      },
    ],
  },

  // ── v1 typed tools (planned in Parcel 2; Parcels 3–5 flip to "live") ──

  tamrack_macro: {
    name: "tamrack_macro",
    status: "planned",
    domain: "macro",
    description:
      "Macro indicators for Canada / Alberta: BoC policy rate and CAD/USD (Bank of Canada Valet), StatsCan unemployment / CPI / GDP / housing starts, conventional 5y mortgage rate, Alberta Activity Index.",
    parameters_summary:
      "indicator (one of: policy_rate, cad_usd, mortgage_5y, unemployment, cpi, gdp, housing_starts, aax); optional time_range.",
    response_summary:
      "Time-series points { date, value } with provenance and units.",
    indicators: [...MACRO_INDICATORS],
    example_invocations: [
      {
        description:
          "Bank of Canada policy rate over the last year (daily series).",
        arguments: { indicator: "policy_rate", time_range: "last_year" },
      },
    ],
  },

  tamrack_regional: {
    name: "tamrack_regional",
    status: "planned",
    domain: "regional",
    description:
      "Alberta Regional Dashboard — the workhorse municipal indicator surface. 54 indicators (population, labour, permits, sale prices, vacancy, migration, etc.) across ~340 municipalities. Falls back to Postgres snapshots when the upstream API is down.",
    parameters_summary:
      "indicator (human-readable name, see indicators[]); municipality (slug from registry); optional time_range.",
    response_summary:
      "Time-series points { date, value, unit } scoped to the chosen municipality.",
    // Real indicator list is exported by src/lib/data-sources-regional.ts;
    // Parcel 3 fills this from REGIONAL_INDICATORS directly so it can't
    // drift. Placeholder until then.
    indicators: {
      count_indicative: 54,
      note: "Registry not yet wired to REGIONAL_INDICATORS — Parcel 3 fills this in.",
    },
    example_invocations: [
      {
        description: "Edmonton population from the regional dashboard.",
        arguments: { indicator: "Population", municipality: "edmonton" },
      },
    ],
  },

  tamrack_municipality: {
    name: "tamrack_municipality",
    status: "planned",
    domain: "municipality",
    description:
      "Registry entry + summary card for a single Alberta municipality (population, region, capabilities, available datasets). Use this when you need to know what a municipality exposes before fanning out across other tools.",
    parameters_summary: "slug (municipality registry slug).",
    response_summary:
      "Municipality config + summary including data capabilities and source endpoints.",
    indicators: null,
    example_invocations: [
      {
        description: "Inspect what data is available for Strathcona County.",
        arguments: { slug: "strathcona" },
      },
    ],
  },

  tamrack_real_estate: {
    name: "tamrack_real_estate",
    status: "planned",
    domain: "real_estate",
    description:
      "Municipal real estate datasets — property assessments, building permits, development permits — via ArcGIS / Socrata. Coverage depends on the municipality's registry entry; tools surface `{ available: false, reason }` rather than throwing for unavailable datasets.",
    parameters_summary:
      "municipality (registry slug); dataset (one of: assessments, permits, dev_permits); optional limit and time_range.",
    response_summary:
      "Array of typed records with municipality-specific fields normalised where possible.",
    indicators: ["assessments", "permits", "dev_permits"],
    example_invocations: [
      {
        description: "Recent development permits in St. Albert.",
        arguments: {
          municipality: "st-albert",
          dataset: "dev_permits",
          limit: 50,
        },
      },
    ],
  },

  tamrack_housing: {
    name: "tamrack_housing",
    status: "planned",
    domain: "housing",
    description:
      "CMHC Housing Market Information — starts, completions, under-construction, vacancy, rents, absorptions, conventional mortgage rate.",
    parameters_summary:
      "indicator (e.g. starts, completions, vacancy, rents); optional municipality and time_range.",
    response_summary:
      "Time-series points and/or breakdowns keyed by the requested indicator.",
    indicators: [
      "starts",
      "completions",
      "under_construction",
      "vacancy",
      "rents",
      "absorptions",
      "mortgage_rate",
    ],
    example_invocations: [
      {
        description: "CMHC housing starts in Calgary over the last 5 years.",
        arguments: {
          indicator: "starts",
          municipality: "calgary",
          time_range: "last_5y",
        },
      },
    ],
  },

  tamrack_business: {
    name: "tamrack_business",
    status: "planned",
    domain: "business",
    description:
      "Business indicators — Edmonton + Calgary licences, StatsCan business counts, GHG facilities + top emitters, WCB classifications, non-profits, ISED corporate counts.",
    parameters_summary:
      "category (e.g. licences, counts, ghg, top_emitters, wcb, non_profits, ised); optional municipality and time_range.",
    response_summary: "Typed records or time-series points per category.",
    indicators: [
      "licences",
      "counts",
      "ghg_facilities",
      "top_emitters",
      "wcb",
      "non_profits",
      "ised_corp_count",
    ],
    example_invocations: [
      {
        description: "Top GHG-emitting facilities in Alberta.",
        arguments: { category: "top_emitters" },
      },
    ],
  },

  tamrack_energy: {
    name: "tamrack_energy",
    status: "planned",
    domain: "energy",
    description:
      "AESO pool price / supply-demand / forecast (real-time and historical) plus CER pipeline throughput / incidents / apportionment and Alberta oil production.",
    parameters_summary:
      "type (one of: pool_price, supply_demand, forecast, pipeline_throughput, pipeline_incidents, apportionment, oil_production); optional time_range.",
    response_summary:
      "Time-series or tabular records, with provenance noted (AESO vs CER vs StatsCan).",
    indicators: [
      "pool_price",
      "supply_demand",
      "forecast",
      "pipeline_throughput",
      "pipeline_incidents",
      "apportionment",
      "oil_production",
    ],
    example_invocations: [
      {
        description: "AESO pool price over the last 30 days.",
        arguments: { type: "pool_price", time_range: "last_30d" },
      },
    ],
  },

  tamrack_search: {
    name: "tamrack_search",
    status: "planned",
    domain: "search",
    description:
      "Long-tail escape hatch — searches the Alberta CKAN catalogue (open.alberta.ca) for datasets the typed tools don't expose. Returns ranked results with dataset ids you can follow up on.",
    parameters_summary: "query (free-text string); optional limit.",
    response_summary:
      "Ranked array of CKAN dataset records with id, title, organisation, last updated.",
    indicators: null,
    example_invocations: [
      {
        description: "Find Alberta open datasets about wildfire suppression.",
        arguments: { query: "wildfire suppression" },
      },
    ],
  },

  // ── v2-deferred tools ──────────────────────────────────────────────────

  tamrack_entities: {
    name: "tamrack_entities",
    status: "deferred",
    domain: "entities",
    description:
      "(v2) Named-entity intelligence — tri-region operators and other curated entity data. Deferred to v2 pending a data-migration prerequisite.",
    parameters_summary: "TBD with v2 design.",
    response_summary: "TBD with v2 design.",
    indicators: null,
    example_invocations: [],
  },
  tamrack_safety: {
    name: "tamrack_safety",
    status: "deferred",
    domain: "safety",
    description:
      "(v2) Public safety — crime, fire, wildfire, and Alberta 511 alerts. Deferred to v2.",
    parameters_summary: "TBD with v2 design.",
    response_summary: "TBD with v2 design.",
    indicators: null,
    example_invocations: [],
  },
  tamrack_immigration: {
    name: "tamrack_immigration",
    status: "deferred",
    domain: "immigration",
    description:
      "(v2) IRCC immigration data — by category, CMA, occupation, and trend. Deferred to v2.",
    parameters_summary: "TBD with v2 design.",
    response_summary: "TBD with v2 design.",
    indicators: null,
    example_invocations: [],
  },
  tamrack_politics: {
    name: "tamrack_politics",
    status: "deferred",
    domain: "politics",
    description:
      "(v2) MLAs, MPs, electoral districts, votes, debates, and election results. Deferred to v2.",
    parameters_summary: "TBD with v2 design.",
    response_summary: "TBD with v2 design.",
    indicators: null,
    example_invocations: [],
  },
  tamrack_fiscal: {
    name: "tamrack_fiscal",
    status: "deferred",
    domain: "fiscal",
    description:
      "(v2) Provincial grants, federal transfers, federal contracts and grants. Deferred to v2.",
    parameters_summary: "TBD with v2 design.",
    response_summary: "TBD with v2 design.",
    indicators: null,
    example_invocations: [],
  },
  tamrack_environment: {
    name: "tamrack_environment",
    status: "deferred",
    domain: "environment",
    description:
      "(v2) Water levels, AQHI air quality, earthquakes, climate. Deferred to v2.",
    parameters_summary: "TBD with v2 design.",
    response_summary: "TBD with v2 design.",
    indicators: null,
    example_invocations: [],
  },
  tamrack_health: {
    name: "tamrack_health",
    status: "deferred",
    domain: "health",
    description:
      "(v2) Life expectancy, births/deaths, causes of death. Deferred to v2.",
    parameters_summary: "TBD with v2 design.",
    response_summary: "TBD with v2 design.",
    indicators: null,
    example_invocations: [],
  },
  tamrack_signals: {
    name: "tamrack_signals",
    status: "deferred",
    domain: "signals",
    description:
      "(v2) Cross-domain signal mining — shape depends on what proves useful once v1 has run. Deferred to v2.",
    parameters_summary: "TBD with v2 design.",
    response_summary: "TBD with v2 design.",
    indicators: null,
    example_invocations: [],
  },
};

// Stable ordering for catalog output: catalog first, then v1 typed in
// design-doc order, then v2-deferred in design-doc order.
const TOOL_ORDER: readonly string[] = [
  "tamrack_catalog",
  "tamrack_macro",
  "tamrack_regional",
  "tamrack_municipality",
  "tamrack_real_estate",
  "tamrack_housing",
  "tamrack_business",
  "tamrack_energy",
  "tamrack_search",
  "tamrack_entities",
  "tamrack_safety",
  "tamrack_immigration",
  "tamrack_politics",
  "tamrack_fiscal",
  "tamrack_environment",
  "tamrack_health",
  "tamrack_signals",
];

// ---------------------------------------------------------------------------
// Accessors (the only entry points other modules should use)
// ---------------------------------------------------------------------------

export function getToolEntries(): ToolEntry[] {
  return TOOL_ORDER.map((name) => {
    const entry = TOOL_ENTRIES_BY_NAME[name];
    if (!entry) {
      throw new Error(
        `Tool registry ordering references unknown name: ${name}`,
      );
    }
    return entry;
  });
}

export function getToolEntry(name: string): ToolEntry | undefined {
  return TOOL_ENTRIES_BY_NAME[name];
}

/**
 * Parcels 3–5 call this to flip a planned entry to live and overwrite its
 * placeholder parameters_summary / response_summary / indicators / examples
 * with the real values once the tool actually registers. Keeping the
 * mutation here (instead of inline edits to the const above) makes the
 * Parcel diff small and easy to review.
 *
 * No-ops on unknown names — caller decides whether that's a bug.
 */
export function updateToolEntry(
  name: string,
  updates: Partial<Omit<ToolEntry, "name">>,
): void {
  const existing = TOOL_ENTRIES_BY_NAME[name];
  if (!existing) return;
  TOOL_ENTRIES_BY_NAME[name] = { ...existing, ...updates };
}
