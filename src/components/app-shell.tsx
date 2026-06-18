"use client";

import { usePathname } from "next/navigation";
import { Nav } from "./nav";
import { Footer } from "./footer";

// Pages that render with no global chrome at all.
const publicRoutes = ["/", "/login", "/terms", "/privacy"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // The home, login, and legal pages own their full layout. The public chart
  // catalogue has its own quiet chrome (src/app/charts/layout.tsx) and must NOT
  // carry the app navigation. The /account workspace is a full-screen app
  // surface with its own layout. Embeds are bare.
  const isBare =
    publicRoutes.includes(pathname) ||
    pathname === "/charts" ||
    pathname.startsWith("/charts/") ||
    pathname.startsWith("/embed/");
  const isAccountRoute = pathname.startsWith("/account");

  if (isBare || isAccountRoute) {
    return <>{children}</>;
  }

  // Remaining surfaces (saved dashboards, admin) get the slim nav.
  return (
    <>
      <Nav />
      {/* Desktop: top bar spacer */}
      <div className="hidden lg:block h-12" />
      {/* Mobile: top bar spacer */}
      <div className="lg:hidden h-[52px]" />

      {children}

      <Footer />

      {/* Mobile: bottom tab bar spacer */}
      <div className="lg:hidden h-14" />
    </>
  );
}
