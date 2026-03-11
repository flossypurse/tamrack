"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  TimeSeriesPoint,
  AssessmentByWard,
  HotNeighbourhood,
  NeighbourhoodAssessment,
  RedevelopingArea,
  StrathconaSubdivisionActivity,
  StrathconaAssessment,
  StAlbertAssessment,
} from "@/lib/data-sources";
import { format, parseISO } from "date-fns";

function formatDate(dateStr: unknown): string {
  try {
    return format(parseISO(String(dateStr)), "MMM yy");
  } catch {
    return String(dateStr);
  }
}

function formatValue(value: number, compact?: boolean): string {
  if (compact) {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

export function TimeSeriesAreaChart({
  data,
  color = "#3b82f6",
  height = 200,
  compact = false,
  valuePrefix = "",
  valueSuffix = "",
}: {
  data: TimeSeriesPoint[];
  color?: string;
  height?: number;
  compact?: boolean;
  valuePrefix?: string;
  valueSuffix?: string;
}) {
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
      <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <defs>
          <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          stroke="#71717a"
          fontSize={10}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#71717a"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) =>
            `${valuePrefix}${formatValue(v, compact)}${valueSuffix}`
          }
          width={50}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#27272a",
            border: "1px solid #3f3f46",
            borderRadius: "8px",
            fontSize: "12px",
            color: "#fafafa",
          }}
          formatter={(value) => [
            `${valuePrefix}${formatValue(Number(value), false)}${valueSuffix}`,
            "Value",
          ]}
          labelFormatter={formatDate}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill={`url(#gradient-${color})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function TimeSeriesBarChart({
  data,
  color = "#3b82f6",
  height = 200,
  compact = false,
  valuePrefix = "",
  valueSuffix = "",
}: {
  data: TimeSeriesPoint[];
  color?: string;
  height?: number;
  compact?: boolean;
  valuePrefix?: string;
  valueSuffix?: string;
}) {
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
      <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          stroke="#71717a"
          fontSize={10}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#71717a"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) =>
            `${valuePrefix}${formatValue(v, compact)}${valueSuffix}`
          }
          width={50}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#27272a",
            border: "1px solid #3f3f46",
            borderRadius: "8px",
            fontSize: "12px",
            color: "#fafafa",
          }}
          formatter={(value) => [
            `${valuePrefix}${formatValue(Number(value), false)}${valueSuffix}`,
            "Value",
          ]}
          labelFormatter={formatDate}
        />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function HorizontalBarChart({
  data,
  color = "#3b82f6",
  height = 350,
  valuePrefix = "",
  valueSuffix = "",
}: {
  data: AssessmentByWard[];
  color?: string;
  height?: number;
  valuePrefix?: string;
  valueSuffix?: string;
}) {
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
        margin={{ top: 5, right: 15, bottom: 5, left: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
        <XAxis
          type="number"
          stroke="#71717a"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) =>
            `${valuePrefix}${formatValue(v, true)}${valueSuffix}`
          }
        />
        <YAxis
          type="category"
          dataKey="ward"
          stroke="#71717a"
          fontSize={9}
          tickLine={false}
          axisLine={false}
          width={110}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#27272a",
            border: "1px solid #3f3f46",
            borderRadius: "8px",
            fontSize: "12px",
            color: "#fafafa",
          }}
          formatter={(value) => [
            `${valuePrefix}${formatValue(Number(value), false)}${valueSuffix}`,
            "Avg Assessment",
          ]}
        />
        <Bar dataKey="avgValue" fill={color} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Multi-series line chart for overlay comparisons (e.g., oil price vs unemployment)
export interface SeriesConfig {
  key: string;
  label: string;
  color: string;
  suffix?: string;
  prefix?: string;
  yAxisId?: "left" | "right";
}

export interface MultiSeriesPoint {
  date: string;
  [key: string]: string | number;
}

export function MultiSeriesLineChart({
  data,
  series,
  height = 250,
  dualAxis = false,
}: {
  data: MultiSeriesPoint[];
  series: SeriesConfig[];
  height?: number;
  dualAxis?: boolean;
}) {
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

  const leftSeries = series.filter((s) => s.yAxisId !== "right");
  const rightSeries = series.filter((s) => s.yAxisId === "right");

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          stroke="#71717a"
          fontSize={10}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          yAxisId="left"
          stroke="#71717a"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => {
            const s = leftSeries[0];
            return `${s?.prefix || ""}${formatValue(v, true)}${s?.suffix || ""}`;
          }}
          width={55}
        />
        {dualAxis && rightSeries.length > 0 && (
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="#71717a"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => {
              const s = rightSeries[0];
              return `${s?.prefix || ""}${formatValue(v, true)}${s?.suffix || ""}`;
            }}
            width={55}
          />
        )}
        <Tooltip
          contentStyle={{
            backgroundColor: "#27272a",
            border: "1px solid #3f3f46",
            borderRadius: "8px",
            fontSize: "12px",
            color: "#fafafa",
          }}
          labelFormatter={formatDate}
          formatter={(value: unknown, name: unknown) => {
            const n = String(name);
            const s = series.find((s) => s.key === n);
            return [
              `${s?.prefix || ""}${formatValue(Number(value), false)}${s?.suffix || ""}`,
              s?.label || n,
            ];
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: "11px", color: "#a1a1aa" }}
          formatter={(value) => {
            const s = series.find((s) => s.key === value);
            return s?.label || String(value);
          }}
        />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            stroke={s.color}
            strokeWidth={2}
            dot={false}
            yAxisId={dualAxis && s.yAxisId === "right" ? "right" : "left"}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// Stacked area chart for composition views (e.g., GDP by industry)
export function StackedAreaChart({
  data,
  series,
  height = 250,
  compact = false,
}: {
  data: MultiSeriesPoint[];
  series: SeriesConfig[];
  height?: number;
  compact?: boolean;
}) {
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
      <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          stroke="#71717a"
          fontSize={10}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#71717a"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => formatValue(v, compact)}
          width={55}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#27272a",
            border: "1px solid #3f3f46",
            borderRadius: "8px",
            fontSize: "12px",
            color: "#fafafa",
          }}
          labelFormatter={formatDate}
          formatter={(value: unknown, name: unknown) => {
            const n = String(name);
            const s = series.find((s) => s.key === n);
            return [formatValue(Number(value), false), s?.label || n];
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: "11px", color: "#a1a1aa" }}
          formatter={(value) => {
            const s = series.find((s) => s.key === value);
            return s?.label || String(value);
          }}
        />
        {series.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            stackId="1"
            stroke={s.color}
            fill={s.color}
            fillOpacity={0.4}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function NeighbourhoodBarChart({
  data,
  dataKey,
  labelKey = "neighbourhood",
  color = "#3b82f6",
  height = 400,
  valuePrefix = "",
  valueSuffix = "",
  tooltipLabel = "Value",
}: {
  data: (HotNeighbourhood | NeighbourhoodAssessment | RedevelopingArea | StrathconaSubdivisionActivity | StrathconaAssessment | StAlbertAssessment)[];
  dataKey: string;
  labelKey?: string;
  color?: string;
  height?: number;
  valuePrefix?: string;
  valueSuffix?: string;
  tooltipLabel?: string;
}) {
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
        margin={{ top: 5, right: 15, bottom: 5, left: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
        <XAxis
          type="number"
          stroke="#71717a"
          fontSize={10}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) =>
            `${valuePrefix}${formatValue(v, true)}${valueSuffix}`
          }
        />
        <YAxis
          type="category"
          dataKey={labelKey}
          stroke="#71717a"
          fontSize={9}
          tickLine={false}
          axisLine={false}
          width={130}
          tickFormatter={(v) =>
            v.length > 18 ? v.slice(0, 16) + "…" : v
          }
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#27272a",
            border: "1px solid #3f3f46",
            borderRadius: "8px",
            fontSize: "12px",
            color: "#fafafa",
          }}
          formatter={(value) => [
            `${valuePrefix}${formatValue(Number(value), false)}${valueSuffix}`,
            tooltipLabel,
          ]}
        />
        <Bar dataKey={dataKey} fill={color} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
