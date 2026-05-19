"use client";

import { useState } from "react";
import { Card, CardHeader } from "@/components/card";
import { PageHeader } from "@/components/page-header";
import { SectionHeader } from "@/components/section-header";
import {
  BookOpen,
  Key,
  Zap,
  Copy,
  Check,
  ChevronDown,
  Play,
  Loader2,
  Terminal,
  Code2,
  Lock,
  Globe,
  BarChart3,
  Building2,
  Home,
  Radar,
} from "lucide-react";

// ============================================================
// API endpoint definitions
// ============================================================

type ParamDef = {
  name: string;
  type: string;
  required: boolean;
  default?: string;
  description: string;
  options?: string[];
};

// Tamrack scopes — keep in sync with src/lib/api-auth.ts (5-scope taxonomy).
// Replaces the legacy tier: "pro" | "all" model. Every endpoint now declares
// the single scope an API key needs to call it. `none` = no scope check
// (e.g. /api/health).
type TamrackScope =
  | "tamrack:macro:read"
  | "tamrack:regional:read"
  | "tamrack:real-estate:read"
  | "tamrack:energy:read"
  | "tamrack:economy:read"
  | "none";

type EndpointDef = {
  method: string;
  path: string;
  title: string;
  description: string;
  icon: React.ElementType;
  scope: TamrackScope;
  params: ParamDef[];
  exampleResponse: object;
  curlExample: string;
};

const ENDPOINTS: EndpointDef[] = [
  {
    method: "GET",
    path: "/api/macro",
    title: "Macro Indicators",
    description:
      "Normalized time series data for 18 macroeconomic indicators covering interest rates, employment, GDP, housing, commodities, and more. Data sourced live from Bank of Canada and Statistics Canada.",
    icon: BarChart3,
    scope: "tamrack:macro:read",
    params: [
      {
        name: "indicator",
        type: "string",
        required: false,
        description:
          "The indicator to fetch. Omit to list all available indicators.",
        options: [
          "policy_rate",
          "prime_rate",
          "cad_usd",
          "mortgage_5y_fixed",
          "mortgage_5y_variable",
          "bcpi",
          "bcpi_energy",
          "bcpi_agriculture",
          "unemployment",
          "employment",
          "cpi",
          "population",
          "gdp",
          "housing_starts",
          "housing_completions",
          "weekly_earnings",
          "retail_sales",
          "aax",
        ],
      },
      {
        name: "periods",
        type: "number",
        required: false,
        default: "24",
        description: "Number of data points to return (most recent).",
      },
    ],
    exampleResponse: {
      indicator: "policy_rate",
      label: "BoC Policy Rate",
      source: "Bank of Canada Valet API",
      periods: 6,
      data: [
        { date: "2024-10-23", value: 3.75 },
        { date: "2024-12-11", value: 3.25 },
        { date: "2025-01-29", value: 3.0 },
        { date: "2025-03-12", value: 2.75 },
        { date: "2025-04-16", value: 2.75 },
        { date: "2025-06-04", value: 2.75 },
      ],
    },
    curlExample: `curl -H "Authorization: Bearer <YOUR_API_KEY>" \\
  "https://tamrack.ca/api/macro?indicator=policy_rate&periods=6"`,
  },
  {
    method: "GET",
    path: "/api/permits",
    title: "Building & Dev Permits",
    description:
      "Building permits, development permits, and construction project data aggregated across Edmonton metro municipalities. Includes hot zones, monthly trends, and recent permit details.",
    icon: Building2,
    scope: "tamrack:real-estate:read",
    params: [
      {
        name: "municipality",
        type: "string",
        required: false,
        description:
          "Filter to a specific municipality. Omit for all municipalities summary.",
        options: [
          "edmonton",
          "strathcona",
          "st-albert",
          "parkland",
          "stony-plain",
        ],
      },
      {
        name: "type",
        type: "string",
        required: false,
        default: "summary",
        description: "Data type to return.",
        options: ["summary", "recent"],
      },
    ],
    exampleResponse: {
      municipality: "edmonton",
      source: "Edmonton SODA API",
      hotZones: [
        {
          neighbourhood: "DOWNTOWN",
          permits: 47,
          units: 312,
          totalValue: 89400000,
          avgValue: 1902128,
        },
        {
          neighbourhood: "WESTMOUNT",
          permits: 23,
          units: 45,
          totalValue: 12300000,
          avgValue: 534783,
        },
      ],
      monthlyTrend: [
        { month: "2025-01", permits: 234, value: 67000000 },
        { month: "2025-02", permits: 289, value: 82000000 },
      ],
    },
    curlExample: `curl -H "Authorization: Bearer <YOUR_API_KEY>" \\
  "https://tamrack.ca/api/permits?municipality=edmonton"`,
  },
  {
    method: "GET",
    path: "/api/assessments",
    title: "Property Assessments",
    description:
      "Property assessment data normalized across 5 municipalities. Includes average values by neighbourhood, subdivision, zoning, and building type. Perfect for identifying undervalued areas.",
    icon: Home,
    scope: "tamrack:real-estate:read",
    params: [
      {
        name: "municipality",
        type: "string",
        required: false,
        description:
          "Filter to a specific municipality. Omit for all municipalities.",
        options: [
          "edmonton",
          "strathcona",
          "st-albert",
          "parkland",
          "stony-plain",
        ],
      },
    ],
    exampleResponse: {
      municipality: "edmonton",
      source: "Edmonton SODA API",
      type: "neighbourhood",
      data: [
        { area: "WINDERMERE", count: 1847, avgAssessment: 642000 },
        { area: "SUMMERSIDE", count: 2103, avgAssessment: 498000 },
        { area: "THE HAMPTONS", count: 1204, avgAssessment: 587000 },
      ],
    },
    curlExample: `curl -H "Authorization: Bearer <YOUR_API_KEY>" \\
  "https://tamrack.ca/api/assessments?municipality=edmonton"`,
  },
  {
    method: "GET",
    path: "/api/signals",
    title: "Cross-Analysis Signals",
    description:
      "The computed intelligence layer. Combines permit activity, assessment values, and business licence data to surface transformation zones, teardown opportunities, renovation ROI signals, and business-residential convergence patterns.",
    icon: Radar,
    scope: "tamrack:real-estate:read",
    params: [],
    exampleResponse: {
      description: "Cross-analysis signals combining multiple Edmonton data sources.",
      signals: {
        transformation: {
          description: "Neighbourhoods showing signs of transformation.",
          count: 12,
          data: [
            {
              neighbourhood: "BONNIE DOON",
              phase: "hot",
              permits: 18,
              avgAssessment: 287000,
              permitIntensity: 6.27,
            },
          ],
        },
        teardowns: {
          description: "Areas where teardowns and redevelopment are happening.",
          count: 8,
          data: [
            {
              neighbourhood: "KING EDWARD PARK",
              devPermits: 5,
              newConstructionValue: 1200000,
            },
          ],
        },
        renovation_roi: {
          description: "Renovation activity relative to property values.",
          count: 15,
          data: [
            {
              neighbourhood: "HIGHLANDS",
              renovations: 12,
              avgAssessment: 342000,
              ratio: 3.51,
            },
          ],
        },
        convergence: {
          description: "Business + residential development convergence.",
          count: 6,
          data: [
            {
              neighbourhood: "RITCHIE",
              newBusinesses: 8,
              residentialPermits: 14,
              score: 7.2,
            },
          ],
        },
      },
    },
    curlExample: `curl -H "Authorization: Bearer <YOUR_API_KEY>" \\
  "https://tamrack.ca/api/signals"`,
  },
];

// ============================================================
// Code example generators
// ============================================================

function generateCurl(endpoint: EndpointDef, params: Record<string, string>) {
  const qs = Object.entries(params)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
  const url = `https://tamrack.ca${endpoint.path}${qs ? `?${qs}` : ""}`;
  return `curl -H "Authorization: Bearer <YOUR_API_KEY>" \\
  "${url}"`;
}

function generateJS(endpoint: EndpointDef, params: Record<string, string>) {
  const qs = Object.entries(params)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
  const url = `https://tamrack.ca${endpoint.path}${qs ? `?${qs}` : ""}`;
  return `const res = await fetch("${url}", {
  headers: { Authorization: "Bearer <YOUR_API_KEY>" },
});
const data = await res.json();
console.log(data);`;
}

function generatePython(endpoint: EndpointDef, params: Record<string, string>) {
  const qs = Object.entries(params)
    .filter(([, v]) => v)
    .map(([k, v]) => `"${k}": "${v}"`)
    .join(", ");
  return `import requests

resp = requests.get(
    "https://tamrack.ca${endpoint.path}",
    headers={"Authorization": "Bearer <YOUR_API_KEY>"},${qs ? `\n    params={${qs}},` : ""}
)
data = resp.json()
print(data)`;
}

// ============================================================
// Components
// ============================================================

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).catch(() => {
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
        });
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="p-1.5 rounded-md hover:bg-foreground/10 text-muted hover:text-foreground transition-colors"
      title="Copy"
    >
      {copied ? <Check size={14} className="text-accent-green" /> : <Copy size={14} />}
    </button>
  );
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  return (
    <div className="relative group">
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <CopyButton text={code} />
      </div>
      <pre className="bg-background border border-card-border rounded-lg p-4 text-xs font-mono overflow-x-auto text-foreground/80">
        <code>
          <span className="text-muted/50 text-[10px] uppercase tracking-wider">{lang}</span>
          {"\n"}
          {code}
        </code>
      </pre>
    </div>
  );
}

function MethodBadge({ method }: { method: string }) {
  return (
    <span className="text-[11px] font-mono font-bold bg-accent-green/15 text-accent-green px-2 py-0.5 rounded">
      {method}
    </span>
  );
}

function ScopeBadge({ scope }: { scope: TamrackScope }) {
  // The five-scope taxonomy renders as a short two-letter chip in the
  // route's accent color; "none" renders as a "FREE" green chip.
  if (scope === "none") {
    return (
      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent-green/10 text-accent-green">
        FREE
      </span>
    );
  }
  // Strip "tamrack:" prefix + ":read" suffix → e.g. "macro", "real-estate".
  const label = scope.replace(/^tamrack:/, "").replace(/:read$/, "");
  return (
    <span
      className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent/10 text-accent"
      title={scope}
    >
      {label}
    </span>
  );
}

function EndpointCard({ endpoint }: { endpoint: EndpointDef }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"curl" | "js" | "python">("curl");
  const [params, setParams] = useState<Record<string, string>>({});
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showExample, setShowExample] = useState(false);

  const codeTabs = {
    curl: generateCurl(endpoint, params),
    js: generateJS(endpoint, params),
    python: generatePython(endpoint, params),
  };

  const tryIt = async () => {
    setLoading(true);
    setResponse(null);
    try {
      const qs = Object.entries(params)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join("&");
      const url = `${endpoint.path}${qs ? `?${qs}` : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      setResponse(JSON.stringify(data, null, 2));
    } catch (err) {
      setResponse(JSON.stringify({ error: "Request failed", detail: String(err) }, null, 2));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start gap-3 text-left"
      >
        <endpoint.icon size={18} className="text-accent mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <MethodBadge method={endpoint.method} />
            <code className="text-sm font-mono font-medium text-foreground">{endpoint.path}</code>
            <ScopeBadge scope={endpoint.scope} />
          </div>
          <h3 className="text-sm font-medium mt-1.5">{endpoint.title}</h3>
          <p className="text-xs text-muted mt-0.5 line-clamp-2">{endpoint.description}</p>
        </div>
        <ChevronDown
          size={16}
          className={`text-muted mt-1 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Expanded content */}
      {open && (
        <div className="mt-4 pt-4 border-t border-card-border space-y-5">
          {/* Parameters */}
          {endpoint.params.length > 0 && (
            <div>
              <h4 className="text-xs font-medium uppercase tracking-wider text-muted mb-2">Parameters</h4>
              <div className="border border-card-border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-background/50">
                      <th className="text-left px-3 py-2 font-medium text-muted">Name</th>
                      <th className="text-left px-3 py-2 font-medium text-muted">Type</th>
                      <th className="text-left px-3 py-2 font-medium text-muted">Required</th>
                      <th className="text-left px-3 py-2 font-medium text-muted">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {endpoint.params.map((p) => (
                      <tr key={p.name} className="border-t border-card-border">
                        <td className="px-3 py-2 font-mono text-accent">{p.name}</td>
                        <td className="px-3 py-2 font-mono text-muted">{p.type}</td>
                        <td className="px-3 py-2">
                          {p.required ? (
                            <span className="text-accent-red">required</span>
                          ) : (
                            <span className="text-muted">optional{p.default ? ` (${p.default})` : ""}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-foreground/80">
                          {p.description}
                          {p.options && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {p.options.map((o) => (
                                <code
                                  key={o}
                                  className="text-[10px] bg-background px-1.5 py-0.5 rounded border border-card-border cursor-pointer hover:border-accent hover:text-accent transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setParams((prev) => ({ ...prev, [p.name]: o }));
                                  }}
                                >
                                  {o}
                                </code>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Try It playground */}
          <div>
            <h4 className="text-xs font-medium uppercase tracking-wider text-muted mb-2">
              <Terminal size={12} className="inline mr-1" />
              Playground
            </h4>
            <div className="bg-background border border-card-border rounded-lg p-3 space-y-3">
              {/* Param inputs */}
              {endpoint.params.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {endpoint.params.map((p) => (
                    <div key={p.name} className="flex-1 min-w-[140px]">
                      <label className="text-[10px] font-mono text-muted mb-1 block">{p.name}</label>
                      {p.options ? (
                        <select
                          value={params[p.name] || ""}
                          onChange={(e) =>
                            setParams((prev) => ({ ...prev, [p.name]: e.target.value }))
                          }
                          className="w-full bg-card border border-card-border rounded-md px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-accent"
                        >
                          <option value="">{p.required ? "Select..." : `All (default)`}</option>
                          {p.options.map((o) => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          placeholder={p.default || ""}
                          value={params[p.name] || ""}
                          onChange={(e) =>
                            setParams((prev) => ({ ...prev, [p.name]: e.target.value }))
                          }
                          className="w-full bg-card border border-card-border rounded-md px-2 py-1.5 text-xs font-mono focus:outline-none focus:border-accent"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Run button */}
              <button
                onClick={tryIt}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white text-xs font-medium rounded-md hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Play size={12} />
                )}
                {loading ? "Fetching..." : "Send Request"}
              </button>

              {/* Live response */}
              {response && (
                <div className="relative">
                  <div className="absolute top-2 right-2 flex items-center gap-1">
                    <span className="text-[9px] font-mono text-accent-green bg-accent-green/10 px-1.5 py-0.5 rounded">LIVE</span>
                    <CopyButton text={response} />
                  </div>
                  <pre className="bg-card border border-card-border rounded-lg p-3 text-xs font-mono overflow-x-auto max-h-80 overflow-y-auto text-foreground/80">
                    {response}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* Code examples */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-medium uppercase tracking-wider text-muted">
                <Code2 size={12} className="inline mr-1" />
                Code Examples
              </h4>
              <div className="flex gap-0.5 bg-background rounded-md p-0.5 border border-card-border">
                {(["curl", "js", "python"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-2.5 py-1 text-[10px] font-mono rounded transition-colors ${
                      tab === t
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    {t === "js" ? "JavaScript" : t === "curl" ? "cURL" : "Python"}
                  </button>
                ))}
              </div>
            </div>
            <CodeBlock code={codeTabs[tab]} lang={tab} />
          </div>

          {/* Example response */}
          <div>
            <button
              onClick={() => setShowExample(!showExample)}
              className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors"
            >
              <ChevronDown size={12} className={`transition-transform ${showExample ? "rotate-180" : ""}`} />
              Example Response
            </button>
            {showExample && (
              <div className="mt-2">
                <CodeBlock
                  code={JSON.stringify(endpoint.exampleResponse, null, 2)}
                  lang="json"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

// ============================================================
// Main page
// ============================================================

export default function DocsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Hero */}
      <PageHeader
        title="API Reference"
        description="Programmatic access to Alberta's economic pulse. Live data from Bank of Canada, Statistics Canada, and 20+ municipal ArcGIS systems — normalized, cross-analyzed, and ready for your models, dashboards, and alerts."
        category="tools"
        icon={<BookOpen size={20} />}
      />

      {/* Quick start cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <div className="flex items-center gap-2 mb-2">
            <Key size={14} className="text-accent" />
            <h3 className="text-xs font-medium">1. Get your API key</h3>
          </div>
          <p className="text-[11px] text-muted">
            Go to{" "}
            <a href="/billing" className="text-accent hover:underline">
              Billing & API Keys
            </a>{" "}
            to generate a key. Keys start with <code className="text-[10px] bg-background px-1 py-0.5 rounded">ap_</code>.
          </p>
        </Card>
        <Card>
          <div className="flex items-center gap-2 mb-2">
            <Lock size={14} className="text-accent" />
            <h3 className="text-xs font-medium">2. Authenticate</h3>
          </div>
          <p className="text-[11px] text-muted">
            Pass your key in the <code className="text-[10px] bg-background px-1 py-0.5 rounded">Authorization</code> header
            as <code className="text-[10px] bg-background px-1 py-0.5 rounded">Bearer &lt;YOUR_API_KEY&gt;</code>
          </p>
        </Card>
        <Card>
          <div className="flex items-center gap-2 mb-2">
            <Zap size={14} className="text-accent" />
            <h3 className="text-xs font-medium">3. Start building</h3>
          </div>
          <p className="text-[11px] text-muted">
            All endpoints return JSON. Rate limit: <strong>1,000 req/day</strong> per key.
            Data is fetched live from source APIs.
          </p>
        </Card>
      </div>

      {/* Auth section */}
      <Card>
        <CardHeader
          title="Authentication"
          subtitle="All API endpoints require authentication"
          badge="REQUIRED"
        />
        <div className="space-y-3">
          <p className="text-xs text-muted">
            Every request must include your API key in the Authorization header:
          </p>
          <CodeBlock
            code={`curl -H "Authorization: Bearer <YOUR_API_KEY>" \\
  "https://tamrack.ca/api/macro?indicator=policy_rate"`}
            lang="http"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <div className="bg-background border border-card-border rounded-lg p-3">
              <h4 className="text-[10px] font-mono uppercase tracking-wider text-muted mb-1.5">Rate Limits</h4>
              <p className="text-xs text-foreground/80">
                <strong>1,000</strong> requests per day per API key. Resets at midnight UTC.
                The <code className="text-[10px] bg-card px-1 py-0.5 rounded">X-RateLimit-Remaining</code> header
                shows your remaining quota.
              </p>
            </div>
            <div className="bg-background border border-card-border rounded-lg p-3">
              <h4 className="text-[10px] font-mono uppercase tracking-wider text-muted mb-1.5">Error Codes</h4>
              <div className="space-y-1 text-xs text-foreground/80">
                <div><code className="text-accent-red">401</code> — Missing or invalid API key</div>
                <div><code className="text-accent-red">403</code> — No active subscription</div>
                <div><code className="text-accent-red">429</code> — Rate limit exceeded</div>
                <div><code className="text-accent-red">500</code> — Upstream data source error</div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Endpoints */}
      <div>
        <SectionHeader title="Endpoints" icon={<Globe size={16} />} category="tools" />
        <div className="space-y-3">
          {ENDPOINTS.map((ep) => (
            <EndpointCard key={ep.path} endpoint={ep} />
          ))}
        </div>
      </div>

      {/* Data sources */}
      <Card>
        <CardHeader
          title="Data Sources"
          subtitle="Where the data actually comes from"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            {
              name: "Bank of Canada",
              desc: "Policy rate, exchange rates, mortgage rates, BCPI commodity indexes",
              api: "Valet API",
              freq: "Daily/Monthly",
            },
            {
              name: "Statistics Canada",
              desc: "Employment, GDP, CPI, population, housing starts, retail sales",
              api: "Web Data Service",
              freq: "Monthly/Quarterly",
            },
            {
              name: "Edmonton Open Data",
              desc: "Building permits, dev permits, business licences, assessments",
              api: "Socrata (SODA)",
              freq: "Live",
            },
            {
              name: "Municipal ArcGIS",
              desc: "Strathcona, St. Albert, Parkland, Stony Plain + 15 more",
              api: "ArcGIS REST",
              freq: "Live",
            },
            {
              name: "Alberta Open Data",
              desc: "Alberta Activity Index (AAX), economic indicators",
              api: "CKAN / Direct",
              freq: "Monthly",
            },
          ].map((src) => (
            <div key={src.name} className="bg-background border border-card-border rounded-lg p-3">
              <h4 className="text-xs font-medium">{src.name}</h4>
              <p className="text-[11px] text-muted mt-0.5">{src.desc}</p>
              <div className="flex gap-2 mt-2">
                <span className="text-[9px] font-mono bg-card px-1.5 py-0.5 rounded border border-card-border">{src.api}</span>
                <span className="text-[9px] font-mono bg-card px-1.5 py-0.5 rounded border border-card-border">{src.freq}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* SDKs / Integrations callout */}
      <Card className="border-accent/20 bg-accent/[0.03]">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
            <Code2 size={16} className="text-accent" />
          </div>
          <div>
            <h3 className="text-sm font-medium">Build with Tamrack</h3>
            <p className="text-xs text-muted mt-1">
              Use our API to power your own dashboards, alerts, spreadsheets, or AI agents.
              Feed macro indicators into your models, track permit activity for real estate leads,
              or build custom reports for your municipality.
            </p>
            <div className="flex gap-2 mt-3">
              <a
                href="/billing"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white text-xs font-medium rounded-md hover:bg-accent/90 transition-colors"
              >
                <Key size={12} />
                Get API Key
              </a>
              <a
                href="/tools/sources"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-card border border-card-border text-xs font-medium rounded-md hover:bg-foreground/5 transition-colors"
              >
                View All Sources
              </a>
            </div>
          </div>
        </div>
      </Card>

      {/* Footer */}
      <p className="text-[10px] text-muted/50 text-center pb-4">
        All data is sourced from official government APIs. Tamrack does not store or cache data —
        every API call fetches live from the source. Response times depend on upstream API performance.
      </p>
    </div>
  );
}
