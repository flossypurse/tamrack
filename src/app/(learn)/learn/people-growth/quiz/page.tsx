"use client";

import { ModuleQuiz } from "@/components/learn-quiz";

export default function PeopleGrowthQuizPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="text-xl font-bold text-foreground">
          Module 5 Quiz — People &amp; Growth
        </h1>
        <p className="text-sm text-muted">
          Test your understanding of immigration, interprovincial migration,
          labour markets, and demographic pressures. You need 70% to pass and
          unlock the next module.
        </p>
      </div>

      <ModuleQuiz moduleSlug="people-growth" />

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Alberta Pulse Check &mdash; People &amp; Growth Quiz
      </footer>
    </main>
  );
}
