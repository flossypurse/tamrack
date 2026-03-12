import type { Metadata } from "next";
import { Suspense } from "react";
import { Card } from "@/components/card";
import {
  Target,
  DollarSign,
  Building2,
  MapPin,
  Wrench,
  TreePine,
  Flame,
  TrendingUp,
  Eye,
  FileText,
} from "lucide-react";
import { PrintButton } from "./print-button";
import {
  findEquityGoldSellers,
  findTeardownTargets,
  findVacantLotOpportunities,
  findRenovationCompleteHomes,
  findNewNeighbourhoodDevelopments,
  findDevPermitSurge,
  getLeadSummary,
  type ProspectLead,
} from "@/lib/prospects";

// ============================================================
// Priority badge
// ============================================================

function PriorityBadge({ priority }: { priority: ProspectLead["priority"] }) {
  const styles = {
    hot: "bg-red-500/15 text-red-400 border-red-500/20",
    warm: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    watch: "bg-slate-500/15 text-slate-400 border-slate-500/20",
  };
  const icons = {
    hot: <Flame size={10} />,
    warm: <TrendingUp size={10} />,
    watch: <Eye size={10} />,
  };
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${styles[priority]}`}
    >
      {icons[priority]}
      {priority.toUpperCase()}
    </span>
  );
}

function MunicipalityTag({ name }: { name: string }) {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">
      {name}
    </span>
  );
}

// ============================================================
// Prospect card
// ============================================================

function ProspectCard({ lead }: { lead: ProspectLead }) {
  return (
    <div className="p-4 rounded-lg border border-card-border bg-card/50 hover:bg-card/80 transition-colors print:break-inside-avoid">
      {/* Top row: location + badges */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground">
            {lead.location}
          </span>
          <PriorityBadge priority={lead.priority} />
          <MunicipalityTag name={lead.municipality} />
        </div>
      </div>

      {/* Headline */}
      <p className="text-sm text-foreground/90 font-medium mb-1.5">
        {lead.headline}
      </p>

      {/* Reason */}
      <p className="text-xs text-foreground/60 leading-relaxed mb-3">
        {lead.reason}
      </p>

      {/* Key numbers */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {Object.entries(lead.keyNumbers).map(([label, value]) => (
          <span
            key={label}
            className="text-[10px] px-2 py-0.5 rounded-full bg-card-border/50 text-muted"
          >
            <span className="text-foreground/40">{label}:</span> {value}
          </span>
        ))}
      </div>

      {/* Suggested action */}
      <div className="p-2.5 rounded-md bg-accent/5 border border-accent/10">
        <p className="text-[10px] text-accent uppercase tracking-wider font-medium mb-0.5">
          What to do
        </p>
        <p className="text-xs text-foreground/80 leading-relaxed">
          {lead.suggestedAction}
        </p>
      </div>
    </div>
  );
}

// ============================================================
// Lead sections (server components with async data fetching)
// ============================================================

function LeadGrid({
  leads,
  emptyMessage,
  limit = 20,
}: {
  leads: ProspectLead[];
  emptyMessage: string;
  limit?: number;
}) {
  if (leads.length === 0) {
    return <p className="text-xs text-muted py-4">{emptyMessage}</p>;
  }

  const summary = getLeadSummary(leads);
  const municipalities = summary.municipalities;

  return (
    <div className="space-y-3">
      {/* Summary row */}
      <div className="flex flex-wrap gap-3 text-xs text-muted">
        <span>
          <span className="text-red-400 font-medium">{summary.hot}</span> hot
        </span>
        <span>
          <span className="text-amber-400 font-medium">{summary.warm}</span>{" "}
          warm
        </span>
        <span>
          <span className="text-slate-400 font-medium">{summary.watch}</span>{" "}
          watch
        </span>
        {municipalities.length > 1 && (
          <span className="text-foreground/40">
            across {municipalities.join(", ")}
          </span>
        )}
      </div>

      {/* Lead cards */}
      <div className="space-y-2">
        {leads.slice(0, limit).map((lead) => (
          <ProspectCard key={lead.id} lead={lead} />
        ))}
      </div>
    </div>
  );
}

async function EquityGoldSection() {
  const leads = await findEquityGoldSellers();
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        Properties where the current assessed value is significantly higher than
        the last recorded sale price. These owners have equity they may not
        realize — a great conversation starter. Pulled from all municipalities
        with sale price data.
      </p>
      <LeadGrid leads={leads} emptyMessage="No equity gap leads found. Sale price data may be limited." />
    </div>
  );
}

async function TeardownSection() {
  const leads = await findTeardownTargets();
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        Addresses in neighbourhoods with concentrated development permit
        activity. In Edmonton, these are classified &quot;Redeveloping&quot;
        areas. In Calgary, communities with high dev permit volume signal the
        same transformation. Sellers in these areas are sitting on land worth
        more than their house.
      </p>
      <LeadGrid leads={leads} emptyMessage="No teardown targets found right now." />
    </div>
  );
}

async function VacantLotSection() {
  const leads = await findVacantLotOpportunities();
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        Vacant lots across Alberta — ready for builders, investors, or anyone
        looking to build custom. Scanned from dedicated vacant lot endpoints and
        property classification data across multiple municipalities.
      </p>
      <LeadGrid leads={leads} emptyMessage="No vacant lot data available." />
    </div>
  );
}

async function RenovationSection() {
  const leads = await findRenovationCompleteHomes();
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        Homes with recent renovation permits over $50K in Edmonton and Calgary.
        Owners who just renovated may be preparing to sell — or their neighbours
        are now wondering what their own home is worth.
      </p>
      <LeadGrid leads={leads} emptyMessage="No high-value renovation permits found recently." />
    </div>
  );
}

async function NewNeighbourhoodSection() {
  const leads = await findNewNeighbourhoodDevelopments();
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        New subdivisions where lots are being registered. Lot buyers need agents
        for their builds, and developers need preferred agent referrals. Sourced
        from municipal development stage registries.
      </p>
      <LeadGrid leads={leads} emptyMessage="No recent development stage data available." limit={20} />
    </div>
  );
}

async function DevPermitSurgeSection() {
  const leads = await findDevPermitSurge();
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        Development permit activity across Alberta municipalities outside
        Edmonton and Calgary. Active permits signal neighbourhood growth —
        neighbours of new builds often consider selling.
      </p>
      <LeadGrid leads={leads} emptyMessage="No dev permit data from ArcGIS municipalities." />
    </div>
  );
}

// ============================================================
// Loading skeleton
// ============================================================

function SectionLoading() {
  return (
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="animate-pulse p-4 rounded-lg border border-card-border"
        >
          <div className="h-4 bg-card-border rounded w-1/3 mb-3" />
          <div className="h-3 bg-card-border/50 rounded w-2/3 mb-2" />
          <div className="h-3 bg-card-border/50 rounded w-full mb-2" />
          <div className="h-8 bg-card-border/30 rounded w-full mt-3" />
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Section header
// ============================================================

function LeadSectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-accent/10 mt-0.5">
          <Icon size={16} className="text-accent" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-muted mt-0.5">{subtitle}</p>
        </div>
      </div>
      <span className="text-[10px] font-mono bg-accent/10 text-accent px-2 py-0.5 rounded-full">
        LIVE
      </span>
    </div>
  );
}

// ============================================================
// Page
// ============================================================

export const metadata: Metadata = {
  title: "Real Estate Prospect Leads — Alberta",
  description:
    "Province-wide data-driven real estate leads organized by signal strength — permit activity, assessment changes, and neighbourhood momentum.",
};

export default function ProspectsPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-6 print:p-2 print:space-y-4">
      {/* Header */}
      <header>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Target size={20} className="text-accent" />
            <h1 className="text-xl font-semibold tracking-tight">
              Prospect Leads
            </h1>
          </div>
          <PrintButton />
        </div>
        <p className="text-sm text-muted">
          Province-wide data-driven leads across Alberta. Every lead includes a
          specific address or location, why it matters, and what to do about it.
          Updated live from Edmonton, Calgary, and 20+ municipal data sources.
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/15">
            <Flame size={10} /> HOT = act this week
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/15">
            <TrendingUp size={10} /> WARM = add to campaign
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/15">
            <Eye size={10} /> WATCH = monitor
          </span>
        </div>
      </header>

      {/* Section 1: Equity Gold */}
      <section>
        <Card>
          <LeadSectionHeader
            icon={DollarSign}
            title="Sellers Sitting on Gold"
            subtitle="Alberta-wide — homes worth way more than what they paid"
          />
          <Suspense fallback={<SectionLoading />}>
            <EquityGoldSection />
          </Suspense>
        </Card>
      </section>

      {/* Section 2: Teardown Targets */}
      <section>
        <Card>
          <LeadSectionHeader
            icon={Building2}
            title="Teardown & Redevelopment Targets"
            subtitle="Edmonton + Calgary — addresses in active redevelopment zones"
          />
          <Suspense fallback={<SectionLoading />}>
            <TeardownSection />
          </Suspense>
        </Card>
      </section>

      {/* Section 3: Vacant Lots */}
      <section>
        <Card>
          <LeadSectionHeader
            icon={MapPin}
            title="Vacant Lot Opportunities"
            subtitle="Alberta-wide — ready-to-build lots from municipal registries"
          />
          <Suspense fallback={<SectionLoading />}>
            <VacantLotSection />
          </Suspense>
        </Card>
      </section>

      {/* Section 4: Just Renovated */}
      <section>
        <Card>
          <LeadSectionHeader
            icon={Wrench}
            title="Just Renovated"
            subtitle="Edmonton + Calgary — major renovation permits ($50K+) recently filed"
          />
          <Suspense fallback={<SectionLoading />}>
            <RenovationSection />
          </Suspense>
        </Card>
      </section>

      {/* Section 5: New Neighbourhoods */}
      <section>
        <Card>
          <LeadSectionHeader
            icon={TreePine}
            title="New Neighbourhood Watch"
            subtitle="Fresh developments where buyers need agents"
          />
          <Suspense fallback={<SectionLoading />}>
            <NewNeighbourhoodSection />
          </Suspense>
        </Card>
      </section>

      {/* Section 6: Dev Permit Surge */}
      <section>
        <Card>
          <LeadSectionHeader
            icon={FileText}
            title="Development Permit Surge"
            subtitle="Strathcona, St. Albert, Banff, Sylvan Lake + more — permit hotspots"
          />
          <Suspense fallback={<SectionLoading />}>
            <DevPermitSurgeSection />
          </Suspense>
        </Card>
      </section>

      {/* Footer */}
      <Card className="text-center print:hidden">
        <p className="text-[10px] text-muted leading-relaxed">
          All leads generated from live municipal data: Edmonton SODA, Calgary
          Socrata, and ArcGIS endpoints for 20+ Alberta municipalities. Refreshes
          hourly. Lead scoring is based on permit activity, assessment gaps,
          redevelopment signals, and development stage data.
        </p>
      </Card>

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8 print:hidden">
        Alberta Pulse Check &mdash; Province-wide Prospect Leads &mdash; Built
        for realtors
      </footer>
    </main>
  );
}
