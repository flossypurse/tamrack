import { getDb } from "@/lib/db";
import { Card, CardHeader } from "@/components/card";
import { Users, DollarSign, Key, Activity, TrendingUp, Clock } from "lucide-react";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  created_at: string;
}

interface SubRow {
  status: string;
  cnt: number;
}

interface RecentUser {
  email: string;
  name: string | null;
  created_at: string;
  status: string;
}

interface ApiUsageRow {
  endpoint: string;
  cnt: number;
}

function getAdminStats() {
  const db = getDb();

  const totalUsers = (db.prepare(`SELECT COUNT(*) as cnt FROM users`).get() as { cnt: number }).cnt;

  const subsByStatus = db.prepare(
    `SELECT status, COUNT(*) as cnt FROM subscriptions GROUP BY status`
  ).all() as SubRow[];

  const activeCount = subsByStatus.find((s) => s.status === "active")?.cnt ?? 0;
  const trialingCount = subsByStatus.find((s) => s.status === "trialing")?.cnt ?? 0;
  const canceledCount = subsByStatus.find((s) => s.status === "canceled")?.cnt ?? 0;
  const pastDueCount = subsByStatus.find((s) => s.status === "past_due")?.cnt ?? 0;

  const mrr = activeCount * 29;

  const totalApiKeys = (db.prepare(
    `SELECT COUNT(*) as cnt FROM api_keys WHERE revoked_at IS NULL`
  ).get() as { cnt: number }).cnt;

  const apiRequestsToday = (db.prepare(
    `SELECT COUNT(*) as cnt FROM api_usage WHERE timestamp > datetime('now', '-1 day')`
  ).get() as { cnt: number }).cnt;

  const recentUsers = db.prepare(
    `SELECT u.email, u.name, u.created_at, COALESCE(s.status, 'none') as status
     FROM users u LEFT JOIN subscriptions s ON u.id = s.user_id
     ORDER BY u.created_at DESC LIMIT 20`
  ).all() as RecentUser[];

  const topEndpoints = db.prepare(
    `SELECT endpoint, COUNT(*) as cnt FROM api_usage
     WHERE timestamp > datetime('now', '-7 days')
     GROUP BY endpoint ORDER BY cnt DESC LIMIT 10`
  ).all() as ApiUsageRow[];

  const signupsLast7 = (db.prepare(
    `SELECT COUNT(*) as cnt FROM users WHERE created_at > datetime('now', '-7 days')`
  ).get() as { cnt: number }).cnt;

  const signupsLast30 = (db.prepare(
    `SELECT COUNT(*) as cnt FROM users WHERE created_at > datetime('now', '-30 days')`
  ).get() as { cnt: number }).cnt;

  return {
    totalUsers,
    activeCount,
    trialingCount,
    canceledCount,
    pastDueCount,
    mrr,
    totalApiKeys,
    apiRequestsToday,
    recentUsers,
    topEndpoints,
    signupsLast7,
    signupsLast30,
  };
}

export default function AdminPage() {
  const stats = getAdminStats();

  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <header>
        <h1 className="text-xl font-bold">Admin Dashboard</h1>
        <p className="text-sm text-muted">Revenue, users, and API usage</p>
      </header>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricBox icon={DollarSign} label="MRR" value={`$${stats.mrr}`} sub="CAD" color="text-accent-green" />
        <MetricBox icon={Users} label="Total Users" value={String(stats.totalUsers)} sub={`${stats.signupsLast7} this week`} color="text-accent" />
        <MetricBox icon={TrendingUp} label="Active Subs" value={String(stats.activeCount)} sub={`${stats.trialingCount} trialing`} color="text-accent-green" />
        <MetricBox icon={Activity} label="API Requests" value={String(stats.apiRequestsToday)} sub="last 24h" color="text-accent-amber" />
      </div>

      {/* Subscription Breakdown */}
      <Card>
        <CardHeader title="Subscription Breakdown" subtitle="Current status counts" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
          <StatusBox label="Active" count={stats.activeCount} color="bg-accent-green" />
          <StatusBox label="Trialing" count={stats.trialingCount} color="bg-accent-amber" />
          <StatusBox label="Past Due" count={stats.pastDueCount} color="bg-accent-red" />
          <StatusBox label="Canceled" count={stats.canceledCount} color="bg-muted" />
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Recent Users */}
        <Card>
          <CardHeader title="Recent Signups" subtitle={`${stats.signupsLast30} in last 30 days`} />
          <div className="mt-2 space-y-1 max-h-96 overflow-y-auto">
            {stats.recentUsers.map((u) => (
              <div key={u.email} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-foreground/[0.05] text-sm">
                <div>
                  <span className="text-foreground">{u.email}</span>
                  {u.name && <span className="text-muted ml-2 text-xs">({u.name})</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                    u.status === "active" ? "bg-accent-green/10 text-accent-green" :
                    u.status === "trialing" ? "bg-accent-amber/10 text-accent-amber" :
                    "bg-muted/10 text-muted"
                  }`}>
                    {u.status}
                  </span>
                  <span className="text-[10px] text-muted/50">
                    {new Date(u.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
            {stats.recentUsers.length === 0 && (
              <p className="text-sm text-muted py-4 text-center">No users yet</p>
            )}
          </div>
        </Card>

        {/* API Usage */}
        <Card>
          <CardHeader title="Top API Endpoints" subtitle="Last 7 days" />
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted mb-2">
              <Key size={12} />
              <span>{stats.totalApiKeys} active API key{stats.totalApiKeys !== 1 ? "s" : ""}</span>
            </div>
            {stats.topEndpoints.map((e) => (
              <div key={e.endpoint} className="flex items-center justify-between px-2 py-1.5 text-sm">
                <code className="text-xs text-muted font-mono">{e.endpoint}</code>
                <span className="text-foreground font-medium">{e.cnt.toLocaleString()}</span>
              </div>
            ))}
            {stats.topEndpoints.length === 0 && (
              <p className="text-sm text-muted py-4 text-center">No API usage yet</p>
            )}
          </div>
        </Card>
      </div>
    </main>
  );
}

function MetricBox({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub: string; color: string;
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

function StatusBox({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-background/50 rounded-lg">
      <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
      <div>
        <p className="text-lg font-bold">{count}</p>
        <p className="text-[11px] text-muted">{label}</p>
      </div>
    </div>
  );
}
