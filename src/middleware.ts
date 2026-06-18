import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// ── Two-door access wall ───────────────────────────────────────────────
// The surface is two doors: the public chart catalogue, and the invite-only
// account workspace. There is no subscription/billing tier while invite-only,
// so the middleware is just: public allow-list passes; everything else needs a
// session (or a Bearer API key); admin needs the admin role. The page/route
// handlers do the finer-grained access checks (e.g. userHasTamrackAccess).

// Public — readable with no session.
const PUBLIC_ROUTES = ["/", "/login", "/terms", "/privacy", "/charts"];
const PUBLIC_PREFIXES = [
  "/api/auth/",
  "/api/health",
  "/api/og",
  // Invite redemption surface — token in the path, validated by the page.
  "/invite/",
  // The open layer: the chart catalogue + embeds.
  "/charts/",
  "/embed/",
];

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

function isAdminRoute(pathname: string): boolean {
  return pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Static files and Next.js internals.
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // API routes carrying a Bearer key — validation happens in the route handler.
  // Accept tk_* (Tamrack) and ap_* (legacy dual-accept window).
  if (isApiRoute(pathname)) {
    const authHeader = req.headers.get("authorization");
    if (
      authHeader?.startsWith("Bearer tk_") ||
      authHeader?.startsWith("Bearer ap_")
    ) {
      return NextResponse.next();
    }
  }

  // Session JWT (works in Edge Runtime — no DB access needed).
  const secureCookie =
    req.headers.get("x-forwarded-proto") === "https" ||
    req.nextUrl.protocol === "https:";
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    secureCookie,
  });

  // Logged-in users hitting /login — skip the form, go to callbackUrl or the
  // account workspace.
  if (token && pathname === "/login") {
    const callbackUrl = req.nextUrl.searchParams.get("callbackUrl");
    // Reject protocol-relative (`//evil.com/x`) and backslash variants that
    // resolve off-site through new URL(). Only same-origin relative paths
    // beginning with a single forward slash are allowed.
    if (callbackUrl && /^\/(?![/\\])/.test(callbackUrl)) {
      return NextResponse.redirect(new URL(callbackUrl, req.url));
    }
    return NextResponse.redirect(new URL("/account", req.url));
  }

  // Public routes always pass.
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // No session — 401 for API, redirect to login for pages.
  if (!token) {
    if (isApiRoute(pathname)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin needs the admin role.
  if (isAdminRoute(pathname)) {
    if (token.role !== "admin") {
      return NextResponse.redirect(new URL("/account", req.url));
    }
    return NextResponse.next();
  }

  // Any other authenticated request (account workspace, data APIs, saved
  // dashboards) passes; the handler enforces the real access check.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
