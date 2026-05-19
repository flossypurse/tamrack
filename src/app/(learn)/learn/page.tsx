"use client";

import Link from "next/link";
import {
  GraduationCap,
  MapPin,
  Flame,
  Home,
  Landmark,
  Users,
  TrendingUp,
  Wrench,
  Shield,
  ArrowRight,
  CheckCircle2,
  Lock,
  BookOpen,
  Award,
  PlayCircle,
} from "lucide-react";
import { useState, useEffect, type ElementType } from "react";
import { COURSE_MODULES } from "@/lib/learn-course";
import {
  loadProgress,
  getOverallProgress,
  isModuleComplete,
  isModuleUnlocked,
  isCourseComplete,
  getResumePoint,
  type CourseProgress,
} from "@/lib/learn-progress";

const ICON_MAP: Record<string, ElementType> = {
  MapPin, Flame, Home, Landmark, Users, TrendingUp, Wrench, Shield,
};

function ModuleCard({
  mod,
  progress,
}: {
  mod: (typeof COURSE_MODULES)[number];
  progress: CourseProgress;
}) {
  const Icon = ICON_MAP[mod.icon] || BookOpen;
  const complete = isModuleComplete(progress, mod.slug);
  const unlocked = isModuleUnlocked(progress, mod.slug);
  const mp = progress.modules[mod.slug];
  const completedLessons = mp
    ? mod.lessons.filter((l) => mp.lessons[l.slug]?.completed).length
    : 0;
  const quizPassed = mp?.quiz?.passed ?? false;

  return (
    <div
      className={`border rounded-lg p-5 transition-all ${
        complete
          ? "border-green-500/30 bg-green-500/[0.03]"
          : unlocked
          ? "border-card-border hover:border-amber-500/30 hover:bg-amber-500/[0.02]"
          : "border-card-border/50 opacity-50"
      }`}
    >
      <div className="flex items-start gap-3 mb-3">
        <div
          className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${mod.color}15`, color: mod.color }}
        >
          <Icon size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted font-mono">
              MODULE {mod.id}
            </span>
            {complete && <CheckCircle2 size={12} className="text-green-500" />}
            {!unlocked && <Lock size={12} className="text-muted/40" />}
          </div>
          <h3 className="text-sm font-semibold text-foreground">{mod.title}</h3>
        </div>
      </div>

      <p className="text-xs text-muted leading-relaxed mb-3">
        {mod.description}
      </p>

      {/* Lesson progress */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-1.5 bg-card-border rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${(completedLessons / mod.lessons.length) * 100}%`,
              backgroundColor: mod.color,
            }}
          />
        </div>
        <span className="text-[10px] text-muted shrink-0">
          {completedLessons}/{mod.lessons.length}
        </span>
      </div>

      {/* Lesson list */}
      <div className="space-y-1 mb-4">
        {mod.lessons.map((lesson) => {
          const lessonComplete = mp?.lessons[lesson.slug]?.completed;
          return (
            <div key={lesson.slug} className="flex items-center gap-2 text-xs">
              {lessonComplete ? (
                <CheckCircle2 size={10} className="text-green-500 shrink-0" />
              ) : (
                <div className="w-[10px] h-[10px] rounded-full border border-card-border shrink-0" />
              )}
              <span className={lessonComplete ? "text-muted line-through" : "text-foreground/70"}>
                {lesson.title}
              </span>
            </div>
          );
        })}
      </div>

      {/* Quiz status */}
      {quizPassed && (
        <div className="text-[10px] text-green-500 flex items-center gap-1 mb-3">
          <CheckCircle2 size={10} />
          Quiz passed ({mp?.quiz?.score}%)
        </div>
      )}

      {/* Action */}
      {unlocked && (
        <Link
          href={`/learn/${mod.slug}/${mod.lessons[0].slug}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
          style={{ color: mod.color }}
        >
          {complete ? "Review" : completedLessons > 0 ? "Continue" : "Start"}
          <ArrowRight size={12} />
        </Link>
      )}
    </div>
  );
}

export default function LearnHubPage() {
  const [progress, setProgress] = useState<CourseProgress>({
    modules: {},
    startedAt: new Date().toISOString(),
  });

  useEffect(() => {
    setProgress(loadProgress());
  }, []);

  const overallPercent = getOverallProgress(progress);
  const courseComplete = isCourseComplete(progress);
  const resume = getResumePoint(progress);

  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-5xl mx-auto space-y-8">
      {/* Hero */}
      <div className="text-center space-y-3 py-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 text-amber-500 rounded-full text-xs font-medium">
          <GraduationCap size={14} />
          FREE COURSE
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
          Alberta Economic Literacy
        </h1>
        <p className="text-sm text-muted max-w-xl mx-auto leading-relaxed">
          8 modules. Live data. Real Alberta economics — not theory. Understand the
          patterns that shape your community, from energy prices to your rent cheque.
        </p>
      </div>

      {/* Resume / Progress */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        {overallPercent > 0 && !courseComplete && (
          <Link
            href={`/learn/${resume.moduleSlug}/${resume.lessonSlug}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 text-black hover:bg-amber-400 transition-colors font-medium text-sm"
          >
            <PlayCircle size={16} />
            Resume ({overallPercent}% complete)
          </Link>
        )}
        {overallPercent === 0 && (
          <Link
            href={`/learn/${COURSE_MODULES[0].slug}/${COURSE_MODULES[0].lessons[0].slug}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 text-black hover:bg-amber-400 transition-colors font-medium text-sm"
          >
            <PlayCircle size={16} />
            Start Learning
          </Link>
        )}
        {courseComplete && (
          <Link
            href="/learn/certificate"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 text-black hover:bg-amber-400 transition-colors font-medium text-sm"
          >
            <Award size={16} />
            Get Your Certificate
          </Link>
        )}
      </div>

      {/* Module Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {COURSE_MODULES.map((mod) => (
          <ModuleCard key={mod.slug} mod={mod} progress={progress} />
        ))}
      </div>

      {/* What you'll learn */}
      <div className="border border-card-border rounded-lg p-5 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">What You&apos;ll Learn</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted">
          <div className="flex items-start gap-2">
            <CheckCircle2 size={12} className="text-amber-500 mt-0.5 shrink-0" />
            <span>How energy prices drive Alberta&apos;s entire economy</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 size={12} className="text-amber-500 mt-0.5 shrink-0" />
            <span>The housing machine: from BoC rates to your rent</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 size={12} className="text-amber-500 mt-0.5 shrink-0" />
            <span>Where your tax dollars actually go</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 size={12} className="text-amber-500 mt-0.5 shrink-0" />
            <span>How to read leading vs lagging indicators</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 size={12} className="text-amber-500 mt-0.5 shrink-0" />
            <span>Immigration, labour markets, and demographics</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 size={12} className="text-amber-500 mt-0.5 shrink-0" />
            <span>What your municipality can actually change</span>
          </div>
        </div>
      </div>

      {/* Certificate teaser */}
      <div className="text-center border border-amber-500/20 bg-amber-500/[0.03] rounded-lg p-6 space-y-2">
        <Award size={32} className="text-amber-500 mx-auto" />
        <h2 className="text-sm font-semibold text-foreground">
          Alberta Economic Literacy Certificate
        </h2>
        <p className="text-xs text-muted max-w-md mx-auto">
          Complete all 8 modules with passing quiz scores to earn a shareable PDF
          certificate. Prove you understand the data behind Alberta&apos;s economy.
        </p>
      </div>

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Pulse Learn — Tamrack — Free forever
      </footer>
    </main>
  );
}
