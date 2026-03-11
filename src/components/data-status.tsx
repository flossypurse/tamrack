import { Activity, Database, TrendingUp, Zap } from "lucide-react";

const sources = [
  { name: "Bank of Canada", icon: TrendingUp, status: "live", color: "text-accent-green" },
  { name: "Edmonton Open Data", icon: Database, status: "live", color: "text-accent-green" },
  { name: "StatsCan WDS", icon: Activity, status: "live", color: "text-accent-green" },
  { name: "AER / Petrinex", icon: Zap, status: "planned", color: "text-accent-amber" },
];

export function DataSourceStatus() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      {sources.map((s) => (
        <div key={s.name} className="flex items-center gap-1.5">
          <s.icon size={12} className={s.color} />
          <span className="text-muted">{s.name}</span>
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              s.status === "live" ? "bg-accent-green" : "bg-accent-amber"
            }`}
          />
        </div>
      ))}
    </div>
  );
}
