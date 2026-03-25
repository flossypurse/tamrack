"use client";

import type { Metadata } from "next";
import { ModuleQuiz } from "@/components/learn-quiz";

export default function TaxDollarsQuizPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="text-xl font-bold text-foreground">
          Module 4 Quiz — Your Tax Dollars
        </h1>
        <p className="text-sm text-muted">
          Test your understanding of property assessments, municipal budgets,
          transfer payments, and fiscal federalism. You need 70% to pass and
          unlock the next module.
        </p>
      </div>

      <ModuleQuiz moduleSlug="tax-dollars" />

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Alberta Pulse Check &mdash; Your Tax Dollars Quiz
      </footer>
    </main>
  );
}
