"use client";

/**
 * Mobile-only chrome for the account workspace. On < md the left and right
 * rails are hidden; this fixed bottom bar exposes them as full-height overlay
 * drawers so the chat keeps the full width by default. The rails are passed in
 * as server-rendered nodes (keys/tokens, history) and only revealed on tap.
 */
import { useState } from "react";
import { TKey, TClose } from "@/components/icons/t3";
import { History } from "lucide-react";

type Drawer = "keys" | "history" | null;

export function MobileWorkspaceBar({
  left,
  right,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  const [open, setOpen] = useState<Drawer>(null);

  return (
    <div className="lg:hidden">
      {/* Bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-center justify-around border-t border-[var(--hairline)] bg-[var(--surface-elevated)]">
        <button
          type="button"
          onClick={() => setOpen("keys")}
          className="flex flex-col items-center gap-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--mid)]"
          aria-label="Keys and tokens"
        >
          <TKey size={16} />
          keys
        </button>
        <button
          type="button"
          onClick={() => setOpen("history")}
          className="flex flex-col items-center gap-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--mid)]"
          aria-label="History"
        >
          <History size={16} />
          history
        </button>
      </nav>

      {/* Drawer overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[var(--surface)]">
          <div className="flex items-center justify-between border-b border-[var(--hairline)] px-4 py-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--mid)]">
              {open === "keys" ? "keys · tokens" : "recent questions"}
            </span>
            <button
              type="button"
              onClick={() => setOpen(null)}
              aria-label="Close"
              className="text-[var(--mid)] hover:text-[var(--ink)]"
            >
              <TClose size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {open === "keys" ? left : right}
          </div>
        </div>
      )}
    </div>
  );
}
