"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  TrendingUp,
  Users,
  MapPin,
  Home,
  FileText,
  Settings,
  LogOut,
  ChevronRight,
  Activity,
} from "lucide-react";
import { signOut } from "next-auth/react";
import type { ElementType, ReactNode } from "react";

type RealtorNavItem = {
  href: string;
  label: string;
  icon: ElementType;
};

const realtorNavItems: RealtorNavItem[] = [
  { href: "/realtor/market", label: "Market", icon: TrendingUp },
  { href: "/realtor/prospects", label: "Prospects", icon: Users },
  { href: "/realtor/neighbourhoods", label: "Neighbourhoods", icon: MapPin },
  { href: "/realtor/listings", label: "Listings", icon: Home },
  { href: "/realtor/reports", label: "Reports", icon: FileText },
  { href: "/realtor/settings", label: "Settings", icon: Settings },
];

function RealtorSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex flex-col w-56 fixed top-12 bottom-0 left-0 border-r border-card-border bg-background z-30">
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {realtorNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-teal-500/10 text-teal-400 font-medium"
                  : "text-muted hover:text-foreground hover:bg-card-border/30"
              }`}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-card-border p-3">
        <Link
          href="/billing"
          className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted hover:text-foreground transition-colors"
        >
          Billing
          <ChevronRight size={12} />
        </Link>
      </div>
    </aside>
  );
}

function RealtorTopBar() {
  const { data: session } = useSession();
  const operatingArea = session?.user?.operatingArea as string[] | null | undefined;

  const areaLabel = operatingArea?.length
    ? operatingArea.length === 1
      ? operatingArea[0]
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ")
      : `${operatingArea.length} municipalities`
    : "Select Area";

  return (
    <header className="fixed top-0 left-0 right-0 h-12 bg-background/95 backdrop-blur-sm border-b border-card-border z-40 flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <Link href="/realtor/market" className="flex items-center gap-2">
          <Activity size={18} className="text-teal-400" />
          <span className="font-semibold text-sm">Pulse Realtor</span>
        </Link>
        <span className="text-muted/40">|</span>
        <span className="text-sm text-muted">{areaLabel}</span>
      </div>

      <div className="flex items-center gap-3">
        <span className="hidden sm:inline text-[10px] font-mono px-2 py-0.5 bg-teal-500/10 text-teal-400 rounded-full">
          REALTOR
        </span>
        <span className="text-xs text-muted hidden sm:inline">
          {session?.user?.email}
        </span>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="p-1.5 text-muted hover:text-foreground transition-colors"
          title="Sign out"
        >
          <LogOut size={14} />
        </button>
      </div>
    </header>
  );
}

function RealtorMobileNav() {
  const pathname = usePathname();
  const items = realtorNavItems.slice(0, 5); // First 5 items for mobile

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-14 bg-background/95 backdrop-blur-sm border-t border-card-border z-40 flex items-center justify-around px-2">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] transition-colors ${
              isActive ? "text-teal-400" : "text-muted"
            }`}
          >
            <Icon size={18} />
            <span>{item.label.split(" ")[0]}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function RealtorLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <RealtorTopBar />
      <RealtorSidebar />
      {/* Desktop: top bar spacer */}
      <div className="hidden lg:block h-12" />
      {/* Mobile: top bar spacer */}
      <div className="lg:hidden h-[52px]" />

      {/* Content area */}
      <div className="lg:pl-56 transition-[padding-left] duration-200">
        {children}
      </div>

      {/* Mobile: bottom nav spacer */}
      <div className="lg:hidden h-14" />
      <RealtorMobileNav />
    </>
  );
}
