import { ReactNode } from "react";
import type { Category } from "./page-header";

const categoryColors: Record<Category, string> = {
  overview: "var(--cat-overview)",
  economy: "var(--cat-economy)",
  realestate: "var(--cat-realestate)",
  intelligence: "var(--cat-intelligence)",
  environment: "var(--cat-environment)",
  safety: "var(--cat-safety)",
  municipalities: "var(--cat-municipalities)",
  tools: "var(--cat-tools)",
  health: "var(--cat-health)",
  learn: "var(--cat-learn)",
};

/**
 * Standardized section header (h2) with category-tinted icon.
 *
 * Always renders: icon (in category color) + uppercase label
 * Consistent: text-sm font-medium uppercase tracking-wider
 */
export function SectionHeader({
  title,
  icon,
  category,
  className = "",
}: {
  title: string;
  icon?: ReactNode;
  category: Category;
  className?: string;
}) {
  const color = categoryColors[category];

  return (
    <div className={`flex items-center gap-2 mb-3 ${className}`}>
      {icon && (
        <span style={{ color: color }} className="shrink-0">
          {icon}
        </span>
      )}
      <h2 className="text-sm font-medium text-muted uppercase tracking-wider">
        {title}
      </h2>
    </div>
  );
}
