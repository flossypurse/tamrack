/**
 * Shared `time_range` semantics for every typed MCP tool.
 *
 * The original per-tool helpers (macro, business, real-estate, regional) each
 * (a) translated a named range into a LATEST-N fetch count and (b) then
 * returned named-range points UNFILTERED — so `last_30d` on a daily series
 * actually returned a full year, and the requested window was never enforced.
 * The 2026-06-18 probe surfaced this as BUG 2.
 *
 * The fix, single-sourced here so the four tools can't drift again:
 *   - Named ranges are REAL calendar windows, measured relative to the LATEST
 *     observation in the series (not `now()`, since cadence varies per
 *     indicator and several series lag by months/quarters).
 *   - `periodsForRange` stays an upstream-fetch hint (ask for at least enough
 *     rows to cover the window), but the authoritative clip happens here.
 *
 * Dates from the substrate come in many shapes (`2024`, `2024-Q3`, `2024-03`,
 * ISO); `toIsoDate` anchors them all to a comparable `YYYY-MM-DD`.
 */

import type { NamedTimeRange, TimeRange } from "../schemas";
import { toIsoDate } from "@/lib/iso-date";

/** Span, in days, of each fixed-width named range. `ytd` is computed per-call. */
const NAMED_SPAN_DAYS: Record<Exclude<NamedTimeRange, "ytd">, number> = {
  last_30d: 30,
  last_year: 365,
  last_5y: 365 * 5,
};

function shiftIsoByDays(iso: string, deltaDays: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const ms = Date.UTC(y, m - 1, d) + deltaDays * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Inclusive lower-bound cutoff (`YYYY-MM-DD`) for a named range, relative to
 * the latest observation in the series. Returns null when the latest date
 * can't be anchored (caller should then pass everything through unclipped).
 */
export function cutoffForNamedRange(
  range: NamedTimeRange,
  latestDate: string,
): string | null {
  const latestIso = toIsoDate(latestDate);
  if (!latestIso) return null;
  if (range === "ytd") {
    return `${latestIso.slice(0, 4)}-01-01`;
  }
  return shiftIsoByDays(latestIso, -NAMED_SPAN_DAYS[range]);
}

/**
 * Clip a list of dated items to a `time_range`.
 *   - Named ranges  → real calendar window relative to the latest item.
 *   - `{from, to}`  → absolute ISO bounds (inclusive).
 *   - undefined     → no clipping.
 *
 * Items whose date can't be anchored are retained (defensive — we never drop a
 * row just because its label is exotic). The `getDate` accessor defaults to
 * reading a `.date` field.
 */
export function clipByRange<T>(
  items: T[],
  range: TimeRange | undefined,
  getDate: (item: T) => string = (it) =>
    (it as { date?: string }).date ?? "",
): T[] {
  if (!range || items.length === 0) return items;

  if (typeof range === "string") {
    // Anchor every item, find the latest, derive the cutoff from it.
    let latestIso: string | null = null;
    for (const it of items) {
      const iso = toIsoDate(getDate(it));
      if (iso && (latestIso === null || iso > latestIso)) latestIso = iso;
    }
    if (!latestIso) return items;
    const cutoff = cutoffForNamedRange(range, latestIso);
    if (!cutoff) return items;
    return items.filter((it) => {
      const iso = toIsoDate(getDate(it));
      return iso === null || iso >= cutoff;
    });
  }

  // Explicit { from, to } — anchor both the bounds and each item so partial
  // labels ("2024") compare sensibly against full ISO bounds.
  const fromIso = range.from ? toIsoDate(range.from) : null;
  const toIso = range.to ? toIsoDate(range.to) : null;
  if (!fromIso && !toIso) return items;
  return items.filter((it) => {
    const iso = toIsoDate(getDate(it));
    if (iso === null) return true;
    if (fromIso && iso < fromIso) return false;
    if (toIso && iso > toIso) return false;
    return true;
  });
}

/**
 * Upstream-fetch hint: how many LATEST-N rows to request so the window is
 * covered for a given cadence. `periodsPerYear` lets each tool express its
 * series' density (≈365 daily, 12 monthly, 4 quarterly, 1 annual). The clip in
 * `clipByRange` is authoritative; this just makes sure we fetch enough rows.
 */
export function periodsForRange(
  range: TimeRange | undefined,
  defaultPeriods: number,
  periodsPerYear = 365,
): number {
  if (!range) return defaultPeriods;

  const yearsToPeriods = (years: number) =>
    Math.ceil(years * periodsPerYear) + 1;

  if (typeof range === "string") {
    switch (range) {
      case "last_30d":
        return Math.max(Math.ceil((30 / 365) * periodsPerYear) + 1, defaultPeriods);
      case "last_year":
        return Math.max(yearsToPeriods(1), defaultPeriods);
      case "last_5y":
        return Math.max(yearsToPeriods(5), defaultPeriods);
      case "ytd":
        return Math.max(yearsToPeriods(1), defaultPeriods);
    }
  }
  // Explicit ranges: ask for a wide window and clip post-fetch.
  return Math.max(yearsToPeriods(5), defaultPeriods);
}
