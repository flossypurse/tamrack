"use client";

/**
 * Renders a freshly minted API key once — T3 instrument-panel chrome.
 *
 * Copy-to-clipboard + a "I've saved it" button that posts to a server
 * action which deletes the cookie. The plaintext is delivered as a prop
 * from the parent server component (which read it from an HttpOnly
 * cookie); it lives in client memory only for the duration of this
 * render.
 */
import { useCallback, useState } from "react";
import { TKey, TCopy, TCheck } from "@/components/icons/t3";

interface Props {
  plaintext: string;
  clearAction: () => Promise<void>;
}

export function KeyOnceCard({ plaintext, clearAction }: Props) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(plaintext);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard refused — user can still select + copy manually.
    }
  }, [plaintext]);

  return (
    <div className="bg-[var(--surface-elevated)] border border-[var(--hairline)] p-6 space-y-4">
      {/* Label strip */}
      <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--mid)] pb-2.5 border-b border-[var(--hairline)]">
        <span className="flex items-center gap-2">
          <TKey size={12} className="text-[var(--amber)]" />
          api key · founder · scope:read · stony plain
        </span>
        <span className="flex items-center gap-2 text-[var(--amber)]">
          <span className="tamrack-dot-live" aria-hidden="true" />
          <span>live · one-shot</span>
        </span>
      </div>

      <h2 className="font-mono text-lg font-semibold text-[var(--ink)]">Your API key</h2>

      <p className="text-sm text-[var(--ink)]/85 leading-relaxed">
        Pass this as{" "}
        <code className="font-mono text-xs text-[var(--amber)]">
          Authorization: Bearer …
        </code>{" "}
        on every request. It carries full read scope across all five Tamrack
        substrates.
      </p>

      <div className="flex items-stretch gap-2">
        <code className="flex-1 px-3 py-2.5 bg-[var(--surface)] border border-[var(--hairline)] text-xs font-mono text-[var(--ink)] break-all select-all">
          {plaintext}
        </code>
        <button
          type="button"
          onClick={onCopy}
          className="px-3 py-2 border border-[var(--hairline)] hover:border-[var(--ink)] text-[var(--ink)] text-sm transition-colors flex items-center gap-1.5"
          style={{ transitionDuration: "var(--dur-instant)" }}
          aria-label="Copy key"
        >
          {copied ? <TCheck size={14} /> : <TCopy size={14} />}
          <span className="font-mono text-[11px] tracking-[0.14em] uppercase">
            {copied ? "copied" : "copy"}
          </span>
        </button>
      </div>

      <form action={clearAction}>
        <button
          type="submit"
          className="font-mono text-[10px] tracking-[0.14em] uppercase text-[var(--mid)] hover:text-[var(--amber)] transition-colors"
          style={{ transitionDuration: "var(--dur-instant)" }}
        >
          i&apos;ve saved it · clear from this page →
        </button>
      </form>
    </div>
  );
}
