"use client";

import { usePathname } from "next/navigation";
import { Nav } from "./nav";

const publicRoutes = ["/", "/login", "/terms", "/privacy", "/pricing"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = publicRoutes.includes(pathname);

  if (isPublic) {
    return <>{children}</>;
  }

  return (
    <>
      <Nav />
      {/* Mobile top bar spacer */}
      <div className="lg:hidden h-[52px]" />
      {/* Content offset for desktop sidebar */}
      <div className="lg:pl-56 overflow-x-hidden">{children}</div>
    </>
  );
}
