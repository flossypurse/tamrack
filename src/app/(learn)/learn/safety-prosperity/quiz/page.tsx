"use client";

import { ModuleQuiz } from "@/components/learn-quiz";

export default function SafetyProsperityQuizPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="text-xl font-bold text-foreground">
          Module 8 Quiz: Safety &amp; Prosperity
        </h1>
        <p className="text-sm text-muted">
          Test your understanding of how crime, health, environment, and economic
          conditions connect. You need 70% to pass.
        </p>
      </div>

      <ModuleQuiz moduleSlug="safety-prosperity" />

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Alberta Pulse Check &mdash; Safety &amp; Prosperity Quiz
      </footer>
    </main>
  );
}
