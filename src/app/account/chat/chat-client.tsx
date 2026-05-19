"use client";

/**
 * Tamrack chat client — relocated from /ask, gated behind /account.
 *
 * One text field, three example chips, a streaming result area. POSTs to
 * /api/smart/query and renders SSE events (plan → tool_result × N →
 * dashboard → done) into the dashboard component. Behaviour identical to
 * the pre-pivot /ask page; only difference is the welcome heading copy
 * (now framed as the agent's home) and the gate above it.
 */

import { useCallback, useEffect, useRef, useState } from "react";

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

// Abort the SSE stream if no event arrives for this long. Re-armed on every
// frame from the server; trips only when the connection genuinely stalls.
const STALL_TIMEOUT_MS = 60_000;

interface ChatState {
  status: "idle" | "planning" | "tools" | "composing" | "done" | "error";
  intent: string;
  cardTitles: string[];
  toolResultsByCardId: Record<string, ToolCallResult>;
  dashboard: DashboardConfig | null;
  errorMessage: string;
}

const INITIAL_STATE: ChatState = {
  status: "idle",
  intent: "",
  cardTitles: [],
  toolResultsByCardId: {},
  dashboard: null,
  errorMessage: "",
};

export function ChatClient() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<ChatState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearStallTimer = useCallback(() => {
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
  }, []);

  const armStallTimer = useCallback(() => {
    clearStallTimer();
    stallTimerRef.current = setTimeout(() => {
      abortRef.current?.abort();
      setState((s) => ({
        ...s,
        status: "error",
        errorMessage:
          "The agent stopped responding (60s with no update). Try again.",
      }));
    }, STALL_TIMEOUT_MS);
  }, [clearStallTimer]);

  // Clear any pending timer on unmount.
  useEffect(() => clearStallTimer, [clearStallTimer]);

  const stopQuery = useCallback(() => {
    abortRef.current?.abort();
    clearStallTimer();
    setState(INITIAL_STATE);
  }, [clearStallTimer]);

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

  const runQuery = useCallback(
    async (q: string) => {
      if (!q.trim()) return;
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setState({
        ...INITIAL_STATE,
        status: "planning",
      });
      armStallTimer();

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
          // Any byte from the server counts as liveness — re-arm.
          armStallTimer();
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
      } finally {
        clearStallTimer();
      }
    },
    [handleEvent, armStallTimer, clearStallTimer],
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runQuery(query);
  };

  const working =
    state.status !== "idle" &&
    state.status !== "done" &&
    state.status !== "error";

  return (
    <section className="flex flex-col gap-6">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. alberta unemployment last 5 years"
            className="flex-1 border border-[var(--hairline)] bg-[var(--surface-elevated)] px-4 py-3 text-base text-[var(--ink)] outline-none focus:border-[var(--amber)]"
            disabled={working}
          />
          <button
            type="submit"
            disabled={!query.trim() || working}
            className="border border-[var(--amber)] bg-[var(--amber)] px-6 py-3 font-mono text-[11px] tracking-[0.14em] uppercase text-[var(--surface)] hover:bg-[var(--amber)]/85 disabled:opacity-50"
            style={{ transitionDuration: "var(--dur-instant)" }}
          >
            {working ? "working…" : "ask"}
          </button>
          {working && (
            <button
              type="button"
              onClick={stopQuery}
              className="border border-[var(--hairline)] px-4 py-3 font-mono text-[11px] tracking-[0.14em] uppercase text-[var(--mid)] hover:border-[var(--accent-red)] hover:text-[var(--accent-red)]"
              style={{ transitionDuration: "var(--dur-instant)" }}
            >
              cancel
            </button>
          )}
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
              className="border border-[var(--hairline)] bg-[var(--surface)] px-3 py-1 font-mono text-[10px] tracking-[0.14em] uppercase text-[var(--mid)] hover:border-[var(--amber)] hover:text-[var(--ink)]"
              style={{ transitionDuration: "var(--dur-instant)" }}
            >
              {ex}
            </button>
          ))}
        </div>
      </form>

      <div>
        {state.status === "error" && (
          <div className="border border-[var(--accent-red)] bg-[var(--surface-elevated)] p-4 text-sm text-[var(--accent-red)]">
            <strong>Error.</strong> {state.errorMessage}
          </div>
        )}
        {(state.status === "planning" ||
          state.status === "tools" ||
          state.status === "composing") &&
          state.cardTitles.length === 0 && (
            <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--mid)]">
              planning…
            </div>
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
      </div>
    </section>
  );
}
