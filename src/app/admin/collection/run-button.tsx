"use client";

import { useState, useCallback } from "react";
import { Play, Loader2, CheckCircle, AlertCircle } from "lucide-react";

interface PhaseResult {
  phase: string;
  rows: number;
  elapsed: number;
  status: "ok" | "error";
  error?: string;
}

interface CollectionResult {
  started_at: string;
  finished_at: string;
  elapsed: number;
  phases: PhaseResult[];
  total_rows: number;
}

export function RunButton() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CollectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = useCallback(async (source: string = "all") => {
    setRunning(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/admin/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Collection failed");
    } finally {
      setRunning(false);
    }
  }, []);

  return (
    <div className="space-y-4">
      {/* Trigger buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handleRun("all")}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent/90 disabled:opacity-50 transition-colors"
        >
          {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          {running ? "Running..." : "Run Full Collection"}
        </button>

        {/* Quick-run individual sources */}
        {!running && (
          <div className="flex flex-wrap gap-1">
            {["regional", "energy", "municipalities", "wells", "immigration", "projects", "macro"].map((src) => (
              <button
                key={src}
                onClick={() => handleRun(src)}
                className="px-2.5 py-1.5 text-[11px] rounded-md border border-card-border text-muted hover:text-foreground hover:border-accent/30 transition-colors"
              >
                {src}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-accent-red/10 border border-accent-red/20">
          <AlertCircle size={14} className="text-accent-red shrink-0" />
          <span className="text-sm text-accent-red">{error}</span>
        </div>
      )}

      {/* Live results */}
      {result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle size={14} className="text-accent-green" />
            <span className="text-foreground font-medium">
              {result.total_rows.toLocaleString()} rows in {result.elapsed.toFixed(1)}s
            </span>
          </div>

          <div className="border border-card-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-foreground/[0.03] text-left">
                  <th className="px-3 py-2 text-xs text-muted font-medium">Phase</th>
                  <th className="px-3 py-2 text-xs text-muted font-medium text-right">Rows</th>
                  <th className="px-3 py-2 text-xs text-muted font-medium text-right">Time</th>
                  <th className="px-3 py-2 text-xs text-muted font-medium text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {result.phases.map((p) => (
                  <tr key={p.phase} className="border-t border-card-border">
                    <td className="px-3 py-2 text-foreground">{p.phase}</td>
                    <td className="px-3 py-2 text-right font-mono text-muted">
                      {p.rows.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-muted">
                      {p.elapsed.toFixed(1)}s
                    </td>
                    <td className="px-3 py-2 text-center">
                      {p.status === "ok" ? (
                        <span className="text-accent-green text-xs">ok</span>
                      ) : (
                        <span className="text-accent-red text-xs" title={p.error}>
                          error
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
