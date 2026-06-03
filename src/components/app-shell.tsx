"use client";

import { usePathname } from "next/navigation";
import { Nav } from "./nav";
import { Footer } from "./footer";

// Pages that render with no global chrome at all.
const publicRoutes = ["/", "/login", "/terms", "/privacy"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // The home, login, and legal pages own their full layout. The /account
  // workspace is a full-screen app surface with its own layout (left rail +
  // chat + history) and deliberately carries no global chrome. Embeds are bare.
  const isBare =
    publicRoutes.includes(pathname) || pathname.startsWith("/embed/");
  const isAccountRoute = pathname.startsWith("/account");

  if (isBare || isAccountRoute) {
    return <>{children}</>;
  }

  // Remaining surfaces (charts, saved dashboards, admin) get the slim nav.
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
