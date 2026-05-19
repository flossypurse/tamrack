/**
 * /account/keys — T3 instrument-panel chrome for the one-shot key display.
 *
 * The key arrives as an HttpOnly cookie set by /api/invite/claim; we
 * render it once, then a server action clears the cookie so a refresh
 * leaves nothing behind. URL never carries the secret.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { AccountSubnav } from "@/components/account-subnav";
import { ONCE_KEY_COOKIE } from "@/lib/invites";
import { KeyOnceCard } from "@/components/key-once-card";
import { TKey } from "@/components/icons/t3";

export const dynamic = "force-dynamic";

async function clearOnceKey(): Promise<void> {
  "use server";
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account/keys");
  }
  const jar = await cookies();
  jar.delete(ONCE_KEY_COOKIE);
  redirect("/account/keys");
}

export default async function ApiKeysPage({
  searchParams,
}: {
  searchParams: Promise<{ invite_redeemed?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account/keys");
  }

  const { invite_redeemed } = await searchParams;
  const jar = await cookies();
  const oncePlaintext = jar.get(ONCE_KEY_COOKIE)?.value ?? null;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <AccountSubnav active="keys" />

      <header className="flex flex-col gap-2">
        <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--mid)]">
          api key · http · bearer token
        </p>
        <h1 className="font-mono text-2xl font-semibold text-[var(--ink)]">
          API key
        </h1>
        <p className="text-sm leading-relaxed text-[var(--ink)]/85">
          A Bearer token for calling the Tamrack HTTP API directly. Same
          namespace as the MCP token; different name so usage logs read
          cleanly.
        </p>
      </header>

      {invite_redeemed === "1" && oncePlaintext && (
        <div className="border border-[var(--amber)]/40 bg-[var(--amber)]/5 p-4">
          <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--mid)] mb-2">
            welcome · founder access · alberta data substrate
          </p>
          <p className="text-sm text-[var(--ink)]/85 leading-relaxed">
            Your founder API key is below — copy it now; we don&apos;t store
            the plaintext and can&apos;t show it again.
          </p>
        </div>
      )}

      {oncePlaintext ? (
        <KeyOnceCard plaintext={oncePlaintext} clearAction={clearOnceKey} />
      ) : (
        <div className="bg-[var(--surface-elevated)] border border-[var(--hairline)] p-6 space-y-4">
          <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--mid)] pb-2.5 border-b border-[var(--hairline)]">
            <span className="flex items-center gap-2">
              <TKey size={12} className="text-[var(--mid)]" />
              api keys · vault · stony plain
            </span>
            <span>idle</span>
          </div>
          <h2 className="font-mono text-lg font-semibold text-[var(--ink)]">
            No key to display
          </h2>
          <p className="text-sm text-[var(--ink)]/85 leading-relaxed">
            Freshly minted keys appear here once after issue. If you missed
            yours, ask Cully for a replacement — the plaintext is never
            stored server-side.
          </p>
        </div>
      )}
    </main>
  );
}
