"use client";

/**
 * DerivedSignalLabel — lists derived/composite signals that contributed.
 *
 * Renders nothing when signals array is empty.
 * Italic mono var(--mid) — signals are inferred, not directly observed.
 */

interface DerivedSignalLabelProps {
  signals: string[];
}

export function DerivedSignalLabel({ signals }: DerivedSignalLabelProps) {
  if (signals.length === 0) return null;

  return (
    <span
      className="text-[10px] tracking-[0.10em]"
      style={{
        fontFamily: "var(--font-mono)",
        fontStyle: "italic",
        color: "var(--mid)",
      }}
    >
      Derived: {signals.join(", ")}
    </span>
  );
}
