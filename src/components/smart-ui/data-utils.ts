/**
 * Shared helpers for Smart UI card renderers.
 *
 * The MCP tool envelope shape we extract from in v1 is tamrack_macro's:
 *   { schema_version, tool, source, data: {
 *       indicator, source, unit, last_observation,
 *       served_from, points: [{date, value}] } }
 *
 * Other tools (housing / energy / business) emit wide payloads like
 * `data.payload.rows: [{date, edmonton, calgary}]`. The Smart UI's
 * `src/lib/smart-ui/normalize-envelope.ts` projects those to
 * `data.points` at the in-process MCP-client boundary BEFORE the
 * envelope reaches this renderer, so `extractPoints` only has to know
 * about the macro shape. The `payload.rows` fallback here is a defensive
 * second pass for tools that emit a narrow {date, value} rows shape.
 *
 * v1.2 adds `extractTableRows` for list tools (tamrack_opportunities,
 * tamrack_hiring). These read the full payload from `toolData` and map
 * known field names to display strings.
 */

import type { HiringBreakdownKey, SeriesPoint, TableRow } from "@/lib/smart-ui/types";

export function extractPoints(toolData: unknown): SeriesPoint[] {
  if (!toolData || typeof toolData !== "object") return [];
  const envelope = toolData as {
    data?: {
      points?: unknown;
      payload?: { rows?: unknown };
    };
  };
  const rawPoints =
    (envelope.data?.points as unknown[] | undefined) ??
    (envelope.data?.payload?.rows as unknown[] | undefined) ??
    [];
  if (!Array.isArray(rawPoints)) return [];
  const out: SeriesPoint[] = [];
  for (const p of rawPoints) {
    if (!p || typeof p !== "object") continue;
    const row = p as { date?: unknown; value?: unknown };
    const date = typeof row.date === "string" ? row.date : "";
    const value =
      typeof row.value === "number"
        ? row.value
        : typeof row.value === "string"
          ? Number(row.value)
          : NaN;
    if (!date || !Number.isFinite(value)) continue;
    out.push({ date, value });
  }
  return out;
}

export function formatTickDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

export function formatTickValue(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  if (Math.abs(value) < 10) {
    return value.toFixed(2);
  }
  return value.toLocaleString();
}

/**
 * Extract table rows from the full tool payload for list-shape tools.
 *
 * For tamrack_opportunities: maps tender row fields to the standard
 * column set ["Title", "Buyer", "Closes", "Category", "Method"] and
 * attaches noticeUrl as link_url on each row.
 *
 * For tamrack_hiring: when `breakdownKey` is present, renders exactly
 * that breakdown array; when absent, falls back to the fixed
 * byNoc > bySector > byCity precedence (backward-compatible).
 *
 * Falls back to `cardRows` (the composer-provided pre-formatted rows)
 * when the payload shape isn't recognised — this protects against future
 * tool schema changes without breaking the renderer.
 */
export function extractTableRows(
  toolName: string,
  toolData: unknown,
  cardRows: TableRow[],
  breakdownKey?: HiringBreakdownKey,
): TableRow[] {
  if (!toolData || typeof toolData !== "object") return cardRows;

  const env = toolData as {
    data?: {
      payload?: {
        rows?: unknown[];
        summary?: {
          byNoc?: unknown[];
          bySector?: unknown[];
          byCity?: unknown[];
        } | null;
      };
    };
  };

  const payload = env.data?.payload;
  if (!payload) return cardRows;

  if (toolName === "tamrack_opportunities") {
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    if (rows.length === 0) return [];
    return rows.map((r) => {
      if (!r || typeof r !== "object") return { cells: [] };
      const row = r as Record<string, unknown>;
      const title = truncate(String(row.title ?? ""), 60);
      const buyer = String(row.buyer ?? "");
      const closes = String(row.closingDate ?? row.expectedStartDate ?? "open");
      const category = String(row.category ?? "");
      const method = String(row.procurementMethod ?? "");
      const link_url = typeof row.noticeUrl === "string" ? row.noticeUrl : undefined;
      return {
        cells: [title, buyer, closes, category, method],
        ...(link_url ? { link_url } : {}),
      };
    });
  }

  if (toolName === "tamrack_hiring") {
    const s = payload.summary;
    if (!s || typeof s !== "object") return [];
    const summary = s as {
      byNoc?: unknown[];
      bySector?: unknown[];
      byCity?: unknown[];
    };

    // When the composer set breakdown_key, use it directly.
    // When absent, fall through the fixed byNoc > bySector > byCity precedence.
    const key: HiringBreakdownKey | undefined =
      breakdownKey ??
      (Array.isArray(summary.byNoc) && summary.byNoc.length > 0
        ? "byNoc"
        : Array.isArray(summary.bySector) && summary.bySector.length > 0
          ? "bySector"
          : Array.isArray(summary.byCity) && summary.byCity.length > 0
            ? "byCity"
            : undefined);

    if (key === "byNoc" && Array.isArray(summary.byNoc)) {
      return summary.byNoc.map((r) => {
        if (!r || typeof r !== "object") return { cells: [] };
        const row = r as Record<string, unknown>;
        return {
          cells: [
            String(row.code ?? ""),
            String(row.name ?? ""),
            String(row.count ?? ""),
            String(row.vacancies ?? ""),
          ],
        };
      });
    }
    if (key === "bySector" && Array.isArray(summary.bySector)) {
      return summary.bySector.map((r) => {
        if (!r || typeof r !== "object") return { cells: [] };
        const row = r as Record<string, unknown>;
        return { cells: [String(row.sector ?? ""), String(row.count ?? "")] };
      });
    }
    if (key === "byCity" && Array.isArray(summary.byCity)) {
      return summary.byCity.map((r) => {
        if (!r || typeof r !== "object") return { cells: [] };
        const row = r as Record<string, unknown>;
        return { cells: [String(row.city ?? ""), String(row.count ?? "")] };
      });
    }
    return [];
  }

  return cardRows;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}
