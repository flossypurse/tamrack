/**
 * GET /api/invite/claim?token=<plaintext>
 *
 * Post-sign-in handoff for the invite-wall flow. The /invite/[token] page
 * posts to NextAuth's email provider with this URL as `callbackUrl`.
 * After the user clicks the magic link in their email, NextAuth completes
 * the sign-in and redirects them here.
 *
 * Behaviour:
 *   - If no session yet (magic link not clicked), bounce to /login.
 *   - If session + valid invite, atomically:
 *       * mark invite redeemed (only one caller wins on concurrent claims)
 *       * flag user.early_access = TRUE
 *       * set user.plan = 'founder' (uncapped, no metering — early-access wave)
 *       * mint a fresh tk_* API key with full read scopes
 *       * stash the plaintext key in a 5-minute HttpOnly cookie scoped to
 *         /account/keys (NOT a URL query param — those land in browser
 *         history + referer headers + analytics pixels)
 *     Then redirect to /account/keys?invite_redeemed=1.
 *   - If invite invalid / already redeemed, redirect to / with an error
 *     query param.
 *
 * Idempotency note: redeemInvite() uses a conditional UPDATE so a double-
 * click of the magic link only mints one key. The second pass falls into
 * the "already redeemed" branch and quietly redirects.
 */
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { createApiKey } from "@/lib/api-keys";
import { getDb } from "@/lib/db";
import { redeemInvite, lookupInvite, ONCE_KEY_COOKIE } from "@/lib/invites";

const FULL_READ_SCOPES = [
  "tamrack:macro:read",
  "tamrack:regional:read",
  "tamrack:real-estate:read",
  "tamrack:energy:read",
  "tamrack:economy:read",
] as const;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/?invite=missing", req.url));
  }

  const session = await auth();
  if (!session?.user?.id) {
    // No session — magic link not completed yet. Bounce to login,
    // preserving the claim URL as the callback.
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  const invite = await lookupInvite(token);
  if (!invite) {
    return NextResponse.redirect(new URL("/?invite=invalid", req.url));
  }

  const ok = await redeemInvite(token, session.user.id);
  if (!ok) {
    // Lost the race — another tab consumed it. Treat as success-ish; the
    // user already has a session so they can still use the app.
    return NextResponse.redirect(new URL("/?invite=already_redeemed", req.url));
  }

  // Flag the user as early-access AND elevate to founder plan. Founder =
  // uncapped + no Stripe meter events (api-keys.ts PLAN_LIMITS). Otherwise
  // a fresh invitee on plan='free' would be charged overage from request #1.
  // Flip to 'tamrack' on public launch when invoicing turns on.
  const pool = await getDb();
  await pool.query(
    `UPDATE users SET early_access = TRUE, plan = 'founder' WHERE id = $1`,
    [session.user.id],
  );

  const { key } = await createApiKey(
    session.user.id,
    "early-access (invite redemption)",
    [...FULL_READ_SCOPES],
  );

  // Stash the plaintext key in a short-lived HttpOnly cookie scoped to the
  // page that will display it. HttpOnly keeps it out of JS; path=/account/keys
  // means it isn't sent on any other request; SameSite=Strict blocks cross-
  // site CSRF reads. The /account/keys page reads it via cookies(), renders
  // once, and clears it via a server action when the user confirms saving.
  const dest = new URL("/account/keys", req.url);
  dest.searchParams.set("invite_redeemed", "1");
  const res = NextResponse.redirect(dest);
  res.cookies.set({
    name: ONCE_KEY_COOKIE,
    value: key,
    httpOnly: true,
    secure: req.nextUrl.protocol === "https:",
    sameSite: "strict",
    path: "/account/keys",
    maxAge: 60 * 5, // 5 minutes — long enough to copy, short enough to fail-safe
  });
  return res;
}
