"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="print:hidden flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-card-border hover:border-foreground/20"
    >
      <Printer size={12} />
      Print
    </button>
  );
}
