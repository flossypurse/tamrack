"use client";

import { usePathname } from "next/navigation";
import { Nav } from "./nav";
import { Breadcrumbs } from "./breadcrumbs";
import { Footer } from "./footer";
import { shouldShowSectionSidebar } from "./section-sidebar";

const publicRoutes = ["/", "/login", "/terms", "/privacy", "/access-request"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic =
    publicRoutes.includes(pathname) || pathname.startsWith("/embed/");

  // EDO, Realtor, and Learn products have their own layouts — skip charts nav
  const isEdoRoute = pathname.startsWith("/edo");
  const isRealtorRoute = pathname.startsWith("/realtor");
  const isLearnRoute = pathname.startsWith("/learn");

  if (isPublic || isEdoRoute || isRealtorRoute || isLearnRoute) {
    return <>{children}</>;
  }

  const hasSidebar = shouldShowSectionSidebar(pathname);

  return (
    <>
      <Nav />
      {/* Desktop: top bar spacer */}
      <div className="hidden lg:block h-12" />
      {/* Mobile: top bar spacer */}
      <div className="lg:hidden h-[52px]" />

      {/* Content area */}
      <div className={`${hasSidebar ? "lg:pl-56" : ""} transition-[padding-left] duration-200`}>
        <div className="px-4 pt-3 sm:px-6 sm:pt-4">
          <Breadcrumbs />
        </div>
        {children}
      </div>

      <Footer />

      {/* Mobile: bottom tab bar spacer */}
      <div className="lg:hidden h-14" />
    </>
  );
}
