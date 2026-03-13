import { ReactNode } from "react";

/**
 * Category types that map to CSS custom property colors (--cat-*).
 * Each category gets a unique accent for visual identity.
 */
export type Category =
  | "overview"
  | "economy"
  | "realestate"
  | "intelligence"
  | "environment"
  | "safety"
  | "municipalities"
  | "tools"
  | "health";

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
};

const categoryLabels: Record<Category, string> = {
  overview: "Overview",
  economy: "Economy",
  realestate: "Real Estate",
  intelligence: "Intelligence",
  environment: "Environment",
  safety: "Public Safety",
  municipalities: "Municipalities",
  tools: "Tools",
  health: "Health",
};

/**
 * Standardized page header with category identity.
 *
 * Renders: category pill | icon + h1 title | description
 * Plus a subtle top-border gradient in the category color.
 */
export function PageHeader({
  title,
  description,
  category,
  icon,
  children,
}: {
  title: string;
  description?: string;
  category: Category;
  icon?: ReactNode;
  children?: ReactNode;
}) {
  const color = categoryColors[category];
  const label = categoryLabels[category];

  return (
    <div
      className="relative bg-card border border-card-border rounded-xl p-4 sm:p-5 overflow-hidden"
      style={{
        borderTopColor: color,
        borderTopWidth: "2px",
      }}
    >
      {/* Subtle gradient wash from category color */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(to bottom, color-mix(in srgb, ${color} 5%, transparent), transparent 60%)`,
        }}
      />

      <div className="relative flex flex-col gap-2">
        {/* Category pill */}
        <div className="flex items-center gap-3">
          <span
            className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full"
            style={{
              color: color,
              backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`,
            }}
          >
            {label}
          </span>
        </div>

        {/* Title row */}
        <div className="flex items-center gap-2">
          {icon && (
            <span style={{ color: color }} className="shrink-0">
              {icon}
            </span>
          )}
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        </div>

        {/* Description */}
        {description && (
          <p className="text-sm text-muted max-w-2xl">{description}</p>
        )}

        {/* Optional extra content (badges, filters, etc.) */}
        {children && <div className="mt-1">{children}</div>}
      </div>
    </div>
  );
}
