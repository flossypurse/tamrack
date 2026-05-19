/**
 * /account/chat — the Tamrack agent's home.
 *
 * Relocated from /ask on the agent-pivot branch. The chat is the primary
 * paid surface: ask a question, the agent picks tools from the MCP
 * catalogue, composes a dashboard, streams the result back. Auth-gated;
 * non-invitees bounce to /login with the chat as the post-sign-in target.
 */
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { AccountSubnav } from "@/components/account-subnav";

import { ChatClient } from "./chat-client";

export const dynamic = "force-dynamic";

export default async function AccountChatPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account/chat");
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <AccountSubnav active="chat" />

      <header className="flex flex-col gap-2">
        <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--mid)]">
          tamrack agent · dashboards on demand · stony plain
        </p>
        <h1 className="font-mono text-2xl font-semibold text-[var(--ink)]">
          Ask Tamrack
        </h1>
        <p className="text-sm leading-relaxed text-[var(--ink)]/85">
          Type a question. The agent picks tools, pulls live macro and
          regional data, and composes a dashboard in front of you.
        </p>
      </header>

      <ChatClient />
    </main>
  );
}
