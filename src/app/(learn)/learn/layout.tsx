"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MapPin,
  Flame,
  Home,
  Landmark,
  Users,
  TrendingUp,
  Wrench,
  Shield,
  GraduationCap,
  ChevronRight,
  ChevronDown,
  Award,
  BookOpen,
  CheckCircle2,
  Lock,
  Menu,
  X,
} from "lucide-react";
import { useState, useEffect, type ElementType, type ReactNode } from "react";
import { COURSE_MODULES } from "@/lib/learn-course";
import {
  loadProgress,
  getOverallProgress,
  isModuleComplete,
  isModuleUnlocked,
  type CourseProgress,
} from "@/lib/learn-progress";

// ============================================================
// Icon mapping
// ============================================================

const ICON_MAP: Record<string, ElementType> = {
  MapPin,
  Flame,
  Home,
  Landmark,
  Users,
  TrendingUp,
  Wrench,
  Shield,
};

// ============================================================
// Progress bar
// ============================================================

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="w-full h-2 bg-card-border rounded-full overflow-hidden">
      <div
        className="h-full bg-amber-500 rounded-full transition-all duration-500 ease-out"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

// ============================================================
// Sidebar module list
// ============================================================

function LearnSidebar({ progress }: { progress: CourseProgress }) {
  const pathname = usePathname();
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const overallPercent = getOverallProgress(progress);

  // Auto-expand the active module
  useEffect(() => {
    for (const mod of COURSE_MODULES) {
      if (pathname.startsWith(`/learn/${mod.slug}`)) {
        setExpandedModule(mod.slug);
        break;
      }
    }
  }, [pathname]);

  return (
    <aside className="hidden lg:flex flex-col w-60 fixed top-12 bottom-0 left-0 border-r border-card-border bg-background z-30">
      {/* Progress header */}
      <div className="p-4 border-b border-card-border">
        <div className="flex items-center justify-between text-xs text-muted mb-2">
          <span>Course Progress</span>
          <span className="font-medium text-amber-500">{overallPercent}%</span>
        </div>
        <ProgressBar percent={overallPercent} />
      </div>

      {/* Module list */}
      <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto">
        {COURSE_MODULES.map((mod) => {
          const Icon = ICON_MAP[mod.icon] || BookOpen;
          const isActive = pathname.startsWith(`/learn/${mod.slug}`);
          const isExpanded = expandedModule === mod.slug;
          const complete = isModuleComplete(progress, mod.slug);
          const unlocked = isModuleUnlocked(progress, mod.slug);

          return (
            <div key={mod.slug}>
              <button
                onClick={() => setExpandedModule(isExpanded ? null : mod.slug)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-amber-500/10 text-amber-500 font-medium"
                    : unlocked
                    ? "text-muted hover:text-foreground hover:bg-card-border/30"
                    : "text-muted/40"
                }`}
              >
                <div className="relative shrink-0">
                  <Icon size={16} />
                  {complete && (
                    <CheckCircle2
                      size={10}
                      className="absolute -top-1 -right-1 text-green-500"
                    />
                  )}
                  {!unlocked && (
                    <Lock
                      size={8}
                      className="absolute -bottom-0.5 -right-0.5 text-muted/40"
                    />
                  )}
                </div>
                <span className="flex-1 text-left truncate">
                  {mod.id}. {mod.title}
                </span>
                {isExpanded ? (
                  <ChevronDown size={12} className="shrink-0" />
                ) : (
                  <ChevronRight size={12} className="shrink-0" />
                )}
              </button>

              {/* Lesson sub-items */}
              {isExpanded && (
                <div className="ml-5 pl-3 border-l border-card-border/50 space-y-0.5 py-1">
                  {mod.lessons.map((lesson) => {
                    const lessonPath = `/learn/${mod.slug}/${lesson.slug}`;
                    const isLessonActive = pathname === lessonPath;
                    const lessonComplete =
                      progress.modules[mod.slug]?.lessons[lesson.slug]?.completed;

                    return (
                      <Link
                        key={lesson.slug}
                        href={unlocked ? lessonPath : "#"}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                          isLessonActive
                            ? "text-amber-500 font-medium bg-amber-500/5"
                            : unlocked
                            ? "text-muted hover:text-foreground"
                            : "text-muted/30 pointer-events-none"
                        }`}
                      >
                        {lessonComplete ? (
                          <CheckCircle2 size={11} className="text-green-500 shrink-0" />
                        ) : (
                          <div className="w-[11px] h-[11px] rounded-full border border-card-border shrink-0" />
                        )}
                        <span className="truncate">{lesson.title}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Certificate link */}
      <div className="border-t border-card-border p-3">
        <Link
          href="/learn/certificate"
          className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted hover:text-foreground transition-colors"
        >
          <Award size={14} />
          Certificate
          <ChevronRight size={12} className="ml-auto" />
        </Link>
      </div>
    </aside>
  );
}

// ============================================================
// Top bar
// ============================================================

function LearnTopBar({
  progress,
  onMenuToggle,
  menuOpen,
}: {
  progress: CourseProgress;
  onMenuToggle: () => void;
  menuOpen: boolean;
}) {
  const overallPercent = getOverallProgress(progress);

  return (
    <header className="fixed top-0 left-0 right-0 h-12 bg-background/95 backdrop-blur-sm border-b border-card-border z-40 flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-1.5 text-muted hover:text-foreground transition-colors"
        >
          {menuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
        <Link href="/learn" className="flex items-center gap-2">
          <GraduationCap size={18} className="text-amber-500" />
          <span className="font-semibold text-sm">Tamrack Learn</span>
        </Link>
        <span className="text-muted/40 hidden sm:inline">|</span>
        <span className="text-xs text-muted hidden sm:inline">
          Alberta Economic Literacy
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2">
          <div className="w-24">
            <ProgressBar percent={overallPercent} />
          </div>
          <span className="text-[10px] font-mono text-amber-500">
            {overallPercent}%
          </span>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 bg-amber-500/10 text-amber-500 rounded-full">
          FREE
        </span>
        <Link
          href="/"
          className="text-xs text-muted hover:text-foreground transition-colors"
        >
          Back to Tamrack
        </Link>
      </div>
    </header>
  );
}

// ============================================================
// Mobile nav
// ============================================================

function LearnMobileNav({ progress }: { progress: CourseProgress }) {
  const pathname = usePathname();

  // Show first 5 modules as bottom tabs
  const tabs = COURSE_MODULES.slice(0, 5).map((mod) => ({
    href: `/learn/${mod.slug}/${mod.lessons[0].slug}`,
    label: mod.title.split(" ").pop() || mod.title,
    icon: ICON_MAP[mod.icon] || BookOpen,
    active: pathname.startsWith(`/learn/${mod.slug}`),
    complete: isModuleComplete(progress, mod.slug),
  }));

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-14 bg-background/95 backdrop-blur-sm border-t border-card-border z-40 flex items-center justify-around px-2">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] transition-colors ${
              tab.active ? "text-amber-500" : "text-muted"
            }`}
          >
            <div className="relative">
              <Icon size={18} />
              {tab.complete && (
                <CheckCircle2 size={8} className="absolute -top-1 -right-1 text-green-500" />
              )}
            </div>
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// ============================================================
// Mobile sidebar overlay
// ============================================================

function MobileSidebarOverlay({
  progress,
  open,
  onClose,
}: {
  progress: CourseProgress;
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <>
      <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="lg:hidden fixed top-12 left-0 bottom-0 w-72 bg-background border-r border-card-border z-50 overflow-y-auto">
        <LearnSidebar progress={progress} />
      </div>
    </>
  );
}

// ============================================================
// Layout
// ============================================================

export default function LearnLayout({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<CourseProgress>({
    modules: {},
    startedAt: new Date().toISOString(),
  });
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setProgress(loadProgress());
    // Re-check on storage events (in case another tab updates)
    const onStorage = () => setProgress(loadProgress());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Close mobile menu on navigation
  const pathname = usePathname();
  useEffect(() => {
    setMenuOpen(false);
    // Refresh progress on navigation (quiz might have been completed)
    setProgress(loadProgress());
  }, [pathname]);

  return (
    <>
      <LearnTopBar
        progress={progress}
        onMenuToggle={() => setMenuOpen(!menuOpen)}
        menuOpen={menuOpen}
      />
      <div className="hidden lg:block">
        <LearnSidebar progress={progress} />
      </div>
      <MobileSidebarOverlay
        progress={progress}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />

      {/* Desktop: top bar spacer */}
      <div className="hidden lg:block h-12" />
      {/* Mobile: top bar spacer */}
      <div className="lg:hidden h-[52px]" />

      {/* Content area */}
      <div className="lg:pl-60 transition-[padding-left] duration-200">
        {children}
      </div>

      {/* Mobile: bottom nav spacer */}
      <div className="lg:hidden h-14" />
      <LearnMobileNav progress={progress} />
    </>
  );
}
