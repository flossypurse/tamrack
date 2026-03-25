"use client";

import { Download } from "lucide-react";
import { useState } from "react";

export function ExportButton({
  municipalitySlug,
  municipalityName,
}: {
  municipalitySlug: string;
  municipalityName: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/edo/profile-pdf?municipality=${encodeURIComponent(municipalitySlug)}`,
      );
      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${municipalityName.replace(/\s+/g, "-")}-Community-Profile.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF export failed:", err);
      alert("PDF export failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg transition-colors print:hidden"
    >
      <Download size={14} />
      {loading ? "Generating…" : "Export PDF"}
    </button>
  );
}
