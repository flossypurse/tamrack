"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";

export function CurationActions({
  queryHash,
  repDashboardId,
}: {
  queryHash: string;
  repDashboardId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<"approve" | "dismiss" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "approve" | "dismiss") {
    setPending(action);
    setError(null);
    try {
      const res = await fetch("/api/admin/curation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          query_hash: queryHash,
          rep_dashboard_id: repDashboardId,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Request failed (${res.status})`);
        setPending(null);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
      setPending(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => act("approve")}
        disabled={pending !== null}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-accent-green/30 bg-accent-green/10 text-accent-green hover:bg-accent-green/20 disabled:opacity-50 transition-colors"
      >
        <Check size={12} />
        {pending === "approve" ? "Promoting…" : "Approve"}
      </button>
      <button
        onClick={() => act("dismiss")}
        disabled={pending !== null}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-card-border bg-card text-muted hover:text-foreground disabled:opacity-50 transition-colors"
      >
        <X size={12} />
        {pending === "dismiss" ? "Dismissing…" : "Dismiss"}
      </button>
      {error && <span className="text-xs text-accent-red">{error}</span>}
    </div>
  );
}
