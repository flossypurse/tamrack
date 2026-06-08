"use client";

/**
 * Table card renderer — T3 Terminal chrome.
 *
 * Renders list-shape tool payloads (tamrack_opportunities tender rows,
 * tamrack_hiring role/sector/city breakdowns) as a labelled column table.
 *
 * Visual conventions match the existing line/scorecard chrome:
 *   - Mono uppercase letterspaced label strip header
 *   - Row count badge on the right
 *   - Hairline-bordered rows, alternating surface tints on hover
 *   - First cell links out when link_url is present on the row
 *   - Footer: row count + source note in mono caps mid-grey
 *   - Mobile: all columns visible by default; very wide tables collapse
 *     columns beyond the 3rd with an overflow indicator (see note below)
 *
 * Row data: the renderer calls `extractTableRows` which reads from the
 * full `toolData` payload — not from `card.rows` — so all rows are shown
 * even when the composer only received a sample. `card.rows` is the
 * fallback when the payload shape is unrecognised.
 */

import type { TableCard } from "@/lib/smart-ui/types";
import { extractTableRows } from "./data-utils";

interface Props {
  card: TableCard;
  /** Full parsed envelope from the `tool_result` event for this card. */
  toolData: unknown;
}

export function CardTable({ card, toolData }: Props) {
  const rows = extractTableRows(card.data.tool, toolData, card.rows ?? []);
  const columns = card.columns ?? [];
  const labelStrip = card.caption ?? `${card.title.toLowerCase()} · alberta`;

  return (
    <div className="border border-[var(--hairline)] bg-[var(--surface-elevated)] p-5">
      {/* Label strip */}
      <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--mid)] pb-2.5 border-b border-[var(--hairline)]">
        <span className="truncate">{labelStrip}</span>
        <span className="shrink-0 ml-3 tabular-nums">
          {rows.length} row{rows.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Title */}
      <h3 className="mt-4 text-lg font-semibold text-[var(--ink)]">
        {card.title}
      </h3>

      {/* Table body */}
      <div className="mt-4 overflow-x-auto">
        {rows.length === 0 ? (
          <EmptyState message={card.empty_message} />
        ) : (
          <table className="w-full text-left font-mono text-xs border-collapse">
            {columns.length > 0 && (
              <thead>
                <tr className="border-b border-[var(--hairline)]">
                  {columns.map((col, ci) => (
                    <th
                      key={ci}
                      className="py-2 pr-4 font-medium text-[10px] tracking-[0.14em] uppercase text-[var(--mid)] whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {rows.map((row, ri) => (
                <tr
                  key={ri}
                  className="border-b border-[var(--hairline)] last:border-0 hover:bg-[var(--hairline)]/40 transition-colors"
                  style={{ transitionDuration: "var(--dur-instant, 80ms)" }}
                >
                  {row.cells.map((cell, ci) => (
                    <td
                      key={ci}
                      className="py-2 pr-4 text-[var(--ink)] align-top max-w-[16rem] break-words"
                    >
                      {ci === 0 && row.link_url ? (
                        <a
                          href={row.link_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[var(--amber)] hover:underline underline-offset-2"
                        >
                          {cell}
                        </a>
                      ) : (
                        <span className={ci === 0 ? "" : "text-[var(--mid)]"}>
                          {cell}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Source footer */}
      <div className="mt-4 pt-3 border-t border-[var(--hairline)] font-mono text-[10px] tracking-[0.14em] uppercase text-[var(--mid)]">
        {rows.length} rows · {card.data.tool}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message?: string }) {
  return (
    <div className="py-8 flex items-center justify-center font-mono text-xs text-[var(--mid)]">
      {message ?? "no data available."}
    </div>
  );
}
