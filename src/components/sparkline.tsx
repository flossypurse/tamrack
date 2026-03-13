"use client";

import { useEffect, useState } from "react";

interface SparklineProps {
  data: { date: string; value: number }[];
  color?: string;
  width?: number;
  height?: number;
}

export function Sparkline({
  data,
  color = "#d4863a",
  width = 120,
  height = 32,
}: SparklineProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || data.length < 2) {
    return (
      <div
        className="rounded bg-card-border/30 animate-pulse"
        style={{ width, height }}
      />
    );
  }

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 2;

  const points = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (width - pad * 2);
      const y = height - pad - ((v - min) / range) * (height - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  // Fill area path
  const firstX = pad;
  const lastX = pad + ((values.length - 1) / (values.length - 1)) * (width - pad * 2);
  const fillPath = `M${firstX},${height} L${points.split(" ").map((p) => p).join(" L")} L${lastX},${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
    >
      <defs>
        <linearGradient id={`spark-grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path
        d={fillPath}
        fill={`url(#spark-grad-${color.replace("#", "")})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot */}
      {(() => {
        const lastVal = values[values.length - 1];
        const x = lastX;
        const y = height - pad - ((lastVal - min) / range) * (height - pad * 2);
        return <circle cx={x} cy={y} r={2} fill={color} />;
      })()}
    </svg>
  );
}
