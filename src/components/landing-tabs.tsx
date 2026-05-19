"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  GraduationCap,
  TrendingUp,
  FileText,
  MapPin,
} from "lucide-react";

interface LandingTabsProps {
  chartCount: number;
  municipalityCount: number;
}

// EDO + Real Estate tabs removed 2026-05-18 (sunset to new signups). Landing
// surfaces only the free products until Tamrack ships.
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
    accent: "text-[var(--ink)]",
    accentBg: "bg-[var(--surface-elevated)]",
    accentBorder: "border-[var(--border)]",
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
    accent: "text-[var(--counter)]",
    accentBg: "bg-[var(--counter)]/10",
    accentBorder: "border-[var(--counter)]/30",
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
        <div className="inline-flex bg-[var(--surface-elevated)] border border-[var(--border)] p-1 gap-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = t.id === active;
            return (
              <button
                key={t.id}
                onClick={() => setActive(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[var(--amber)] text-[var(--ink)]"
                    : "text-[var(--mid)] hover:text-[var(--ink)] hover:bg-[var(--border)]/40"
                }`}
                style={{ transitionDuration: "var(--dur-instant)" }}
              >
                <Icon size={16} />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="bg-[var(--surface-elevated)] border border-[var(--border)] p-8 sm:p-10">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          {/* Left: copy */}
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 ${tab.accentBg} border ${tab.accentBorder} flex items-center justify-center`}>
                <TabIcon size={20} className={tab.accent} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[var(--ink)]">{tab.headline}</h3>
              </div>
            </div>

            <p className="text-[var(--mid)] leading-relaxed">{tab.description}</p>

            <Link
              href={tab.cta.href}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--ink)] text-[var(--ink-inv)] font-medium hover:bg-[var(--amber)] hover:text-[var(--ink)] transition-colors text-sm"
              style={{ transitionDuration: "var(--dur-instant)" }}
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
                  className={`flex items-start gap-3 p-4 border ${tab.accentBorder} bg-[var(--surface)]`}
                >
                  <div className={`mt-0.5 ${tab.accent}`}>
                    <OutcomeIcon size={18} />
                  </div>
                  <p className="text-sm leading-relaxed text-[var(--ink)]">{outcome.text}</p>
                </div>
              );
            })}

            {tab.id === "browse" && (
              <p className="text-xs text-[var(--mid)]/70 text-center pt-2">
                {chartCount}+ charts across {municipalityCount} municipalities
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
