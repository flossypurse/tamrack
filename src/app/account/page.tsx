"use client";

import { useSession } from "next-auth/react";
import { signOutAction } from "@/lib/actions/auth";
import { User, LogOut, Mail, Calendar } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";

export default function AccountPage() {
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Account"
        category="tools"
      />

      <div className="bg-card border border-card-border rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <User size={18} className="text-accent" />
          <h2 className="font-semibold">Profile</h2>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Mail size={14} className="text-muted" />
            <span className="text-sm">{user?.email ?? "—"}</span>
          </div>
          {user?.name && (
            <div className="flex items-center gap-3">
              <User size={14} className="text-muted" />
              <span className="text-sm">{user.name}</span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Calendar size={14} className="text-muted" />
            <span className="text-sm text-muted">
              Subscription: {user?.subscriptionStatus ?? "none"}
              {user?.role === "admin" && (
                <span className="ml-2 text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded">Admin</span>
              )}
            </span>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Link
            href="/billing"
            className="px-4 py-2 border border-card-border rounded-lg text-sm hover:bg-card-border/30 transition-colors"
          >
            Manage billing
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex items-center gap-2 px-4 py-2 border border-accent-red/30 rounded-lg text-sm text-accent-red hover:bg-accent-red/5 transition-colors"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
