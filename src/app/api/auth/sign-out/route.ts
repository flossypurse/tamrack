import { NextResponse } from "next/server";

// Explicit sign-out route that clears all auth cookies and redirects.
// The standard NextAuth client-side signOut() and server-action signOut()
// both have cookie-clearing issues in v5 beta + Next.js 16.
export async function POST(req: Request) {
  // Use x-forwarded-host/proto to get the real public origin behind Railway's proxy
  const headers = new Headers(req.headers);
  const proto = headers.get("x-forwarded-proto") || "https";
  const host = headers.get("x-forwarded-host") || headers.get("host") || "albertapulsecheck.ca";
  const origin = `${proto}://${host}`;
  const response = NextResponse.redirect(origin, 302);

  // Clear both secure and non-secure cookie variants
  const cookieNames = [
    "authjs.session-token",
    "__Secure-authjs.session-token",
    "authjs.csrf-token",
    "__Host-authjs.csrf-token",
    "authjs.callback-url",
    "__Secure-authjs.callback-url",
  ];

  for (const name of cookieNames) {
    response.cookies.set(name, "", { maxAge: 0, path: "/" });
  }

  return response;
}
