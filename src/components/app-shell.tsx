"use client";

import { usePathname } from "next/navigation";
import { Nav } from "./nav";
import { Breadcrumbs } from "./breadcrumbs";
import { useSidebar } from "./sidebar-context";

const publicRoutes = ["/", "/login", "/terms", "/privacy", "/pricing"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { expanded } = useSidebar();
  const isPublic = publicRoutes.includes(pathname) || pathname.startsWith("/embed/");

  if (isPublic) {
    return <>{children}</>;
  }

  return (
    <>
      <Nav />
      {/* Mobile top bar spacer */}
      <div className="lg:hidden h-[52px]" />
      {/* Content offset for desktop rail — transitions with sidebar */}
      <div
        className="overflow-x-hidden transition-[padding-left] duration-200"
        style={{ paddingLeft: undefined }}
      >
        <div className={`hidden lg:block ${expanded ? "pl-52" : "pl-14"} transition-[padding-left] duration-200`}>
          <div className="px-4 pt-3 sm:px-6 sm:pt-4">
            <Breadcrumbs />
          </div>
        </div>
        <div className={`lg:hidden`}>
          <div className="px-4 pt-3 sm:px-6 sm:pt-4">
            <Breadcrumbs />
          </div>
        </div>
        <div className={`${expanded ? "lg:pl-52" : "lg:pl-14"} transition-[padding-left] duration-200`}>
          {children}
        </div>
      </div>
    </>
  );
}
