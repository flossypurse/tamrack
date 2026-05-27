"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardHeader } from "@/components/card";
import { PageHeader } from "@/components/page-header";
import { AdminNav } from "../admin-nav";
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Globe,
  Server,
  Database,
  ArrowRight,
  Zap,
  Shield,
  Activity,
  Loader2,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ProbeResult {
  source: string;
  status: "ok" | "error" | "timeout";
  responseMs: number;
  records?: number;
  error?: string;
}

interface HealthResponse {
  status: "healthy" | "degraded";
  timestamp: string;
  sources: ProbeResult[];
  summary: {
    total: number;
    ok: number;
    error: number;
    timeout: number;
    avgResponseMs: number;
  };
}

/* ------------------------------------------------------------------ */
/*  Static architecture data                                           */
/* ------------------------------------------------------------------ */

const DATA_SOURCE_MODULES = [
  { name: "data-sources.ts", label: "Core (BoC, StatsCan, Edmonton, Calgary)", endpoints: 5 },
  { name: "data-sources-regional.ts", label: "AB Regional Dashboard", endpoints: 54 },
  { name: "data-sources-cer.ts", label: "CER Pipeline & Energy", endpoints: 16 },
  { name: "data-sources-cmhc.ts", label: "CMHC Housing", endpoints: 8 },
  { name: "data-sources-ircc.ts", label: "IRCC Immigration", endpoints: 5 },
  { name: "data-sources-infrastructure.ts", label: "Infrastructure Projects", endpoints: 2 },
  { name: "data-sources-crime.ts", label: "Crime Data", endpoints: 4 },
  { name: "data-sources-fire.ts", label: "Fire & EMS", endpoints: 3 },
  { name: "data-sources-health.ts", label: "Health Data", endpoints: 4 },
  { name: "data-sources-ualberta.ts", label: "UAlberta Open Data", endpoints: 2 },
  { name: "data-sources-google.ts", label: "Google Maps Platform", endpoints: 2 },
  { name: "data-sources-cannabis.ts", label: "Cannabis Stats", endpoints: 1 },
];

const API_ROUTES = [
  { path: "/api/macro", label: "Macro Economy", auth: false },
  { path: "/api/regional", label: "Regional Dashboard", auth: false },
  { path: "/api/energy", label: "CER Energy", auth: false },
  { path: "/api/permits", label: "Building Permits", auth: true },
  { path: "/api/assessments", label: "Assessments", auth: true },
  { path: "/api/housing", label: "CMHC Housing", auth: false },
  { path: "/api/rental", label: "Rental Market", auth: false },
  { path: "/api/immigration", label: "Immigration", auth: false },
  { path: "/api/projects", label: "Major Projects", auth: false },
  { path: "/api/crime", label: "Crime Stats", auth: false },
  { path: "/api/fire", label: "Fire & EMS", auth: false },
  { path: "/api/health-data", label: "Health Data", auth: false },
  { path: "/api/wildfire", label: "Wildfire", auth: false },
  { path: "/api/signals", label: "Micro Signals", auth: true },
  { path: "/api/safety", label: "Public Safety", auth: false },
  { path: "/api/environment", label: "Environment", auth: false },
  { path: "/api/weather", label: "Weather", auth: false },
  { path: "/api/traffic", label: "Traffic", auth: false },
  { path: "/api/pipeline", label: "RE Pipeline", auth: true },
  { path: "/api/risk", label: "Risk Analysis", auth: true },
  { path: "/api/benchmarks", label: "Benchmarks", auth: true },
  { path: "/api/corridors", label: "Corridors", auth: true },
  { path: "/api/commercial", label: "Commercial RE", auth: true },
  { path: "/api/billing", label: "Billing", auth: true },
  { path: "/api/api-keys", label: "API Keys", auth: true },
  { path: "/api/health", label: "Health Check", auth: false },
  { path: "/api/admin/collect", label: "Data Collection", auth: true },
  { path: "/api/admin/crm", label: "CRM", auth: true },
];

const PAGE_SECTIONS = [
  { section: "Economy", count: 7, path: "/economy" },
  { section: "Real Estate", count: 7, path: "/real-estate" },
  { section: "Intelligence", count: 5, path: "/intelligence" },
  { section: "Environment", count: 4, path: "/environment" },
  { section: "Public Safety", count: 6, path: "/safety" },
  { section: "Health", count: 3, path: "/health" },
  { section: "Municipalities", count: 2, path: "/municipalities" },
  { section: "Briefings", count: 8, path: "/overview/briefing" },
  { section: "Tools & Admin", count: 7, path: "/tools" },
];

const ENV_KEYS = [
  { key: "DATABASE_URL", label: "PostgreSQL", required: true },
  { key: "NEXTAUTH_SECRET", label: "NextAuth", required: true },
  { key: "GOOGLE_MAPS_API_KEY", label: "Google Maps", required: false },
  { key: "STRIPE_SECRET_KEY", label: "Stripe Billing", required: false },
  { key: "CRON_SECRET", label: "Cron Auth", required: false },
  { key: "MAILGUN_API_KEY", label: "Email (Mailgun)", required: false },
];

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function SystemPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastCheck, setLastCheck] = useState<string | null>(null);

  const runHealthCheck = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/health?deep=1");
      const data: HealthResponse = await res.json();
      setHealth(data);
      setLastCheck(new Date().toLocaleTimeString());
    } catch {
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    runHealthCheck();
  }, [runHealthCheck]);

  const totalPages = PAGE_SECTIONS.reduce((s, p) => s + p.count, 0);
  const totalEndpoints = DATA_SOURCE_MODULES.reduce((s, m) => s + m.endpoints, 0);

  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="System Architecture"
        description="Live health checks, data pipeline, and system overview"
        category="tools"
      />

      <AdminNav />

      {/* Overall Status Banner */}
      <div
        className={`flex items-center justify-between p-4 rounded-xl border ${
          health?.status === "healthy"
            ? "bg-accent-green/5 border-accent-green/30"
            : health?.status === "degraded"
              ? "bg-accent-amber/5 border-accent-amber/30"
              : "bg-card border-card-border"
        }`}
      >
        <div className="flex items-center gap-3">
          {loading ? (
            <Loader2 size={20} className="text-muted animate-spin" />
          ) : health?.status === "healthy" ? (
            <CheckCircle size={20} className="text-accent-green" />
          ) : health?.status === "degraded" ? (
            <XCircle size={20} className="text-accent-amber" />
          ) : (
            <Activity size={20} className="text-muted" />
          )}
          <div>
            <p className="font-semibold text-sm">
              {loading
                ? "Running health checks..."
                : health
                  ? health.status === "healthy"
                    ? "All Systems Operational"
                    : "Degraded — Some Sources Unreachable"
                  : "Health check not run"}
            </p>
            {health && (
              <p className="text-xs text-muted">
                {health.summary.ok}/{health.summary.total} sources OK &middot; avg {health.summary.avgResponseMs}ms
                {lastCheck && ` · checked ${lastCheck}`}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={runHealthCheck}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-card border border-card-border rounded-lg text-xs text-muted hover:text-foreground transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Recheck
        </button>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatBox icon={Globe} label="Upstream Sources" value={String(health?.summary.total ?? 9)} sub={`${totalEndpoints}+ endpoints`} color="text-accent" />
        <StatBox icon={Zap} label="API Routes" value={String(API_ROUTES.length)} sub={`${API_ROUTES.filter(r => r.auth).length} authenticated`} color="text-accent-green" />
        <StatBox icon={Server} label="Data Modules" value={String(DATA_SOURCE_MODULES.length)} sub="src/lib/" color="text-accent-amber" />
        <StatBox icon={Shield} label="Pages" value={`~${totalPages}`} sub={`${PAGE_SECTIONS.length} sections`} color="text-accent" />
      </div>

      {/* Live Health Probes */}
      <Card>
        <CardHeader
          title="Upstream Health Probes"
          subtitle="Live connectivity to all external data sources"
          badge="live"
        />
        {health ? (
          <div className="space-y-1 mt-2">
            {health.sources.map((s) => (
              <div
                key={s.source}
                className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-foreground/[0.03]"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      s.status === "ok"
                        ? "bg-accent-green"
                        : s.status === "timeout"
                          ? "bg-accent-amber"
                          : "bg-accent-red"
                    }`}
                  />
                  <span className="text-sm">{s.source}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted">
                  {s.records !== undefined && (
                    <span className="font-mono">{s.records} records</span>
                  )}
                  <span
                    className={`font-mono ${
                      s.responseMs < 1000
                        ? "text-accent-green"
                        : s.responseMs < 3000
                          ? "text-accent-amber"
                          : "text-accent-red"
                    }`}
                  >
                    {s.responseMs}ms
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      s.status === "ok"
                        ? "bg-accent-green/10 text-accent-green"
                        : s.status === "timeout"
                          ? "bg-accent-amber/10 text-accent-amber"
                          : "bg-accent-red/10 text-accent-red"
                    }`}
                  >
                    {s.status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted">
            {loading ? "Probing upstream sources..." : "Click Recheck to run health probes"}
          </div>
        )}
      </Card>

      {/* Architecture Diagram */}
      <Card>
        <CardHeader
          title="Data Pipeline Architecture"
          subtitle="How data flows from upstream sources through to the frontend"
        />
        <div className="mt-4 space-y-6">
          {/* Flow diagram */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-start">
            {/* Col 1: External Sources */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-mono uppercase tracking-widest text-muted mb-2">External APIs</h3>
              {[
                "Bank of Canada",
                "Statistics Canada",
                "Edmonton SODA",
                "Calgary Socrata",
                "AB Regional Dashboard",
                "CER Open Data",
                "IRCC Immigration",
                "Infrastructure Canada",
                "ArcGIS (20 munis)",
                "CWFIS Wildfire",
                "511 Alberta",
                "Google Maps",
              ].map((s) => (
                <div key={s} className="text-[11px] px-2 py-1 bg-accent/5 border border-accent/20 rounded text-accent truncate">
                  {s}
                </div>
              ))}
            </div>

            {/* Arrow */}
            <div className="hidden md:flex items-center justify-center pt-16">
              <ArrowRight size={20} className="text-muted/40" />
            </div>

            {/* Col 2: Data Modules */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-mono uppercase tracking-widest text-muted mb-2">Data Modules</h3>
              {DATA_SOURCE_MODULES.map((m) => (
                <div
                  key={m.name}
                  className="text-[11px] px-2 py-1 bg-accent-amber/5 border border-accent-amber/20 rounded text-accent-amber/80 truncate"
                  title={m.name}
                >
                  {m.label}
                </div>
              ))}
            </div>

            {/* Arrow */}
            <div className="hidden md:flex items-center justify-center pt-16">
              <ArrowRight size={20} className="text-muted/40" />
            </div>

            {/* Col 3: API + Pages */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-mono uppercase tracking-widest text-muted mb-2">API Routes → Pages</h3>
              {PAGE_SECTIONS.map((p) => (
                <div
                  key={p.section}
                  className="text-[11px] px-2 py-1 bg-accent-green/5 border border-accent-green/20 rounded text-accent-green/80 flex justify-between"
                >
                  <span>{p.section}</span>
                  <span className="font-mono text-muted">{p.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Data Source Modules */}
        <Card>
          <CardHeader
            title="Data Source Modules"
            subtitle={`${DATA_SOURCE_MODULES.length} modules in src/lib/`}
          />
          <div className="space-y-1 mt-2">
            {DATA_SOURCE_MODULES.map((m) => (
              <div
                key={m.name}
                className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-foreground/[0.03] text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Database size={12} className="text-accent-amber shrink-0" />
                  <code className="text-xs text-muted font-mono truncate">{m.name}</code>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-muted">{m.label}</span>
                  <span className="font-mono text-xs text-foreground">{m.endpoints}</span>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between px-2 pt-2 border-t border-card-border mt-2">
              <span className="text-xs text-muted font-medium">Total endpoints</span>
              <span className="font-mono text-xs font-bold">{totalEndpoints}+</span>
            </div>
          </div>
        </Card>

        {/* API Routes */}
        <Card>
          <CardHeader
            title="API Routes"
            subtitle={`${API_ROUTES.length} routes`}
          />
          <div className="space-y-1 mt-2 max-h-[500px] overflow-y-auto">
            {API_ROUTES.map((r) => (
              <div
                key={r.path}
                className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-foreground/[0.03] text-sm"
              >
                <code className="text-xs text-muted font-mono">{r.path}</code>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted">{r.label}</span>
                  {r.auth && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent-amber/10 text-accent-amber font-medium">
                      AUTH
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Environment Config */}
      <Card>
        <CardHeader
          title="Environment Configuration"
          subtitle="Required and optional API keys / secrets"
        />
        <div className="space-y-1 mt-2">
          {ENV_KEYS.map((e) => (
            <div
              key={e.key}
              className="flex items-center justify-between px-3 py-2 rounded hover:bg-foreground/[0.03]"
            >
              <div className="flex items-center gap-3">
                <code className="text-xs font-mono text-muted">{e.key}</code>
                <span className="text-[10px] text-muted/60">{e.label}</span>
              </div>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                  e.required
                    ? "bg-accent-red/10 text-accent-red"
                    : "bg-muted/10 text-muted"
                }`}
              >
                {e.required ? "REQUIRED" : "OPTIONAL"}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Infrastructure */}
      <Card>
        <CardHeader
          title="Infrastructure"
          subtitle="Hosting, deployment, and services"
        />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
          <InfraBox label="Hosting" value="Fly.io" detail="yyz / Toronto · auto-deploy from main" />
          <InfraBox label="Framework" value="Next.js 16" detail="React 19 + App Router" />
          <InfraBox label="Database" value="PostgreSQL 17" detail="Crunchy Bridge · ca-central-1 / Montreal" />
          <InfraBox label="Auth" value="NextAuth" detail="Email magic link + Google" />
          <InfraBox label="Payments" value="Stripe" detail="$9/mo paid tier (invite-only)" />
          <InfraBox label="Cron" value="Resonate" detail="daily-collection · 06:00 UTC" />
        </div>
      </Card>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function StatBox({
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

function InfraBox({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="bg-background/50 rounded-lg px-4 py-3 space-y-0.5">
      <p className="text-[10px] text-muted uppercase tracking-wider">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
      <p className="text-[11px] text-muted">{detail}</p>
    </div>
  );
}
