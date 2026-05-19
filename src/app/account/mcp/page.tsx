/**
 * /account/mcp — issue + manage MCP-agent Bearer tokens.
 *
 * Tokens are minted via the same `createApiKey()` infra that backs HTTP
 * API keys (see src/app/api/mcp/AGENT.md — the MCP server reuses the
 * `tk_*` namespace). The only thing this page does differently is the
 * naming convention ("mcp · <date>") and the one-shot cookie (path-scoped
 * to /account/mcp), so the two surfaces can't cross-read each other's
 * plaintext.
 *
 * The page also lists existing active MCP tokens with revoke controls so
 * minting on top of minting doesn't silently orphan tokens the user can
 * no longer see. Hard cap at MCP_KEY_CAP active tokens per user.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { AccountSubnav } from "@/components/account-subnav";
import { KeyOnceCard } from "@/components/key-once-card";
import { TKey } from "@/components/icons/t3";
import {
  createApiKey,
  getUserApiKeys,
  revokeApiKey,
} from "@/lib/api-keys";
import { MCP_ONCE_KEY_COOKIE } from "@/lib/invites";

export const dynamic = "force-dynamic";

const MCP_SCOPES = [
  "tamrack:macro:read",
  "tamrack:regional:read",
  "tamrack:real-estate:read",
  "tamrack:energy:read",
  "tamrack:economy:read",
] as const;

const MCP_NAME_PREFIX = "mcp ·";
const MCP_KEY_CAP = 5;

type McpKey = {
  id: string;
  key_prefix: string;
  name: string;
  last_used_at: string | null;
  created_at: string;
};

async function listActiveMcpKeys(userId: string): Promise<McpKey[]> {
  const all = await getUserApiKeys(userId);
  return all
    .filter((k) => k.revoked_at === null && k.name.startsWith(MCP_NAME_PREFIX))
    .map(({ id, key_prefix, name, last_used_at, created_at }) => ({
      id,
      key_prefix,
      name,
      last_used_at,
      created_at,
    }));
}

async function issueMcpToken(): Promise<void> {
  "use server";
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account/mcp");
  }

  const active = await listActiveMcpKeys(session.user.id);
  if (active.length >= MCP_KEY_CAP) {
    redirect("/account/mcp?error=cap");
  }

  const issuedAt = new Date().toISOString().slice(0, 10);
  const { key } = await createApiKey(
    session.user.id,
    `${MCP_NAME_PREFIX} ${issuedAt}`,
    [...MCP_SCOPES],
  );

  const jar = await cookies();
  jar.set({
    name: MCP_ONCE_KEY_COOKIE,
    value: key,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/account/mcp",
    maxAge: 60 * 5,
  });

  redirect("/account/mcp?minted=1");
}

async function clearOnceToken(): Promise<void> {
  "use server";
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account/mcp");
  }
  const jar = await cookies();
  jar.delete(MCP_ONCE_KEY_COOKIE);
  redirect("/account/mcp");
}

async function revokeMcpToken(formData: FormData): Promise<void> {
  "use server";
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account/mcp");
  }
  const keyId = formData.get("keyId");
  if (typeof keyId !== "string" || !keyId) {
    redirect("/account/mcp");
  }
  await revokeApiKey(keyId as string, session.user.id);
  redirect("/account/mcp?revoked=1");
}

function formatRelative(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default async function AccountMcpPage({
  searchParams,
}: {
  searchParams: Promise<{ minted?: string; revoked?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account/mcp");
  }

  const { minted, revoked, error } = await searchParams;
  const jar = await cookies();
  const oncePlaintext = jar.get(MCP_ONCE_KEY_COOKIE)?.value ?? null;
  const activeKeys = await listActiveMcpKeys(session.user.id);
  const atCap = activeKeys.length >= MCP_KEY_CAP;

  const endpoint =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? "https://tamrack.ca";

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <AccountSubnav active="mcp" />

      <header className="flex flex-col gap-2">
        <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--mid)]">
          mcp · streamable http · agent access
        </p>
        <h1 className="font-mono text-2xl font-semibold text-[var(--ink)]">
          MCP token
        </h1>
        <p className="text-sm leading-relaxed text-[var(--ink)]/85">
          A Bearer token your AI coding agent uses to call Tamrack&apos;s
          MCP server. Same namespace as the HTTP API key; different name
          so usage logs read cleanly per agent.
        </p>
      </header>

      {error === "cap" && (
        <div className="border border-[var(--accent-red)]/40 bg-[var(--accent-red)]/5 p-4 text-sm text-[var(--ink)]">
          You&apos;ve reached the {MCP_KEY_CAP}-token cap. Revoke an existing
          token below before minting a new one.
        </div>
      )}

      {revoked === "1" && (
        <div className="border border-[var(--hairline)] bg-[var(--surface-elevated)]/60 p-3 font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--mid)]">
          token revoked
        </div>
      )}

      {minted === "1" && oncePlaintext && (
        <div className="border border-[var(--amber)]/40 bg-[var(--amber)]/5 p-4">
          <p className="mb-2 font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--mid)]">
            fresh mint · copy now · we don&apos;t store the plaintext
          </p>
          <p className="text-sm leading-relaxed text-[var(--ink)]/85">
            Copy the token below into your agent&apos;s MCP config. Refreshing
            this page clears it permanently — we hash the key on the way
            into the database and can&apos;t recover the plaintext.
          </p>
        </div>
      )}

      {oncePlaintext && (
        <KeyOnceCard plaintext={oncePlaintext} clearAction={clearOnceToken} />
      )}

      {/* Mint card — always present unless cap reached */}
      {!oncePlaintext && (
        <div className="bg-[var(--surface-elevated)] border border-[var(--hairline)] p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--hairline)] pb-2.5 font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--mid)]">
            <span className="flex items-center gap-2">
              <TKey size={12} className="text-[var(--mid)]" />
              mint · new token
            </span>
            <span>{activeKeys.length}/{MCP_KEY_CAP} active</span>
          </div>
          <h2 className="font-mono text-lg font-semibold text-[var(--ink)]">
            {atCap ? "Token cap reached" : "Mint a fresh token"}
          </h2>
          <p className="text-sm leading-relaxed text-[var(--ink)]/85">
            {atCap
              ? `You have ${activeKeys.length} active MCP tokens. Revoke one below before minting a new one.`
              : "Plaintext shows here once — copy it into your client config before leaving the page."}
          </p>
          <form action={issueMcpToken}>
            <button
              type="submit"
              disabled={atCap}
              className="border border-[var(--amber)] bg-[var(--amber)] px-4 py-2 font-mono text-[11px] tracking-[0.14em] uppercase text-[var(--surface)] hover:bg-[var(--amber)]/85 disabled:cursor-not-allowed disabled:opacity-40"
              style={{ transitionDuration: "var(--dur-instant)" }}
            >
              generate mcp token
            </button>
          </form>
        </div>
      )}

      {/* Existing tokens */}
      {activeKeys.length > 0 && (
        <div className="bg-[var(--surface-elevated)] border border-[var(--hairline)] p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--hairline)] pb-2.5 font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--mid)]">
            <span>active tokens · {activeKeys.length}</span>
            <span>revoke to invalidate immediately</span>
          </div>
          <ul className="divide-y divide-[var(--hairline)]">
            {activeKeys.map((k) => (
              <li
                key={k.id}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="font-mono text-sm text-[var(--ink)]">
                    {k.name}
                  </p>
                  <p className="font-mono text-[10px] tracking-wider text-[var(--mid)]">
                    {k.key_prefix}…· last used {formatRelative(k.last_used_at)}
                  </p>
                </div>
                <form action={revokeMcpToken}>
                  <input type="hidden" name="keyId" value={k.id} />
                  <button
                    type="submit"
                    className="border border-[var(--hairline)] px-3 py-1.5 font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--mid)] hover:border-[var(--accent-red)] hover:text-[var(--accent-red)]"
                    style={{ transitionDuration: "var(--dur-instant)" }}
                  >
                    revoke
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Install snippet */}
      <div className="bg-[var(--surface-elevated)] border border-[var(--hairline)] p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--hairline)] pb-2.5 font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--mid)]">
          <span>install · claude code · mcp client</span>
          <span>docs</span>
        </div>
        <p className="text-sm leading-relaxed text-[var(--ink)]/85">
          After minting, register the server with your MCP-capable agent.
          For Claude Code:
        </p>
        <pre className="overflow-x-auto border border-[var(--hairline)] bg-[var(--surface)] p-3 font-mono text-xs text-[var(--ink)]">
          {`claude mcp add tamrack \\
  --transport http \\
  --url ${endpoint}/api/mcp \\
  --header "Authorization: Bearer tk_<your-token>"`}
        </pre>
        <p className="text-xs leading-relaxed text-[var(--mid)]">
          Endpoint: <code className="font-mono text-[var(--ink)]">{endpoint}/api/mcp</code>.
          Transport is Streamable HTTP per MCP spec 2025-06-18+; the tool
          catalog publishes ten live tools across the Tamrack substrate.
        </p>
      </div>
    </main>
  );
}
