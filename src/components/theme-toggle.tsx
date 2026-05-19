"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { TSun, TMoon } from "./icons/t3";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="p-1.5 text-[var(--mid)] hover:text-[var(--amber)] transition-colors"
      style={{ transitionDuration: "var(--dur-instant)" }}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {mounted && (isDark ? <TSun size={16} /> : <TMoon size={16} />)}
      {!mounted && <span style={{ display: "inline-block", width: 16, height: 16 }} />}
    </button>
  );
}
