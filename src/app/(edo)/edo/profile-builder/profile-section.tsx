"use client";

import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { ProfileMetric, ProfileSection } from "@/lib/edo/profile-data";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

function Sparkline({ data, color = "#6366f1" }: { data: { date: string; value: number }[]; color?: string }) {
  if (data.length < 2) return null;
  return (
    <div className="h-10 w-full mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <defs>
            <linearGradient id={`sp-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-card)",
              border: "1px solid var(--color-card-border)",
              borderRadius: "6px",
              fontSize: "10px",
            }}
            formatter={(value: number) => [value.toLocaleString(), ""]}
            labelFormatter={(label: string) => label}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#sp-${color.replace("#", "")})`}
            dot={false}
            animationDuration={300}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChangeIndicator({ change }: { change?: string }) {
  if (!change) return null;
  const isPositive = change.startsWith("+");
  const isNegative = change.startsWith("-");
  const Icon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${
        isPositive ? "text-emerald-400" : isNegative ? "text-red-400" : "text-muted"
      }`}
    >
      <Icon size={10} />
      {change}
    </span>
  );
}

function MetricCard({ metric }: { metric: ProfileMetric }) {
  return (
    <div className="bg-background/50 border border-card-border/50 rounded-lg p-3">
      <div className="flex items-start justify-between">
        <p className="text-[11px] text-muted leading-tight">{metric.label}</p>
        <ChangeIndicator change={metric.change} />
      </div>
      <p className="text-xl font-semibold tracking-tight mt-1">{metric.formatted}</p>
      {metric.period && (
        <p className="text-[10px] text-muted/60 mt-0.5">{metric.period}</p>
      )}
      <Sparkline data={metric.trend} />
    </div>
  );
}

export function ProfileSectionCard({ section }: { section: ProfileSection }) {
  const metricsWithData = section.metrics.filter(
    (m) => m.formatted !== "—" || m.trend.length > 0,
  );

  if (metricsWithData.length === 0) {
    return (
      <div className="bg-card border border-card-border rounded-xl p-5">
        <h2 className="text-sm font-semibold mb-2">{section.title}</h2>
        <p className="text-xs text-muted">No data available for this section.</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-card-border rounded-xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold">{section.title}</h2>
        <span className="text-[10px] text-muted/50 font-mono">
          {section.metrics[0]?.source}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {metricsWithData.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </div>
    </div>
  );
}

export function HeadlineMetrics({
  metrics,
}: {
  metrics: ProfileMetric[];
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {metrics.map((m) => (
        <div
          key={m.label}
          className="bg-card border border-card-border rounded-xl p-3 sm:p-4"
        >
          <p className="text-[11px] text-muted">{m.label}</p>
          <p className="text-2xl font-semibold tracking-tight mt-1">{m.formatted}</p>
          <div className="flex items-center gap-2 mt-1">
            <ChangeIndicator change={m.change} />
            {m.period && (
              <span className="text-[10px] text-muted/50">{m.period}</span>
            )}
          </div>
          <Sparkline data={m.trend} />
        </div>
      ))}
    </div>
  );
}
