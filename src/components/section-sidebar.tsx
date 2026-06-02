"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { sections, buildMunicipalitySubSections } from "./nav-config";
import type { TopLevelSection, NavSubSection } from "./nav-config";

export function SectionSidebar() {
  const pathname = usePathname();

  // Find active section based on pathname
  const activeSection = findActiveSection(pathname);
  if (!activeSection) return null;

  // Get sub-sections (municipalities are dynamic)
  const subSections: NavSubSection[] =
    activeSection.key === "municipalities"
      ? buildMunicipalitySubSections()
      : activeSection.subSections;

  const isActive = (href: string) => {
    // Exact match for overview pages
    if (
      href === "/economy" ||
      href === "/real-estate" ||
      href === "/community" ||
      href === "/environment" ||
      href === "/governance" ||
      href === "/municipalities" ||
      href === "/home/dashboard"
    ) {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <aside className="hidden lg:block fixed top-12 left-0 bottom-0 w-56 bg-card border-r border-card-border overflow-y-auto z-30">
      {/* Section header */}
      <div className="px-4 py-3 border-b border-card-border">
        <div className="flex items-center gap-2">
          <activeSection.icon size={16} className="text-accent shrink-0" />
          <h2 className="text-sm font-semibold text-foreground">
            {activeSection.label}
          </h2>
        </div>
      </div>

      {/* Sub-sections */}
      <div className="py-2">
        {subSections.map((sub, i) => (
          <div key={sub.label || i} className="px-2 mt-1">
            {sub.label && (
              <p className="px-2 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-muted/70">
                {sub.label}
              </p>
            )}
            <div className="space-y-0.5">
              {sub.items.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                      active
                        ? "bg-accent/10 text-accent font-medium"
                        : "text-muted hover:text-foreground hover:bg-foreground/[0.05]"
                    }`}
                  >
                    <Icon
                      size={14}
                      className={active ? "text-accent" : ""}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

/** Find the section that matches the current pathname */
function findActiveSection(pathname: string): TopLevelSection | null {
  // Also match /account, /billing, /tools, /admin — but don't show sidebar for those
  for (const section of sections) {
    if (section.matchPrefixes.some((p) => pathname.startsWith(p))) {
      return section;
    }
  }
  return null;
}

/** Check if the current route should show the section sidebar */
export function shouldShowSectionSidebar(pathname: string): boolean {
  return findActiveSection(pathname) !== null;
}
