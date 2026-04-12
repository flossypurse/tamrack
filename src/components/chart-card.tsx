"use client";

import { useRef, useState, useCallback, type ReactNode } from "react";
import { Code, Check, Copy, Download, X } from "lucide-react";
import { toPng } from "html-to-image";

interface ChartCardProps {
  /** Unique chart ID matching the embed registry (e.g. "macro-policy-rate", "edmonton-assessment-by-zone") */
  chartId: string;
  /** Chart title shown in export watermark */
  title: string;
  /** Human-readable time range (e.g. "Jan 2006 – Mar 2026 · 20 years") */
  timeRange?: string;
  /** Data source attribution (e.g. "Bank of Canada", "StatsCan 36-10-0402") */
  source?: string;
  /** Chart content (the actual Recharts component) */
  children: ReactNode;
}

export function ChartCard({ chartId, title, timeRange, source, children }: ChartCardProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [showEmbed, setShowEmbed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://albertapulsecheck.ca";
  const embedSnippet = `<div data-ap-chart="${chartId}"></div>\n<script src="${origin}/embed/widget.js"><\/script>`;

  const shareUrl = `${origin}/embed/${chartId}`;
  const shareText = `${title} — Alberta Pulse Check`;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(embedSnippet);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = embedSnippet;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [embedSnippet]);

  const handleExport = useCallback(async () => {
    if (!chartRef.current || exporting) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(chartRef.current, {
        backgroundColor: "#18181b",
        pixelRatio: 2,
        style: {
          padding: "16px",
        },
      });
      const link = document.createElement("a");
      link.download = `alberta-pulse-${chartId}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  }, [chartId, exporting]);

  const handleShareTwitter = useCallback(() => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, "_blank", "noopener,noreferrer,width=550,height=420");
  }, [shareText, shareUrl]);

  const handleShareLinkedIn = useCallback(() => {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
    window.open(url, "_blank", "noopener,noreferrer,width=550,height=420");
  }, [shareUrl]);

  return (
    <div className="relative">
      {/* Chart content — ref for PNG export */}
      <div ref={chartRef}>
        {children}
      </div>

      {/* Bottom toolbar: time range + source on left, actions on right */}
      <div className="flex items-center justify-between mt-1.5 px-1 gap-2">
        {/* Left side: time range + source */}
        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          {timeRange && (
            <span className="text-[9px] text-muted/60 font-mono whitespace-nowrap">
              {timeRange}
            </span>
          )}
          {source && (
            <span className="text-[9px] text-muted/40 font-mono whitespace-nowrap truncate">
              {timeRange ? "·" : ""} {source}
            </span>
          )}
          {!timeRange && !source && (
            <span className="text-[8px] text-muted/30 font-mono">
              albertapulsecheck.ca
            </span>
          )}
        </div>

        {/* Right side: action buttons — always visible */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={handleShareTwitter}
            className="text-[9px] text-muted/40 hover:text-accent transition-colors px-1.5 py-0.5 rounded"
            title="Share on X/Twitter"
          >
            𝕏
          </button>
          <button
            onClick={handleShareLinkedIn}
            className="text-[9px] text-muted/40 hover:text-accent transition-colors px-1.5 py-0.5 rounded"
            title="Share on LinkedIn"
          >
            in
          </button>
          <button
            onClick={() => setShowEmbed(!showEmbed)}
            className="flex items-center gap-0.5 text-[9px] text-muted/40 hover:text-accent transition-colors px-1.5 py-0.5 rounded"
            title="Embed this chart"
          >
            <Code size={10} />
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-0.5 text-[9px] text-muted/40 hover:text-accent transition-colors px-1.5 py-0.5 rounded disabled:opacity-50"
            title="Download as PNG"
          >
            <Download size={10} />
          </button>
        </div>
      </div>

      {/* Embed code popover — anchored to bottom-right */}
      {showEmbed && (
        <div className="absolute bottom-8 right-0 z-50 w-80 bg-card border border-card-border rounded-lg shadow-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-medium text-muted uppercase tracking-wider">
              Embed Code
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-[10px] text-accent hover:text-accent/80 transition-colors"
              >
                {copied ? <Check size={10} /> : <Copy size={10} />}
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                onClick={() => setShowEmbed(false)}
                className="text-muted hover:text-foreground transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          </div>
          <pre className="text-[9px] bg-background rounded p-2 overflow-x-auto text-muted font-mono leading-relaxed whitespace-pre-wrap break-all">
            {embedSnippet}
          </pre>
          <p className="text-[9px] text-muted/60 mt-2">
            Add this snippet to any website. The chart loads live data automatically.
          </p>
        </div>
      )}
    </div>
  );
}
