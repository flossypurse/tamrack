"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  PieChart,
  Home,
  Users,
  MoreHorizontal,
  CloudSun,
  Landmark,
  Globe,
  Wrench,
  User,
  X,
} from "lucide-react";

const primaryTabs = [
  { key: "home", label: "Home", icon: LayoutDashboard, href: "/home/dashboard", prefix: "/home" },
  { key: "economy", label: "Economy", icon: PieChart, href: "/economy", prefix: "/economy" },
  { key: "real-estate", label: "Real Estate", icon: Home, href: "/real-estate", prefix: "/real-estate" },
  { key: "community", label: "Community", icon: Users, href: "/community", prefix: "/community" },
];

const moreTabs = [
  { key: "environment", label: "Environment", icon: CloudSun, href: "/environment", prefix: "/environment" },
  { key: "governance", label: "Governance", icon: Landmark, href: "/governance", prefix: "/governance" },
  { key: "municipalities", label: "Municipalities", icon: Globe, href: "/municipalities", prefix: "/municipalities" },
  { key: "tools", label: "Tools", icon: Wrench, href: "/tools", prefix: "/tools" },
  { key: "account", label: "Account", icon: User, href: "/account", prefix: "/account" },
];

export function MobileTabs() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const isMoreActive = moreTabs.some((t) => pathname.startsWith(t.prefix));

  return (
    <>
      {/* More sheet backdrop */}
      {moreOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* More sheet */}
      {moreOpen && (
        <div className="lg:hidden fixed bottom-[56px] left-0 right-0 z-50 bg-card border-t border-card-border rounded-t-xl shadow-lg p-3">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-medium uppercase tracking-wider text-muted">
              More
            </span>
            <button
              onClick={() => setMoreOpen(false)}
              className="p-1 rounded-md text-muted hover:text-foreground"
            >
              <X size={16} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {moreTabs.map((tab) => {
              const Icon = tab.icon;
              const active = pathname.startsWith(tab.prefix);
              return (
                <Link
                  key={tab.key}
                  href={tab.href}
                  onClick={() => setMoreOpen(false)}
                  className={`flex flex-col items-center gap-1 py-3 rounded-lg transition-colors ${
                    active
                      ? "bg-accent/10 text-accent"
                      : "text-muted hover:text-foreground hover:bg-foreground/[0.05]"
                  }`}
                >
                  <Icon size={20} />
                  <span className="text-[11px]">{tab.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom tab bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-card-border safe-area-bottom">
        <div className="flex items-center justify-around h-14">
          {primaryTabs.map((tab) => {
            const Icon = tab.icon;
            const active = pathname.startsWith(tab.prefix);
            return (
              <Link
                key={tab.key}
                href={tab.href}
                className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg transition-colors ${
                  active
                    ? "text-accent"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <Icon size={20} />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg transition-colors ${
              isMoreActive || moreOpen
                ? "text-accent"
                : "text-muted hover:text-foreground"
            }`}
          >
            <MoreHorizontal size={20} />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
