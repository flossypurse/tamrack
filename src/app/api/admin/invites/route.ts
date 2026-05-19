/**
 * Admin invites API.
 *
 * GET  /api/admin/invites           — list all invites (latest 200)
 * POST /api/admin/invites           — create a new invite token
 *      body: { email_hint?: string }
 *      returns: { id, url, expires_at, token }  // token plaintext, SHOWN ONCE
 *
 * Auth: session-only, requires session.user.role === "admin". The middleware
 * already restricts /api/admin/** to authed admins, but we double-check here
 * because the middleware logic is broad and this endpoint mints credentials.
 */
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { createInvite, listInvites } from "@/lib/invites";

async function requireAdmin(): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (session.user.role !== "admin") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { ok: true, userId: session.user.id };
}

export async function GET(): Promise<NextResponse> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;
  const invites = await listInvites();
  return NextResponse.json({ invites });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  let body: { email_hint?: string };
  try {
    body = (await req.json()) as { email_hint?: string };
  } catch {
    body = {};
  }

  const origin = req.nextUrl.origin;
  const invite = await createInvite(
    {
      createdByUserId: gate.userId,
      emailHint:
        typeof body.email_hint === "string" && body.email_hint.trim()
          ? body.email_hint.trim()
          : undefined,
    },
    origin,
  );

  return NextResponse.json({
    id: invite.id,
    token: invite.token, // ONE-TIME-VISIBLE
    url: invite.url,
    expires_at: invite.expiresAt,
  });
}
