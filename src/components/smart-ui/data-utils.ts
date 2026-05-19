/**
 * Shared helpers for Smart UI card renderers.
 *
 * The MCP tool envelope shape we extract from in v1 is tamrack_macro's:
 *   { schema_version, tool, source, data: {
 *       indicator, source, unit, last_observation,
 *       served_from, points: [{date, value}] } }
 *
 * Other tools share the structuredContent.data.points convention with
 * minor variation (housing/business/etc. use payload.rows). For v1 we
 * only support the macro envelope shape — wider extraction lands with
 * v1.1's expanded card surface.
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
