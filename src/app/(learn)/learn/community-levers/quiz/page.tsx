"use client";

import { ModuleQuiz } from "@/components/learn-quiz";

export default function CommunityLeversQuizPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="text-xl font-bold text-foreground">
          Module 7 Quiz: Community Levers
        </h1>
        <p className="text-sm text-muted">
          Test your understanding of municipal powers, zoning, and economic
          development levers. You need 70% to pass and unlock the next module.
        </p>
      </div>

      <ModuleQuiz moduleSlug="community-levers" />

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Tamrack &mdash; Community Levers Quiz
      </footer>
    </main>
  );
}
