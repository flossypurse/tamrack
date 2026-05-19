"use client";

/**
 * /ask — Tamrack Smart UI v1 landing.
 *
 * One text field, three example chips, a streaming result area. POSTs
 * to /api/smart/query and renders SSE events (plan → tool_result × N →
 * dashboard → done) into the dashboard component. No persistence,
 * no auth, no iteration — that all lands in v1.1.
 */

import { useCallback, useRef, useState } from "react";

import { SmartUiDashboard } from "@/components/smart-ui/dashboard";
import { SmartUiSkeleton } from "@/components/smart-ui/skeleton";
import type {
  DashboardConfig,
  SmartQueryEvent,
  ToolCallResult,
} from "@/lib/smart-ui/types";

const EXAMPLE_QUERIES = [
  "alberta unemployment last 5 years",
  "edmonton housing starts 2024",
  "alberta policy rate right now",
];

interface AskState {
  status: "idle" | "planning" | "tools" | "composing" | "done" | "error";
  intent: string;
  cardTitles: string[];
  toolResultsByCardId: Record<string, ToolCallResult>;
  dashboard: DashboardConfig | null;
  errorMessage: string;
}

const INITIAL_STATE: AskState = {
  status: "idle",
  intent: "",
  cardTitles: [],
  toolResultsByCardId: {},
  dashboard: null,
  errorMessage: "",
};

export default function AskPage() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<AskState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);

  const handleEvent = useCallback((event: SmartQueryEvent) => {
    setState((s) => {
      switch (event.type) {
        case "plan":
          return {
            ...s,
            status: "tools",
            intent: event.intent,
            cardTitles: event.card_titles,
          };
        case "tool_result": {
          const result: ToolCallResult = {
            card_id: event.card_id,
            tool: "",
            args: {},
            status: event.status,
            data: event.data,
            error: event.error,
          };
          return {
            ...s,
            toolResultsByCardId: {
              ...s.toolResultsByCardId,
              [event.card_id]: result,
            },
          };
        }
        case "dashboard":
          return {
            ...s,
            status: "composing",
            dashboard: event.dashboard,
            // The route also re-sends the full tool_results array — re-index
            // by card_id so the renderer can resolve every binding.
            toolResultsByCardId: Object.fromEntries(
              event.tool_results.map((r) => [r.card_id, r]),
            ),
          };
        case "saved":
          // Replace the URL with the canonical /d/<slug> so refresh /
          // bookmark / share works. Don't push history entry — this is
          // not a new navigation, just a canonicalization.
          if (typeof window !== "undefined" && event.url) {
            try {
              window.history.replaceState(null, "", event.url);
            } catch {
              // history API can fail in restricted environments; ignore.
            }
          }
          return s;
        case "done":
          return { ...s, status: "done" };
        case "error":
          return { ...s, status: "error", errorMessage: event.message };
        default:
          return s;
      }
    });
  }, []);

  const runQuery = useCallback(async (q: string) => {
    if (!q.trim()) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setState({
      ...INITIAL_STATE,
      status: "planning",
    });

    try {
      const res = await fetch("/api/smart/query", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: q }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by \n\n. Pull complete frames off the
        // front of the buffer.
        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const rawFrame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const dataLine = rawFrame
            .split("\n")
            .find((line) => line.startsWith("data:"));
          if (!dataLine) continue;
          const json = dataLine.slice(5).trim();
          if (!json) continue;
          let event: SmartQueryEvent;
          try {
            event = JSON.parse(json) as SmartQueryEvent;
          } catch {
            continue;
          }
          handleEvent(event);
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setState((s) => ({
        ...s,
        status: "error",
        errorMessage: err instanceof Error ? err.message : String(err),
      }));
    }
  }, [handleEvent]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runQuery(query);
  };

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold sm:text-4xl">
          Ask Alberta anything
        </h1>
        <p className="text-sm text-[var(--muted)]">
          Type a question. Get a dashboard. Live macro data from Bank of
          Canada and Statistics Canada in v1.
        </p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. alberta unemployment last 5 years"
            className="flex-1 rounded-md border border-[var(--card-border)] bg-[var(--card)] px-4 py-3 text-base outline-none focus:border-[var(--accent)]"
            disabled={state.status !== "idle" && state.status !== "done" && state.status !== "error"}
          />
          <button
            type="submit"
            disabled={!query.trim() || (state.status !== "idle" && state.status !== "done" && state.status !== "error")}
            className="rounded-md bg-[var(--accent)] px-6 py-3 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            {state.status === "idle" || state.status === "done" || state.status === "error"
              ? "Ask"
              : "Working…"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_QUERIES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setQuery(ex);
                runQuery(ex);
              }}
              className="rounded-full border border-[var(--card-border)] bg-[var(--card)] px-3 py-1 text-xs text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)]"
            >
              {ex}
            </button>
          ))}
        </div>
      </form>

      <section>
        {state.status === "error" && (
          <div className="rounded-lg border border-[var(--accent-red)] bg-[var(--card)] p-4 text-sm text-[var(--accent-red)]">
            <strong>Error.</strong> {state.errorMessage}
          </div>
        )}
        {(state.status === "planning" ||
          state.status === "tools" ||
          state.status === "composing") &&
          state.cardTitles.length === 0 && (
            <div className="text-sm text-[var(--muted)]">Planning…</div>
          )}
        {(state.status === "tools" || state.status === "composing") &&
          state.cardTitles.length > 0 &&
          !state.dashboard && (
            <SmartUiSkeleton
              intent={state.intent}
              cardTitles={state.cardTitles}
            />
          )}
        {state.dashboard && (
          <SmartUiDashboard
            dashboard={state.dashboard}
            toolResultsByCardId={state.toolResultsByCardId}
          />
        )}
      </section>
    </main>
  );
}
