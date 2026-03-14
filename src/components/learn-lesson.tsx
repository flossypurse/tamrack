"use client";

import { useState } from "react";
import {
  ArrowRight,
  ArrowDown,
  Clock,
  Lightbulb,
  Eye,
  Wrench,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
} from "lucide-react";

// ============================================================
// Narrative Prose Block
// ============================================================

export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-sm text-foreground/85 leading-relaxed space-y-3">
      {children}
    </div>
  );
}

// ============================================================
// "Big Question" — opens each lesson
// ============================================================

export function BigQuestion({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-6 px-4 text-center">
      <p className="text-lg sm:text-xl font-medium text-foreground leading-snug italic">
        &ldquo;{children}&rdquo;
      </p>
    </div>
  );
}

// ============================================================
// Chain Step — one link in a cause-effect chain
// ============================================================

interface ChainStepProps {
  number: number;
  title: string;
  description: string;
  timeLag?: string;
  children?: React.ReactNode; // slot for live data
}

export function ChainStep({
  number,
  title,
  description,
  timeLag,
  children,
}: ChainStepProps) {
  return (
    <div className="relative">
      {/* Connector arrow */}
      {number > 1 && (
        <div className="flex justify-center -mt-1 mb-1">
          <ArrowDown size={16} className="text-accent/40" />
        </div>
      )}
      <div className="border border-card-border rounded-lg p-4 bg-card">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-7 h-7 rounded-full bg-accent/15 text-accent flex items-center justify-center text-xs font-bold">
            {number}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-medium text-foreground">{title}</h4>
              {timeLag && (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted bg-foreground/[0.05] rounded-full px-2 py-0.5">
                  <Clock size={10} />
                  {timeLag}
                </span>
              )}
            </div>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              {description}
            </p>
            {children && <div className="mt-3">{children}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Live Data Point — inline metric with source
// ============================================================

interface LiveDataPointProps {
  label: string;
  value: string | number;
  change?: string;
  direction?: "up" | "down" | "flat";
  source?: string;
}

export function LiveDataPoint({
  label,
  value,
  change,
  direction,
  source,
}: LiveDataPointProps) {
  const dirIcon = {
    up: <TrendingUp size={12} className="text-accent-green" />,
    down: <TrendingDown size={12} className="text-accent-red" />,
    flat: <Minus size={12} className="text-muted" />,
  };

  return (
    <div className="inline-flex items-center gap-3 bg-foreground/[0.03] border border-card-border rounded-lg px-3 py-2">
      <div>
        <p className="text-[10px] text-muted uppercase tracking-wider">
          {label}
        </p>
        <div className="flex items-center gap-1.5">
          <span className="text-base font-semibold tracking-tight">
            {value}
          </span>
          {direction && dirIcon[direction]}
          {change && (
            <span
              className={`text-xs ${
                direction === "up"
                  ? "text-accent-green"
                  : direction === "down"
                  ? "text-accent-red"
                  : "text-muted"
              }`}
            >
              {change}
            </span>
          )}
        </div>
      </div>
      {source && (
        <span className="text-[9px] text-muted/50 border-l border-card-border pl-2">
          {source}
        </span>
      )}
    </div>
  );
}

// ============================================================
// Insight Callout — "why this matters"
// ============================================================

type InsightVariant = "insight" | "lever" | "watch" | "warning";

const insightStyles: Record<
  InsightVariant,
  { icon: React.ElementType; border: string; bg: string; label: string }
> = {
  insight: {
    icon: Lightbulb,
    border: "border-accent/20",
    bg: "bg-accent/5",
    label: "Why This Matters",
  },
  lever: {
    icon: Wrench,
    border: "border-accent-green/20",
    bg: "bg-accent-green/5",
    label: "The Lever",
  },
  watch: {
    icon: Eye,
    border: "border-accent-amber/20",
    bg: "bg-accent-amber/5",
    label: "Watch This Signal",
  },
  warning: {
    icon: AlertTriangle,
    border: "border-accent-red/20",
    bg: "bg-accent-red/5",
    label: "Common Misconception",
  },
};

export function Insight({
  variant = "insight",
  title,
  children,
}: {
  variant?: InsightVariant;
  title?: string;
  children: React.ReactNode;
}) {
  const style = insightStyles[variant];
  const Icon = style.icon;

  return (
    <div className={`border ${style.border} ${style.bg} rounded-lg p-4`}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon size={14} className="text-foreground/60" />
        <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/60">
          {title || style.label}
        </span>
      </div>
      <div className="text-sm text-foreground/85 leading-relaxed">
        {children}
      </div>
    </div>
  );
}

// ============================================================
// Expandable Section — for optional deep dives
// ============================================================

export function Expandable({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-card-border rounded-lg">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-foreground hover:bg-foreground/[0.03] transition-colors rounded-lg"
      >
        {open ? (
          <ChevronDown size={14} className="text-muted" />
        ) : (
          <ChevronRight size={14} className="text-muted" />
        )}
        {title}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-0 border-t border-card-border">
          <div className="pt-3">{children}</div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Lesson Section — groups content with a heading
// ============================================================

export function LessonSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h3 className="text-base font-semibold text-foreground border-b border-card-border pb-2">
        {title}
      </h3>
      {children}
    </section>
  );
}

// ============================================================
// Lesson Nav — previous/next between lessons
// ============================================================

interface LessonNavProps {
  prev?: { href: string; label: string };
  next?: { href: string; label: string };
}

export function LessonNav({ prev, next }: LessonNavProps) {
  return (
    <div className="flex items-center justify-between pt-6 border-t border-card-border">
      {prev ? (
        <a
          href={prev.href}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-accent transition-colors"
        >
          <ArrowRight size={14} className="rotate-180" />
          {prev.label}
        </a>
      ) : (
        <div />
      )}
      {next ? (
        <a
          href={next.href}
          className="flex items-center gap-1.5 text-sm text-accent hover:text-accent/80 transition-colors font-medium"
        >
          {next.label}
          <ArrowRight size={14} />
        </a>
      ) : (
        <div />
      )}
    </div>
  );
}

// ============================================================
// Data Grid — show multiple metrics in a row
// ============================================================

export function DataGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-2">{children}</div>
  );
}

// ============================================================
// "So What?" Summary — end of each section
// ============================================================

export function SoWhat({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-foreground/[0.03] border border-card-border rounded-lg p-4">
      <p className="text-[10px] font-medium uppercase tracking-wider text-accent mb-1">
        So What Does This Mean For You?
      </p>
      <div className="text-sm text-foreground/85 leading-relaxed">
        {children}
      </div>
    </div>
  );
}
