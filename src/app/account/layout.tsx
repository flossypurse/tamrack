/**
 * Account workspace shell — the full-screen, three-column surface that every
 * /account page renders inside. The global site chrome (top nav, breadcrumbs,
 * footer) is deliberately bypassed for /account in app-shell.tsx; this layout
 * is the only chrome here.
 *
 *   LEFT   — API key + MCP token management + the single sign-out
 *   CENTER — the page (chat, or a sub-page like full history)
 *   RIGHT  — recent Q&As; clicking one opens /d/{slug}
 *
 * On < md the rails collapse into bottom-bar drawers so the chat owns the
 * width. Auth is enforced here so every sub-page is gated in one place.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { ONCE_KEY_COOKIE, MCP_ONCE_KEY_COOKIE } from "@/lib/key-cookies";
import { listActiveMcpKeys } from "@/lib/mcp-tokens";
import { WorkspaceLeftRail } from "@/components/workspace/left-rail";
import { WorkspaceRightRail } from "@/components/workspace/right-rail";
import { MobileWorkspaceBar } from "@/components/workspace/mobile-bar";

export const dynamic = "force-dynamic";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account/chat");
  }
  const user = session.user;
  const userId = user.id;

  const jar = await cookies();
  const apiKeyOnce = jar.get(ONCE_KEY_COOKIE)?.value ?? null;
  const mcpOnce = jar.get(MCP_ONCE_KEY_COOKIE)?.value ?? null;
  const activeMcpKeys = await listActiveMcpKeys(userId);

  const identity = user.name || user.email || "founder access";
  const mcpEndpoint =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? "https://tamrack.ca";

  const leftRail = (
    <WorkspaceLeftRail
      identity={identity}
      apiKeyOnce={apiKeyOnce}
      mcpOnce={mcpOnce}
      activeMcpKeys={activeMcpKeys}
      mcpEndpoint={mcpEndpoint}
    />
  );
  const rightRail = <WorkspaceRightRail userId={userId} />;

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--surface)]">
      {/* LEFT rail — desktop (lg+) */}
      <aside className="hidden w-72 shrink-0 border-r border-[var(--hairline)] lg:block">
        {leftRail}
      </aside>

      {/* CENTER — the page */}
      <main className="min-w-0 flex-1 overflow-y-auto pb-14 lg:pb-0">
        {children}
      </main>

      {/* RIGHT rail — desktop (lg+) */}
      <aside className="hidden w-72 shrink-0 border-l border-[var(--hairline)] lg:block">
        {rightRail}
      </aside>

      {/* Below lg — bottom bar exposes both rails as drawers */}
      <MobileWorkspaceBar left={leftRail} right={rightRail} />
    </div>
  );
}
