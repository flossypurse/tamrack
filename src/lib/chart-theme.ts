// Centralized chart theme colors — reads CSS variables at render time
// Used by Recharts components that need raw color strings

export function getChartTheme() {
  if (typeof window === "undefined") {
    // SSR fallback (light mode defaults)
    return {
      grid: "#e5e7eb",
      axis: "#9ca3af",
      tooltipBg: "#ffffff",
      tooltipBorder: "#e2e4e9",
      tooltipText: "#1a1a2e",
    };
  }
  const s = getComputedStyle(document.documentElement);
  return {
    grid: s.getPropertyValue("--grid").trim() || "#e5e7eb",
    axis: s.getPropertyValue("--axis").trim() || "#9ca3af",
    tooltipBg: s.getPropertyValue("--tooltip-bg").trim() || "#ffffff",
    tooltipBorder: s.getPropertyValue("--tooltip-border").trim() || "#e2e4e9",
    tooltipText: s.getPropertyValue("--tooltip-text").trim() || "#1a1a2e",
  };
}
