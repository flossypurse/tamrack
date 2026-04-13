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

  // Clear both secure and non-secure cookie variants.
  // __Secure-* and __Host-* cookies REQUIRE the Secure attribute in the
  // Set-Cookie header — browsers silently ignore the header without it,
  // which is why sign-out was not working in production (HTTPS).
  const isSecure = proto === "https";

  const plainCookies = [
    "authjs.session-token",
    "authjs.csrf-token",
    "authjs.callback-url",
  ];
  const secureCookies = [
    "__Secure-authjs.session-token",
    "__Secure-authjs.callback-url",
  ];
  const hostCookies = [
    "__Host-authjs.csrf-token",
  ];

  for (const name of plainCookies) {
    response.cookies.set(name, "", { maxAge: 0, path: "/" });
  }
  for (const name of secureCookies) {
    response.cookies.set(name, "", { maxAge: 0, path: "/", secure: isSecure });
  }
  for (const name of hostCookies) {
    response.cookies.set(name, "", { maxAge: 0, path: "/", secure: isSecure });
  }

  return response;
}
