/**
 * Workspace left rail — API key + MCP token management, plus the single
 * prominent sign-out. Rendered by the account layout on every /account page,
 * so it's an always-present management surface alongside the chat.
 *
 * Server component: all data (one-shot cookies, active MCP keys, identity) is
 * read in the layout and passed down as props. Mutations go through the server
 * actions in app/account/actions.ts.
 */
import { Symbol } from "@/components/brand/wordmark";
import { KeyOnceCard } from "@/components/key-once-card";
import { TKey } from "@/components/icons/t3";
import { MCP_KEY_CAP, formatRelative, type McpKey } from "@/lib/mcp-tokens";
import {
  issueMcpToken,
  revokeMcpToken,
  clearMcpOnce,
  clearApiKeyOnce,
} from "@/app/account/actions";

interface Props {
  identity: string;
  apiKeyOnce: string | null;
  mcpOnce: string | null;
  activeMcpKeys: McpKey[];
  mcpEndpoint: string;
}

const SECTION_LABEL =
  "font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--mid)]";

export function WorkspaceLeftRail({
  identity,
  apiKeyOnce,
  mcpOnce,
  activeMcpKeys,
  mcpEndpoint,
}: Props) {
  const atCap = activeMcpKeys.length >= MCP_KEY_CAP;

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--surface-elevated)] p-4">
      {/* Brand mark */}
      <div className="flex items-center gap-2 pb-3 text-[var(--ink)]">
        <Symbol size={18} />
        <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-[var(--mid)]">
          tamrack
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-6 border-t border-[var(--hairline)] pt-4">
        {/* ── API key ── */}
        <section className="flex flex-col gap-2">
          <p className={SECTION_LABEL}>api key · http</p>
          {apiKeyOnce ? (
            <KeyOnceCard plaintext={apiKeyOnce} clearAction={clearApiKeyOnce} />
          ) : (
            <p className="text-xs leading-relaxed text-[var(--mid)]">
              Your founder key is shown once at issue. If you missed it, ask
              Cully for a replacement — the plaintext is never stored.
            </p>
          )}
        </section>

        {/* ── MCP tokens ── */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className={SECTION_LABEL}>mcp tokens</p>
            <span className="font-mono text-[10px] text-[var(--mid)]">
              {activeMcpKeys.length}/{MCP_KEY_CAP}
            </span>
          </div>

          {mcpOnce ? (
            <KeyOnceCard plaintext={mcpOnce} clearAction={clearMcpOnce} />
          ) : (
            <form action={issueMcpToken}>
              <button
                type="submit"
                disabled={atCap}
                className="w-full border border-[var(--amber)] bg-[var(--amber)] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--surface)] hover:bg-[var(--amber)]/85 disabled:cursor-not-allowed disabled:opacity-40"
                style={{ transitionDuration: "var(--dur-instant)" }}
              >
                generate mcp token
              </button>
            </form>
          )}

          {activeMcpKeys.length > 0 && (
            <ul className="flex flex-col divide-y divide-[var(--hairline)] border-t border-[var(--hairline)]">
              {activeMcpKeys.map((k) => (
                <li
                  key={k.id}
                  className="flex items-center justify-between gap-2 py-2"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-mono text-[11px] text-[var(--ink)]">
                      {k.name}
                    </span>
                    <span className="font-mono text-[9px] tracking-wider text-[var(--mid)]">
                      {k.key_prefix}… · {formatRelative(k.last_used_at)}
                    </span>
                  </div>
                  <form action={revokeMcpToken}>
                    <input type="hidden" name="keyId" value={k.id} />
                    <button
                      type="submit"
                      className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--mid)] hover:text-[var(--accent-red)]"
                      style={{ transitionDuration: "var(--dur-instant)" }}
                    >
                      revoke
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          <details className="group">
            <summary className="cursor-pointer list-none font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--mid)] hover:text-[var(--amber)]">
              install snippet
            </summary>
            <pre className="mt-2 overflow-x-auto border border-[var(--hairline)] bg-[var(--surface)] p-2 font-mono text-[10px] leading-relaxed text-[var(--ink)]">
              {`claude mcp add tamrack \\
  --transport http \\
  --url ${mcpEndpoint}/api/mcp \\
  --header "Authorization: Bearer tk_…"`}
            </pre>
          </details>
        </section>
      </div>

      {/* ── Identity + sign out ── */}
      <footer className="flex flex-col gap-2 border-t border-[var(--hairline)] pt-3">
        <span className="flex items-center gap-1.5 truncate font-mono text-[10px] text-[var(--mid)]">
          <TKey size={11} className="shrink-0 text-[var(--mid)]" />
          {identity}
        </span>
        {/* Manual cookie-clearing route — NextAuth v5 signOut() leaves
            __Secure-/__Host- cookies under Next 16. */}
        <form action="/api/auth/sign-out" method="POST">
          <button
            type="submit"
            className="w-full border border-[var(--hairline)] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--mid)] hover:border-[var(--accent-red)] hover:text-[var(--accent-red)]"
            style={{ transitionDuration: "var(--dur-instant)" }}
          >
            sign out
          </button>
        </form>
      </footer>
    </div>
  );
}
