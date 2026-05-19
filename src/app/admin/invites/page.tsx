"use client";

/**
 * /admin/invites — admin UI for issuing + viewing invite tokens.
 *
 * Minimal — list table, "new invite" form (optional email hint), and a
 * one-time display of the freshly-minted invite URL.
 *
 * Brand-voice-final-pass-pending: placeholder copy, declarative.
 */

import { useEffect, useState } from "react";

interface InviteRow {
  id: string;
  email_hint: string | null;
  redeemed_at: string | null;
  redeemed_by_user_id: string | null;
  expires_at: string;
  created_at: string;
  status: "pending" | "redeemed" | "expired";
}

interface CreatedInvite {
  id: string;
  token: string;
  url: string;
  expires_at: string;
}

export default function AdminInvitesPage() {
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [emailHint, setEmailHint] = useState("");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedInvite | null>(null);
  const [error, setError] = useState<string>("");

  async function refresh() {
    try {
      const res = await fetch("/api/admin/invites", { cache: "no-store" });
      if (!res.ok) {
        setError(`Failed to load invites: ${res.status}`);
        return;
      }
      const data = (await res.json()) as { invites: InviteRow[] };
      setInvites(data.invites);
      setError("");
    } catch (e) {
      setError(`Failed to load invites: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreated(null);
    setError("");
    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email_hint: emailHint || undefined }),
      });
      if (!res.ok) {
        setError(`Create failed: ${res.status}`);
        return;
      }
      const data = (await res.json()) as CreatedInvite;
      setCreated(data);
      setEmailHint("");
      await refresh();
    } catch (e) {
      setError(`Create failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Invites</h1>
        <p className="text-sm text-[var(--muted)]">
          One-time-use tokens. Send the URL to a person; they redeem it for
          an account + API key.
        </p>
      </header>

      <section className="rounded-lg border border-[var(--card-border)] bg-[var(--card)] p-4">
        <h2 className="mb-3 text-sm font-medium">New invite</h2>
        <form onSubmit={onCreate} className="flex flex-col gap-3 sm:flex-row">
          <input
            type="email"
            value={emailHint}
            onChange={(e) => setEmailHint(e.target.value)}
            placeholder="Optional: email hint (who is this for?)"
            className="flex-1 rounded-md border border-[var(--card-border)] bg-[var(--background)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
          <button
            type="submit"
            disabled={creating}
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create invite"}
          </button>
        </form>
        {created && (
          <div className="mt-4 rounded-md border border-[var(--accent)] bg-[var(--background)] p-3">
            <p className="text-xs font-medium text-[var(--accent)]">
              Invite created. Copy this URL now — it won&apos;t be shown again.
            </p>
            <pre className="mt-2 overflow-x-auto text-xs">
              <code>{created.url}</code>
            </pre>
            <p className="mt-2 text-xs text-[var(--muted)]">
              Expires {new Date(created.expires_at).toLocaleString()}.
            </p>
          </div>
        )}
        {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium">Recent invites</h2>
        <div className="overflow-hidden rounded-lg border border-[var(--card-border)]">
          <table className="w-full text-xs">
            <thead className="bg-[var(--card)] text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Email hint</th>
                <th className="px-3 py-2 font-medium">Created</th>
                <th className="px-3 py-2 font-medium">Expires</th>
                <th className="px-3 py-2 font-medium">Redeemed</th>
              </tr>
            </thead>
            <tbody>
              {invites.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-[var(--muted)]">
                    No invites yet.
                  </td>
                </tr>
              )}
              {invites.map((i) => (
                <tr key={i.id} className="border-t border-[var(--card-border)]">
                  <td className="px-3 py-2 capitalize">{i.status}</td>
                  <td className="px-3 py-2 font-mono">{i.email_hint ?? "—"}</td>
                  <td className="px-3 py-2 text-[var(--muted)]">
                    {new Date(i.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-[var(--muted)]">
                    {new Date(i.expires_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-[var(--muted)]">
                    {i.redeemed_at
                      ? new Date(i.redeemed_at).toLocaleDateString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
