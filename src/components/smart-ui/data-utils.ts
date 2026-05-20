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
 */

import type { SeriesPoint } from "@/lib/smart-ui/types";

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
