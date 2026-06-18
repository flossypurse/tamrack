"use client";

/**
 * NullStateCard — three honest null-state variants.
 *
 * Container: background #0e0e0e, hairline border, no amber accents.
 * Visually distinct from a composed story so users understand this is
 * an epistemic limit, not a product failure.
 *
 * Variants:
 *   "no_data"           — "We don't have data for X. The closest we have is Y."
 *   "no_pattern"        — flat prose summary, no story framing
 *   "conflicting"       — two-column signal conflict, no auto-resolution
 */

export type NullVariant = "no_data" | "no_pattern" | "conflicting";

interface NoDataProps {
  variant: "no_data";
  /** What the user asked about. */
  requested: string;
  /** Nearest available data or null if nothing nearby. */
  closest?: string | null;
}

interface NoPatternProps {
  variant: "no_pattern";
  /** Raw prose summary of what was found. */
  raw_summary: string;
}

interface ConflictingProps {
  variant: "conflicting";
  /** Signal A label. */
  signal_a: string;
  /** Signal B label. */
  signal_b: string;
  /** One observational sentence describing the conflict. */
  conflict_description: string;
}

export type NullStateCardProps = NoDataProps | NoPatternProps | ConflictingProps;

export function NullStateCard(props: NullStateCardProps) {
  return (
    <div
      className="border border-[var(--hairline)] p-5"
      style={{
        background: "#0e0e0e",
        fontFamily: "var(--font-mono)",
      }}
    >
      {props.variant === "no_data" && (
        <NoDataVariant {...props} />
      )}
      {props.variant === "no_pattern" && (
        <NoPatternVariant {...props} />
      )}
      {props.variant === "conflicting" && (
        <ConflictingVariant {...props} />
      )}
    </div>
  );
}

function NoDataVariant({ requested, closest }: NoDataProps) {
  return (
    <div className="flex flex-col gap-2">
      <span
        className="text-[10px] tracking-[0.16em] uppercase"
        style={{ color: "var(--mid)" }}
      >
        no data
      </span>
      <p className="text-sm" style={{ color: "var(--mid)" }}>
        We don&apos;t have data for{" "}
        <span style={{ color: "var(--ink)" }}>{requested}</span>.
        {closest ? (
          <>
            {" "}
            The closest we have is{" "}
            <span style={{ color: "var(--ink)" }}>{closest}</span>.
          </>
        ) : (
          " No nearby data is available."
        )}
      </p>
    </div>
  );
}

function NoPatternVariant({ raw_summary }: NoPatternProps) {
  return (
    <div className="flex flex-col gap-2">
      <span
        className="text-[10px] tracking-[0.16em] uppercase"
        style={{ color: "var(--mid)" }}
      >
        no clear pattern
      </span>
      <p className="text-sm" style={{ color: "var(--mid)" }}>
        The data doesn&apos;t show a clear pattern. Here&apos;s what we found:
      </p>
      <p className="text-sm" style={{ color: "var(--ink)" }}>
        {raw_summary}
      </p>
    </div>
  );
}

function ConflictingVariant({
  signal_a,
  signal_b,
  conflict_description,
}: ConflictingProps) {
  return (
    <div className="flex flex-col gap-3">
      <span
        className="text-[10px] tracking-[0.16em] uppercase"
        style={{ color: "var(--mid)" }}
      >
        conflicting signals
      </span>
      <p className="text-sm" style={{ color: "var(--mid)" }}>
        {conflict_description}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div
          className="border border-[var(--hairline)] p-3"
          style={{ color: "var(--mid)" }}
        >
          <span className="text-[10px] tracking-[0.12em] uppercase block mb-1">
            signal a
          </span>
          <span className="text-xs" style={{ color: "var(--ink)" }}>
            {signal_a}
          </span>
        </div>
        <div
          className="border border-[var(--hairline)] p-3"
          style={{ color: "var(--mid)" }}
        >
          <span className="text-[10px] tracking-[0.12em] uppercase block mb-1">
            signal b
          </span>
          <span className="text-xs" style={{ color: "var(--ink)" }}>
            {signal_b}
          </span>
        </div>
      </div>
    </div>
  );
}
