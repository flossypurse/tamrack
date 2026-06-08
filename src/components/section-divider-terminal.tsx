"use client";

/**
 * SectionDividerTerminal — Terminal Buffer between-section beat.
 *
 * What it does:
 *   - Renders a 12px-tall mono caption band: `> ` + char-by-char type-out of `label`.
 *   - Block cursor `█` leads the typing position.
 *   - After the last char, cursor blinks exactly once (1 cycle, 400ms), then unmounts.
 *   - IntersectionObserver trigger: rootMargin "-20% 0px", threshold 0, once: true.
 *   - Reduced-motion: render the full label immediately, no cursor, no type-out.
 *
 * Performance budget:
 *   - <8kb gzipped JS — this file is ~2kb.
 *   - No canvas, no rAF loops; setTimeout per char + a single 400ms blink keyframe.
 *   - Char rate decision: 30ms/char default. Label cap = 20 chars (20 * 30ms = 600ms
 *     dominant gesture, +400ms blink = 1000ms total mount-to-dismount). The dominant
 *     gesture is capped at 600ms, not the full mount-to-dismount, and the blink runs
 *     after the gesture lands — so this fits. If a future label needs more headroom,
 *     drop the char rate to 25ms rather than relaxing the cap.
 */

import { useEffect, useRef, useState } from "react";

interface Props {
  label: string;
  /** Optional stagger delay before the type-out begins (after the observer fires). */
  delayMs?: number;
}

const CHAR_MS = 30;
const BLINK_MS = 400;
const LABEL_CAP = 20;

export function SectionDividerTerminal({ label, delayMs = 0 }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  // typed = number of characters revealed so far. -1 = not started.
  const [typed, setTyped] = useState(-1);
  // 'pre' | 'typing' | 'blink' | 'done'
  const [phase, setPhase] = useState<"pre" | "typing" | "blink" | "done">("pre");
  const [reduced, setReduced] = useState(false);

  if (process.env.NODE_ENV !== "production" && label.length > LABEL_CAP) {
    // Soft warn — does not throw, but flags the budget violation.
    // eslint-disable-next-line no-console
    console.warn(
      `[SectionDividerTerminal] label "${label}" exceeds ${LABEL_CAP}-char cap (got ${label.length}).`,
    );
  }

  // Reduced-motion check — runs once on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      setReduced(true);
      setTyped(label.length);
      setPhase("done");
    }
  }, [label.length]);

  // IntersectionObserver trigger.
  useEffect(() => {
    if (reduced) return;
    if (!ref.current) return;
    const el = ref.current;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            observer.disconnect();
            const startTimer = window.setTimeout(() => {
              setPhase("typing");
              setTyped(0);
            }, delayMs);
            // Stash so we can clear on unmount.
            (el as HTMLDivElement & { __startTimer?: number }).__startTimer =
              startTimer;
            return;
          }
        }
      },
      { rootMargin: "-20% 0px", threshold: 0 },
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      const t = (el as HTMLDivElement & { __startTimer?: number }).__startTimer;
      if (t !== undefined) window.clearTimeout(t);
    };
  }, [delayMs, reduced]);

  // Type-out driver — advances `typed` by one each CHAR_MS.
  useEffect(() => {
    if (phase !== "typing") return;
    if (typed >= label.length) {
      setPhase("blink");
      return;
    }
    const t = window.setTimeout(() => {
      setTyped((n) => n + 1);
    }, CHAR_MS);
    return () => window.clearTimeout(t);
  }, [phase, typed, label.length]);

  // Single blink cycle, then unmount cursor.
  useEffect(() => {
    if (phase !== "blink") return;
    const t = window.setTimeout(() => {
      setPhase("done");
    }, BLINK_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  const visibleLabel = typed >= 0 ? label.slice(0, typed) : "";
  const showCursor = !reduced && (phase === "typing" || phase === "blink");

  return (
    <div
      ref={ref}
      className="flex items-center justify-center h-3 leading-none select-none"
      aria-hidden="true"
    >
      <style>{`
        @keyframes section-divider-terminal-blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
      `}</style>
      <span
        className="font-mono uppercase"
        style={{
          fontSize: "12px",
          fontWeight: 500,
          letterSpacing: "0.14em",
          color: "var(--mid)",
          // Hard easing per moodboard — applied where it matters (cursor blink).
          transitionTimingFunction: "var(--ease-decisive)",
        }}
      >
        <span style={{ color: "var(--amber)" }}>&gt;</span>{" "}
        {visibleLabel}
        {showCursor && (
          <span
            style={{
              color: "var(--amber)",
              display: "inline-block",
              animation:
                phase === "blink"
                  ? `section-divider-terminal-blink ${BLINK_MS}ms var(--ease-decisive) 1 forwards`
                  : "none",
            }}
          >
            █
          </span>
        )}
      </span>
    </div>
  );
}
