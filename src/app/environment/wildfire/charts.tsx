"use client";

import { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { getChartTheme } from "@/lib/chart-theme";

function useChartTheme() {
  const [theme, setTheme] = useState(getChartTheme);
  useEffect(() => {
    const update = () => setTheme(getChartTheme());
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);
  return theme;
}

function tooltipStyle(t: ReturnType<typeof getChartTheme>) {
  return {
    backgroundColor: t.tooltipBg,
    border: `1px solid ${t.tooltipBorder}`,
    borderRadius: "8px",
    fontSize: "12px",
    color: t.tooltipText,
  };
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

// ============================================================
// Fire Count by Year — Area Chart
// ============================================================

export function FireCountAreaChart({
  data,
  height = 250,
}: {
  data: { year: number; count: number }[];
  height?: number;
}) {
  const t = useChartTheme();

  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center text-muted text-xs"
        style={{ height }}
      >
        No data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
        <defs>
          <linearGradient id="fireCountGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={t.grid} />
        <XAxis
          dataKey="year"
          stroke={t.axis}
          fontSize={10}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke={t.axis}
          fontSize={10}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatCompact(v)}
          width={45}
        />
        <Tooltip
          contentStyle={tooltipStyle(t)}
          formatter={(value) => [Number(value).toLocaleString(), "Fires"]}
          labelFormatter={(label) => `${label}`}
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke="#f97316"
          strokeWidth={2}
          fill="url(#fireCountGrad)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ============================================================
// Hectares Burned by Year — Bar Chart
// ============================================================

export function HectaresBurnedBarChart({
  data,
  height = 250,
}: {
  data: { year: number; totalHectares: number }[];
  height?: number;
}) {
  const t = useChartTheme();

  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center text-muted text-xs"
        style={{ height }}
      >
        No data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={t.grid} />
        <XAxis
          dataKey="year"
          stroke={t.axis}
          fontSize={10}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke={t.axis}
          fontSize={10}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatCompact(v)}
          width={50}
        />
        <Tooltip
          contentStyle={tooltipStyle(t)}
          formatter={(value) => [
            `${Number(value).toLocaleString()} ha`,
            "Hectares Burned",
          ]}
          labelFormatter={(label) => `${label}`}
        />
        <Bar
          dataKey="totalHectares"
          fill="#ef4444"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ============================================================
// Cause Breakdown — Horizontal Bar Chart
// ============================================================

export function CauseBreakdownChart({
  data,
  height = 250,
}: {
  data: { cause: string; count: number; totalHectares: number }[];
  height?: number;
}) {
  const t = useChartTheme();

  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center text-muted text-xs"
        style={{ height }}
      >
        No data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 10, bottom: 5, left: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={t.grid}
          horizontal={false}
        />
        <XAxis
          type="number"
          stroke={t.axis}
          fontSize={10}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatCompact(v)}
        />
        <YAxis
          type="category"
          dataKey="cause"
          stroke={t.axis}
          fontSize={10}
          tickLine={false}
          axisLine={false}
          width={90}
        />
        <Tooltip
          contentStyle={tooltipStyle(t)}
          formatter={(value) => [Number(value).toLocaleString(), "Fires"]}
        />
        <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
