"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const SOURCE_COLORS: Record<string, string> = {
  regional_indicators: "#3b82f6",
  energy_data: "#f59e0b",
  municipality_data: "#10b981",
  well_licences: "#8b5cf6",
  immigration: "#ec4899",
  major_projects: "#06b6d4",
  macro_indicators: "#f97316",
};

const SOURCE_LABELS: Record<string, string> = {
  regional_indicators: "Regional",
  energy_data: "Energy",
  municipality_data: "Municipalities",
  well_licences: "Wells",
  immigration: "Immigration",
  major_projects: "Projects",
  macro_indicators: "Macro",
};

interface GrowthChartProps {
  data: Record<string, string | number>[];
}

export function GrowthChart({ data }: GrowthChartProps) {
  // Discover which sources are present in the data
  const sources = new Set<string>();
  for (const entry of data) {
    for (const key of Object.keys(entry)) {
      if (key !== "date") sources.add(key);
    }
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#71717a" }}
            tickFormatter={(v) => v.slice(5)} // MM-DD
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#71717a" }}
            tickFormatter={(v) => {
              if (v >= 1000) return `${(v / 1000).toFixed(0)}K`;
              return v;
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#18181b",
              border: "1px solid #27272a",
              borderRadius: "8px",
              fontSize: "11px",
            }}
            labelStyle={{ color: "#a1a1aa" }}
            formatter={(value: number, name: string) => [
              value.toLocaleString(),
              SOURCE_LABELS[name] ?? name,
            ]}
          />
          <Legend
            formatter={(value) => SOURCE_LABELS[value] ?? value}
            wrapperStyle={{ fontSize: "10px" }}
          />
          {Array.from(sources).map((source) => (
            <Bar
              key={source}
              dataKey={source}
              stackId="a"
              fill={SOURCE_COLORS[source] ?? "#71717a"}
              radius={[0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
