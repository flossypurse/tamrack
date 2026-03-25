"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Building2,
  GitCompare,
  Bell,
  FileText,
  Presentation,
  UserCircle,
  Settings,
  Activity,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { signOut } from "next-auth/react";
import type { ElementType, ReactNode } from "react";

type EdoNavItem = {
  href: string;
  label: string;
  icon: ElementType;
};

const edoNavItems: EdoNavItem[] = [
  { href: "/edo", label: "My Municipality", icon: Building2 },
  { href: "/edo/compare", label: "Compare", icon: GitCompare },
  { href: "/edo/alerts", label: "Alerts", icon: Bell },
  { href: "/edo/reports", label: "Reports", icon: FileText },
  { href: "/edo/pitch", label: "Pitch Kit", icon: Presentation },
  { href: "/edo/profile-builder", label: "Profile Builder", icon: UserCircle },
  { href: "/edo/settings", label: "Settings", icon: Settings },
];

function EdoSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex flex-col w-56 fixed top-12 bottom-0 left-0 border-r border-card-border bg-background z-30">
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {edoNavItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/edo"
              ? pathname === "/edo"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-indigo-500/10 text-indigo-400 font-medium"
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

function EdoTopBar() {
  const { data: session } = useSession();
  const municipalityId = session?.user?.municipalityId;

  // Format municipality name from slug
  const municipalityName = municipalityId
    ? municipalityId
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
    : "Select Municipality";

  return (
    <header className="fixed top-0 left-0 right-0 h-12 bg-background/95 backdrop-blur-sm border-b border-card-border z-40 flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <Link href="/edo" className="flex items-center gap-2">
          <Activity size={18} className="text-indigo-400" />
          <span className="font-semibold text-sm">Pulse EDO</span>
        </Link>
        <span className="text-muted/40">|</span>
        <span className="text-sm text-muted">{municipalityName}</span>
      </div>

      <div className="flex items-center gap-3">
        <span className="hidden sm:inline text-[10px] font-mono px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded-full">
          EDO
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

function EdoMobileNav() {
  const pathname = usePathname();
  const items = edoNavItems.slice(0, 5); // First 5 items for mobile

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-14 bg-background/95 backdrop-blur-sm border-t border-card-border z-40 flex items-center justify-around px-2">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.href === "/edo"
            ? pathname === "/edo"
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] transition-colors ${
              isActive ? "text-indigo-400" : "text-muted"
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

export default function EdoLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <EdoTopBar />
      <EdoSidebar />
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
      <EdoMobileNav />
    </>
  );
}
