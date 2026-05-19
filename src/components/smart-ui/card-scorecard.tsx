"use client";

/**
 * Scorecard card renderer — T3 Terminal instrument-panel chrome.
 *
 * Layout reference: tamrack/brand/identity/preview/02-smart-ui-card.html.
 *
 *   ─ LABEL STRIP · MONO UPPER 0.18em ─────────────  ● LIVE
 *
 *   Title (sans 600)                                  ▲
 *   sub (mono mid)                                   sparkline
 *
 *   142   <- amber, mono 800, 60px+               (mid axis only)
 *   ▔▔▔▔▔ YoY  · vs baseline · unit
 *   ────────────────────────────────────────────────
 *   SOURCE · FETCHED HH:MM MDT · UNIT TOKEN
 *
 * The amber is signal-only: it sits on the latest value, nowhere else.
 */

import { Line, LineChart, ResponsiveContainer } from "recharts";

import type { ScorecardCard, SeriesPoint } from "@/lib/smart-ui/types";

import { extractPoints, formatTickValue } from "./data-utils";

interface Props {
  card: ScorecardCard;
  toolData: unknown;
}

export function CardScorecard({ card, toolData }: Props) {
  const points: SeriesPoint[] = extractPoints(toolData);
  const latest = points[points.length - 1];
  const yoy = card.delta?.yoy ? findYoy(points, latest) : null;
  // Convention: tri-region preview captions name an Alberta place by default.
  // The composer can override via card.caption; fallback keeps the
  // anti-drift discipline visible end-to-end.
  const labelStrip = card.caption ?? "indicator · alberta · stony plain";

  return (
    <div className="border border-[var(--hairline)] bg-[var(--surface-elevated)] p-5">
      {/* Label strip */}
      <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--mid)] pb-2.5 border-b border-[var(--hairline)]">
        <span className="truncate">{labelStrip}</span>
        {latest && (
          <span className="flex items-center gap-2 text-[var(--amber)] shrink-0 ml-3">
            <span className="tamrack-dot-live" aria-hidden="true" />
            <span>live</span>
          </span>
        )}
      </div>

      {/* Title row */}
      <h3 className="mt-4 text-[var(--ink)] text-lg font-semibold">{card.title}</h3>
      {card.unit && (
        <p className="mt-0.5 font-mono text-[11px] text-[var(--mid)]">
          {card.unit}
        </p>
      )}

      {/* Value + sparkline */}
      <div className="mt-4 flex items-end justify-between gap-6">
        <div>
          {latest ? (
            <>
              <div className="font-mono font-extrabold text-5xl text-[var(--amber)] leading-none tracking-tight tabular-nums">
                {formatTickValue(latest.value)}
              </div>
              <div className="mt-3 flex items-center gap-3 font-mono text-[11px] text-[var(--mid)]">
                <span>
                  <span className="text-[var(--ink)] font-medium">
                    {formatLongDate(latest.date)}
                  </span>{" "}
                  · current
                </span>
                {yoy && (
                  <span>
                    <span className="text-[var(--ink)] font-medium">
                      {yoy.direction === "up" ? "+" : yoy.direction === "down" ? "−" : "±"}
                      {Math.abs(yoy.diff).toFixed(2)}
                    </span>{" "}
                    YoY
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="font-mono text-xs text-[var(--mid)]">no data.</div>
          )}
        </div>
        <div className="h-16 w-36 shrink-0">
          {points.length > 1 && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 4, right: 0, bottom: 4, left: 0 }}>
                <Line
                  type="linear"
                  dataKey="value"
                  stroke="var(--ink)"
                  strokeWidth={1.5}
                  strokeLinejoin="miter"
                  strokeLinecap="square"
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Source footer — instrument register */}
      <div className="mt-5 pt-3 border-t border-[var(--hairline)] flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] tracking-[0.14em] uppercase text-[var(--mid)]">
        <span>fetched · just now</span>
        {card.unit && <span>unit · {card.unit}</span>}
      </div>
    </div>
  );
}

function findYoy(
  points: SeriesPoint[],
  latest: SeriesPoint | undefined,
): { diff: number; direction: "up" | "down" | "flat" } | null {
  if (!latest) return null;
  const latestMs = Date.parse(latest.date);
  if (!Number.isFinite(latestMs)) return null;
  const targetMs = latestMs - 365 * 86_400_000;
  let best: SeriesPoint | null = null;
  let bestGap = Infinity;
  for (const p of points) {
    const ms = Date.parse(p.date);
    if (!Number.isFinite(ms)) continue;
    const gap = Math.abs(ms - targetMs);
    if (gap < bestGap) {
      best = p;
      bestGap = gap;
    }
  }
  if (!best) return null;
  if (bestGap > 45 * 86_400_000) return null;
  const diff = latest.value - best.value;
  const direction = diff > 0.0001 ? "up" : diff < -0.0001 ? "down" : "flat";
  return { diff, direction };
}

function formatLongDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
