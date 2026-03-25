// ============================================================
// Learn Progress Tracking — localStorage for anonymous users
// ============================================================

import { COURSE_MODULES, PASSING_SCORE } from "./learn-course";

const STORAGE_KEY = "pulse-learn-progress";

export interface LessonProgress {
  completed: boolean;
  completedAt?: string;
}

export interface QuizProgress {
  score: number; // percentage 0-100
  passed: boolean;
  completedAt: string;
  answers: Record<number, number>; // questionIndex -> selectedOption
}

export interface ModuleProgress {
  lessons: Record<string, LessonProgress>;
  quiz?: QuizProgress;
}

export interface CourseProgress {
  modules: Record<string, ModuleProgress>;
  startedAt: string;
  certificateEarned?: string; // ISO date when certificate was earned
}

function getDefaultProgress(): CourseProgress {
  return {
    modules: {},
    startedAt: new Date().toISOString(),
  };
}

export function loadProgress(): CourseProgress {
  if (typeof window === "undefined") return getDefaultProgress();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultProgress();
    return JSON.parse(raw) as CourseProgress;
  } catch {
    return getDefaultProgress();
  }
}

export function saveProgress(progress: CourseProgress): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Storage full or unavailable — silently fail
  }
}

export function markLessonComplete(moduleSlug: string, lessonSlug: string): CourseProgress {
  const progress = loadProgress();
  if (!progress.modules[moduleSlug]) {
    progress.modules[moduleSlug] = { lessons: {} };
  }
  progress.modules[moduleSlug].lessons[lessonSlug] = {
    completed: true,
    completedAt: new Date().toISOString(),
  };
  saveProgress(progress);
  return progress;
}

export function saveQuizResult(moduleSlug: string, score: number, answers: Record<number, number>): CourseProgress {
  const progress = loadProgress();
  if (!progress.modules[moduleSlug]) {
    progress.modules[moduleSlug] = { lessons: {} };
  }
  progress.modules[moduleSlug].quiz = {
    score,
    passed: score >= PASSING_SCORE,
    completedAt: new Date().toISOString(),
    answers,
  };
  // Also mark quiz lesson as complete if passed
  if (score >= PASSING_SCORE) {
    progress.modules[moduleSlug].lessons["quiz"] = {
      completed: true,
      completedAt: new Date().toISOString(),
    };
  }
  saveProgress(progress);
  return progress;
}

export function isModuleComplete(progress: CourseProgress, moduleSlug: string): boolean {
  const mod = COURSE_MODULES.find((m) => m.slug === moduleSlug);
  if (!mod) return false;
  const mp = progress.modules[moduleSlug];
  if (!mp) return false;
  // All lessons complete + quiz passed
  return mod.lessons.every((l) => mp.lessons[l.slug]?.completed) && (mp.quiz?.passed ?? false);
}

export function isModuleUnlocked(progress: CourseProgress, moduleSlug: string): boolean {
  const modIndex = COURSE_MODULES.findIndex((m) => m.slug === moduleSlug);
  if (modIndex <= 0) return true; // First module always unlocked
  // Previous module must be complete
  const prevMod = COURSE_MODULES[modIndex - 1];
  return isModuleComplete(progress, prevMod.slug);
}

export function getOverallProgress(progress: CourseProgress): number {
  let totalLessons = 0;
  let completedLessons = 0;
  for (const mod of COURSE_MODULES) {
    totalLessons += mod.lessons.length;
    const mp = progress.modules[mod.slug];
    if (mp) {
      completedLessons += mod.lessons.filter((l) => mp.lessons[l.slug]?.completed).length;
    }
  }
  return totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
}

export function isCourseComplete(progress: CourseProgress): boolean {
  return COURSE_MODULES.every((m) => isModuleComplete(progress, m.slug));
}

export function getResumePoint(progress: CourseProgress): { moduleSlug: string; lessonSlug: string } {
  for (const mod of COURSE_MODULES) {
    const mp = progress.modules[mod.slug];
    if (!mp) return { moduleSlug: mod.slug, lessonSlug: mod.lessons[0].slug };
    for (const lesson of mod.lessons) {
      if (!mp.lessons[lesson.slug]?.completed) {
        return { moduleSlug: mod.slug, lessonSlug: lesson.slug };
      }
    }
  }
  // All complete — return last lesson
  const lastMod = COURSE_MODULES[COURSE_MODULES.length - 1];
  return { moduleSlug: lastMod.slug, lessonSlug: lastMod.lessons[lastMod.lessons.length - 1].slug };
}

export function markCertificateEarned(): CourseProgress {
  const progress = loadProgress();
  progress.certificateEarned = new Date().toISOString();
  saveProgress(progress);
  return progress;
}
