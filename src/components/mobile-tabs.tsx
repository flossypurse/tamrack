"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { BarChart3, Sparkles, User, LogIn } from "lucide-react";

export function MobileTabs() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const signedIn = !!session?.user;

  const tabs = signedIn
    ? [
        { key: "charts", label: "Charts", icon: BarChart3, href: "/charts", prefix: "/charts" },
        { key: "chat", label: "Ask", icon: Sparkles, href: "/account/chat", prefix: "/account/chat" },
        { key: "account", label: "Account", icon: User, href: "/account", prefix: "/account" },
      ]
    : [
        { key: "charts", label: "Charts", icon: BarChart3, href: "/charts", prefix: "/charts" },
        { key: "signin", label: "Sign in", icon: LogIn, href: "/login", prefix: "/login" },
      ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-card-border safe-area-bottom">
      <div className="flex items-center justify-around h-14">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active =
            tab.key === "account"
              ? pathname === "/account" || (pathname.startsWith("/account") && !pathname.startsWith("/account/chat"))
              : pathname.startsWith(tab.prefix);
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg transition-colors ${
                active ? "text-accent" : "text-muted hover:text-foreground"
              }`}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
