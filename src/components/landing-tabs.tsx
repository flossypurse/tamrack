"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Building2,
  GraduationCap,
  Home,
  TrendingUp,
  FileText,
  Bell,
  MapPin,
  Users,
} from "lucide-react";

interface LandingTabsProps {
  chartCount: number;
  municipalityCount: number;
}

const tabs = [
  {
    id: "browse",
    label: "Browse",
    icon: BarChart3,
    headline: "Free charts for everyone",
    description:
      "Browse live economic data across economy, real estate, community, and environment — updated hourly from government APIs.",
    outcomes: [
      { icon: TrendingUp, text: "Track interest rates, employment, GDP, and housing starts" },
      { icon: MapPin, text: "Drill into any of Alberta's municipalities" },
      { icon: FileText, text: "Embed or share any chart — no account required" },
    ],
    cta: { label: "Browse charts", href: "/charts" },
    accent: "text-accent",
    accentBg: "bg-accent/10",
    accentBorder: "border-accent/20",
  },
  {
    id: "sell",
    label: "Real Estate",
    icon: Home,
    headline: "Market intel that closes deals",
    description:
      "Development permits, neighbourhood snapshots, and branded market reports — built for how real estate professionals actually work.",
    outcomes: [
      { icon: Bell, text: "Get alerted when new permits hit your area" },
      { icon: MapPin, text: "Neighbourhood deep-dives for any listing" },
      { icon: FileText, text: "Client-ready PDF reports in one click" },
    ],
    cta: { label: "Get started — $49/mo", href: "/subscribe?plan=realtor" },
    accent: "text-teal-400",
    accentBg: "bg-teal-500/10",
    accentBorder: "border-teal-500/20",
    price: "$49/mo per seat",
  },
  {
    id: "govern",
    label: "EDOs",
    icon: Building2,
    headline: "Data-driven community profiles",
    description:
      "Peer comparison across 25+ indicators, trend alerts, council-ready reports, and investment pitch kits — generated from live data.",
    outcomes: [
      { icon: Users, text: "Compare your municipality against peers" },
      { icon: Bell, text: "Get alerted when your indicators shift" },
      { icon: FileText, text: "Export PDF reports ready for council" },
    ],
    cta: { label: "Get started", href: "/edo/onboarding" },
    accent: "text-indigo-400",
    accentBg: "bg-indigo-500/10",
    accentBorder: "border-indigo-500/20",
    price: "$299/mo per municipality",
  },
  {
    id: "learn",
    label: "Learn",
    icon: GraduationCap,
    headline: "Understand Alberta's economy",
    description:
      "Eight interactive modules covering energy, housing, tax, immigration, and more — with quizzes, live charts, and a certificate.",
    outcomes: [
      { icon: BarChart3, text: "8 modules, 35+ lessons built on real data" },
      { icon: TrendingUp, text: "Interactive quizzes with live charts" },
      { icon: FileText, text: "Earn a shareable certificate of completion" },
    ],
    cta: { label: "Start learning — free", href: "/learn" },
    accent: "text-accent-green",
    accentBg: "bg-accent-green/10",
    accentBorder: "border-accent-green/20",
  },
];

export function LandingTabs({ chartCount, municipalityCount }: LandingTabsProps) {
  const [active, setActive] = useState("browse");
  const tab = tabs.find((t) => t.id === active)!;
  const TabIcon = tab.icon;

  return (
    <div>
      {/* Tab buttons */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex bg-card border border-card-border rounded-2xl p-1 gap-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = t.id === active;
            return (
              <button
                key={t.id}
                onClick={() => setActive(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-accent text-white shadow-sm"
                    : "text-muted hover:text-foreground hover:bg-card-border/30"
                }`}
              >
                <Icon size={16} />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="bg-card border border-card-border rounded-2xl p-8 sm:p-10">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          {/* Left: copy */}
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${tab.accentBg} flex items-center justify-center`}>
                <TabIcon size={20} className={tab.accent} />
              </div>
              <div>
                <h3 className="text-xl font-bold">{tab.headline}</h3>
                {tab.price && (
                  <p className="text-sm text-muted">{tab.price}</p>
                )}
              </div>
            </div>

            <p className="text-muted leading-relaxed">{tab.description}</p>

            <Link
              href={tab.cta.href}
              className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-colors text-sm ${
                tab.id === "browse"
                  ? "bg-accent text-white hover:bg-accent-hover shadow-lg shadow-accent/20"
                  : `border ${tab.accentBorder} ${tab.accent} hover:${tab.accentBg}`
              }`}
            >
              {tab.cta.label}
              <ArrowRight size={15} />
            </Link>
          </div>

          {/* Right: outcome cards */}
          <div className="space-y-3">
            {tab.outcomes.map((outcome, i) => {
              const OutcomeIcon = outcome.icon;
              return (
                <div
                  key={i}
                  className={`flex items-start gap-3 p-4 rounded-xl border ${tab.accentBorder} bg-background/50`}
                >
                  <div className={`mt-0.5 ${tab.accent}`}>
                    <OutcomeIcon size={18} />
                  </div>
                  <p className="text-sm leading-relaxed">{outcome.text}</p>
                </div>
              );
            })}

            {tab.id === "browse" && (
              <p className="text-xs text-muted/60 text-center pt-2">
                {chartCount}+ charts across {municipalityCount} municipalities
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
