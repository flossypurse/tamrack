import Link from "next/link";

import { auth } from "@/lib/auth";
import { Wordmark } from "@/components/brand/wordmark";
import { ThemeToggle } from "@/components/theme-toggle";
import { Footer } from "@/components/footer";

// The chart catalogue is the public door. It gets the same quiet chrome as the
// homepage — wordmark + a single sign-in/account link + theme — NOT the app
// navigation (which advertises the invite-only workspace). app-shell.tsx treats
// /charts as bare so this is the only chrome here.
export default async function ChartsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const loggedIn = !!session?.user;

  return (
    <>
      <header className="flex items-center justify-between px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center text-[var(--ink)]"
          aria-label="Tamrack — home"
        >
          <Wordmark height={18} />
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href={loggedIn ? "/account" : "/login"}
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--mid)] transition-colors hover:text-[var(--amber)]"
            style={{ transitionDuration: "var(--dur-instant)" }}
          >
            {loggedIn ? "account →" : "sign in →"}
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {children}

      <Footer />
    </>
  );
}
