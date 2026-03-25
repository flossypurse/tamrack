"use client";

import { useEffect, useState, useCallback } from "react";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { markLessonComplete, loadProgress } from "@/lib/learn-progress";
import { getNextLesson, getModule } from "@/lib/learn-course";
import Link from "next/link";

interface LessonCompleteProps {
  moduleSlug: string;
  lessonSlug: string;
}

export function LessonCompleteButton({ moduleSlug, lessonSlug }: LessonCompleteProps) {
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    const progress = loadProgress();
    const lessonProgress = progress.modules[moduleSlug]?.lessons[lessonSlug];
    if (lessonProgress?.completed) {
      setCompleted(true);
    }
  }, [moduleSlug, lessonSlug]);

  const handleComplete = useCallback(() => {
    markLessonComplete(moduleSlug, lessonSlug);
    setCompleted(true);
    // Dispatch storage event so layout sidebar updates
    window.dispatchEvent(new Event("storage"));
  }, [moduleSlug, lessonSlug]);

  const next = getNextLesson(moduleSlug, lessonSlug);
  const nextModule = next ? getModule(next.moduleSlug) : null;
  const nextLesson = nextModule?.lessons.find((l) => l.slug === next?.lessonSlug);

  return (
    <div className="border-t border-card-border pt-6 mt-8 space-y-4">
      {!completed ? (
        <button
          onClick={handleComplete}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-colors font-medium text-sm"
        >
          <CheckCircle2 size={16} />
          Mark Lesson Complete
        </button>
      ) : (
        <div className="flex items-center gap-2 text-green-500 text-sm font-medium">
          <CheckCircle2 size={16} />
          Lesson Complete
        </div>
      )}

      {completed && next && nextLesson && (
        <Link
          href={`/learn/${next.moduleSlug}/${next.lessonSlug}`}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 text-black hover:bg-amber-400 transition-colors font-medium text-sm"
        >
          Next: {nextLesson.title}
          <ArrowRight size={14} />
        </Link>
      )}

      {completed && !next && (
        <Link
          href="/learn/certificate"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 text-black hover:bg-amber-400 transition-colors font-medium text-sm"
        >
          Get Your Certificate
          <ArrowRight size={14} />
        </Link>
      )}
    </div>
  );
}
