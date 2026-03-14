export const dynamic = "force-dynamic";

import {
  getCollectionStats,
  getTableRowCounts,
  getCollectionHistory,
  getLastCollectionRun,
  getCollectionGrowth,
} from "@/lib/db";
import { Card, CardHeader } from "@/components/card";
import { PageHeader } from "@/components/page-header";
import { AdminNav } from "../admin-nav";
import {
  Database,
  Clock,
  CheckCircle,
  AlertCircle,
  BarChart3,
  Server,
} from "lucide-react";
import { RunButton } from "./run-button";
import { GrowthChart } from "./growth-chart";

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default async function CollectionPage() {
  const stats = await getCollectionStats();
  const tables = await getTableRowCounts();
  const history = await getCollectionHistory(50);
  const lastRun = await getLastCollectionRun();
  const growth = await getCollectionGrowth();

  const totalRows = tables.reduce((s, t) => s + t.row_count, 0);
  const errorCount = history.filter((h) => h.status === "error").length;
  const recentHistory = history.slice(0, 30);

  // Group growth data by date for chart
  const growthByDate = new Map<string, Record<string, number>>();
  for (const g of growth) {
    const entry = growthByDate.get(g.date) ?? {};
    entry[g.source] = (entry[g.source] ?? 0) + g.rows;
    growthByDate.set(g.date, entry);
  }
  const growthChartData = Array.from(growthByDate.entries()).map(([date, sources]) => ({
    date,
    ...sources,
  }));

  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Data Collection"
        description="Monitor and trigger data collection across all sources"
        category="tools"
      />

      <AdminNav />

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricBox
          icon={Database}
          label="Total Rows"
          value={formatNumber(totalRows)}
          sub={`${tables.filter((t) => t.row_count > 0).length} active tables`}
          color="text-accent"
        />
        <MetricBox
          icon={Server}
          label="Municipalities"
          value={String(stats.regional_municipalities)}
          sub={`${stats.regional_indicators} indicators`}
          color="text-accent-green"
        />
        <MetricBox
          icon={Clock}
          label="Last Run"
          value={lastRun ? timeAgo(lastRun.taken_at) : "Never"}
          sub={lastRun ? `${formatNumber(lastRun.total_rows)} rows, ${lastRun.sources} sources` : "No collection runs yet"}
          color="text-accent-amber"
        />
        <MetricBox
          icon={errorCount > 0 ? AlertCircle : CheckCircle}
          label="Health"
          value={errorCount > 0 ? `${errorCount} errors` : "Healthy"}
          sub={`in last ${recentHistory.length} log entries`}
          color={errorCount > 0 ? "text-accent-red" : "text-accent-green"}
        />
      </div>

      {/* Run Collection */}
      <Card>
        <CardHeader
          title="Run Collection"
          subtitle="Trigger a data collection run. Full run takes 3-8 minutes."
        />
        <RunButton />
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Table Row Counts */}
        <Card>
          <CardHeader title="Table Row Counts" subtitle="Current database contents" />
          <div className="space-y-1">
            {tables
              .sort((a, b) => b.row_count - a.row_count)
              .map((t) => (
                <div
                  key={t.table_name}
                  className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-foreground/[0.03] text-sm"
                >
                  <code className="text-xs text-muted font-mono">{t.table_name}</code>
                  <span className={`font-medium font-mono text-xs ${t.row_count > 0 ? "text-foreground" : "text-muted/40"}`}>
                    {t.row_count.toLocaleString()}
                  </span>
                </div>
              ))}
          </div>
        </Card>

        {/* Collection Stats */}
        <Card>
          <CardHeader title="Collection Breakdown" subtitle="Detailed stats by source" />
          <div className="space-y-3">
            <StatRow label="Regional municipalities" value={stats.regional_municipalities} />
            <StatRow label="Regional indicators" value={stats.regional_indicators} />
            <StatRow label="Regional data points" value={stats.regional_rows} />
            <StatRow label="Energy throughput records" value={stats.energy_throughput_rows} />
            <StatRow label="Energy production records" value={stats.energy_production_rows} />
            <StatRow label="Assessment snapshots" value={stats.municipality_assessment_snapshots} />
            <StatRow label="Permit snapshots" value={stats.municipality_permit_snapshots} />
            <StatRow label="Well licences" value={stats.well_licence_count} />
            <StatRow label="Immigration records" value={stats.immigration_rows} />
            <StatRow label="Major projects" value={stats.major_project_rows} />
          </div>
        </Card>
      </div>

      {/* Growth Chart */}
      {growthChartData.length > 0 && (
        <Card>
          <CardHeader
            title="Data Accumulation"
            subtitle="Rows collected per source over time"
            badge="time series"
          />
          <GrowthChart data={growthChartData} />
        </Card>
      )}

      {/* Recent Log Entries */}
      <Card>
        <CardHeader
          title="Collection Log"
          subtitle={`Last ${recentHistory.length} entries`}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-card-border">
                <th className="px-2 py-2 text-xs text-muted font-medium">Time</th>
                <th className="px-2 py-2 text-xs text-muted font-medium">Source</th>
                <th className="px-2 py-2 text-xs text-muted font-medium text-right">Rows</th>
                <th className="px-2 py-2 text-xs text-muted font-medium text-center">Status</th>
                <th className="px-2 py-2 text-xs text-muted font-medium">Error</th>
              </tr>
            </thead>
            <tbody>
              {recentHistory.map((entry, i) => (
                <tr
                  key={`${entry.taken_at}-${entry.source}-${i}`}
                  className="border-t border-card-border/50 hover:bg-foreground/[0.02]"
                >
                  <td className="px-2 py-1.5 text-xs text-muted font-mono whitespace-nowrap">
                    {entry.taken_at.replace("T", " ").slice(0, 19)}
                  </td>
                  <td className="px-2 py-1.5 text-xs text-foreground">{entry.source}</td>
                  <td className="px-2 py-1.5 text-xs text-muted font-mono text-right">
                    {entry.records_inserted.toLocaleString()}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {entry.status === "ok" ? (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent-green" />
                    ) : (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent-red" />
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-xs text-accent-red/70 truncate max-w-[200px]">
                    {entry.error}
                  </td>
                </tr>
              ))}
              {recentHistory.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-2 py-8 text-center text-sm text-muted">
                    No collection logs yet. Run a collection to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Schedule Info */}
      <Card>
        <CardHeader title="Cron Schedule" subtitle="Automated collection configuration" />
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-3 text-muted">
            <Clock size={14} />
            <span>Daily at 6:00 AM UTC (midnight MST)</span>
          </div>
          <p className="text-xs text-muted/60 pl-7">
            Set up a Railway cron job or external service to POST to{" "}
            <code className="text-accent/70">/api/admin/collect</code> with header{" "}
            <code className="text-accent/70">Authorization: Bearer $CRON_SECRET</code>
          </p>
          <pre className="text-[10px] bg-background rounded p-3 ml-7 font-mono text-muted overflow-x-auto">
{`# Railway cron (or curl from any scheduler)
curl -X POST https://your-domain.com/api/admin/collect \\
  -H "Authorization: Bearer $CRON_SECRET" \\
  -H "Content-Type: application/json" \\
  -d '{"source": "all"}'`}
          </pre>
        </div>
      </Card>
    </main>
  );
}

function MetricBox({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-4 space-y-1">
      <div className="flex items-center gap-2">
        <Icon size={14} className={color} />
        <span className="text-xs text-muted uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-[11px] text-muted">{sub}</p>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between px-2 py-1 text-sm">
      <span className="text-muted">{label}</span>
      <span className={`font-mono text-xs ${value > 0 ? "text-foreground" : "text-muted/40"}`}>
        {value.toLocaleString()}
      </span>
    </div>
  );
}
