/**
 * /account/chat — the workspace home (center column).
 *
 * Auth is enforced by the account layout. The surrounding 3-column shell
 * (key/token rail, chat, history rail) comes from that layout — this page is
 * just the chat itself: ask a question, the agent picks tools, composes a
 * dashboard, streams it back. Saved answers land at /d/{slug} and appear in
 * the right rail.
 */
import { ChatClient } from "./chat-client";

export const dynamic = "force-dynamic";

export default function AccountChatPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-[var(--mid)]">
          tamrack agent · dashboards on demand
        </p>
        <h1 className="font-mono text-2xl font-semibold text-[var(--ink)]">
          Ask Tamrack
        </h1>
        <p className="text-sm leading-relaxed text-[var(--ink)]/85">
          Type a question. The agent picks tools, pulls live macro and regional
          data, and composes a dashboard in front of you.
        </p>
      </header>

      <ChatClient />
    </div>
  );
}
