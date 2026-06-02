/**
 * Workspace right rail — the user's recent Q&As. Thin wrapper around the
 * existing ChatHistorySidebar (reused verbatim); it re-fetches on
 * router.refresh(), which chat-client fires after each saved answer, so new
 * questions appear here without a manual reload.
 */
import { ChatHistorySidebar } from "@/components/chat-history-sidebar";

export function WorkspaceRightRail({
  userId,
  currentSlug,
}: {
  userId: string;
  currentSlug?: string;
}) {
  return (
    <div className="h-full overflow-y-auto bg-[var(--surface)] p-4">
      <ChatHistorySidebar userId={userId} currentSlug={currentSlug} />
    </div>
  );
}
