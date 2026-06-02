"use client";

/**
 * HumanReviewGate — renders in place of the chart when a story card requires
 * editorial review before display (trust.requires_human_review === true AND
 * human_review_approved === false). The narrative body and disclosure row still
 * render; only the chart is gated. The approval UI itself is not part of this
 * component.
 */

interface HumanReviewGateProps {
  /** The story card's block ID, shown for admin reference. */
  blockId: string;
}

export function HumanReviewGate({ blockId }: HumanReviewGateProps) {
  return (
    <div
      className="flex flex-col items-start justify-center gap-3 border border-[var(--hairline)] p-5 min-h-[160px]"
      style={{
        fontFamily: "var(--font-mono)",
        background: "#0e0e0e",
      }}
      aria-label="Chart pending review"
    >
      <span
        className="text-[10px] tracking-[0.16em] uppercase"
        style={{ color: "var(--mid)" }}
      >
        pending review
      </span>
      <p className="text-sm leading-relaxed" style={{ color: "var(--mid)" }}>
        This comparison chart requires editorial review before it can be shown.
        The narrative and sources below are available.
      </p>
      <span
        className="text-[9px] tracking-[0.10em]"
        style={{ color: "var(--mid)", opacity: 0.6 }}
      >
        block:{" "}
        <span style={{ color: "var(--ink)" }}>{blockId}</span>
      </span>
    </div>
  );
}
