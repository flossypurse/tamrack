import { ReactNode } from "react";
import { DataFreshness } from "./data-freshness";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-card border border-card-border rounded-xl p-3 sm:p-5 ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  badge,
  freshness,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  freshness?: "realtime" | "hourly" | "daily";
}) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {subtitle && (
          <p className="text-xs text-muted mt-0.5">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {freshness && <DataFreshness tier={freshness} />}
        {badge && (
          <span className="text-[10px] font-mono bg-accent/10 text-accent px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}

export function MetricCard({
  title,
  value,
  change,
  changeLabel,
  source,
}: {
  title: string;
  value: string;
  change?: string;
  changeLabel?: string;
  source?: string;
}) {
  const isPositive = change?.startsWith("+");
  const isNegative = change?.startsWith("-");

  return (
    <Card>
      <p className="text-xs text-muted mb-1">{title}</p>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      {change && (
        <p
          className={`text-xs mt-1 ${
            isPositive
              ? "text-accent-green"
              : isNegative
                ? "text-accent-red"
                : "text-muted"
          }`}
        >
          {change} {changeLabel && <span className="text-muted">{changeLabel}</span>}
        </p>
      )}
      {source && (
        <p className="text-[10px] text-muted/60 mt-2 font-mono">{source}</p>
      )}
    </Card>
  );
}
