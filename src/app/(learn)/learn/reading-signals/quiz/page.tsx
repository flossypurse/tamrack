"use client";

import type { Metadata } from "next";
import { ModuleQuiz } from "@/components/learn-quiz";

export default function ReadingSignalsQuizPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="text-xl font-bold text-foreground">
          Module 6 Quiz: Reading the Signals
        </h1>
        <p className="text-sm text-muted">
          Test your understanding of leading, coincident, and lagging indicators.
          You need 70% to pass and unlock the next module.
        </p>
      </div>

      <ModuleQuiz moduleSlug="reading-signals" />

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Tamrack &mdash; Reading the Signals Quiz
      </footer>
    </main>
  );
}
