"use client";

import { useState, useCallback } from "react";
import { Code, Copy, Check, Share2, X } from "lucide-react";

export function ChartPageActions({
  chartId,
  title,
}: {
  chartId: string;
  title: string;
}) {
  const [showEmbed, setShowEmbed] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://albertapulsecheck.ca";
  const embedSnippet = `<div data-ap-chart="${chartId}"></div>\n<script src="${origin}/embed/widget.js"><\/script>`;
  const chartUrl = `${origin}/charts/${chartId}`;
  const shareText = `${title} — Alberta Pulse Check`;

  const copyToClipboard = useCallback(
    async (text: string, label: string) => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    },
    []
  );

  return (
    <div className="space-y-3">
      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => copyToClipboard(chartUrl, "link")}
          className="flex items-center gap-1.5 text-xs px-3 py-2 bg-card border border-card-border rounded-lg hover:border-accent transition-colors"
        >
          {copied === "link" ? (
            <Check size={12} className="text-accent-green" />
          ) : (
            <Share2 size={12} />
          )}
          {copied === "link" ? "Link copied!" : "Copy link"}
        </button>
        <button
          onClick={() => setShowEmbed(!showEmbed)}
          className={`flex items-center gap-1.5 text-xs px-3 py-2 bg-card border rounded-lg transition-colors ${
            showEmbed
              ? "border-accent text-accent"
              : "border-card-border hover:border-accent"
          }`}
        >
          <Code size={12} />
          Embed
        </button>
        <a
          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(chartUrl)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs px-3 py-2 bg-card border border-card-border rounded-lg hover:border-accent transition-colors"
        >
          Share on X
        </a>
        <a
          href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(chartUrl)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs px-3 py-2 bg-card border border-card-border rounded-lg hover:border-accent transition-colors"
        >
          Share on LinkedIn
        </a>
      </div>

      {/* Embed code panel */}
      {showEmbed && (
        <div className="bg-card border border-card-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted uppercase tracking-wider">
              Embed Code
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => copyToClipboard(embedSnippet, "embed")}
                className="flex items-center gap-1 text-xs text-accent hover:text-accent/80 transition-colors"
              >
                {copied === "embed" ? (
                  <Check size={12} />
                ) : (
                  <Copy size={12} />
                )}
                {copied === "embed" ? "Copied!" : "Copy"}
              </button>
              <button
                onClick={() => setShowEmbed(false)}
                className="text-muted hover:text-foreground transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </div>
          <pre className="text-[11px] bg-background rounded-lg p-3 overflow-x-auto text-muted font-mono leading-relaxed whitespace-pre-wrap break-all">
            {embedSnippet}
          </pre>
          <p className="text-[10px] text-muted/60 mt-2">
            Paste this snippet into any webpage. The chart loads live data
            automatically.
          </p>
        </div>
      )}
    </div>
  );
}
