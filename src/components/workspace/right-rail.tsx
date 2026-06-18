/**
 * Workspace right rail — the user's recent Q&As plus the shared "what Alberta
 * is asking" feed. The recent list re-fetches on router.refresh() (chat-client
 * fires it after each saved answer), so new questions appear without a reload;
 * the shared feed rides the same refresh.
 */
import { ChatHistorySidebar } from "@/components/chat-history-sidebar";
import { WhatAlbertaIsAsking } from "@/components/workspace/what-alberta-is-asking";

export function WorkspaceRightRail({
  userId,
  currentSlug,
}: {
  userId: string;
  currentSlug?: string;
}) {
  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto bg-[var(--surface)] p-4">
      <ChatHistorySidebar userId={userId} currentSlug={currentSlug} />
      <WhatAlbertaIsAsking currentSlug={currentSlug} />
    </div>
  );
}
