/**
 * Shared zod schemas for the Alberta Pulse MCP server.
 *
 * Every typed tool (Parcels 3–5) imports from this file. Defining the
 * common shapes here keeps:
 *
 *   - Catalog descriptions exact-aligned with what the tools actually
 *     accept (no drift between docs and behaviour).
 *   - Municipality slug validation single-sourced from the live registry,
 *     so adding a municipality there automatically propagates.
 *   - Response envelopes (schema_version) consistent across every tool.
 */
import { z } from "zod";

import {
  getLiveMunicipalities,
  type MunicipalityConfig,
} from "@/lib/municipality-registry";

// ---------------------------------------------------------------------------
// Schema version
// ---------------------------------------------------------------------------

/**
 * Bumped manually when any tool's response shape or the catalog payload
 * shape changes in a way callers must notice. Tools embed this on every
 * response so agents can branch on it.
 */
export const SCHEMA_VERSION = "1.0.0" as const;

// ---------------------------------------------------------------------------
// Municipality slug
// ---------------------------------------------------------------------------

const LIVE_MUNICIPALITY_SLUGS: readonly string[] = getLiveMunicipalities().map(
  (m: MunicipalityConfig) => m.slug,
);

if (LIVE_MUNICIPALITY_SLUGS.length === 0) {
  // Defensive: a regression that drains the registry would silently break
  // every tool's input validation. Fail loud at module load instead.
  throw new Error(
    "MCP schemas: municipality registry is empty; cannot derive MunicipalitySlugSchema",
  );
}

/**
 * Accepts any slug whose municipality is `status: "live"` in
 * `src/lib/municipality-registry.ts`. Built once at module load — tools do
 * not need to re-read the registry on every call.
 */
export const MunicipalitySlugSchema = z
  .enum(LIVE_MUNICIPALITY_SLUGS as [string, ...string[]])
  .describe(
    "Slug of a live Alberta municipality (e.g. 'edmonton', 'calgary', 'stony-plain'). Use tamrack_catalog.municipalities[] for the authoritative list.",
  );

export type MunicipalitySlug = z.infer<typeof MunicipalitySlugSchema>;

// ---------------------------------------------------------------------------
// Time range
// ---------------------------------------------------------------------------

/**
 * Named ranges supported by downstream substrate fetchers. Picked to cover
 * the dominant cases the products already query:
 *   - last_30d  → high-frequency macro series (BoC daily, AESO 5-min)
 *   - last_year → typical chart window for everything
 *   - last_5y   → CMHC + regional dashboard yearly series
 *   - ytd       → fiscal/calendar reporting
 *
 * If a tool needs a finer-grained range, pass an explicit `{ from, to }`
 * object instead.
 */
export const NamedTimeRangeSchema = z
  .enum(["last_30d", "last_year", "last_5y", "ytd"])
  .describe(
    "Named time range. Use 'last_30d' for daily series, 'last_year' for typical charts, 'last_5y' for long history, 'ytd' for year-to-date.",
  );

export type NamedTimeRange = z.infer<typeof NamedTimeRangeSchema>;

/**
 * Explicit ISO-date range. Both bounds are optional individually so callers
 * can pass `{ from: "2020-01-01" }` for an open-ended forward window.
 */
export const ExplicitTimeRangeSchema = z
  .object({
    from: z
      .iso
      .date()
      .optional()
      .describe("ISO date (YYYY-MM-DD) inclusive lower bound."),
    to: z
      .iso
      .date()
      .optional()
      .describe("ISO date (YYYY-MM-DD) inclusive upper bound."),
  })
  .describe("Explicit ISO-date range.");

export type ExplicitTimeRange = z.infer<typeof ExplicitTimeRangeSchema>;

/**
 * Unified `time_range` parameter accepted across every typed tool. Either
 * a named bucket or an explicit `{ from, to }` object.
 */
export const TimeRangeSchema = z
  .union([NamedTimeRangeSchema, ExplicitTimeRangeSchema])
  .describe(
    "Time range as a named bucket ('last_30d' | 'last_year' | 'last_5y' | 'ytd') or an explicit {from, to} ISO-date object.",
  );

export type TimeRange = z.infer<typeof TimeRangeSchema>;

// ---------------------------------------------------------------------------
// Limit
// ---------------------------------------------------------------------------

/**
 * Cap chosen to bound a single response under the MCP transport's typical
 * JSON-RPC payload comfort zone (a few MB) while still letting agents pull
 * the bulk of a typical municipality dataset in one call. Per-tool caps
 * can override this if their rows are unusually large.
 */
export const MAX_LIMIT = 1000;

export const LimitSchema = z
  .number()
  .int()
  .positive()
  .max(MAX_LIMIT)
  .describe(
    `Maximum number of rows to return (1..${MAX_LIMIT}). Tools may apply tighter per-domain caps.`,
  );

export type Limit = z.infer<typeof LimitSchema>;

// ---------------------------------------------------------------------------
// Response envelope helpers
// ---------------------------------------------------------------------------

/**
 * Every typed tool wraps its payload in this envelope so callers can
 * detect schema changes (`schema_version`) and source provenance
 * (`source`) without inspecting the data itself.
 */
export interface ToolResponseEnvelope<T> {
  schema_version: typeof SCHEMA_VERSION;
  tool: string;
  source: string;
  data: T;
}
