"use client";

/**
 * Line chart card renderer — T3 Terminal chrome.
 *
 * Multi-quarter / multi-year series. The latest point gets the amber
 * marker; the line itself stays ink (monochrome luminance ramp per
 * tamrack/brand/identity/colors.md). Mitered joins, square caps — no
 * smoothing (sharp-edges rule).
 */

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { LineCard, SeriesPoint } from "@/lib/smart-ui/types";

import { extractPoints, formatTickDate, formatTickValue } from "./data-utils";

interface Props {
  card: LineCard;
  /** Parsed envelope from `tool_result` event for this card. */
  toolData: unknown;
}

export function CardLine({ card, toolData }: Props) {
  const points: SeriesPoint[] = extractPoints(toolData);
  const labelStrip =
    card.caption ?? `${card.title.toLowerCase()} · alberta · stony plain`;

  return (
    <div className="border border-[var(--hairline)] bg-[var(--surface-elevated)] p-5">
      {/* Label strip */}
      <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--mid)] pb-2.5 border-b border-[var(--hairline)]">
        <span className="truncate">{labelStrip}</span>
        {card.unit && (
          <span className="shrink-0 ml-3">{card.unit}</span>
        )}
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-4">
        <h3 className="text-lg font-semibold text-[var(--ink)]">{card.title}</h3>
      </div>
      <div className="mt-4 h-64 w-full">
        {points.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={points}
              margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
            >
              <CartesianGrid stroke="var(--data-10)" strokeDasharray="2 2" />
              <XAxis
                dataKey="date"
                tickFormatter={formatTickDate}
                stroke="var(--mid)"
                fontSize={10}
                fontFamily="var(--font-mono)"
                minTickGap={32}
                tickLine={false}
              />
              <YAxis
                stroke="var(--mid)"
                fontSize={10}
                fontFamily="var(--font-mono)"
                tickFormatter={(v) => formatTickValue(v)}
                width={50}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--surface-elevated)",
                  border: "1px solid var(--hairline)",
                  borderRadius: 0,
                  color: "var(--ink)",
                  fontSize: 12,
                  fontFamily: "var(--font-mono)",
                }}
                labelFormatter={(label) => formatTickDate(String(label))}
                formatter={(value) => [
                  formatTickValue(Number(value)),
                  card.unit ?? "value",
                ]}
              />
              <Line
                type="linear"
                dataKey="value"
                stroke="var(--ink)"
                strokeWidth={1.5}
                strokeLinejoin="miter"
                strokeLinecap="square"
                dot={(props) => {
                  const isLast = props.index === points.length - 1;
                  if (!isLast) {
                    // Recharts requires a valid SVGElement; return an empty group instead of null.
                    return <g key={`d-${props.index}`} />;
                  }
                  return (
                    <circle
                      key={`d-${props.index}`}
                      cx={props.cx}
                      cy={props.cy}
                      r={3.5}
                      fill="var(--amber)"
                      stroke="var(--amber)"
                    />
                  );
                }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Source footer */}
      <div className="mt-4 pt-3 border-t border-[var(--hairline)] font-mono text-[10px] tracking-[0.14em] uppercase text-[var(--mid)]">
        {points.length} pts · series spans {points[0]?.date ?? "—"} → {points[points.length - 1]?.date ?? "—"}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full w-full items-center justify-center font-mono text-xs text-[var(--mid)]">
      no data available for this indicator.
    </div>
  );
}
