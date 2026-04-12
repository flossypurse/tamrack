import { NextResponse } from "next/server";

// Explicit sign-out route that clears all auth cookies and redirects.
// The standard NextAuth client-side signOut() and server-action signOut()
// both have cookie-clearing issues in v5 beta + Next.js 16.
export async function POST(req: Request) {
  const { origin } = new URL(req.url);
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
