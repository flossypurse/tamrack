"use client";

import { useState } from "react";
import { Code, Check, Copy } from "lucide-react";

export function EmbedButton({
  chartId,
  title,
}: {
  chartId: string;
  title: string;
}) {
  const [copied, setCopied] = useState(false);
  const [showCode, setShowCode] = useState(false);

  const embedUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/embed/${chartId}`;
  const embedCode = `<iframe src="${embedUrl}" width="100%" height="400" frameborder="0" title="${title}" style="border-radius:12px;border:1px solid #27272a;"></iframe>`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = embedCode;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowCode(!showCode)}
        className="flex items-center gap-1 text-[10px] text-muted hover:text-accent transition-colors px-2 py-1 rounded-md hover:bg-foreground/[0.05]"
        title="Embed this chart"
      >
        <Code size={12} />
        Embed
      </button>

      {showCode && (
        <div className="absolute right-0 top-full mt-1 z-50 w-80 bg-card border border-card-border rounded-lg shadow-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-medium text-muted uppercase tracking-wider">
              Embed Code
            </span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-[10px] text-accent hover:text-accent/80 transition-colors"
            >
              {copied ? <Check size={10} /> : <Copy size={10} />}
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <pre className="text-[9px] bg-background rounded p-2 overflow-x-auto text-muted font-mono leading-relaxed whitespace-pre-wrap break-all">
            {embedCode}
          </pre>
          <p className="text-[9px] text-muted/60 mt-2">
            Paste this into any website or CMS to embed this chart.
          </p>
        </div>
      )}
    </div>
  );
}
