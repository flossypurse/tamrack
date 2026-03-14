"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Database, UserPlus, Server } from "lucide-react";

const links = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/system", label: "System", icon: Server },
  { href: "/admin/collection", label: "Collection", icon: Database },
  { href: "/admin/crm", label: "CRM", icon: UserPlus },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 flex-wrap">
      {links.map(({ href, label, icon: Icon }) => {
        const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors border ${
              active
                ? "bg-accent/10 border-accent/30 text-accent"
                : "bg-card border-card-border text-muted hover:text-foreground"
            }`}
          >
            <Icon size={12} />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
