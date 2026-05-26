/**
 * Smart-UI internal envelope normalizer.
 *
 * Tamrack's MCP tools return native row shapes per tool (intentional — see
 * `src/app/api/mcp/AGENT.md` "Substrate-first invariant"): `tamrack_macro`
 * + `tamrack_regional` emit `data.points: [{date, value}]`, but
 * `tamrack_housing` / `tamrack_energy` / `tamrack_business` emit
 * `data.payload.rows: [...wide rows...]` with per-CMA / per-dataset
 * columns. The public MCP envelope is a stable external contract; the
 * Smart UI's composer + renderer only know how to consume the macro shape.
 *
 * This module sits between the in-process MCP client and the rest of the
 * Smart UI pipeline. It takes an envelope and a planned tool call, and
 * returns a copy with a top-level `data.points: [{date, value}]` series
 * projected from whichever wide payload the tool actually returned. The
 * original `data.payload` is preserved in case a future card type needs
 * it.
 *
 * Public MCP envelope on the wire is UNCHANGED — projection only runs
 * for in-process Smart-UI consumers.
 *
 * Add a new wide-shape tool? Extend `projectToolEnvelope` with one more
 * case. Adding a new field to an existing case (e.g. a Lethbridge column
 * on housing) does not require any change here unless the planner needs
 * to address it.
 */

import type { SeriesPoint } from "./types";

interface NormalizedEnvelope {
  /** Original envelope, untouched. */
  original: unknown;
  /** Envelope with a projected `data.points` series + provenance note. */
  normalized: unknown;
  /**
   * Set when projection wasn't possible — composer + renderer will fall
   * back to the original envelope behaviour (which for wide-shape tools
   * will look like "no data" in the renderer).
   */
  note?: string;
}

/**
 * Project a tool envelope into a uniform `data.points` series. Returns a
 * shallow-copied envelope with the projected series attached at
 * `data.points`. Idempotent: envelopes that already carry `data.points`
 * are returned untouched.
 */
export function normalizeToolEnvelope(
  toolName: string,
  args: Record<string, unknown>,
  envelope: unknown,
): NormalizedEnvelope {
  if (!envelope || typeof envelope !== "object") {
    return { original: envelope, normalized: envelope };
  }

  const env = envelope as {
    data?: {
      points?: unknown;
      payload?: unknown;
    } & Record<string, unknown>;
  } & Record<string, unknown>;

  // Tools that already carry data.points (macro, regional) — pass through.
  if (env.data && Array.isArray(env.data.points)) {
    return { original: envelope, normalized: envelope };
  }

  const projection = projectToolEnvelope(toolName, args, env);
  if (!projection) {
    return {
      original: envelope,
      normalized: envelope,
      note: `no projection rule for tool="${toolName}"`,
    };
  }

  // Shallow-copy the envelope + data so the original (and anything else
  // holding the reference, e.g. persistence) is unaffected.
  const normalized = {
    ...env,
    data: {
      ...env.data,
      points: projection.points,
      // Echo the column we projected from so downstream observers (and
      // tests) can see the choice without re-deriving it.
      projected_from: projection.from,
    },
  };

  return {
    original: envelope,
    normalized,
    note: projection.note,
  };
}

interface Projection {
  points: SeriesPoint[];
  /** Identifier for which column / sub-series was projected. */
  from: string;
  /** Optional note returned to the caller for telemetry. */
  note?: string;
}

function projectToolEnvelope(
  toolName: string,
  args: Record<string, unknown>,
  env: {
    data?: { payload?: unknown } & Record<string, unknown>;
  } & Record<string, unknown>,
): Projection | null {
  const data = env.data;
  if (!data || typeof data !== "object") return null;
  const payload = (data as { payload?: unknown }).payload;

  switch (toolName) {
    case "tamrack_housing":
      return projectHousing(args, payload);
    case "tamrack_energy":
      return projectEnergy(args, payload);
    case "tamrack_business":
      return projectBusiness(args, payload);
    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// tamrack_housing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Housing payload shapes mirror the tamrack_housing MCP handler:
 *   - starts | completions | under_construction | vacancy
 *       → { rows: [{date, edmonton, calgary}] }   (wide; pick a CMA column)
 *   - rents
 *       → { rows: [{date, edmontonBachelor, ..., calgaryThreeBed}] }
 *         (very wide; default to edmontonOneBed)
 *   - snapshot
 *       → { snapshot: { cma, starts[], completions[], underConstruction[] } }
 *         (already {date, value}; just lift one sub-series)
 *   - absorptions
 *       → { absorptions: { absorbed: TimeSeriesPoint[], unabsorbed: ... } }
 *   - mortgage_rate
 *       → { rows: [{date, value}] }   (already narrow; lift through)
 *
 * The `municipality` arg names the CMA when projection needs to choose.
 * The planner used to call this `cma` — we accept both for robustness.
 */
function projectHousing(
  args: Record<string, unknown>,
  payload: unknown,
): Projection | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as { dataset?: string; rows?: unknown } & Record<
    string,
    unknown
  >;

  const cma = resolveCmaArg(args);

  switch (p.dataset) {
    case "starts":
    case "completions":
    case "under_construction":
    case "vacancy": {
      const rows = Array.isArray(p.rows) ? p.rows : [];
      const column = cma ?? "edmonton";
      return {
        points: rowsToSeries(rows, column),
        from: `payload.rows[].${column}`,
        note:
          cma == null
            ? `municipality not specified for housing.${p.dataset}; defaulted to edmonton`
            : undefined,
      };
    }
    case "rents": {
      const rows = Array.isArray(p.rows) ? p.rows : [];
      // Rents has 8 numeric columns; default to one-bed for the chosen CMA.
      const column =
        cma === "calgary" ? "calgaryOneBed" : "edmontonOneBed";
      return {
        points: rowsToSeries(rows, column),
        from: `payload.rows[].${column}`,
        note: `rents projected to ${column}; planner can't yet pick a different bed-count`,
      };
    }
    case "mortgage_rate": {
      const rows = Array.isArray(p.rows) ? p.rows : [];
      return {
        points: rowsToSeries(rows, "value"),
        from: "payload.rows[].value",
      };
    }
    case "snapshot": {
      const snap = (p as { snapshot?: unknown }).snapshot;
      if (!snap || typeof snap !== "object") {
        return { points: [], from: "payload.snapshot (empty)" };
      }
      // Default sub-series: starts. Composer + planner can extend this
      // when snapshot becomes a top-level card type.
      const starts = (snap as { starts?: unknown }).starts;
      const series = Array.isArray(starts) ? starts : [];
      return {
        points: rowsToSeries(series, "value"),
        from: "payload.snapshot.starts[]",
      };
    }
    case "absorptions": {
      const abs = (p as { absorptions?: unknown }).absorptions;
      if (!abs || typeof abs !== "object") {
        return { points: [], from: "payload.absorptions (empty)" };
      }
      const absorbed = (abs as { absorbed?: unknown }).absorbed;
      const series = Array.isArray(absorbed) ? absorbed : [];
      return {
        points: rowsToSeries(series, "value"),
        from: "payload.absorptions.absorbed[]",
      };
    }
    default:
      return null;
  }
}

function resolveCmaArg(
  args: Record<string, unknown>,
): "edmonton" | "calgary" | null {
  const raw =
    typeof args["municipality"] === "string"
      ? (args["municipality"] as string)
      : typeof args["cma"] === "string"
        ? (args["cma"] as string)
        : null;
  if (!raw) return null;
  const lc = raw.toLowerCase();
  if (lc === "edmonton") return "edmonton";
  if (lc === "calgary") return "calgary";
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// tamrack_energy
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Energy payload shapes mirror the tamrack_energy MCP handler.
 * Most carry `rows[]` with either a `value`, a `price`, a `throughput`,
 * or a `volume` field. We pick the most natural single-series projection
 * per dataset and let the composer caption it.
 */
function projectEnergy(
  args: Record<string, unknown>,
  payload: unknown,
): Projection | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as { dataset?: string; rows?: unknown } & Record<
    string,
    unknown
  >;

  switch (p.dataset) {
    case "pool_price_current":
    case "system_marginal_price": {
      const rows = Array.isArray(p.rows) ? p.rows : [];
      return {
        points: rowsToSeries(rows, "price"),
        from: `payload.rows[].price`,
      };
    }
    case "pool_price_series": {
      const rows = Array.isArray(p.rows) ? p.rows : [];
      return {
        points: rowsToSeries(rows, "value"),
        from: `payload.rows[].value`,
      };
    }
    case "forecast": {
      const rows = Array.isArray(p.rows) ? p.rows : [];
      // forecast carries both `forecast` + `actual`; default to actual.
      return {
        points: rowsToSeries(rows, "actual"),
        from: "payload.rows[].actual",
      };
    }
    case "pipeline_throughput": {
      const rows = Array.isArray(p.rows) ? p.rows : [];
      return {
        points: rowsToSeries(rows, "throughput"),
        from: "payload.rows[].throughput",
      };
    }
    case "apportionment": {
      const rows = Array.isArray(p.rows) ? p.rows : [];
      return {
        points: rowsToSeries(rows, "apportionmentPercent"),
        from: "payload.rows[].apportionmentPercent",
      };
    }
    case "oil_production": {
      const rows = Array.isArray(p.rows) ? p.rows : [];
      return {
        points: rowsToSeries(rows, "volume"),
        from: "payload.rows[].volume",
      };
    }
    case "supply_demand":
      // Snapshot only — no time series. Composer is responsible for
      // surfacing it as a scorecard; renderer's line card will be empty.
      return { points: [], from: "payload.snapshot (no time series)" };
    case "pipeline_incidents":
      // Row-per-incident; not a meaningful single-series projection.
      return {
        points: [],
        from: "payload.rows (not a time series)",
      };
    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// tamrack_business
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Business is the widest tool — 15+ category-specific row shapes. The
 * common-case projection: most categories have a numeric `count` or
 * `value` field on rows; default-pick `count` then `value`. Categories
 * that don't fit (e.g. ghg_facilities ranked-list shapes) return an
 * empty projection and the renderer falls back to "no data".
 */
function projectBusiness(
  _args: Record<string, unknown>,
  payload: unknown,
): Projection | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as { category?: string; rows?: unknown } & Record<
    string,
    unknown
  >;
  const rows = Array.isArray(p.rows) ? p.rows : [];
  if (rows.length === 0) {
    return { points: [], from: `payload.rows (empty)` };
  }
  // Probe the first row for a known numeric column. Order matters —
  // `count` is the dominant cadence-style shape; `value` covers the rest.
  const sample = rows[0] as Record<string, unknown>;
  const candidates = ["count", "value"] as const;
  for (const col of candidates) {
    if (typeof sample[col] === "number" || typeof sample[col] === "string") {
      return {
        points: rowsToSeries(rows, col),
        from: `payload.rows[].${col}`,
      };
    }
  }
  return {
    points: [],
    from: `payload.rows (no time-series column)`,
    note: `business.${p.category ?? "unknown"} row shape isn't a single time series`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// shared
// ─────────────────────────────────────────────────────────────────────────────

function rowsToSeries(rows: unknown[], column: string): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  for (const r of rows) {
    if (!r || typeof r !== "object") continue;
    const row = r as Record<string, unknown>;
    const dateRaw = row.date;
    const date = typeof dateRaw === "string" ? dateRaw : "";
    const valRaw = row[column];
    const value =
      typeof valRaw === "number"
        ? valRaw
        : typeof valRaw === "string"
          ? Number(valRaw)
          : NaN;
    if (!date || !Number.isFinite(value)) continue;
    out.push({ date, value });
  }
  return out;
}
