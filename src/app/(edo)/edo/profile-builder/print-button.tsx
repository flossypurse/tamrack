"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted border border-card-border rounded-lg hover:text-foreground hover:bg-card transition-colors print:hidden"
      type="button"
    >
      <Printer size={14} />
      Print
    </button>
  );
}
