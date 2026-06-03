export const dynamic = "force-dynamic";

import Link from "next/link";
import { ExternalLink, Users, Eye } from "lucide-react";
import { Card } from "@/components/card";
import { PageHeader } from "@/components/page-header";
import { listPromotionNominations } from "@/lib/smart-ui/persistence";
import { AdminNav } from "../admin-nav";
import { CurationActions } from "./curation-actions";

export default async function CurationPage() {
  const nominations = await listPromotionNominations({ limit: 50 });

  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Curation Queue"
        description="Questions that passed the truthfulness gate, nominated for promotion into the shared corpus. Approve to capture as a gated template candidate; dismiss to remove from the queue."
        category="tools"
      />

      <AdminNav />

      {nominations.length === 0 ? (
        <Card>
          <p className="text-sm text-muted py-6 text-center">
            No questions are currently nominated. Candidates appear here once a
            shared dashboard passes the promotion gate and has not yet been
            approved or dismissed.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {nominations.map((n) => (
            <Card key={n.queryHash}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-foreground font-medium break-words">
                    {n.query}
                  </p>
                  <div className="mt-1.5 flex items-center gap-4 text-xs text-muted">
                    <span className="flex items-center gap-1">
                      <Users size={12} />
                      {n.askers} {n.askers === 1 ? "asker" : "askers"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye size={12} />
                      {n.views} {n.views === 1 ? "view" : "views"}
                    </span>
                    {n.score !== null && (
                      <span className="text-accent-green">
                        truthfulness {n.score.toFixed(2)}
                      </span>
                    )}
                    <Link
                      href={`/d/${n.repSlug}`}
                      target="_blank"
                      className="flex items-center gap-1 text-accent hover:underline"
                    >
                      open dashboard <ExternalLink size={11} />
                    </Link>
                  </div>
                </div>
                <CurationActions
                  queryHash={n.queryHash}
                  repDashboardId={n.repDashboardId}
                />
              </div>

              {n.judgeReasons.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-card-border pt-3">
                  {n.judgeReasons.map((reason, i) => (
                    <li
                      key={i}
                      className="text-xs text-muted flex gap-2 leading-snug"
                    >
                      <span className="text-accent-green shrink-0">✓</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
