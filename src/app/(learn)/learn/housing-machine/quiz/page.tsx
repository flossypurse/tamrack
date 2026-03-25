"use client";

import { ModuleQuiz } from "@/components/learn-quiz";

export default function HousingMachineQuizPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="text-xl font-bold text-foreground">
          Module 3 Quiz — The Housing Machine
        </h1>
        <p className="text-sm text-muted">
          Test your understanding of how interest rates flow through construction,
          vacancy, and rent in Alberta. You need 70% to pass and unlock the next module.
        </p>
      </div>

      <ModuleQuiz moduleSlug="housing-machine" />
    </main>
  );
}
