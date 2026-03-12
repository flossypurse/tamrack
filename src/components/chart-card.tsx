"use client";

import { useRef, useState, useCallback, type ReactNode } from "react";
import { Code, Check, Copy, Download, X } from "lucide-react";
import { toPng } from "html-to-image";

interface ChartCardProps {
  /** Unique chart ID matching the embed registry (e.g. "macro-policy-rate", "edmonton-assessment-by-zone") */
  chartId: string;
  /** Chart title shown in export watermark */
  title: string;
  /** Chart content (the actual Recharts component) */
  children: ReactNode;
}

export function ChartCard({ chartId, title, children }: ChartCardProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [showEmbed, setShowEmbed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "https://albertapulse.com";
  const embedSnippet = `<div data-ap-chart="${chartId}"></div>\n<script src="${origin}/embed/widget.js"><\/script>`;

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

  return (
    <div className="relative group">
      {/* Action buttons — visible on hover */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => setShowEmbed(!showEmbed)}
          className="flex items-center gap-1 text-[10px] text-muted hover:text-accent transition-colors px-2 py-1 rounded-md bg-card/80 backdrop-blur-sm border border-card-border hover:border-accent/30"
          title="Embed this chart"
        >
          <Code size={12} />
          Embed
        </button>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1 text-[10px] text-muted hover:text-accent transition-colors px-2 py-1 rounded-md bg-card/80 backdrop-blur-sm border border-card-border hover:border-accent/30 disabled:opacity-50"
          title="Download as PNG"
        >
          <Download size={12} />
          {exporting ? "..." : "PNG"}
        </button>
      </div>

      {/* Embed code popover */}
      {showEmbed && (
        <div className="absolute top-10 right-2 z-50 w-80 bg-card border border-card-border rounded-lg shadow-xl p-3">
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

      {/* Chart content — ref for PNG export */}
      <div ref={chartRef}>
        {children}
        {/* Watermark for PNG exports (always rendered but subtle) */}
        <div className="flex items-center justify-end mt-1 px-1">
          <span className="text-[8px] text-muted/30 font-mono">
            albertapulse.com
          </span>
        </div>
      </div>
    </div>
  );
}
