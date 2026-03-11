import { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-card border border-card-border rounded-xl p-5 ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
}) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {subtitle && (
          <p className="text-xs text-muted mt-0.5">{subtitle}</p>
        )}
      </div>
      {badge && (
        <span className="text-[10px] font-mono bg-accent/10 text-accent px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}
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
