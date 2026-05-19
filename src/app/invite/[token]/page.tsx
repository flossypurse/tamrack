/**
 * /invite/[token] — invite redemption landing page.
 *
 * Flow:
 *   1. Visitor lands on /invite/<token>
 *   2. Page validates the token server-side (look up + check not redeemed,
 *      not expired). If invalid, show "invite not found or already used".
 *   3. If valid, ask for the visitor's email and POST to
 *      /api/auth/signin/email — the NextAuth magic-link flow.
 *      The token is captured in a sessionStorage / cookie so the post-login
 *      callback knows which invite to mark redeemed.
 *
 * v1 keeps the UI minimal and brand-voice-final-pass-pending. The
 * post-login wiring (creating the user, issuing tk_*, calling
 * redeemInvite()) belongs in a NextAuth `events.signIn` callback OR in a
 * one-shot POST /api/invite/[token]/claim endpoint hit by the page after
 * the magic-link completes. We pick the latter (simpler observability) —
 * the page below sets the token cookie and the claim endpoint runs after
 * sign-in completes.
 */
import { lookupInvite } from "@/lib/invites";

interface PageProps {
  params: Promise<{ token: string }>;
}

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: PageProps) {
  const { token } = await params;
  const invite = await lookupInvite(token);

  if (!invite) {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-4 px-6 py-16">
        <h1 className="text-2xl font-semibold">Invite not available</h1>
        <p className="text-sm text-[var(--muted)]">
          This invite is invalid, has already been redeemed, or has expired.
        </p>
        <p className="text-sm text-[var(--muted)]">
          If you believe this is a mistake, reply to the person who sent the
          invite.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">You&apos;re invited.</h1>
        <p className="text-sm text-[var(--muted)]">
          Enter the email you want this account attached to. We&apos;ll send
          you a sign-in link; the first time you sign in we&apos;ll create
          your account and provision an API key.
        </p>
      </header>

      <form
        method="POST"
        action="/api/auth/signin/email"
        className="flex flex-col gap-3"
      >
        {/* NextAuth email provider expects this field. */}
        <input
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          className="rounded-md border border-[var(--card-border)] bg-[var(--card)] px-4 py-3 text-base outline-none focus:border-[var(--accent)]"
        />
        {/* Smuggle the invite token through so the post-sign-in claim hook
            can mark it redeemed. NextAuth callbackUrl preserves params. */}
        <input
          type="hidden"
          name="callbackUrl"
          value={`/api/invite/claim?token=${encodeURIComponent(token)}`}
        />
        <button
          type="submit"
          className="rounded-md bg-[var(--accent)] px-6 py-3 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
        >
          Send sign-in link
        </button>
      </form>

      {invite.email_hint && (
        <p className="text-xs text-[var(--muted)]">
          Hint from sender: this invite was prepared for{" "}
          <code className="rounded bg-[var(--card)] px-1.5 py-0.5">
            {invite.email_hint}
          </code>
          .
        </p>
      )}
    </main>
  );
}
