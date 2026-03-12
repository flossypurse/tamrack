"use client";

import { usePathname } from "next/navigation";
import { Nav } from "./nav";
import { Breadcrumbs } from "./breadcrumbs";

const publicRoutes = ["/", "/login", "/terms", "/privacy", "/pricing"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = publicRoutes.includes(pathname) || pathname.startsWith("/embed/");

  if (isPublic) {
    return <>{children}</>;
  }

  return (
    <>
      <Nav />
      {/* Mobile top bar spacer */}
      <div className="lg:hidden h-[52px]" />
      {/* Content offset for desktop rail (56px = w-14) */}
      <div className="lg:pl-14 overflow-x-hidden">
        <div className="px-4 pt-3 sm:px-6 sm:pt-4">
          <Breadcrumbs />
        </div>
        {children}
      </div>
    </>
  );
}
