"use client";

/**
 * Top-level Smart UI dashboard renderer — T3 Terminal chrome.
 *
 * Reads a `DashboardConfig` + a map of tool results keyed by card_id and
 * dispatches to the per-card renderers. Layout maps to the preview at
 * tamrack/brand/identity/preview/02-smart-ui-card.html:
 *   - mono uppercase letterspaced label-strip header
 *   - live-dot signature on the right when data is fresh
 *   - source/fetched footer in mono caps, mid-grey
 */

import type { DashboardConfig, ToolCallResult } from "@/lib/smart-ui/types";

import { CardLine } from "./card-line";
import { CardScorecard } from "./card-scorecard";

interface Props {
  dashboard: DashboardConfig;
  /** Tool results keyed by card_id. */
  toolResultsByCardId: Record<string, ToolCallResult>;
}

export function SmartUiDashboard({ dashboard, toolResultsByCardId }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <header className="border-b border-[var(--hairline)] pb-4">
        <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--mid)]">
          {dashboard.intent}
        </p>
        <h2 className="mt-2 font-mono font-extrabold text-2xl tracking-tight text-[var(--ink)]">
          {dashboard.title}
        </h2>
        {dashboard.subtitle && (
          <p className="mt-1 font-mono text-xs text-[var(--mid)]">
            {dashboard.subtitle}
          </p>
        )}
      </header>
      <div className="flex flex-col gap-4">
        {dashboard.cards.map((card) => {
          // Card data binding uses the same card_id the planner emitted.
          const resolvedCardId = resolveCardId(card.id, toolResultsByCardId);
          const result = resolvedCardId
            ? toolResultsByCardId[resolvedCardId]
            : undefined;
          const data = result?.status === "ok" ? result.data : null;

          if (result?.status === "error") {
            return (
              <ErrorCard key={card.id} title={card.title} error={result.error} />
            );
          }
          if (card.type === "line") {
            return <CardLine key={card.id} card={card} toolData={data} />;
          }
          if (card.type === "scorecard") {
            return (
              <CardScorecard key={card.id} card={card} toolData={data} />
            );
          }
          return null;
        })}
      </div>
      {dashboard.sources.length > 0 && (
        <footer className="mt-2 border-t border-[var(--hairline)] pt-3 font-mono text-[10px] tracking-[0.14em] uppercase text-[var(--mid)] flex flex-wrap gap-x-4 gap-y-1">
          <span className="text-[var(--ink)]">source ·</span>
          {dashboard.sources.map((s, i) => (
            <span key={i}>
              {i > 0 && <span className="text-[var(--mid)]/50 mr-2">·</span>}
              {s.url ? (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-[var(--amber)] transition-colors"
                  style={{ transitionDuration: "var(--dur-instant)" }}
                >
                  {s.label}
                </a>
              ) : (
                s.label
              )}
            </span>
          ))}
        </footer>
      )}
    </div>
  );
}

/**
 * The composer is supposed to re-use the planner's card_id verbatim in
 * each card's data binding, but in practice it sometimes invents a new
 * id (e.g. "unemployment-now" + "unemployment-line" off a single
 * "unemployment" tool call). Try the card.id first, then fall back to
 * the only key in the result map when there's exactly one — that's the
 * dominant case for single-indicator dashboards.
 */
function resolveCardId(
  cardId: string,
  results: Record<string, ToolCallResult>,
): string | undefined {
  if (results[cardId]) return cardId;
  const keys = Object.keys(results);
  if (keys.length === 1) return keys[0];
  // Try a prefix match — e.g. card.id="unemployment-line" → key="unemployment".
  const match = keys.find(
    (k) => cardId.startsWith(k) || cardId.includes(k) || k.includes(cardId),
  );
  return match;
}

function ErrorCard({ title, error }: { title: string; error?: string }) {
  return (
    <div className="border border-[var(--mid)]/40 bg-[var(--surface-elevated)] p-5">
      <div className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--mid)] pb-2 border-b border-[var(--hairline)]">
        error · tool call failed
      </div>
      <h3 className="mt-3 font-mono font-semibold text-[var(--ink)]">{title}</h3>
      <p className="mt-2 font-mono text-xs text-[var(--mid)]">
        {error ?? "unknown error"}
      </p>
    </div>
  );
}
