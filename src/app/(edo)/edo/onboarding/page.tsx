"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, Search, Check, ArrowRight, Loader2, MapPin } from "lucide-react";
import { Activity } from "lucide-react";

// Static list to avoid server/client mismatch — mirrors municipality-registry
const MUNICIPALITIES = [
  { slug: "edmonton", name: "Edmonton", region: "Edmonton Metro", population: 1010899 },
  { slug: "calgary", name: "Calgary", region: "Calgary Metro", population: 1306784 },
  { slug: "red-deer", name: "Red Deer", region: "Central Alberta", population: 100844 },
  { slug: "lethbridge", name: "Lethbridge", region: "Southern Alberta", population: 101482 },
  { slug: "medicine-hat", name: "Medicine Hat", region: "Southern Alberta", population: 63271 },
  { slug: "grande-prairie", name: "Grande Prairie", region: "Northern Alberta", population: 64141 },
  { slug: "st-albert", name: "St. Albert", region: "Edmonton Metro", population: 72296 },
  { slug: "airdrie", name: "Airdrie", region: "Calgary Metro", population: 73698 },
  { slug: "spruce-grove", name: "Spruce Grove", region: "Edmonton Metro", population: 38268 },
  { slug: "leduc", name: "Leduc", region: "Edmonton Metro", population: 34091 },
  { slug: "stony-plain", name: "Stony Plain", region: "Edmonton Metro", population: 18289 },
  { slug: "beaumont", name: "Beaumont", region: "Edmonton Metro", population: 21773 },
  { slug: "fort-saskatchewan", name: "Fort Saskatchewan", region: "Edmonton Metro", population: 27082 },
  { slug: "morinville", name: "Morinville", region: "Edmonton Metro", population: 10185 },
  { slug: "devon", name: "Devon", region: "Edmonton Metro", population: 6913 },
  { slug: "strathcona-county", name: "Strathcona County", region: "Edmonton Metro", population: 101116 },
  { slug: "parkland-county", name: "Parkland County", region: "Edmonton Metro", population: 32491 },
  { slug: "sturgeon-county", name: "Sturgeon County", region: "Edmonton Metro", population: 21645 },
  { slug: "leduc-county", name: "Leduc County", region: "Edmonton Metro", population: 14107 },
  { slug: "cochrane", name: "Cochrane", region: "Calgary Metro", population: 36068 },
  { slug: "chestermere", name: "Chestermere", region: "Calgary Metro", population: 23535 },
  { slug: "okotoks", name: "Okotoks", region: "Calgary Metro", population: 32523 },
  { slug: "canmore", name: "Canmore", region: "Southern Alberta", population: 15990 },
  { slug: "banff", name: "Banff", region: "Southern Alberta", population: 8305 },
  { slug: "camrose", name: "Camrose", region: "Central Alberta", population: 18895 },
  { slug: "lloydminster", name: "Lloydminster", region: "Central Alberta", population: 31483 },
  { slug: "strathmore", name: "Strathmore", region: "Calgary Metro", population: 14339 },
  { slug: "sylvan-lake", name: "Sylvan Lake", region: "Central Alberta", population: 16121 },
  { slug: "brooks", name: "Brooks", region: "Southern Alberta", population: 14924 },
  { slug: "wood-buffalo", name: "Wood Buffalo (Fort McMurray)", region: "Northern Alberta", population: 75637 },
];

export default function EdoOnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-muted" size={24} /></div>}>
      <EdoOnboardingContent />
    </Suspense>
  );
}

function EdoOnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const success = searchParams.get("success");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = search
    ? MUNICIPALITIES.filter(
        (m) =>
          m.name.toLowerCase().includes(search.toLowerCase()) ||
          m.region.toLowerCase().includes(search.toLowerCase())
      )
    : MUNICIPALITIES;

  async function handleContinue() {
    if (!selected) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/edo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "bind-municipality", municipalityId: selected }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to bind municipality");
        setLoading(false);
        return;
      }

      // Force session refresh to pick up new municipalityId
      router.push("/edo");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            <Activity size={24} className="text-indigo-400" />
            <span className="text-lg font-bold">Pulse EDO</span>
          </div>
          {success && (
            <div className="bg-accent-green/10 text-accent-green text-sm px-4 py-2 rounded-lg">
              Payment successful! Now select your municipality.
            </div>
          )}
          <h1 className="text-2xl font-bold">Select your municipality</h1>
          <p className="text-muted text-sm">
            Your EDO dashboard will be configured for this municipality.
            You can change this later in Settings.
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search municipalities..."
            className="w-full pl-10 pr-4 py-2.5 bg-card border border-card-border rounded-lg text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          />
        </div>

        {/* Municipality list */}
        <div className="bg-card border border-card-border rounded-xl overflow-hidden max-h-80 overflow-y-auto">
          {filtered.map((m) => (
            <button
              key={m.slug}
              onClick={() => setSelected(m.slug)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-card-border/50 last:border-b-0 transition-colors ${
                selected === m.slug
                  ? "bg-indigo-500/10"
                  : "hover:bg-card-border/20"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  selected === m.slug
                    ? "border-indigo-400 bg-indigo-400"
                    : "border-card-border"
                }`}
              >
                {selected === m.slug && <Check size={12} className="text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Building2 size={14} className="text-muted shrink-0" />
                  <span className="text-sm font-medium">{m.name}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <MapPin size={10} className="text-muted/60 shrink-0" />
                  <span className="text-xs text-muted">
                    {m.region} · Pop. {m.population.toLocaleString()}
                  </span>
                </div>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted">
              No municipalities match &ldquo;{search}&rdquo;
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-accent-red/10 text-accent-red text-sm px-4 py-2 rounded-lg">
            {error}
          </div>
        )}

        {/* Continue */}
        <button
          onClick={handleContinue}
          disabled={!selected || loading}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-500 text-white rounded-lg font-semibold hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <>
              Continue
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </div>
    </main>
  );
}
