"use client";

import { useState, useCallback } from "react";
import { CheckCircle2, XCircle, RotateCcw, ArrowRight, Trophy, Lock } from "lucide-react";
import { MODULE_QUIZZES, type QuizQuestion } from "@/lib/learn-quizzes";
import { saveQuizResult, loadProgress, isModuleUnlocked } from "@/lib/learn-progress";
import { PASSING_SCORE, COURSE_MODULES } from "@/lib/learn-course";

interface QuizProps {
  moduleSlug: string;
}

export function ModuleQuiz({ moduleSlug }: QuizProps) {
  const questions = MODULE_QUIZZES[moduleSlug] || [];
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState(0);

  // Check if module is unlocked
  const progress = loadProgress();
  const modIndex = COURSE_MODULES.findIndex((m) => m.slug === moduleSlug);
  const isUnlocked = modIndex === 0 || isModuleUnlocked(progress, moduleSlug);

  // Check if already passed
  const existingQuiz = progress.modules[moduleSlug]?.quiz;
  const [showPrevResult, setShowPrevResult] = useState(!!existingQuiz?.passed);

  const handleSelect = useCallback((optionIndex: number) => {
    if (revealed) return;
    setSelected(optionIndex);
  }, [revealed]);

  const handleReveal = useCallback(() => {
    if (selected === null) return;
    setRevealed(true);
    setAnswers((prev) => ({ ...prev, [currentQ]: selected }));
  }, [selected, currentQ]);

  const handleNext = useCallback(() => {
    if (currentQ < questions.length - 1) {
      setCurrentQ((prev) => prev + 1);
      setSelected(null);
      setRevealed(false);
    } else {
      // Calculate score
      const newAnswers = { ...answers, [currentQ]: selected! };
      const correct = questions.filter((q, i) => newAnswers[i] === q.correct).length;
      const pct = Math.round((correct / questions.length) * 100);
      setScore(pct);
      setFinished(true);
      saveQuizResult(moduleSlug, pct, newAnswers);
    }
  }, [currentQ, questions, answers, selected, moduleSlug]);

  const handleRetry = useCallback(() => {
    setCurrentQ(0);
    setSelected(null);
    setRevealed(false);
    setAnswers({});
    setFinished(false);
    setScore(0);
    setShowPrevResult(false);
  }, []);

  if (!isUnlocked) {
    return (
      <div className="text-center py-12">
        <Lock size={32} className="text-muted mx-auto mb-3" />
        <p className="text-sm text-muted">Complete the previous module to unlock this quiz.</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return <p className="text-sm text-muted text-center py-8">No quiz questions available for this module.</p>;
  }

  if (showPrevResult && existingQuiz?.passed) {
    return (
      <div className="text-center py-8 space-y-4">
        <Trophy size={40} className="text-amber-500 mx-auto" />
        <div>
          <p className="text-lg font-semibold text-foreground">Quiz Passed!</p>
          <p className="text-sm text-muted">
            You scored {existingQuiz.score}% on{" "}
            {new Date(existingQuiz.completedAt).toLocaleDateString()}.
          </p>
        </div>
        <button
          onClick={handleRetry}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-card-border text-muted hover:text-foreground hover:border-foreground/20 transition-colors"
        >
          <RotateCcw size={14} />
          Retake Quiz
        </button>
      </div>
    );
  }

  if (finished) {
    const passed = score >= PASSING_SCORE;
    const nextModIndex = modIndex + 1;
    const nextMod = nextModIndex < COURSE_MODULES.length ? COURSE_MODULES[nextModIndex] : null;

    return (
      <div className="text-center py-8 space-y-4">
        {passed ? (
          <>
            <Trophy size={40} className="text-amber-500 mx-auto" />
            <div>
              <p className="text-lg font-semibold text-foreground">Quiz Passed!</p>
              <p className="text-sm text-muted">You scored {score}%.</p>
            </div>
            {nextMod && (
              <a
                href={`/learn/${nextMod.slug}/${nextMod.lessons[0].slug}`}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-colors font-medium"
              >
                Next: {nextMod.title}
                <ArrowRight size={14} />
              </a>
            )}
          </>
        ) : (
          <>
            <XCircle size={40} className="text-red-400 mx-auto" />
            <div>
              <p className="text-lg font-semibold text-foreground">Not quite — {score}%</p>
              <p className="text-sm text-muted">
                You need {PASSING_SCORE}% to pass. Review the lessons and try again.
              </p>
            </div>
            <button
              onClick={handleRetry}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-colors font-medium"
            >
              <RotateCcw size={14} />
              Try Again
            </button>
          </>
        )}
      </div>
    );
  }

  const q = questions[currentQ];

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center justify-between text-xs text-muted">
        <span>
          Question {currentQ + 1} of {questions.length}
        </span>
        <span>{Math.round(((currentQ) / questions.length) * 100)}% complete</span>
      </div>
      <div className="w-full h-1.5 bg-card-border rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-500 rounded-full transition-all duration-300"
          style={{ width: `${((currentQ) / questions.length) * 100}%` }}
        />
      </div>

      {/* Question */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-foreground leading-relaxed">{q.question}</p>

        <div className="space-y-2">
          {q.options.map((option, i) => {
            let style = "border-card-border hover:border-amber-500/30 hover:bg-amber-500/[0.03]";
            if (revealed) {
              if (i === q.correct) {
                style = "border-green-500/40 bg-green-500/10";
              } else if (i === selected && i !== q.correct) {
                style = "border-red-500/40 bg-red-500/10";
              } else {
                style = "border-card-border opacity-50";
              }
            } else if (i === selected) {
              style = "border-amber-500/40 bg-amber-500/10";
            }

            return (
              <button
                key={i}
                onClick={() => handleSelect(i)}
                disabled={revealed}
                className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${style}`}
              >
                <div className="flex items-start gap-3">
                  <span className="shrink-0 w-5 h-5 rounded-full border border-current/20 flex items-center justify-center text-[10px] font-medium mt-0.5">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="text-foreground/90">{option}</span>
                  {revealed && i === q.correct && (
                    <CheckCircle2 size={16} className="text-green-500 ml-auto shrink-0 mt-0.5" />
                  )}
                  {revealed && i === selected && i !== q.correct && (
                    <XCircle size={16} className="text-red-400 ml-auto shrink-0 mt-0.5" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Explanation */}
      {revealed && (
        <div className="bg-foreground/[0.03] border border-card-border rounded-lg p-4">
          <p className="text-xs font-medium text-amber-500 mb-1">Explanation</p>
          <p className="text-sm text-foreground/80 leading-relaxed">{q.explanation}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        {!revealed ? (
          <button
            onClick={handleReveal}
            disabled={selected === null}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
              selected === null
                ? "bg-card-border text-muted cursor-not-allowed"
                : "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
            }`}
          >
            Check Answer
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-colors font-medium"
          >
            {currentQ < questions.length - 1 ? "Next Question" : "See Results"}
            <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
