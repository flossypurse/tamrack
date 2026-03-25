"use client";

import { ModuleQuiz } from "@/components/learn-quiz";

export default function Alberta101QuizPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-xl font-bold text-foreground">Alberta 101 Quiz</h1>
        <p className="text-sm text-muted">
          Test your knowledge of Alberta&apos;s geography, people, and regions.
          You need 70% to pass and unlock the next module.
        </p>
      </div>

      <ModuleQuiz moduleSlug="alberta-101" />
    </main>
  );
}
