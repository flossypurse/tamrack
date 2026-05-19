"use client";

import { useState } from "react";
import { X } from "lucide-react";

// In-app banner for grandfathered EDO and Realtor users. Surfaces on every
// /edo/* and /realtor/* page; dismissible per-session via localStorage.
// Sunset announced 2026-05-18.

export type SunsetProduct = "edo" | "realtor";

const COPY: Record<SunsetProduct, { text: string; accent: string }> = {
  edo: {
    text:
      "Pulse EDO is closed to new signups. Your subscription continues as-is — same dashboard, same exports, same price.",
    accent: "indigo",
  },
  realtor: {
    text:
      "Pulse Real Estate is closed to new signups. Your subscription continues as-is — same dashboard, same exports, same price.",
    accent: "teal",
  },
};

const STORAGE_KEY_PREFIX = "apc-sunset-banner-dismissed:";

export function SunsetBanner({ product }: { product: SunsetProduct }) {
  const storageKey = `${STORAGE_KEY_PREFIX}${product}`;
  const initialDismissed =
    typeof window !== "undefined" && window.localStorage.getItem(storageKey) === "1";
  const [dismissed, setDismissed] = useState(initialDismissed);

  if (dismissed) return null;

  const { text, accent } = COPY[product];
  const accentClasses =
    accent === "indigo"
      ? "border-indigo-500/30 bg-indigo-500/5 text-indigo-100"
      : "border-teal-500/30 bg-teal-500/5 text-teal-100";

  function handleDismiss() {
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // localStorage may be unavailable; dismissal will just last the session.
    }
    setDismissed(true);
  }

  return (
    <div
      className={`border-b ${accentClasses} px-4 py-2 flex items-center justify-between gap-3 text-xs sm:text-sm`}
      role="status"
    >
      <span className="leading-snug">{text}</span>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss notice"
        className="p-1 rounded hover:bg-white/10 transition-colors shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  );
}
