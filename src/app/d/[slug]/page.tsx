/**
 * /d/[slug] — saved Smart UI dashboard view.
 *
 * Loads the persisted plan + config + tool_args for the given slug. Then
 * REPLAYS the MCP tool calls (rather than serving a cached snapshot) so
 * the rendered numbers are always fresh against the substrate. The
 * composed dashboard config is what was originally generated — we don't
 * re-run Sonnet for /d/<slug> renders.
 *
 * "Replay-not-snapshot" decision: the substrate is the source of truth;
 * caching a saved-at snapshot would lie about when the data was current.
 * The 1-2 MCP-tool-call latency on each /d/<slug> render is the price.
 *
 * Errors:
 *   - Slug unknown → 404
 *   - Tool replay error → render the config with an error card per tool
 */
import { notFound, redirect } from "next/navigation";

import { SmartUiDashboard } from "@/components/smart-ui/dashboard";
import { auth } from "@/lib/auth";
import { userHasTamrackAccess } from "@/lib/early-access";
import { createInProcessMcpClient } from "@/lib/smart-ui/mcp-client";
import { loadDashboardBySlug } from "@/lib/smart-ui/persistence";
import type { ToolCallResult } from "@/lib/smart-ui/types";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export default async function SavedDashboardPage({ params }: PageProps) {
  const { slug } = await params;

  // Tamrack access check — middleware lets any logged-in user reach this
  // page (it's in TAMRACK_SELF_GATED_PREFIXES), so we enforce here. Sends
  // unauthenticated requests to /login with a callback, and authenticated
  // non-invitees to /sunset (the dedicated "not for you yet" page).
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/d/${slug}`)}`);
  }
  const access = await userHasTamrackAccess(session.user.id);
  if (!access.authorized) {
    redirect("/sunset");
  }

  const loaded = await loadDashboardBySlug(slug);
  if (!loaded) {
    notFound();
  }

  // Replay tool calls in-process. Each tool call gets its own try/catch so
  // one bad tool doesn't break the page.
  const mcp = await createInProcessMcpClient();
  const toolResults: ToolCallResult[] = [];
  try {
    for (const planned of loaded.toolArgs) {
      const result = await mcp.callTool(planned.tool, {
        ...planned.args,
        __card_id: planned.card_id,
      });
      result.card_id = planned.card_id;
      toolResults.push(result);
    }
  } finally {
    await mcp.close();
  }

  const toolResultsByCardId: Record<string, ToolCallResult> =
    Object.fromEntries(toolResults.map((r) => [r.card_id, r]));

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
      <header className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-wider text-[var(--muted)]">
          Saved dashboard
        </p>
        <h1 className="text-2xl font-semibold">{loaded.config.title}</h1>
        {loaded.config.subtitle && (
          <p className="text-sm text-[var(--muted)]">{loaded.config.subtitle}</p>
        )}
        <p className="text-xs text-[var(--muted)]">
          Originally asked: <em>{loaded.query}</em>
        </p>
      </header>
      <SmartUiDashboard
        dashboard={loaded.config}
        toolResultsByCardId={toolResultsByCardId}
      />
    </main>
  );
}
