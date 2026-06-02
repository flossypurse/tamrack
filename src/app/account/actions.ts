"use server";

/**
 * Server actions for the account workspace rail. Extracted here (rather than
 * living in route/page files) so the left rail — present on every /account
 * page via the workspace layout — can import and invoke them.
 *
 * The one-shot token cookies are scoped to `/account` (not a single sub-page)
 * so a token minted from the rail on /account/chat is readable by the layout
 * wherever the user currently is. All flows redirect back into the workspace.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { createApiKey, revokeApiKey } from "@/lib/api-keys";
import { ONCE_KEY_COOKIE, MCP_ONCE_KEY_COOKIE } from "@/lib/key-cookies";
import {
  MCP_SCOPES,
  MCP_NAME_PREFIX,
  MCP_KEY_CAP,
  listActiveMcpKeys,
} from "@/lib/mcp-tokens";
import {
  HTTP_SCOPES,
  HTTP_NAME_PREFIX,
  HTTP_KEY_CAP,
  listActiveHttpKeys,
} from "@/lib/http-keys";

const WORKSPACE = "/account/chat";

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${WORKSPACE}`);
  }
  return session.user.id;
}

export async function issueMcpToken(): Promise<void> {
  const userId = await requireUserId();

  // Cap is enforced in the UI (button disabled) and here as a guard; at cap
  // we simply bounce back — the rail already shows the count + disabled mint.
  const active = await listActiveMcpKeys(userId);
  if (active.length >= MCP_KEY_CAP) {
    redirect(WORKSPACE);
  }

  const issuedAt = new Date().toISOString().slice(0, 10);
  const { key } = await createApiKey(
    userId,
    `${MCP_NAME_PREFIX} ${issuedAt}`,
    [...MCP_SCOPES],
  );

  const jar = await cookies();
  jar.set({
    name: MCP_ONCE_KEY_COOKIE,
    value: key,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/account",
    maxAge: 60 * 5,
  });

  // Cookie reveal (rail shows the one-shot card) is the confirmation.
  redirect(WORKSPACE);
}

export async function issueHttpKey(): Promise<void> {
  const userId = await requireUserId();

  // Cap mirrors MCP: enforced in the UI (button disabled) and here as a
  // guard. At cap we bounce back — the rail shows the count + disabled mint.
  const active = await listActiveHttpKeys(userId);
  if (active.length >= HTTP_KEY_CAP) {
    redirect(WORKSPACE);
  }

  const issuedAt = new Date().toISOString().slice(0, 10);
  const { key } = await createApiKey(
    userId,
    `${HTTP_NAME_PREFIX} ${issuedAt}`,
    [...HTTP_SCOPES],
  );

  const jar = await cookies();
  jar.set({
    name: ONCE_KEY_COOKIE,
    value: key,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/account",
    maxAge: 60 * 5,
  });

  // Cookie reveal (rail shows the one-shot card) is the confirmation.
  redirect(WORKSPACE);
}

export async function revokeHttpKey(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const keyId = formData.get("keyId");
  if (typeof keyId !== "string" || !keyId) {
    redirect(WORKSPACE);
  }
  await revokeApiKey(keyId as string, userId);
  redirect(WORKSPACE);
}

export async function revokeMcpToken(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const keyId = formData.get("keyId");
  if (typeof keyId !== "string" || !keyId) {
    redirect(WORKSPACE);
  }
  await revokeApiKey(keyId as string, userId);
  redirect(WORKSPACE);
}

export async function clearMcpOnce(): Promise<void> {
  await requireUserId();
  const jar = await cookies();
  jar.delete(MCP_ONCE_KEY_COOKIE);
  redirect(WORKSPACE);
}

export async function clearApiKeyOnce(): Promise<void> {
  await requireUserId();
  const jar = await cookies();
  jar.delete(ONCE_KEY_COOKIE);
  redirect(WORKSPACE);
}
