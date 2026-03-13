"use client";

import { Card } from "@/components/card";

export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto">
      <Card>
        <h2 className="text-sm font-medium text-foreground mb-2">Dashboard data temporarily unavailable</h2>
        <p className="text-xs text-muted mb-4">
          One or more upstream data sources failed to respond.
          This usually resolves within minutes.
        </p>
        <p className="text-[10px] text-muted/60 mb-4 font-mono">{error.message}</p>
        <button
          onClick={reset}
          className="text-xs bg-accent/10 text-accent px-3 py-1.5 rounded hover:bg-accent/20 transition-colors"
        >
          Retry
        </button>
      </Card>
    </main>
  );
}
