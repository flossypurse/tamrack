"use client";

import { useState, useEffect } from "react";
import {
  Award,
  Download,
  Lock,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { COURSE_MODULES } from "@/lib/learn-course";
import {
  loadProgress,
  isCourseComplete,
  isModuleComplete,
  markCertificateEarned,
  type CourseProgress,
} from "@/lib/learn-progress";

export default function CertificatePage() {
  const [progress, setProgress] = useState<CourseProgress>({
    modules: {},
    startedAt: new Date().toISOString(),
  });
  const [name, setName] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    setProgress(loadProgress());
  }, []);

  const complete = isCourseComplete(progress);
  const completedCount = COURSE_MODULES.filter((m) =>
    isModuleComplete(progress, m.slug)
  ).length;

  const handleDownload = async () => {
    if (!name.trim()) return;
    setDownloading(true);
    try {
      const date = new Date().toLocaleDateString("en-CA");
      const url = `/api/learn/certificate-pdf?name=${encodeURIComponent(name.trim())}&date=${date}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to generate");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = "alberta-economic-literacy-certificate.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      markCertificateEarned();
    } catch (error) {
      console.error("Download failed:", error);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-2xl mx-auto space-y-8">
      <div className="text-center space-y-3 py-8">
        <Award
          size={48}
          className={complete ? "text-amber-500 mx-auto" : "text-muted/30 mx-auto"}
        />
        <h1 className="text-2xl font-bold text-foreground">
          Alberta Economic Literacy Certificate
        </h1>
        <p className="text-sm text-muted">
          Complete all 8 modules with passing quiz scores to earn your certificate.
        </p>
      </div>

      {/* Module checklist */}
      <div className="border border-card-border rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Module Progress
          </h2>
          <span className="text-xs text-muted">
            {completedCount}/{COURSE_MODULES.length} complete
          </span>
        </div>

        <div className="w-full h-2 bg-card-border rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 rounded-full transition-all duration-500"
            style={{
              width: `${(completedCount / COURSE_MODULES.length) * 100}%`,
            }}
          />
        </div>

        <div className="space-y-2 pt-2">
          {COURSE_MODULES.map((mod) => {
            const done = isModuleComplete(progress, mod.slug);
            const quizScore = progress.modules[mod.slug]?.quiz?.score;
            return (
              <div
                key={mod.slug}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-2">
                  {done ? (
                    <CheckCircle2 size={14} className="text-green-500" />
                  ) : (
                    <div className="w-[14px] h-[14px] rounded-full border border-card-border" />
                  )}
                  <span
                    className={
                      done
                        ? "text-muted line-through"
                        : "text-foreground/80"
                    }
                  >
                    {mod.id}. {mod.title}
                  </span>
                </div>
                {quizScore !== undefined && (
                  <span
                    className={`text-[10px] ${
                      quizScore >= 70 ? "text-green-500" : "text-red-400"
                    }`}
                  >
                    Quiz: {quizScore}%
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Certificate download */}
      {complete ? (
        <div className="border border-amber-500/30 bg-amber-500/[0.03] rounded-lg p-6 space-y-4 text-center">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">
              Congratulations!
            </h2>
            <p className="text-sm text-muted">
              You&apos;ve completed all 8 modules. Enter your name to generate
              your certificate.
            </p>
          </div>

          <div className="max-w-sm mx-auto space-y-3">
            <input
              type="text"
              placeholder="Your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-card-border bg-background text-foreground text-sm placeholder:text-muted/50 focus:outline-none focus:border-amber-500/50"
            />
            <button
              onClick={handleDownload}
              disabled={!name.trim() || downloading}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-colors w-full justify-center ${
                name.trim() && !downloading
                  ? "bg-amber-500 text-black hover:bg-amber-400"
                  : "bg-card-border text-muted cursor-not-allowed"
              }`}
            >
              <Download size={16} />
              {downloading ? "Generating..." : "Download Certificate (PDF)"}
            </button>
          </div>
        </div>
      ) : (
        <div className="border border-card-border rounded-lg p-6 space-y-4 text-center">
          <Lock size={24} className="text-muted/40 mx-auto" />
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground">
              Certificate Locked
            </h2>
            <p className="text-xs text-muted">
              Complete all 8 modules with passing quiz scores (70%+) to unlock
              your certificate.
            </p>
          </div>
          {completedCount > 0 && (
            <Link
              href="/learn"
              className="inline-flex items-center gap-1.5 text-xs text-amber-500 hover:text-amber-400 transition-colors font-medium"
            >
              Continue Learning
              <ArrowRight size={12} />
            </Link>
          )}
        </div>
      )}

      <footer className="text-center text-xs text-muted/40 pt-4 pb-8">
        Tamrack Learn
      </footer>
    </main>
  );
}
